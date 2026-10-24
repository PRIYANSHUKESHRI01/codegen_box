<?php

namespace App\Services;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Support\DepartmentCapabilities;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * "Practice interview": a student builds their own AI mock interview — a branch role, a kind of round, a difficulty and a
 * length — and takes it through the same voice flow, proctoring hooks and AI scoring as every other interview.
 *
 * What it makes is an ordinary Interview row (type `practice`, `is_mock`, created_by = the student) whose questions are picked
 * from the permanent InterviewQuestionBank. The pick favours questions that match the role's tags and that the student has not
 * answered before, orders the interview like a real one (technical warm-up to hard, then a scenario, then project and HR), and,
 * when the bank is short for that role, asks the AI generator to top it up (best effort, capped per student per day, and the
 * result is kept in the bank for everyone). Nothing here is shown to staff: practice interviews are private to their creator.
 *
 * Plan limits are the same rule the start endpoint uses (PlanGate::assertMockInterviewAllowed) — checked at creation so a student
 * who has no practice left finds out before spending an AI call.
 */
class PracticeInterviewService
{
    /** Easy first: a real interview warms up. */
    private const DIFFICULTY_ORDER = ['easy' => 0, 'medium' => 1, 'hard' => 2];

    /** The order categories are asked in. */
    private const CATEGORY_ORDER = ['technical' => 0, 'aptitude' => 1, 'situational' => 2, 'behavioral' => 3, 'hr' => 4];

    public function __construct(
        private readonly GeminiQuestionGeneratorService $generator,
        private readonly PlanGate $gate,
    ) {}

    // ───────────────────────────── what the studio shows ─────────────────────────────

    /**
     * @return array<string, mixed>
     */
    public function options(User $user): array
    {
        $family = $this->family($user);
        $bank = $this->bankIndex();

        $groups = [];
        foreach ($this->groupKeysFor($user) as $key) {
            $group = config("practice_interviews.groups.{$key}");
            $discipline = $key === 'software' ? null : $key;
            $mine = (array) ($user->core_interests ?? []);

            $groups[] = [
                'key' => $key,
                'label' => $group['label'],
                'is_your_branch' => $key === $family,
                'roles' => array_map(function (array $role) use ($bank, $discipline, $mine) {
                    $pool = $this->technicalPool($bank, $discipline, $role['tags']);

                    return [
                        'key' => $role['key'], 'title' => $role['title'], 'blurb' => $role['blurb'],
                        'recommended' => $role['interests'] !== [] && array_intersect($role['interests'], $mine) !== [],
                        // "Ready" = the bank alone can fill a typical round for this role; otherwise the AI tops it up.
                        'questions_available' => $pool->count(),
                    ];
                }, $group['roles']),
            ];
        }

        $defaultRole = collect($groups)->flatMap(fn ($g) => $g['roles'])->firstWhere('recommended', true)
            ?? ($groups[0]['roles'][0] ?? null);

        return [
            'groups' => $groups,
            'kinds' => collect(config('practice_interviews.kinds'))->map(fn ($k, $key) => ['key' => $key, 'label' => $k['label'], 'blurb' => $k['blurb']])->values()->all(),
            'counts' => config('practice_interviews.counts'),
            'difficulties' => ['mixed', 'easy', 'medium', 'hard'],
            'limits' => ['created_today' => $this->createdToday($user), 'per_day' => (int) config('practice_interviews.limits.created_per_day')],
            'defaults' => ['role' => $defaultRole['key'] ?? null, 'kind' => 'technical', 'count' => 8, 'difficulty' => 'mixed'],
        ];
    }

    // ───────────────────────────── building one ─────────────────────────────

