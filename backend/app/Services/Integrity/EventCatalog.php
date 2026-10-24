<?php

namespace App\Services\Integrity;

/**
 * Every kind of integrity event, in one place: what it is called for a reviewer, how serious it is, how much it adds to
 * the risk score, whether it costs a strike, and WHICH SOURCE is allowed to report it.
 *
 * The source split matters. The browser may only report browser-side events; a page that claims to be the Guardian, or
 * the server, is rejected. That keeps a tampered page from forging "all clear" Guardian reports or erasing the server's
 * own findings.
 *
 * `strike`: 0 = recorded only, 1 = costs one strike, 99 = ends the attempt at once (the Guardian proved something
 * unambiguous). The frontend mirrors the browser-side half of this list in lib/integrity/events.ts.
 */
final class EventCatalog
{
    public const SOURCE_WEB = 'web';

    public const SOURCE_GUARDIAN = 'guardian';

    public const SOURCE_SERVER = 'server';

    public const STRIKE_LOCK = 99;

    /** Events of one real-world incident (leaving the exam window) cost ONE strike between them, not one each. */
    public const CLASS_AWAY = 'away';

    /**
     * type => [label, severity, weight, strike, source(s), incident class|null]
     *
     * @var array<string, array{0: string, 1: string, 2: int, 3: int, 4: list<string>, 5: ?string}>
     */
    private const EVENTS = [
        // ── Browser: the original detectors ─────────────────────────────────────────────────────────────────────
        'fullscreen_exit' => ['Exited fullscreen', 'medium', 8, 1, ['web'], self::CLASS_AWAY],
        'tab_switch' => ['Switched tab or window', 'medium', 8, 1, ['web'], self::CLASS_AWAY],
        'devtools_detected' => ['Developer tools opened', 'high', 14, 1, ['web'], null],
        'paste_attempt' => ['Attempted to paste', 'low', 3, 0, ['web'], null],
        'window_blur' => ['Window lost focus', 'info', 1, 0, ['web'], null],
        'context_menu_blocked' => ['Right-click blocked', 'info', 0, 0, ['web'], null],
        'tab_close_attempt' => ['Attempted to close or navigate away', 'low', 2, 0, ['web'], null],

        // ── Browser: new ────────────────────────────────────────────────────────────────────────────────────────
        'focus_lost' => ['Exam window lost focus', 'medium', 8, 0, ['web'], self::CLASS_AWAY],
        'focus_regained' => ['Returned to the exam window', 'info', 0, 0, ['web'], null],
        'tamper_detected' => ['Proctoring code was tampered with', 'critical', 40, 1, ['web'], null],
        'automation_detected' => ['Browser automation detected', 'critical', 40, 1, ['web'], null],
        'synthetic_input' => ['Scripted (non-human) keystrokes', 'high', 15, 0, ['web'], null],
        'extension_suspected' => ['Suspicious browser extension', 'low', 4, 0, ['web'], null],
        'multi_monitor' => ['More than one screen connected', 'high', 12, 1, ['web'], null],
        'display_changed' => ['Screen size or scale changed', 'low', 3, 0, ['web'], null],
        'screen_share_stopped' => ['Screen sharing was stopped', 'high', 16, 1, ['web'], null],
        'screen_share_changed' => ['Shared a window or tab, not the entire screen', 'high', 14, 1, ['web'], null],
        'camera_lost' => ['Camera stopped', 'high', 16, 1, ['web'], null],
        'camera_blocked' => ['Camera covered or blank', 'high', 12, 1, ['web'], null],
        'camera_frozen' => ['Camera image frozen', 'high', 12, 0, ['web'], null],
        'virtual_camera' => ['Virtual / software camera in use', 'critical', 30, 1, ['web'], null],
        'mic_lost' => ['Microphone stopped', 'medium', 8, 0, ['web'], null],
        'no_face' => ['No face in the camera', 'medium', 6, 0, ['web'], null],
        'multiple_faces' => ['More than one face in the camera', 'high', 15, 0, ['web'], null],
        'face_away' => ['Looking away from the screen', 'low', 4, 0, ['web'], null],
        'phone_detected' => ['Phone visible in the camera', 'medium', 10, 0, ['web'], null],
        'speech_detected' => ['Sustained speech', 'low', 3, 0, ['web'], null],
        'ai_unavailable' => ['Camera analysis unavailable on this device', 'info', 1, 0, ['web'], null],
                'offline_period' => ['Browser was offline', 'info', 1, 0, ['web'], null],
        'shortcut_blocked' => ['Blocked keyboard shortcut', 'info', 1, 0, ['web'], null],
        'screenshot_key' => ['Screenshot key pressed', 'medium', 6, 0, ['web'], null],
        'print_attempt' => ['Tried to print', 'low', 2, 0, ['web'], null],

        // ── Server-derived (the browser can never send these) ───────────────────────────────────────────────────
        'session_started' => ['Proctoring started', 'info', 0, 0, ['server'], null],
        'session_resumed' => ['Proctoring resumed', 'info', 0, 0, ['server'], null],
        'session_ended' => ['Proctoring ended', 'info', 0, 0, ['server'], null],
        'attempt_locked' => ['Attempt ended by proctoring', 'critical', 0, 0, ['server'], null],
        'telemetry_gap' => ['Proctoring signal was lost', 'high', 12, 0, ['server'], null],
        'batch_gap' => ['Telemetry batches went missing', 'medium', 6, 0, ['server'], null],
        'replay_suspected' => ['Out-of-order or replayed telemetry', 'high', 20, 0, ['server'], null],
        'ip_changed' => ['Network address changed', 'medium', 8, 0, ['server'], null],
        'webrtc_ip_mismatch' => ['Network address does not match the connection', 'medium', 10, 0, ['server'], null],
        'ua_changed' => ['Browser identity changed', 'high', 15, 0, ['server'], null],
        'device_changed' => ['Attempt moved to a different device', 'high', 20, 0, ['server'], null],
        'instance_replaced' => ['Attempt reopened in a new tab', 'info', 0, 0, ['server'], null],
        'instance_conflict' => ['Attempt opened on another device while in progress', 'high', 18, 0, ['server'], null],
        'clock_tamper' => ['Computer clock jumped', 'medium', 6, 0, ['server'], null],
        'network_not_allowed' => ['Outside the allowed exam network', 'critical', 30, 0, ['server'], null],
        'shared_device' => ['Same device used by another candidate', 'high', 20, 0, ['server'], null],
        'guardian_paired' => ['Guardian connected', 'info', 0, 0, ['server'], null],
        'guardian_gap' => ['Guardian signal was lost', 'high', 14, 0, ['server'], null],
        'guardian_unpaired' => ['Guardian disconnected', 'medium', 6, 0, ['server'], null],
        'guardian_page_mismatch' => ['Page and operating system disagree about the exam window', 'critical', 40, 99, ['server'], null],
        'guardian_host_mismatch' => ['Guardian and page report different machines', 'critical', 40, 0, ['server'], null],

        // ── Guardian (operating-system level; sent only over its own signed channel) ────────────────────────────
        'guardian_started' => ['Guardian started', 'info', 0, 0, ['guardian'], null],
        'os_foreground_away' => ['Another application took the foreground', 'medium', 8, 1, ['guardian'], self::CLASS_AWAY],
        'os_exam_window_missing' => ['Exam window not found on the desktop', 'high', 12, 0, ['guardian'], self::CLASS_AWAY],
        'forbidden_process' => ['Forbidden program running', 'critical', 30, 1, ['guardian'], null],
        'unknown_window_process' => ['New program opened a window', 'low', 3, 0, ['guardian'], null],
        'capture_excluded_window' => ['Window hidden from screen sharing', 'critical', 40, 99, ['guardian'], null],
        'overlay_window' => ['Click-through overlay on top of the exam', 'high', 25, 1, ['guardian'], null],
        'vm_detected' => ['Running inside a virtual machine', 'critical', 40, 99, ['guardian'], null],
        'remote_session' => ['Remote desktop session', 'critical', 40, 99, ['guardian'], null],
        'multi_monitor_os' => ['More than one screen connected', 'high', 12, 1, ['guardian'], null],
        'virtual_display' => ['Virtual display adapter', 'high', 20, 1, ['guardian'], null],
        'proxy_detected' => ['Traffic goes through a proxy', 'high', 25, 1, ['guardian'], null],
        'browser_flag' => ['Browser started with unsafe options', 'high', 25, 1, ['guardian'], null],
        'injected_module' => ['A library from a user folder was loaded into the Guardian', 'high', 25, 0, ['guardian'], null],
        'input_device_added' => ['Keyboard or mouse connected during the attempt', 'medium', 12, 0, ['guardian'], null],
        'vpn_detected' => ['VPN / tunnel adapter active', 'high', 20, 1, ['guardian'], null],
        'root_ca_added' => ['A trusted root certificate was installed', 'critical', 40, 99, ['guardian'], null],
        'hosts_modified' => ['Hosts file was edited', 'high', 30, 1, ['guardian'], null],
        'dns_changed' => ['DNS servers changed', 'low', 3, 0, ['guardian'], null],
        'injected_input' => ['Keystrokes injected by software', 'high', 25, 1, ['guardian'], null],
        'debugger_attached' => ['Debugger attached to the Guardian', 'critical', 40, 99, ['guardian'], null],
        'guardian_integrity' => ['Guardian program was modified', 'critical', 40, 99, ['guardian'], null],
        'removable_drive_added' => ['Removable drive connected', 'medium', 8, 0, ['guardian'], null],
        'clipboard_outside' => ['Clipboard changed outside the exam', 'low', 3, 0, ['guardian'], null],
        'guardian_scan_error' => ['Guardian could not complete a check', 'info', 1, 0, ['guardian'], null],
    ];

