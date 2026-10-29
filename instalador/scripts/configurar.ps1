<#
  CajaFacil — configuración posterior a la instalación (la ejecuta el instalador como administrador).
  Es idempotente: se puede volver a correr en una actualización sin perder datos.

  1. Crea C:\ProgramData\CajaFacil (datos, respaldos, logs, imágenes)
  2. Inicializa PostgreSQL portable (si no existe) en ProgramData\CajaFacil\pgdata, puerto 5544, solo localhost
  3. Registra el servicio CajaFacil-DB y crea usuario/base "cajafacil" con contraseña generada
  4. Escribe cajafacil.ini
  5. Registra los servicios CajaFacil-App y CajaFacil-Worker con NSSM y los inicia
#>
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [int]$PuertoDb = 5544,
  [int]$PuertoApp = 8770
)

$ErrorActionPreference = 'Stop'
$Datos   = Join-Path $env:ProgramData 'CajaFacil'
$PgData  = Join-Path $Datos 'pgdata'
$PgBin   = Join-Path $AppDir 'pgsql\bin'
$Nssm    = Join-Path $AppDir 'nssm.exe'
$Exe     = Join-Path $AppDir 'app\cajafacil.exe'
$Ini     = Join-Path $Datos 'cajafacil.ini'
$Log     = Join-Path $Datos 'logs\instalacion.log'

New-Item -ItemType Directory -Force -Path $Datos, (Join-Path $Datos 'logs'), (Join-Path $Datos 'respaldos'), (Join-Path $Datos 'imagenes') | Out-Null
Start-Transcript -Path $Log -Append | Out-Null

function Nueva-Clave([int]$n = 24) {
  $c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $b = New-Object byte[] $n
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  -join ($b | ForEach-Object { $c[$_ % $c.Length] })
}

function Leer-Ini($ruta) {
  $r = @{}
  if (Test-Path $ruta) {
    $sec = ''
    foreach ($l in Get-Content $ruta -Encoding UTF8) {
      if ($l -match '^\s*\[(.+)\]\s*$') { $sec = $Matches[1]; continue }
      if ($l -match '^\s*([^=#;]+?)\s*=\s*(.*)$') { $r["$sec.$($Matches[1])"] = $Matches[2] }
    }
  }
  return $r
}

$ini = Leer-Ini $Ini
$claveApp   = if ($ini['base_datos.clave']) { $ini['base_datos.clave'] } else { Nueva-Clave }
$secretKey  = if ($ini['seguridad.secret_key']) { $ini['seguridad.secret_key'] } else { Nueva-Clave 50 }
$hostApp    = if ($ini['servidor.host']) { $ini['servidor.host'] } else { '127.0.0.1' }
$claveSuperFile = Join-Path $Datos '.pgsuper'

# ── 1. Servicios existentes: detener para actualizar ──────────────────────
foreach ($s in 'CajaFacil-Worker', 'CajaFacil-App') {
  if (Get-Service $s -ErrorAction SilentlyContinue) { Stop-Service $s -Force -ErrorAction SilentlyContinue }
}

# ── 2. PostgreSQL ─────────────────────────────────────────────────────────
if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) {
  Write-Host 'Inicializando base de datos...'
  $claveSuper = Nueva-Clave
  $tmp = Join-Path $env:TEMP ("pw_" + [guid]::NewGuid().ToString('N'))
  Set-Content -Path $tmp -Value $claveSuper -NoNewline -Encoding ASCII
  & "$PgBin\initdb.exe" -D $PgData -U postgres --pwfile=$tmp -A scram-sha-256 -E UTF8 --locale=C | Out-Host
  Remove-Item $tmp -Force
  if ($LASTEXITCODE -ne 0) { throw 'initdb falló' }

  # Ajustes para PCs de tienda (4 GB de RAM o menos)
  Add-Content -Path (Join-Path $PgData 'postgresql.conf') -Encoding UTF8 -Value @"

# ── CajaFacil ──
port = $PuertoDb
listen_addresses = 'localhost'
max_connections = 30
shared_buffers = 128MB
work_mem = 4MB
maintenance_work_mem = 64MB
effective_cache_size = 512MB
wal_compression = on
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%a.log'
log_truncate_on_rotation = on
log_rotation_age = 1d
timezone = 'America/Bogota'
"@
  # La clave del superusuario se guarda protegida (DPAPI de la máquina) para mantenimiento
  Add-Type -AssemblyName System.Security
  $prot = [System.Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($claveSuper), $null, 'LocalMachine')
  [IO.File]::WriteAllBytes($claveSuperFile, $prot)
}

# Permisos: el servicio de PostgreSQL corre como "Servicio de red" (SID S-1-5-20)
& icacls $PgData /grant '*S-1-5-20:(OI)(CI)F' /T /Q | Out-Null

