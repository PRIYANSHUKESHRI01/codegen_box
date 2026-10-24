<?php

namespace App\Services\Integrity;

use App\Models\GuardianInstall;
use App\Models\GuardianLink;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The AptRun Guardian's side of the server: pairing it to a student, authenticating every report it sends, and turning
 * its last operating-system snapshot into pre-flight blockers for the page.
 *
 * Trust model. The Guardian is a program on the STUDENT'S computer, so it can be attacked; what we get is a high price,
 * not impossibility:
 *   - it holds an Ed25519 private key the page never sees, so patching the page cannot change what the Guardian says;
 *   - every report is signed over (link id, sequence number, SHA-256 of the body) — no replay, no tampering in transit,
 *     no reports from anything but that installation;
 *   - it reports its own executable's hash, which is checked against the released builds;
 *   - and the server cross-checks it against the page (see IntegrityService::guardianCrossCheck / guardianHostCheck), so
 *     a Guardian pointed at the wrong machine disagrees with the page and is caught.
 */
class GuardianService
{
    private const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    private const LINK_TTL_HOURS = 12;

    /** type => [title, how to fix it] — what the page shows a student who cannot start yet. */
    private const BLOCKER_TEXT = [
        'vm_detected' => ['Virtual machine detected', 'Take the exam on the real computer, not inside a virtual machine.'],
        'remote_session' => ['Remote desktop session', 'Take the exam directly on the computer, not through a remote connection.'],
        'multi_monitor_os' => ['More than one screen is connected', 'Disconnect every extra monitor and projector, then try again.'],
        'virtual_display' => ['A virtual display adapter is installed', 'Disable the virtual display / extended-screen software, then try again.'],
        'forbidden_process' => ['A program that is not allowed is running', 'Close the program named below, then try again.'],
        'capture_excluded_window' => ['A window is hiding itself from screen sharing', 'Close the program that owns it (named below), then try again.'],
        'overlay_window' => ['A transparent overlay is on top of your screen', 'Close the program that owns it (named below), then try again.'],
        'proxy_detected' => ['Your internet goes through a proxy', 'Turn off the proxy in Windows / browser network settings (or stop the program that intercepts HTTPS), then try again.'],
        'browser_flag' => ['Your browser was started with unsafe options', 'Close every browser window and open the browser normally (from the Start menu or taskbar, not from a script or shortcut with extra options), then try again.'],
        'vpn_detected' => ['A VPN or tunnel is active', 'Disconnect the VPN, then try again.'],
        'root_ca_added' => ['An unusual security certificate is installed', 'Remove certificates added by interception tools, or use a different computer.'],
        'debugger_attached' => ['A debugger is attached to the Guardian', 'Close the debugger, then reopen the Guardian.'],
        'injected_module' => ['Another program loaded a library into the Guardian', 'Close the program named below (and any tool that hooks other programs), then reopen the Guardian.'],
        'guardian_integrity' => ['The Guardian program was modified', 'Reinstall the Guardian from the official download.'],
    ];

    // ── pairing ─────────────────────────────────────────────────────────────────────────────────────────────────────

