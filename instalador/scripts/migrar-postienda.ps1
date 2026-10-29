<#
  CajaFacil — pasa los datos de un cliente que venía de PosFácil web (PosTienda) a CajaFacil instalado.
  Se ejecuta en el PC del cliente, DESPUÉS de instalar CajaFacil.

  Uso: doble clic en "Migrar desde PosFacil.cmd" (carpeta scripts de CajaFacil) o:
    powershell -ExecutionPolicy Bypass -File migrar-postienda.ps1 [-Backup ruta.sql.gz] [-Tienda TIENDA-001]
                                                                  [-Admin usuario] [-TopeFiado 0] [-SinHistorial]

  Qué hace:
    1. Restaura el backup de PosTienda (.sql o .sql.gz) en una base temporal "postienda_import"
    2. Guarda un respaldo de lo que haya hoy en CajaFacil (por si acaso) y deja la base vacía
    3. Importa negocio, usuarios (mismas contraseñas), categorías, productos y stock, clientes,
       fiados y abonos, ventas, cierres, movimientos y auditoría; muestra la verificación
    4. Borra la base temporal y vuelve a encender CajaFacil
#>
param(
  [string]$Backup = '',
  [string]$Tienda = '',
  [string]$Admin = '',
  [int]$TopeFiado = -1,          # -1 = automático; 0 = sin tope
  [switch]$SinHistorial,
  [switch]$ConservarTemporal
)

