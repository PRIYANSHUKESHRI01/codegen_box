<?php

/*
|--------------------------------------------------------------------------
| Exam Integrity (the layer under every proctored surface)
|--------------------------------------------------------------------------
|
| config/proctoring.php decides WHICH surfaces are proctored and how many
| strikes lock a student. This file is the layer that makes those strikes
| trustworthy: the browser (and, optionally, the AptRun Guardian desktop
| agent) streams signed, sequenced telemetry to the server, the server keeps
| a tamper-evident log of it, and answers are refused when the signal stops.
|
| Design rule: NOTHING the browser says is trusted, and silence is never
| "all clear". See docs/exam-integrity.md for the threat model.
|
*/

return [

    // Master kill switch. false = every surface behaves exactly as it did before this layer existed
    // (the old violation endpoints keep working; no heartbeat is required; nothing is gated).
    'enabled' => (bool) env('INTEGRITY_ENABLED', true),

    // true  = answers are refused without a live, healthy proctoring session (the real thing).
    // false = "observe mode": everything is recorded and shown to reviewers, but nothing is refused — for a staged
    //         roll-out, or to see what the layer would flag on real traffic before it can block anyone.
    'enforce' => (bool) env('INTEGRITY_ENFORCE', true),

    // Which profile each proctored surface runs under. Profiles are defined below.
    'surfaces' => [
        'contest' => env('INTEGRITY_PROFILE_CONTEST', 'strict'),
        'core_test' => env('INTEGRITY_PROFILE_CORE_TEST', 'strict'),
        'soft_skill' => env('INTEGRITY_PROFILE_SOFT_SKILL', 'standard'),
        'interview' => env('INTEGRITY_PROFILE_INTERVIEW', 'standard'),
        'study' => env('INTEGRITY_PROFILE_STUDY', 'practice'),
    ],

    /*
    | A profile is a bundle of requirements. Every key can be overridden from .env for a deployment
    | (INTEGRITY_<PROFILE>_<KEY>), so a campus without webcams, or one that wants the screen shared, is a
    | config change and not a code change.
    |
    |  beat_interval        seconds between telemetry batches (the page also flushes at once on a serious event)
    |  stale_after          seconds without a beat before answers are refused (423 integrity_signal_lost)
    |  webcam_snapshot      seconds between webcam stills sent as evidence (0 = off)
    |  screen_snapshot      seconds between screen stills sent as evidence (0 = off)
    |  screen_share         required | optional | off — the student shares their ENTIRE screen with the page
    |  camera               required | optional | off
    |  guardian             required | optional | off — the AptRun Guardian desktop agent (Windows)
    |  chromium_only        refuse browsers that cannot prove what they are sharing (Chrome / Edge / Brave …)
    |  block_multi_monitor  an extended desktop (a second screen) must be disconnected before starting
    |  focus_loss_strike    seconds the page may lose focus before it is a strike (0 = never a strike)
    |  ai                   in-browser face / pose / phone analysis, reported as flags with a still as proof
    |  ai_strikes           AI findings that are allowed to cost a strike (the rest only raise risk and attach evidence)
    |  clipboard            editor_only | block_all | off
    */
    'profiles' => [
        'strict' => [
            'beat_interval' => (int) env('INTEGRITY_STRICT_BEAT', 10),
            'stale_after' => (int) env('INTEGRITY_STRICT_STALE', 40),
            'webcam_snapshot' => (int) env('INTEGRITY_STRICT_WEBCAM_SNAPSHOT', 30),
            'screen_snapshot' => (int) env('INTEGRITY_STRICT_SCREEN_SNAPSHOT', 60),
            'screen_share' => env('INTEGRITY_STRICT_SCREEN_SHARE', 'required'),
            'camera' => env('INTEGRITY_STRICT_CAMERA', 'required'),
            'guardian' => env('INTEGRITY_STRICT_GUARDIAN', 'optional'),
            'chromium_only' => (bool) env('INTEGRITY_STRICT_CHROMIUM_ONLY', true),
            'block_multi_monitor' => (bool) env('INTEGRITY_STRICT_BLOCK_MULTI_MONITOR', true),
            'focus_loss_strike' => (int) env('INTEGRITY_STRICT_FOCUS_LOSS', 3),
            'ai' => (bool) env('INTEGRITY_STRICT_AI', true),
            'ai_strikes' => ['multiple_faces'],
            'clipboard' => 'editor_only',
        ],
        'standard' => [
            'beat_interval' => (int) env('INTEGRITY_STANDARD_BEAT', 12),
            'stale_after' => (int) env('INTEGRITY_STANDARD_STALE', 50),
            'webcam_snapshot' => (int) env('INTEGRITY_STANDARD_WEBCAM_SNAPSHOT', 45),
            'screen_snapshot' => (int) env('INTEGRITY_STANDARD_SCREEN_SNAPSHOT', 0),
            'screen_share' => env('INTEGRITY_STANDARD_SCREEN_SHARE', 'optional'),
            'camera' => env('INTEGRITY_STANDARD_CAMERA', 'required'),
            'guardian' => env('INTEGRITY_STANDARD_GUARDIAN', 'optional'),
            'chromium_only' => (bool) env('INTEGRITY_STANDARD_CHROMIUM_ONLY', false),
            'block_multi_monitor' => (bool) env('INTEGRITY_STANDARD_BLOCK_MULTI_MONITOR', true),
            'focus_loss_strike' => (int) env('INTEGRITY_STANDARD_FOCUS_LOSS', 4),
            'ai' => (bool) env('INTEGRITY_STANDARD_AI', true),
            'ai_strikes' => [],
            'clipboard' => 'block_all',
        ],
        'practice' => [
            'beat_interval' => (int) env('INTEGRITY_PRACTICE_BEAT', 15),
            'stale_after' => (int) env('INTEGRITY_PRACTICE_STALE', 75),
            'webcam_snapshot' => (int) env('INTEGRITY_PRACTICE_WEBCAM_SNAPSHOT', 0),
            'screen_snapshot' => 0,
            'screen_share' => env('INTEGRITY_PRACTICE_SCREEN_SHARE', 'off'),
            'camera' => env('INTEGRITY_PRACTICE_CAMERA', 'required'),
            'guardian' => env('INTEGRITY_PRACTICE_GUARDIAN', 'off'),
            'chromium_only' => false,
            'block_multi_monitor' => false,
            'focus_loss_strike' => (int) env('INTEGRITY_PRACTICE_FOCUS_LOSS', 5),
            'ai' => (bool) env('INTEGRITY_PRACTICE_AI', false),
            'ai_strikes' => [],
            'clipboard' => 'block_all',
        ],
    ],

    /*
    | Telemetry gaps. The server cannot tell "the Wi-Fi dropped" from "the student blocked the endpoint", so it does not try:
    | while the signal is stale NOTHING is accepted (so blocking it buys the student nothing), and the silence itself is
    | recorded. A short gap is forgiven; a long one, or too many seconds of them in total, costs a strike.
    */
    'gap' => [
        'tolerance_seconds' => (int) env('INTEGRITY_GAP_TOLERANCE', 45),   // below this a pause is just a slow network
        'single_strike_seconds' => (int) env('INTEGRITY_GAP_SINGLE', 150), // one silence this long is a strike
        'budget_seconds' => (int) env('INTEGRITY_GAP_BUDGET', 300),        // total silence tolerated across the attempt
    ],

    /*
    | Network. `ip_change`: flag = record + raise risk; strike = also cost a strike. A campus LAN almost never changes
    | address mid-exam, a phone hotspot does, so the default is to flag and let a human decide.
    |
    | `allowed_ranges` is the deployment-wide "exam network" (CIDRs, comma separated in .env). When non-empty, a proctored
    | attempt can only START from inside it — the strongest single control against a helper in another place. A college can
    | add its own ranges (colleges.exam_networks); a student of that college may use either.
    */
    'network' => [
        'ip_change' => env('INTEGRITY_IP_CHANGE', 'flag'),
        'allowed_ranges' => array_values(array_filter(array_map('trim', explode(',', (string) env('INTEGRITY_ALLOWED_RANGES', ''))))),
        'blocked_ranges' => array_values(array_filter(array_map('trim', explode(',', (string) env('INTEGRITY_BLOCKED_RANGES', ''))))),
        // Trust X-Forwarded-For only from these proxies (already handled by Laravel's TrustProxies); the value stored is $request->ip().
        'stun_servers' => array_values(array_filter(array_map('trim', explode(',', (string) env('INTEGRITY_STUN', 'stun:stun.l.google.com:19302'))))),
    ],

    /*
    | Evidence (stills sent by the browser). Stored encrypted on a PRIVATE disk and only ever streamed to an authorised
    | reviewer. Clean sessions are deleted early; sessions that raised a flag are kept longer so a dispute can be settled.
    */
    'evidence' => [
        'disk' => env('INTEGRITY_EVIDENCE_DISK', 'local'),
        'directory' => 'integrity-evidence',
        'encrypt' => (bool) env('INTEGRITY_EVIDENCE_ENCRYPT', true),
        'retention_days' => (int) env('INTEGRITY_EVIDENCE_RETENTION_DAYS', 45),
        'flagged_retention_days' => (int) env('INTEGRITY_EVIDENCE_FLAGGED_RETENTION_DAYS', 365),
        'max_image_bytes' => (int) env('INTEGRITY_EVIDENCE_MAX_IMAGE_BYTES', 400 * 1024),
        'max_bytes_per_session' => (int) env('INTEGRITY_EVIDENCE_MAX_SESSION_BYTES', 150 * 1024 * 1024),
        // Raw event rows (the hash-chained log) outlive the pictures: they are small and they are the audit trail.
        'events_retention_days' => (int) env('INTEGRITY_EVENTS_RETENTION_DAYS', 730),
    ],

    /*
    | Risk. Each event type has a weight (see App\Services\Integrity\EventCatalog); the same type stops adding after
    | `type_cap_multiplier` × its weight so five hundred focus blips cannot drown one real finding.
    */
    'risk' => [
        'type_cap_multiplier' => 5,
        'levels' => ['medium' => 15, 'high' => 40, 'critical' => 80],
    ],

    /*
    | The AptRun Guardian (Windows desktop agent, see /guardian). It watches the operating system — which the browser
    | cannot — and reports over its OWN signed channel, so patching the page changes nothing it says.
    */
    'guardian' => [
        'pair_ttl_seconds' => (int) env('GUARDIAN_PAIR_TTL', 600),
        'stale_after' => (int) env('GUARDIAN_STALE_AFTER', 30),
        // SHA-256 of released guardian executables (comma separated). Empty = accept any build (development).
        'allowed_builds' => array_values(array_filter(array_map('trim', explode(',', (string) env('GUARDIAN_ALLOWED_BUILDS', ''))))),
        'min_version' => env('GUARDIAN_MIN_VERSION', '1.0.0'),
        // TLS interception check: base64 SHA-256 of the SubjectPublicKeyInfo of your INTERMEDIATE or root CA (not the leaf, which
        // rotates). Empty = do not check. A college behind legitimate SSL inspection must exempt the API host or leave this empty.
        'tls_pins' => array_values(array_filter(array_map('trim', explode(',', (string) env('GUARDIAN_TLS_PINS', ''))))),
        // Where students get the program. Normally leave GUARDIAN_DOWNLOAD_URL empty: the server then offers the installer it holds itself
        // (GET /api/guardian/download), which guardian/package.ps1 -Publish puts in package_path. Set the URL only to host it elsewhere.
        'download_url' => env('GUARDIAN_DOWNLOAD_URL', ''),
        'package_path' => env('GUARDIAN_PACKAGE_PATH', storage_path('app/guardian/aptrun-guardian.exe')),
        // Process categories → what a sighting costs. strike: 0 = recorded only, 1 = a strike, 99 = the attempt ends.
        'categories' => [
            'remote_control' => ['label' => 'Remote-control software', 'strike' => 99],
            'ai_assistant' => ['label' => 'AI assistant', 'strike' => 99],
            'capture_evasion' => ['label' => 'Screen-capture evasion', 'strike' => 99],
            'virtual_machine' => ['label' => 'Virtual machine', 'strike' => 99],
            'screen_sharing' => ['label' => 'Screen-sharing / recording', 'strike' => 1],
            'network_tool' => ['label' => 'Network / VPN tool', 'strike' => 99],
            'debugger' => ['label' => 'Debugger / injection tool', 'strike' => 99],
            'automation' => ['label' => 'Input automation', 'strike' => 99],
            'messaging' => ['label' => 'Messaging app', 'strike' => 1],
        ],
    ],

    // Dedupe window: signals of the same "away" incident (fullscreen exit + tab switch + OS focus change) cost one strike.
    'incident_window_seconds' => (int) env('INTEGRITY_INCIDENT_WINDOW', 4),
];
