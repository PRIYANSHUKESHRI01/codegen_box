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
            'mellow_vault_profile_percent' => $user->mellow_vault_profile_percent ?? 0,
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

        if (! Cache::has($cacheKey) && $this->sync->isConfigured()) {
            $this->sync->syncSingleUser($user, dispatchInviteIfEligible: true);
            $user->refresh();
            Cache::put($cacheKey, true, 60);
        }

        $pct = (int) ($user->mellow_vault_profile_percent ?? 0);
        $stackKey = $user->mellow_vault_stack_key;
        $directUrl = $stackKey
            ? '/dashboard/vault-interviews?stack='.urlencode($stackKey)
            : '/dashboard/vault-interviews';

        return response()->json([
            'profile_percent' => $pct,
            'threshold' => MellowVaultProfileSyncService::DEFAULT_THRESHOLD,
            'hit_90' => $pct >= MellowVaultProfileSyncService::DEFAULT_THRESHOLD,
            'pro_id' => $user->mellow_vault_pro_id,
            'stack_key' => $stackKey,
            'stack_name' => $user->mellow_vault_stack_name,
            'synced_at' => $user->mellow_vault_profile_synced_at?->toIso8601String(),
            'invite_sent_at' => $user->vault_ai_invite_sent_at?->toIso8601String(),
            'direct_url' => $directUrl,
        ]);
    }

    /**
     * POST /api/vault/sync/profile-completion
     *
     * Optional real-time webhook/push endpoint for Mellow Vault backend when a developer's
     * `profile_complete` changes or crosses 90%, or to sync a single developer on demand.
     */
    public function pushFromMellowVault(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'email' => ['nullable', 'email'],
            'dev_id' => ['nullable', 'integer'],
            'profile_complete' => ['nullable', 'integer', 'min:0', 'max:100'],
            'pro_id' => ['nullable', 'integer', 'min:0'],
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

        if (isset($validated['profile_complete']) && $this->isTrustedPush($request)) {
            $headings = $this->sync->headingMap();
            $result = $this->sync->applyDeveloperRow(
                $user,
                [
                    'dev_id' => $validated['dev_id'] ?? $user->mellow_vault_dev_id,
                    'pro_id' => $validated['pro_id'] ?? $user->mellow_vault_pro_id,
                    'profile_complete' => (int) $validated['profile_complete'],
                ],
                $headings,
                MellowVaultProfileSyncService::DEFAULT_THRESHOLD,
                dispatchEmail: true,
                syncDispatch: false,
                dryRun: false
            );

            return response()->json([
                'synced' => true,
                'user_id' => $user->id,
                'profile_percent' => $result['profile_percent'],
                'stack_key' => $result['stack_key'],
                'stack_name' => $result['stack_name'],
                'invite_dispatched' => $result['invited'],
            ]);
        }

        $res = $this->sync->syncSingleUser($user, dispatchInviteIfEligible: true);

        return response()->json(['synced' => true, 'user_id' => $user->id] + $res);
    }

    /**
     * GET /api/admin/mellow-vault/profile-invites
     */
    public function adminIndex(): JsonResponse
    {
        $invites = VaultInterviewInvite::with('user:id,name,email,mellow_vault_profile_percent,mellow_vault_stack_key')
            ->latest('id')
            ->limit(100)
            ->get();

        $summary = [
            'configured' => $this->sync->isConfigured(),
            'mappings_count' => MellowVaultStackMapping::count(),
            'synced_users' => User::whereNotNull('mellow_vault_profile_synced_at')->count(),
            'users_90_plus' => User::where('mellow_vault_profile_percent', '>=', 90)->count(),
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

        if ($apiKey !== '' && hash_equals($apiKey, (string) $request->bearerToken())) {
            return true;
        }

        if ($syncSecret !== '' && hash_equals($syncSecret, (string) $request->header('X-Vault-Secret', ''))) {
            return true;
        }

        return $apiKey === '' && $syncSecret === '' && $this->sync->isConfigured();
    }
}
