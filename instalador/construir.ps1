<#
  CajaFacil — construye el instalador en un PC de desarrollo con Windows 10/11.

  Requisitos (una sola vez):
    - Python 3.12 x64      https://www.python.org/downloads/windows/
    - Node.js 20 LTS        https://nodejs.org
    - Inno Setup 6          https://jrsoftware.org/isdl.php

  Uso (PowerShell, en la carpeta instalador):
    powershell -ExecutionPolicy Bypass -File construir.ps1
    powershell -ExecutionPolicy Bypass -File construir.ps1 -PgZip C:\descargas\postgresql-16.x-windows-x64-binaries.zip

  Resultado: instalador\salida\CajaFacil-Instalador-1.0.0.exe
#>
param(
  # Binarios portables de PostgreSQL (ZIP oficial de EnterpriseDB "Windows x86-64 binaries")
  [string]$PgZip = '',
  [string]$PgUrl = 'https://get.enterprisedb.com/postgresql/postgresql-16.10-1-windows-x64-binaries.zip',
  [string]$NssmUrl = 'https://nssm.cc/release/nssm-2.24.zip',
  [switch]$SinFrontend
)
$ErrorActionPreference = 'Stop'
$Raiz      = Split-Path $PSScriptRoot -Parent
$Paquete   = Join-Path $PSScriptRoot 'paquete'
$Descargas = Join-Path $PSScriptRoot 'descargas'
New-Item -ItemType Directory -Force -Path $Paquete, $Descargas | Out-Null

function Paso($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

# 1. Frontend
if (-not $SinFrontend) {
  Paso 'Compilando frontend (React)'
  Push-Location (Join-Path $Raiz 'frontend')
  npm ci; if ($LASTEXITCODE) { throw 'npm ci falló' }
  npm run build; if ($LASTEXITCODE) { throw 'npm run build falló' }
  Pop-Location
}

# 2. Backend con PyInstaller
Paso 'Empaquetando backend (PyInstaller)'
# PyInstaller arranca Django para analizarlo: que no toque C:\ProgramData\CajaFacil
# (en este PC puede estar CajaFacil instalado y sus archivos son del servicio).
$env:CAJAFACIL_HOME = Join-Path $PSScriptRoot 'build_home'
$env:CAJAFACIL_SIN_LOG_ARCHIVO = '1'
Push-Location (Join-Path $Raiz 'backend')
if (-not (Test-Path '.venv-build')) { py -3.12 -m venv .venv-build }
& .\.venv-build\Scripts\python.exe -m pip install --upgrade pip
& .\.venv-build\Scripts\pip.exe install -r requirements.txt pyinstaller
& .\.venv-build\Scripts\pyinstaller.exe cajafacil.spec --noconfirm --clean
if ($LASTEXITCODE) { throw 'PyInstaller falló' }
Pop-Location
Remove-Item -Recurse -Force (Join-Path $Paquete 'app') -ErrorAction SilentlyContinue
Copy-Item -Recurse (Join-Path $Raiz 'backend\dist\cajafacil') (Join-Path $Paquete 'app')

# 3. PostgreSQL portable
Paso 'Preparando PostgreSQL portable'
if (-not $PgZip) {
  $PgZip = Join-Path $Descargas (Split-Path $PgUrl -Leaf)
  if (-not (Test-Path $PgZip)) {
    Write-Host "Descargando $PgUrl"
    Invoke-WebRequest -UseBasicParsing $PgUrl -OutFile $PgZip
  }
}
$tmpPg = Join-Path $Descargas 'pg_extraido'
Remove-Item -Recurse -Force $tmpPg -ErrorAction SilentlyContinue
Expand-Archive $PgZip -DestinationPath $tmpPg
$origen = Join-Path $tmpPg 'pgsql'
Remove-Item -Recurse -Force (Join-Path $Paquete 'pgsql') -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $Paquete 'pgsql') | Out-Null
foreach ($c in 'bin', 'lib', 'share') { Copy-Item -Recurse (Join-Path $origen $c) (Join-Path $Paquete "pgsql\$c") }
# Quitar lo que no se necesita en la tienda (pgAdmin, símbolos, docs)
Remove-Item -Recurse -Force (Join-Path $Paquete 'pgsql\bin\*.pdb'), (Join-Path $Paquete 'pgsql\lib\*.pdb') -ErrorAction SilentlyContinue

# 4. NSSM
Paso 'Preparando NSSM'
$nssmZip = Join-Path $Descargas 'nssm.zip'
if (-not (Test-Path $nssmZip)) { Invoke-WebRequest -UseBasicParsing $NssmUrl -OutFile $nssmZip }
$tmpN = Join-Path $Descargas 'nssm'
Remove-Item -Recurse -Force $tmpN -ErrorAction SilentlyContinue
Expand-Archive $nssmZip -DestinationPath $tmpN
Copy-Item (Get-ChildItem $tmpN -Recurse -Filter nssm.exe | Where-Object { $_.FullName -match 'win64' } | Select-Object -First 1).FullName (Join-Path $Paquete 'nssm.exe') -Force

# 5. Inno Setup
Paso 'Compilando instalador (Inno Setup)'
$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { $iscc = (Get-Command ISCC.exe -ErrorAction SilentlyContinue).Source }
if (-not $iscc) { throw 'No se encontró Inno Setup 6 (ISCC.exe).' }
& $iscc (Join-Path $PSScriptRoot 'CajaFacil.iss')
if ($LASTEXITCODE) { throw 'ISCC falló' }
Write-Host "`nListo: $(Join-Path $PSScriptRoot 'salida')" -ForegroundColor Green
