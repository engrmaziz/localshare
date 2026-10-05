#Requires -RunAsAdministrator

<#
.SYNOPSIS
  Remove the LocalShare 7421 firewall rule.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\windows\close-firewall.ps1
#>

$ErrorActionPreference = "Stop"
$displayName = "LocalShare 7421"

$existing = Get-NetFirewallRule -DisplayName $displayName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Host "No firewall rule named '$displayName'."
  exit 0
}

Remove-NetFirewallRule -DisplayName $displayName
Write-Host "Removed firewall rule '$displayName'."
