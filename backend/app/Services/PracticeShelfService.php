<?php

namespace App\Services;

use App\Models\InterviewSession;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillSession;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Support\DepartmentCapabilities;

/**
 * "Today's practice": the handful of things a student is offered to practise next, decided from their branch, what they said they
 * want to practise (their focus areas), what they left half-done, and how their drills are going. The server decides WHAT to
 * offer and in what order; the page decides how it looks. Nothing here is a score — it never changes a readiness number.
 *
 * The shelf exists so that a student who leads with their branch still meets the modules every branch shares — AI interviews,
 * soft skills, communication — in a form that is about their branch, and so that "what should I practise?" always has an answer.
 */
class PracticeShelfService
{
    /** Default order when the student has not said what they want to practise. */
    private const DEFAULT_ORDER = ['interview', 'drills', 'soft_skills', 'communication'];

    /** Which card each focus area a student can tick belongs to (areas with no card here are served elsewhere on the home). */
    private const FOCUS_TO_CARD = [
        'mock_interviews' => 'interview',
        'soft_skills' => 'soft_skills',
        'communication' => 'communication',
        'core_subjects' => 'drills',
    ];

    public function __construct(
        private readonly PracticeInterviewService $interviews,
        private readonly DrillService $drills,
        private readonly CoreAccess $coreAccess,
    ) {}

    /**
     * @return array{cards: list<array<string, mixed>>, streak: array<string, mixed>}
     */
    public function forStudent(User $user): array
    {
        $summary = $this->drills->summary($user);
        $caps = DepartmentCapabilities::forUser($user);

        $cards = [
            'interview' => $this->interviewCard($user),
            'drills' => $this->drillCard($user, $summary),
            'soft_skills' => $this->softSkillsCard($user),
            'communication' => ['id' => 'communication', 'kind' => 'communication'],
        ];

        $order = self::DEFAULT_ORDER;
        $focusToCard = self::FOCUS_TO_CARD;

        // Skill Drills are generated fundamentals practice (logic, circuits, quick calculations) built around an engineering programme.
        // A student whose programme has no coding at all (Management, Commerce, Arts …) gets the card for their own field's Domain
        // Prep (Management Prep, Commerce Prep, Subject Prep …) where drills would have been.
        if (! ($caps['coding_practice'] ?? true)) {
            unset($cards['drills']);
            $order = array_values(array_diff($order, ['drills']));
            $focusToCard['core_subjects'] = 'domain';

            // Only once it exists for them (their college is a pilot, or it is live, and there is material) — a card that leads to
            // "isn't open yet" is worse than no card.
            if (($caps['domain_prep'] ?? false) && $this->coreAccess->available($user)) {
                $cards['domain'] = [
                    'id' => 'domain', 'kind' => 'domain',
                    'label' => DepartmentCapabilities::domainPrepLabel($user->department),
                ];
                array_splice($order, 1, 0, ['domain']);
            }
        }

        // What they said they want comes first, in the order they ticked it; the rest follow in the default order.
        $pinned = collect((array) $user->focus_areas)->map(fn ($f) => $focusToCard[$f] ?? null)->filter(fn ($c) => $c !== null && isset($cards[$c]))->unique()->values()->all();
        $order = array_values(array_unique([...$pinned, ...$order]));

        // Something left half-done always leads: finishing beats starting.
        if (($cards['interview']['resume'] ?? false) === true) {
            $order = array_values(array_unique(['interview', ...$order]));
        }

        return [
            'cards' => array_map(fn (string $id) => $cards[$id] + ['pinned' => in_array($id, $pinned, true)], $order),
            'streak' => $summary['streak'],
        ];
    }

    // ───────────────────────────── the cards ─────────────────────────────

    /** @return array<string, mixed> */
    private function interviewCard(User $user): array
    {
        $open = InterviewSession::query()->where('user_id', $user->id)->where('status', InterviewSession::STATUS_IN_PROGRESS)
            ->whereHas('interview', fn ($q) => $q->whereNull('interview_track_id')->where('status', 'published'))
            ->with('interview:id,title,slug')->latest('id')->first();

        if ($open !== null) {
            return ['id' => 'interview', 'kind' => 'interview', 'resume' => true, 'title' => $open->interview->title, 'slug' => $open->interview->slug];
        }

        $options = $this->interviews->options($user);
        $role = collect($options['groups'])->flatMap(fn ($g) => $g['roles'])->firstWhere('key', $options['defaults']['role']);

        return [
            'id' => 'interview', 'kind' => 'interview', 'resume' => false,
            'role' => $role['key'] ?? null, 'role_title' => $role['title'] ?? null, 'recommended' => (bool) ($role['recommended'] ?? false),
            'for_branch' => CoreAccess::isFamily($user->discipline),
        ];
    }

    /**
     * The skill worth practising next: the weakest one they have tried enough to judge, else the first they have not tried, else
     * the one they practised longest ago. Always from the pack built for their branch.
     *
     * @param  array<string, mixed>  $summary
     * @return array<string, mixed>
     */
    private function drillCard(User $user, array $summary): array
    {
        $pack = $this->packFor($user);
        $skills = config("drills.packs.{$pack}.skills");
        $stats = $summary['skills'];

        $weak = collect($skills)->filter(fn ($s) => isset($stats[$s]) && count($stats[$s]['recent']) >= 3)
            ->map(fn ($s) => ['skill' => $s, 'acc' => collect($stats[$s]['recent'])->avg(fn ($r) => $r[0])])
            ->filter(fn ($row) => $row['acc'] < 0.75)->sortBy('acc')->first();

        if ($weak !== null) {
            $skill = $weak['skill'];
            $reason = 'weak';
        } elseif (($fresh = collect($skills)->first(fn ($s) => ! isset($stats[$s]))) !== null) {
            $skill = $fresh;
            $reason = isset($stats) && count($stats) === 0 ? 'start' : 'new';
        } else {
            $skill = collect($skills)->sortBy(fn ($s) => $stats[$s]['last_at'] ?? '')->first();
            $reason = 'refresh';
        }

        return ['id' => 'drills', 'kind' => 'drills', 'pack' => $pack, 'skill' => $skill, 'reason' => $reason, 'attempts_today' => $summary['streak']['today'], 'streak' => $summary['streak']['current']];
    }

    /** @return array<string, mixed> */
    private function softSkillsCard(User $user): array
    {
        $library = SoftSkillAssessment::questionSets()->where('status', SoftSkillAssessment::STATUS_PUBLISHED);
        $sessions = SoftSkillSession::query()->where('user_id', $user->id);

        return [
            'id' => 'soft_skills', 'kind' => 'soft_skills',
            'sets_total' => (clone $library)->count(),
            'sets_completed' => (clone $library)->whereHas('sessions', fn ($q) => $q->where('user_id', $user->id)->where('status', SoftSkillSession::STATUS_COMPLETED))->count(),
            'in_progress' => (clone $sessions)->where('status', SoftSkillSession::STATUS_IN_PROGRESS)->exists(),
        ];
    }

    /** The pack built for the student's branch family; the digital pack for everyone else. */
    private function packFor(User $user): string
    {
        foreach (config('drills.packs') as $pack => $def) {
            if (in_array($user->discipline, $def['audience'], true) && $pack !== 'digital') {
                return $pack;
            }
        }

        return 'digital';
    }
}
