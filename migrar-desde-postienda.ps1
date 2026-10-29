# ============================================================
# CajaFacil - Migrar los datos de PosTienda (PosFácil web) a CajaFacil
#
# Uso (PowerShell):
#   powershell -ExecutionPolicy Bypass -File migrar-desde-postienda.ps1 -Backup "D:\Obras\PosTienda\db\backup_produccion.sql"
#
# Qué hace:
#   1. Restaura el backup de PosTienda en una base temporal "postienda_import"
#   2. BORRA y crea de nuevo la base de CajaFacil (se pide confirmación)
#   3. Crea las tablas de CajaFacil e importa: negocio, usuarios (mismas contraseñas), categorías,
#      productos y stock, clientes, fiados y abonos, ventas, cierres, movimientos y auditoría
#   4. Muestra una verificación: totales de PosTienda vs. CajaFacil
# ============================================================
param(
    [string]$Backup = "",
    [string]$Tienda = "",                 # código en PosTienda (ej. TIENDA-001); vacío = la única tienda
    [string]$Admin = "",                  # usuario de PosTienda que queda como Administrador; vacío = primer coordinador
    [int]$TopeFiado = -1,                 # -1 = automático; 0 = sin tope
    [switch]$SinHistorial,                # solo catálogo, stock, clientes y saldos (sin ventas ni cierres)
    # Igual que en iniciar-desarrollo.ps1:
    [string]$DB_PUERTO = "5432",
    [string]$DB_CLAVE  = "dev123",
    [string]$PG_BIN    = "C:\Program Files\PostgreSQL\16\bin"
)

$ErrorActionPreference = "Stop"
$Raiz    = $PSScriptRoot
$Backend = Join-Path $Raiz "backend"
$Python  = Join-Path $Backend ".venv\Scripts\python.exe"
$Psql    = Join-Path $PG_BIN "psql.exe"

function Paso($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

if (-not $Backup) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = "Seleccione el backup de PosTienda (.sql o .sql.gz)"
    $dlg.Filter = "Backup PostgreSQL (*.sql;*.gz)|*.sql;*.gz|Todos (*.*)|*.*"
    if ($dlg.ShowDialog() -ne "OK") { Write-Host "Cancelado."; exit 1 }
    $Backup = $dlg.FileName
}
if (-not (Test-Path $Backup)) { throw "No existe el archivo $Backup" }
if (-not (Test-Path $Psql))   { throw "No se encontró $Psql. Ajuste -PG_BIN." }
if (-not (Test-Path $Python)) { throw "No existe el entorno de Python. Ejecute primero iniciar-desarrollo.cmd una vez." }

$sec = Read-Host "Contraseña del usuario 'postgres' de PostgreSQL" -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))

# Si viene comprimido (.gz), descomprimir
if ($Backup.EndsWith(".gz")) {
    Paso "Descomprimiendo backup"
    $sql = $Backup.Substring(0, $Backup.Length - 3)
    $in = [IO.File]::OpenRead($Backup); $out = [IO.File]::Create($sql)
    $gz = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress)
    $gz.CopyTo($out); $gz.Close(); $out.Close(); $in.Close()
    $Backup = $sql
}

Paso "1/3 Restaurando el backup de PosTienda en 'postienda_import'"
& $Psql -h 127.0.0.1 -p $DB_PUERTO -U postgres -q -c "DROP DATABASE IF EXISTS postienda_import;" -c "CREATE DATABASE postienda_import;"
if ($LASTEXITCODE) { throw "No se pudo crear la base temporal (¿contraseña de postgres correcta?)" }
$log = Join-Path $env:TEMP "restaurar_postienda.log"
& $Psql -h 127.0.0.1 -p $DB_PUERTO -U postgres -d postienda_import -q -f $Backup 2> $log | Out-Null
$errores = (Get-Content $log | Where-Object { $_ -match 'ERROR' -and $_ -notmatch 'role .* does not exist|transaction_timeout|restrict' }).Count
Write-Host "Backup restaurado. Avisos ignorables en $log ($errores errores relevantes)."
& $Psql -h 127.0.0.1 -p $DB_PUERTO -U postgres -d postienda_import -tAc "SELECT 'Tiendas: ' || string_agg(codigo || ' (' || nombre || ')', ', ') FROM usuarios_tienda;"

Paso "2/3 Preparando una base de CajaFacil nueva"
Write-Host "ATENCION: se BORRARÁ la base 'cajafacil' actual (lo que hayas probado en CajaFacil se pierde)." -ForegroundColor Yellow
$ok = Read-Host "Escriba SI para continuar"
if ($ok -ne "SI") { Write-Host "Cancelado."; exit 1 }
& $Psql -h 127.0.0.1 -p $DB_PUERTO -U postgres -q `
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='cajafacil' AND pid <> pg_backend_pid();" `
    -c "DROP DATABASE IF EXISTS cajafacil;" -c "CREATE DATABASE cajafacil OWNER cajafacil;" | Out-Null
if ($LASTEXITCODE) { throw "No se pudo recrear la base 'cajafacil'. Cierre CajaFacil (ventana del servidor) e intente de nuevo." }

$env:CAJAFACIL_DB_PASSWORD = $DB_CLAVE
$env:CAJAFACIL_DB_PORT     = $DB_PUERTO
$env:CAJAFACIL_HOME        = Join-Path $Raiz "_datos"
$env:CAJAFACIL_PG_BIN      = $PG_BIN
Set-Location $Backend
& $Python manage.py migrate -v 0
if ($LASTEXITCODE) { throw "Falló la creación de tablas" }

Paso "3/3 Importando los datos"
$argumentos = @("manage.py", "importar_postienda", "--origen-db", "postienda_import", "--origen-usuario", "postgres",
          "--origen-clave", $env:PGPASSWORD, "--origen-puerto", $DB_PUERTO)
if ($Tienda) { $argumentos += @("--tienda", $Tienda) }
if ($Admin)  { $argumentos += @("--admin", $Admin) }
if ($TopeFiado -ge 0) { $argumentos += @("--tope-fiado", "$TopeFiado") }
if ($SinHistorial) { $argumentos += "--sin-historial" }
& $Python @argumentos
$codigo = $LASTEXITCODE
Remove-Item Env:PGPASSWORD
if ($codigo) { throw "La importación falló (no se guardó nada; puede corregir y volver a correr)." }

Write-Host "`nListo. Abra iniciar-desarrollo.cmd y entre con un usuario de PosTienda (misma contraseña)." -ForegroundColor Green
Write-Host "La base temporal 'postienda_import' se puede borrar cuando quiera." -ForegroundColor DarkGray
