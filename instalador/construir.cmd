@echo off
rem CajaFacil - compila el instalador. Uso: doble clic, o "construir.cmd -SinFrontend"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0construir.ps1" %*
pause
