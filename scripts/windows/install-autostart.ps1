param(
  [switch]$Highest
)

<#
.SYNOPSIS
  Register a Windows Task Scheduler job that resurrects LocalShare (PM2) at logon.

  Highest privileges require an elevated PowerShell:
    powershell -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1 -Highest

  A current-user logon task (no admin) is the default:
    powershell -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1
#>

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$starter = Join-Path $PSScriptRoot "start-pm2.ps1"
$taskName = "LocalShare"
$node = (Get-Command node -ErrorAction Stop).Source

if (-not (Test-Path $starter)) {
  throw "Missing $starter"
}

$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$starter`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = if ($Highest) {
  New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive
} else {
  New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Limited -LogonType Interactive
}
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered scheduled task '$taskName' (at logon)."
Write-Host "  Project: $root"
Write-Host "  Node:    $node"
Write-Host "  Highest: $Highest"
Write-Host "After PM2 is running, execute: npx pm2 save"
