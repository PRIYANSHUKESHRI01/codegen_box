<?php

namespace App\Services\Security;

use App\Models\SuperadminLoginLog;
use App\Models\SuperadminTrustedDevice;
use App\Models\User;
use App\Support\ClientInfo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Captures and enriches full IP, network, browser, laptop, hardware, and
 * device-fingerprint telemetry for every superadmin authentication event, and
 * enforces optional Laptop + IP binding against `superadmin_trusted_devices`.
 */
class SuperadminLoginTelemetryService
{
    /**
     * Extract normalized server + client telemetry from the incoming request.
     *
     * @param  array<string, mixed>  $clientTelemetry
     * @return array<string, mixed>
     */
    public function extract(Request $request, array $clientTelemetry = []): array
    {
        $ip = $request->ip();
        $forwardedFor = $this->firstNonEmpty([
            $request->headers->get('cf-connecting-ip'),
            $request->headers->get('true-client-ip'),
            $request->headers->get('x-real-ip'),
            $request->headers->get('x-forwarded-for'),
        ]);

        $isPrivateIp = $ip
            ? filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false
            : true;

        $ua = (string) ($request->userAgent() ?? '');
        $coarse = ClientInfo::parse($ua);
        $parsedBrowser = $this->parseBrowser($ua, $clientTelemetry);
        $parsedOs = $this->parseOs($ua, $request, $clientTelemetry);

        $deviceType = $this->cleanString($clientTelemetry['device_type'] ?? null, 24);
        if (! in_array($deviceType, ['laptop', 'desktop', 'mobile', 'tablet'], true)) {
            $deviceType = $coarse['device'] === 'desktop' ? 'laptop' : $coarse['device'];
        }

        $platform = $this->cleanString($clientTelemetry['platform'] ?? $request->headers->get('sec-ch-ua-platform'), 64);
        if ($platform !== null) {
            $platform = trim($platform, '"');
        }

        $arch = $this->cleanString($clientTelemetry['architecture'] ?? $request->headers->get('sec-ch-ua-arch'), 32);
        if ($arch !== null) {
            $arch = trim($arch, '"');
        }

        $gpuVendor = $this->cleanString($clientTelemetry['gpu_vendor'] ?? null, 120);
        $gpuRenderer = $this->cleanString($clientTelemetry['gpu_renderer'] ?? null, 255);
        $screen = $this->cleanString($clientTelemetry['screen_resolution'] ?? null, 64);
        $timezone = $this->cleanString($clientTelemetry['timezone'] ?? null, 80);
        $language = $this->cleanString($clientTelemetry['language'] ?? $this->primaryAcceptLanguage($request), 32);
        $cpuCores = $this->cleanInt($clientTelemetry['cpu_cores'] ?? null, 1, 512);
        $memoryGb = $this->cleanFloat($clientTelemetry['device_memory_gb'] ?? null, 0.25, 1024);

        $networkType = $this->cleanString($clientTelemetry['network_type'] ?? null, 32);
        $effectiveType = $this->cleanString($clientTelemetry['effective_type'] ?? null, 16);
        $downlinkMbps = $this->cleanFloat($clientTelemetry['downlink_mbps'] ?? null, 0, 100000);
        $rttMs = $this->cleanInt($clientTelemetry['rtt_ms'] ?? null, 0, 60000);

        $clientHints = array_filter([
            'sec_ch_ua' => $request->headers->get('sec-ch-ua'),
            'sec_ch_ua_platform' => $request->headers->get('sec-ch-ua-platform'),
            'sec_ch_ua_platform_version' => $request->headers->get('sec-ch-ua-platform-version'),
            'sec_ch_ua_model' => $request->headers->get('sec-ch-ua-model'),
            'sec_ch_ua_mobile' => $request->headers->get('sec-ch-ua-mobile'),
            'sec_ch_ua_arch' => $request->headers->get('sec-ch-ua-arch'),
            'accept_language' => $request->headers->get('accept-language'),
            'cf_ipcountry' => $request->headers->get('cf-ipcountry'),
            'cf_ray' => $request->headers->get('cf-ray'),
        ], fn ($v) => $v !== null && $v !== '');

        $deviceFingerprint = $this->cleanString($clientTelemetry['device_fingerprint'] ?? null, 128);
        if ($deviceFingerprint === null) {
            $deviceFingerprint = hash('sha256', implode('|', [
                $ua,
                (string) ($platform ?? ''),
                (string) ($arch ?? ''),
                (string) ($gpuRenderer ?? ''),
                (string) ($screen ?? ''),
                (string) ($timezone ?? ''),
                (string) ($language ?? ''),
            ]));
        }

        $deviceId = $this->cleanString($clientTelemetry['device_id'] ?? null, 128);

        $osSummary = trim($parsedOs['name'].($parsedOs['version'] ? ' '.$parsedOs['version'] : ''));
        $browserSummary = trim($parsedBrowser['name'].($parsedBrowser['version'] ? ' '.$parsedBrowser['version'] : ''));
        $shortGpu = $this->shortenGpu($gpuRenderer);
        $deviceLabel = mb_substr(implode(' · ', array_values(array_filter([
            $osSummary !== '' ? $osSummary : null,
            $browserSummary !== '' ? $browserSummary : null,
            $shortGpu,
            $screen,
        ]))), 0, 255) ?: ($coarse['os'].' · '.$coarse['browser']);

        $rawTelemetry = $this->sanitizeRawTelemetry($clientTelemetry);

        return [
            'ip_address' => $ip ? mb_substr($ip, 0, 45) : null,
            'forwarded_for' => $forwardedFor ? mb_substr($forwardedFor, 0, 255) : null,
            'is_private_ip' => $isPrivateIp,
            'hostname' => $isPrivateIp ? 'localhost' : null,
            'isp' => $isPrivateIp ? 'Local / Private Network' : null,
            'asn' => null,
            'network_org' => $isPrivateIp ? 'Loopback / LAN' : null,
            'city' => $isPrivateIp ? 'Local Network' : null,
            'region' => null,
            'country' => $isPrivateIp ? 'Local' : null,
            'country_code' => $request->headers->get('cf-ipcountry')
                ? mb_substr((string) $request->headers->get('cf-ipcountry'), 0, 8)
                : null,
            'network_type' => $networkType,
            'effective_type' => $effectiveType,
            'downlink_mbps' => $downlinkMbps,
            'rtt_ms' => $rttMs,
            'device_fingerprint' => $deviceFingerprint,
            'device_id' => $deviceId,
            'device_type' => $deviceType,
            'device_label' => $deviceLabel,
            'os' => $parsedOs['name'],
            'os_version' => $parsedOs['version'],
            'browser' => $parsedBrowser['name'],
            'browser_version' => $parsedBrowser['version'],
            'platform' => $platform,
            'architecture' => $arch,
            'cpu_cores' => $cpuCores,
            'device_memory_gb' => $memoryGb,
            'gpu_vendor' => $gpuVendor,
            'gpu_renderer' => $gpuRenderer,
            'screen_resolution' => $screen,
            'timezone' => $timezone,
            'language' => $language,
            'user_agent' => $ua !== '' ? $ua : null,
            'client_hints' => $clientHints !== [] ? $clientHints : null,
            'raw_telemetry' => $rawTelemetry !== [] ? $rawTelemetry : null,
        ];
    }