    /** @return array{code: string, expires_at: string, ttl: int} a short code the student types into (or opens with) the Guardian */
    public function newPairCode(User $user): array
    {
        $ttl = (int) config('integrity.guardian.pair_ttl_seconds', 600);

        // One live code per student: a new one retires the old.
        $old = Cache::get('guardian:pair:user:'.$user->id);
        if (is_string($old)) {
            Cache::forget('guardian:pair:'.$old);
        }

        do {
            $raw = '';
            for ($i = 0; $i < 8; $i++) {
                $raw .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
        } while (Cache::has('guardian:pair:'.$raw));

        Cache::put('guardian:pair:'.$raw, $user->id, $ttl);
        Cache::put('guardian:pair:user:'.$user->id, $raw, $ttl);

        return ['code' => substr($raw, 0, 4).'-'.substr($raw, 4), 'expires_at' => now()->addSeconds($ttl)->toIso8601String(), 'ttl' => $ttl];
    }

    /**
     * Redeems a pairing code. Unauthenticated by design (the Guardian has no login) — the one-time code, typed or opened by
     * the student on THEIR computer, is the credential, and the route is throttled per address.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function pair(string $code, array $input, Request $request): array
    {
        $this->assertSodium();

        $key = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code) ?? '');
        $userId = $key !== '' ? Cache::pull('guardian:pair:'.$key) : null;

        if (! is_numeric($userId)) {
            $this->refuse(422, 'invalid_code', 'That code is not valid or has expired. Get a new one from the exam page.');
        }

        $user = User::find((int) $userId);
        if ($user === null) {
            $this->refuse(422, 'invalid_code', 'That code is not valid or has expired. Get a new one from the exam page.');
        }
        Cache::forget('guardian:pair:user:'.$user->id);

        $publicKey = base64_decode((string) ($input['public_key'] ?? ''), true);
        if ($publicKey === false || strlen($publicKey) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) {
            $this->refuse(422, 'bad_key', 'The Guardian sent an invalid key.');
        }

        $installId = strtolower((string) ($input['install_id'] ?? ''));
        if (! Str::isUuid($installId)) {
            $this->refuse(422, 'bad_install', 'The Guardian sent an invalid installation id.');
        }

        $version = mb_substr((string) ($input['version'] ?? '0.0.0'), 0, 24);
        $exe = strtolower((string) ($input['exe_sha256'] ?? ''));
        $exe = preg_match('/^[a-f0-9]{64}$/', $exe) ? $exe : null;

        $allowed = array_map('strtolower', (array) config('integrity.guardian.allowed_builds', []));
        if ($allowed !== [] && ($exe === null || ! in_array($exe, $allowed, true))) {
            $this->refuse(403, 'guardian_build_not_allowed', 'This copy of the Guardian is not an official build. Download it again from the exam page.');
        }
        if (version_compare($version, (string) config('integrity.guardian.min_version', '1.0.0'), '<')) {
            $this->refuse(426, 'guardian_outdated', 'This Guardian is out of date. Download the latest version from the exam page.');
        }

        return DB::transaction(function () use ($user, $publicKey, $installId, $version, $exe, $input) {
            $install = GuardianInstall::where('install_id', $installId)->lockForUpdate()->first();

            if ($install !== null) {
                if ($install->isRevoked()) {
                    $this->refuse(403, 'guardian_revoked', 'This Guardian installation has been disabled.');
                }
                // The key of an installation never changes; a different key under the same id is a copy trying to impersonate it.
                if (! hash_equals((string) $install->public_key, base64_encode($publicKey))) {
                    $this->refuse(409, 'key_mismatch', 'This installation id is already registered to another key. Reinstall the Guardian.');
                }
                $install->forceFill(['user_id' => $user->id, 'version' => $version, 'exe_sha256' => $exe, 'last_seen_at' => now()])->save();
            } else {
                $install = GuardianInstall::create([
                    'user_id' => $user->id,
                    'install_id' => $installId,
                    'public_key' => base64_encode($publicKey),
                    'platform' => mb_substr((string) ($input['platform'] ?? 'windows'), 0, 24),
                    'version' => $version,
                    'exe_sha256' => $exe,
                    'machine' => is_array($input['machine'] ?? null) ? $this->limit($input['machine'], 0) : null,
                    'first_seen_at' => now(),
                    'last_seen_at' => now(),
                ]);
            }

            // One live link per student: pairing again retires the previous one.
            GuardianLink::where('user_id', $user->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);

            $token = Str::random(48);
            $link = GuardianLink::create([
                'user_id' => $user->id,
                'guardian_install_id' => $install->id,
                'token_hash' => hash('sha256', $token),
                'paired_at' => now(),
                'last_beat_at' => null,
                'last_seq' => 0,
                'expires_at' => now()->addHours(self::LINK_TTL_HOURS),
            ]);

            return [
                'token' => $token,
                'link_id' => $link->id,
                'expires_at' => $link->expires_at->toIso8601String(),
                'user' => ['name' => $user->name],
                'policy' => $this->policy(),
            ];
        });
    }

    // ── every report afterwards ─────────────────────────────────────────────────────────────────────────────────────

    /**
     * Authenticates one report: bearer token → link; Ed25519 signature over (link id | seq | SHA-256 of the exact body).
     *
     * @return array{0: GuardianLink, 1: array<string, mixed>}
     */
    public function authenticate(Request $request): array
    {
        $this->assertSodium();

        $token = $request->bearerToken();
        if (! is_string($token) || $token === '') {
            $this->refuse(401, 'missing_token', 'Guardian token required.');
        }

        /** @var GuardianLink|null $link */
        $link = GuardianLink::with('install')->where('token_hash', hash('sha256', $token))->first();
        if ($link === null || ! $link->isUsable() || $link->install === null) {
            $this->refuse(401, 'link_invalid', 'This Guardian link is no longer valid. Pair the Guardian again.');
        }
        if ($link->install->isRevoked()) {
            $this->refuse(403, 'guardian_revoked', 'This Guardian installation has been disabled.');
        }

        $raw = $request->getContent();
        $body = json_decode($raw, true);
        if (! is_array($body)) {
            $this->refuse(422, 'bad_body', 'Unreadable report.');
        }

        $signature = base64_decode((string) $request->header('X-Guardian-Signature', ''), true);
        $publicKey = base64_decode((string) $link->install->public_key, true);
        $seq = (int) ($body['seq'] ?? 0);

        $valid = $signature !== false && $publicKey !== false
            && strlen($signature) === SODIUM_CRYPTO_SIGN_BYTES
            && sodium_crypto_sign_verify_detached($signature, $link->id.'|'.$seq.'|'.hash('sha256', $raw), $publicKey);

        if (! $valid) {
            $this->refuse(401, 'bad_signature', 'Report signature is not valid.');
        }

        if ($seq <= $link->last_seq) {
            $this->refuse(409, 'replayed', 'Report out of sequence.', ['last_seq' => $link->last_seq]);
        }

        return [$link, $body];
    }

    public function activeLinkFor(User $user): ?GuardianLink
    {
        return GuardianLink::with('install')
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();
    }

    public function revokeFor(User $user): void
    {
        GuardianLink::where('user_id', $user->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    // ── what the page needs to know ─────────────────────────────────────────────────────────────────────────────────

    /**
     * Pre-flight problems the Guardian currently reports, in words a student can act on.
     *
     * @return list<array{type: string, title: string, fix: string, detail: ?string}>
     */
    public function blockers(?GuardianLink $link): array
    {
        $out = [];

        foreach ((array) ($link?->state['blockers'] ?? []) as $b) {
            $type = is_array($b) ? (string) ($b['type'] ?? '') : '';
            if (! in_array($type, EventCatalog::PREFLIGHT_BLOCKERS, true) || ! isset(self::BLOCKER_TEXT[$type])) {
                continue;
            }

            $detail = trim(implode(' — ', array_filter([
                is_string($b['name'] ?? null) ? $b['name'] : null,
                is_string($b['category'] ?? null) ? (string) config("integrity.guardian.categories.{$b['category']}.label", $b['category']) : null,
            ])));

            $out[] = ['type' => $type, 'title' => self::BLOCKER_TEXT[$type][0], 'fix' => self::BLOCKER_TEXT[$type][1], 'detail' => $detail !== '' ? $detail : null];
        }

        return array_slice($out, 0, 12);
    }

    /**
     * @param  array<string, mixed>  $profile
     * @return array<string, mixed>
     */
    public function summary(User $user, array $profile, ?GuardianLink $link): array
    {
        $version = (string) ($link?->state['version'] ?? $link?->install?->version ?? '');

        return [
            'mode' => (string) $profile['guardian'],
            'connected' => $link?->isFresh() ?? false,
            'version' => $version !== '' ? $version : null,
            'outdated' => $version !== '' && version_compare($version, (string) config('integrity.guardian.min_version', '1.0.0'), '<'),
            'blockers' => $link?->isFresh() ? $this->blockers($link) : [],
            'download_url' => $this->downloadUrl(),
            'download' => $this->downloadInfo(),
        ];
    }

    // ── the installer students download ─────────────────────────────────────────────────────────────────────────────

    public function packagePath(): string
    {
        return (string) config('integrity.guardian.package_path', '');
    }

    /**
     * The installer this server holds, if any. The hash is of the very file that will be served (cached by size + mtime), so what
     * the page shows is what the student gets; `version` is optional, from a `<name>.json` next to the program (build.ps1 writes it).
     *
     * @return array{size: int, sha256: string, version: ?string}|null
     */
    public function package(): ?array
    {
        $path = $this->packagePath();
        if ($path === '' || ! is_file($path)) {
            return null;
        }

        $size = (int) filesize($path);
        $sha = Cache::remember('guardian:package:'.md5($path).':'.$size.':'.(int) filemtime($path), 3600, fn () => (string) hash_file('sha256', $path));

        $version = null;
        $meta = dirname($path).DIRECTORY_SEPARATOR.pathinfo($path, PATHINFO_FILENAME).'.json';
        if (is_file($meta) && filesize($meta) < 4096) {
            $decoded = json_decode((string) file_get_contents($meta), true);
            $v = is_array($decoded) ? ($decoded['version'] ?? null) : null;
            $version = is_string($v) && preg_match('/^\d+\.\d+\.\d+$/', $v) === 1 ? $v : null;
        }

        return ['size' => $size, 'sha256' => $sha, 'version' => $version];
    }

    /** An address set by the operator wins; otherwise our own download route, but only if there is something to download. */
    public function downloadUrl(): string
    {
        $override = trim((string) config('integrity.guardian.download_url', ''));
        if ($override !== '') {
            return $override;
        }

        return $this->package() !== null ? url('/api/guardian/download') : '';
    }

    /** What the page can say about the download. Only for OUR file: if the operator hosts it elsewhere we know nothing about it. */
    private function downloadInfo(): ?array
    {
        return trim((string) config('integrity.guardian.download_url', '')) === '' ? $this->package() : null;
    }

    // ── what the Guardian is told ───────────────────────────────────────────────────────────────────────────────────

    public function policyVersion(): string
    {
        return (string) config('integrity_denylist.version', '0');
    }

    /** @return array<string, mixed> */
    public function policy(): array
    {
        return [
            'version' => $this->policyVersion(),
            'beat_ms' => 5000, // events are sent as soon as they happen; this is the heartbeat between them
            // Public-key hashes of the certificates our server uses; the Guardian reports a chain that contains none of them as HTTPS interception.
            'tls_pins' => array_values((array) config('integrity.guardian.tls_pins', [])),
            'processes' => array_values((array) config('integrity_denylist.processes', [])),
            'strings' => array_values((array) config('integrity_denylist.strings', [])),
            'titles' => array_values((array) config('integrity_denylist.titles', [])),
            'overlay_allowed' => array_values((array) config('integrity_denylist.overlay_allowed', [])),
            'browsers' => array_values((array) config('integrity_denylist.browsers', [])),
            'categories' => collect((array) config('integrity.guardian.categories', []))->map(fn ($c) => ['strike' => (int) $c['strike']])->all(),
        ];
    }

    /**
     * The Guardian's state snapshot, reduced to known keys with bounded sizes. Everything a reviewer or a blocker check
     * reads comes from here — never a raw client object.
     *
     * @return array<string, mixed>
     */
    public function cleanState(mixed $state): array
    {
        if (! is_array($state)) {
            return [];
        }

        $keys = ['version', 'exe_sha256', 'os', 'foreground', 'exam_window', 'monitors', 'vm', 'remote', 'network', 'blockers', 'tz', 'locale', 'uptime_s', 'clipboard_seq', 'procs', 'drives', 'input_devices'];
        $out = [];
        foreach ($keys as $k) {
            if (array_key_exists($k, $state)) {
                $out[$k] = $this->limit($state[$k], 0);
            }
        }

        return $out;
    }

    /** Bounded depth, breadth and string length. */
    private function limit(mixed $value, int $depth): mixed
    {
        if (is_string($value)) {
            return mb_substr($value, 0, 200);
        }
        if (is_array($value)) {
            if ($depth >= 4) {
                return null;
            }
            $out = [];
            foreach (array_slice($value, 0, 40, true) as $k => $v) {
                $out[is_string($k) ? mb_substr($k, 0, 48) : $k] = $this->limit($v, $depth + 1);
            }

            return $out;
        }

        return is_scalar($value) || $value === null ? $value : null;
    }

    /** Ed25519 verification needs PHP's sodium extension (bundled with PHP since 7.2; some Windows/XAMPP builds ship it switched off). */
    private function assertSodium(): void
    {
        if (! function_exists('sodium_crypto_sign_verify_detached')) {
            $this->refuse(503, 'sodium_missing', 'The server cannot verify Guardian reports: the sodium extension of PHP is not enabled.');
        }
    }

    /** @param  array<string, mixed>  $extra */
    private function refuse(int $status, string $code, string $message, array $extra = []): never
    {
        throw new HttpResponseException(response()->json(['message' => $message, 'code' => $code] + $extra, $status));
    }
}
