# Run once in PowerShell as Administrator to let iPhone reach Metro over LAN.
$ports = 8081, 8082, 8083
foreach ($port in $ports) {
  $name = "Expo Metro TCP $port"
  $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  if ($existing) { continue }
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Private | Out-Null
  Write-Host "Added firewall rule: $name"
}
Write-Host "Done. Start with: npm start  then on iPhone open exp://<your-pc-lan-ip>:8081 in Expo Go."
