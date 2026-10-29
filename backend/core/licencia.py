"""
Licenciamiento de CajaFacil.

Una licencia es un JSON firmado por NautilusTech con Ed25519:
    {"datos": {...}, "firma": "<base64>"}

datos:
    licencia_id   identificador de la licencia
    cliente       nombre del negocio
    nit           NIT o cédula
    equipo_id     huella del PC donde se activó ("*" = cualquiera, solo para demos)
    plan          "BASICO" (100% local) o "NUBE" (local + respaldo en la nube + app del dueño)
    emitida       fecha ISO
    vence         fecha ISO o null (licencia perpetua)
    nube_hasta    fecha ISO o null: hasta cuándo está pagado el plan nube
    max_cajas     número de cajas permitidas en red
    facturacion   true si incluye el módulo de facturación electrónica (documento POS DIAN)
    fe_hasta      fecha ISO o null: hasta cuándo está pagado el módulo de facturación

Sin licencia, la instalación funciona en modo PRUEBA durante settings.DIAS_PRUEBA días.
Vencida la prueba o la licencia, el sistema queda en SOLO LECTURA (se puede consultar
pero no vender). El plan nube vencido NO bloquea la caja: solo apaga el sincronizador.
"""
import base64
import hashlib
import json
import logging
import os
import platform
import subprocess
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from datetime import date, timedelta

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from django.conf import settings
from django.utils import timezone

log = logging.getLogger(__name__)

# Llave pública de NautilusTech (la privada NUNCA se distribuye con la app)
LLAVE_PUBLICA_B64 = os.environ.get(
    'CAJAFACIL_LLAVE_PUBLICA', 'eTLjA2b9nqQblfzpLbR4A5tR9Kx+LjkKAYWmCkioNqY=')

DIAS_GRACIA_NUBE = 5


