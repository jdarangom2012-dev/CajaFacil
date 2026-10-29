# -*- mode: python ; coding: utf-8 -*-
# PyInstaller: empaqueta el backend + frontend compilado en dist/cajafacil/ (modo carpeta).
#   pyinstaller cajafacil.spec --noconfirm
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

APPS = ['cajafacil', 'core', 'usuarios', 'catalogo', 'ventas', 'creditos', 'auditoria', 'reportes', 'facturacion']

hidden = []
for paquete in APPS + ['rest_framework', 'rest_framework_simplejwt', 'whitenoise', 'waitress',
                       'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions',
                       'django.contrib.staticfiles', 'psycopg', 'psycopg_binary', 'openpyxl', 'serial']:
    hidden += collect_submodules(paquete)
hidden += ['win32print', 'win32api', 'winreg']

datas = [('frontend_dist', 'frontend_dist')]
for paquete in ['django', 'rest_framework', 'rest_framework_simplejwt']:
    datas += collect_data_files(paquete)

a = Analysis(
    ['servidor.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas', 'prophet', 'PIL', 'pytest'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='cajafacil',
    console=True,          # corre como servicio (NSSM); la consola no se ve
    icon='../icono.ico',
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='cajafacil')
