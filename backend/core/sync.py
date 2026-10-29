"""
Sincronizador con la nube de NautilusTech (solo plan NUBE).

Contrato con la nube (API a implementar del lado de NautilusTech):
  POST {NUBE_URL}/api/sync/eventos      body: {"instalacion_id", "equipo_id", "licencia_id",
                                               "eventos": [{"id","tipo","entidad_id","creado","payload"}]}
                                         resp: {"recibidos": ["<id>", ...]}
  POST {NUBE_URL}/api/sync/respaldo     multipart: archivo=<.dump>, más los mismos campos de identificación
  GET  {NUBE_URL}/api/licencias/{licencia_id}?equipo_id=...   resp: licencia firmada vigente
Cabecera de autenticación: "X-CajaFacil-Licencia: <licencia_id>" + "X-CajaFacil-Equipo: <equipo_id>"
  + "X-CajaFacil-Token: sha256('cajafacil-nube|' + firma de la licencia)" (prueba de que tiene el archivo).
El servidor está en la carpeta nube/ de este mismo proyecto. Si la suscripción está vencida responde 402
y los eventos se quedan en cola hasta que se renueve.
Los eventos son idempotentes por "id" (UUID): reenviar no duplica.
"""
import hashlib
import json
import logging

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone

from . import licencia
from .models import Configuracion, EventoSync

log = logging.getLogger(__name__)

LOTE = 100
TIMEOUT = 20


def encolar(tipo: str, entidad_id, payload: dict):
    """Registra un evento para subir a la nube. Llamar dentro de la transacción de negocio."""
    data = json.loads(json.dumps(payload, cls=DjangoJSONEncoder))
    EventoSync.objects.create(tipo=tipo, entidad_id=str(entidad_id or ''), payload=data)


def token_licencia() -> str:
    lic = licencia.leer_archivo() or {}
    firma = lic.get('firma') or ''
    return hashlib.sha256(('cajafacil-nube|' + firma).encode()).hexdigest() if firma else ''


def _cabeceras(est):
    return {
        'X-CajaFacil-Licencia': est.licencia_id,
        'X-CajaFacil-Equipo': est.equipo,
        'X-CajaFacil-Token': token_licencia(),
        'User-Agent': f'CajaFacil/{settings.VERSION}',
    }


def _mensaje_error(r) -> str:
    """Mensaje entendible a partir de la respuesta de la nube."""
    try:
        msg = r.json().get('error') or ''
    except Exception:
        msg = ''
    if r.status_code == 402:
        return msg or 'La suscripción de la nube está vencida. Comunícate con NautilusTech para renovarla.'
    if r.status_code in (401, 403):
        return msg or 'La nube no reconoce esta licencia. Comunícate con NautilusTech.'
    return msg or f'La nube respondió con error {r.status_code}.'


def _guardar_suscripcion(d: dict | None):
    if not isinstance(d, dict):
        return
    from datetime import date
    try:
        hasta = date.fromisoformat(d['pagado_hasta']) if d.get('pagado_hasta') else None
    except (ValueError, TypeError):
        return
    Configuracion.objects.filter(pk=1).update(nube_pagado_hasta=hasta)


def sincronizacion_inicial():
    """
    La primera vez que se activa la nube, sube lo que ya existía: todos los productos, los fiados pendientes,
    y las ventas y cierres de los últimos 60 días. Así el panel del dueño arranca completo.
    """
    from datetime import timedelta
    from catalogo.models import Producto
    from catalogo.services import payload_producto
    from creditos.models import Credito
    from creditos.services import payload_credito
    from ventas.models import Caja, Venta
    from ventas.services import payload_venta
    desde = timezone.now() - timedelta(days=60)
    with transaction.atomic():
        for p in Producto.objects.select_related('categoria').iterator():
            encolar('producto', p.id, payload_producto(p))
        for c in Credito.objects.filter(estado='PENDIENTE').select_related('cliente').iterator():
            encolar('credito', c.id, payload_credito(c))
        for v in (Venta.objects.filter(creado__gte=desde).select_related('usuario', 'cliente')
                  .order_by('creado').iterator()):
            encolar('venta', v.id, payload_venta(v))
        for caja in (Caja.objects.filter(estado='CERRADA', cerrada_en__gte=desde)
                     .select_related('usuario_cierre').order_by('cerrada_en')):
            encolar('cierre_caja', caja.id, {
                'numero': caja.numero, 'terminal': caja.terminal, 'abierta_en': caja.abierta_en,
                'cerrada_en': caja.cerrada_en, 'usuario': caja.usuario_cierre.nombre if caja.usuario_cierre else '',
                'resumen': caja.resumen or {}, 'efectivo_contado': caja.efectivo_contado, 'diferencia': caja.diferencia,
            })
        Configuracion.objects.filter(pk=1).update(nube_inicial_enviada=True)
    log.info('Sincronización inicial con la nube encolada.')


