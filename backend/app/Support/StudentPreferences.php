<?php

namespace App\Support;

use App\Services\JudgeService;
use Illuminate\Validation\Rule;

/**
 * The one catalog of what a student can say about themselves in onboarding
 * and later in Settings — validation rules, the allowed values, and what each
 * weekly pace means in numbers. Kept in one class so the endpoints that save
 * preferences, the stats service that reads the pace, and the tests all agree
 * on the same list; the frontend mirrors the values in lib/studentPreferences.ts
 * (the API rejects anything outside this list, so a drifted frontend fails
 * loudly instead of saving junk).
 *
 * Languages are the judge's own ids (JudgeService::SUPPORTED_LANGUAGES), so a
 * stored preference can be handed straight to the code editor.
 */
final class StudentPreferences
{
    public const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];

    public const CAREER_GOALS = [
        'campus_placement',
        'product_company',
        'internship',
        'higher_studies',
        'competitive_programming',
        'skill_building',
        // Non-CS branches: a core-company offer, or GATE / PSU preparation.
        'core_company',
        'psu_gate',
        // Management, Commerce and Arts / Humanities programmes.
        'mba_admission',
        'professional_certs',
        'govt_exams',
        'academia',
        'entrepreneurship',
    ];

    /** What the student wants to spend their time on — each maps to a real area of the platform. */
    public const FOCUS_AREAS = [
        'problem_solving',
        'contests',
        'mock_interviews',
        'communication',
        'soft_skills',
        'projects',
        'core_subjects',
    ];

    /**
     * What a non-CS student wants to lead with (CSE students have no track — everything is software).
     *  core_first — branch technical prep leads; coding is optional ("I don't code yet" is a valid answer)
     *  balanced   — core and IT-company preparation side by side
     *  it_first   — aiming at IT-services / product roles; the software experience, same as CSE
     */
    public const TRACK_FOCUS = ['core_first', 'balanced', 'it_first'];

    /**
     * The areas a student can say they are drawn to, per branch family. Used to point interviews and
     * practice at what they care about; the frontend mirrors the labels in lib/studentPreferences.ts.
     */
    public const CORE_INTERESTS = [
        'ece' => ['vlsi', 'embedded', 'communication_rf', 'signal_processing', 'analog_design', 'iot'],
        'eee' => ['power_systems', 'power_electronics_ev', 'electrical_machines', 'control_systems', 'renewable_energy', 'electrical_design'],
        'mech' => ['design_cad', 'thermal', 'manufacturing', 'automotive_ev', 'robotics', 'quality_production'],
        'civil' => ['structural', 'geotechnical', 'transportation', 'construction_management', 'environmental', 'planning_surveying'],
    ];

    /** @return list<string> every interest id, whichever family it belongs to */
    public static function allCoreInterests(): array
    {
        return array_values(array_unique(array_merge(...array_values(self::CORE_INTERESTS))));
    }

    public const PACE_CASUAL = 'casual';

    public const PACE_STEADY = 'steady';

    public const PACE_INTENSE = 'intense';

    public const PACES = [self::PACE_CASUAL, self::PACE_STEADY, self::PACE_INTENSE];

    /** Used for anyone who hasn't chosen — the targets the dashboard has always shown. */
    public const DEFAULT_PACE = self::PACE_STEADY;

    /** How many languages a student may list as "also comfortable with" — more than this stops being a preference. */
    public const MAX_LANGUAGES = 6;

    /** A skipped wizard comes back after this many days, not on every page load. */
    public const SKIP_COOLDOWN_DAYS = 7;

    /**
     * Weekly goal targets per pace: problems solved and Hard problems solved.
     * Steady is the 20 / 5 the dashboard used before pace existed.
     *
     * @var array<string, array{solved: int, hard: int}>
     */
    private const PACE_TARGETS = [
        self::PACE_CASUAL => ['solved' => 10, 'hard' => 2],
        self::PACE_STEADY => ['solved' => 20, 'hard' => 5],
        self::PACE_INTENSE => ['solved' => 35, 'hard' => 10],
    ];

    /**
     * Whether a student has answered everything onboarding needs. A student who leads with core prep
     * ("I don't code yet") is complete without a programming language.
     */
    public static function isComplete(\App\Models\User $user): bool
    {
        // A student whose programme has no coding practice (Commerce, Arts, Management …) is never asked for a language.
        return ($user->primary_language !== null || $user->track_focus === 'core_first' || ! DepartmentCapabilities::forUser($user)['coding_practice'])
            && $user->skill_level !== null
            && $user->career_goal !== null;
    }

    /** @return array{solved: int, hard: int} */
    public static function weeklyTargets(?string $pace): array
    {
        return self::PACE_TARGETS[$pace] ?? self::PACE_TARGETS[self::DEFAULT_PACE];
    }

    /**
     * The weekly pace as Core Prep goals: practice questions answered and timed tests taken. A technical question takes
     * a third of the time a coding problem does, so the question target is three times the problems target; one test a
     * week, two for an intense pace.
     *
     * @return array{questions: int, tests: int}
     */
    public static function coreWeeklyTargets(?string $pace): array
    {
        $targets = self::weeklyTargets($pace);

        return ['questions' => $targets['solved'] * 3, 'tests' => $pace === self::PACE_INTENSE ? 2 : 1];
    }

    /**
     * Validation rules for every preference field. `$required` is true for the
     * onboarding wizard's own submit (the three answers it cannot do without)
     * and false for Settings, where any field can be edited on its own.
     *
     * @return array<string, array<int, mixed>>
     */
    public static function rules(bool $required, ?string $trackFocus = null, bool $codes = true): array
    {
        $presence = $required ? 'required' : 'sometimes';
        // "I don't code yet" (core_first) is a complete answer: the language is then optional. So is every answer of a student whose
        // programme has no coding practice at all (`$codes` false).
        $languagePresence = $required && $trackFocus !== 'core_first' && $codes ? 'required' : 'sometimes';

        return [
            'branch_code' => ['sometimes', 'string', Rule::exists('branches', 'code')->where('is_active', true)],
            // "My branch isn't listed": what the student wrote instead of picking one, and the department they said it belongs to.
            // Only used when no branch_code is sent (see StudentPreferencesController::applyBranchAnswers).
            'branch_label' => ['sometimes', 'nullable', 'string', 'min:2', 'max:80'],
            'branch_department' => ['sometimes', 'nullable', 'string', Rule::exists('departments', 'code')->where('is_active', true)],
            'track_focus' => ['sometimes', 'nullable', 'string', Rule::in(self::TRACK_FOCUS)],
            'core_interests' => ['sometimes', 'nullable', 'array', 'max:8'],
            'core_interests.*' => ['string', 'distinct', Rule::in(self::allCoreInterests())],
            'primary_language' => [$languagePresence, 'nullable', 'string', Rule::in(JudgeService::SUPPORTED_LANGUAGES)],
            'preferred_languages' => ['sometimes', 'nullable', 'array', 'max:'.self::MAX_LANGUAGES],
            'preferred_languages.*' => ['string', 'distinct', Rule::in(JudgeService::SUPPORTED_LANGUAGES)],
            'skill_level' => [$presence, 'string', Rule::in(self::SKILL_LEVELS)],
            'career_goal' => [$presence, 'string', Rule::in(self::CAREER_GOALS)],
            'focus_areas' => ['sometimes', 'nullable', 'array', 'max:'.count(self::FOCUS_AREAS)],
            'focus_areas.*' => ['string', 'distinct', Rule::in(self::FOCUS_AREAS)],
            'weekly_pace' => ['sometimes', 'nullable', 'string', Rule::in(self::PACES)],
            // "Show me coding practice anyway" — honoured only where the student's programme has it switched off (see the controller).
            'coding_opt_in' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Turns validated input into the column values to save. The primary
     * language always leads `preferred_languages` (it is "the one they use
     * most", so it is also trivially one of the ones they're comfortable
     * with), and the list is de-duplicated — so a reader never has to handle
     * a primary that isn't in its own list.
     *
     * @param  array<string, mixed>  $validated
     * @param  array<int, string>  $currentPreferred  What is saved today — kept when only the primary language changes.
     * @return array<string, mixed>
     */
    public static function normalise(array $validated, ?string $currentPrimary = null, array $currentPreferred = []): array
    {
        $values = $validated;

        $primary = array_key_exists('primary_language', $validated) ? $validated['primary_language'] : $currentPrimary;

        if (array_key_exists('preferred_languages', $validated) || array_key_exists('primary_language', $validated)) {
            $others = array_key_exists('preferred_languages', $validated)
                ? ($validated['preferred_languages'] ?? [])
                : $currentPreferred;

            $values['preferred_languages'] = array_values(array_unique(array_filter([$primary, ...$others])));
        }

        // Handled by BranchAssignmentService / the controller, not stored through this array.
        unset($values['branch_code'], $values['branch_label'], $values['branch_department']);

        if (array_key_exists('core_interests', $validated)) {
            $values['core_interests'] = array_values(array_unique($validated['core_interests'] ?? []));
        }

        if (array_key_exists('focus_areas', $validated)) {
            $values['focus_areas'] = array_values(array_unique($validated['focus_areas'] ?? []));
        }

        return $values;
    }
}