def _canonico(datos: dict) -> bytes:
    return json.dumps(datos, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def _leer_machine_guid() -> str:
    if os.name == 'nt':
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Cryptography',
                                0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as k:
                return winreg.QueryValueEx(k, 'MachineGuid')[0]
        except OSError:
            pass
        try:
            out = subprocess.check_output(['wmic', 'csproduct', 'get', 'uuid'], text=True, timeout=5)
            return out.split()[-1]
        except Exception:
            pass
    for ruta in ('/etc/machine-id', '/var/lib/dbus/machine-id'):
        try:
            with open(ruta) as f:
                return f.read().strip()
        except OSError:
            pass
    return f'{platform.node()}-{uuid.getnode()}'


_EQUIPO_ID = None


def equipo_id() -> str:
    """Huella estable del PC, formato XXXX-XXXX-XXXX-XXXX."""
    global _EQUIPO_ID
    if _EQUIPO_ID is None:
        forzado = os.environ.get('CAJAFACIL_EQUIPO_ID')
        if forzado:
            _EQUIPO_ID = forzado
        else:
            h = hashlib.sha256(('cajafacil:' + _leer_machine_guid()).encode()).hexdigest().upper()[:16]
            _EQUIPO_ID = '-'.join(h[i:i + 4] for i in range(0, 16, 4))
    return _EQUIPO_ID


def verificar_firma(licencia: dict) -> bool:
    try:
        llave = Ed25519PublicKey.from_public_bytes(base64.b64decode(LLAVE_PUBLICA_B64))
        llave.verify(base64.b64decode(licencia['firma']), _canonico(licencia['datos']))
        return True
    except (InvalidSignature, KeyError, ValueError, TypeError):
        return False


def decodificar_texto(texto: str) -> dict:
    """Acepta el JSON directo o el JSON en base64 (lo que se envía por WhatsApp/correo)."""
    texto = (texto or '').strip()
    if not texto:
        raise ValueError('La licencia está vacía.')
    if not texto.startswith('{'):
        try:
            texto = base64.b64decode(texto + '=' * (-len(texto) % 4)).decode('utf-8')
        except Exception:
            raise ValueError('El texto de la licencia no es válido.')
    try:
        lic = json.loads(texto)
    except json.JSONDecodeError:
        raise ValueError('El texto de la licencia no es válido.')
    if 'datos' not in lic or 'firma' not in lic:
        raise ValueError('La licencia está incompleta.')
    return lic


def leer_archivo() -> dict | None:
    ruta = settings.LICENCIA_FILE
    if not ruta.exists():
        return None
    try:
        return json.loads(ruta.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        log.warning('No se pudo leer el archivo de licencia %s', ruta)
        return None


def guardar_archivo(lic: dict):
    ruta = settings.LICENCIA_FILE
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(lic, ensure_ascii=False, indent=2), encoding='utf-8')


def _fecha(valor):
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        return None


@dataclass
class EstadoLicencia:
    estado: str                 # PRUEBA | ACTIVA | VENCIDA | INVALIDA
    plan: str = 'BASICO'
    mensaje: str = ''
    cliente: str = ''
    licencia_id: str = ''
    vence: date | None = None
    nube_hasta: date | None = None
    dias_prueba_restantes: int = 0
    max_cajas: int = 1
    facturacion: bool = False
    fe_hasta: date | None = None
    equipo: str = field(default_factory=equipo_id)

    @property
    def puede_vender(self) -> bool:
        return self.estado in ('PRUEBA', 'ACTIVA')

    @property
    def nube_activa(self) -> bool:
        if self.estado != 'ACTIVA' or self.plan != 'NUBE' or not self.nube_hasta:
            return False
        return timezone.localdate() <= self.nube_hasta + timedelta(days=DIAS_GRACIA_NUBE)

    @property
    def fe_licenciada(self) -> bool:
        """La licencia incluye facturación electrónica vigente (permite el ambiente de producción)."""
        if self.estado != 'ACTIVA' or not self.facturacion:
            return False
        return not self.fe_hasta or timezone.localdate() <= self.fe_hasta + timedelta(days=DIAS_GRACIA_NUBE)

    @property
    def fe_disponible(self) -> bool:
        """El módulo se puede ver y configurar: con licencia, o en modo prueba (solo ambiente de pruebas)."""
        return self.fe_licenciada or self.estado == 'PRUEBA'

    @property
    def nube_en_gracia(self) -> bool:
        return self.nube_activa and timezone.localdate() > self.nube_hasta

    def a_dict(self):
        return {
            'estado': self.estado,
            'plan': self.plan,
            'mensaje': self.mensaje,
            'cliente': self.cliente,
            'licencia_id': self.licencia_id,
            'vence': self.vence.isoformat() if self.vence else None,
            'nube_hasta': self.nube_hasta.isoformat() if self.nube_hasta else None,
            'nube_activa': self.nube_activa,
            'nube_en_gracia': self.nube_en_gracia,
            'puede_vender': self.puede_vender,
            'dias_prueba_restantes': self.dias_prueba_restantes,
            'max_cajas': self.max_cajas,
            'facturacion': self.facturacion,
            'fe_hasta': self.fe_hasta.isoformat() if self.fe_hasta else None,
            'fe_licenciada': self.fe_licenciada,
            'fe_disponible': self.fe_disponible,
            'equipo_id': self.equipo,
        }


# ── Inicio de la prueba ─────────────────────────────────────────────
# La fecha de inicio se guarda en 3 lugares (base de datos, archivo oculto y registro de Windows)
# y se toma la MÁS ANTIGUA: borrar la base o reinstalar no reinicia los 15 días de prueba.
_REG_RUTA = r'SOFTWARE\NautilusTech\CajaFacil'


def _sello(fecha_iso: str) -> str:
    firma = hashlib.sha256(f'cf|{equipo_id()}|{fecha_iso}'.encode()).hexdigest()[:16]
    return base64.b64encode(f'{fecha_iso}|{firma}'.encode()).decode()


def _leer_sello(texto: str):
    try:
        fecha_iso, firma = base64.b64decode(texto.strip()).decode().split('|')
        if _sello(fecha_iso) == texto.strip():
            return date.fromisoformat(fecha_iso)
    except Exception:
        pass
    return None


def _marca_archivo():
    return Path(settings.CAJAFACIL_HOME) / '.cf_inicio'


def _leer_registro():
    if os.name != 'nt' or os.environ.get('CAJAFACIL_SIN_REGISTRO'):
        return None
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, _REG_RUTA, 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as k:
            return _leer_sello(winreg.QueryValueEx(k, 'Inicio')[0])
    except OSError:
        return None


def _escribir_registro(valor: str):
    if os.name != 'nt' or os.environ.get('CAJAFACIL_SIN_REGISTRO'):
        return
    try:
        import winreg
        with winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, _REG_RUTA, 0, winreg.KEY_WRITE | winreg.KEY_WOW64_64KEY) as k:
            winreg.SetValueEx(k, 'Inicio', 0, winreg.REG_SZ, valor)
    except OSError:
        pass  # sin permisos de administrador (modo desarrollo)


