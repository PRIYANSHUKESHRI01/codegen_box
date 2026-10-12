<#
.SYNOPSIS
  Builds the Project Lab workspace image on Windows (Docker Desktop must be running).

.EXAMPLE
  ./build-image.ps1 lite       # ~1.3 GB, enough for a local end-to-end check
  ./build-image.ps1 full       # ~3.5 GB, the production image
#>
param(
    [ValidateSet('full', 'lite')][string]$Flavor = 'full',
    [string]$Tag = 'aptrun/workspace:latest'
)

$ErrorActionPreference = 'Stop'

docker version --format '{{.Server.Version}}' | Out-Null   # fails clearly if the daemon isn't running
if (-not (docker network ls --filter name=^aptrun-workspaces$ --format '{{.Name}}')) {
    docker network create aptrun-workspaces | Out-Null
}

Write-Host "Building $Tag ($Flavor)..."
docker build --build-arg "FLAVOR=$Flavor" -t $Tag $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
Write-Host "Built $Tag."
