<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\MellowVaultStackMapping;
use App\Models\User;
use App\Models\VaultInterviewInvite;
use App\Services\Vault\CuratedCatalog;
use App\Services\Vault\MellowVaultProfileSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class VaultProfileSyncController extends Controller
{
    public function __construct(
        private readonly MellowVaultProfileSyncService $sync,
        private readonly CuratedCatalog $catalog,
    ) {}

    /**
     * GET /api/vault/interview-open/{user}?stack=...  (named `vault.interview.open`, signed middleware)
     *
     * One-click email landing route: verifies signature + account eligibility, stamps invite
     * `opened_at`, mints a Sanctum token, writes localStorage + cookie, and redirects directly
     * into `/dashboard/vault-interviews?stack={stack}` so the developer can start immediately.
     */
    public function openFromEmail(Request $request, User $user): Response
    {
        if ($user->is_blocked || $user->role !== User::ROLE_USER) {
            return response('This interview link is unavailable for your account.', 403);
        }

        // Refresh latest Mellow Vault snapshot if available
        $this->sync->syncSingleUser($user, dispatchInviteIfEligible: false);
        $user->refresh();

        $requestedStack = $request->query('stack');
        $stackKey = is_string($requestedStack) && $requestedStack !== '' && $this->catalog->stack($requestedStack) !== null
            ? $requestedStack
            : ($user->mellow_vault_stack_key && $this->catalog->stack($user->mellow_vault_stack_key) !== null
                ? $user->mellow_vault_stack_key
                : null);

        $now = now();
        $userUpdates = ['last_seen_at' => $now];
        if ($user->first_login_at === null) {
            $userUpdates['first_login_at'] = $now;
        }
        $user->forceFill($userUpdates)->save();

        VaultInterviewInvite::where('user_id', $user->id)
            ->whereNull('opened_at')
            ->update([
                'status' => VaultInterviewInvite::STATUS_OPENED,
                'opened_at' => $now,
            ]);

        ActivityLog::record(
            $user,
            'Opened Vault AI Interview via 90% profile invite email',
            User::class,
            $stackKey ?: 'vault-interviews',
            ['ip' => $request->ip()]
        );

        $token = $user->createToken('mellowvault_invite_link')->plainTextToken;
        $destination = $stackKey
            ? '/dashboard/vault-interviews?stack='.urlencode($stackKey)
            : '/dashboard/vault-interviews';

        $userJson = json_encode([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?? User::ROLE_USER,
            'permissions' => $user->permissions ?? null,
            'handle' => $user->handle ?? null,
            'bio' => $user->bio ?? null,
            'skills' => $user->skills ?? [],
            'profile_completion_percent' => $user->profile_completion_percent ?? 0,
            'is_mellow_vault_user' => $user->isMellowVaultUser(),
            'account_origin' => $user->isMellowVaultUser() ? 'mellow_vault' : 'aptrun',
            'mv_profile_percentage' => $user->isMellowVaultUser() ? ($user->mv_profile_percentage ?? $user->mellow_vault_profile_percent) : null,
            'mv_skill' => $user->isMellowVaultUser() ? $user->mv_skill : null,
            'mellow_vault_profile_percent' => $user->isMellowVaultUser() ? ($user->mv_profile_percentage ?? $user->mellow_vault_profile_percent) : null,
            'mellow_vault_stack_key' => $user->mellow_vault_stack_key,
            'mellow_vault_stack_name' => $user->mellow_vault_stack_name,
        ]);

        $stackLabel = e($user->mellow_vault_stack_name ?: 'Vault AI Interview');

        $html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Opening '.$stackLabel.' on AptRun...</title>
    <style>
        body { margin:0; background:#0b0f19; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; }
        .box { text-align:center; padding:2rem; }
        .spinner { width:42px; height:42px; border:3px solid rgba(255,255,255,.12); border-top-color:#6366f1; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 1.5rem; }
        @keyframes spin { to { transform:rotate(360deg); } }
        h2 { font-size:1.25rem; margin:0 0 .5rem; font-weight:700; }
        p { color:#94a3b8; font-size:.9rem; margin:0; }
    </style>
</head>
<body>
    <div class="box">
        <div class="spinner"></div>
        <h2>Opening Your '.$stackLabel.'...</h2>
        <p>Signing you into AptRun and pre-loading your track...</p>
    </div>
    <script>
        try {
            var token = '.json_encode($token).';
            var user = '.$userJson.';
            window.localStorage.setItem("aptrun_token", token);
            window.localStorage.setItem("aptrun_user", JSON.stringify(user));
            document.cookie = "aptrun_token=" + encodeURIComponent(token) + "; path=/; max-age=2592000; SameSite=Lax";
        } catch (e) {}
        window.location.replace('.json_encode($destination, JSON_UNESCAPED_SLASHES).');
    </script>
</body>
</html>';

        return response($html, 200)->header('Content-Type', 'text/html');
    }

    /**
     * GET /api/vault/profile-sync/status  (auth:sanctum)
     *
     * Returns the signed-in student's synced Mellow Vault `profile_complete` % and resolved
     * `higher_professional_tb` tech stack, refreshing live from `mellow_vault` at most once per minute.
     */
    public function myStatus(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $cacheKey = "mv-profile-sync:user:{$user->id}";

        $needsDirectSync = ($user->mv_profile_percentage !== null || filled($user->mv_skill))
            && (
                $user->mellow_vault_profile_synced_at === null
                || $user->mellow_vault_profile_percent !== $user->mv_profile_percentage
                || ($user->mv_profile_percentage >= MellowVaultProfileSyncService::DEFAULT_THRESHOLD && $user->vault_ai_invite_sent_at === null)
            );

        if ($needsDirectSync || ! Cache::has($cacheKey)) {
            $this->sync->syncSingleUser($user, dispatchInviteIfEligible: true);
            $user->refresh();
            Cache::put($cacheKey, true, 60);
        }

        $isMv = $user->isMellowVaultUser();
        $pct = $isMv ? ($user->mv_profile_percentage ?? $user->mellow_vault_profile_percent) : null;
        $stackKey = $isMv ? $user->mellow_vault_stack_key : null;

        if ($isMv) {
            VaultInterviewInvite::where('user_id', $user->id)
                ->whereNull('opened_at')
                ->update([
                    'status' => VaultInterviewInvite::STATUS_OPENED,
                    'opened_at' => now(),
                ]);
        }

        $directUrl = $stackKey
            ? '/dashboard/vault-interviews?stack='.urlencode($stackKey)
            : '/dashboard/vault-interviews';

        return response()->json([
            'is_mellow_vault_user' => $isMv,
            'account_origin' => $isMv ? 'mellow_vault' : 'aptrun',
            'profile_percent' => $pct,
            'mv_profile_percentage' => $pct,
            'mv_skill' => $isMv ? ($user->mv_skill ?? $user->mellow_vault_stack_name) : null,
            'threshold' => MellowVaultProfileSyncService::DEFAULT_THRESHOLD,
            'hit_90' => $pct !== null && $pct >= MellowVaultProfileSyncService::DEFAULT_THRESHOLD,
            'pro_id' => $isMv ? $user->mellow_vault_pro_id : null,
            'stack_key' => $stackKey,
            'stack_name' => $isMv ? $user->mellow_vault_stack_name : null,
            'synced_at' => $isMv ? $user->mellow_vault_profile_synced_at?->toIso8601String() : null,
            'invite_sent_at' => $isMv ? $user->vault_ai_invite_sent_at?->toIso8601String() : null,
            'direct_url' => $directUrl,
        ]);
    }

    /**
     * POST /api/vault/sync/profile-completion
     *
     * Real-time push endpoint for Mellow Vault / AWS production integration when a Mellow Vault developer's
     * `mv_profile_percentage` (or `profile_complete`) and `mv_skill` are synced. Once `mv_profile_percentage >= 90`,
     * automatically resolves `mv_skill` to the matching Vault AI Interview stack and dispatches the interview link.
     */
    public function pushFromMellowVault(Request $request): JsonResponse
    {
        if (! $this->isTrustedPush($request)) {
            return response()->json(['message' => 'Unauthorized Mellow Vault sync request.'], 401);
        }

        $validated = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'email' => ['nullable', 'email'],
            'dev_id' => ['nullable', 'integer'],
            'mv_profile_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
            'profile_complete' => ['nullable', 'integer', 'min:0', 'max:100'],
            'mv_skill' => ['nullable', 'string', 'max:255'],
            'skill' => ['nullable', 'string', 'max:255'],
            'skills' => ['nullable'],
            'pro_id' => ['nullable', 'integer', 'min:0'],
            'sync_dispatch' => ['nullable', 'boolean'],
        ]);

        $user = ! empty($validated['user_id'])
            ? User::find((int) $validated['user_id'])
            : (! empty($validated['email'])
                ? User::whereRaw('LOWER(email) = ?', [mb_strtolower(trim((string) $validated['email']))])->first()
                : (! empty($validated['dev_id'])
                    ? User::where('mellow_vault_dev_id', (int) $validated['dev_id'])->first()
                    : null));

        if (! $user) {
            return response()->json(['message' => 'Matching AptRun user not found.'], 404);
        }

        $incomingPct = $validated['mv_profile_percentage'] ?? $validated['profile_complete'] ?? null;
        $rawSkills = $validated['mv_skill'] ?? $validated['skill'] ?? $validated['skills'] ?? null;
        if (is_array($rawSkills)) {
            $rawSkills = implode(', ', array_filter(array_map('strval', $rawSkills)));
        }
        $incomingSkill = is_string($rawSkills) && trim($rawSkills) !== '' ? trim($rawSkills) : null;

        if ($incomingPct !== null || $incomingSkill !== null) {
            $headings = $this->sync->headingMap();
            $result = $this->sync->applyDeveloperRow(
                $user,
                [
                    'dev_id' => $validated['dev_id'] ?? $user->mellow_vault_dev_id,
                    'pro_id' => $validated['pro_id'] ?? $user->mellow_vault_pro_id,
                    'mv_profile_percentage' => $incomingPct !== null ? (int) $incomingPct : $user->mv_profile_percentage,
                    'profile_complete' => $incomingPct !== null ? (int) $incomingPct : ($user->mv_profile_percentage ?? $user->mellow_vault_profile_percent),
                    'mv_skill' => $incomingSkill ?? $user->mv_skill,
                    'skills' => $incomingSkill ?? $user->mv_skill,
                ],
                $headings,
                MellowVaultProfileSyncService::DEFAULT_THRESHOLD,
                dispatchEmail: true,
                syncDispatch: (bool) ($validated['sync_dispatch'] ?? false),
                dryRun: false
            );

            Cache::forget("mv-profile-sync:user:{$user->id}");

            return response()->json([
                'synced' => true,
                'user_id' => $user->id,
                'mv_profile_percentage' => $result['profile_percent'],
                'profile_percent' => $result['profile_percent'],
                'mv_skill' => $result['mv_skill'],
                'stack_key' => $result['stack_key'],
                'stack_name' => $result['stack_name'],
                'invite_dispatched' => $result['invited'],
            ]);
        }

        $res = $this->sync->syncSingleUser($user, dispatchInviteIfEligible: true);

        return response()->json(['synced' => true, 'user_id' => $user->id] + $res);
    }

    /**
     * POST /api/vault/sync/mv-profiles
     *
     * Batch ingestion endpoint for production Mellow Vault profile data (`mv_profile_percentage`, `mv_skill`).
     * Only updates the supplied Mellow Vault students; AptRun-native users remain `null`.
     */
    public function pushBatchFromMellowVault(Request $request): JsonResponse
    {
        if (! $this->isTrustedPush($request)) {
            return response()->json(['message' => 'Unauthorized Mellow Vault sync request.'], 401);
        }

        $validated = $request->validate([
            'students' => ['required', 'array', 'min:1', 'max:500'],
            'students.*.user_id' => ['nullable', 'integer'],
            'students.*.email' => ['nullable', 'email'],
            'students.*.dev_id' => ['nullable', 'integer'],
            'students.*.mv_profile_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
            'students.*.profile_complete' => ['nullable', 'integer', 'min:0', 'max:100'],
            'students.*.mv_skill' => ['nullable', 'string', 'max:255'],
            'students.*.skill' => ['nullable', 'string', 'max:255'],
            'students.*.pro_id' => ['nullable', 'integer', 'min:0'],
            'sync_dispatch' => ['nullable', 'boolean'],
        ]);

        $headings = $this->sync->headingMap();
        $syncDispatch = (bool) ($validated['sync_dispatch'] ?? false);
        $processed = 0;
        $invited = 0;
        $notFound = [];

        foreach ($validated['students'] as $row) {
            $user = ! empty($row['user_id'])
                ? User::find((int) $row['user_id'])
                : (! empty($row['email'])
                    ? User::whereRaw('LOWER(email) = ?', [mb_strtolower(trim((string) $row['email']))])->first()
                    : (! empty($row['dev_id'])
                        ? User::where('mellow_vault_dev_id', (int) $row['dev_id'])->first()
                        : null));

            if (! $user) {
                $notFound[] = $row['email'] ?? $row['user_id'] ?? $row['dev_id'] ?? 'unknown';
                continue;
            }

            $pct = $row['mv_profile_percentage'] ?? $row['profile_complete'] ?? $user->mv_profile_percentage;
            $skill = $row['mv_skill'] ?? $row['skill'] ?? $user->mv_skill;

            $outcome = $this->sync->applyDeveloperRow(
                $user,
                [
                    'dev_id' => $row['dev_id'] ?? $user->mellow_vault_dev_id,
                    'pro_id' => $row['pro_id'] ?? $user->mellow_vault_pro_id,
                    'mv_profile_percentage' => $pct,
                    'profile_complete' => $pct,
                    'mv_skill' => $skill,
                    'skills' => $skill,
                ],
                $headings,
                MellowVaultProfileSyncService::DEFAULT_THRESHOLD,
                dispatchEmail: true,
                syncDispatch: $syncDispatch,
                dryRun: false
            );

            $processed++;
            if ($outcome['invited']) {
                $invited++;
            }
            Cache::forget("mv-profile-sync:user:{$user->id}");
        }

        return response()->json([
            'synced' => true,
            'processed' => $processed,
            'invites_dispatched' => $invited,
            'not_found' => $notFound,
        ]);
    }

    /**
     * GET /api/admin/mellow-vault/profile-invites
     */
    public function adminIndex(): JsonResponse
    {
        $invites = VaultInterviewInvite::with('user:id,name,email,mv_profile_percentage,mv_skill,mellow_vault_profile_percent,mellow_vault_stack_key')
            ->latest('id')
            ->limit(100)
            ->get();

        $mvUsersQuery = User::where('role', User::ROLE_USER)->where(function ($q) {
            $q->whereNotNull('mv_profile_percentage')
                ->orWhereNotNull('mv_skill')
                ->orWhereNotNull('mellow_vault_dev_id')
                ->orWhereNotNull('mellow_vault_profile_synced_at');
        });

        $summary = [
            'configured' => $this->sync->isConfigured(),
            'mappings_count' => MellowVaultStackMapping::count(),
            'synced_users' => (clone $mvUsersQuery)->count(),
            'aptrun_only_users' => User::where('role', User::ROLE_USER)
                ->whereNull('mv_profile_percentage')
                ->whereNull('mv_skill')
                ->whereNull('mellow_vault_dev_id')
                ->whereNull('mellow_vault_profile_synced_at')
                ->count(),
            'users_90_plus' => User::where(function ($q) {
                $q->where('mv_profile_percentage', '>=', 90)
                    ->orWhere('mellow_vault_profile_percent', '>=', 90);
            })->count(),
            'invites_sent' => VaultInterviewInvite::whereIn('status', [VaultInterviewInvite::STATUS_SENT, VaultInterviewInvite::STATUS_OPENED])->count(),
            'invites_opened' => VaultInterviewInvite::whereNotNull('opened_at')->count(),
            'invites_queued' => VaultInterviewInvite::where('status', VaultInterviewInvite::STATUS_QUEUED)->count(),
        ];

        return response()->json([
            'summary' => $summary,
            'invites' => $invites,
        ]);
    }

    /**
     * POST /api/admin/mellow-vault/sync-profiles
     */
    public function adminSync(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'threshold' => ['nullable', 'integer', 'min:1', 'max:100'],
            'max_emails' => ['nullable', 'integer', 'min:0', 'max:500'],
        ]);

        $res = $this->sync->syncAll(
            threshold: (int) ($validated['threshold'] ?? 90),
            maxEmails: (int) ($validated['max_emails'] ?? 50)
        );

        return response()->json($res);
    }

    private function isTrustedPush(Request $request): bool
    {
        $apiKey = (string) config('vault.api_key', '');
        $syncSecret = (string) config('vault.sync_secret', '');
        $ssoSecret = (string) config('vault.sso.secret', env('APTRUN_SSO_SECRET', ''));

        $presentedKey = (string) ($request->bearerToken()
            ?: $request->header('X-Api-Key', '')
            ?: $request->header('X-Vault-Key', ''));

        if ($apiKey !== '' && $presentedKey !== '' && hash_equals($apiKey, $presentedKey)) {
            return true;
        }

        if ($syncSecret !== '' && hash_equals($syncSecret, (string) $request->header('X-Vault-Secret', ''))) {
            return true;
        }

        if ($ssoSecret !== '' && hash_equals($ssoSecret, (string) $request->header('X-SSO-Secret', ''))) {
            return true;
        }

        $actor = $request->user();
        if ($actor && $actor->isAdmin()) {
            return true;
        }

        return $apiKey === '' && $syncSecret === '';
    }
}
