<#
.SYNOPSIS
  Builds clean, deploy-only packages of AptRun (Laravel backend + static Next.js frontend) in ./dist.

.DESCRIPTION
  Zipping a working tree is what puts the wrong things on a live server: backend/.env (APP_ENV=local,
  APP_DEBUG=true, every API key), Laravel's route/service caches built on this machine, the scratch SQLite
  DB, uploaded test videos/resumes/CSVs, logs, tests — and a frontend `out/` built with
  NEXT_PUBLIC_API_URL=https://localhost:8000/api, which makes the live site call localhost.

  This script copies only what the server needs, then CHECKS the result before zipping it:
    backend   no .env / sqlite / storage data / bootstrap cache, vendor is a --no-dev install, and none of
              the real secrets from backend/.env appear anywhere in the package (values are never printed)
    frontend  fresh `next build` against -ApiUrl, and no localhost API URL left in out/

  Outputs   dist/backend-deploy.zip   dist/frontend-out.zip   (+ SHA-256 of each — compare on the server)

  Gmail refuses any archive holding .js/.bat/.exe/... files whatever is inside, and these packages
  necessarily contain some (the whole frontend is .js). Send them with Google Drive, SFTP, or the pen drive.

.EXAMPLE
  ./infra/deploy/make-package.ps1 -ApiUrl https://api.yourdomain.com/api
  ./infra/deploy/make-package.ps1 -SkipFrontend       # backend only