    /**
     * Persist a superadmin security/login log entry and schedule async IP/ISP enrichment for public IPs.
     *
     * @param  array<string, mixed>  $clientTelemetry
     */
    public function record(
        string $event,
        ?User $user,
        Request $request,
        ?string $email = null,
        ?string $reason = null,
        ?string $portal = null,
        ?int $tokenId = null,
        array $clientTelemetry = [],
    ): ?SuperadminLoginLog {
        try {
            if (! Schema::hasTable('superadmin_login_logs')) {
                return null;
            }

            $data = $this->extract($request, $clientTelemetry);

            $log = SuperadminLoginLog::create(array_merge($data, [
                'user_id' => $user?->id,
                'email' => $email !== null ? mb_substr(mb_strtolower($email), 0, 190) : $user?->email,
                'event' => mb_substr($event, 0, 36),
                'reason' => $reason ? mb_substr($reason, 0, 100) : null,
                'portal' => $portal ? mb_substr($portal, 0, 30) : null,
                'token_id' => $tokenId,
                'created_at' => now(),
            ]));

            // Enrich public IPs after response is sent so login latency is never impacted.
            if (! $data['is_private_ip'] && $data['ip_address'] && ! app()->runningUnitTests()) {
                $logId = $log->id;
                $ip = $data['ip_address'];

                dispatch(function () use ($logId, $ip) {
                    $this->enrichIpMetadata($logId, $ip);
                })->afterResponse();
            }

            return $log;
        } catch (Throwable $e) {
            if (Cache::add('superadmin-login-log-failed', true, 3600)) {
                Log::warning('Could not record superadmin login log: '.$e->getMessage());
            }

            return null;
        }
    }

