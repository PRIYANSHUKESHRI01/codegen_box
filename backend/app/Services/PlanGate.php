<?php

namespace App\Services;

use App\Models\CorePracticeAnswer;
use App\Models\CoreTestSession;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\ListeningLesson;
use App\Models\Plan;
use App\Models\SpeakingAttempt;
use App\Models\SpeakingPrompt;
use App\Models\User;
use App\Models\VocabularyAttempt;

/**
 * The server-side authority on the plan-tier rules that are not a simple
 * daily counter: feature switches (Hack Arena, the Vault, Project Lab) and the free
 * plan's one-time trials. The daily limits (practice problems, mock
 * interviews, Learning Centre AI) stay where they always were, next to the
 * code they throttle; they, and everything here, read the plan that governs
 * the student through User::effectiveEntitlements() — their college's plan
 * first, their own individual plan as fallback.
 *
 * Everything throws PlanRequiredException (HTTP 402 + a stable `code`), so a
 * controller just calls the method and the frontend gets one refusal shape to
 * turn into one upgrade prompt. The UI hides and locks things too, but that is
 * a courtesy; a tampered client still lands here.
 *
 * Free trial ("practise every AI feature once"): a plan with
 * `feature_trial_uses` = N lets a student try EACH AI practice feature N times
 * in total, ever — not per day. The counts below are lifetime, taken from the
 * rows the features already write, so there is no separate counter to drift.
 * A plan with `feature_trial_uses` = null has no trial cap and is governed by
 * its daily limits instead.
 */
class PlanGate
{
    public const FEATURE_HACKATHONS = 'hackathons';

    public const FEATURE_VAULT = 'vault';

    public const FEATURE_PROJECT_LAB = 'project_lab';

    public const FEATURE_CORE_PRACTICE = 'core_practice';

    public const FEATURE_CORE_TESTS = 'core_tests';

    public const TRIAL_CORE_TEST = 'core_test';

    public const TRIAL_MOCK_INTERVIEW = 'mock_interview';

    public const TRIAL_SPEAKING_TAKE = 'speaking_take';

    public const TRIAL_SPEAKING_PROMPT = 'speaking_prompt';

    public const TRIAL_LISTENING_LESSON = 'listening_lesson';

    public const TRIAL_VOCABULARY_QUIZ = 'vocabulary_quiz';

    /** What each trial feature is called in the refusal a student reads. */
    private const TRIAL_LABELS = [
        self::TRIAL_MOCK_INTERVIEW => 'AI mock interview',
        self::TRIAL_SPEAKING_TAKE => 'Speaking Lab recording',
        self::TRIAL_SPEAKING_PROMPT => 'AI speaking passage',
        self::TRIAL_LISTENING_LESSON => 'AI listening lesson',
        self::TRIAL_VOCABULARY_QUIZ => 'AI vocabulary quiz',
        self::TRIAL_CORE_TEST => 'Core test',
    ];

    /** @throws PlanRequiredException */
    public function requireHackathonAccess(User $user): void
    {
        if (! $user->effectiveEntitlements()['hackathon_access']) {
            throw new PlanRequiredException(
                'Hack Arena is part of the Expert plan. Upgrade to compete for prizes and placement opportunities.',
                self::FEATURE_HACKATHONS,
            );
        }
    }

    /**
     * Joining the Vault — being listed to employers on Mellow Vault and to hiring partners — is an Expert
     * feature for individual students (and part of Grandmaster, the Mellow Academy tier) (a college's plan can include it for the students it covers). Earning
     * the readiness score that makes someone eligible is open to everyone; this guards only the listing.
     *
     * @throws PlanRequiredException
     */
    public function requireVaultAccess(User $user): void
    {
        if (! $user->effectiveEntitlements()['vault_access']) {
            throw new PlanRequiredException(
                'Getting hired through Mellow Vault is part of the Expert plan. Upgrade to be seen by employers.',
                self::FEATURE_VAULT,
            );
        }
    }

    /**
     * Timed Core tests (the branch technical papers) are a plan feature. A plan without `core_tests_access` — the
     * free one — still gets its one-time free try (feature_trial_uses), counted from the sessions already
     * written, so there is no separate counter to drift.
     *
     * @throws PlanRequiredException
     */
    public function requireCoreTestAccess(User $user): void
    {
        $entitlements = $user->effectiveEntitlements();

        if ($entitlements['core_tests_access']) {
            return;
        }

        $uses = $entitlements['feature_trial_uses'];

        if ($uses !== null && $this->used($user, self::TRIAL_CORE_TEST) < $uses) {
            return;
        }

        throw new PlanRequiredException(
            $uses !== null && $uses > 0
                ? "You've used your free Core test. Timed Core tests are part of the Expert plan — upgrade to take as many as you like."
                : 'Timed Core tests are part of the Expert plan. Upgrade to take them.',
            self::FEATURE_CORE_TESTS,
            $uses !== null && $uses > 0 ? PlanRequiredException::CODE_TRIAL_USED : PlanRequiredException::CODE_PLAN_REQUIRED,
        );
    }

