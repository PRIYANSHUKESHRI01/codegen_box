<#
 Makes the zip students download: the program, a one-click "register the Open Guardian link" file, and a plain-language
 README. Run build.ps1 first.

   powershell -ExecutionPolicy Bypass -File package.ps1 [-Api https://api.example.com/api]

 If -Api is given, a guardian.json next to the program presets the server (useful when ONE installer serves several colleges
 with different servers; otherwise the address baked in by build.ps1 is used).
#>
param(
    [string]$Api = '',
    [string]$Dist = (Join-Path $PSScriptRoot 'dist'),
    # Where the AptRun server looks for the installer it offers students (its GUARDIAN_PACKAGE_PATH folder). For a local server this is
    # the default below; for a VPS, copy the same two files there (see docs/exam-integrity.md).
    [string]$Publish = ''
)

$ErrorActionPreference = 'Stop'
$exe = Join-Path $Dist 'aptrun-guardian.exe'
if (-not (Test-Path $exe)) { throw 'dist\aptrun-guardian.exe not found - run build.ps1 first' }

$stage = Join-Path $Dist 'AptRun-Guardian'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item $exe $stage

if ($Api) { (@{ api = $Api } | ConvertTo-Json) | Set-Content (Join-Path $stage 'guardian.json') -Encoding ASCII }

@'
@echo off
rem Registers the "Open Guardian" button on exam pages for THIS Windows user (no administrator rights needed).
"%~dp0aptrun-guardian.exe" --install
pause
'@ | Set-Content (Join-Path $stage 'Set up the Open Guardian button.cmd') -Encoding ASCII

@'
AptRun Guardian
===============

What it is
  A small program that runs next to your exam page and reports what your computer is doing - which programs and windows
  are open, how many screens are connected, and your network settings - so that nobody (including a modified web page)
  can hide it. It is required for some exams and optional for others.

What it does NOT do
  It does not read your files, your messages, your browsing or what you type. It only counts whether keystrokes come from
  a real keyboard. It has no ability to change anything on your computer. It stops reporting when you close its window.

How to use it
  1. On the exam page, next to "AptRun Guardian", choose "Connect". The page shows a short code.
  2. Double-click aptrun-guardian.exe and type the code. The first time, it also sets itself up so that the page's
     "Open Guardian" button starts it for you from then on (you can delete this download afterwards).
  3. Keep its window open for the whole exam. The page turns the Guardian row green when it is working.

Before an exam
  Close chat apps, meeting apps (Teams, Zoom), screen recorders, VPNs and remote-access tools. The exam page lists
  anything that stops you from starting, and nothing is held against you for what you close BEFORE you press Start.

Windows may say "Windows protected your PC"
  That message appears for any program that is new to Microsoft's reputation system. Choose "More info" > "Run anyway",
  or ask your institution to confirm the download's SHA-256 against the one in aptrun-guardian.exe.sha256.

Support: aptrun-guardian.exe --dump   prints everything the Guardian would report, for you to read.
         aptrun-guardian.exe --forget disconnects it and deletes what it saved.
'@ | Set-Content (Join-Path $stage 'README.txt') -Encoding ASCII

$zip = Join-Path $Dist 'AptRun-Guardian.zip'
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Write-Host "Packaged $zip" -ForegroundColor Green

# The page's "Download" button serves aptrun-guardian.exe (+ its version file) from the server itself - nothing else to host.
if ($Publish -ne '') {
    if ($Publish -eq 'local') { $Publish = Join-Path $PSScriptRoot '..\backend\storage\app\guardian' }
    New-Item -ItemType Directory -Force $Publish | Out-Null
    Copy-Item $exe $Publish -Force
    $meta = Join-Path $Dist 'aptrun-guardian.json'
    if (Test-Path $meta) { Copy-Item $meta $Publish -Force }
    Write-Host "Published to $((Resolve-Path $Publish).Path) - the exam page now offers it (GET /api/guardian/download)." -ForegroundColor Green
} else {
    Write-Host "Put aptrun-guardian.exe and aptrun-guardian.json in the server's backend\storage\app\guardian (or run again with -Publish local)."
    Write-Host "To host the file elsewhere instead, set GUARDIAN_DOWNLOAD_URL on the server."
}
