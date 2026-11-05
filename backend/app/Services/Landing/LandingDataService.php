<?php

namespace App\Services\Landing;

use App\Models\College;
use App\Models\Company;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\CoreQuestion;
use App\Models\CuratedSetQuestion;
use App\Models\MockInterviewQuestion;
use App\Models\Problem;
use App\Models\ProblemTestCase;
use App\Models\SoftSkillQuestion;
use App\Models\Submission;
use App\Models\User;
use App\Models\WeeklyRewardWinner;
use App\Services\ContestLeaderboardService;
use App\Services\DailyChallengeService;
use App\Services\Vault\CuratedCatalog;
use App\Services\WeeklyRewardService;
use App\Support\BranchCatalog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Every fact the public landing page quotes, in one answer (GET /api/public/landing). The marketing site is a static export, so it
 * cannot know today's contest or this week's vouchers at build time; it asks here, once, when the page opens.
 *
 * Rules this class keeps:
 *   - Only aggregates and catalogue facts. No student's name, email, college or score ever leaves here, and nothing that sits behind a login.
 *   - Depth numbers (what a student gets) are always true and always returned. Adoption numbers (how many use it) come back as null until
 *     they pass the floor in config/landing.php, so the page never prints a figure that would undersell the product or inflate it.
 *   - Each block is built on its own: one that fails (a table missing on an old database, a catalogue that will not load) comes back null
 *     and the page leaves that block out, instead of the whole landing page failing.
 *   - Two caches: the live blocks (tonight's contest, the week's vouchers) for a minute, the catalogue counts for ten.
 */
class LandingDataService
{
    public function __construct(
        private readonly DailyChallengeService $daily,
        private readonly WeeklyRewardService $rewards,
        private readonly ContestLeaderboardService $board,
        private readonly BranchCatalog $branches,
        private readonly CuratedCatalog $vault,
    ) {}

    public function payload(): array
    {
        $live = Cache::remember('public:landing:live:v1', max(0, (int) config('landing.cache.live', 60)), fn () => [
            'contest' => $this->safely('contest', fn () => $this->contest()),
            'rewards' => $this->safely('rewards', fn () => $this->weeklyRewards()),
        ]);

        $catalogue = Cache::remember('public:landing:catalogue:v1', max(0, (int) config('landing.cache.catalogue', 600)), fn () => [
            'stats' => $this->safely('stats', fn () => $this->stats()),
            'companies' => $this->safely('companies', fn () => $this->companies()) ?? [],
            'departments' => $this->safely('departments', fn () => $this->departments()) ?? [],
        ]);

        return [
            'generated_at' => now()->toIso8601String(),
            'policy' => $this->policy(),
        ] + $live + $catalogue;
    }

    /** The rules the page states in words ("opens at 60%", "8 PM IST", "resets Monday"), read from the settings that enforce them. */
    private function policy(): array
    {
        return [
            'vault_bar' => (int) config('vault.enter_score', 60),
            'daily' => [
                'name' => $this->daily->name(),
                'start_label' => $this->daily->startLabel(),
                'duration_minutes' => $this->daily->durationMinutes(),
                'problems' => count((array) config('contests.daily.points', [])),
                'points' => (int) array_sum((array) config('contests.daily.points', [])),
                'timezone' => $this->daily->timezone(),
            ],
            'week' => ['resets_on' => 'Monday', 'timezone' => $this->board->timezone()],
        ];
    }

    // ------------------------------------------------------------------ numbers

    private function stats(): array
    {
        $floors = (array) config('landing.floors', []);
        $gate = fn (string $key, int $count): ?int => $count >= max(1, (int) ($floors[$key] ?? 0)) ? $count : null;

        $companyPacks = $this->companyQuery()->get();
        [$domains, $stacks, $interviewQuestions] = $this->interviewCatalogue();

        $departments = $this->branches->departments();
        $branchTotal = count($this->branches->branches());

        $judged = Schema::hasTable('submissions') ? Submission::count() : 0;
        $sent = Schema::hasTable('weekly_reward_winners') ? WeeklyRewardWinner::where('status', WeeklyRewardWinner::SENT)->count() : 0;

        return [
            'depth' => [
                'problems' => Problem::count(),
                'test_cases' => ProblemTestCase::count(),
                'languages' => count((array) config('piston.languages', [])),
                'interview_questions' => $interviewQuestions + MockInterviewQuestion::count(),
                'interview_stacks' => $stacks,
                'interview_domains' => $domains,
                'assessment_questions' => SoftSkillQuestion::where('is_active', true)->count() + CoreQuestion::where('status', CoreQuestion::STATUS_PUBLISHED)->count(),
                'company_packs' => $companyPacks->count(),
                'company_questions' => (int) $companyPacks->sum('prep_questions_count'),
                'departments' => count($departments),
                'branches' => $branchTotal,
            ],
            'adoption' => [
                'students' => $gate('students', User::where('role', User::ROLE_USER)->count()),
                'colleges' => $gate('colleges', College::where('is_active', true)->count()),
                'contests_held' => $gate('contests_held', Contest::query()
                    ->where('status', Contest::STATUS_PUBLISHED)
                    ->whereIn('contest_type', ContestLeaderboardService::COUNTED_TYPES)
                    ->where('end_at', '<', now())
                    ->count()),
                'solutions_judged' => $gate('solutions_judged', $judged),
                'vouchers_sent' => $gate('vouchers_sent', $sent),
            ],
        ];
    }

