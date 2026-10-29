"""Recepción y proyección de los eventos que manda cada tienda."""
import hashlib
import logging
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from tiendas.models import Tienda

from .models import (Abono, Alerta, Cierre, Credito, Evento, MovimientoInventario, Producto, Respaldo, Venta,
                     VentaItem)

log = logging.getLogger(__name__)
MAX_EVENTOS = 500


def _dec(v, defecto='0') -> Decimal:
    try:
        return Decimal(str(v if v not in (None, '') else defecto))
    except (InvalidOperation, ValueError):
        return Decimal(defecto)


def _dt(v):
    if not v:
        return None
    d = parse_datetime(str(v))
    if d and timezone.is_naive(d):
        d = timezone.make_aware(d)
    return d


def _fecha(v):
    if not v:
        return None
    if isinstance(v, date):
        return v
    return parse_date(str(v)[:10])


def _txt(v, n):
    return str(v or '')[:n]


def _upsert(modelo, tienda, local_id, cuando, campos: dict):
    """Crea o actualiza la fila solo si el evento es igual o más nuevo que el que la dejó como está."""
    obj = modelo.objects.select_for_update().filter(tienda=tienda, local_id=local_id).first()
    if obj and obj.evento_en > cuando:
        return obj, False
    if obj is None:
        obj = modelo(tienda=tienda, local_id=local_id)
    for k, v in campos.items():
        setattr(obj, k, v)
    obj.evento_en = cuando
    obj.save()
    return obj, True


def _stock(tienda, producto_id, nombre, stock, cuando):
    """Actualiza las existencias de un producto con el dato más reciente."""
    if not producto_id or stock is None:
        return
    p = Producto.objects.select_for_update().filter(tienda=tienda, local_id=producto_id).first()
    if p is None:
        Producto.objects.create(tienda=tienda, local_id=producto_id, nombre=_txt(nombre, 200) or 'Producto',
                                stock=_dec(stock), stock_en=cuando, evento_en=cuando)
        return
    if p.stock_en is None or p.stock_en <= cuando:
        p.stock = _dec(stock)
        p.stock_en = cuando
        p.save(update_fields=['stock', 'stock_en'])


# ── Proyecciones por tipo de evento ─────────────────────────────────

def _venta(t, ev, p):
    v, cambio = _upsert(Venta, t, ev.entidad_id, ev.creado_local, {
        'numero': int(p.get('numero') or 0), 'terminal': _txt(p.get('terminal'), 40),
        'fecha': _dt(p.get('fecha_hora')) or ev.creado_local, 'usuario': _txt(p.get('usuario'), 120),
        'cliente': _txt(p.get('cliente'), 150), 'subtotal': _dec(p.get('subtotal')),
        'descuento': _dec(p.get('descuento')), 'total': _dec(p.get('total')),
        'costo_total': _dec(p.get('costo_total')), 'estado': _txt(p.get('estado') or 'COMPLETADA', 12),
        'motivo_anulacion': _txt(p.get('motivo_anulacion'), 2000),
        'pagos': [{'forma_pago': _txt(x.get('forma_pago'), 60), 'tipo': _txt(x.get('tipo'), 20),
                   'monto': float(_dec(x.get('monto')))} for x in (p.get('pagos') or [])],
    })
    if cambio:
        v.items.all().delete()
        VentaItem.objects.bulk_create([VentaItem(
            venta=v, producto_id=_txt(d.get('producto_id'), 40), nombre=_txt(d.get('nombre'), 200),
            cantidad=_dec(d.get('cantidad')), precio_unit=_dec(d.get('precio_unit')),
            descuento=_dec(d.get('descuento')), subtotal=_dec(d.get('subtotal')),
        ) for d in (p.get('detalle') or [])])
    for d in (p.get('detalle') or []):
        if 'stock' in d:
            _stock(t, _txt(d.get('producto_id'), 40), d.get('nombre'), d.get('stock'), ev.creado_local)


