<?php

namespace App\Services\Vault;

use App\Models\VaultProfile;

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
            'qualified_at' => $profile->qualified_at?->toIso8601String(),
        ];
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
