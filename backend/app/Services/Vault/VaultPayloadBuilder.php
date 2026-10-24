<?php

namespace App\Services\Vault;

use App\Models\CoreSubject;
use App\Models\User;
use App\Models\VaultProfile;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreMasteryService;
use App\Support\BranchCatalog;

/**
 * Builds the profile that leaves AptRun for Mellow Vault (and that the pull API
 * serves) — the ONE place that decides what a student shares. The consent screen
 * lists exactly these fields, so adding one here means changing that wording too
 * (see StudentVaultController::SHARED_FIELDS).
 *
 * Never included: phone numbers (the student's or a parent's), the internal
 * user id, roll number, payment or plan details, proctoring history, or anything
 * a hiring partner could use to reach the student other than through the
 * channels the student agreed to. The email address IS shared with Mellow Vault
 * (and only with Mellow Vault — AptRun's own hiring partners never see it), so
 * that Mellow Vault can invite the student to the profile it holds for them.
 */
class VaultPayloadBuilder
{
    /** The full listing for one profile. */
    public function build(VaultProfile $profile): array
    {
        $user = $profile->user ?? $profile->load('user')->user;
        $college = $user->college_id !== null ? ($user->college ?? $user->load('college')->college) : null;

        return [
            'id' => $profile->public_id,
            'name' => $user->name,
            'email' => $user->email,
            'college' => $college === null ? null : [
                'name' => $college->name,
                'short_code' => $college->short_code,
                'city' => $college->city,
                'state' => $college->state,
            ],
            'branch' => $user->branch,
            // Readiness v4: the canonical branch and its family, so the hiring side can filter "all ECE" without parsing a college's own spelling.
            'branch_code' => $user->branch_code,
            'discipline' => $user->discipline,
            // The department (engineering · management · commerce · arts …) — the programme level above the family, for hiring-side filters.
            'department' => $user->department ?? BranchCatalog::instance()->departmentOfDiscipline($user->discipline),
            'cgpa' => $user->cgpa !== null ? (float) $user->cgpa : null,
            'backlogs' => $user->backlogs,
            'skills' => array_values($user->skills ?? []),
            'bio' => $user->bio,
            'linkedin_url' => $user->linkedin_url,
            'github_url' => $user->github_url,
            'primary_language' => $user->primary_language,
            'contest_rating' => $user->rated_contests_count > 0 ? (int) $user->current_rating : null,
            'profile_completion_percent' => (int) $user->profile_completion_percent,
            'resume' => [
                'available' => $user->resume_path !== null,
                // Fetched with the integration API key — see VaultIntegrationController::resume().
                'url' => $user->resume_path !== null ? url("/api/vault/v1/profiles/{$profile->public_id}/resume") : null,
            ],
            'readiness' => [
                'score' => (int) $profile->readiness_score,
                'tier' => $profile->readiness_tier,
                'peak' => (int) $profile->peak_readiness,
                'version' => $profile->readiness_version,
                // Which weighting made the score: software (everyone before v4) · core · balanced. The components differ by profile.
                'profile' => $profile->readiness_profile ?? 'software',
                'computed_at' => $profile->readiness_computed_at?->toIso8601String(),
                'components' => collect($profile->readiness_components ?? [])
                    ->map(fn (array $c) => [
                        'key' => $c['key'],
                        'label' => $c['label'],
                        'score' => $c['score'],
                        'weight_percent' => $c['weight_percent'],
                    ])
                    ->values()
                    ->all(),
            ],
            'core' => $this->coreStrengths($user),
            'qualified_at' => $profile->qualified_at?->toIso8601String(),
        ];
    }

    /** @var array<int, array{code: string, name: string}>|null subject id => names, read once per builder */
    private ?array $subjects = null;

    /**
     * For a student of a core branch whose Core Prep is live: how they do in each technical subject they have practised
     * or been tested on — at least `readiness.core.vault_min_attempts` answers, accuracy rounded to the nearest 5 so the
     * profile is not re-sent on every single answer. Null for everyone else (a CSE student's payload gains nothing to explain).
     *
     * @return array{subjects: list<array{code: string, name: string, accuracy_percent: int}>}|null
     */
    private function coreStrengths(User $user): ?array
    {
        $discipline = $user->discipline;

        if (! config('readiness.core.counts_towards_score', false)) {
            return null; // Core Prep is not part of the Vault profile while it is not part of the score
        }

        if ($discipline === null || ! CoreAccess::isFamily($discipline) || ! (BranchCatalog::instance()->discipline($discipline)['is_live'] ?? false)) {
            return null;
        }

        $this->subjects ??= CoreSubject::query()->get(['id', 'code', 'name'])->mapWithKeys(fn (CoreSubject $s) => [$s->id => ['code' => $s->code, 'name' => $s->name]])->all();
        $minAttempts = (int) config('readiness.core.vault_min_attempts', 10);
        $strengths = [];

        foreach (app(CoreMasteryService::class)->accuracyFor($user->id)['subjects'] as $subjectId => $stats) {
            if ($stats['attempts'] >= $minAttempts && isset($this->subjects[$subjectId])) {
                $strengths[] = $this->subjects[$subjectId] + ['accuracy_percent' => (int) (round($stats['correct'] / $stats['attempts'] * 20) * 5)];
            }
        }

        usort($strengths, fn (array $a, array $b) => [$b['accuracy_percent'], $a['name']] <=> [$a['accuracy_percent'], $b['name']]);

        return $strengths === [] ? null : ['subjects' => array_slice($strengths, 0, 8)];
    }

    /**
     * A fingerprint of what Mellow Vault would see, used to avoid re-sending a
     * profile that has not actually changed. The computed-at stamp is left out:
     * it moves on every refresh and would make every profile look changed.
     */
    public function fingerprint(array $payload): string
    {
        unset($payload['readiness']['computed_at']);

        return sha1(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }
}
