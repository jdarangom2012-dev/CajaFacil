; ============================================================
; CajaFacil — instalador para Windows 10/11 (64 bits)
; Compilar con Inno Setup 6:  ISCC.exe CajaFacil.iss
; Antes, ejecutar construir.ps1 (prepara la carpeta "paquete").
; ============================================================
#define AppName "CajaFácil"
#define AppVersion "1.0.0"
#define AppPublisher "NautilusTech S.A.S."
#define AppURL "https://nautilustech.app"

[Setup]
AppId={{6E2B1C55-4C7F-4D53-9B8E-CA1AFAC10001}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
DefaultDirName={autopf}\CajaFacil
DefaultGroupName=CajaFácil
DisableProgramGroupPage=yes
OutputDir=salida
OutputBaseFilename=CajaFacil-Instalador-{#AppVersion}
SetupIconFile=..\icono.ico
UninstallDisplayIcon={app}\icono.ico
WizardStyle=modern
WizardImageFile=recursos\asistente-grande.bmp
WizardSmallImageFile=recursos\asistente-pequeno.bmp
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
PrivilegesRequired=admin
CloseApplications=yes
ShowLanguageDialog=no
LicenseFile=recursos\terminos.txt

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "escritorio"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"
Name: "inicio"; Description: "Abrir CajaFácil al encender el computador"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Files]
Source: "paquete\app\*";    DestDir: "{app}\app";    Flags: recursesubdirs ignoreversion
Source: "paquete\pgsql\*";  DestDir: "{app}\pgsql";  Flags: recursesubdirs ignoreversion
Source: "paquete\nssm.exe"; DestDir: "{app}";        Flags: ignoreversion
Source: "scripts\*";        DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\icono.ico";     DestDir: "{app}";        Flags: ignoreversion
Source: "..\docs\MANUAL.md";  DestDir: "{app}";        DestName: "Manual de CajaFacil.txt"; Flags: ignoreversion

[Icons]
Name: "{group}\CajaFácil"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\abrir-cajafacil.vbs"""; IconFilename: "{app}\icono.ico"
Name: "{group}\Activar multicaja (red local)"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\multicaja.ps1"" -Activar"; IconFilename: "{app}\icono.ico"
Name: "{group}\Carpeta de respaldos"; Filename: "{commonappdata}\CajaFacil\respaldos"
Name: "{group}\Manual de CajaFácil"; Filename: "{app}\Manual de CajaFacil.txt"
Name: "{group}\Desinstalar CajaFácil"; Filename: "{uninstallexe}"
Name: "{autodesktop}\CajaFácil"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\abrir-cajafacil.vbs"""; IconFilename: "{app}\icono.ico"; Tasks: escritorio
Name: "{autostartup}\CajaFácil"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\abrir-cajafacil.vbs"""; IconFilename: "{app}\icono.ico"; Tasks: inicio

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configurar.ps1"" -AppDir ""{app}"""; \
  StatusMsg: "Configurando la base de datos y los servicios de CajaFácil (puede tardar un minuto)..."; Flags: runhidden waituntilterminated
Filename: "{sys}\wscript.exe"; Parameters: """{app}\scripts\abrir-cajafacil.vbs"""; Description: "Abrir CajaFácil ahora"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\desinstalar.ps1"" -AppDir ""{app}"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "QuitarServicios"

[Code]
// Antes de copiar archivos en una actualización: detener servicios para liberar los .exe
function PrepareToInstall(var NeedsRestart: Boolean): String;
var Codigo: Integer;
begin
  Exec(ExpandConstant('{sys}\net.exe'), 'stop CajaFacil-Worker', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Exec(ExpandConstant('{sys}\net.exe'), 'stop CajaFacil-App', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Exec(ExpandConstant('{sys}\net.exe'), 'stop CajaFacil-DB', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Result := '';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var Codigo: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    if MsgBox('¿Desea BORRAR también todos los datos de la tienda (ventas, productos, fiados y respaldos)?' + #13#10#13#10 +
              'Si va a reinstalar o cambiar de computador, responda NO. Los datos quedan en C:\ProgramData\CajaFacil.',
              mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      DelTree(ExpandConstant('{commonappdata}\CajaFacil'), True, True, True);
  end;
end;
