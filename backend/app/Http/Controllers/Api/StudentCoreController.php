<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CorePracticeAnswer;
use App\Models\CoreQuestion;
use App\Models\CoreQuestionReport;
use App\Models\CoreTest;
use App\Models\CoreTestResponse;
use App\Models\CoreTestSession;
use App\Models\StudySitting;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreMasteryService;
use App\Services\Core\CorePracticeService;
use App\Services\Core\CoreTestService;
use App\Services\PlanGate;
use App\Services\StudySittingService;
use App\Models\User;
use App\Support\BranchCatalog;
use App\Support\DepartmentCapabilities;
use App\Support\StudentPreferences;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Core Prep for students of ECE / EEE / Mechanical / Civil: practice by topic, timed proctored tests, and
 * the home that says how they are doing.
 *
 * Every endpoint first asks CoreAccess: until staff have switched the branch live AND there is published
 * material, Core Prep does not exist for the student (404) — never an empty module. Plans (the free plan's daily
 * limit and its one test try) are PlanGate's concern and answer 402.
 */
class StudentCoreController extends Controller
{
    public function __construct(
        private readonly CoreAccess $access,
        private readonly CoreMasteryService $mastery,
        private readonly CorePracticeService $practice,
        private readonly CoreTestService $tests,
        private readonly PlanGate $gate,
        private readonly StudySittingService $sittings,
    ) {}

    /** The Core Prep home: access, plan usage, mastery per subject, weakest topics, tests and recent results. */
    public function home(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        $state = $this->access->state($user);

        // Not available is a normal answer, not an error: the dashboard asks and simply shows nothing.
        if (! $state['available']) {
            return response()->json(['available' => false, 'family' => $state['family'], 'live' => $state['live'], 'discipline' => $this->disciplineLabel($user->discipline), 'department' => $this->departmentLabel($user)]);
        }

        $entitlements = $user->effectiveEntitlements();
        $overview = $this->mastery->overview($user->id, $user->discipline, $user->branch_code, true);

        $sessions = CoreTestSession::query()->where('user_id', $user->id)->with('test:id,title,slug')->latest('id')->limit(40)->get();
        $inProgress = $sessions->firstWhere('status', CoreTestSession::STATUS_IN_PROGRESS);
        $recent = $sessions->where('status', CoreTestSession::STATUS_COMPLETED)->take(5)->values();

        return response()->json([
            'available' => true,
            'live' => $state['live'],
            'pilot' => $state['pilot'],
            'discipline' => $this->disciplineLabel($user->discipline),
            // Domain Prep is called different things in different departments (Core Prep, Management Prep, Commerce Prep, Subject Prep).
            'department' => $this->departmentLabel($user),
            'branch' => ($b = BranchCatalog::instance()->branch($user->branch_code)) ? ['code' => $b['code'], 'name' => $b['name'], 'short' => $b['short']] : null,
            'track_focus' => $user->track_focus,
            'plan' => [
                'practice_limit' => $entitlements['max_core_practice_per_day'],
                'practice_used_today' => $this->gate->corePracticeUsedToday($user),
                'tests_access' => (bool) $entitlements['core_tests_access'],
                'free_test_tries' => $entitlements['core_tests_access'] ? null : $entitlements['feature_trial_uses'],
                'free_test_tries_used' => $entitlements['core_tests_access'] ? null : CoreTestSession::where('user_id', $user->id)->count(),
            ],
            'summary' => $overview['summary'] + [
                'tests_taken' => $sessions->where('status', CoreTestSession::STATUS_COMPLETED)->count(),
                'avg_test_percent' => ($done = $sessions->where('status', CoreTestSession::STATUS_COMPLETED))->isEmpty() ? null : round($done->avg('score_percent')),
            ],
            'week' => $this->weekProgress($user),
            'subjects' => $overview['subjects'],
            'weakest_topics' => $overview['weakest_topics'],
            'tests_available' => $this->tests->visibleTo($user)->count(),
            'in_progress' => $inProgress ? ['session' => $inProgress->public_id, 'test' => $inProgress->test?->title, 'deadline_at' => $inProgress->deadline_at] : null,
            'recent_results' => $recent->map(fn (CoreTestSession $s) => [
                'session' => $s->public_id, 'test' => $s->test?->title, 'score_percent' => $s->score_percent, 'passed' => $s->passed, 'completed_at' => $s->completed_at,
            ]),
        ]);
    }

    // ───────────────────────────────── practice ─────────────────────────────────

