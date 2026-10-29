"""
Envío de datos crudos (ESC/POS) a la impresora térmica.

Modos:
  WINDOWS  impresora instalada en Windows; se envía RAW con win32print (sin diálogo)
  RED      impresora Ethernet/WiFi, destino "192.168.1.50:9100"
  SERIAL   puerto COM, destino "COM3" o "COM3:9600"
"""
import logging
import os
import socket

log = logging.getLogger(__name__)


class ErrorImpresora(Exception):
    pass


def listar_impresoras() -> list[str]:
    if os.name != 'nt':
        return []
    try:
        import win32print
        flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        return [p[2] for p in win32print.EnumPrinters(flags)]
    except Exception as e:  # pywin32 no disponible
        log.warning('No se pudieron listar impresoras: %s', e)
        return []


def listar_puertos() -> list[dict]:
    try:
        from serial.tools import list_ports
        return [{'puerto': p.device, 'descripcion': p.description} for p in list_ports.comports()]
    except Exception:
        return []


def _enviar_windows(nombre: str, datos: bytes):
    try:
        import win32print
    except ImportError:
        raise ErrorImpresora('El modo Windows solo funciona en Windows (pywin32).')
    nombre = nombre or win32print.GetDefaultPrinter()
    try:
        h = win32print.OpenPrinter(nombre)
    except Exception:
        raise ErrorImpresora(f'No se encontró la impresora "{nombre}".')
    try:
        win32print.StartDocPrinter(h, 1, ('CajaFacil', None, 'RAW'))
        try:
            win32print.StartPagePrinter(h)
            win32print.WritePrinter(h, datos)
            win32print.EndPagePrinter(h)
        finally:
            win32print.EndDocPrinter(h)
    finally:
        win32print.ClosePrinter(h)


def _enviar_red(destino: str, datos: bytes):
    host, _, puerto = destino.partition(':')
    try:
        with socket.create_connection((host.strip(), int(puerto or 9100)), timeout=5) as s:
            s.sendall(datos)
    except OSError as e:
        raise ErrorImpresora(f'No se pudo conectar con la impresora {destino}: {e}')


def _enviar_serial(destino: str, datos: bytes):
    try:
        import serial
    except ImportError:
        raise ErrorImpresora('Falta el módulo pyserial.')
    puerto, _, baudios = destino.partition(':')
    try:
        with serial.Serial(puerto.strip(), int(baudios or 9600), timeout=3) as s:
            s.write(datos)
            s.flush()
    except Exception as e:
        raise ErrorImpresora(f'No se pudo abrir el puerto {puerto}: {e}')


def enviar(tipo: str, destino: str, datos: bytes):
    if tipo == 'WINDOWS':
        _enviar_windows(destino, datos)
    elif tipo == 'RED':
        if not destino:
            raise ErrorImpresora('Configure la IP de la impresora (ej. 192.168.1.50:9100).')
        _enviar_red(destino, datos)
    elif tipo == 'SERIAL':
        if not destino:
            raise ErrorImpresora('Configure el puerto COM de la impresora.')
        _enviar_serial(destino, datos)
    else:
        raise ErrorImpresora('La impresión directa no está activada en Configuración.')