# ── Pedir permisos de administrador si no los tiene ──────────────────────
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
  $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  foreach ($k in $PSBoundParameters.Keys) {
    $v = $PSBoundParameters[$k]
    if ($v -is [switch]) { if ($v) { $a += "-$k" } } else { $a += @("-$k", "`"$v`"") }
  }
  Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $a -Verb RunAs
  exit
}

$ErrorActionPreference = 'Stop'
$AppDir = Split-Path $PSScriptRoot -Parent
$PgBin  = Join-Path $AppDir 'pgsql\bin'
$Exe    = Join-Path $AppDir 'app\cajafacil.exe'
$Datos  = Join-Path $env:ProgramData 'CajaFacil'
$Ini    = Join-Path $Datos 'cajafacil.ini'
$Psql   = Join-Path $PgBin 'psql.exe'
$Log    = Join-Path $Datos ("logs\migracion_" + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.log')

function Paso($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Fin($codigo) { Stop-Transcript | Out-Null; Read-Host "`nPresione Enter para cerrar"; exit $codigo }

Start-Transcript -Path $Log | Out-Null
try {
  foreach ($r in $Exe, $Psql, $Ini) { if (-not (Test-Path $r)) { throw "No se encontró $r. ¿CajaFacil está instalado?" } }

  # Puerto de la base (del ini)
  $PuertoDb = 5544; $ClaveApp = ''; $sec = ''
  foreach ($l in Get-Content $Ini -Encoding UTF8) {
    if ($l -match '^\s*\[(.+)\]') { $sec = $Matches[1] }
    if ($sec -eq 'base_datos' -and $l -match '^\s*puerto\s*=\s*(\d+)') { $PuertoDb = [int]$Matches[1] }
    if ($sec -eq 'base_datos' -and $l -match '^\s*clave\s*=\s*(\S+)') { $ClaveApp = $Matches[1] }
  }

  # Clave del superusuario de PostgreSQL (la guardó el instalador, protegida para este equipo)
  Add-Type -AssemblyName System.Security
  $prot = [IO.File]::ReadAllBytes((Join-Path $Datos '.pgsuper'))
  $env:PGPASSWORD = [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($prot, $null, 'LocalMachine'))

  # Si el ini quedó sin la clave de CajaFacil (instalación interrumpida), se repara: clave nueva para el usuario
  # "cajafacil" en PostgreSQL y en el ini.
  if (-not $ClaveApp) {
    Write-Host 'Reparando la configuración de la base de datos (faltaba la clave en cajafacil.ini)...' -ForegroundColor Yellow
    $letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $b = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    $ClaveApp = -join ($b | ForEach-Object { $letras[$_ % $letras.Length] })
    & $Psql -h 127.0.0.1 -p $PuertoDb -U postgres -q -c "ALTER ROLE cajafacil WITH LOGIN PASSWORD '$ClaveApp'"
    if ($LASTEXITCODE) { throw 'No se pudo reparar la clave del usuario cajafacil en PostgreSQL.' }
    $lineas = [Collections.Generic.List[string]]::new(); $sec = ''; $puesta = $false
    foreach ($l in Get-Content $Ini -Encoding UTF8) {
      if ($l -match '^\s*\[(.+)\]') {
        if ($sec -eq 'base_datos' -and -not $puesta) { $lineas.Add("clave = $ClaveApp"); $puesta = $true }
        $sec = $Matches[1]
      }
      if ($sec -eq 'base_datos' -and $l -match '^\s*clave\s*=') { $lineas.Add("clave = $ClaveApp"); $puesta = $true; continue }
      $lineas.Add($l)
    }
    if (-not $puesta) { if ($sec -ne 'base_datos') { $lineas.Add('[base_datos]') }; $lineas.Add("clave = $ClaveApp") }
    [IO.File]::WriteAllLines($Ini, [string[]]$lineas, (New-Object Text.UTF8Encoding $false))
    Write-Host 'Configuración reparada.' -ForegroundColor Green
  }

  if (-not $Backup) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = 'Seleccione el backup de PosFácil / PosTienda (.sql o .sql.gz)'
    $dlg.Filter = 'Backup PostgreSQL (*.sql;*.gz)|*.sql;*.gz|Todos (*.*)|*.*'
    if ($dlg.ShowDialog() -ne 'OK') { Write-Host 'Cancelado.'; Fin 1 }
    $Backup = $dlg.FileName
  }
  if (-not (Test-Path $Backup)) { throw "No existe el archivo $Backup" }
  if ((Get-Item $Backup).Length -lt 1024) { throw 'El backup está vacío o dañado (pesa menos de 1 KB). Vuelva a sacarlo en el servidor de PosFácil.' }

  $tmpSql = $null
  if ($Backup.EndsWith('.gz')) {
    Paso 'Descomprimiendo backup'
    $tmpSql = Join-Path $env:TEMP ('postienda_' + [guid]::NewGuid().ToString('N') + '.sql')
    $in = [IO.File]::OpenRead($Backup); $out = [IO.File]::Create($tmpSql)
    $gz = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress)
    $gz.CopyTo($out); $gz.Close(); $out.Close(); $in.Close()
    $Backup = $tmpSql
    if ((Get-Item $Backup).Length -lt 1024) { throw 'El backup está vacío por dentro (el .sql pesa 0 KB). Vuelva a sacarlo en el servidor de PosFácil.' }
  }

  Paso '1/4 Restaurando el backup de PosFácil en una base temporal'
  & $Psql -h 127.0.0.1 -p $PuertoDb -U postgres -q -c 'DROP DATABASE IF EXISTS postienda_import;' -c 'CREATE DATABASE postienda_import;'
  if ($LASTEXITCODE) { throw 'No se pudo crear la base temporal.' }
  $logPg = Join-Path $Datos 'logs\restaurar_postienda.log'
  & $Psql -h 127.0.0.1 -p $PuertoDb -U postgres -d postienda_import -q -f $Backup 2> $logPg | Out-Null
  $errores = (Get-Content $logPg | Where-Object { $_ -match 'ERROR' -and $_ -notmatch 'role .* does not exist|transaction_timeout|restrict' }).Count
  Write-Host "Backup restaurado ($errores errores relevantes; detalle en $logPg)."
  & $Psql -h 127.0.0.1 -p $PuertoDb -U postgres -d postienda_import -tAc "SELECT 'Tiendas en el backup: ' || string_agg(codigo || ' (' || nombre || ')', ', ') FROM usuarios_tienda;"
  if ($LASTEXITCODE) { throw 'El archivo no parece un backup de PosFácil (no tiene la tabla de tiendas).' }

  Paso '2/4 Preparando CajaFacil'
  Write-Host 'ATENCIÓN: lo que haya hoy en CajaFacil en este equipo se reemplaza por los datos de PosFácil.' -ForegroundColor Yellow
  Write-Host '(Antes se guarda un respaldo en la carpeta de respaldos.)' -ForegroundColor Yellow
  if ((Read-Host 'Escriba SI para continuar') -ne 'SI') { Write-Host 'Cancelado.'; Fin 1 }

  foreach ($s in 'CajaFacil-Worker', 'CajaFacil-App') { Stop-Service $s -Force -ErrorAction SilentlyContinue }
  $previo = Join-Path $Datos ('respaldos\antes_de_migrar_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.dump')
  & (Join-Path $PgBin 'pg_dump.exe') -h 127.0.0.1 -p $PuertoDb -U postgres -Fc -f $previo cajafacil
  if ($LASTEXITCODE) { throw 'No se pudo respaldar la base actual; no se cambió nada.' }
  Write-Host "Respaldo de seguridad: $previo"
  & $Psql -h 127.0.0.1 -p $PuertoDb -U postgres -q `
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='cajafacil' AND pid <> pg_backend_pid();" `
      -c 'DROP DATABASE IF EXISTS cajafacil;' -c 'CREATE DATABASE cajafacil OWNER cajafacil;' | Out-Null
  if ($LASTEXITCODE) { throw 'No se pudo preparar la base de CajaFacil.' }

  # CajaFacil usa su propio usuario de la base; la clave del superusuario no debe quedar a la vista del programa
  $claveSuper = $env:PGPASSWORD
  Remove-Item Env:PGPASSWORD
  $env:CAJAFACIL_HOME = $Datos
  $env:CAJAFACIL_DB_PASSWORD = $ClaveApp
  $env:CAJAFACIL_DB_PORT = "$PuertoDb"
  & $Exe manage migrate --verbosity 0
  if ($LASTEXITCODE) { throw 'Falló la creación de tablas.' }

  Paso '3/4 Importando los datos'
  $argumentos = @('importar', '--origen-db', 'postienda_import', '--origen-host', '127.0.0.1', '--origen-puerto', "$PuertoDb",
                  '--origen-usuario', 'postgres', '--origen-clave', $claveSuper)
  if ($Tienda) { $argumentos += @('--tienda', $Tienda) }
  if ($Admin)  { $argumentos += @('--admin', $Admin) }
  if ($TopeFiado -ge 0) { $argumentos += @('--tope-fiado', "$TopeFiado") }
  if ($SinHistorial) { $argumentos += '--sin-historial' }
  & $Exe @argumentos
  if ($LASTEXITCODE) { throw "La importación falló. CajaFacil quedó vacío; corrija y vuelva a ejecutar, o restaure $previo." }

  Paso '4/4 Terminando'
  $env:PGPASSWORD = $claveSuper
  if (-not $ConservarTemporal) {
    & $Psql -h 127.0.0.1 -p $PuertoDb -U postgres -q -c 'DROP DATABASE IF EXISTS postienda_import;' | Out-Null
  }
  foreach ($s in 'CajaFacil-App', 'CajaFacil-Worker') { Start-Service $s }
  Write-Host "`nListo. Abra CajaFácil y entre con un usuario de PosFácil (misma contraseña)." -ForegroundColor Green
  Write-Host 'Revise: stock de algunos productos, saldos de fiado y el tope de fiado en Configuración.'
  Fin 0
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  foreach ($s in 'CajaFacil-App', 'CajaFacil-Worker') { Start-Service $s -ErrorAction SilentlyContinue }
  Fin 1
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($tmpSql) { Remove-Item $tmpSql -Force -ErrorAction SilentlyContinue }
}