    /** Pre-flight failures the Guardian/page report before the exam starts. They block the start; they never cost a strike. */
    public const PREFLIGHT_BLOCKERS = [
        'vm_detected', 'remote_session', 'multi_monitor_os', 'virtual_display', 'forbidden_process', 'capture_excluded_window',
        'overlay_window', 'proxy_detected', 'vpn_detected', 'root_ca_added', 'debugger_attached', 'guardian_integrity', 'browser_flag', 'injected_module',
    ];

    public static function exists(string $type): bool
    {
        return isset(self::EVENTS[$type]);
    }

    /** @return list<string> */
    public static function types(): array
    {
        return array_keys(self::EVENTS);
    }

    /** @return list<string> every type the given source may report */
    public static function typesFor(string $source): array
    {
        return array_keys(array_filter(self::EVENTS, fn (array $e) => in_array($source, $e[4], true)));
    }

    public static function allows(string $type, string $source): bool
    {
        return isset(self::EVENTS[$type]) && in_array($source, self::EVENTS[$type][4], true);
    }

    public static function label(string $type): string
    {
        return self::EVENTS[$type][0] ?? ucfirst(str_replace('_', ' ', $type));
    }

    public static function weight(string $type): int
    {
        return self::EVENTS[$type][2] ?? 0;
    }

