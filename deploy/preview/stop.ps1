# Stop the preview (scheduled task + all its processes). Funnel stays configured; visitors get an error page.
# Run as Administrator:  powershell -ExecutionPolicy Bypass -File deploy\preview\stop.ps1
# -Unpublish also turns Tailscale Funnel off for the preview's port only (the address stops answering until start.ps1 -Publish).
param([switch]$Unpublish)
. "$PSScriptRoot\common.ps1"
Assert-Admin
Stop-Preview
# Only this preview's HTTPS port: "funnel reset" would also remove other apps' serve/funnel config.
if ($Unpublish) { & (Get-Tailscale) funnel "--https=$HttpsPort" off }
Write-Host 'Pratinjau dihentikan.'
