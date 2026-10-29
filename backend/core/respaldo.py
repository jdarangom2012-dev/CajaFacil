"""Respaldos locales de PostgreSQL con pg_dump (formato custom, comprimido)."""
import logging
import os
import shutil
import subprocess
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from .models import Configuracion, Respaldo

log = logging.getLogger(__name__)


class ErrorRespaldo(Exception):
    pass


def _binario(nombre: str) -> str:
    exe = nombre + ('.exe' if os.name == 'nt' else '')
    if settings.PG_BIN:
        ruta = Path(settings.PG_BIN) / exe
        if ruta.exists():
            return str(ruta)
    encontrado = shutil.which(nombre)
    if encontrado:
        return encontrado
    for v in ('17', '16', '15'):
        cand = Path(f'/usr/lib/postgresql/{v}/bin/{nombre}')
        if cand.exists():
            return str(cand)
    raise ErrorRespaldo(f'No se encontró {exe}. Revise "pg_bin" en cajafacil.ini.')


def _entorno():
    db = settings.DATABASES['default']
    env = os.environ.copy()
    env['PGPASSWORD'] = db['PASSWORD'] or ''
    return env, db


def crear(origen: str = 'AUTO') -> Respaldo:
    env, db = _entorno()
    destino_dir = Path(settings.RESPALDOS_DIR)
    destino_dir.mkdir(parents=True, exist_ok=True)
    marca = timezone.localtime().strftime('%Y%m%d_%H%M%S')
    archivo = destino_dir / f'cajafacil_{marca}_{origen.lower()}.dump'
    cmd = [_binario('pg_dump'), '-h', db['HOST'], '-p', str(db['PORT']), '-U', db['USER'],
           '-F', 'c', '-Z', '6', '-f', str(archivo), db['NAME']]
    try:
        proc = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=600,
                              creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except subprocess.TimeoutExpired:
        raise ErrorRespaldo('El respaldo tardó demasiado.')
    if proc.returncode != 0:
        Respaldo.objects.create(archivo=str(archivo), origen=origen, error=proc.stderr[:2000])
        raise ErrorRespaldo(f'pg_dump falló: {proc.stderr.strip()[:300]}')

    resp = Respaldo.objects.create(archivo=str(archivo), tamano=archivo.stat().st_size, origen=origen)
    conf = Configuracion.obtener()
    conf.ultimo_respaldo = timezone.now()
    conf.save(update_fields=['ultimo_respaldo'])

    # Copia extra (USB / disco externo) si está configurada y disponible
    if conf.respaldo_carpeta_extra:
        extra = Path(conf.respaldo_carpeta_extra)
        try:
            if extra.exists():
                shutil.copy2(archivo, extra / archivo.name)
            else:
                log.info('Carpeta de respaldo extra no disponible: %s', extra)
        except OSError as e:
            log.warning('No se pudo copiar el respaldo a %s: %s', extra, e)

    limpiar(conf.respaldo_dias_conservar)
    return resp


def limpiar(dias: int):
    limite = timezone.now() - timedelta(days=max(dias, 1))
    for r in Respaldo.objects.filter(creado__lt=limite):
        try:
            Path(r.archivo).unlink(missing_ok=True)
        except OSError:
            pass
        r.delete()


def restaurar(archivo: str):
    """Restaura un respaldo sobre la base actual (borra los datos actuales)."""
    env, db = _entorno()
    if not Path(archivo).exists():
        raise ErrorRespaldo('El archivo de respaldo no existe.')
    cmd = [_binario('pg_restore'), '-h', db['HOST'], '-p', str(db['PORT']), '-U', db['USER'],
           '-d', db['NAME'], '--clean', '--if-exists', '--no-owner', archivo]
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=1200,
                          creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if proc.returncode != 0 and 'error' in proc.stderr.lower():
        raise ErrorRespaldo(f'pg_restore reportó errores: {proc.stderr.strip()[:300]}')


def necesita_respaldo_diario() -> bool:
    conf = Configuracion.obtener()
    if not conf.ultimo_respaldo:
        return True
    return timezone.localtime(conf.ultimo_respaldo).date() < timezone.localdate()
