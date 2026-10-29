"""
Reglas del módulo de facturación electrónica.

Flujo:
  1. procesar_venta() llama crear_para_venta() dentro de la misma transacción: se asigna el
     consecutivo de la resolución y el documento queda PENDIENTE.
  2. La vista intenta enviarlo enseguida (timeout corto) para que el tiquete salga con CUDE y QR.
  3. Si no hay internet, el worker lo reintenta cada ciclo hasta que el proveedor responda.
  4. Anular una venta con documento genera una NOTA DE AJUSTE que sigue el mismo camino.
"""
import logging
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from core.errores import ErrorNegocio
from core.models import Configuracion, Consecutivo

from . import proveedores
from .models import ConfigFacturacion, DocumentoElectronico

log = logging.getLogger(__name__)
CENT = Decimal('0.01')
REINTENTOS_MAX_ESPERA = timedelta(minutes=30)


def _lic():
    from core import licencia
    return licencia.estado_actual()


def disponible() -> bool:
    """El módulo aparece en la app (licencia con facturación, o modo prueba)."""
    return _lic().fe_disponible


def activa(conf: ConfigFacturacion | None = None) -> bool:
    """Las ventas generan documento electrónico."""
    conf = conf or ConfigFacturacion.obtener()
    if not conf.activa:
        return False
    est = _lic()
    if conf.ambiente == 'PRODUCCION':
        return est.fe_licenciada
    return est.fe_disponible


def problemas_configuracion(conf: ConfigFacturacion) -> list[str]:
    """Lo que impide facturar con esta configuración (vacío = todo en orden)."""
    p = []
    neg = Configuracion.obtener()
    if not neg.nit:
        p.append('Falta el NIT del negocio (Configuración → Negocio).')
    if conf.proveedor not in proveedores.PROVEEDORES:
        p.append('Selecciona un proveedor tecnológico.')
    if not conf.resolucion_numero:
        p.append('Falta el número de la resolución de la DIAN.')
    if not conf.rango_desde or not conf.rango_hasta:
        p.append('Falta el rango de numeración autorizado (desde / hasta).')
    elif conf.rango_desde > conf.rango_hasta:
        p.append('El rango de numeración está al revés (desde es mayor que hasta).')
    hoy = timezone.localdate()
    if not conf.fecha_hasta:
        p.append('Falta la fecha de vencimiento de la resolución.')
    elif hoy > conf.fecha_hasta:
        p.append(f'La resolución venció el {conf.fecha_hasta:%d/%m/%Y}. Solicita una nueva a la DIAN.')
    if conf.fecha_desde and hoy < conf.fecha_desde:
        p.append(f'La resolución empieza a regir el {conf.fecha_desde:%d/%m/%Y}.')
    if conf.restantes == 0:
        p.append('Se acabaron los números autorizados. Solicita una nueva resolución a la DIAN.')
    if conf.ambiente == 'PRODUCCION' and not _lic().fe_licenciada:
        p.append('La licencia no incluye facturación electrónica en producción.')
    return p


def alertas(conf: ConfigFacturacion | None = None) -> list[dict]:
    """Avisos para mostrar al administrador (resolución por vencer, números por acabarse, pendientes)."""
    conf = conf or ConfigFacturacion.obtener()
    if not activa(conf):
        return []
    a = []
    for msg in problemas_configuracion(conf):
        a.append({'nivel': 'grave', 'mensaje': msg})
    if conf.restantes is not None and 0 < conf.restantes <= conf.aviso_numeros:
        a.append({'nivel': 'aviso', 'mensaje': f'Quedan {conf.restantes} números de facturación. Pide una nueva resolución a la DIAN.'})
    if conf.fecha_hasta:
        dias = (conf.fecha_hasta - timezone.localdate()).days
        if 0 <= dias <= conf.aviso_dias:
            a.append({'nivel': 'aviso', 'mensaje': f'La resolución de facturación vence en {dias} días ({conf.fecha_hasta:%d/%m/%Y}).'})
    pend = DocumentoElectronico.objects.filter(estado='PENDIENTE')
    viejos = pend.filter(creado__lt=timezone.now() - timedelta(hours=12)).count()
    if viejos:
        a.append({'nivel': 'grave', 'mensaje': f'{viejos} documentos electrónicos llevan más de 12 horas sin enviarse. Revisa el internet.'})
    rech = DocumentoElectronico.objects.filter(estado='RECHAZADO').count()
    if rech:
        a.append({'nivel': 'grave', 'mensaje': f'{rech} documentos electrónicos fueron rechazados. Revísalos en Configuración → Facturación.'})
    if conf.ambiente == 'PRUEBAS':
        a.append({'nivel': 'info', 'mensaje': 'Facturación electrónica en ambiente de PRUEBAS: los documentos no tienen validez fiscal.'})
    return a


