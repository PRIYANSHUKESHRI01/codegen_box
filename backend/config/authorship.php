<?php

/*
|--------------------------------------------------------------------------
| Project Lab: "students write the code themselves"
|--------------------------------------------------------------------------
|
| The editor carries a guard (infra/workspaces/guard/aptrun-guard.js) that refuses pasting text that was not
| copied inside the workspace. This file holds the control-plane side: how the guard is switched, what its
| reports may contain, and the plain rules that turn the evidence into a label for the reviewer.
|
| None of this ever fails or blocks a submission. A label is a pointer for a human, not a verdict.
| See docs/project-lab.md ("Authorship").
*/

return [

    /*
    | WORKSPACE_PASTE_GUARD
    |   enforce — outside paste is refused (the default)
    |   report  — nothing is refused, but what WOULD have been is recorded (use to pilot a change)
    |   off     — the guard does nothing (also what a project marked "open" gets)
    */
    'guard_mode' => env('WORKSPACE_PASTE_GUARD', 'enforce'),

    /*
    | What the guard may report. Anything else is dropped. Reports are metadata only; the text that was
    | copied or typed never leaves the browser and is never stored.
    */
    'event_kinds' => [
        'paste_blocked', 'paste_internal', 'paste_trusted',
        'clipboard_read_blocked', 'synthetic_blocked', 'bulk_insert', 'bulk_insert_blocked',
        'drop_blocked', 'drop_asset', 'upload_blocked', 'window_blocked',
        'fast_typing', 'robotic_typing',
    ],
    'event_targets' => ['editor', 'terminal', 'input', 'other', 'files', 'file-input', 'file-picker', 'directory-picker', 'clipboard-api', 'window'],
    'meta_keys' => ['reportOnly', 'via', 'type', 'kinds', 'perSecond', 'meanMs', 'sdMs', 'count'],

    // One upload carries at most this many events; a workspace stores at most this many in total.
    'max_events_per_call' => 50,
    'max_events_per_workspace' => 5000,
    // A report older than this is not believed (it is clamped to this age).
    'max_event_age_hours' => 48,
    'retention_days' => 180,

    // Seconds of "guard confirmed running" one report may add (reports arrive about every 30 s).
    'max_credit_seconds' => 90,
    'first_credit_seconds' => 30,

    /*
    | The curated extension set baked into the image (infra/workspaces/extensions.txt, lower-cased publisher.name).
    | An installed extension that is not on this list is mentioned in the review. Keep in sync with extensions.txt
    | (a test checks it).
    */
    'curated_extensions' => [
        'bmewburn.vscode-intelephense-client', 'onecentlin.laravel-blade', 'dbaeumer.vscode-eslint', 'esbenp.prettier-vscode',
        'bradlc.vscode-tailwindcss', 'vue.volar', 'editorconfig.editorconfig', 'mikestead.dotenv', 'humao.rest-client',
        'ms-python.python', 'ms-python.debugpy', 'ms-python.vscode-python-envs',
        'redhat.java', 'vscjava.vscode-java-debug', 'vscjava.vscode-maven',
        'zhuangtongfa.material-theme', 'dracula-theme.theme-dracula', 'github.github-vscode-theme', 'pkief.material-icon-theme',
    ],

    /*
    | The rules behind the label. Each signal that fires is listed, with its reason, beside the label, so a
    | reviewer sees WHY. Tune here; nothing else needs to change.
    */
    'rules' => [
        // Share of the session during which the guard was confirmed running (strict projects only).
        'coverage_review_below' => 0.90,
        'coverage_attention_below' => 0.50,
        // Only judge coverage once there is a meaningful amount of work to judge.
        'coverage_min_session_seconds' => 1800,

        // Refused pastes are normal for a student with muscle memory; only volume or size is worth a look.
        'blocked_attempts_review' => 10,
        'blocked_chars_review' => 2000,
        'blocked_chars_attention' => 20000,
        'largest_blocked_review' => 800,

        // Typing no person produces.
        'fast_typing_review' => 1,
        'robotic_typing_review' => 1,
        'robotic_typing_attention' => 3,

        // Git history (the first commit, the framework skeleton, is excluded from these).
        'min_commits_review' => 3,
        'single_commit_share_review' => 0.60,
        'single_commit_min_lines' => 800,
        'history_span_minutes_review' => 20,
        'history_min_total_lines' => 600,
    ],

    // Lines in these paths are not counted as the student's work (generated or installed).
    'git_ignore_paths' => '#(^|/)(vendor|node_modules|public/build|storage|bootstrap/cache|\.git)/|(^|/)(package-lock\.json|composer\.lock|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json)$|\.min\.(js|css)$|\.map$#',
];
