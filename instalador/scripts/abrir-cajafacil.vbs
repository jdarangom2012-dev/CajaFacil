' CajaFacil — abre la aplicación como ventana propia (Edge/Chrome en modo app), sin barra de direcciones.
' Espera a que el servicio responda (máx. 60 s) para no mostrar un error al encender el PC.
Option Explicit
Dim sh, http, url, i, listo, navegador, perfil, fso
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
url = "http://127.0.0.1:8770"
listo = False

For i = 1 To 60
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1000, 1000, 2000, 2000
  http.open "GET", url & "/api/sistema/estado/", False
  http.send
  If Err.Number = 0 Then
    If http.status = 200 Or http.status = 503 Then listo = True
  End If
  Err.Clear
  On Error GoTo 0
  If listo Then Exit For
  WScript.Sleep 1000
Next

If Not listo Then
  MsgBox "CajaFacil todavía está iniciando. Si el problema continúa, reinicie el computador o revise los servicios CajaFacil-DB y CajaFacil-App.", vbExclamation, "CajaFacil"
End If

perfil = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\CajaFacil\ventana"
navegador = ""
On Error Resume Next
navegador = sh.RegRead("HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe\")
If navegador = "" Then navegador = sh.RegRead("HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
If navegador = "" Then navegador = sh.RegRead("HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
On Error GoTo 0

If navegador <> "" And fso.FileExists(navegador) Then
  sh.Run """" & navegador & """ --app=" & url & " --start-maximized --user-data-dir=""" & perfil & """ --no-first-run --disable-features=Translate --kiosk-printing", 1, False
Else
  sh.Run url, 1, False
End If
