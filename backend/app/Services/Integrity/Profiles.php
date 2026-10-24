<?php

namespace App\Services\Integrity;

/**
 * Resolves "what does this surface require?" from config/integrity.php, and shapes the part of it the browser needs.
 * The browser is TOLD the policy by the server on every start; it never decides it.
 */
final class Profiles
{
    public const SURFACE_KEYS = ['contest', 'interview', 'soft_skill', 'core_test', 'study'];

    /** Whether the whole layer applies to this surface (master switch, plus the surface's own proctoring switch). */
    public static function enabledFor(string $surface): bool
    {
        if (! config('integrity.enabled', true)) {
            return false;
        }

        return match ($surface) {
            'soft_skill' => (bool) config('proctoring.soft_skills_enabled', true),
            'core_test' => (bool) config('proctoring.core_tests_enabled', true),
            'study' => (bool) config('proctoring.study_enabled', true),
            default => true,
        };
    }

    public static function nameFor(string $surface): string
    {
        $name = (string) config("integrity.surfaces.{$surface}", 'standard');

        return config("integrity.profiles.{$name}") ? $name : 'standard';
    }

    /** @return array<string, mixed> */
    public static function forSurface(string $surface): array
    {
        return self::named(self::nameFor($surface));
    }

    /** @return array<string, mixed> */
    public static function named(string $name): array
    {
        $profile = (array) config("integrity.profiles.{$name}", config('integrity.profiles.standard'));
        $profile['name'] = $name;

        return $profile;
    }

    /** True when the Guardian must be paired before this attempt may start. */
    public static function guardianRequired(array $profile): bool
    {
        return ($profile['guardian'] ?? 'off') === 'required';
    }

    /**
     * What the browser engine is told. Everything here is a REQUIREMENT the server will also enforce or verify; none of it
     * is a setting the client can relax.
     *
     * @return array<string, mixed>
     */
    public static function clientPolicy(array $profile): array
    {
        return [
            'profile' => $profile['name'],
            'beat_interval' => (int) $profile['beat_interval'],
            'stale_after' => (int) $profile['stale_after'],
            'webcam_snapshot' => (int) $profile['webcam_snapshot'],
            'screen_snapshot' => (int) $profile['screen_snapshot'],
            'screen_share' => (string) $profile['screen_share'],
            'camera' => (string) $profile['camera'],
            'guardian' => (string) $profile['guardian'],
            'chromium_only' => (bool) $profile['chromium_only'],
            'block_multi_monitor' => (bool) $profile['block_multi_monitor'],
            'focus_loss_strike' => (int) $profile['focus_loss_strike'],
            'ai' => (bool) $profile['ai'],
            'clipboard' => (string) $profile['clipboard'],
            'stun_servers' => array_values((array) config('integrity.network.stun_servers', [])),
            // Said to the student up front, in the consent screen: what is kept and for how long.
            'retention_days' => (int) config('integrity.evidence.retention_days', 45),
            'flagged_retention_days' => (int) config('integrity.evidence.flagged_retention_days', 365),
        ];
    }
}
