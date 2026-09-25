<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

/**
 * See the creating migration's docblock — a reusable role definition whose
 * `rounds_config` is snapshotted onto a track's 3 round Interviews at
 * creation time, never read live afterward.
 */
class InterviewRoleTemplate extends Model
{
    protected $fillable = [
        'name',
        'description',
        'tech_stack_tags',
        'rounds_config',
        'owning_college_id',
        'owning_company_id',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'tech_stack_tags' => 'array',
            'rounds_config' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function owningCollege(): BelongsTo
    {
        return $this->belongsTo(College::class, 'owning_college_id');
    }

    public function owningCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'owning_company_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(InterviewTrack::class);
    }

    public function isGlobal(): bool
    {
        return $this->owning_college_id === null && $this->owning_company_id === null;
    }

    /** Ops-global templates are usable by everyone; a private template only by its own college/company. */
    public function isUsableBy(User $user): bool
    {
        if ($this->isGlobal()) {
            return true;
        }

        if ($this->owning_college_id !== null) {
            return $user->college_id === $this->owning_college_id;
        }

        return $user->company_id === $this->owning_company_id;
    }

    /**
     * Shared by AdminInterviewRoleTemplateController/TpoInterviewRoleTemplateController/
     * CompanyInterviewRoleTemplateController's store()/update() so the
     * "exactly 3 rounds, weights sum to 100" contract lives in one place —
     * a 3-controller-mirrored validate() call would otherwise drift.
     * Returns the cleaned/normalized config on success; throws the same
     * ValidationException shape $request->validate() would, so a 422 looks
     * identical either way to the frontend.
     *
     * @param  array<int, array<string, mixed>>  $roundsConfig
     * @return array<int, array<string, mixed>>
     */
    public static function validateRoundsConfig(array $roundsConfig): array
    {
        $fail = fn (string $message) => throw ValidationException::withMessages(['rounds_config' => $message]);

        if (count($roundsConfig) !== 3) {
            $fail('A role template must define exactly 3 rounds.');
        }

        $cleaned = [];

        foreach (array_values($roundsConfig) as $i => $round) {
            $expectedRoundNumber = $i + 1;

            if (! is_array($round)) {
                $fail("Round {$expectedRoundNumber} is not a valid round definition.");
            }

            if ((int) ($round['round_number'] ?? 0) !== $expectedRoundNumber) {
                $fail("Rounds must be numbered 1, 2, 3 in order (round {$expectedRoundNumber} is out of order).");
            }

            $roundName = trim((string) ($round['round_name'] ?? ''));
            if ($roundName === '') {
                $fail("Round {$expectedRoundNumber} needs a name.");
            }

            $questionCount = (int) ($round['question_count'] ?? 0);
            if ($questionCount < 1 || $questionCount > 20) {
                $fail("Round {$expectedRoundNumber}'s question count must be between 1 and 20.");
            }

            $difficulty = $round['difficulty'] ?? null;
            if (! in_array($difficulty, InterviewQuestionBank::DIFFICULTIES, true)) {
                $fail("Round {$expectedRoundNumber} has an invalid difficulty.");
            }

            $categoryWeights = $round['category_weights'] ?? null;
            if (! is_array($categoryWeights) || empty($categoryWeights)) {
                $fail("Round {$expectedRoundNumber} needs at least one weighted category.");
            }

            $weightSum = 0;
            $cleanedWeights = [];
            foreach ($categoryWeights as $category => $weight) {
                if (! in_array($category, InterviewQuestionBank::CATEGORIES, true)) {
                    $fail("Round {$expectedRoundNumber} has an invalid category \"{$category}\".");
                }

                $weight = (int) $weight;
                if ($weight <= 0) {
                    $fail("Round {$expectedRoundNumber}'s \"{$category}\" weight must be greater than 0.");
                }

                $weightSum += $weight;
                $cleanedWeights[$category] = $weight;
            }

            if ($weightSum !== 100) {
                $fail("Round {$expectedRoundNumber}'s category weights must sum to exactly 100 (currently {$weightSum}).");
            }

            $qualifyingScorePercent = $round['qualifying_score_percent'] ?? null;
            if (! is_numeric($qualifyingScorePercent) || $qualifyingScorePercent < 1 || $qualifyingScorePercent > 100) {
                $fail("Round {$expectedRoundNumber} needs a qualifying score between 1 and 100.");
            }

            $cleaned[] = [
                'round_number' => $expectedRoundNumber,
                'round_name' => $roundName,
                'question_count' => $questionCount,
                'difficulty' => $difficulty,
                'category_weights' => $cleanedWeights,
                'qualifying_score_percent' => (float) $qualifyingScorePercent,
            ];
        }

        return $cleaned;
    }
}
