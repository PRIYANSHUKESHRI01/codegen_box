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
    ];

    /** What the student wants to spend their time on — each maps to a real area of the platform. */
    public const FOCUS_AREAS = [
        'problem_solving',
        'contests',
        'mock_interviews',
        'communication',
        'soft_skills',
        'projects',
    ];

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

    /** @return array{solved: int, hard: int} */
    public static function weeklyTargets(?string $pace): array
    {
        return self::PACE_TARGETS[$pace] ?? self::PACE_TARGETS[self::DEFAULT_PACE];
    }

    /**
     * Validation rules for every preference field. `$required` is true for the
     * onboarding wizard's own submit (the three answers it cannot do without)
     * and false for Settings, where any field can be edited on its own.
     *
     * @return array<string, array<int, mixed>>
     */
    public static function rules(bool $required): array
    {
        $presence = $required ? 'required' : 'sometimes';

        return [
            'primary_language' => [$presence, 'string', Rule::in(JudgeService::SUPPORTED_LANGUAGES)],
            'preferred_languages' => ['sometimes', 'nullable', 'array', 'max:'.self::MAX_LANGUAGES],
            'preferred_languages.*' => ['string', 'distinct', Rule::in(JudgeService::SUPPORTED_LANGUAGES)],
            'skill_level' => [$presence, 'string', Rule::in(self::SKILL_LEVELS)],
            'career_goal' => [$presence, 'string', Rule::in(self::CAREER_GOALS)],
            'focus_areas' => ['sometimes', 'nullable', 'array', 'max:'.count(self::FOCUS_AREAS)],
            'focus_areas.*' => ['string', 'distinct', Rule::in(self::FOCUS_AREAS)],
            'weekly_pace' => ['sometimes', 'nullable', 'string', Rule::in(self::PACES)],
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

        $primary = $validated['primary_language'] ?? $currentPrimary;

        if (array_key_exists('preferred_languages', $validated) || array_key_exists('primary_language', $validated)) {
            $others = array_key_exists('preferred_languages', $validated)
                ? ($validated['preferred_languages'] ?? [])
                : $currentPreferred;

            $values['preferred_languages'] = array_values(array_unique(array_filter([$primary, ...$others])));
        }

        if (array_key_exists('focus_areas', $validated)) {
            $values['focus_areas'] = array_values(array_unique($validated['focus_areas'] ?? []));
        }

        return $values;
    }
}