    /**
     * Check whether the incoming request & client telemetry matches an active trusted device rule.
     *
     * @param  array<string, mixed>  $clientTelemetry
     */
    public function findMatchingTrustedDevice(User $user, Request $request, array $clientTelemetry = []): ?SuperadminTrustedDevice
    {
        $devices = $user->trustedDevices()->where('is_active', true)->get();
        if ($devices->isEmpty()) {
            return null;
        }

        $telemetry = $this->extract($request, $clientTelemetry);
        $ip = (string) ($telemetry['ip_address'] ?? '');
        $fingerprint = (string) ($telemetry['device_fingerprint'] ?? '');
        $deviceId = (string) ($telemetry['device_id'] ?? '');

        foreach ($devices as $device) {
            $hasRule = ($device->ip_address !== null && $device->ip_address !== '')
                || ($device->device_fingerprint !== null && $device->device_fingerprint !== '')
                || ($device->device_id !== null && $device->device_id !== '');

            if (! $hasRule) {
                continue;
            }

            if ($device->ip_address !== null && $device->ip_address !== '') {
                if ($ip === '' || ! $this->ipMatches($ip, $device->ip_address)) {
                    continue;
                }
            }

            if ($device->device_fingerprint !== null && $device->device_fingerprint !== '') {
                if ($fingerprint === '' || ! hash_equals($device->device_fingerprint, $fingerprint)) {
                    continue;
                }
            } elseif ($device->device_id !== null && $device->device_id !== '') {
                if ($deviceId === '' || ! hash_equals($device->device_id, $deviceId)) {
                    continue;
                }
            }

            return $device;
        }

        return null;
    }

    /**
     * Exact IP or CIDR (IPv4/IPv6) matching.
     */
    public function ipMatches(string $clientIp, string $ruleIp): bool
    {
        $ruleIp = trim($ruleIp);
        if ($ruleIp === $clientIp) {
            return true;
        }

        if (! str_contains($ruleIp, '/')) {
            return false;
        }

        [$subnet, $bits] = explode('/', $ruleIp, 2);
        if (! is_numeric($bits)) {
            return false;
        }

        $clientBin = @inet_pton($clientIp);
        $subnetBin = @inet_pton($subnet);
        if ($clientBin === false || $subnetBin === false || strlen($clientBin) !== strlen($subnetBin)) {
            return false;
        }

        $bitsInt = (int) $bits;
        $maxBits = strlen($clientBin) * 8;
        if ($bitsInt < 0 || $bitsInt > $maxBits) {
            return false;
        }

        $fullBytes = intdiv($bitsInt, 8);
        $remainingBits = $bitsInt % 8;

        if ($fullBytes > 0 && substr($clientBin, 0, $fullBytes) !== substr($subnetBin, 0, $fullBytes)) {
            return false;
        }

        if ($remainingBits === 0) {
            return true;
        }

        $mask = (0xFF << (8 - $remainingBits)) & 0xFF;

        return (ord($clientBin[$fullBytes]) & $mask) === (ord($subnetBin[$fullBytes]) & $mask);
    }

    private function enrichIpMetadata(int $logId, string $ip): void
    {
        try {
            $meta = Cache::remember("superadmin_ip_geo:{$ip}", now()->addHours(24), function () use ($ip) {
                $resp = Http::timeout(2)->acceptJson()->get("http://ip-api.com/json/{$ip}", [
                    'fields' => 'status,country,countryCode,regionName,city,isp,org,as,reverse',
                ]);

                if (! $resp->successful()) {
                    return null;
                }

                $json = $resp->json();
                if (! is_array($json) || ($json['status'] ?? null) !== 'success') {
                    return null;
                }

                return [
                    'isp' => $this->cleanString($json['isp'] ?? null, 150),
                    'network_org' => $this->cleanString($json['org'] ?? null, 150),
                    'asn' => $this->cleanString($json['as'] ?? null, 64),
                    'city' => $this->cleanString($json['city'] ?? null, 100),
                    'region' => $this->cleanString($json['regionName'] ?? null, 100),
                    'country' => $this->cleanString($json['country'] ?? null, 100),
                    'country_code' => $this->cleanString($json['countryCode'] ?? null, 8),
                    'hostname' => $this->cleanString($json['reverse'] ?? null, 255),
                ];
            });

            if (is_array($meta)) {
                SuperadminLoginLog::whereKey($logId)->update(array_filter($meta, fn ($v) => $v !== null));
            }
        } catch (Throwable) {
            // Fail-soft enrichment.
        }
    }

    /**
     * @param  array<string, mixed>  $client
     * @return array{name: string, version: ?string}
     */
    private function parseBrowser(string $ua, array $client): array
    {
        $clientBrowser = $this->cleanString($client['browser'] ?? null, 64);
        $clientVersion = $this->cleanString($client['browser_version'] ?? null, 64);

        if ($clientBrowser !== null) {
            return ['name' => $clientBrowser, 'version' => $clientVersion];
        }

        return match (true) {
            (bool) preg_match('/Edg(?:e|A|iOS)?\/([\d.]+)/', $ua, $m) => ['name' => 'Edge', 'version' => $m[1]],
            (bool) preg_match('/(?:OPR|Opera)\/([\d.]+)/', $ua, $m) => ['name' => 'Opera', 'version' => $m[1]],
            (bool) preg_match('/SamsungBrowser\/([\d.]+)/', $ua, $m) => ['name' => 'Samsung Internet', 'version' => $m[1]],
            (bool) preg_match('/(?:Firefox|FxiOS)\/([\d.]+)/', $ua, $m) => ['name' => 'Firefox', 'version' => $m[1]],
            (bool) preg_match('/(?:Chrome|CriOS)\/([\d.]+)/', $ua, $m) => ['name' => 'Chrome', 'version' => $m[1]],
            (bool) preg_match('/Version\/([\d.]+).*Safari/', $ua, $m) => ['name' => 'Safari', 'version' => $m[1]],
            default => ['name' => ClientInfo::parse($ua)['browser'], 'version' => null],
        };
    }

