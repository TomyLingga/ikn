# Supervisor started by the "IKN Preview" scheduled task at boot: runs the API, scheduler, Next server and proxy,
# and restarts any of them that exits. Logs: deploy\preview\logs\*.log. Stop with stop.ps1.
. "$PSScriptRoot\common.ps1"
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $LogDir | Out-Null
$cfg = Read-Config
$supLog = Join-Path $LogDir 'supervisor.log'
function Log([string]$m) { Add-Content -Path $supLog -Value "$(Get-Date -Format 's') $m" }

$standalone = Join-Path $Fe '.next\standalone'
$defs = @(
    @{ name = 'api'; exe = $cfg.php; cwd = (Join-Path $Api 'public'); args = @('-S', "127.0.0.1:$ApiPort", "`"$(Join-Path $Api 'server.php')`""); env = @{} },
    @{ name = 'scheduler'; exe = $cfg.php; cwd = $Api; args = @('artisan', 'schedule:work'); env = @{} },
    @{ name = 'fe'; exe = $cfg.node; cwd = $standalone; args = @('server.js');
       env = @{ PORT = "$FePort"; HOSTNAME = '127.0.0.1'; NODE_ENV = 'production'; NEXT_TELEMETRY_DISABLED = '1';
                API_INTERNAL_URL = (Get-EnvKey $FeEnvFile 'API_INTERNAL_URL') } },
    @{ name = 'proxy'; exe = $cfg.node; cwd = $PreviewDir; args = @("`"$(Join-Path $PreviewDir 'proxy.js')`"");
       env = @{ PREVIEW_PORT = "$ProxyPort"; PREVIEW_FE_PORT = "$FePort"; PREVIEW_API_PORT = "$ApiPort" } }
)
$procs = @{}

function Start-One($d) {
    foreach ($k in $d.env.Keys) { Set-Item -Path "Env:$k" -Value $d.env[$k] }
    $p = Start-Process -FilePath $d.exe -ArgumentList $d.args -WorkingDirectory $d.cwd -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $LogDir "$($d.name).log") -RedirectStandardError (Join-Path $LogDir "$($d.name).err.log")
    foreach ($k in $d.env.Keys) { Remove-Item -Path "Env:$k" -ErrorAction SilentlyContinue }
    $procs[$d.name] = $p
    Log "start $($d.name) pid $($p.Id)"
}

function Save-Pids {
    $o = @{}
    foreach ($k in $procs.Keys) { $o[$k] = $procs[$k].Id }
    $o['supervisor'] = $PID
    $o | ConvertTo-Json | Set-Content $PidFile
}

Log "supervisor up (pid $PID)"
foreach ($d in $defs) { Start-One $d }
Save-Pids

while ($true) {
    Start-Sleep -Seconds 15
    $changed = $false
    foreach ($d in $defs) {
        $p = $procs[$d.name]
        if ($p.HasExited) {
            Log "$($d.name) exited (code $($p.ExitCode)), restarting"
            Start-Sleep -Seconds 3
            Start-One $d
            $changed = $true
        }
    }
    if ($changed) { Save-Pids }
}
