<#
  CajaFacil — activa/desactiva el modo multicaja en el PC principal.
  Con -Activar, la app escucha en la red local (0.0.0.0:8770) y se abre el puerto en el firewall
  SOLO para redes privadas. Las otras cajas (PC, tablet o celular) entran con http://IP-DEL-PRINCIPAL:8770
  La base de datos sigue escuchando únicamente en este equipo.
  Ejecutar como administrador:  powershell -ExecutionPolicy Bypass -File multicaja.ps1 -Activar
#>
param([switch]$Activar, [switch]$Desactivar, [int]$Puerto = 8770)

$Ini = Join-Path $env:ProgramData 'CajaFacil\cajafacil.ini'
if (-not (Test-Path $Ini)) { throw "No se encontró $Ini" }
$contenido = Get-Content $Ini -Encoding UTF8
$hostNuevo = if ($Activar) { '0.0.0.0' } else { '127.0.0.1' }
$contenido = $contenido -replace '^\s*host\s*=\s*(127\.0\.0\.1|0\.0\.0\.0)\s*$', "host = $hostNuevo"
# Solo la sección [servidor] usa 0.0.0.0; la base de datos queda en 127.0.0.1
$salida = @(); $seccion = ''
foreach ($l in $contenido) {
  if ($l -match '^\s*\[(.+)\]') { $seccion = $Matches[1] }
  if ($seccion -eq 'base_datos' -and $l -match '^\s*host\s*=') { $l = 'host = 127.0.0.1' }
  $salida += $l
}
[IO.File]::WriteAllLines($Ini, [string[]]$salida, (New-Object Text.UTF8Encoding $false))

Get-NetFirewallRule -DisplayName 'CajaFacil multicaja' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if ($Activar) {
  New-NetFirewallRule -DisplayName 'CajaFacil multicaja' -Direction Inbound -Protocol TCP -LocalPort $Puerto -Action Allow -Profile Private | Out-Null
}
Restart-Service 'CajaFacil-App'
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress
if ($Activar) { Write-Host "Multicaja activado. En las otras cajas abra: http://$ip`:$Puerto" -ForegroundColor Green }
else { Write-Host 'Multicaja desactivado: CajaFacil solo responde en este equipo.' }
