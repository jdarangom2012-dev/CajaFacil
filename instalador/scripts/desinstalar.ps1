<#
  CajaFacil — quita los servicios. Los datos (C:\ProgramData\CajaFacil) se conservan
  salvo que se use -BorrarDatos (el desinstalador lo pregunta).
#>
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [switch]$BorrarDatos
)
$ErrorActionPreference = 'Continue'
$Nssm  = Join-Path $AppDir 'nssm.exe'
$PgBin = Join-Path $AppDir 'pgsql\bin'
$Datos = Join-Path $env:ProgramData 'CajaFacil'

foreach ($s in 'CajaFacil-Worker', 'CajaFacil-App') {
  if (Get-Service $s -ErrorAction SilentlyContinue) {
    Stop-Service $s -Force -ErrorAction SilentlyContinue
    & $Nssm remove $s confirm | Out-Null
  }
}
if (Get-Service 'CajaFacil-DB' -ErrorAction SilentlyContinue) {
  Stop-Service 'CajaFacil-DB' -Force -ErrorAction SilentlyContinue
  & "$PgBin\pg_ctl.exe" unregister -N 'CajaFacil-DB' | Out-Null
}
Get-NetFirewallRule -DisplayName 'CajaFacil*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule

if ($BorrarDatos) {
  Remove-Item -Recurse -Force $Datos -ErrorAction SilentlyContinue
}
exit 0
