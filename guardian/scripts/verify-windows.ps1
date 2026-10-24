<#
 Proves, on a real Windows machine, that the Guardian's OS-level checks fire:
   1. a program on the denylist is running              -> forbidden_process
   2. an always-on-top click-through overlay            -> overlay_window
   3. a window hidden from screen capture               -> capture_excluded_window
   4. a clean machine reports nothing blocking
 It compiles a tiny probe window, runs the Guardian's one-shot scan (--dump) against it, and cleans up. Nothing is sent
 anywhere. Usage:  powershell -ExecutionPolicy Bypass -File scripts\verify-windows.ps1 [-Exe path\to\aptrun-guardian.exe]
#>
param([string]$Exe = (Join-Path $PSScriptRoot '..\aptrun-guardian.exe'))

$ErrorActionPreference = 'Stop'
$work = Join-Path $env:TEMP ('guardian-verify-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $work | Out-Null
$fail = 0
function Check($name, $ok, $detail = '') { if ($ok) { Write-Host "  PASS  $name" -ForegroundColor Green } else { Write-Host "  FAIL  $name $detail" -ForegroundColor Red; $script:fail++ } }

try {
    Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -OutputAssembly (Join-Path $work 'probe.exe') -OutputType WindowsApplication -TypeDefinition (Get-Content (Join-Path $PSScriptRoot 'OverlayProbe.cs') -Raw)

    Write-Host 'A clean scan'
    $clean = & $Exe --dump | ConvertFrom-Json
    Check 'no overlay on a clean machine' (-not ($clean.findings | Where-Object Type -eq 'overlay_window'))
    Check 'no capture-excluded window on a clean machine' (-not ($clean.findings | Where-Object Type -eq 'capture_excluded_window'))

    Write-Host 'An always-on-top click-through overlay'
    $p = Start-Process (Join-Path $work 'probe.exe') -PassThru
    Start-Sleep -Seconds 2
    $scan = & $Exe --dump | ConvertFrom-Json
    $o = $scan.findings | Where-Object Type -eq 'overlay_window'
    Check 'overlay_window is reported' ($null -ne $o) "(found: $($scan.findings.Type -join ', '))"
    Check 'it names the program that owns it' ($o.Data.name -eq 'probe.exe')
    Check 'and it is a pre-flight blocker' ($o.Blocker -eq $true)
    Stop-Process -Id $p.Id -Force

    Write-Host 'A window hidden from screen sharing (what "invisible AI assistants" use)'
    $p = Start-Process (Join-Path $work 'probe.exe') -ArgumentList 'capture' -PassThru
    Start-Sleep -Seconds 2
    $scan = & $Exe --dump | ConvertFrom-Json
    $c = $scan.findings | Where-Object Type -eq 'capture_excluded_window'
    Check 'capture_excluded_window is reported' ($null -ne $c) "(found: $($scan.findings.Type -join ', '))"
    Check 'with the owning program and the affinity flag' ($c.Data.name -eq 'probe.exe' -and $c.Data.affinity -eq 17)
    Stop-Process -Id $p.Id -Force

    Write-Host 'A program on the denylist'
    $policy = '{"version":"t","beat_ms":2000,"processes":[["ping","remote_control"]],"strings":[],"titles":[],"overlay_allowed":[],"browsers":["chrome"],"categories":{}}'
    $state = Join-Path $env:LOCALAPPDATA 'AptRunGuardian'
    New-Item -ItemType Directory -Force $state | Out-Null
    $stateFile = Join-Path $state 'state.json'
    $backup = if (Test-Path $stateFile) { Get-Content $stateFile -Raw } else { $null }
    try {
        (@{ policy = $policy } | ConvertTo-Json) | Set-Content $stateFile -Encoding UTF8
        $pinger = Start-Process ping.exe -ArgumentList '-n', '20', '127.0.0.1' -PassThru -WindowStyle Hidden
        Start-Sleep -Milliseconds 800
        $scan = & $Exe --dump | ConvertFrom-Json
        $f = $scan.findings | Where-Object { $_.Type -eq 'forbidden_process' -and $_.Data.name -eq 'PING.EXE' }
        Check 'forbidden_process is reported with its category' ($null -ne $f -and $f.Data.category -eq 'remote_control') "(found: $($scan.findings.Type -join ', '))"
        Stop-Process -Id $pinger.Id -Force -ErrorAction SilentlyContinue
    } finally {
        if ($null -ne $backup) { Set-Content $stateFile $backup -Encoding UTF8 -NoNewline } else { Remove-Item $stateFile -Force -ErrorAction SilentlyContinue }
    }

    Write-Host 'A browser started so that another program can drive it'
    $edge = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($edge) {
        $policy = '{"version":"t","beat_ms":2000,"processes":[],"strings":[],"titles":[],"overlay_allowed":[],"browsers":["msedge","chrome"],"categories":{}}'
        $state = Join-Path $env:LOCALAPPDATA 'AptRunGuardian'
        New-Item -ItemType Directory -Force $state | Out-Null
        $stateFile = Join-Path $state 'state.json'
        $backup = if (Test-Path $stateFile) { Get-Content $stateFile -Raw } else { $null }
        $browser = $null
        try {
            (@{ policy = $policy } | ConvertTo-Json) | Set-Content $stateFile -Encoding UTF8
            # a throw-away profile, so this never touches the browser you are using
            $browser = Start-Process $edge -ArgumentList '--headless=new', '--remote-debugging-port=9333', "--user-data-dir=$work\profile", 'about:blank' -PassThru
            Start-Sleep -Seconds 4
            $scan = & $Exe --dump | ConvertFrom-Json
            $f = $scan.findings | Where-Object { $_.Type -eq 'browser_flag' }
            Check 'browser_flag is reported for --remote-debugging-port' ($null -ne $f -and ($f.Data.name -match 'remote-debugging-port')) "(found: $($scan.findings.Type -join ', '))"
            Check 'and it is a pre-flight blocker' ($null -ne $f -and $f[0].Blocker -eq $true)
        } finally {
            if ($browser) { Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match [regex]::Escape("$work\profile") } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }
            if ($null -ne $backup) { Set-Content $stateFile $backup -Encoding UTF8 -NoNewline } else { Remove-Item $stateFile -Force -ErrorAction SilentlyContinue }
        }
    } else {
        Write-Host '  skipped (no Edge or Chrome found)' -ForegroundColor Yellow
    }
} finally {
    Get-Process probe -ErrorAction SilentlyContinue | Stop-Process -Force
    Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}

if ($fail -eq 0) { Write-Host "`nAll checks passed." -ForegroundColor Green } else { Write-Host "`n$fail check(s) failed." -ForegroundColor Red; exit 1 }