    /**
     * Roles with at least one open stack, the open stacks themselves, and the questions inside them — read from the same catalogue the
     * student's Vault AI Interview page lists, so "Coming soon" stacks are never counted as something a student can sit.
     *
     * @return array{0: int, 1: int, 2: int} domains, stacks, questions
     */
    private function interviewCatalogue(): array
    {
        $live = $this->vault->liveMap();
        $domains = 0;
        $questions = 0;

        foreach ($this->vault->roles() as $role) {
            $open = false;

            foreach ($role['stacks'] as $key => $stack) {
                if (! ($live[(string) $key] ?? false)) {
                    continue;
                }

                $open = true;

                foreach ($this->vault->allSets($stack) as $set) {
                    $questions += count($set['questions'] ?? []);
                }
            }

            $domains += $open ? 1 : 0;
        }

        return [$domains, count(array_filter($live)), $questions];
    }

    // ------------------------------------------------------------------ catalogue

    private function companyQuery()
    {
        return Company::query()
            ->where('is_active', true)
            ->whereHas('prepQuestions')
            ->withCount('prepQuestions')
            ->orderByDesc('prep_questions_count')
            ->orderBy('name');
    }

    /** Companies that have a prep pack on AptRun. A prep pack is a fact about our content, not a claim that the company is a customer. */
    private function companies(): array
    {
        return $this->companyQuery()
            ->limit(max(1, (int) config('landing.companies_shown', 12)))
            ->get()
            ->map(fn (Company $c) => [
                'name' => $c->name,
                'slug' => $c->slug,
                'industry' => $c->industry,
                'questions' => (int) $c->prep_questions_count,
            ])
            ->values()
            ->all();
    }

    /** The departments the platform serves, each with how many disciplines it holds. */
    private function departments(): array
    {
        return array_map(fn (array $d) => [
            'code' => $d['code'],
            'name' => $d['name'],
            'short' => $d['short'],
            'description' => $d['description'],
            'accent' => $d['accent'],
            'icon' => $d['icon'],
            'disciplines' => count($this->branches->disciplines($d['code'])),
        ], $this->branches->departments());
    }

    // ------------------------------------------------------------------ live

    /**
     * The next AptRun Daily Challenge: the real edition on the calendar when there is one (it is created when the previous one closes),
     * otherwise the slot it is going to take, so the page always has a "tonight" to count down to.
     */
    private function contest(): array
    {
        $edition = Contest::query()
            ->where('contest_type', Contest::CONTEST_TYPE_DAILY)
            ->where('status', Contest::STATUS_PUBLISHED)
            ->where('end_at', '>', now())
            ->orderBy('start_at')
            ->first();

        if ($edition === null) {
            $start = $this->daily->nextStartAt();
            $end = $start->copy()->addMinutes($this->daily->durationMinutes());

            return [
                'title' => $this->daily->titleFor($start),
                'start_at' => $start->toIso8601String(),
                'ends_at' => $end->toIso8601String(),
                'is_live' => false,
                'registration' => null,
                'registered' => null,
            ];
        }

        $registered = ContestParticipant::where('contest_id', $edition->id)->count();

        return [
            'title' => $this->daily->displayTitle($edition),
            'start_at' => $edition->start_at->toIso8601String(),
            'ends_at' => $edition->end_at->toIso8601String(),
            'is_live' => $edition->hasStarted() && ! $edition->hasEnded(),
            'registration' => $this->daily->registrationState($edition),
            'registered' => $registered >= (int) config('landing.floors.registered_tonight', 25) ? $registered : null,
        ];
    }

    /**
     * This week's vouchers (the ones the superadmin has put live), when the board resets, and the whole shelf the superadmin chooses
     * from. `live` is false in a week with nothing on offer — the page then shows the shelf and says the lineup is announced weekly.
     */
    private function weeklyRewards(): array
    {
        $week = $this->board->week();
        $prizes = $this->rewards->prizes($week);

        $participants = $prizes->isEmpty() ? 0 : $this->board->standings(ContestLeaderboardService::PERIOD_WEEKLY, null, $week)->count();

        // Next week, when the superadmin has already chosen it: the page can say what is coming, not only what is on.
        $nextWeek = $this->board->week($week['end']->copy()->addHour());
        $nextPrizes = $this->rewards->prizes($nextWeek);
        $prizePayload = fn (array $p) => ['rank' => $p['rank'], 'brand' => $p['brand'], 'amount' => $p['amount'], 'logo' => $p['logo'], 'color' => $p['color'], 'tagline' => $p['tagline']];

        return [
            'live' => $prizes->isNotEmpty(),
            'next' => $nextPrizes->isEmpty() ? null : [
                'week' => ['key' => $nextWeek['key'], 'starts_at' => $nextWeek['start']->toIso8601String(), 'resets_at' => $nextWeek['end']->toIso8601String()],
                'prizes' => $nextPrizes->map($prizePayload)->values()->all(),
            ],
            'week' => ['key' => $week['key'], 'starts_at' => $week['start']->toIso8601String(), 'resets_at' => $week['end']->toIso8601String()],
            'prizes' => $prizes->map($prizePayload)->values()->all(),
            'participants' => $participants >= (int) config('landing.floors.weekly_participants', 25) ? $participants : null,
            'shelf' => collect($this->rewards->cards())->map(fn (array $c, string $key) => [
                'key' => $key, 'brand' => (string) $c['brand'], 'logo' => (string) $c['logo'], 'color' => (string) $c['color'],
            ])->values()->all(),
        ];
    }

    /** Builds one block; a failure is logged and the block is dropped, never the page. */
    private function safely(string $block, callable $build): mixed
    {
        try {
            return $build();
        } catch (\Throwable $e) {
            Log::warning("Landing data: the {$block} block could not be built.", ['error' => $e->getMessage()]);

            return null;
        }
    }
}