# ── Creación ─────────────────────────────────────────────────────────

def _limpiar_adquirente(datos: dict | None) -> dict:
    if not datos or not (datos.get('numero') or '').strip():
        return {}
    tipo = (datos.get('tipo_doc') or 'CC').upper()
    if tipo not in dict(DocumentoElectronico.TIPOS_DOC) or tipo == 'CF':
        raise ErrorNegocio('Tipo de documento del cliente inválido.')
    numero = ''.join(ch for ch in str(datos['numero']) if ch.isalnum())
    nombre = (datos.get('nombre') or '').strip()
    if len(numero) < 5:
        raise ErrorNegocio('Escribe el número de documento del cliente.')
    if len(nombre) < 3:
        raise ErrorNegocio('Escribe el nombre o razón social del cliente.')
    correo = (datos.get('correo') or '').strip()
    if correo and ('@' not in correo or '.' not in correo.split('@')[-1]):
        raise ErrorNegocio('El correo del cliente no es válido.')
    return {
        'adquirente_tipo_doc': tipo, 'adquirente_numero': numero, 'adquirente_nombre': nombre[:150],
        'adquirente_correo': correo, 'adquirente_telefono': (datos.get('telefono') or '').strip()[:30],
        'adquirente_direccion': (datos.get('direccion') or '').strip()[:200],
    }


def crear_para_venta(venta, adquirente: dict | None = None) -> DocumentoElectronico | None:
    """Se llama dentro de la transacción de la venta. Asigna el consecutivo de la resolución."""
    conf = ConfigFacturacion.objects.select_for_update().get_or_create(pk=1)[0]
    if not activa(conf):
        return None
    problemas = problemas_configuracion(conf)
    if problemas:
        raise ErrorNegocio('Facturación electrónica: ' + problemas[0] +
                           ' Mientras tanto, el administrador puede apagarla en Configuración.')
    datos_adq = _limpiar_adquirente(adquirente)
    numero = conf.proximo
    conf.siguiente_numero = numero + 1
    conf.save(update_fields=['siguiente_numero', 'actualizado'])
    return DocumentoElectronico.objects.create(
        tipo='POS', venta=venta, prefijo=conf.prefijo, numero=numero, ambiente=conf.ambiente,
        proveedor=conf.proveedor, resolucion_numero=conf.resolucion_numero, **datos_adq)


def crear_nota_ajuste(venta, motivo: str) -> DocumentoElectronico | None:
    """Al anular una venta que tiene documento electrónico. Numeración propia del software (prefijo NA)."""
    original = venta.documentos.filter(tipo='POS').first()
    if not original:
        return None
    conf = ConfigFacturacion.obtener()
    return DocumentoElectronico.objects.create(
        tipo='NOTA_AJUSTE', venta=venta, referencia=original, prefijo='NA',
        numero=Consecutivo.siguiente(f'fe_nota_{original.ambiente.lower()}'), ambiente=original.ambiente,
        proveedor=conf.proveedor if conf.proveedor in proveedores.PROVEEDORES else original.proveedor,
        resolucion_numero=original.resolucion_numero, motivo=motivo[:300],
        adquirente_tipo_doc=original.adquirente_tipo_doc, adquirente_numero=original.adquirente_numero,
        adquirente_nombre=original.adquirente_nombre, adquirente_correo=original.adquirente_correo)


# ── Armado del documento (formato neutro, el conector lo traduce) ─────