    /**
     * @param  array{role: string, kind: string, count: int, difficulty: string}  $input
     *
     * @throws ValidationException when the pick is invalid or the bank cannot fill it
     */
    public function create(User $user, array $input): Interview
    {
        $found = $this->findRole($user, $input['role']);
        $kind = config("practice_interviews.kinds.{$input['kind']}");
        $count = (int) $input['count'];
        $difficulty = $input['difficulty'];

        if ($found === null) {
            throw ValidationException::withMessages(['role' => ['Choose one of the roles on offer.']]);
        }
        if ($kind === null) {
            throw ValidationException::withMessages(['kind' => ['Choose a kind of round.']]);
        }
        if (! in_array($count, config('practice_interviews.counts'), true)) {
            throw ValidationException::withMessages(['count' => ['Choose how many questions.']]);
        }
        if (! in_array($difficulty, ['mixed', 'easy', 'medium', 'hard'], true)) {
            throw ValidationException::withMessages(['difficulty' => ['Choose a difficulty.']]);
        }

        // Plan first (free try / daily limit), then the creation cap — both before any AI call is spent.
        $this->gate->assertMockInterviewAllowed($user);
        abort_if($this->createdToday($user) >= (int) config('practice_interviews.limits.created_per_day'), 429, "You've built a lot of practice interviews today — take one of them, then build another tomorrow.");

        [$discipline, $role] = $found;

        $picked = $this->pickQuestions($user, $discipline, $role, $kind['mix'], $count, $difficulty);

        if ($picked['questions']->count() < (int) config('practice_interviews.min_questions')) {
            throw ValidationException::withMessages(['role' => ['We are still building the question bank for this role — try another role, or a different kind of round, for now.']]);
        }

        return DB::transaction(function () use ($user, $discipline, $role, $input, $kind, $count, $difficulty, $picked) {
            $questions = $picked['questions'];
            $title = "{$role['title']} — {$kind['label']}";

            $interview = Interview::create([
                'title' => $title,
                'slug' => Interview::uniqueSlug($title.' '.Str::lower(Str::random(5))),
                'description' => "Your practice round: {$questions->count()} questions, ".($difficulty === 'mixed' ? 'a mix of difficulties' : "{$difficulty} level").'. Answer aloud; the AI scores each answer when you finish.',
                'status' => Interview::STATUS_PUBLISHED,
                'interview_type' => Interview::INTERVIEW_TYPE_PRACTICE,
                'is_mock' => true,
                'created_by' => $user->id,
                'audience_scope' => Interview::AUDIENCE_SCOPE_ALL,
                'discipline' => $discipline,
                'practice_config' => [
                    'role' => $role['key'], 'kind' => $input['kind'], 'difficulty' => $difficulty,
                    'requested' => $count, 'questions' => $questions->count(), 'ai_questions' => $picked['generated'],
                ],
            ]);

            foreach ($questions->values() as $order => $question) {
                InterviewQuestion::create(['interview_id' => $interview->id, 'interview_question_bank_id' => $question->id, 'display_order' => $order]);
            }

            return $interview;
        });
    }

    /** Practice interviews this student has built today (for the daily cap and the studio's "n of 8"). */
    public function createdToday(User $user): int
    {
        return Interview::query()->where('interview_type', Interview::INTERVIEW_TYPE_PRACTICE)->where('created_by', $user->id)->whereDate('created_at', today())->count();
    }

    // ───────────────────────────── picking the questions ─────────────────────────────

