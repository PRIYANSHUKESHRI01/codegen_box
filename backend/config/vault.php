<?php

/*
|--------------------------------------------------------------------------
| Vault — students who are ready to be hired
|--------------------------------------------------------------------------
|
| A student whose readiness score reaches `enter_score` becomes Vault-eligible.
| Once they have said yes (one standing, revocable consent), their profile is
| listed to hiring partners inside AptRun and handed to Mellow Vault, where
| employers can find them. Falling below `exit_score` takes them off again.
|
| The gap between the two numbers is deliberate. With a single cut-off, a
| student hovering around it would be listed and withdrawn from employers'
| screens every time a score moved a point. They enter at 60 and only leave
| when they drop clearly below it.
|
| The Mellow Vault hand-off is configured entirely from the environment; see
| docs/readiness-and-vault.md for the wire contract.
|
*/

return [

    'enter_score' => (int) env('VAULT_ENTER_SCORE', 60),

    'exit_score' => (int) env('VAULT_EXIT_SCORE', 55),

    /*
    |--------------------------------------------------------------------------
    | Mellow Vault connection
    |--------------------------------------------------------------------------
    |
    | sync_url      Where AptRun POSTs profile.upsert / profile.withdraw events.
    |               Blank = not connected: events are still recorded (nothing is
    |               lost) and delivered as soon as a URL is set.
    | sync_secret   Shared secret used to sign every delivery (HMAC-SHA256). Mellow
    |               Vault verifies it; see the docs for the exact string signed.
    | api_key       Bearer token Mellow Vault presents when it calls AptRun
    |               (GET /api/vault/v1/profiles, resume download, status callback).
    |               Blank = those routes answer 503.
    */
    'sync_url' => env('VAULT_SYNC_URL'),

    'sync_secret' => env('VAULT_SYNC_SECRET'),

    'api_key' => env('VAULT_API_KEY'),

    /* Seconds to wait for Mellow Vault before treating a delivery as failed. */
    'sync_timeout' => (int) env('VAULT_SYNC_TIMEOUT', 10),

    /* A delivery that keeps failing is retried this many times in total, then parked as `dead` for an admin to look at. */
    'sync_max_attempts' => (int) env('VAULT_SYNC_MAX_ATTEMPTS', 8),

    /* Minutes to wait before the Nth retry (the last value repeats). */
    'sync_backoff_minutes' => [1, 5, 15, 60, 180, 720],

    /* A change to an already-listed profile (a new skill, a score moving a point) is held this long and merged, so one busy hour sends one update. */
    'sync_debounce_minutes' => 30,

    /* Events handed to Mellow Vault per run of `vault:sync` (it runs every minute). */
    'sync_batch' => 50,

    /* Days to keep delivered events before `vault:prune` removes them. */
    'sync_retention_days' => 30,

];
