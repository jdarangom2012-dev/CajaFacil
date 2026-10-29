# ============================================================
# CajaFacil - arranque en modo desarrollo (PostgreSQL local)
# Doble clic en "iniciar-desarrollo.cmd" o:  powershell -ExecutionPolicy Bypass -File iniciar-desarrollo.ps1
# Ajuste estos valores si cambian:
# ============================================================
$DB_PUERTO = "5432"
$DB_CLAVE  = "dev123"
$PG_BIN    = "C:\Program Files\PostgreSQL\16\bin"
$URL       = "http://127.0.0.1:8770"
# ============================================================

$ErrorActionPreference = "Stop"
$Raiz    = $PSScriptRoot
$Backend = Join-Path $Raiz "backend"
$Venv    = Join-Path $Backend ".venv"
$Python  = Join-Path $Venv "Scripts\python.exe"
$Marca   = Join-Path $Venv ".dependencias_ok"
$Reqs    = Join-Path $Backend "requirements.txt"

Write-Host ""
Write-Host "  CajaFacil - modo desarrollo" -ForegroundColor Cyan
Write-Host ""

# 1. Entorno virtual (solo la primera vez)
if (-not (Test-Path $Python)) {
    Write-Host "Creando entorno virtual de Python..." -ForegroundColor Yellow
    if (Get-Command py -ErrorAction SilentlyContinue) { py -m venv $Venv } else { python -m venv $Venv }
}

# 2. Dependencias (la primera vez o si cambia requirements.txt)
if (-not (Test-Path $Marca) -or (Get-Item $Reqs).LastWriteTime -gt (Get-Item $Marca).LastWriteTime) {
    Write-Host "Instalando dependencias (puede tardar un par de minutos)..." -ForegroundColor Yellow
    & $Python -m pip install --upgrade pip --quiet
    & $Python -m pip install -r $Reqs
    if ($LASTEXITCODE -ne 0) { Write-Host "Fallo la instalacion de dependencias." -ForegroundColor Red; Read-Host "Enter para salir"; exit 1 }
    New-Item -ItemType File -Force $Marca | Out-Null
}

# 3. Variables de entorno
$env:CAJAFACIL_DB_PASSWORD = $DB_CLAVE
$env:CAJAFACIL_DB_PORT     = $DB_PUERTO
$env:CAJAFACIL_HOME        = Join-Path $Raiz "_datos"
$env:CAJAFACIL_PG_BIN      = $PG_BIN

# 4. Verificar que PostgreSQL responde
if (Test-Path (Join-Path $PG_BIN "pg_isready.exe")) {
    & (Join-Path $PG_BIN "pg_isready.exe") -h 127.0.0.1 -p $DB_PUERTO | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "PostgreSQL no responde en el puerto $DB_PUERTO. Revise el servicio postgresql-x64-16 (services.msc)." -ForegroundColor Red
        Read-Host "Enter para salir"; exit 1
    }
} else {
    Write-Host "Aviso: no se encontro $PG_BIN (los respaldos no funcionaran). Ajuste `$PG_BIN arriba." -ForegroundColor Yellow
}

# 5. Abrir el navegador cuando el servidor este listo
Start-Job -ArgumentList $URL -ScriptBlock {
    param($u)
    for ($i = 0; $i -lt 60; $i++) {
        try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$u/api/sistema/estado/" | Out-Null; Start-Process $u; break }
        catch { Start-Sleep -Seconds 1 }
    }
} | Out-Null

# 6. Worker en segundo plano: respaldo diario, sincronizacion y aviso de actualizaciones
$worker = Start-Process -FilePath $Python -ArgumentList 'manage.py', 'worker' -WorkingDirectory $Backend -WindowStyle Minimized -PassThru
Write-Host "Worker iniciado (ventana minimizada, PID $($worker.Id))" -ForegroundColor DarkGray

# 7. Servidor (Ctrl+C para detener)
Write-Host "Iniciando en $URL  (Ctrl+C para detener)" -ForegroundColor Green
Set-Location $Backend
try {
    & $Python servidor.py servidor
} finally {
    if ($worker -and -not $worker.HasExited) { Stop-Process -Id $worker.Id -Force -ErrorAction SilentlyContinue }
}
Read-Host "El servidor se detuvo. Enter para cerrar"