    /**
     * @param  array<string, int>  $mix  category => share
     * @return array{questions: Collection<int, InterviewQuestionBank>, generated: int}
     */
    private function pickQuestions(User $user, ?string $discipline, array $role, array $mix, int $count, string $difficulty): array
    {
        $seen = $this->seenQuestionIds($user);
        $want = $this->allocate($mix, $count);
        $generated = 0;

        $pickAll = function () use ($user, $discipline, $role, $want, $difficulty, $seen): Collection {
            $chosen = collect();

            foreach ($want as $category => $n) {
                $pool = $this->pool($discipline, $category, $difficulty)
                    ->reject(fn ($q) => $chosen->contains('id', $q->id))
                    ->map(fn ($q) => ['q' => $q, 'score' => $this->score($q, $role['tags'], $seen)])
                    ->sortByDesc(fn ($row) => $row['score'] + (mt_rand(0, 99) / 1000))
                    ->take($n)->pluck('q');

                $chosen = $chosen->concat($pool);
            }

            return $chosen;
        };

        $chosen = $pickAll();

        // Short for the role? Redistribute the shortfall to the technical pool first (the heart of any round)…
        if ($chosen->count() < $count) {
            $extra = $this->pool($discipline, 'technical', $difficulty)
                ->reject(fn ($q) => $chosen->contains('id', $q->id))
                ->map(fn ($q) => ['q' => $q, 'score' => $this->score($q, $role['tags'], $seen)])
                ->sortByDesc('score')->take($count - $chosen->count())->pluck('q');
            $chosen = $chosen->concat($extra);
        }

        // …then, if technical is what is missing, ask the AI to write the difference (best effort).
        $missing = $count - $chosen->count();
        if ($missing > 0 && ($want['technical'] ?? 0) > 0) {
            $generated = $this->topUp($user, $discipline, $role, $difficulty, min($missing, 5));
            if ($generated > 0) {
                $chosen = $pickAll();
                if ($chosen->count() < $count) {
                    $chosen = $chosen->concat($this->pool($discipline, 'technical', $difficulty)->reject(fn ($q) => $chosen->contains('id', $q->id))->take($count - $chosen->count()));
                }
            }
        }

        $ordered = $chosen->take($count)->sortBy([
            fn ($a, $b) => (self::CATEGORY_ORDER[$a->category] ?? 9) <=> (self::CATEGORY_ORDER[$b->category] ?? 9),
            fn ($a, $b) => (self::DIFFICULTY_ORDER[$a->difficulty] ?? 1) <=> (self::DIFFICULTY_ORDER[$b->difficulty] ?? 1),
        ])->values();

        return ['questions' => $ordered, 'generated' => $generated];
    }

    /** Largest-remainder split of $count across the mix. @return array<string, int> */
    private function allocate(array $mix, int $count): array
    {
        $total = array_sum($mix);
        $exact = collect($mix)->map(fn ($share) => $share / $total * $count);
        $base = $exact->map(fn ($v) => (int) floor($v));
        $remainders = $exact->map(fn ($v, $k) => $v - $base[$k])->sortDesc();

        foreach ($remainders->keys() as $key) {
            if ($base->sum() >= $count) {
                break;
            }
            $base[$key] = $base[$key] + 1;
        }

        return $base->filter(fn ($n) => $n > 0)->all();
    }

    /**
     * Active questions for a category: the branch's own, plus — for the people/scenario categories — the general ones every
     * branch shares. Technical questions are never mixed across branches (an ECE round never gets a software question).
     *
     * @return Collection<int, InterviewQuestionBank>
     */
    private function pool(?string $discipline, string $category, string $difficulty): Collection
    {
        $query = InterviewQuestionBank::query()->where('is_active', true)->where('category', $category);

        if ($category === 'technical') {
            $discipline === null ? $query->whereNull('discipline') : $query->where('discipline', $discipline);
        } else {
            $query->where(fn ($q) => $q->whereNull('discipline')->when($discipline !== null, fn ($q2) => $q2->orWhere('discipline', $discipline)));
        }

        $all = $query->get();

        if ($difficulty === 'mixed') {
            return $all;
        }

        $exact = $all->where('difficulty', $difficulty);

        // Not enough at exactly that level: widen to the neighbours rather than build a thin round.
        return $exact->count() >= 3 ? $exact : $all;
    }

    /** Higher = better pick: matches the role's tags (+3), never answered before by this student (+2), has reviewer notes (+1). */
    private function score(InterviewQuestionBank $q, array $roleTags, array $seen): int
    {
        $tags = (array) $q->tags;
        $score = 0;

        if ($roleTags !== [] && array_intersect($roleTags, $tags) !== []) {
            $score += 3;
        }
        if (! in_array($q->id, $seen, true)) {
            $score += 2;
        }
        if (! empty($q->notes_for_reviewer)) {
            $score += 1;
        }

        return $score;
    }

