"""
Rutas y configuración de la instalación local de CajaFacil.

Toda la configuración de la máquina vive en un archivo INI dentro de
CAJAFACIL_HOME (por defecto C:\\ProgramData\\CajaFacil en Windows y
~/.cajafacil en Linux/macOS). El instalador lo crea con valores generados
(contraseña de la base de datos, SECRET_KEY, puerto).
"""
import configparser
import os
import secrets
import sys
from pathlib import Path


def _home_por_defecto() -> Path:
    if os.name == 'nt':
        return Path(os.environ.get('PROGRAMDATA', r'C:\ProgramData')) / 'CajaFacil'
    return Path.home() / '.cajafacil'


HOME = Path(os.environ.get('CAJAFACIL_HOME') or _home_por_defecto())
CONFIG_FILE = HOME / 'cajafacil.ini'
RESPALDOS_DIR = HOME / 'respaldos'
LOGS_DIR = HOME / 'logs'
MEDIA_DIR = HOME / 'imagenes'
LICENCIA_FILE = HOME / 'licencia.json'

# Carpeta de la aplicación (donde está el ejecutable o el código fuente)
if getattr(sys, 'frozen', False):
    APP_DIR = Path(sys.executable).resolve().parent
    RECURSOS_DIR = Path(getattr(sys, '_MEIPASS', APP_DIR))  # datos empaquetados (_internal)
else:
    APP_DIR = Path(__file__).resolve().parent.parent
    RECURSOS_DIR = APP_DIR

DEFAULTS = {
    'servidor': {
        'host': '127.0.0.1',
        'puerto': '8770',
        'modo': 'principal',  # principal | terminal
    },
    'base_datos': {
        'nombre': 'cajafacil',
        'usuario': 'cajafacil',
        'clave': '',
        'host': '127.0.0.1',
        'puerto': '5544',
        'pg_bin': '',  # carpeta con pg_dump.exe / psql.exe
    },
    'seguridad': {
        'secret_key': '',
    },
    'nube': {
        'url': 'https://cajafacil.app',
    },
}


def asegurar_carpetas():
    for d in (HOME, RESPALDOS_DIR, LOGS_DIR, MEDIA_DIR):
        d.mkdir(parents=True, exist_ok=True)


def cargar_config() -> configparser.ConfigParser:
    cfg = configparser.ConfigParser()
    cfg.read_dict(DEFAULTS)
    if CONFIG_FILE.exists():
        # utf-8-sig: el instalador (PowerShell) puede escribir el archivo con BOM.
        # No se usa cfg.read() porque ignora en silencio un archivo que no se puede abrir,
        # y entonces la app arrancaría sin la clave de la base de datos.
        try:
            texto = CONFIG_FILE.read_text(encoding='utf-8-sig')
        except OSError as e:
            raise RuntimeError(f'No se pudo leer {CONFIG_FILE} ({e}). Ejecute como administrador.') from e
        cfg.read_string(texto, source=str(CONFIG_FILE))
    cambios = False
    if not cfg['seguridad'].get('secret_key'):
        cfg['seguridad']['secret_key'] = secrets.token_urlsafe(50)
        cambios = True
    if cambios:
        try:
            asegurar_carpetas()
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                cfg.write(f)
        except OSError:
            pass
    return cfg
