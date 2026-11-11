# Pull the latest code from GitHub and rebuild the preview. Run as Administrator from the repo root:
#   powershell -ExecutionPolicy Bypass -File deploy\preview\update.ps1          (keeps the preview data)
#   powershell -ExecutionPolicy Bypass -File deploy\preview\update.ps1 -Fresh   (also resets data to the demo seed)
param([switch]$Fresh)
. "$PSScriptRoot\common.ps1"
Assert-Admin
$cfg = Read-Config

Write-Step 'Hentikan pratinjau'
Stop-Preview

Write-Step 'git pull'
Invoke-In $Root $cfg.git @('pull', '--ff-only')

Build-All $cfg
if ($Fresh) {
    Write-Step 'Reset data ke data demo + kurs JISDOR'
    Invoke-In $Api $cfg.php @('artisan', 'migrate:fresh', '--seed', '--force')
    Push-Location $Api
    & $cfg.php artisan rates:fetch "--from=$((Get-Date).AddYears(-1).ToString('yyyy-MM-dd'))"
    Pop-Location
}

Write-Step 'Nyalakan lagi'
Start-ScheduledTask -TaskName $TaskName
Write-Host "Selesai. Buka https://$($cfg.host) setelah kira-kira 20 detik."
