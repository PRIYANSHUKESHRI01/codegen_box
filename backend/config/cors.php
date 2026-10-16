<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /*
    | Who may call this API from a browser. The frontend is a static site on its own origin, so on a real
    | server its address MUST be listed here or every request is blocked by the browser (login, pricing,
    | checkout — everything). It is taken from FRONTEND_URL, which every deployment already sets; add more
    | origins (a www/non-www twin, a staging site) comma-separated in CORS_ALLOWED_ORIGINS. The local dev
    | origins are allowed everywhere except production.
    */
    'allowed_origins' => array_values(array_unique(array_filter(array_map(
        fn ($origin) => rtrim(trim((string) $origin), '/'),
        array_merge(
            env('APP_ENV') === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'],
            [env('FRONTEND_URL')],
            explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')),
        )
    )))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
