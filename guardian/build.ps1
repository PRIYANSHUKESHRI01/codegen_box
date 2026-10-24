<#
 Builds the AptRun Guardian for Windows (one static executable, no installer, no third-party code) and prints its SHA-256.

   powershell -ExecutionPolicy Bypass -File build.ps1 -Version 1.0.0 -Api https://api.example.com/api

 -Api is baked in as the default server, so students never have to type it (it can still be overridden by guardian.json
 next to the program, the APTRUN_API variable, the --api flag, or the link on the exam page).

 The printed hash is what goes into GUARDIAN_ALLOWED_BUILDS on the server: with that set, only builds you released can pair.
#>
param(
    [string]$Version = '1.0.0',
    [string]$Api = '',
    [string]$Out = (Join-Path $PSScriptRoot 'dist')
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force $Out | Out-Null

Write-Host "Testing..." -ForegroundColor Cyan
# (go vet is deliberately not run here: its "possible misuse of unsafe.Pointer" notes are the expected cost of reading Win32 structures.)
$ErrorActionPreference = 'Continue'
go test ./...
if ($LASTEXITCODE -ne 0) { throw 'tests failed' }
$ErrorActionPreference = 'Stop'

Write-Host "Building $Version..." -ForegroundColor Cyan
$env:GOOS = 'windows'; $env:GOARCH = 'amd64'; $env:CGO_ENABLED = '0'
$exe = Join-Path $Out 'aptrun-guardian.exe'
# -s -w strips symbols; -trimpath removes the build machine's folder names from the binary.
$ErrorActionPreference = 'Continue'
go build -trimpath -ldflags "-s -w -X main.version=$Version -X main.defaultAPI=$Api" -o $exe .
if ($LASTEXITCODE -ne 0) { throw 'build failed' }
$ErrorActionPreference = 'Stop'

$hash = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLower()
"$hash  aptrun-guardian.exe" | Set-Content (Join-Path $Out 'aptrun-guardian.exe.sha256') -Encoding ASCII
# Read by the server (next to the program it serves) so the exam page can say which version it is offering.
(@{ version = $Version; sha256 = $hash } | ConvertTo-Json) | Set-Content (Join-Path $Out 'aptrun-guardian.json') -Encoding ASCII

Write-Host ''
Write-Host "Built   $exe  ($([math]::Round((Get-Item $exe).Length / 1MB, 1)) MB)" -ForegroundColor Green
Write-Host "SHA-256 $hash" -ForegroundColor Green
Write-Host ''
Write-Host 'Next: add this hash to GUARDIAN_ALLOWED_BUILDS in the server .env (comma-separated for several releases),'
Write-Host 'then run package.ps1 -Publish local (or copy dist\aptrun-guardian.exe + .json to the server''s backend/storage/app/guardian).'
