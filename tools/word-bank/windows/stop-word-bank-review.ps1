[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 4177
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$reviewDataRoot = Join-Path $projectRoot 'tools\word-bank\review-data'
$lockPath = Join-Path $reviewDataRoot '.review.lock'
$origin = "http://127.0.0.1:$Port"

if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) {
    try {
        Invoke-RestMethod -Uri "$origin/api/health" -TimeoutSec 2 | Out-Null
        throw "$origin is serving a process that does not hold the expected worktree lock; refusing to stop it."
    } catch {
        if ($_.Exception.Message -like "$origin is serving*") {
            throw
        }
        Write-Output 'PASS: the expected Word Bank review writer is already stopped.'
        exit 0
    }
}

$lock = Get-Content -LiteralPath $lockPath -Raw -Encoding utf8 | ConvertFrom-Json
$health = Invoke-RestMethod -Uri "$origin/api/health" -TimeoutSec 2
$expectedProjectRoot = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\')
$actualProjectRoot = [IO.Path]::GetFullPath([string]$health.projectRoot).TrimEnd('\')
$expectedReviewRoot = [IO.Path]::GetFullPath($reviewDataRoot).TrimEnd('\')
$actualReviewRoot = [IO.Path]::GetFullPath([string]$health.reviewDataRoot).TrimEnd('\')

if (
    $health.service -ne 'crazyphrases-word-bank-review' -or
    $health.mode -ne 'writable' -or
    [int]$health.pid -ne [int]$lock.pid -or
    $actualProjectRoot -ine $expectedProjectRoot -or
    $actualReviewRoot -ine $expectedReviewRoot
) {
    throw "$origin is not the verified writer for $projectRoot; refusing to stop it."
}

Invoke-RestMethod -Method Post -Uri "$origin/api/shutdown" -TimeoutSec 2 -Headers @{
    'x-review-owner-token' = [string]$lock.ownerToken
} | Out-Null

$deadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $deadline) {
    if (-not (Test-Path -LiteralPath $lockPath) -and -not (Get-Process -Id ([int]$lock.pid) -ErrorAction SilentlyContinue)) {
        Write-Output "PASS: stopped the Word Bank review writer (PID $($lock.pid)) and released its lock."
        exit 0
    }
    Start-Sleep -Milliseconds 100
}

throw "The Word Bank review writer did not stop cleanly within 10 seconds."
