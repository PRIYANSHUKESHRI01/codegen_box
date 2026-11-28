<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ConfirmsSuperadminPassword;
use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Models\ActivityLog;
use App\Models\SuperadminLoginLog;
use App\Models\SuperadminTrustedDevice;
use App\Models\User;
use App\Services\Security\SuperadminLoginTelemetryService;
use App\Support\SingleMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin Account Lifecycle & Login Security Telemetry.
 *
 * Allows an authenticated superadmin to:
 *  - View all superadmin accounts with their latest IP, network, browser, laptop & device-binding status
 *  - Create another superadmin account (requires the creator's own password confirmation)
 *  - Delete another superadmin account safely (cannot delete self or the last active superadmin;
 *    reassigns owned platform content so nothing cascades away, and preserves security logs)
 *  - Inspect full login telemetry (IP, ISP/ASN, Geo, Network type, Browser, OS, Laptop/GPU/Hardware,
 *    Client Hints, and deterministic Device Fingerprint) across all superadmin accounts
 *  - Manage Trusted Laptops & IPs and toggle strict device/IP enforcement per superadmin account
 */
class SuperAdminManagementController extends Controller
{
    use ConfirmsSuperadminPassword;

    public function __construct(
        private readonly SuperadminLoginTelemetryService $telemetry,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->where('role', User::ROLE_SUPERADMIN)
            ->withCount([
                'tokens as active_sessions_count',
                'trustedDevices as trusted_devices_count' => fn ($q) => $q->where('is_active', true),
                'superadminLoginLogs as login_logs_count',
            ])
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('handle', 'like', "%{$search}%");
            });
        }

        $superadmins = $query->get();
        $ids = $superadmins->pluck('id')->all();

        $latestSuccessfulByUser = collect();
        $latestAnyByUser = collect();

        if ($ids !== [] && Schema::hasTable('superadmin_login_logs')) {
            $latestSuccessfulByUser = SuperadminLoginLog::query()
                ->whereIn('user_id', $ids)
                ->where('event', SuperadminLoginLog::EVENT_LOGIN)
                ->orderByDesc('id')
                ->get()
                ->unique('user_id')
                ->keyBy('user_id');

            $latestAnyByUser = SuperadminLoginLog::query()
                ->whereIn('user_id', $ids)
                ->orderByDesc('id')
                ->get()
                ->unique('user_id')
                ->keyBy('user_id');
        }

        $activeCount = $superadmins->where('is_blocked', false)->count();
        $since24h = now()->subHours(24);
        $since30d = now()->subDays(30);

        $summary = [
            'total' => $superadmins->count(),
            'active' => $activeCount,
            'blocked' => $superadmins->where('is_blocked', true)->count(),
            'strict_locked' => $superadmins->where('enforce_trusted_login', true)->count(),
            'logins_24h' => Schema::hasTable('superadmin_login_logs')
                ? SuperadminLoginLog::where('event', SuperadminLoginLog::EVENT_LOGIN)->where('created_at', '>=', $since24h)->count()
                : 0,
            'failed_24h' => Schema::hasTable('superadmin_login_logs')
                ? SuperadminLoginLog::whereIn('event', [
                    SuperadminLoginLog::EVENT_LOGIN_FAILED,
                    SuperadminLoginLog::EVENT_LOGIN_BLOCKED,
                    SuperadminLoginLog::EVENT_LOGIN_REJECTED_DEVICE_IP,
                ])->where('created_at', '>=', $since24h)->count()
                : 0,
            'unique_ips_30d' => Schema::hasTable('superadmin_login_logs')
                ? SuperadminLoginLog::where('event', SuperadminLoginLog::EVENT_LOGIN)
                    ->where('created_at', '>=', $since30d)
                    ->whereNotNull('ip_address')
                    ->distinct('ip_address')
                    ->count('ip_address')
                : 0,
            'unique_devices_30d' => Schema::hasTable('superadmin_login_logs')
                ? SuperadminLoginLog::where('event', SuperadminLoginLog::EVENT_LOGIN)
                    ->where('created_at', '>=', $since30d)
                    ->whereNotNull('device_fingerprint')
                    ->distinct('device_fingerprint')
                    ->count('device_fingerprint')
                : 0,
        ];

        $meId = $request->user()->id;

        $rows = $superadmins->map(function (User $u) use ($latestSuccessfulByUser, $latestAnyByUser, $meId, $activeCount) {
            $lastLogin = $latestSuccessfulByUser->get($u->id);
            $lastEvent = $latestAnyByUser->get($u->id);

            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'handle' => $u->handle,
                'phone' => $u->phone,
                'avatar_url' => $u->avatar_url,
                'is_blocked' => (bool) $u->is_blocked,
                'blocked_reason' => $u->blocked_reason,
                'blocked_at' => $u->blocked_at,
                'enforce_trusted_login' => (bool) $u->enforce_trusted_login,
                'active_sessions_count' => (int) $u->active_sessions_count,
                'trusted_devices_count' => (int) $u->trusted_devices_count,
                'login_logs_count' => (int) $u->login_logs_count,
                'last_seen_at' => $u->last_seen_at,
                'created_at' => $u->created_at,
                'is_self' => $u->id === $meId,
                'can_delete' => $u->id !== $meId && ($u->is_blocked || $activeCount > 1),
                'last_login' => $lastLogin ? $this->serializeLog($lastLogin) : null,
                'last_event' => $lastEvent ? $this->serializeLog($lastEvent) : null,
            ];
        })->values();

        return response()->json([
            'superadmins' => $rows,
            'summary' => $summary,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'handle' => ['nullable', 'string', 'max:64', 'alpha_dash', 'unique:users,handle'],
            'phone' => ['nullable', 'string', 'max:20'],
            'initial_password' => ['nullable', 'string', 'min:8', 'max:72'],
            'send_email' => ['sometimes', 'boolean'],
            'password' => ['required', 'string'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        $chosen = isset($validated['initial_password']) && $validated['initial_password'] !== '';
        $plainPassword = $chosen ? $validated['initial_password'] : Str::password(16);

        if (strcasecmp($plainPassword, $validated['email']) === 0) {
            throw ValidationException::withMessages([
                'initial_password' => ['The initial password cannot be the same as the login email.'],
            ]);
        }

        $handle = isset($validated['handle']) && trim($validated['handle']) !== ''
            ? trim($validated['handle'])
            : $this->uniqueHandle($validated['name'], $validated['email']);

        $created = User::create([
            'name' => trim($validated['name']),
            'email' => mb_strtolower(trim($validated['email'])),
            'handle' => $handle,
            'phone' => isset($validated['phone']) && trim($validated['phone']) !== '' ? trim($validated['phone']) : null,
            'password' => Hash::make($plainPassword),
            // Superadmins do not use the self-service OTP reset flow (PasswordResetService skips superadmin),
            // so they sign in directly at /mellow-internal and can update their password in Settings.
            'must_change_password' => false,
            'role' => User::ROLE_SUPERADMIN,
        ]);

        $emailed = $request->boolean('send_email')
            ? SingleMail::now(new SendAccountCredentialsEmail($created->id, $plainPassword))
            : false;

        ActivityLog::record(
            $request->user(),
            'Created a superadmin account',
            'User',
            $created->name,
            [
                'user_id' => $created->id,
                'email' => $created->email,
                'role' => User::ROLE_SUPERADMIN,
                'emailed' => $emailed,
            ]
        );

        return response()->json([
            'superadmin' => [
                'id' => $created->id,
                'name' => $created->name,
                'email' => $created->email,
                'handle' => $created->handle,
                'phone' => $created->phone,
                'role' => $created->role,
                'is_blocked' => false,
                'enforce_trusted_login' => false,
                'created_at' => $created->created_at,
            ],
            'initial_password' => $plainPassword,
            'credentials_email_sent' => $emailed,
        ], 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->ensureSuperadminTarget($user);

        $tokens = $user->tokens()
            ->orderByDesc('last_used_at')
            ->get(['id', 'name', 'created_at', 'last_used_at']);

        $tokenLogs = $tokens->isNotEmpty() && Schema::hasTable('superadmin_login_logs')
            ? SuperadminLoginLog::where('user_id', $user->id)
                ->whereIn('token_id', $tokens->pluck('id'))
                ->orderByDesc('id')
                ->get()
                ->unique('token_id')
                ->keyBy('token_id')
            : collect();

        $sessions = $tokens->map(function ($token) use ($tokenLogs) {
            $log = $tokenLogs->get($token->id);

            return [
                'id' => $token->id,
                'name' => $token->name,
                'created_at' => $token->created_at,
                'last_used_at' => $token->last_used_at,
                'login_context' => $log ? $this->serializeLog($log) : null,
            ];
        })->values();

        $recentLogs = Schema::hasTable('superadmin_login_logs')
            ? SuperadminLoginLog::where('user_id', $user->id)
                ->orderByDesc('id')
                ->limit(100)
                ->get()
                ->map(fn (SuperadminLoginLog $l) => $this->serializeLog($l))
                ->values()
            : collect();

        $trustedDevices = Schema::hasTable('superadmin_trusted_devices')
            ? $user->trustedDevices()
                ->with('addedBy:id,name')
                ->get()
                ->map(fn (SuperadminTrustedDevice $d) => $this->serializeTrustedDevice($d))
                ->values()
            : collect();

        $activeCount = User::where('role', User::ROLE_SUPERADMIN)->where('is_blocked', false)->count();

        return response()->json([
            'superadmin' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'handle' => $user->handle,
                'phone' => $user->phone,
                'avatar_url' => $user->avatar_url,
                'is_blocked' => (bool) $user->is_blocked,
                'blocked_reason' => $user->blocked_reason,
                'blocked_at' => $user->blocked_at,
                'enforce_trusted_login' => (bool) $user->enforce_trusted_login,
                'last_seen_at' => $user->last_seen_at,
                'created_at' => $user->created_at,
                'is_self' => $user->id === $request->user()->id,
                'can_delete' => $user->id !== $request->user()->id && ($user->is_blocked || $activeCount > 1),
            ],
            'sessions' => $sessions,
            'login_logs' => $recentLogs,
            'trusted_devices' => $trustedDevices,
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->ensureSuperadminTarget($user);

        $validated = $request->validate([
            'password' => ['required', 'string'],
            'confirm_email' => ['required', 'string'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        $actor = $request->user();

        if ($user->id === $actor->id) {
            throw ValidationException::withMessages([
                'user' => ['You cannot delete your own superadmin account.'],
            ]);
        }

        if (! $user->is_blocked) {
            $anotherActiveExists = User::where('role', User::ROLE_SUPERADMIN)
                ->where('id', '!=', $user->id)
                ->where('is_blocked', false)
                ->exists();

            if (! $anotherActiveExists) {
                throw ValidationException::withMessages([
                    'user' => ['Cannot delete the last active superadmin account.'],
                ]);
            }
        }

        if (! hash_equals(mb_strtolower($user->email), mb_strtolower(trim($validated['confirm_email'])))) {
            throw ValidationException::withMessages([
                'confirm_email' => ['The email you typed does not match this account. Type it exactly.'],
            ]);
        }

        $snapshot = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];

        DB::transaction(function () use ($user, $actor) {
            // Reassign non-nullable cascadeOnDelete platform authorship so deleting a superadmin
            // never destroys platform assessments, launchpad programs, or other curated content.
            foreach (['college_assessments', 'launchpad_programs'] as $table) {
                if (Schema::hasTable($table) && Schema::hasColumn($table, 'created_by')) {
                    DB::table($table)->where('created_by', $user->id)->update(['created_by' => $actor->id]);
                }
            }

            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $user->id)
                ->delete();

            if (Schema::hasTable('superadmin_trusted_devices')) {
                DB::table('superadmin_trusted_devices')->where('user_id', $user->id)->delete();
            }

            if (Schema::hasTable('user_notifications')) {
                DB::table('user_notifications')->where('user_id', $user->id)->delete();
            }

            // superadmin_login_logs.user_id is nullOnDelete() so forensic login logs remain intact.
            User::whereKey($user->id)->delete();
        });

        ActivityLog::record(
            $actor,
            'Permanently deleted a superadmin account',
            'User',
            $snapshot['name'],
            [
                'user_id' => $snapshot['id'],
                'email' => $snapshot['email'],
                'role' => User::ROLE_SUPERADMIN,
            ]
        );

        return response()->json(['deleted' => true]);
    }

    public function loginLogs(Request $request): JsonResponse
    {
        if (! Schema::hasTable('superadmin_login_logs')) {
            return response()->json([
                'data' => [],
                'current_page' => 1,
                'last_page' => 1,
                'total' => 0,
            ]);
        }

        $query = SuperadminLoginLog::query()
            ->with('user:id,name,email,is_blocked')
            ->orderByDesc('id');

        if ($userId = $request->integer('user_id')) {
            $query->where('user_id', $userId);
        }

        if (($event = $request->query('event')) && is_string($event) && $event !== 'all') {
            $query->where('event', $event);
        }

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('email', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhere('device_label', 'like', "%{$search}%")
                    ->orWhere('device_fingerprint', 'like', "%{$search}%")
                    ->orWhere('browser', 'like', "%{$search}%")
                    ->orWhere('os', 'like', "%{$search}%")
                    ->orWhere('gpu_renderer', 'like', "%{$search}%")
                    ->orWhere('isp', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhere('country', 'like', "%{$search}%");
            });
        }

        $perPage = max(10, min($request->integer('per_page', 30), 100));
        $page = $query->paginate($perPage);

        $page->getCollection()->transform(fn (SuperadminLoginLog $log) => $this->serializeLog($log));

        return response()->json($page);
    }

    public function addTrustedDevice(Request $request, User $user): JsonResponse
    {
        $this->ensureSuperadminTarget($user);

        $validated = $request->validate([
            'password' => ['required', 'string'],
            'label' => ['required', 'string', 'max:120'],
            'ip_address' => ['nullable', 'string', 'max:45'],
            'device_fingerprint' => ['nullable', 'string', 'max:128'],
            'device_id' => ['nullable', 'string', 'max:128'],
            'browser' => ['nullable', 'string', 'max:64'],
            'os' => ['nullable', 'string', 'max:64'],
            'gpu_renderer' => ['nullable', 'string', 'max:255'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        $ip = isset($validated['ip_address']) ? trim($validated['ip_address']) : null;
        $ip = $ip === '' ? null : $ip;
        $fingerprint = isset($validated['device_fingerprint']) ? trim($validated['device_fingerprint']) : null;
        $fingerprint = $fingerprint === '' ? null : $fingerprint;
        $deviceId = isset($validated['device_id']) ? trim($validated['device_id']) : null;
        $deviceId = $deviceId === '' ? null : $deviceId;

        if ($ip === null && $fingerprint === null && $deviceId === null) {
            throw ValidationException::withMessages([
                'ip_address' => ['Provide at least an IP/CIDR address or a laptop device fingerprint.'],
            ]);
        }

        if ($ip !== null && ! $this->isValidIpOrCidr($ip)) {
            throw ValidationException::withMessages([
                'ip_address' => ['Enter a valid IPv4/IPv6 address or CIDR range (e.g. 203.0.113.5 or 203.0.113.0/24).'],
            ]);
        }

        $device = SuperadminTrustedDevice::create([
            'user_id' => $user->id,
            'label' => trim($validated['label']),
            'ip_address' => $ip,
            'device_fingerprint' => $fingerprint,
            'device_id' => $deviceId,
            'browser' => $validated['browser'] ?? null,
            'os' => $validated['os'] ?? null,
            'gpu_renderer' => $validated['gpu_renderer'] ?? null,
            'is_active' => true,
            'added_by' => $request->user()->id,
        ]);

        ActivityLog::record(
            $request->user(),
            'Added trusted laptop/IP rule for superadmin',
            'User',
            $user->name,
            [
                'user_id' => $user->id,
                'trusted_device_id' => $device->id,
                'label' => $device->label,
                'ip_address' => $device->ip_address,
                'has_fingerprint' => $device->device_fingerprint !== null,
            ]
        );

        return response()->json([
            'device' => $this->serializeTrustedDevice($device->load('addedBy:id,name')),
        ], 201);
    }

    public function removeTrustedDevice(Request $request, User $user, SuperadminTrustedDevice $device): JsonResponse
    {
        $this->ensureSuperadminTarget($user);

        if ($device->user_id !== $user->id) {
            abort(404);
        }

        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        if ($user->enforce_trusted_login) {
            $remainingActive = $user->trustedDevices()
                ->where('is_active', true)
                ->where('id', '!=', $device->id)
                ->exists();

            if (! $remainingActive) {
                throw ValidationException::withMessages([
                    'device' => ['Disable strict laptop/IP lock before removing the last trusted rule, otherwise this account would be locked out.'],
                ]);
            }
        }

        $label = $device->label;
        $device->delete();

        ActivityLog::record(
            $request->user(),
            'Removed trusted laptop/IP rule for superadmin',
            'User',
            $user->name,
            ['user_id' => $user->id, 'label' => $label]
        );

        return response()->json(['removed' => true]);
    }

    public function updateSecurityPolicy(Request $request, User $user): JsonResponse
    {
        $this->ensureSuperadminTarget($user);

        $validated = $request->validate([
            'password' => ['required', 'string'],
            'enforce_trusted_login' => ['required', 'boolean'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        $enforce = (bool) $validated['enforce_trusted_login'];

        if ($enforce && ! $user->trustedDevices()->where('is_active', true)->exists()) {
            throw ValidationException::withMessages([
                'enforce_trusted_login' => ['Add at least one trusted laptop or IP rule before enabling strict login lock.'],
            ]);
        }

        $user->forceFill(['enforce_trusted_login' => $enforce])->save();

        ActivityLog::record(
            $request->user(),
            $enforce ? 'Enabled strict laptop & IP lock for superadmin' : 'Disabled strict laptop & IP lock for superadmin',
            'User',
            $user->name,
            ['user_id' => $user->id, 'enforce_trusted_login' => $enforce]
        );

        return response()->json([
            'enforce_trusted_login' => (bool) $user->enforce_trusted_login,
        ]);
    }

    public function revokeSession(Request $request, User $user, int $tokenId): JsonResponse
    {
        $this->ensureSuperadminTarget($user);

        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        $currentTokenId = $request->user()->currentAccessToken()?->id;
        if ($user->id === $request->user()->id && $tokenId === $currentTokenId) {
            throw ValidationException::withMessages([
                'session' => ['You cannot revoke your own active session from here. Sign out instead.'],
            ]);
        }

        $deleted = $user->tokens()->where('id', $tokenId)->delete();
        if (! $deleted) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        ActivityLog::record(
            $request->user(),
            'Revoked a superadmin session token',
            'User',
            $user->name,
            ['user_id' => $user->id, 'token_id' => $tokenId]
        );

        return response()->json(['revoked' => true]);
    }

    private function ensureSuperadminTarget(User $user): void
    {
        if ($user->role !== User::ROLE_SUPERADMIN) {
            abort(404, 'Superadmin account not found.');
        }
    }

    private function isValidIpOrCidr(string $value): bool
    {
        if (filter_var($value, FILTER_VALIDATE_IP) !== false) {
            return true;
        }

        if (! str_contains($value, '/')) {
            return false;
        }

        [$ip, $prefix] = explode('/', $value, 2);
        if (! is_numeric($prefix)) {
            return false;
        }

        $prefixInt = (int) $prefix;
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            return $prefixInt >= 0 && $prefixInt <= 32;
        }

        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
            return $prefixInt >= 0 && $prefixInt <= 128;
        }

        return false;
    }

    private function uniqueHandle(string $name, string $email): string
    {
        $base = Str::slug($name, '_') ?: Str::slug(Str::before($email, '@'), '_') ?: 'superadmin';
        $base = mb_substr($base, 0, 54);
        $handle = $base;

        while (User::where('handle', $handle)->exists()) {
            $handle = $base.'_'.Str::lower(Str::random(4));
        }

        return $handle;
    }

    /** @return array<string, mixed> */
    private function serializeLog(SuperadminLoginLog $log): array
    {
        return [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'user_name' => $log->relationLoaded('user') ? $log->user?->name : null,
            'email' => $log->email,
            'event' => $log->event,
            'reason' => $log->reason,
            'portal' => $log->portal,
            'token_id' => $log->token_id,
            'ip_address' => $log->ip_address,
            'forwarded_for' => $log->forwarded_for,
            'is_private_ip' => (bool) $log->is_private_ip,
            'hostname' => $log->hostname,
            'isp' => $log->isp,
            'asn' => $log->asn,
            'network_org' => $log->network_org,
            'city' => $log->city,
            'region' => $log->region,
            'country' => $log->country,
            'country_code' => $log->country_code,
            'network_type' => $log->network_type,
            'effective_type' => $log->effective_type,
            'downlink_mbps' => $log->downlink_mbps,
            'rtt_ms' => $log->rtt_ms,
            'device_fingerprint' => $log->device_fingerprint,
            'device_id' => $log->device_id,
            'device_type' => $log->device_type,
            'device_label' => $log->device_label,
            'os' => $log->os,
            'os_version' => $log->os_version,
            'browser' => $log->browser,
            'browser_version' => $log->browser_version,
            'platform' => $log->platform,
            'architecture' => $log->architecture,
            'cpu_cores' => $log->cpu_cores,
            'device_memory_gb' => $log->device_memory_gb,
            'gpu_vendor' => $log->gpu_vendor,
            'gpu_renderer' => $log->gpu_renderer,
            'screen_resolution' => $log->screen_resolution,
            'timezone' => $log->timezone,
            'language' => $log->language,
            'user_agent' => $log->user_agent,
            'client_hints' => $log->client_hints,
            'raw_telemetry' => $log->raw_telemetry,
            'created_at' => $log->created_at,
        ];
    }

    /** @return array<string, mixed> */
    private function serializeTrustedDevice(SuperadminTrustedDevice $device): array
    {
        return [
            'id' => $device->id,
            'user_id' => $device->user_id,
            'label' => $device->label,
            'device_fingerprint' => $device->device_fingerprint,
            'device_id' => $device->device_id,
            'ip_address' => $device->ip_address,
            'browser' => $device->browser,
            'os' => $device->os,
            'gpu_renderer' => $device->gpu_renderer,
            'is_active' => (bool) $device->is_active,
            'added_by' => $device->relationLoaded('addedBy') ? $device->addedBy?->name : null,
            'last_matched_at' => $device->last_matched_at,
            'created_at' => $device->created_at,
        ];
    }
}
