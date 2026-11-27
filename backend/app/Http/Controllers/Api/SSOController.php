<?php


namespace App\Http\Controllers\Api;


use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Vault\MellowVaultProfileSyncService;
use App\Services\Vault\MellowVaultUserSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;


class SSOController extends Controller
{
    /**
     * Seamless 1-Click SSO for AptRun Next.js Frontend
     */
    public function handleSSOLogin(Request $request)
    {
        $payloadEncoded = $request->query('payload');
        $signature = $request->query('sig');


        if (!$payloadEncoded || !$signature) {
            return redirect('/login');
        }


        $secretKey = (string) config('vault.sso.secret', env('APTRUN_SSO_SECRET', 'MellowVaultAptRunSSO2026SecretKeySecureToken'));


        // 1. Signature Verify (HMAC-SHA256)
        $expectedSignature = hash_hmac('sha256', $payloadEncoded, $secretKey);
        if (!hash_equals($expectedSignature, $signature)) {
            return redirect('/login')->with('error', 'Invalid security signature.');
        }


        // 2. Decode Payload
        $payloadJson = base64_decode(strtr($payloadEncoded, '-_', '+/'));
        $data = json_decode($payloadJson, true);


        if (!$data || empty($data['email'])) {
            return redirect('/login')->with('error', 'Invalid payload.');
        }


        if (empty($data['expires_at']) || time() > $data['expires_at']) {
            return redirect('/login')->with('error', 'SSO expired.');
        }


        $email = trim(strtolower($data['email']));
        $name = $data['name'] ?? 'Candidate';


        // 3. User find or create in AptRun
        $user = User::where('email', $email)->first();
        if (!$user) {
            $user = User::create([
                'name'              => $name,
                'email'             => $email,
                'password'          => Hash::make(Str::random(32)),
                'email_verified_at' => now(),
            ]);
        }

        try {
            app(MellowVaultProfileSyncService::class)->syncSingleUser($user, dispatchInviteIfEligible: false);
            $user->refresh();
        } catch (\Throwable) {
            // Non-blocking: SSO must still sign the developer in if external DB read fails.
        }


        // 4. Generate Sanctum token for Next.js frontend
        $token = $user->createToken('mellowvault_sso')->plainTextToken;


        // 5. Determine destination
        $destination = '/dashboard';
        $requestedRedirect = is_string($data['redirect'] ?? null) ? trim($data['redirect']) : '';
        if ($requestedRedirect !== '' && str_starts_with($requestedRedirect, '/dashboard') && ! str_contains($requestedRedirect, '//')) {
            $destination = $requestedRedirect;
        } elseif ($user->role === 'superadmin') {
            $destination = '/superadmin';
        } elseif ($user->role === 'admin_internal') {
            $destination = '/admin?view=mellow';
        } elseif ($user->role === 'admin_tpo') {
            $destination = '/admin?view=tpo';
        } elseif ($user->role === 'admin_marketing') {
            $destination = '/marketing';
        }


        // 6. User data object for AptRun frontend
        $userJson = json_encode([
            'id'                           => $user->id,
            'name'                         => $user->name,
            'email'                        => $user->email,
            'role'                         => $user->role ?? 'user',
            'permissions'                  => $user->permissions ?? null,
            'handle'                       => $user->handle ?? null,
            'bio'                          => $user->bio ?? null,
            'skills'                       => $user->skills ?? [],
            'profile_completion_percent'   => $user->profile_completion_percent ?? 0,
            'mellow_vault_profile_percent' => $user->mellow_vault_profile_percent ?? 0,
            'mellow_vault_stack_key'       => $user->mellow_vault_stack_key,
            'mellow_vault_stack_name'      => $user->mellow_vault_stack_name,
        ]);


        // 7. Auto-save in localStorage and redirect to Next.js dashboard
        $html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connecting to AptRun...</title>
    <style>
        body { margin:0; background:#0b0f19; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; }
        .box { text-align:center; padding:2rem; }
        .spinner { width:42px; height:42px; border:3px solid rgba(255,255,255,.1); border-top-color:#6366f1; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 1.5rem; }
        @keyframes spin { to { transform:rotate(360deg); } }
        h2 { font-size:1.25rem; margin:0 0 .5rem; font-weight:600; }
        p { color:#94a3b8; font-size:.9rem; margin:0; }
    </style>
</head>
<body>
    <div class="box">
        <div class="spinner"></div>
        <h2>Connecting to AptRun...</h2>
        <p>Logging you in, please wait a moment...</p>
    </div>
    <script>
        try {
            var token = ' . json_encode($token) . ';
            var user = ' . $userJson . ';


            // Set Next.js auth in localStorage
            window.localStorage.setItem("aptrun_token", token);
            window.localStorage.setItem("aptrun_user", JSON.stringify(user));


            // Set cookie fallback for SSR
            document.cookie = "aptrun_token=" + encodeURIComponent(token) + "; path=/; max-age=2592000; SameSite=Lax";
        } catch(e) {
            console.error(e);
        }
        window.location.replace(' . json_encode($destination) . ');
    </script>
</body>
</html>';


        return response($html)->header('Content-Type', 'text/html');
    }

    /**
     * GET /api/vault/sso-url (auth:sanctum)
     * Ensures the logged-in AptRun user / college student has a synced row in
     * `mellow_vault.developer_details_tb` and returns a 1-click signed SSO URL to Mellow Vault.
     */
    public function generateMellowVaultSso(Request $request, MellowVaultUserSyncService $sync): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $redirect = is_string($request->query('redirect')) ? $request->query('redirect') : null;

        return response()->json($sync->buildMellowVaultSsoUrl($user, $redirect));
    }

    /**
     * GET /api/sso/mellow-vault (auth:sanctum)
     * Direct redirect handler for opening Mellow Vault with the active AptRun session.
     */
    public function redirectToMellowVault(Request $request, MellowVaultUserSyncService $sync)
    {
        /** @var User $user */
        $user = $request->user();
        $redirect = is_string($request->query('redirect')) ? $request->query('redirect') : null;
        $sso = $sync->buildMellowVaultSsoUrl($user, $redirect);

        return redirect()->away($sso['url']);
    }
}