    public static function severity(string $type): string
    {
        return self::EVENTS[$type][1] ?? 'info';
    }

    public static function incidentClass(string $type): ?string
    {
        return self::EVENTS[$type][5] ?? null;
    }

    /**
     * What an event is worth in THIS situation. Most are fixed; a few depend on the profile, the data attached, or
     * configuration (a forbidden process's category, whether an address change is only flagged, how long focus was lost).
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $profile  the surface's resolved profile (see Profiles)
     * @return array{severity: string, weight: int, strike: int}
     */
    public static function resolve(string $type, array $data, array $profile): array
    {
        [, $severity, $weight, $strike] = self::EVENTS[$type] ?? ['', 'info', 0, 0];

        switch ($type) {
            case 'focus_lost':
                $needed = (int) ($profile['focus_loss_strike'] ?? 0);
                $strike = ($needed > 0 && (int) ($data['duration_ms'] ?? 0) >= $needed * 1000) ? 1 : 0;
                break;

            case 'forbidden_process':
                $category = (string) ($data['category'] ?? '');
                $strike = (int) config("integrity.guardian.categories.{$category}.strike", 1);
                // A window TITLE ("ChatGPT" in a second browser window) is weaker evidence than a program that is running:
                // the most it costs is one strike, whatever the category's price for the real thing.
                if (($data['via'] ?? null) === 'title') {
                    $strike = min($strike, 1);
                }
                if ($strike >= self::STRIKE_LOCK) {
                    $weight = 40;
                }
                break;

            case 'multiple_faces':
            case 'no_face':
            case 'face_away':
            case 'phone_detected':
            case 'speech_detected':
                $strike = in_array($type, (array) ($profile['ai_strikes'] ?? []), true) ? 1 : 0;
                break;

            case 'ip_changed':
                $strike = config('integrity.network.ip_change') === 'strike' ? 1 : 0;
                break;

            case 'multi_monitor':
            case 'multi_monitor_os':
                $strike = ! empty($profile['block_multi_monitor']) ? 1 : 0;
                break;
        }

        return ['severity' => $severity, 'weight' => $weight, 'strike' => $strike];
    }
}