def _producto(t, ev, p):
    pid = _txt(p.get('id') or ev.entidad_id, 40)
    obj, cambio = _upsert(Producto, t, pid, ev.creado_local, {
        'codigo_barras': _txt(p.get('codigo_barras'), 60), 'nombre': _txt(p.get('nombre'), 200) or 'Producto',
        'categoria': _txt(p.get('categoria'), 100), 'precio_costo': _dec(p.get('precio_costo')),
        'precio_venta': _dec(p.get('precio_venta')), 'unidad_medida': _txt(p.get('unidad_medida'), 20),
        'stock_minimo': _dec(p.get('stock_minimo')), 'activo': bool(p.get('activo', True)),
    })
    if 'stock' in p:
        _stock(t, pid, p.get('nombre'), p.get('stock'), ev.creado_local)


def _movimiento(t, ev, p):
    _upsert(MovimientoInventario, t, ev.entidad_id, ev.creado_local, {
        'producto_id': _txt(p.get('producto_id'), 40), 'producto': _txt(p.get('producto'), 200),
        'tipo': _txt(p.get('tipo'), 20), 'cantidad': _dec(p.get('cantidad')),
        'stock_anterior': _dec(p.get('stock_anterior')), 'stock_nuevo': _dec(p.get('stock_nuevo')),
        'motivo': _txt(p.get('motivo'), 2000), 'usuario': _txt(p.get('usuario'), 120),
        'fecha': _dt(p.get('fecha_hora')) or ev.creado_local,
    })
    _stock(t, _txt(p.get('producto_id'), 40), p.get('producto'), p.get('stock_nuevo'), ev.creado_local)


def _cierre(t, ev, p):
    r = p.get('resumen') or {}
    _upsert(Cierre, t, ev.entidad_id, ev.creado_local, {
        'numero': int(p.get('numero') or 0), 'terminal': _txt(p.get('terminal'), 40),
        'abierta_en': _dt(p.get('abierta_en')), 'cerrada_en': _dt(p.get('cerrada_en')) or ev.creado_local,
        'usuario': _txt(p.get('usuario'), 120), 'total_ventas': _dec(r.get('total_ventas')),
        'efectivo_esperado': _dec(r.get('efectivo_esperado')), 'efectivo_contado': _dec(p.get('efectivo_contado')),
        'diferencia': _dec(p.get('diferencia')), 'resumen': r,
    })


def _credito(t, ev, p):
    _upsert(Credito, t, ev.entidad_id, ev.creado_local, {
        'numero': int(p.get('numero') or 0), 'cliente_id': _txt(p.get('cliente_id'), 40),
        'cliente': _txt(p.get('cliente'), 150), 'telefono': _txt(p.get('telefono'), 40),
        'total': _dec(p.get('total')), 'abonado': _dec(p.get('abonado')),
        'estado': _txt(p.get('estado') or 'PENDIENTE', 10), 'vence': _fecha(p.get('vence')),
        'venta_id': _txt(p.get('venta_id'), 40), 'creado_local': _dt(p.get('creado')) or ev.creado_local,
    })


def _abono(t, ev, p):
    _upsert(Abono, t, ev.entidad_id or str(ev.id), ev.creado_local, {
        'cliente_id': _txt(p.get('cliente_id'), 40), 'cliente': _txt(p.get('cliente'), 150),
        'monto': _dec(p.get('monto')), 'forma_pago': _txt(p.get('forma_pago'), 60),
        'saldo_nuevo': _dec(p.get('saldo_nuevo')), 'usuario': _txt(p.get('usuario'), 120),
        'fecha': _dt(p.get('fecha_hora')) or ev.creado_local,
    })


def _alerta(t, ev, p):
    _upsert(Alerta, t, ev.entidad_id or str(ev.id), ev.creado_local, {
        'accion': _txt(p.get('accion'), 20), 'usuario': _txt(p.get('usuario'), 120),
        'detalle': _txt(p.get('detalle'), 4000), 'terminal': _txt(p.get('terminal'), 40),
        'fecha': _dt(p.get('fecha_hora')) or ev.creado_local,
    })


