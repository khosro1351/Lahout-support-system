# Optional one-time action from an Administrator PowerShell.
# Only this Node program, Private network profile, LAN address and local subnet.
param([Parameter(Mandatory=$true)][string]$LanAddress,[int]$Port=5175)
$ErrorActionPreference='Stop'
$ip=[Net.IPAddress]::Parse($LanAddress)
if($LanAddress -notmatch '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)'){throw 'Private IPv4 address required.'}
$profile=Get-NetConnectionProfile
if(!($profile | Where-Object NetworkCategory -eq 'Private')){throw 'No Private network profile. Review your Wi-Fi trust setting first; this script will not change it.'}
$name='Lahout-Mobile-LAN'
if(Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue){throw 'Rule already exists; inspect it instead of broadening access.'}
New-NetFirewallRule -Name $name -DisplayName 'Lahout mobile local Wi-Fi only' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -LocalAddress $LanAddress -RemoteAddress LocalSubnet -Profile Private -Program (Get-Command node.exe).Source
