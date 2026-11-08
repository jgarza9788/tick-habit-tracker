<#
.SYNOPSIS
  Runs Tick natively on Windows (no Docker).

.DESCRIPTION
  Installs dependencies if needed, builds the web app if it is missing or out of date,
  then starts the Node server and opens the app in your browser.
  Data is stored in .\data\habits.json (override with -DataDir).

.EXAMPLE
  .\launcher.ps1
  .\launcher.ps1 -Port 8080 -NoBrowser
  .\launcher.ps1 -Rebuild
#>
[CmdletBinding()]
param(
  [int]$Port = 3000,
  [string]$DataDir,
  [switch]$Rebuild,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root
if (-not $DataDir) { $DataDir = Join-Path $root "data" }

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js 20+ is required. Install it from https://nodejs.org and run this script again."
}
$nodeMajor = [int]((node -v).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) { Write-Error "Node.js 20+ is required (found $(node -v))." }

# Install dependencies when missing or when package-lock.json is newer than node_modules.
$modules = Join-Path $root "node_modules"
$lock = Join-Path $root "package-lock.json"
if (-not (Test-Path $modules) -or (Get-Item $lock).LastWriteTime -gt (Get-Item $modules).LastWriteTime) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -ne 0) { Write-Error "npm ci failed." }
}

# Build when dist is missing or any source file is newer than the build.
$index = Join-Path $root "dist\index.html"
$needsBuild = $Rebuild -or -not (Test-Path $index)
if (-not $needsBuild) {
  $built = (Get-Item $index).LastWriteTime
  $sources = @("src", "public", "index.html", "vite.config.ts", "package.json") |
    ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }
  $newer = Get-ChildItem $sources -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt $built } | Select-Object -First 1
  $needsBuild = [bool]$newer
}
if ($needsBuild) {
  Write-Host "Building..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Error "Build failed." }
}

# Refuse to start if the port is already taken.
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
  Write-Error "Port $Port is already in use. Pick another with -Port."
}

$env:PORT = "$Port"
$env:DATA_DIR = $DataDir
$env:DIST_DIR = Join-Path $root "dist"
$url = "http://localhost:$Port"

Write-Host "Tick running at $url  (data: $DataDir)  - press Ctrl+C to stop" -ForegroundColor Green
if (-not $NoBrowser) {
  # Open the browser shortly after the server starts listening.
  Start-Job -ArgumentList $url -ScriptBlock { param($u) Start-Sleep -Seconds 1; Start-Process $u } | Out-Null
}

node server/index.mjs
