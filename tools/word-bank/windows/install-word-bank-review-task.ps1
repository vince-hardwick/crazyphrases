[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$Replace,
    [switch]$StartNow,
    [ValidateRange(1, 65535)]
    [int]$Port = 4177
)

$ErrorActionPreference = 'Stop'
$taskName = 'Crazy Phrases Word Bank Review'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$runnerPath = Join-Path $projectRoot 'tools\word-bank\windows\start-word-bank-review.ps1'
$userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$existing = Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction SilentlyContinue

Write-Output "TASK: $taskName existing=$([bool]$existing) project_root=$projectRoot port=$Port"
if (-not $Apply) {
    Write-Output 'PREVIEW: install one hidden current-user task triggered at logon.'
    Write-Output 'PREVIEW: the task verifies the expected worktree writer and only auto-recovers a lock from a previous Windows boot.'
    Write-Output 'PREVIEW: no scheduled task was created or changed; rerun with -Apply.'
    if ($existing) {
        Write-Output 'BLOCKED_FOR_APPLY: the governed task already exists; use -Apply -Replace only to replace it deliberately.'
    }
    exit 0
}

if ($existing -and -not $Replace) {
    throw "Scheduled task '$taskName' already exists; refusing to replace it without -Replace."
}

$existingXml = if ($existing) {
    [string](Export-ScheduledTask -TaskName $taskName -TaskPath '\')
} else {
    $null
}
$argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runnerPath`" -Port $Port"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$definition = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description 'Keeps the source-only Crazy Phrases Word Bank review workbench available on loopback after sign-in.'

try {
    Register-ScheduledTask -TaskName $taskName -TaskPath '\' -InputObject $definition -Force | Out-Null
    $installed = Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction Stop
    $installedAction = @($installed.Actions)[0]
    $installedTrigger = @($installed.Triggers)[0]
    if (
        $installedAction.Execute -ne 'powershell.exe' -or
        $installedAction.Arguments -ne $argument -or
        $installedAction.WorkingDirectory -ne $projectRoot -or
        $installedTrigger.CimClass.CimClassName -ne 'MSFT_TaskLogonTrigger' -or
        $installedTrigger.UserId -ne $userId -or
        $installed.Settings.MultipleInstances -ne 'IgnoreNew'
    ) {
        throw "Installed scheduled task '$taskName' does not match the requested action or instance policy."
    }

    if ($StartNow) {
        Start-ScheduledTask -TaskName $taskName -TaskPath '\'
    }
    Write-Output "PASS: registered and verified '$taskName'."
} catch {
    if ($existingXml) {
        Register-ScheduledTask -TaskName $taskName -TaskPath '\' -Xml $existingXml -Force -ErrorAction SilentlyContinue | Out-Null
    } else {
        Unregister-ScheduledTask -TaskName $taskName -TaskPath '\' -Confirm:$false -ErrorAction SilentlyContinue
    }
    throw
}
