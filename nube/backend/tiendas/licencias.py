"""Verificación de licencias de CajaFácil (mismo formato y misma llave pública que la app)."""
import base64
import hashlib
import json

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from django.conf import settings


def _canonico(datos: dict) -> bytes:
    return json.dumps(datos, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def decodificar(texto: str) -> dict:
    """Acepta el texto en base64 que genera generar_licencia.py, o el JSON directo."""
    texto = (texto or '').strip()
    if not texto:
        raise ValueError('Pega el texto de la licencia.')
    if not texto.startswith('{'):
        try:
            texto = base64.b64decode(texto + '=' * (-len(texto) % 4)).decode('utf-8')
        except Exception:
            raise ValueError('El texto de la licencia no es válido.')
    try:
        lic = json.loads(texto)
    except json.JSONDecodeError:
        raise ValueError('El texto de la licencia no es válido.')
    if not isinstance(lic, dict) or 'datos' not in lic or 'firma' not in lic:
        raise ValueError('La licencia está incompleta.')
    if not verificar_firma(lic):
        raise ValueError('La firma de la licencia no es válida (¿se generó con la llave de NautilusTech?).')
    d = lic['datos']
    if not d.get('licencia_id') or not d.get('equipo_id'):
        raise ValueError('La licencia no trae licencia_id o equipo_id.')
    return lic


def verificar_firma(lic: dict) -> bool:
    try:
        llave = Ed25519PublicKey.from_public_bytes(base64.b64decode(settings.LLAVE_PUBLICA_B64))
        llave.verify(base64.b64decode(lic['firma']), _canonico(lic['datos']))
        return True
    except (InvalidSignature, KeyError, ValueError, TypeError):
        return False


def token(firma_b64: str) -> str:
    """Lo que la tienda manda en X-CajaFacil-Token: prueba de que tiene el archivo de licencia."""
    return hashlib.sha256(('cajafacil-nube|' + firma_b64).encode()).hexdigest()