    public function practiceNext(Request $request): JsonResponse
    {
        $user = $this->student($request);

        $validated = $request->validate([
            'mode' => ['nullable', Rule::in(['new', 'weak', 'review'])],
            'subject_id' => ['nullable', 'integer'],
            'topic_id' => ['nullable', 'integer'],
            'difficulty' => ['nullable', Rule::in(CoreQuestion::DIFFICULTIES)],
            'exclude' => ['nullable', 'integer'],
            'sitting_id' => ['nullable', 'integer'],
        ]);

        // Practice questions are handed out only inside a proctored sitting (camera, fullscreen, strikes) — see StudySittingService.
        $this->sittings->requireUsable($user, $validated['sitting_id'] ?? null, StudySitting::KIND_CORE_PRACTICE);

        $question = $this->practice->next($user, $validated);

        return response()->json([
            'question' => $question ? $this->practice->present($question) : null,
            'practice_used_today' => $this->gate->corePracticeUsedToday($user),
            'practice_limit' => $user->effectiveEntitlements()['max_core_practice_per_day'],
        ]);
    }

    public function practiceAnswer(Request $request, CoreQuestion $coreQuestion): JsonResponse
    {
        $user = $this->student($request);

        $validated = $request->validate([
            'selected' => ['nullable', 'array', 'max:6'],
            'selected.*' => ['string', 'max:2'],
            'numeric_value' => ['nullable', 'numeric'],
            'time_taken' => ['nullable', 'integer', 'min:0'],
            'sitting_id' => ['nullable', 'integer'],
        ]);

        $sitting = $this->sittings->requireUsable($user, $validated['sitting_id'] ?? null, StudySitting::KIND_CORE_PRACTICE);

        $result = $this->practice->answer($user, $coreQuestion, $validated['selected'] ?? null, $validated['numeric_value'] ?? null, $validated['time_taken'] ?? null, $sitting?->id);

        return response()->json($result + [
            'practice_used_today' => $this->gate->corePracticeUsedToday($user),
            'practice_limit' => $user->effectiveEntitlements()['max_core_practice_per_day'],
        ]);
    }

