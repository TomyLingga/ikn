# One-time setup of the client preview on an always-on Windows PC, published with Tailscale Funnel.
# Run as Administrator from the repo root:
#   powershell -ExecutionPolicy Bypass -File deploy\preview\setup.ps1 -DbPassword "<password user postgres>"
# Safe to run again (e.g. after renaming the machine in Tailscale): env files are rewritten, the app rebuilt.
# -Fresh drops and reseeds the preview database (all data reset to the demo seed).
param(
    [Parameter(Mandatory = $true)][string]$DbPassword,
    [string]$DbUser = 'postgres',
    [string]$DbName = 'ikn_preview',
    [string]$DbHost = '127.0.0.1',
    [int]$DbPort = 5432,
    [string]$AdminPassword = '',   # password for superadmin@ptikn.com on first seed (default: "password")
    [switch]$Fresh
)
. "$PSScriptRoot\common.ps1"
Assert-Admin

Write-Step 'Cek program yang dibutuhkan'
$cfg = [ordered]@{
    php      = Find-Exe 'php' @('C:\php\php.exe', 'C:\tools\php*\php.exe')
    composer = Find-Exe 'composer.bat' @('C:\ProgramData\ComposerSetup\bin\composer.bat')
    node     = Find-Exe 'node' @('C:\Program Files\nodejs\node.exe')
    npm      = Find-Exe 'npm.cmd' @('C:\Program Files\nodejs\npm.cmd')
    psql     = Find-Exe 'psql' @('C:\Program Files\PostgreSQL\*\bin\psql.exe')
    git      = Find-Exe 'git' @('C:\Program Files\Git\cmd\git.exe')
}
$missing = @($cfg.Keys | Where-Object { -not $cfg[$_] })
if ($missing.Count) { throw "Belum terpasang / tidak ada di PATH: $($missing -join ', '). Lihat README.md bagian 1." }
foreach ($k in $cfg.Keys) { Write-Host ("  {0,-9} {1}" -f $k, $cfg[$k]) }
$mods = @(& $cfg.php -m | ForEach-Object { $_.Trim().ToLower() })
$needExt = @('pdo_pgsql', 'pgsql', 'mbstring', 'openssl', 'fileinfo', 'gd', 'curl', 'zip', 'bcmath')
$noExt = @($needExt | Where-Object { $mods -notcontains $_ })
if ($noExt.Count) { throw "Extension PHP belum aktif di php.ini: $($noExt -join ', ')" }

Write-Step 'Alamat Tailscale'
$hostName = Get-PreviewHost
$url = "https://$hostName"
Write-Host "  $url"
$cfg['host'] = $hostName
$cfg | ConvertTo-Json | Set-Content $ConfigFile
$cfg = Read-Config

Write-Step 'Database'
$env:PGPASSWORD = $DbPassword
$exists = (& $cfg.psql -h $DbHost -p $DbPort -U $DbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName'") | Out-String
if ($LASTEXITCODE -ne 0) { throw 'Tidak bisa masuk ke PostgreSQL. Cek password user postgres dan service PostgreSQL.' }
$newDb = $exists.Trim() -ne '1'
if ($newDb) { & $cfg.psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "CREATE DATABASE `"$DbName`" ENCODING 'UTF8'" | Out-Null; Write-Host "  dibuat: $DbName" }
else { Write-Host "  sudah ada: $DbName" }
Remove-Item Env:PGPASSWORD

Write-Step 'File env'
$apiEnv = Join-Path $Api '.env'
if (-not (Test-Path $apiEnv)) { Copy-Item (Join-Path $Api '.env.example') $apiEnv }
$apiValues = [ordered]@{
    APP_ENV = 'staging'; APP_DEBUG = 'false'; APP_URL = $url; FRONTEND_URL = $url
    CORS_ALLOWED_ORIGINS = $url; SANCTUM_STATEFUL_DOMAINS = $hostName; SESSION_DOMAIN = ''
    SESSION_SECURE_COOKIE = 'true'; TRUSTED_PROXIES = '*'
    DB_HOST = $DbHost; DB_PORT = "$DbPort"; DB_DATABASE = $DbName; DB_USERNAME = $DbUser; DB_PASSWORD = $DbPassword
    JISDOR_USER_AGENT = "`"IKN-Preview/1.0 (+$url)`""
}
if ($AdminPassword) { $apiValues['SEED_SUPER_ADMIN_PASSWORD'] = $AdminPassword }
foreach ($k in $apiValues.Keys) { Set-EnvKey $apiEnv $k $apiValues[$k] }
Write-Utf8NoBom $FeEnvFile @(
    '# Written by deploy/preview/setup.ps1. NEXT_PUBLIC_* are baked in at build time: rerun setup or update after changing.',
    "NEXT_PUBLIC_API_URL=$url/api/v1",
    "NEXT_PUBLIC_SITE_URL=$url",
    "API_INTERNAL_URL=http://127.0.0.1:$ApiPort/api/v1"
)

Write-Step 'Hentikan pratinjau yang sedang jalan (bila ada)'
Stop-Preview

Build-All $cfg
if (-not (Get-EnvKey $apiEnv 'APP_KEY')) { Invoke-In $Api $cfg.php @('artisan', 'key:generate', '--force') }

if ($newDb -or $Fresh) {
    Write-Step 'Isi data demo (seeder) + kurs JISDOR'
    if ($Fresh) { Invoke-In $Api $cfg.php @('artisan', 'migrate:fresh', '--seed', '--force') }
    else { Invoke-In $Api $cfg.php @('artisan', 'db:seed', '--force') }
    Push-Location $Api
    & $cfg.php artisan rates:fetch "--from=$((Get-Date).AddYears(-1).ToString('yyyy-MM-dd'))"
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Kurs JISDOR gagal diambil (bisa dicoba lagi nanti); aplikasi tetap jalan.' }
    Pop-Location
}
Push-Location $Api; & $cfg.php artisan storage:link 2>&1 | Out-Null; Pop-Location

Write-Step 'Jalan otomatis saat PC menyala (Task Scheduler)'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $PreviewDir 'run.ps1')`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "  task '$TaskName' terdaftar"

Write-Step 'PC tidak tidur (listrik AC)'
& powercfg.exe /change standby-timeout-ac 0
& powercfg.exe /change hibernate-timeout-ac 0

Write-Step 'Nyalakan pratinjau'
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 20

Write-Step 'Tailscale Funnel (publik)'
$ts = Get-Tailscale
& $ts funnel --bg $ProxyPort
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Funnel belum aktif. Buka tautan yang dicetak Tailscale di atas untuk mengizinkan Funnel, lalu jalankan:'
    Write-Host "    tailscale funnel --bg $ProxyPort"
}

Write-Host ''
Write-Host '=============================================================='
Write-Host "  Alamat pratinjau : $url"
Write-Host '=============================================================='
Write-Host '  Cek dari HP memakai data seluler (bukan Wi-Fi yang sama).'
Write-Host "  Log              : $LogDir"
Write-Host '  Update kode      : deploy\preview\update.ps1   |   Stop: stop.ps1   |   Start: start.ps1'