    /**
     * @param  array<string, mixed>  $client
     * @return array{name: string, version: ?string}
     */
    private function parseOs(string $ua, Request $request, array $client): array
    {
        $clientOs = $this->cleanString($client['os'] ?? null, 64);
        $clientOsVersion = $this->cleanString($client['os_version'] ?? null, 64);

        if ($clientOs !== null) {
            return ['name' => $clientOs, 'version' => $clientOsVersion];
        }

        $chVersion = $this->cleanString(trim((string) $request->headers->get('sec-ch-ua-platform-version', ''), '"'), 64);

        if (preg_match('/Windows NT 10\.0/i', $ua)) {
            $winVersion = '10/11';
            if ($chVersion !== null && version_compare($chVersion, '13.0.0', '>=')) {
                $winVersion = '11';
            }

            return ['name' => 'Windows', 'version' => $winVersion];
        }

        if (preg_match('/Mac OS X ([\d_]+)/i', $ua, $m)) {
            return ['name' => 'macOS', 'version' => str_replace('_', '.', $m[1])];
        }

        if (preg_match('/Android ([\d.]+)/i', $ua, $m)) {
            return ['name' => 'Android', 'version' => $m[1]];
        }

        if (preg_match('/(?:iPhone|iPad).*OS ([\d_]+)/i', $ua, $m)) {
            return ['name' => 'iOS', 'version' => str_replace('_', '.', $m[1])];
        }

        return ['name' => ClientInfo::parse($ua)['os'], 'version' => $chVersion];
    }

    private function shortenGpu(?string $gpu): ?string
    {
        if ($gpu === null || $gpu === '') {
            return null;
        }

        // Turn "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11...)" into a concise label
        if (preg_match('/ANGLE\s*\([^,]+,\s*([^,(]+)/i', $gpu, $m)) {
            return mb_substr(trim($m[1]), 0, 60);
        }

        return mb_substr($gpu, 0, 60);
    }

    private function primaryAcceptLanguage(Request $request): ?string
    {
        $header = (string) $request->headers->get('accept-language', '');
        if ($header === '') {
            return null;
        }

        $first = trim(explode(',', $header)[0] ?? '');

        return $first !== '' ? mb_substr($first, 0, 32) : null;
    }

    /** @param list<string|null> $values */
    private function firstNonEmpty(array $values): ?string
    {
        foreach ($values as $v) {
            if (is_string($v) && trim($v) !== '') {
                return trim($v);
            }
        }

        return null;
    }

    private function cleanString(mixed $value, int $maxLength): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : mb_substr($trimmed, 0, $maxLength);
    }

    private function cleanInt(mixed $value, int $min, int $max): ?int
    {
        if (! is_numeric($value)) {
            return null;
        }

        $int = (int) $value;

        return ($int >= $min && $int <= $max) ? $int : null;
    }

    private function cleanFloat(mixed $value, float $min, float $max): ?float
    {
        if (! is_numeric($value)) {
            return null;
        }

        $float = round((float) $value, 2);

        return ($float >= $min && $float <= $max) ? $float : null;
    }

    /**
     * @param  array<string, mixed>  $clientTelemetry
     * @return array<string, mixed>
     */
    private function sanitizeRawTelemetry(array $clientTelemetry): array
    {
        $allowedKeys = [
            'device_id',
            'device_fingerprint',
            'device_type',
            'os',
            'os_version',
            'browser',
            'browser_version',
            'platform',
            'architecture',
            'cpu_cores',
            'device_memory_gb',
            'gpu_vendor',
            'gpu_renderer',
            'screen_resolution',
            'color_depth',
            'pixel_ratio',
            'timezone',
            'language',
            'languages',
            'touch_points',
            'network_type',
            'effective_type',
            'downlink_mbps',
            'rtt_ms',
            'save_data',
            'user_agent_data',
        ];

        $out = [];
        foreach ($allowedKeys as $key) {
            if (array_key_exists($key, $clientTelemetry) && $clientTelemetry[$key] !== null) {
                $out[$key] = $clientTelemetry[$key];
            }
        }

        return $out;
    }
}