    /** "This question looks wrong." Only a question the student has actually seen (answered in practice or in a test). */
    public function report(Request $request, CoreQuestion $coreQuestion): JsonResponse
    {
        $user = $this->student($request);

        $validated = $request->validate([
            'reason' => ['required', Rule::in(CoreQuestionReport::REASONS)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $seen = CorePracticeAnswer::where('user_id', $user->id)->where('core_question_id', $coreQuestion->id)->exists()
            || CoreTestResponse::where('core_question_id', $coreQuestion->id)->whereHas('session', fn ($q) => $q->where('user_id', $user->id)->where('status', CoreTestSession::STATUS_COMPLETED))->exists();
        abort_unless($seen, 404);

        // One open report per student per question — sending it again updates it instead of piling up.
        $report = CoreQuestionReport::query()->firstOrNew(['core_question_id' => $coreQuestion->id, 'user_id' => $user->id, 'status' => CoreQuestionReport::STATUS_OPEN]);
        $report->fill(['reason' => $validated['reason'], 'note' => $validated['note'] ?? null])->save();

        return response()->json(['reported' => true], 201);
    }

    // ───────────────────────────────── tests ─────────────────────────────────

    public function tests(Request $request): JsonResponse
    {
        $user = $this->student($request);
        $tests = $this->tests->visibleTo($user);

        $sessions = CoreTestSession::where('user_id', $user->id)->whereIn('core_test_id', $tests->pluck('id'))->get()->groupBy('core_test_id');
        $marks = CoreTest::query()->whereIn('core_tests.id', $tests->pluck('id'))
            ->join('core_test_questions', 'core_test_questions.core_test_id', '=', 'core_tests.id')
            ->join('core_questions', 'core_questions.id', '=', 'core_test_questions.core_question_id')
            ->selectRaw('core_tests.id as id, sum(core_questions.marks) as total')->groupBy('core_tests.id')->pluck('total', 'id');

        return response()->json(['proctoring_required' => (bool) config('proctoring.core_tests_enabled', true), 'tests' => $tests->map(function (CoreTest $t) use ($sessions, $marks) {
            $mine = $sessions[$t->id] ?? collect();
            $done = $mine->where('status', CoreTestSession::STATUS_COMPLETED);
            $open = $mine->firstWhere('status', CoreTestSession::STATUS_IN_PROGRESS);

            return [
                'slug' => $t->slug, 'title' => $t->title, 'description' => $t->description, 'type' => $t->test_type,
                'duration_minutes' => $t->duration_minutes, 'pass_percentage' => $t->pass_percentage, 'question_count' => $t->test_questions_count,
                'total_marks' => round((float) ($marks[$t->id] ?? 0), 2),
                'available_from' => $t->available_from, 'available_until' => $t->available_until, 'open_now' => $t->isOpenNow(),
                'max_attempts' => $t->max_attempts, 'attempts_taken' => $mine->count(),
                'best_score_percent' => $done->isEmpty() ? null : $done->max('score_percent'),
                'in_progress_session' => $open?->public_id,
                'can_attempt' => $t->isOpenNow() && ($t->max_attempts === null || $mine->count() < $t->max_attempts || $open !== null),
                'last_session' => $done->sortByDesc('id')->first()?->public_id,
            ];
        })->values()]);
    }

    public function startTest(Request $request, CoreTest $test): JsonResponse
    {
        $user = $this->student($request);

        $session = $this->tests->start($user, $test);

        return response()->json(['session' => $this->tests->payload($session), 'proctoring_required' => (bool) config('proctoring.core_tests_enabled', true)], 201);
    }

    public function session(Request $request, CoreTestSession $session): JsonResponse
    {
        $this->student($request);
        $this->ownSession($request, $session);

        if ($session->status === CoreTestSession::STATUS_IN_PROGRESS && $session->isPastDeadline(withGrace: true)) {
            $session = app(\App\Services\Core\CoreTestGradingService::class)->finalize($session);
        }

        // A finished attempt has no questions to take any more — the client goes to the result.
        if ($session->isCompleted()) {
            return response()->json(['session' => ['id' => $session->public_id, 'status' => $session->status]]);
        }

        $payload = $this->tests->payload($session);
        $payload['proctoring'] = $session->proctoringSession ? [
            'status' => $session->proctoringSession->status,
            'violation_count' => $session->proctoringSession->violation_count,
            'max_violations' => (int) config('proctoring.max_violations_before_lock', 3),
        ] : null;

        return response()->json(['session' => $payload, 'proctoring_required' => (bool) config('proctoring.core_tests_enabled', true)]);
    }

    public function answer(Request $request, CoreTestSession $session, CoreQuestion $coreQuestion): JsonResponse
    {
        $this->student($request);
        $this->ownSession($request, $session);

        $validated = $request->validate([
            'selected' => ['nullable', 'array', 'max:6'],
            'selected.*' => ['string', 'max:2'],
            'numeric_value' => ['nullable', 'numeric'],
            'marked_for_review' => ['sometimes', 'boolean'],
            'time_spent' => ['nullable', 'integer', 'min:0'],
        ]);

        $response = $this->tests->saveAnswer($session, $coreQuestion, $validated);

        return response()->json(['saved' => true, 'answered' => $response->answered_at !== null, 'deadline_at' => $session->deadline_at]);
    }

    public function submit(Request $request, CoreTestSession $session): JsonResponse
    {
        $this->student($request);
        $this->ownSession($request, $session);

        $done = $this->tests->submit($session);

        return response()->json(['session' => ['id' => $done->public_id, 'status' => $done->status]]);
    }

    public function result(Request $request, CoreTestSession $session): JsonResponse
    {
        $this->student($request);
        $this->ownSession($request, $session);

        return response()->json(['result' => $this->tests->resultFor($session)]);
    }

    // ───────────────────────────────── helpers ─────────────────────────────────

    /** Student only, and only while Core Prep exists for them (404 otherwise). */
    private function student(Request $request): \App\Models\User
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);
        abort_unless($this->access->available($user), 404, 'Core Prep is not available for your branch yet.');

        return $user;
    }

    private function ownSession(Request $request, CoreTestSession $session): void
    {
        abort_unless($session->user_id === $request->user()->id, 404);
    }

    /**
     * This week's Core goals against the pace the student chose at onboarding — questions answered in practice and tests
     * finished (Monday to now). Two counts; the Core home shows them where the software home shows problems solved.
     *
     * @return array{questions: array{current: int, target: int}, tests: array{current: int, target: int}}
     */
    private function weekProgress(\App\Models\User $user): array
    {
        $weekStart = now()->startOfWeek();
        $targets = StudentPreferences::coreWeeklyTargets($user->weekly_pace);

        return [
            'questions' => [
                'current' => CorePracticeAnswer::where('user_id', $user->id)->where('created_at', '>=', $weekStart)->count(),
                'target' => $targets['questions'],
            ],
            'tests' => [
                'current' => CoreTestSession::where('user_id', $user->id)->where('status', CoreTestSession::STATUS_COMPLETED)->where('completed_at', '>=', $weekStart)->count(),
                'target' => $targets['tests'],
            ],
        ];
    }

    /** @return array{code: string, name: string}|null */
    /** @return array{code: string, name: string, domain_prep_label: string, domain_prep_blurb: string} */
    private function departmentLabel(User $user): array
    {
        $catalog = BranchCatalog::instance();
        $code = $user->department ?? $catalog->departmentOfDiscipline($user->discipline) ?? (string) config('departments.fallback', 'engineering');
        $department = $catalog->department($code);

        return [
            'code' => $code,
            'name' => $department['name'] ?? $code,
            'domain_prep_label' => DepartmentCapabilities::domainPrepLabel($code),
            'domain_prep_blurb' => (string) ($department['settings']['domain_prep_blurb'] ?? config('departments.defaults.domain_prep_blurb')),
        ];
    }

    private function disciplineLabel(?string $code): ?array
    {
        $discipline = BranchCatalog::instance()->discipline($code);

        return $discipline ? ['code' => $discipline['code'], 'name' => $discipline['name'], 'short' => $discipline['short']] : null;
    }
}
