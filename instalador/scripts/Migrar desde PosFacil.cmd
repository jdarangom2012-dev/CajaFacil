@echo off
rem CajaFacil - Migrar los datos de PosFacil web (PosTienda) a este equipo
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0migrar-postienda.ps1" %*