#>
param(
    [string]$ApiUrl,
    [switch]$SkipBackend,
    [switch]$SkipFrontend
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null

$gmailBlocked = '\.(js|bat|cmd|exe|dll|jar|vbs|ps1|msi|com|scr|lnk|sys|cab|iso|hta|wsf|apk)$'

function New-Zip([string]$SourceDir, [string]$ZipPath) {
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    # Entries are written one by one with "/" separators. Windows PowerShell 5.1's CreateFromDirectory and
    # Compress-Archive write "\" instead, and Linux unzip then creates files literally named "app\Models\X.php".
    $base = (Resolve-Path $SourceDir).Path.TrimEnd('\') + '\'
    $zip = [System.IO.Compression.ZipFile]::Open($ZipPath, 'Create')
    try {
        foreach ($item in Get-ChildItem $SourceDir -Recurse -Force) {
            $name = $item.FullName.Substring($base.Length).Replace('\', '/')
            if ($item.PSIsContainer) {
                if (-not (Get-ChildItem $item.FullName -Force | Select-Object -First 1)) { $zip.CreateEntry($name + '/') | Out-Null }
            } else {
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $item.FullName, $name, 'Optimal') | Out-Null
            }
        }
    } finally { $zip.Dispose() }

    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        if (@($zip.Entries | Where-Object { $_.FullName.Contains('\') }).Count -gt 0) { throw "$ZipPath has backslash paths" }
        $blocked = @($zip.Entries | Where-Object { $_.FullName -match $gmailBlocked }).Count
    } finally { $zip.Dispose() }
    $size = '{0:N1} MB' -f ((Get-Item $ZipPath).Length / 1MB)
    Write-Host ("  {0}  ({1})" -f $ZipPath, $size)
    Write-Host ("  sha256 {0}" -f (Get-FileHash $ZipPath -Algorithm SHA256).Hash.ToLower())
    if ($blocked -gt 0) { Write-Host "  $blocked file(s) of a type Gmail blocks - do not send this one by Gmail." -ForegroundColor Yellow }
}

function Build-Backend {
    Write-Host 'Backend...'
    $src = Join-Path $root 'backend'
    $stage = Join-Path $dist 'backend'
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }

    $installed = Join-Path $src 'vendor\composer\installed.json'
    if (-not (Test-Path $installed) -or -not (Select-String -Path $installed -Pattern '"dev":\s*false' -Quiet)) {
        throw 'backend/vendor is missing or has dev packages. Run: composer install --no-dev --optimize-autoloader (in backend/)'
    }

    $skipDirs = 'tests', 'node_modules', '.git', '.idea', '.vscode', '.fleet', '.nova', '.zed', '.phpunit.cache',
                'public\storage', 'bootstrap\cache', 'storage\app', 'storage\logs', 'storage\framework' |
                ForEach-Object { Join-Path $src $_ }
    # *.bat / *.exe are Windows-only (vendor/bin proxies, symfony's hiddeninput.exe) — dead weight on Linux.
    $skipFiles = '.env*', '*.sqlite*', '.phpunit.result.cache', '*.zip', 'Dockerfile', 'phpunit.xml', '*.bat', '*.exe',
                 (Join-Path $src 'public\storage')
    robocopy $src $stage /E /XJ /XD $skipDirs /XF $skipFiles /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }

    # Laravel needs these to exist and be writable; they ship empty.
    'bootstrap\cache', 'storage\app\public', 'storage\app\private', 'storage\framework\cache\data',
    'storage\framework\sessions', 'storage\framework\views', 'storage\logs' |
        ForEach-Object { New-Item -ItemType Directory -Force (Join-Path $stage $_) | Out-Null }
    Copy-Item (Join-Path $src '.env.example') $stage -Force

    $files = Get-ChildItem $stage -Recurse -Force -File
    $leaks = $files | Where-Object {
        ($_.Name -like '.env*' -and $_.Name -ne '.env.example') -or
        $_.Extension -in '.sqlite', '.sqlite3' -or
        $_.FullName -like (Join-Path $stage 'storage\*') -or
        $_.FullName -like (Join-Path $stage 'bootstrap\cache\*')
    }
    if ($leaks) { throw ("Dev/runtime files in the package:`n" + (($leaks | ForEach-Object FullName) -join "`n")) }

    # No real secret from the local .env may appear in the package (values are never printed). vendor/ is
    # skipped: it is a stock install of composer.lock (byte-identical to upstream), and it is most of the files.
    $envFile = Join-Path $src '.env'
    if (Test-Path $envFile) {
        $secretKeys = 'APP_KEY', 'DB_PASSWORD', 'REDIS_PASSWORD', 'MAIL_PASSWORD', 'GEMINI_API_KEY',
                      'WHATSAPP_ACCESS_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'SUPERADMIN_PASSWORD'
        $secrets = @{}
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$' -and $secretKeys -contains $Matches[1]) {
                $value = $Matches[2].Trim('"', "'")
                if ($value.Length -ge 8 -and $value -notmatch '^(null|true|false)$') { $secrets[$Matches[1]] = $value }
            }
        }
        if ($secrets.Count -gt 0) {
            $ownFiles = $files | Where-Object { $_.FullName -notlike (Join-Path $stage 'vendor\*') }
            $hits = $ownFiles | Select-String -SimpleMatch -Pattern @($secrets.Values) -List
            if ($hits) {
                $names = foreach ($h in $hits) { ($secrets.GetEnumerator() | Where-Object { $_.Value -eq $h.Pattern }).Key + ' in ' + $h.Path }
                throw ("A secret from backend/.env is inside the package:`n" + ($names -join "`n"))
            }
        }
    }

    New-Zip $stage (Join-Path $dist 'backend-deploy.zip')
}

function Build-Frontend {
    Write-Host 'Frontend...'
    if (-not $ApiUrl) { throw '-ApiUrl is required for the frontend, e.g. -ApiUrl https://api.yourdomain.com/api' }
    if ($ApiUrl -match 'localhost|127\.0\.0\.1|\.local\b') { throw "-ApiUrl must be the live API address, not $ApiUrl" }
    if ($ApiUrl -notmatch '^https://') { Write-Host '  warning: an https site cannot call an http API (mixed content).' -ForegroundColor Yellow }

    $src = Join-Path $root 'frontend'
    $out = Join-Path $src 'out'
    $env:NEXT_PUBLIC_API_URL = $ApiUrl   # a process variable wins over frontend/.env.local (localhost)
    Push-Location $src
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'next build failed' }
    } finally { Pop-Location }

    $pages = Get-ChildItem $out -Recurse -File -Include *.js, *.html, *.txt
    if ($pages | Select-String -Pattern 'localhost:8000|127\.0\.0\.1:8000' -List) {
        throw 'out/ still contains a localhost API URL; the build did not pick up -ApiUrl.'
    }
    if (-not ($pages | Select-String -SimpleMatch -Pattern $ApiUrl -List | Select-Object -First 1)) {
        throw "out/ does not contain $ApiUrl; the build did not pick it up."
    }

    New-Zip $out (Join-Path $dist 'frontend-out.zip')
}

if (-not $SkipBackend) { Build-Backend }
if (-not $SkipFrontend) { Build-Frontend }
Write-Host 'Done. Next: infra/deploy/README.md'
