# ============================================================
# CajaFacil Nube - arranque en modo desarrollo (en tu PC)
# Doble clic en "iniciar-nube-desarrollo.cmd"
#   Panel del dueño:     http://127.0.0.1:8790
#   Panel NautilusTech:  http://127.0.0.1:8790/nautilus/
# Usa una base SQLite de pruebas (nube\backend\nube_dev.sqlite3), no toca la de CajaFacil.
# ============================================================
$PUERTO = "8790"

$ErrorActionPreference = "Stop"
$Raiz     = $PSScriptRoot
$Backend  = Join-Path $Raiz "nube\backend"
$Frontend = Join-Path $Raiz "nube\frontend"
$Venv     = Join-Path $Backend ".venv"
$Python   = Join-Path $Venv "Scripts\python.exe"
$Marca    = Join-Path $Venv ".dependencias_ok"
$Reqs     = Join-Path $Backend "requirements.txt"

Write-Host ""
Write-Host "  CajaFacil Nube - modo desarrollo" -ForegroundColor Cyan
Write-Host ""

# 1. Entorno virtual y dependencias de Python (solo la primera vez o si cambian)
if (-not (Test-Path $Python)) {
    Write-Host "Creando entorno virtual de Python..." -ForegroundColor Yellow
    if (Get-Command py -ErrorAction SilentlyContinue) { py -m venv $Venv } else { python -m venv $Venv }
}
if (-not (Test-Path $Marca) -or (Get-Item $Reqs).LastWriteTime -gt (Get-Item $Marca).LastWriteTime) {
    Write-Host "Instalando dependencias de Python..." -ForegroundColor Yellow
    & $Python -m pip install --upgrade pip --quiet
    & $Python -m pip install -r $Reqs
    if ($LASTEXITCODE -ne 0) { Write-Host "Fallo la instalacion de dependencias." -ForegroundColor Red; Read-Host "Enter para salir"; exit 1 }
    New-Item -ItemType File -Force $Marca | Out-Null
}

# 2. Compilar el panel del celular (React)
Set-Location $Frontend
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Host "Instalando dependencias del panel (npm install)..." -ForegroundColor Yellow
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Write-Host "Fallo npm install." -ForegroundColor Red; Read-Host "Enter para salir"; exit 1 }
}
Write-Host "Compilando el panel..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Fallo la compilacion del panel." -ForegroundColor Red; Read-Host "Enter para salir"; exit 1 }

# 3. Base de datos de pruebas y usuario de NautilusTech
$env:NUBE_DEBUG = "1"
Set-Location $Backend
& $Python manage.py migrate --noinput
& $Python manage.py collectstatic --noinput -v 0
$hayAdmin = (& $Python manage.py shell --no-imports -c "from django.contrib.auth import get_user_model as g; print('HAY_ADMIN' if g().objects.filter(is_superuser=True).exists() else 'SIN_ADMIN')" | Out-String)
if ($hayAdmin -notmatch "HAY_ADMIN") {
    Write-Host ""
    Write-Host "Crea tu usuario de NautilusTech para entrar a /nautilus/ :" -ForegroundColor Cyan
    & $Python manage.py createsuperuser
}

# 4. Abrir el navegador cuando el servidor este listo
Start-Job -ArgumentList "http://127.0.0.1:$PUERTO" -ScriptBlock {
    param($u)
    for ($i = 0; $i -lt 60; $i++) {
        try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$u/api/version" | Out-Null; Start-Process "$u/nautilus/"; break }
        catch { Start-Sleep -Seconds 1 }
    }
} | Out-Null

Write-Host ""
Write-Host "Nube de pruebas en http://127.0.0.1:$PUERTO  (Ctrl+C para detener)" -ForegroundColor Green
Write-Host "Para que tu CajaFacil de desarrollo le mande datos, en iniciar-desarrollo.ps1 debe estar:" -ForegroundColor DarkGray
Write-Host '   $env:CAJAFACIL_NUBE_URL = "http://127.0.0.1:8790"' -ForegroundColor DarkGray
& $Python manage.py runserver "127.0.0.1:$PUERTO"
Read-Host "El servidor se detuvo. Enter para cerrar"