def _d(x) -> str:
    return str(Decimal(x).quantize(CENT, rounding=ROUND_HALF_UP))


def armar_documento(doc: DocumentoElectronico) -> dict:
    neg = Configuracion.obtener()
    conf = ConfigFacturacion.obtener()
    v = doc.venta
    no_responsable = 'no responsable' in (neg.regimen or '').lower()
    lineas, por_tarifa = [], {}
    for d in v.detalle.select_related('producto'):
        tarifa = 0 if no_responsable else int(d.tarifa_iva or 0)
        total = Decimal(d.subtotal)
        base = (total / (1 + Decimal(tarifa) / 100)).quantize(CENT, rounding=ROUND_HALF_UP)
        iva = total - base
        t = por_tarifa.setdefault(tarifa, {'tarifa': tarifa, 'base': Decimal(0), 'iva': Decimal(0)})
        t['base'] += base
        t['iva'] += iva
        lineas.append({
            'codigo': d.producto.codigo_barras or str(d.producto_id)[:8], 'descripcion': d.nombre_producto,
            'cantidad': str(d.cantidad), 'unidad': d.producto.unidad_medida,
            'precio_unitario': _d(d.precio_unit), 'descuento': _d(d.descuento),
            'base': _d(base), 'tarifa_iva': tarifa, 'iva': _d(iva), 'total': _d(total),
        })
    base_total = sum((t['base'] for t in por_tarifa.values()), Decimal(0))
    iva_total = sum((t['iva'] for t in por_tarifa.values()), Decimal(0))
    fecha = timezone.localtime(v.creado)
    documento = {
        'tipo': doc.tipo,
        'ambiente': doc.ambiente,
        'prefijo': doc.prefijo,
        'numero': doc.numero,
        'numero_completo': doc.numero_completo,
        'fecha': fecha.strftime('%Y-%m-%d'),
        'hora': fecha.strftime('%H:%M:%S'),
        'resolucion': {
            'numero': doc.resolucion_numero, 'prefijo': conf.prefijo, 'desde': conf.rango_desde,
            'hasta': conf.rango_hasta, 'fecha_desde': conf.fecha_desde.isoformat() if conf.fecha_desde else None,
            'fecha_hasta': conf.fecha_hasta.isoformat() if conf.fecha_hasta else None,
            'clave_tecnica': conf.clave_tecnica,
        },
        'emisor': {
            'nit': ''.join(ch for ch in (neg.nit or '') if ch.isdigit() or ch == '-'), 'nombre': neg.nombre_negocio,
            'regimen': neg.regimen, 'direccion': neg.direccion, 'ciudad': neg.ciudad, 'telefono': neg.telefono,
            'correo': neg.email,
        },
        'adquirente': {
            'tipo_doc': doc.adquirente_tipo_doc, 'numero': doc.adquirente_numero, 'nombre': doc.adquirente_nombre,
            'correo': doc.adquirente_correo, 'telefono': doc.adquirente_telefono,
            'direccion': doc.adquirente_direccion,
        },
        'caja': {'terminal': v.terminal, 'cajero': v.usuario.nombre, 'venta_numero': v.numero},
        'lineas': lineas,
        'impuestos': [{'tipo': 'IVA', 'tarifa': t['tarifa'], 'base': _d(t['base']), 'valor': _d(t['iva'])}
                      for t in sorted(por_tarifa.values(), key=lambda x: x['tarifa'])],
        'totales': {'base': _d(base_total), 'iva': _d(iva_total), 'descuento': _d(v.descuento),
                    'total': _d(v.total)},
        'pagos': [{'forma': p.forma_pago.nombre, 'tipo': p.forma_pago.tipo, 'monto': _d(p.monto)}
                  for p in v.pagos.select_related('forma_pago')],
    }
    if doc.tipo == 'NOTA_AJUSTE' and doc.referencia:
        documento['referencia'] = {
            'numero_completo': doc.referencia.numero_completo, 'cude': doc.referencia.cude,
            'fecha': timezone.localtime(doc.referencia.creado).strftime('%Y-%m-%d'), 'motivo': doc.motivo,
        }
    return documento


