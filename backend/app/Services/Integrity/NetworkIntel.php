<?php

namespace App\Services\Integrity;

/**
 * Address maths with no external database: CIDR matching (IPv4 and IPv6), and a coarse classification of an address.
 *
 * What this is NOT: a geo-IP or "is this a VPN?" database. Those lists go stale in weeks and are wrong often enough to
 * lock an honest student out. The controls here are the ones that are always right — "is this address inside the
 * exam network this college/deployment declared?" — plus what the Guardian reads off the machine itself (adapters, proxy
 * settings), which is far stronger evidence than a guess from an address.
 */
final class NetworkIntel
{
    /** @param  list<string>  $cidrs */
    public static function matchesAny(?string $ip, array $cidrs): bool
    {
        if ($ip === null || $ip === '') {
            return false;
        }

        foreach ($cidrs as $cidr) {
            if (self::inCidr($ip, $cidr)) {
                return true;
            }
        }

        return false;
    }

    /** Accepts "10.0.0.0/8", "203.0.113.7" (a single address) and IPv6 equivalents. Anything unparsable never matches. */
    public static function inCidr(string $ip, string $cidr): bool
    {
        $cidr = trim($cidr);
        if ($cidr === '') {
            return false;
        }

        [$subnet, $bits] = array_pad(explode('/', $cidr, 2), 2, null);

        $ipBin = @inet_pton($ip);
        $subnetBin = @inet_pton((string) $subnet);

        if ($ipBin === false || $subnetBin === false || strlen($ipBin) !== strlen($subnetBin)) {
            // An IPv4-mapped IPv6 address ("::ffff:10.0.0.1") against an IPv4 range.
            if ($ipBin !== false && strlen($ipBin) === 16 && $subnetBin !== false && strlen($subnetBin) === 4 && str_starts_with($ipBin, str_repeat("\0", 10)."\xff\xff")) {
                $ipBin = substr($ipBin, 12);
            } else {
                return false;
            }
        }

        $max = strlen($ipBin) * 8;
        $bits = $bits === null || $bits === '' ? $max : (int) $bits;
        if ($bits < 0 || $bits > $max) {
            return false;
        }

        $fullBytes = intdiv($bits, 8);
        if ($fullBytes > 0 && substr($ipBin, 0, $fullBytes) !== substr($subnetBin, 0, $fullBytes)) {
            return false;
        }

        $remainder = $bits % 8;
        if ($remainder === 0) {
            return true;
        }

        $mask = (0xFF << (8 - $remainder)) & 0xFF;

        return (ord($ipBin[$fullBytes]) & $mask) === (ord($subnetBin[$fullBytes]) & $mask);
    }

    /** private | loopback | cgnat | link_local | public | invalid */
    public static function classify(?string $ip): string
    {
        if ($ip === null || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return 'invalid';
        }

        if (self::matchesAny($ip, ['127.0.0.0/8', '::1/128'])) {
            return 'loopback';
        }
        if (self::matchesAny($ip, ['100.64.0.0/10'])) {
            return 'cgnat';
        }
        if (self::matchesAny($ip, ['169.254.0.0/16', 'fe80::/10'])) {
            return 'link_local';
        }
        if (self::matchesAny($ip, ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'])) {
            return 'private';
        }

        return 'public';
    }

    /**
     * Whether an attempt may start from `$ip`. Two independent lists:
     *   blocked_ranges  always refused
     *   allowed ranges  (deployment-wide + the student's college): when ANY are configured, the address must be in one
     *
     * @param  list<string>  $collegeRanges
     * @return array{ok: bool, reason: ?string}
     */
    public static function admits(?string $ip, array $collegeRanges = []): array
    {
        $blocked = (array) config('integrity.network.blocked_ranges', []);
        if ($blocked !== [] && self::matchesAny($ip, $blocked)) {
            return ['ok' => false, 'reason' => 'blocked_range'];
        }

        $allowed = array_values(array_filter(array_merge((array) config('integrity.network.allowed_ranges', []), $collegeRanges)));
        if ($allowed !== [] && ! self::matchesAny($ip, $allowed)) {
            return ['ok' => false, 'reason' => 'outside_exam_network'];
        }

        return ['ok' => true, 'reason' => null];
    }

    /** Validates a user-typed list of CIDRs/addresses; returns [cleaned, invalid]. */
    public static function parseRanges(string $raw): array
    {
        $clean = [];
        $invalid = [];

        foreach (preg_split('/[\s,;]+/', trim($raw)) ?: [] as $token) {
            if ($token === '') {
                continue;
            }

            [$addr, $bits] = array_pad(explode('/', $token, 2), 2, null);
            $bin = @inet_pton($addr);
            $max = $bin === false ? 0 : strlen($bin) * 8;

            if ($bin === false || ($bits !== null && (! ctype_digit($bits) || (int) $bits > $max))) {
                $invalid[] = $token;

                continue;
            }

            $clean[] = $token;
        }

        return [array_values(array_unique($clean)), $invalid];
    }
}
