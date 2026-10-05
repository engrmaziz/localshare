#Requires -RunAsAdministrator

<#
.SYNOPSIS
  Allow inbound TCP 7421 on Private and Domain profiles only.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\windows\open-firewall.ps1
#>

$ErrorActionPreference = "Stop"
$displayName = "LocalShare 7421"

$existing = Get-NetFirewallRule -DisplayName $displayName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule '$displayName' already exists."
} else {
  New-NetFirewallRule `
    -DisplayName $displayName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 7421 `
    -Action Allow `
    -Profile Private,Domain `
    | Out-Null
  Write-Host "Created firewall rule '$displayName' (Inbound TCP 7421, Private+Domain)."
}

Write-Host ""
Write-Host "Network profiles:"
Get-NetConnectionProfile | Format-Table Name, InterfaceAlias, NetworkCategory -AutoSize

$public = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq "Public" }
if ($public) {
  Write-Host "One or more interfaces are Public. Phones on Wi-Fi will be blocked."
  Write-Host "Only on a trusted home/office LAN, switch the profile:"
  foreach ($p in $public) {
    Write-Host "  Set-NetConnectionProfile -InterfaceIndex $($p.InterfaceIndex) -NetworkCategory Private"
  }
}