PROYECCIONES = {
    'venta': _venta, 'producto': _producto, 'movimiento_inventario': _movimiento, 'cierre_caja': _cierre,
    'credito': _credito, 'abono': _abono, 'alerta': _alerta,
}


def proyectar(ev: Evento):
    fn = PROYECCIONES.get(ev.tipo)
    if fn:
        fn(ev.tienda, ev, ev.payload if isinstance(ev.payload, dict) else {})


def recibir(tienda: Tienda, eventos: list) -> list[str]:
    """Guarda y proyecta los eventos. Devuelve los ids aceptados (los repetidos también: ya estaban)."""
    recibidos = []
    for e in (eventos or [])[:MAX_EVENTOS]:
        if not isinstance(e, dict):
            continue
        try:
            uid = uuid.UUID(str(e.get('id')))
        except (ValueError, TypeError):
            continue
        with transaction.atomic():
            existente = Evento.objects.filter(id=uid).only('tienda_id').first()
            if existente:
                if existente.tienda_id == tienda.id:
                    recibidos.append(str(uid))
                continue
            ev = Evento.objects.create(
                id=uid, tienda=tienda, tipo=_txt(e.get('tipo'), 40), entidad_id=_txt(e.get('entidad_id'), 40),
                creado_local=_dt(e.get('creado')) or timezone.now(),
                payload=e.get('payload') if isinstance(e.get('payload'), dict) else {})
            try:
                with transaction.atomic():
                    proyectar(ev)
            except Exception as ex:  # el evento queda guardado para reprocesarlo; no se pierde
                log.exception('No se pudo proyectar el evento %s (%s) de %s', uid, ev.tipo, tienda)
                Evento.objects.filter(id=uid).update(error=str(ex)[:1000])
        recibidos.append(str(uid))
    if recibidos:
        Tienda.objects.filter(pk=tienda.pk).update(ultima_sincronizacion=timezone.now())
    return recibidos


def reprocesar(tienda: Tienda | None = None) -> int:
    """Vuelve a proyectar todos los eventos (tras corregir un error). Es seguro repetirlo."""
    qs = Evento.objects.select_related('tienda').order_by('creado_local')
    if tienda:
        qs = qs.filter(tienda=tienda)
    n = 0
    for ev in qs.iterator():
        with transaction.atomic():
            proyectar(ev)
            if ev.error:
                Evento.objects.filter(id=ev.id).update(error='')
        n += 1
    return n


def guardar_respaldo(tienda: Tienda, archivo) -> Respaldo:
    from nube.errores import ErrorNegocio
    if archivo.size > settings.RESPALDO_MAX_MB * 1024 * 1024:
        raise ErrorNegocio(f'El respaldo supera {settings.RESPALDO_MAX_MB} MB.', 413)
    if archivo.size < 1024:
        raise ErrorNegocio('El respaldo está vacío.')
    carpeta = settings.RESPALDOS_DIR / str(tienda.pk)
    carpeta.mkdir(parents=True, exist_ok=True)
    ahora = timezone.localtime()
    nombre_base = ''.join(c for c in (archivo.name or 'respaldo.dump') if c.isalnum() or c in '._-')[-80:]
    destino = carpeta / f'{ahora:%Y%m%d-%H%M%S}-{nombre_base or "respaldo.dump"}'
    h = hashlib.sha256()
    with open(destino, 'wb') as f:
        for trozo in archivo.chunks():
            h.update(trozo)
            f.write(trozo)
    r = Respaldo.objects.create(tienda=tienda, nombre=archivo.name or destino.name, ruta=str(destino),
                                tamano=destino.stat().st_size, sha256=h.hexdigest())
    Tienda.objects.filter(pk=tienda.pk).update(ultimo_respaldo=timezone.now())
    # Conservar solo los N más recientes
    for viejo in tienda.respaldos.order_by('-recibido')[settings.RESPALDOS_CONSERVAR:]:
        try:
            from pathlib import Path
            Path(viejo.ruta).unlink(missing_ok=True)
        except OSError:
            pass
        viejo.delete()
    return r
