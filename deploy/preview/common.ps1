# Shared paths and helpers for the preview scripts (dot-sourced). Windows PowerShell 5.1 compatible.
$ErrorActionPreference = 'Stop'
$PreviewDir = $PSScriptRoot
$Root = Split-Path (Split-Path $PreviewDir -Parent) -Parent
$Api = Join-Path $Root 'ikn-api'
$Fe = Join-Path $Root 'ikn-fe'
$LogDir = Join-Path $PreviewDir 'logs'
$PidFile = Join-Path $LogDir 'pids.json'
$ConfigFile = Join-Path $PreviewDir 'preview.json'
$FeEnvFile = Join-Path $Fe '.env.production.local'
$TaskName = 'IKN Preview'
$FePort = 3000
$ApiPort = 8000
$ProxyPort = 8080

function Write-Step([string]$text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Cyan }

function Assert-Admin {
    $id = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $id.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Jalankan PowerShell sebagai Administrator (klik kanan > Run as administrator), lalu ulangi perintah ini.'
    }
}

# .env files are written as UTF-8 without BOM (a BOM would corrupt the first key for phpdotenv).
function Write-Utf8NoBom([string]$file, [string[]]$lines) {
    [IO.File]::WriteAllLines($file, $lines, (New-Object Text.UTF8Encoding($false)))
}

function Set-EnvKey([string]$file, [string]$key, [string]$value) {
    $lines = @()
    if (Test-Path $file) { $lines = @([IO.File]::ReadAllLines($file)) }
    $found = $false
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($l in $lines) {
        if ($l -match "^\s*#?\s*$([regex]::Escape($key))=") {
            if (-not $found) { $out.Add("$key=$value") }
            $found = $true
        } else { $out.Add($l) }
    }
    if (-not $found) { $out.Add("$key=$value") }
    Write-Utf8NoBom $file $out.ToArray()
}

function Get-EnvKey([string]$file, [string]$key) {
    if (-not (Test-Path $file)) { return '' }
    foreach ($l in [IO.File]::ReadAllLines($file)) {
        if ($l -match "^\s*$([regex]::Escape($key))=(.*)$") { return $Matches[1].Trim().Trim('"') }
    }
    return ''
}

function Find-Exe([string]$name, [string[]]$fallbacks = @()) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
    foreach ($pattern in $fallbacks) {
        $hit = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return $null
}

function Get-Tailscale {
    $ts = Find-Exe 'tailscale' @('C:\Program Files\Tailscale\tailscale.exe')
    if (-not $ts) { throw 'Tailscale belum terpasang. Pasang dari https://tailscale.com/download/windows lalu login.' }
    return $ts
}

# Public host of this PC on Tailscale, e.g. ikn-demo.tail1234.ts.net
function Get-PreviewHost {
    $ts = Get-Tailscale
    $status = (& $ts status --json) | Out-String | ConvertFrom-Json
    if (-not $status.Self -or -not $status.Self.DNSName) { throw 'Tailscale belum login. Jalankan: tailscale up' }
    return $status.Self.DNSName.TrimEnd('.')
}

function Read-Config {
    if (-not (Test-Path $ConfigFile)) { throw "Belum di-setup ($ConfigFile tidak ada). Jalankan setup.ps1 dulu." }
    return Get-Content $ConfigFile -Raw | ConvertFrom-Json
}

# Run a native command in a folder and stop on a non-zero exit code.
function Invoke-In([string]$dir, [string]$exe, [string[]]$arguments) {
    Push-Location $dir
    try {
        & $exe @arguments
        if ($LASTEXITCODE -ne 0) { throw "Perintah gagal (exit $LASTEXITCODE): $exe $($arguments -join ' ')" }
    } finally { Pop-Location }
}

# Backend dependencies + migrations, then the Next standalone build (same layout as ikn-fe/Dockerfile).
function Build-All($cfg) {
    Write-Step 'Composer install (ikn-api)'
    Invoke-In $Api $cfg.composer @('install', '--no-interaction', '--prefer-dist', '--optimize-autoloader')
    Write-Step 'Migrasi database'
    Invoke-In $Api $cfg.php @('artisan', 'migrate', '--force')
    Invoke-In $Api $cfg.php @('artisan', 'config:clear')

    Write-Step 'npm ci + build (ikn-fe), beberapa menit'
    Invoke-In $Fe $cfg.npm @('ci', '--no-audit', '--no-fund')
    $env:NEXT_TELEMETRY_DISABLED = '1'
    Invoke-In $Fe $cfg.npm @('run', 'build')
    $standalone = Join-Path $Fe '.next\standalone'
    if (-not (Test-Path (Join-Path $standalone 'server.js'))) { throw 'Build Next tidak menghasilkan .next\standalone\server.js.' }
    # Remove first: Copy-Item into an existing folder would nest it (static\static).
    foreach ($pair in @(@('.next\static', '.next\static'), @('public', 'public'))) {
        $dest = Join-Path $standalone $pair[1]
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
        Copy-Item (Join-Path $Fe $pair[0]) $dest -Recurse -Force
    }
}

function Stop-Preview {
    try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction Stop } catch { }
    if (Test-Path $PidFile) {
        $pids = Get-Content $PidFile -Raw | ConvertFrom-Json
        foreach ($p in $pids.PSObject.Properties) {
            if (Get-Process -Id $p.Value -ErrorAction SilentlyContinue) { & taskkill.exe /T /F /PID $p.Value 2>&1 | Out-Null }
        }
        Remove-Item $PidFile -Force
    }
    # Anything still holding the preview ports (e.g. a crashed supervisor's children).
    foreach ($port in @($FePort, $ApiPort, $ProxyPort)) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
            & taskkill.exe /T /F /PID $_.OwningProcess 2>&1 | Out-Null
        }
    }
}
