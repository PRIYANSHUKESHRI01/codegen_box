<#
 Checks, from outside, that the AptRun Guardian will work for students on a deployed server - in the order a student meets it.

   powershell -ExecutionPolicy Bypass -File infra/deploy/verify-guardian.ps1 -Api https://aptrun.com/api

 It only READS (plus one deliberately wrong pairing attempt, which the server refuses), so it is safe to run against production at any time.
 -Expected is the SHA-256 that guardian/build.ps1 printed (default: the one in guardian/dist-prod/aptrun-guardian.exe.sha256); the download the
 server hands out must be exactly that file, or students would get an unofficial build and be told "not an official build".
#>
param(
    [string]$Api = 'https://aptrun.com/api',
    [string]$Expected = ''
)

$ErrorActionPreference = 'Stop'
$Api = $Api.TrimEnd('/')
if ($Expected -eq '') {
    $file = Join-Path $PSScriptRoot '..\..\guardian\dist-prod\aptrun-guardian.exe.sha256'
    if (Test-Path $file) { $Expected = ((Get-Content $file -Raw).Trim() -split '\s+')[0].ToLower() }
}

$script:failed = 0
function Check([string]$name, [bool]$ok, [string]$detail = '') {
    if ($ok) { Write-Host ("  PASS  {0}" -f $name) -ForegroundColor Green }
    else { Write-Host ("  FAIL  {0}" -f $name) -ForegroundColor Red; $script:failed++ }
    if ($detail) { Write-Host ("        {0}" -f $detail) -ForegroundColor DarkGray }
}

function Call([string]$method, [string]$url, $body = $null) {
    try {
        $args2 = @{ Uri = $url; Method = $method; UseBasicParsing = $true; TimeoutSec = 60; Headers = @{ Accept = 'application/json' } }
        if ($null -ne $body) { $args2.Body = ($body | ConvertTo-Json -Compress); $args2.ContentType = 'application/json' }
        $r = Invoke-WebRequest @args2
        return [pscustomobject]@{ Status = [int]$r.StatusCode; Headers = $r.Headers; Content = $r.Content; Raw = $r }
    } catch {
        $resp = $_.Exception.Response
        $text = ''
        if ($resp) { try { $text = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch {} }
        return [pscustomobject]@{ Status = $(if ($resp) { [int]$resp.StatusCode } else { 0 }); Headers = @{}; Content = $text; Raw = $null; Error = $_.Exception.Message }
    }
}

Write-Host "Guardian check for $Api" -ForegroundColor Cyan

Write-Host "`n1. The server is up and is the current release" -ForegroundColor Cyan
$plans = Call GET "$Api/public/plans"
Check 'API answers (public/plans)' ($plans.Status -eq 200) "status $($plans.Status)"
$branches = Call GET "$Api/public/branches"
Check 'API is a current release (public/branches exists)' ($branches.Status -eq 200) $(if ($branches.Status -ne 200) { 'status ' + $branches.Status + ' - this server runs an OLDER backend: deploy the latest backend package, run php artisan migrate --force and php artisan route:cache' } else { '' })

Write-Host "`n2. A student can download it" -ForegroundColor Cyan
$tmp = Join-Path ([IO.Path]::GetTempPath()) 'aptrun-guardian-check.exe'
Remove-Item $tmp -ErrorAction SilentlyContinue
$dl = Call GET "$Api/guardian/download"
if ($dl.Status -eq 404 -and $dl.Content -match 'guardian_package_missing') {
    Check 'download route exists' $true
    Check 'installer is on the server' $false 'the route answers "not available": copy aptrun-guardian.exe and aptrun-guardian.json to backend/storage/app/guardian/ and make them readable by the web user'
} elseif ($dl.Status -ne 200) {
    Check 'download route exists and serves the file' $false "status $($dl.Status)$(if ($dl.Status -eq 404) { ' (route missing: old backend, or routes cached before the deploy - run php artisan route:cache)' })"
} else {
    Check 'download route serves the file' $true
    try { Invoke-WebRequest -Uri "$Api/guardian/download" -OutFile $tmp -UseBasicParsing -TimeoutSec 180 } catch { }
    $exists = Test-Path $tmp
    Check 'file arrives' $exists
    if ($exists) {
        $size = (Get-Item $tmp).Length
        $hash = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
        Check 'looks like a Windows program (MZ header, > 1 MB)' ($size -gt 1MB -and [IO.File]::ReadAllBytes($tmp)[0] -eq 0x4D -and [IO.File]::ReadAllBytes($tmp)[1] -eq 0x5A) ("{0:N1} MB" -f ($size / 1MB))
        $served = $dl.Headers['X-Guardian-SHA256']
        if ($served) { Check 'server header matches the bytes it sent' ($served -eq $hash) $hash }
        if ($Expected) { Check 'is exactly the build you released' ($hash -eq $Expected) "served $hash`n        built  $Expected" }
        else { Write-Host '        (no -Expected hash given, and guardian/dist-prod has none: build it first to compare)' -ForegroundColor Yellow }
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

Write-Host "`n3. The server can pair and verify it" -ForegroundColor Cyan
$pair = Call POST "$Api/guardian/pair" @{ code = 'XXXXXXXX'; public_key = ('A' * 43); install_id = 'verify-script'; version = '1.0.0' }
$sodium = $pair.Content -match 'sodium_missing'
Check 'PHP sodium extension is enabled' (-not $sodium) $(if ($sodium) { 'the server answers 503 sodium_missing: enable extension=sodium for PHP-FPM (and php-cli), then reload PHP-FPM' } else { '' })
Check 'pairing endpoint answers (refuses a made-up code, as it should)' ($pair.Status -eq 422 -and $pair.Content -match 'invalid_code') "status $($pair.Status)$(if ($pair.Status -eq 404) { ' (route missing: old backend, or routes cached before the deploy)' })"

Write-Host ''
if ($script:failed -eq 0) { Write-Host 'Everything a student needs is in place.' -ForegroundColor Green; exit 0 }
Write-Host "$script:failed check(s) failed - fix those, then run this again." -ForegroundColor Red
exit 1
