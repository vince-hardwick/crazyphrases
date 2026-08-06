[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 4177
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$launcherPath = Join-Path $projectRoot 'tools\word-bank\review-workbench-autostart.mjs'
$logRoot = Join-Path $projectRoot 'output\word-bank-review'
$launcherLog = Join-Path $logRoot 'launcher.log'

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$node = Get-Command node.exe -ErrorAction Stop
$timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK'

"[$timestamp] Starting Word Bank review workbench availability check." | Out-File -LiteralPath $launcherLog -Append -Encoding utf8
& $node.Source $launcherPath --port $Port 2>&1 | Out-File -LiteralPath $launcherLog -Append -Encoding utf8
$exitCode = $LASTEXITCODE
"[$timestamp] Availability check exited with code $exitCode." | Out-File -LiteralPath $launcherLog -Append -Encoding utf8
exit $exitCode