def inicio_prueba(fecha_instalacion=None) -> date:
    from core.models import Configuracion
    conf_fecha = fecha_instalacion or Configuracion.obtener().fecha_instalacion
    conf_fecha = timezone.localtime(conf_fecha).date() if hasattr(conf_fecha, 'tzinfo') else conf_fecha
    candidatas = [conf_fecha]
    archivo = _marca_archivo()
    try:
        if archivo.exists():
            f = _leer_sello(archivo.read_text())
            if f:
                candidatas.append(f)
    except OSError:
        pass
    reg = _leer_registro()
    if reg:
        candidatas.append(reg)
    inicio = min(candidatas)
    sello = _sello(inicio.isoformat())
    try:
        if not archivo.exists() or _leer_sello(archivo.read_text()) != inicio:
            archivo.parent.mkdir(parents=True, exist_ok=True)
            archivo.write_text(sello)
            if os.name == 'nt':
                subprocess.run(['attrib', '+h', str(archivo)], capture_output=True,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except OSError:
        pass
    if reg != inicio:
        _escribir_registro(sello)
    return inicio


# ── Reloj ───────────────────────────────────────────────────────────
TOLERANCIA_RELOJ = timedelta(hours=26)


def reloj_atrasado() -> bool:
    """True si la fecha del PC está claramente antes de la última fecha que el sistema ya vio."""
    from core.models import Configuracion
    ahora = timezone.now()
    conf = Configuracion.obtener()
    vista = conf.ultima_fecha_vista
    if vista and ahora < vista - TOLERANCIA_RELOJ:
        return True
    if not vista or ahora > vista + timedelta(minutes=10):
        Configuracion.objects.filter(pk=1).update(ultima_fecha_vista=ahora)
    return False


def evaluar(lic: dict | None, fecha_instalacion=None) -> EstadoLicencia:
    hoy = timezone.localdate()
    if not lic:
        inicio = inicio_prueba(fecha_instalacion)
        restantes = settings.DIAS_PRUEBA - (hoy - inicio).days
        if restantes >= 0:
            return EstadoLicencia('PRUEBA', dias_prueba_restantes=restantes,
                                  mensaje=f'Modo prueba: te quedan {restantes} días. Activa tu licencia.')
        return EstadoLicencia('VENCIDA', mensaje='El periodo de prueba terminó. Activa tu licencia para seguir vendiendo.')

    if not verificar_firma(lic):
        return EstadoLicencia('INVALIDA', mensaje='La licencia no es válida (firma incorrecta).')

    d = lic['datos']
    est = EstadoLicencia(
        'ACTIVA',
        plan=(d.get('plan') or 'BASICO').upper(),
        cliente=d.get('cliente', ''),
        licencia_id=d.get('licencia_id', ''),
        vence=_fecha(d.get('vence')),
        nube_hasta=_fecha(d.get('nube_hasta')),
        max_cajas=int(d.get('max_cajas') or 1),
        facturacion=bool(d.get('facturacion')),
        fe_hasta=_fecha(d.get('fe_hasta')),
    )
    if d.get('equipo_id') not in ('*', equipo_id()):
        est.estado = 'INVALIDA'
        est.mensaje = 'Esta licencia pertenece a otro equipo. Contacta a soporte para trasladarla.'
        return est
    if est.vence and hoy > est.vence:
        est.estado = 'VENCIDA'
        est.mensaje = f'La licencia venció el {est.vence:%d/%m/%Y}.'
        return est
    if est.plan == 'NUBE':
        if est.nube_en_gracia:
            est.mensaje = 'Tu plan nube está vencido. Renueva para no perder el respaldo y la app del celular.'
        elif not est.nube_activa:
            est.mensaje = 'Plan nube inactivo. La caja sigue funcionando normal.'
    return est


def estado_actual() -> EstadoLicencia:
    if reloj_atrasado():
        return EstadoLicencia('RELOJ', mensaje='La fecha u hora de este computador está atrasada. '
                                               'Corrígela en Windows para seguir vendiendo.')
    return evaluar(leer_archivo())


def instalar(texto: str) -> EstadoLicencia:
    lic = decodificar_texto(texto)
    est = evaluar(lic)
    if est.estado == 'INVALIDA':
        raise ValueError(est.mensaje)
    guardar_archivo(lic)
    return est
