<?php

/*
|--------------------------------------------------------------------------
| Who may take the Vault AI Interview, and when
|--------------------------------------------------------------------------
|
| The Vault AI Interview is the final qualification step on top of the readiness score. A student with no college (a direct
| AptRun user) can take it straight away. A college student has to earn it, by BOTH:
|
|   1. time on AptRun   - signed in for `unlock_days[their year]` days, counted from their first sign-in;
|   2. readiness        - a readiness score of at least `min_readiness`.
|
| A year that is not listed in `unlock_days` (the 1st and 2nd years) is not offered the interview at all. Once a student has met
| both conditions the unlock is kept (users.vault_ai_unlocked_at), so the daily readiness decay can never lock them out of a
| series they have started.
|
| Read by App\Services\Vault\VaultAiAccessService.
|
*/

return [

    // Readiness score (0-100) a college student needs. Deliberately the same line as the Vault's own entry line.
    'min_readiness' => (int) env('VAULT_AI_MIN_READINESS', 60),

    // Study year => days since first sign-in before it unlocks.
    'unlock_days' => [
        4 => (int) env('VAULT_AI_UNLOCK_DAYS_4TH_YEAR', 45),
        3 => (int) env('VAULT_AI_UNLOCK_DAYS_3RD_YEAR', 90),
    ],

    // How long a student's readiness score is reused by the access check (seconds): the sidebar and the home card ask on every page.
    'readiness_cache_seconds' => 120,

];
