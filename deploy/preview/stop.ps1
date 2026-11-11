# Stop the preview (scheduled task + all its processes). Funnel stays configured; visitors get an error page.
# Run as Administrator:  powershell -ExecutionPolicy Bypass -File deploy\preview\stop.ps1
# -Unpublish also turns Tailscale Funnel off (the address stops answering until start.ps1 -Publish).
param([switch]$Unpublish)
. "$PSScriptRoot\common.ps1"
Assert-Admin
Stop-Preview
if ($Unpublish) { & (Get-Tailscale) funnel reset }
Write-Host 'Pratinjau dihentikan.'
