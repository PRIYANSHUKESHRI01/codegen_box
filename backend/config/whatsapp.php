<?php

return [

    /*
    |--------------------------------------------------------------------------
    | WhatsApp provider
    |--------------------------------------------------------------------------
    |
    | "log" (default) writes every outgoing WhatsApp message to
    | storage/logs/laravel.log instead of actually sending it — exactly the
    | same safety net MAIL_MAILER=log gives email, so this feature is fully
    | testable with zero external account. Set to "meta" once you have a
    | real WhatsApp Business Platform (Meta Cloud API) app, phone number id,
    | and permanent access token — no code changes needed, only the four
    | env vars below.
    */
    'provider' => env('WHATSAPP_PROVIDER', 'log'),

    'meta' => [
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'access_token' => env('WHATSAPP_ACCESS_TOKEN'),
        // Meta versions its Graph API by date; bump this if Meta deprecates
        // the version you're pinned to.
        'api_version' => env('WHATSAPP_API_VERSION', 'v20.0'),
    ],

];
