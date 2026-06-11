# Install opencode-agent-browser (global OpenCode plugin)
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Invoke-NodeScript {
    param([string]$ScriptPath)
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        & node $ScriptPath
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        return
    }
    $bun = Get-Command bun -ErrorAction SilentlyContinue
    if ($bun) {
        & bun run $ScriptPath
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        return
    }
    Write-Host "Node.js or Bun is required." -ForegroundColor Red
    exit 1
}

Write-Host "opencode-agent-browser installer" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$ab = Get-Command agent-browser -ErrorAction SilentlyContinue
if (-not $ab) {
    Write-Host "`nWarning: agent-browser CLI not found in PATH." -ForegroundColor Yellow
    Write-Host "Install with: npm install -g agent-browser" -ForegroundColor Yellow
}

$chrome = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
$brave = @(
    "${env:ProgramFiles}\BraveSoftware\Brave-Browser\Application\brave.exe",
    "${env:LOCALAPPDATA}\BraveSoftware\Brave-Browser\Application\brave.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome -and -not $brave) {
    Write-Host "`nWarning: Chrome stable or Brave not found." -ForegroundColor Yellow
    Write-Host "Install Google Chrome or Brave. Do NOT use agent-browser install (Chromium)." -ForegroundColor Yellow
} else {
    if ($chrome) { Write-Host "`nChrome stable: $chrome" -ForegroundColor DarkGray }
    if ($brave) { Write-Host "Brave: $brave" -ForegroundColor DarkGray }
}

Write-Host "`nInstalling global OpenCode plugin..." -ForegroundColor Green
Invoke-NodeScript "$PSScriptRoot\scripts\install-global.mjs"

Write-Host "`nDone! Restart OpenCode to activate the plugin." -ForegroundColor Green
Write-Host 'Verify: opencode run "call browserDoctor and show the result"' -ForegroundColor White