    /**
     * Core practice questions answered per day, when the plan caps them (the free plan does).
     *
     * @throws PlanRequiredException
     */
    public function assertCorePracticeWithinLimit(User $user): void
    {
        $limit = $user->effectiveEntitlements()['max_core_practice_per_day'];

        if ($limit === null || $this->corePracticeUsedToday($user) < $limit) {
            return;
        }

        throw new PlanRequiredException(
            "You've answered today's {$limit} Core practice questions on the Coder plan. Upgrade to Expert for unlimited practice — or come back tomorrow.",
            self::FEATURE_CORE_PRACTICE,
        );
    }

    public function corePracticeUsedToday(User $user): int
    {
        return CorePracticeAnswer::where('user_id', $user->id)->where('created_at', '>=', today())->count();
    }

    /**
     * Refuses when the student's plan caps trials and this feature's tries are
     * spent. A no-op for every plan without a trial cap — so it is safe to call
     * unconditionally in front of an AI feature.
     *
     * @throws PlanRequiredException
     */
    public function assertTrialAvailable(User $user, string $feature): void
    {
        $uses = $user->effectiveEntitlements()['feature_trial_uses'];

        if ($uses === null || $this->used($user, $feature) < $uses) {
            return;
        }

        $label = self::TRIAL_LABELS[$feature];
        $tries = $uses === 1 ? 'free try' : "{$uses} free tries";

        throw new PlanRequiredException(
            "You've used your {$tries} of the {$label} on the Coder plan. Upgrade to Expert to keep practising.",
            $feature,
            PlanRequiredException::CODE_TRIAL_USED,
        );
    }

    /**
     * Whether this student may begin another practice (mock) interview: the free plan's one-time try, then the plan's
     * daily limit. Counts genuine practice attempts only — `is_mock` and tpo_mock interviews, never a Final Interview
     * track round. The one rule behind both "start an interview" and "create my own practice interview".
     *
     * @throws PlanRequiredException
     */
    public function assertMockInterviewAllowed(User $user): void
    {
        // The free plan's one-time try (a no-op for every plan without a trial cap).
        $this->assertTrialAvailable($user, self::TRIAL_MOCK_INTERVIEW);

        $limit = $user->effectiveEntitlements()['max_mock_interviews_per_day'];

        if ($limit === null) {
            return;
        }

        $startedToday = InterviewSession::where('user_id', $user->id)
            ->whereDate('started_at', today())
            ->whereHas('interview', fn ($q) => $q->usesMockAllowance())
            ->count();

        abort_if(
            $startedToday >= $limit,
            402,
            "You've reached today's mock interview limit ({$limit}) on your plan. Upgrade to practice more."
        );
    }

    /**
     * The free-trial picture for the "Your Plan" page and the in-app banners, or
     * null when the student's plan has no trial cap. `used` is per area as a
     * student thinks of it (Speaking Lab is one area however many of its AI
     * calls are counted).
     *
     * @return array{uses_per_feature: int, used: array{mock_interview: int, speaking: int, listening: int, vocabulary: int}}|null
     */
    public function trialSummary(User $user): ?array
    {
        $uses = $user->effectiveEntitlements()['feature_trial_uses'];

        if ($uses === null) {
            return null;
        }

        return [
            'uses_per_feature' => $uses,
            'used' => [
                'mock_interview' => $this->used($user, self::TRIAL_MOCK_INTERVIEW),
                'speaking' => $this->used($user, self::TRIAL_SPEAKING_TAKE),
                'listening' => $this->used($user, self::TRIAL_LISTENING_LESSON),
                'vocabulary' => $this->used($user, self::TRIAL_VOCABULARY_QUIZ),
            ],
        ];
    }

    /** Lifetime uses of one trial feature, from the rows the feature itself writes. */
    private function used(User $user, string $feature): int
    {
        return match ($feature) {
            // A practice interview only — never a Final Interview track round or a real company
            // interview (the same predicate InterviewController's daily limit uses).
            self::TRIAL_MOCK_INTERVIEW => InterviewSession::where('user_id', $user->id)
                ->whereHas('interview', fn ($q) => $q->usesMockAllowance())
                ->count(),
            // A take that failed to score gave the student nothing, so it does not spend the try.
            self::TRIAL_SPEAKING_TAKE => SpeakingAttempt::where('user_id', $user->id)->whereNull('scoring_failed_at')->count(),
            self::TRIAL_SPEAKING_PROMPT => SpeakingPrompt::where('user_id', $user->id)->where('source', SpeakingPrompt::SOURCE_AI)->count(),
            self::TRIAL_LISTENING_LESSON => ListeningLesson::where('user_id', $user->id)->where('source', ListeningLesson::SOURCE_AI)->count(),
            // Only the AI quiz costs a Gemini call; daily and deck sprints come from the word bank.
            self::TRIAL_VOCABULARY_QUIZ => VocabularyAttempt::where('user_id', $user->id)->where('kind', VocabularyAttempt::KIND_CUSTOM)->count(),
            // Every started attempt spends it — a Core test is proctored and timed, so a half-taken one is a try.
            self::TRIAL_CORE_TEST => CoreTestSession::where('user_id', $user->id)->count(),
        };
    }
}
