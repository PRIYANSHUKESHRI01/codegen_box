<?php

/*
|--------------------------------------------------------------------------
| Project Lab workspaces (browser VS Code)
|--------------------------------------------------------------------------
|
| Laravel is only the CONTROL PLANE here: it decides who may open a
| workspace, starts and stops it, keeps the hours, takes the submission
| snapshot. The workspaces themselves are plain Docker containers (image in
| infra/workspaces/) running OpenVSCode Server, on one or more separate
| "workspace hosts" — never on the web server, because they run student code.
|
| See docs/project-lab.md for the architecture and the host runbook.
*/

return [

    // Kill switch: false makes "Open workspace" answer 503 while the rest of
    // Project Lab (catalog, SOW, submissions) keeps working.
    'enabled' => (bool) env('WORKSPACES_ENABLED', true),

    /*
    | Which runtime drives the hosts.
    |   docker — the real thing (shells out to the `docker` CLI)
    |   fake   — an in-memory simulation for UI development when Docker isn't
    |            available. It starts nothing; the editor iframe will be empty.
    */
    'runtime' => env('WORKSPACE_RUNTIME', 'docker'),

    'docker_binary' => env('WORKSPACE_DOCKER_BINARY', 'docker'),

    /*
    | Workspace hosts. JSON list in WORKSPACE_HOSTS, e.g.
    |
    |   [{"name":"ws-1","docker_host":"ssh://deploy@ws-1.example.com",
    |     "capacity":24,"domain":"ws.example.com","scheme":"https"}]
    |
    | name         stored on each workspace (its volume lives on that host)
    | docker_host  a DOCKER_HOST value (ssh://… or tcp://… with TLS); empty =
    |              the Docker on this machine (local development)
    | capacity     max live (starting/running) workspaces on the host
    | domain       base domain of the Caddy gateway: workspaces are served at
    |              ws-<id>.<domain> and previews at p<port>--ws-<id>.<domain>
    | scheme       http (local dev) or https
    | tls_verify / cert_path   optional DOCKER_TLS_VERIFY / DOCKER_CERT_PATH
    |
    | The host the app is served from and the workspace domain must share a
    | registrable domain in production (app.example.com / *.ws.example.com):
    | the editor runs in an iframe and relies on first-party cookies.
    */
    'hosts' => json_decode((string) env('WORKSPACE_HOSTS', ''), true) ?: [[
        'name' => 'local',
        'docker_host' => env('WORKSPACE_DOCKER_HOST'),
        'capacity' => (int) env('WORKSPACE_LOCAL_CAPACITY', 4),
        'domain' => env('WORKSPACE_DOMAIN', 'localhost:8081'),
        'scheme' => env('WORKSPACE_SCHEME', 'http'),
    ]],

    'image' => env('WORKSPACE_IMAGE', 'aptrun/workspace:latest'),

    // User-defined Docker network shared by the gateway and every workspace
    // container, so the gateway reaches ws-<id>:<port> by container name.
    'network' => env('WORKSPACE_NETWORK', 'aptrun-workspaces'),

    // Optional OCI runtime for stronger isolation, e.g. "runsc" (gVisor) or
    // "kata-runtime". Null = Docker's default runc. Strongly recommended in production.
    'oci_runtime' => env('WORKSPACE_OCI_RUNTIME'),

    // The editor listens here INSIDE the container. Deliberately not 3000:
    // that's the first port a student's own React/Express app will want.
    'ide_port' => 13370,

    // Preview URLs may target these ports only (the gateway enforces the same range).
    'preview_ports' => ['min' => 1024, 'max' => 65535],

    /*
    | Per-container limits. These are the blast radius of one student's code.
    */
    'limits' => [
        'memory' => env('WORKSPACE_MEMORY', '2g'),
        'cpus' => env('WORKSPACE_CPUS', '1.5'),
        'pids' => (int) env('WORKSPACE_PIDS', 512),
        'tmp_size' => env('WORKSPACE_TMP_SIZE', '1g'),
        // Soft cap on /home/workspace; the reaper stops a workspace above it.
        'disk_mb' => (int) env('WORKSPACE_DISK_MB', 3072),
    ],

    /*
    | Session policy.
    */
    'session' => [
        // The workspace page heartbeats every 60 s; this long without one = tab closed.
        'idle_minutes' => (int) env('WORKSPACE_IDLE_MINUTES', 15),
        'max_session_minutes' => (int) env('WORKSPACE_MAX_SESSION_MINUTES', 480),
        // A single heartbeat is worth at most this many seconds of usage, so a
        // browser that was asleep for an hour cannot bill (or bank) an hour.
        'heartbeat_credit_seconds' => 120,
        // How often the reaper re-measures a running workspace's disk use.
        'disk_check_minutes' => 10,
    ],

    /*
    | Submission snapshots.
    */
    'snapshot' => [
        'disk' => env('WORKSPACE_SNAPSHOT_DISK', 'local'),
        'directory' => 'project-submissions',
        'max_bytes' => (int) env('WORKSPACE_SNAPSHOT_MAX_BYTES', 200 * 1024 * 1024),
        // What the archive leaves out (see App\Services\Workspaces\SnapshotScript).
        // Dependency/build output and tool caches: a reviewer can re-install.
        // Directories pruned at ANY depth:
        'prune_anywhere' => ['node_modules', '__pycache__', '.venv', 'venv', '.next', '.pytest_cache', '.gradle'],
        // …pruned only at the project root or one level down (backend/vendor,
        // frontend/dist) so a source folder that happens to be called "build" deeper in is kept:
        'prune_shallow' => ['vendor', 'dist', 'build', 'target'],
        // …and tool state that lives directly in the home directory:
        'prune_home' => ['.cache', '.npm', '.m2', '.gradle', '.composer', '.local', '.config', '.openvscode-server', '.aptrun', '.lab'],
        // …and directories matched by path at any depth (git's sample hooks are noise in a review archive):
        'prune_paths' => ['*/.git/hooks'],
        // Files that look like secrets or noise are skipped by name…
        'skip_files' => [
            '.env', '.env.*', '*.pem', '*.key', 'id_rsa', 'id_rsa.*', 'id_ed25519', 'id_ed25519.*', '*.log',
            '.bash_logout', '.bashrc', '.profile', '.bash_history', '.python_history', '.node_repl_history', '.lesshst', '.viminfo', '.wget-hsts', '.DS_Store',
        ],
        // …except template env files, which are documentation, not secrets.
        'keep_files' => ['.env.example', '.env.sample', '.env.template'],
    ],

];