def _ident(est, conf):
    return {
        'instalacion_id': str(conf.instalacion_id),
        'equipo_id': est.equipo,
        'licencia_id': est.licencia_id,
    }


def revisar_actualizacion() -> str | None:
    """Consulta si hay una versión nueva publicada. Funciona con cualquier plan (solo lee)."""
    import requests
    try:
        r = requests.get(f'{settings.NUBE_URL}/api/version', timeout=TIMEOUT,
                         headers={'User-Agent': f'CajaFacil/{settings.VERSION}'})
        if r.status_code == 200:
            d = r.json()
            Configuracion.objects.filter(pk=1).update(version_disponible=str(d.get('version', ''))[:20],
                                                      url_descarga=str(d.get('url', ''))[:200])
            return d.get('version')
    except Exception as e:
        log.info('No se pudo consultar actualizaciones: %s', e)
    return None


def renovar_licencia(est) -> bool:
    """Consulta la nube por la licencia vigente (p. ej. cuando el cliente paga el mes)."""
    import requests
    if not est.licencia_id:
        return False
    try:
        r = requests.get(f'{settings.NUBE_URL}/api/licencias/{est.licencia_id}',
                         params={'equipo_id': est.equipo}, headers=_cabeceras(est), timeout=TIMEOUT)
        if r.status_code == 200:
            nueva = r.json()
            if licencia.verificar_firma(nueva):
                actual = licencia.leer_archivo()
                if actual != nueva:
                    licencia.guardar_archivo(nueva)
                    log.info('Licencia actualizada desde la nube.')
                return True
    except Exception as e:
        log.info('No se pudo consultar la licencia en la nube: %s', e)
    return False


def enviar_pendientes() -> dict:
    """Envía los eventos pendientes. Devuelve un resumen. Nunca lanza excepción."""
    import requests
    est = licencia.estado_actual()
    resultado = {'nube_activa': est.nube_activa, 'enviados': 0, 'pendientes': 0, 'error': ''}
    pendientes = EventoSync.objects.filter(enviado__isnull=True)
    resultado['pendientes'] = pendientes.count()
    if not est.nube_activa:
        return resultado

    conf = Configuracion.obtener()
    if not conf.nube_inicial_enviada:
        sincronizacion_inicial()
        pendientes = EventoSync.objects.filter(enviado__isnull=True)
    while True:
        lote = list(pendientes.order_by('creado')[:LOTE])
        if not lote:
            break
        cuerpo = dict(_ident(est, conf), eventos=[
            {'id': str(e.id), 'tipo': e.tipo, 'entidad_id': e.entidad_id,
             'creado': e.creado.isoformat(), 'payload': e.payload}
            for e in lote
        ])
        try:
            r = requests.post(f'{settings.NUBE_URL}/api/sync/eventos', json=cuerpo,
                              headers=_cabeceras(est), timeout=TIMEOUT)
            if r.status_code >= 400:
                if r.status_code == 402:
                    try:
                        _guardar_suscripcion(r.json().get('suscripcion'))
                    except Exception:
                        pass
                raise RuntimeError(_mensaje_error(r))
            datos = r.json()
            recibidos = set(datos.get('recibidos', []))
            _guardar_suscripcion(datos.get('suscripcion'))
        except Exception as e:
            msg = str(e)[:500]
            EventoSync.objects.filter(id__in=[x.id for x in lote]).update(ultimo_error=msg)
            for x in lote:
                EventoSync.objects.filter(id=x.id).update(intentos=x.intentos + 1)
            resultado['error'] = msg
            log.info('Sincronización pendiente (sin conexión o error): %s', msg)
            break
        ahora = timezone.now()
        with transaction.atomic():
            EventoSync.objects.filter(id__in=recibidos).update(enviado=ahora, ultimo_error='')
        resultado['enviados'] += len(recibidos)
        if len(recibidos) < len(lote):
            break

    if resultado['enviados']:
        Configuracion.objects.filter(pk=1).update(ultima_sincronizacion=timezone.now())
    resultado['pendientes'] = EventoSync.objects.filter(enviado__isnull=True).count()
    return resultado


def subir_respaldo(respaldo) -> bool:
    import requests
    est = licencia.estado_actual()
    if not est.nube_activa:
        return False
    conf = Configuracion.obtener()
    try:
        with open(respaldo.archivo, 'rb') as f:
            r = requests.post(f'{settings.NUBE_URL}/api/sync/respaldo', data=_ident(est, conf),
                              files={'archivo': f}, headers=_cabeceras(est), timeout=300)
        if r.status_code >= 400:
            raise RuntimeError(_mensaje_error(r))
        respaldo.subido_nube = True
        respaldo.save(update_fields=['subido_nube'])
        return True
    except Exception as e:
        log.info('No se pudo subir el respaldo a la nube: %s', e)
        return False