if (-not (Get-Service 'CajaFacil-DB' -ErrorAction SilentlyContinue)) {
  Write-Host 'Registrando servicio CajaFacil-DB...'
  & "$PgBin\pg_ctl.exe" register -N 'CajaFacil-DB' -D $PgData -S auto -w | Out-Host
  & sc.exe description 'CajaFacil-DB' 'Base de datos local de CajaFacil (PostgreSQL)' | Out-Null
  & sc.exe failure 'CajaFacil-DB' reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
}
Start-Service 'CajaFacil-DB'
$intentos = 0
do { Start-Sleep -Seconds 1; $intentos++; & "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $PuertoDb | Out-Null } while ($LASTEXITCODE -ne 0 -and $intentos -lt 60)

# Usuario y base de la aplicación
Add-Type -AssemblyName System.Security
$claveSuper = [Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($claveSuperFile), $null, 'LocalMachine'))
$env:PGPASSWORD = $claveSuper
$existe = & "$PgBin\psql.exe" -h 127.0.0.1 -p $PuertoDb -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='cajafacil'"
if ($existe -ne '1') {
  & "$PgBin\psql.exe" -h 127.0.0.1 -p $PuertoDb -U postgres -c "CREATE ROLE cajafacil LOGIN PASSWORD '$claveApp'" | Out-Host
} else {
  & "$PgBin\psql.exe" -h 127.0.0.1 -p $PuertoDb -U postgres -c "ALTER ROLE cajafacil PASSWORD '$claveApp'" | Out-Null
}
$existeDb = & "$PgBin\psql.exe" -h 127.0.0.1 -p $PuertoDb -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='cajafacil'"
if ($existeDb -ne '1') {
  & "$PgBin\createdb.exe" -h 127.0.0.1 -p $PuertoDb -U postgres -O cajafacil -E UTF8 cajafacil | Out-Host
}
Remove-Item Env:PGPASSWORD

# ── 3. cajafacil.ini ──────────────────────────────────────────────────────
$textoIni = @"
[servidor]
host = $hostApp
puerto = $PuertoApp
modo = principal

[base_datos]
nombre = cajafacil
usuario = cajafacil
clave = $claveApp
host = 127.0.0.1
puerto = $PuertoDb
pg_bin = $PgBin

[seguridad]
secret_key = $secretKey

[nube]
url = https://cajafacil.app
"@
# UTF-8 sin BOM (Set-Content -Encoding UTF8 de PowerShell 5 agrega BOM)
[IO.File]::WriteAllText($Ini, ($textoIni -replace "`r?`n", "`r`n"), (New-Object Text.UTF8Encoding $false))
# Solo administradores y SYSTEM pueden leer el ini (tiene la clave de la base)
& icacls $Ini /inheritance:r /grant '*S-1-5-18:F' '*S-1-5-32-544:F' /Q | Out-Null

# ── 4. Servicios de la aplicación (NSSM) ─────────────────────────────────
function Registrar-Servicio($nombre, $argumento, $descripcion) {
  if (-not (Get-Service $nombre -ErrorAction SilentlyContinue)) {
    & $Nssm install $nombre $Exe $argumento | Out-Null
  } else {
    & $Nssm set $nombre Application $Exe | Out-Null
    & $Nssm set $nombre AppParameters $argumento | Out-Null
  }
  & $Nssm set $nombre AppDirectory (Split-Path $Exe) | Out-Null
  & $Nssm set $nombre DisplayName $nombre | Out-Null
  & $Nssm set $nombre Description $descripcion | Out-Null
  & $Nssm set $nombre Start SERVICE_AUTO_START | Out-Null
  & $Nssm set $nombre DependOnService CajaFacil-DB | Out-Null
  & $Nssm set $nombre AppEnvironmentExtra "CAJAFACIL_HOME=$Datos" | Out-Null
  & $Nssm set $nombre AppStdout (Join-Path $Datos "logs\$nombre.log") | Out-Null
  & $Nssm set $nombre AppStderr (Join-Path $Datos "logs\$nombre.log") | Out-Null
  & $Nssm set $nombre AppRotateFiles 1 | Out-Null
  & $Nssm set $nombre AppRotateBytes 5242880 | Out-Null
  & $Nssm set $nombre AppExit Default Restart | Out-Null
  & $Nssm set $nombre AppRestartDelay 5000 | Out-Null
}
Registrar-Servicio 'CajaFacil-App' 'servidor' 'CajaFacil: aplicación (http://127.0.0.1:8770)'
Registrar-Servicio 'CajaFacil-Worker' 'worker' 'CajaFacil: respaldos automáticos y sincronización con la nube'

Write-Host 'Iniciando CajaFacil...'
Start-Service 'CajaFacil-App'
Start-Service 'CajaFacil-Worker'

# Esperar a que la app escuche (la primera vez crea las tablas: puede tardar). Sin llenar el log de errores.
$ok = $false
for ($i = 0; $i -lt 180; $i++) {
  if (Get-NetTCPConnection -LocalPort $PuertoApp -State Listen -ErrorAction SilentlyContinue) { $ok = $true; break }
  if ((Get-Service 'CajaFacil-App').Status -ne 'Running' -and $i -gt 10) { break }
  Start-Sleep -Seconds 1
}
if ($ok) {
  Write-Host "CajaFacil está funcionando en http://127.0.0.1:$PuertoApp"
} else {
  Write-Warning 'CajaFacil no respondió. Últimas líneas del registro de la aplicación:'
  $logApp = Join-Path $Datos 'logs\CajaFacil-App.log'
  if (Test-Path $logApp) { Get-Content $logApp -Tail 40 | Out-Host }
}
Stop-Transcript | Out-Null
exit 0
