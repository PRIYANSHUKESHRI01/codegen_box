<#
.SYNOPSIS
  Runs the judge the way production does — Redis queue, real Piston nodes, queue workers,
  and (optionally) several PHP web processes — on a Windows dev machine.

.DESCRIPTION
  Production uses supervisor (infra/judge/supervisor/judge-workers.conf) and PHP-FPM. Windows has
  neither, so this script does the same job with plain processes:

    up      start Redis + the Piston nodes (docker compose), then the queue workers, then -Web
            PHP web processes on -BasePort... (for load tests; your own `php artisan serve` is untouched)
    down    stop the workers and web processes it started (add -All to also stop the containers)
    status  containers, worker/web processes, and `php artisan judge:status`

  Every process it starts runs with the queue and cache on Redis (QUEUE_CONNECTION, CACHE_STORE and
  JUDGE_QUEUE_CONNECTION are set for THEM only; backend/.env stays in inline "sync" mode for normal
  development). Web processes and workers must share one cache and queue, so start both through here.
  To load-test against a scratch database set $env:DB_DATABASE before `up`; it is inherited.

  Sizing: -Workers ≈ total Piston slots × 1.1 (PISTON_NODES in backend/.env: 3 + 3 slots => 7).
  -InteractiveWorkers of them check the Run queue first so Run is never starved behind submissions.

  One-time, first run only: ./infra/judge/install-runtimes.sh (Git Bash) installs the language runtimes.
  Windows PHP has no pcntl, so a worker cannot enforce --timeout itself; the Piston HTTP timeout
  (PISTON_HTTP_TIMEOUT_SECONDS) bounds every job instead.
#>
param(
    [ValidateSet('up', 'down', 'status')][string]$Action = 'status',
    [int]$Workers = 7,
    [int]$InteractiveWorkers = 2,
    [int]$Web = 0,
    [int]$BasePort = 8090,
    [switch]$All
)

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$backend = Join-Path $root 'backend'
$runDir = Join-Path $PSScriptRoot '.run'
$pidFile = Join-Path $runDir 'pids.json'

function Compose([string]$dir, [string[]]$more) {
    $file = Join-Path $root "infra/$dir/docker-compose.yml"
    $envFile = Join-Path $root "infra/$dir/.env"
    $cmd = @('compose', '-f', $file)
    if (Test-Path $envFile) { $cmd += @('--env-file', $envFile) }
    # docker writes progress ("Container x Running") to stderr; under -ErrorAction Stop, Windows
    # PowerShell 5.1 would turn that into a terminating error. Judge success by the exit code instead.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & docker @cmd @more 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "docker compose failed (exit $LASTEXITCODE) for infra/$dir" }
}

function Wait-Healthy([string]$dir, [int]$seconds = 90) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        $states = Compose $dir @('ps', '--format', '{{.Name}}={{.Health}}') | Where-Object { $_ }
        if ($states -and -not ($states | Where-Object { $_ -notmatch '=healthy$' })) { return }
        Start-Sleep -Seconds 2
    }
    throw "infra/$dir did not become healthy in $seconds s (docker compose ps)"
}

function Read-Pids {
    if (-not (Test-Path $pidFile)) { return }
    # Windows PowerShell 5.1 hands a JSON array back as ONE object; enumerate it explicitly.
    $items = Get-Content $pidFile -Raw | ConvertFrom-Json
    foreach ($item in $items) { $item }
}

function Stop-Tracked {
    foreach ($p in Read-Pids) {
        if (Get-Process -Id $p.pid -ErrorAction SilentlyContinue) {
            & taskkill /T /F /PID $p.pid | Out-Null   # the wrapper AND the php child it is running
            Write-Output ("stopped {0} (pid {1})" -f $p.role, $p.pid)
        }
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

switch ($Action) {
    'up' {
        New-Item -ItemType Directory -Force $runDir | Out-Null
        if (Read-Pids | Where-Object { Get-Process -Id $_.pid -ErrorAction SilentlyContinue }) {
            throw "Already running (infra/local/.run/pids.json). Run 'down' first."
        }

        Compose 'redis' @('up', '-d') | Out-Null
        Compose 'judge' @('up', '-d') | Out-Null
        Wait-Healthy 'redis'
        Wait-Healthy 'judge'

        $env:QUEUE_CONNECTION = 'redis'
        $env:CACHE_STORE = 'redis'
        $env:JUDGE_QUEUE_CONNECTION = 'redis'

        $tracked = @()
        $primary = 'judge-contest,judge-submit,judge-run'
        $interactive = 'judge-run,judge-contest,judge-submit'

        for ($i = 1; $i -le $Workers; $i++) {
            $queues = if ($i -le $InteractiveWorkers) { $interactive } else { $primary }
            $loop = "Set-Location '$backend'; while (`$true) { & php artisan queue:work redis --queue=$queues --sleep=0.25 --max-jobs=500 --max-time=3600 --memory=256; Start-Sleep -Seconds 1 }"
            $proc = Start-Process powershell -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $loop) -WindowStyle Hidden -PassThru
            $tracked += [pscustomobject]@{ role = "worker-$i ($queues)"; pid = $proc.Id }
        }

        # Same launch command as `php artisan serve`, plus OPcache (the CLI server has none by default:
        # ~200 ms -> ~20 ms per API request when it is on).
        $router = Join-Path $backend 'vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php'
        for ($i = 0; $i -lt $Web; $i++) {
            $port = $BasePort + $i
            $args = @('-d', 'zend_extension=opcache', '-d', 'opcache.enable_cli=1', '-d', 'opcache.memory_consumption=128', '-d', 'opcache.validate_timestamps=0',
                '-S', "127.0.0.1:$port", $router)
            $proc = Start-Process php -ArgumentList $args -WorkingDirectory (Join-Path $backend 'public') -WindowStyle Hidden -PassThru
            $tracked += [pscustomobject]@{ role = "web :$port"; pid = $proc.Id }
        }

        $tracked | ConvertTo-Json | Set-Content $pidFile
        Write-Output ("up: {0} workers ({1} run-first), {2} web process(es){3}" -f $Workers, $InteractiveWorkers, $Web, $(if ($Web) { " on ports $BasePort..$($BasePort + $Web - 1)" } else { '' }))
    }

    'down' {
        Stop-Tracked
        if ($All) {
            Compose 'judge' @('stop') | Out-Null
            Compose 'redis' @('stop') | Out-Null
            Write-Output 'containers stopped (data volumes kept)'
        }
    }

    'status' {
        Write-Output '--- containers'
        docker ps --filter 'name=judge-piston' --filter 'name=redis-redis' --format '{{.Names}}: {{.Status}}'
        Write-Output '--- processes started by this script'
        foreach ($p in Read-Pids) {
            $alive = [bool](Get-Process -Id $p.pid -ErrorAction SilentlyContinue)
            Write-Output ("{0,-58} pid {1,-6} {2}" -f $p.role, $p.pid, $(if ($alive) { 'running' } else { 'STOPPED' }))
        }
        Write-Output '--- judge:status'
        $env:QUEUE_CONNECTION = 'redis'; $env:CACHE_STORE = 'redis'; $env:JUDGE_QUEUE_CONNECTION = 'redis'
        Push-Location $backend
        try { & php artisan judge:status } finally { Pop-Location }
    }
}