# ── Envío ────────────────────────────────────────────────────────────

def enviar(doc: DocumentoElectronico, timeout: float = 15) -> DocumentoElectronico:
    if doc.estado == 'ACEPTADO':
        return doc
    if doc.tipo == 'NOTA_AJUSTE' and doc.referencia and doc.referencia.estado != 'ACEPTADO':
        enviar(doc.referencia, timeout)
        doc.referencia.refresh_from_db()
        if doc.referencia.estado != 'ACEPTADO':
            return doc  # la nota espera a que el documento original quede aceptado
    conf = ConfigFacturacion.obtener()
    doc.intentos += 1
    try:
        prov = proveedores.obtener(doc.proveedor, conf)
        r = prov.emitir(armar_documento(doc), timeout=timeout)
    except proveedores.ErrorTemporal as e:
        espera = min(timedelta(minutes=2 ** min(doc.intentos, 5)), REINTENTOS_MAX_ESPERA)
        doc.ultimo_error = str(e)[:1000]
        doc.proximo_intento = timezone.now() + espera
        doc.save(update_fields=['intentos', 'ultimo_error', 'proximo_intento', 'actualizado'])
        return doc
    except Exception as e:  # error inesperado del conector: se reintenta más tarde
        log.exception('Error enviando documento %s', doc)
        doc.ultimo_error = f'Error inesperado: {e}'[:1000]
        doc.proximo_intento = timezone.now() + REINTENTOS_MAX_ESPERA
        doc.save(update_fields=['intentos', 'ultimo_error', 'proximo_intento', 'actualizado'])
        return doc
    doc.estado = 'ACEPTADO' if r.aceptado else 'RECHAZADO'
    doc.cude = r.cude or doc.cude
    doc.qr = r.qr or doc.qr
    doc.ultimo_error = '' if r.aceptado else (r.mensaje or 'Rechazado por la DIAN.')[:1000]
    doc.respuesta = r.respuesta or {'mensaje': r.mensaje}
    doc.enviado_en = timezone.now()
    doc.save()
    if not r.aceptado:
        from auditoria.services import registrar
        registrar(None, 'UPDATE', 'documentos_electronicos', doc.id,
                  detalle=f'Documento electrónico {doc.numero_completo} rechazado: {doc.ultimo_error}')
    return doc


def enviar_pendientes(limite: int = 30) -> dict:
    """Lo llama el worker en cada ciclo. Devuelve cuántos se enviaron y cuántos siguen pendientes."""
    enviados = 0
    for doc in (DocumentoElectronico.objects.filter(estado='PENDIENTE', proximo_intento__lte=timezone.now())
                .select_related('venta', 'referencia').order_by('tipo', 'creado')[:limite]):
        with transaction.atomic():
            enviar(doc)
        if doc.estado != 'PENDIENTE':
            enviados += 1
    return {'enviados': enviados, 'pendientes': DocumentoElectronico.objects.filter(estado='PENDIENTE').count()}


def reintentar(doc: DocumentoElectronico) -> DocumentoElectronico:
    """Vuelve a enviar un documento rechazado (después de corregir datos) o pendiente."""
    if doc.estado == 'ACEPTADO':
        raise ErrorNegocio('Ese documento ya fue aceptado por la DIAN.')
    doc.estado = 'PENDIENTE'
    doc.proximo_intento = timezone.now()
    doc.save(update_fields=['estado', 'proximo_intento', 'actualizado'])
    return enviar(doc, timeout=15)


def info_tiquete(venta) -> dict | None:
    """Lo que el tiquete necesita imprimir del documento electrónico."""
    doc = venta.documentos.filter(tipo='POS').first()
    if not doc:
        return None
    return {
        'numero': doc.numero_completo, 'estado': doc.estado, 'cude': doc.cude, 'qr': doc.qr,
        'ambiente': doc.ambiente, 'resolucion': doc.resolucion_numero,
        'adquirente': None if doc.adquirente_tipo_doc == 'CF' else
        f'{doc.adquirente_nombre} · {doc.adquirente_tipo_doc} {doc.adquirente_numero}',
    }
