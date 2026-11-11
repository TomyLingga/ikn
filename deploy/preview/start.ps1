# Start the preview again after stop.ps1 (it also starts by itself at boot).
# Run as Administrator:  powershell -ExecutionPolicy Bypass -File deploy\preview\start.ps1 [-Publish]
param([switch]$Publish)
. "$PSScriptRoot\common.ps1"
Assert-Admin
$cfg = Read-Config
Start-ScheduledTask -TaskName $TaskName
if ($Publish) { & (Get-Tailscale) funnel --bg $ProxyPort }
Write-Host "Pratinjau dinyalakan. Buka https://$($cfg.host) setelah kira-kira 20 detik."
