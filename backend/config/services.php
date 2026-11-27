<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    | AI Interview question generation and scoring (see App\Services\GeminiQuestionGeneratorService & GeminiInterviewScoringService).
    | Multi-tier fallback hierarchy (Gemini 3 -> Gemini 2.5, never <2.5 or >3.x):
    | cascades through gemini-3.6-flash -> gemini-3.5-flash -> gemini-3-flash-preview ->
    | gemini-3.1-flash-lite -> gemini-3.8-flash -> gemini-3.1-pro-preview ->
    | gemini-2.5-flash -> gemini-2.5-pro -> gemini-2.5-flash-lite.
    */
    'gemini' => [
        'api_key' => env('GEMINI_API_KEY_1') ?: env('GEMINI_API_KEY'),
        'api_keys' => (static function (): array {
            $keys = [];
            for ($i = 1; $i <= 50; $i++) {
                $v = trim((string) env("GEMINI_API_KEY_{$i}", ''));
                if ($v !== '' && ! in_array($v, $keys, true)) {
                    $keys[$i] = $v;
                }
            }
            foreach (array_filter(array_map('trim', explode(',', (string) env('GEMINI_API_KEYS', '')))) as $v) {
                if ($v !== '' && ! in_array($v, $keys, true)) {
                    $keys[] = $v;
                }
            }
            $single = trim((string) env('GEMINI_API_KEY', ''));
            if ($single !== '' && ! in_array($single, $keys, true)) {
                $keys[] = $single;
            }

            return $keys;
        })(),
        'model' => env('GEMINI_MODEL', 'gemini-3.6-flash'),
        'fallback_models' => array_filter(array_map('trim', explode(',', env('GEMINI_FALLBACK_MODELS', 'gemini-3.6-flash,gemini-3.5-flash,gemini-3-flash-preview,gemini-3.1-flash-lite,gemini-3.8-flash,gemini-3.1-pro-preview,gemini-2.5-flash,gemini-2.5-pro,gemini-2.5-flash-lite')))),
        // Second, informational "worth a second listen" call per speaking attempt; turn off on a tight quota.
        'speaking_pronunciation_notes' => env('GEMINI_SPEAKING_PRONUNCIATION_NOTES', true),
    ],

    /*
    | Firebase Phone (OTP) verification — see
    | App\Services\FirebasePhoneVerificationService. Only `project_id` is
    | actually used server-side (to check the ID token's issuer/audience);
    | the rest are the browser SDK's config values, kept here too so
    | config/services.php stays the one place every third-party credential
    | is read from, matching every other entry in this file.
    */
    'firebase' => [
        'api_key' => env('FIREBASE_API_KEY'),
        'auth_domain' => env('FIREBASE_AUTH_DOMAIN'),
        'project_id' => env('FIREBASE_PROJECT_ID'),
        'storage_bucket' => env('FIREBASE_STORAGE_BUCKET'),
        'messaging_sender_id' => env('FIREBASE_MESSAGING_SENDER_ID'),
        'app_id' => env('FIREBASE_APP_ID'),
        'measurement_id' => env('FIREBASE_MEASUREMENT_ID'),
    ],

];
