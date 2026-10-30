<?php


namespace App\Http\Controllers\Api;


use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\User;


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


        $secretKey = env('APTRUN_SSO_SECRET', 'MellowVaultAptRunSSO2026SecretKeySecureToken');


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


        // 4. Generate Sanctum token for Next.js frontend
        $token = $user->createToken('mellowvault_sso')->plainTextToken;


        // 5. Determine destination
        $destination = '/dashboard';
        if ($user->role === 'superadmin') {
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
            'id'                        => $user->id,
            'name'                      => $user->name,
            'email'                     => $user->email,
            'role'                      => $user->role ?? 'user',
            'permissions'               => $user->permissions ?? null,
            'handle'                    => $user->handle ?? null,
            'bio'                       => $user->bio ?? null,
            'skills'                    => $user->skills ?? [],
            'profile_completion_percent'=> $user->profile_completion_percent ?? 0,
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
}