    /** @return list<int> */
    private function seenQuestionIds(User $user): array
    {
        return DB::table('interview_responses as r')
            ->join('interview_sessions as s', 's.id', '=', 'r.interview_session_id')
            ->join('interview_questions as q', 'q.id', '=', 'r.interview_question_id')
            ->where('s.user_id', $user->id)
            ->pluck('q.interview_question_bank_id')->unique()->map(fn ($id) => (int) $id)->all();
    }

    /**
     * Writes technical questions with the AI generator when the bank is short, and keeps them in the bank (tagged so staff can
     * review them). Capped per student per day; any failure just means "no top-up".
     */
    private function topUp(User $user, ?string $discipline, array $role, string $difficulty, int $need): int
    {
        $cap = (int) config('practice_interviews.limits.ai_top_up_per_day');
        $today = InterviewQuestionBank::query()->where('created_by', $user->id)->whereDate('created_at', today())->whereJsonContains('tags', 'ai-generated')->count();

        if ($need < 1 || $today >= $cap * 5) {
            return 0;
        }

        try {
            $items = $this->generator->generate(
                $role['title'],
                $difficulty === 'mixed' ? 'medium' : $difficulty,
                ['technical'],
                $need,
                implode(', ', $role['tags'] ?? []) ?: null,
                InterviewQuestionBank::where('category', 'technical')->latest('id')->limit(30)->pluck('question_text')->all(),
                $discipline,
            );
        } catch (RuntimeException $e) {
            Log::info('[practice-interview] AI top-up unavailable: '.$e->getMessage());

            return 0;
        }

        $made = 0;
        foreach ($items as $item) {
            InterviewQuestionBank::create([
                ...$item,
                'tags' => array_values(array_unique([...(array) ($item['tags'] ?? []), ...($role['tags'] ?? []), 'ai-generated'])),
                'discipline' => $discipline,
                'is_active' => true,
                'created_by' => $user->id,
            ]);
            $made++;
        }

        return $made;
    }

    // ───────────────────────────── helpers ─────────────────────────────

    private function family(User $user): ?string
    {
        return CoreAccess::isFamily($user->discipline) && $user->hasDomainPrepFamily() ? $user->discipline : null;
    }

    /**
     * The role groups this student is offered, in the order that suits them: their branch first (unless they said "IT roles
     * first"), and the software roles for everyone — a core student can still interview for an IT job.
     *
     * @return list<string>
     */
    private function groupKeysFor(User $user): array
    {
        $family = $this->family($user);

        if ($family === null) {
            return ['software'];
        }

        // A programme without coding practice (Management, Commerce, Arts …) is offered its own roles only: IT-company roles would
        // be a path they have not asked for. They can still reach them by opting in to coding in Settings.
        if (! (DepartmentCapabilities::forUser($user)['coding_practice'] ?? true)) {
            return [$family];
        }

        return $user->track_focus === 'it_first' ? ['software', $family] : [$family, 'software'];
    }

    /** @return array{0: ?string, 1: array}|null  [discipline of the pool, the role card] */
    private function findRole(User $user, string $key): ?array
    {
        foreach ($this->groupKeysFor($user) as $groupKey) {
            foreach (config("practice_interviews.groups.{$groupKey}.roles") as $role) {
                if ($role['key'] === $key) {
                    return [$groupKey === 'software' ? null : $groupKey, $role];
                }
            }
        }

        return null;
    }

    /** One light query for the studio: just enough of each active question to count what a role can draw on. @return Collection<int, InterviewQuestionBank> */
    private function bankIndex(): Collection
    {
        return InterviewQuestionBank::query()->where('is_active', true)->where('category', 'technical')->get(['id', 'discipline', 'tags']);
    }

    /** @return Collection<int, InterviewQuestionBank> */
    private function technicalPool(Collection $bank, ?string $discipline, array $tags): Collection
    {
        return $bank->filter(function ($q) use ($discipline, $tags) {
            if ($q->discipline !== $discipline) {
                return false;
            }

            return $tags === [] || array_intersect($tags, (array) $q->tags) !== [];
        });
    }
}
