from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from auditoria.services import registrar
from catalogo.models import Producto
from catalogo.services import mover_stock
from core.errores import ErrorNegocio
from core.models import Configuracion, Consecutivo
from core.sync import encolar
from creditos.models import Cliente
from creditos.services import crear_credito, validar_cupo

from .models import Caja, FormaPago, MovimientoCaja, Venta, VentaDetalle, VentaPago

CERO = Decimal('0')


# ── Caja ─────────────────────────────────────────────────────────────

def caja_abierta(terminal: str) -> Caja | None:
    return Caja.objects.filter(terminal=terminal, estado='ABIERTA').first()


def abrir_caja(terminal: str, usuario, base, request=None) -> Caja:
    base = Decimal(str(base or 0))
    if base < 0:
        raise ErrorNegocio('La base no puede ser negativa.')
    if caja_abierta(terminal):
        raise ErrorNegocio('Ya hay una caja abierta en este equipo.')
    from core import licencia
    est = licencia.estado_actual()
    limite = est.max_cajas if est.estado == 'ACTIVA' else 2
    if Caja.objects.filter(estado='ABIERTA').exclude(terminal=terminal).count() >= limite:
        raise ErrorNegocio(f'Tu licencia permite {limite} caja(s) abiertas al tiempo. Cierra otra caja o amplía la licencia.')
    try:
        with transaction.atomic():
            caja = Caja.objects.create(numero=Consecutivo.siguiente('caja'), terminal=terminal,
                                       usuario_apertura=usuario, base=base)
    except IntegrityError:
        raise ErrorNegocio('Ya hay una caja abierta en este equipo.')
    registrar(usuario, 'CAJA', 'cajas', caja.id, valor_nuevo={'base': base},
              detalle=f'Apertura de caja #{caja.numero} ({terminal}) con base ${base:,.0f}', request=request)
    return caja


def calcular_resumen(caja: Caja) -> dict:
    """Totales del turno por forma de pago (ventas y abonos) y movimientos de efectivo."""
    from creditos.models import AbonoCredito

    ventas = Venta.objects.filter(caja=caja, estado='COMPLETADA')
    anuladas = Venta.objects.filter(caja=caja, estado='ANULADA')
    formas = {f.id: f for f in FormaPago.objects.all()}

    por_forma = {}

    def fila(fid):
        f = formas[fid]
        return por_forma.setdefault(str(fid), {
            'forma_pago_id': str(fid), 'nombre': f.nombre, 'tipo': f.tipo, 'color': f.color,
            'ventas': 0.0, 'abonos': 0.0, 'total': 0.0,
        })

    for r in VentaPago.objects.filter(venta__in=ventas).values('forma_pago').annotate(t=Sum('monto')):
        fila(r['forma_pago'])['ventas'] += float(r['t'] or 0)
    for r in AbonoCredito.objects.filter(caja=caja).values('forma_pago').annotate(t=Sum('monto')):
        fila(r['forma_pago'])['abonos'] += float(r['t'] or 0)
    for v in por_forma.values():
        v['total'] = v['ventas'] + v['abonos']

    # Los pagos ya están netos de cambio; el cambio se informa como dato
    cambio = float(ventas.aggregate(t=Sum('cambio'))['t'] or 0)
    ingresos = float(caja.movimientos.filter(tipo='INGRESO').aggregate(t=Sum('monto'))['t'] or 0)
    egresos = float(caja.movimientos.filter(tipo='EGRESO').aggregate(t=Sum('monto'))['t'] or 0)
    efectivo_recibido = sum(v['total'] for v in por_forma.values() if v['tipo'] == 'EFECTIVO')
    esperado = float(caja.base) + efectivo_recibido + ingresos - egresos

    agg = ventas.aggregate(total=Sum('total'), costo=Sum('costo_total'), desc=Sum('descuento'))
    return {
        'num_ventas': ventas.count(),
        'num_anuladas': anuladas.count(),
        'total_anulado': float(anuladas.aggregate(t=Sum('total'))['t'] or 0),
        'total_ventas': float(agg['total'] or 0),
        'total_descuentos': float(agg['desc'] or 0),
        'utilidad_estimada': float((agg['total'] or 0) - (agg['costo'] or 0)),
        'por_forma_pago': sorted(por_forma.values(), key=lambda x: -x['total']),
        'cambio_entregado': cambio,
        'ingresos_efectivo': ingresos,
        'egresos_efectivo': egresos,
        'base': float(caja.base),
        'efectivo_esperado': round(esperado, 2),
    }


@transaction.atomic
def cerrar_caja(caja: Caja, usuario, contado, notas='', request=None) -> Caja:
    caja = Caja.objects.select_for_update().get(pk=caja.pk)
    if caja.estado != 'ABIERTA':
        raise ErrorNegocio('La caja ya está cerrada.')
    contado = Decimal(str(contado or 0))
    res = calcular_resumen(caja)
    caja.resumen = res
    caja.efectivo_esperado = Decimal(str(res['efectivo_esperado']))
    caja.efectivo_contado = contado
    caja.diferencia = contado - caja.efectivo_esperado
    caja.estado = 'CERRADA'
    caja.cerrada_en = timezone.now()
    caja.usuario_cierre = usuario
    caja.notas = notas or ''
    caja.save()
    registrar(usuario, 'CAJA', 'cajas', caja.id,
              valor_nuevo={'esperado': caja.efectivo_esperado, 'contado': contado, 'diferencia': caja.diferencia},
              detalle=f'Cierre de caja #{caja.numero}: ventas ${res["total_ventas"]:,.0f}, '
                      f'esperado ${caja.efectivo_esperado:,.0f}, contado ${contado:,.0f}', request=request)
    if caja.diferencia != 0:
        tipo = 'sobrante' if caja.diferencia > 0 else 'faltante'
        registrar(usuario, 'DESCUADRE', 'cajas', caja.id, valor_nuevo={'diferencia': caja.diferencia},
                  detalle=f'Caja #{caja.numero} cerró con {tipo} de ${abs(caja.diferencia):,.0f}', request=request)
    encolar('cierre_caja', caja.id, {
        'numero': caja.numero, 'terminal': caja.terminal, 'abierta_en': caja.abierta_en,
        'cerrada_en': caja.cerrada_en, 'usuario': usuario.nombre, 'resumen': res,
        'efectivo_contado': contado, 'diferencia': caja.diferencia,
    })
    return caja


def registrar_movimiento_caja(caja: Caja, tipo, monto, concepto, usuario, request=None):
    monto = Decimal(str(monto or 0))
    if monto <= 0:
        raise ErrorNegocio('El valor debe ser mayor a 0.')
    if not (concepto or '').strip():
        raise ErrorNegocio('Escribe el concepto.')
    if caja.estado != 'ABIERTA':
        raise ErrorNegocio('La caja está cerrada.')
    mov = MovimientoCaja.objects.create(caja=caja, tipo=tipo, monto=monto, concepto=concepto.strip(),
                                        usuario=usuario)
    registrar(usuario, 'CAJA', 'movimientos_caja', mov.id, valor_nuevo={'tipo': tipo, 'monto': monto},
              detalle=f'{mov.get_tipo_display()} ${monto:,.0f}: {mov.concepto}', request=request)
    return mov


# ── Ventas ───────────────────────────────────────────────────────────

@transaction.atomic
def procesar_venta(datos: dict, usuario, terminal: str, request=None) -> Venta:
    """
    datos = {
      'detalle': [{'producto_id', 'cantidad', 'precio_unit'?, 'descuento'?}],
      'pagos':   [{'forma_pago_id', 'monto', 'referencia'?}],
      'cliente_id'?: obligatorio si hay pago a crédito,
      'nota'?: str
    }
    """
    conf = Configuracion.obtener()
    caja = caja_abierta(terminal)
    if not caja:
        raise ErrorNegocio('Abre la caja antes de vender.')

    detalle = datos.get('detalle') or []
    pagos = datos.get('pagos') or []
    if not detalle:
        raise ErrorNegocio('La venta no tiene productos.')
    if not pagos:
        raise ErrorNegocio('Indica la forma de pago.')

    # Validar y preparar líneas
    lineas = []
    for l in detalle:
        try:
            p = Producto.objects.select_related('categoria').get(pk=l['producto_id'])
        except (Producto.DoesNotExist, ValueError, KeyError):
            raise ErrorNegocio('Uno de los productos ya no existe. Actualiza la pantalla.')
        if not p.activo:
            raise ErrorNegocio(f'"{p.nombre}" está desactivado.')
        cantidad = Decimal(str(l.get('cantidad') or 0))
        if cantidad <= 0:
            raise ErrorNegocio(f'Cantidad inválida para "{p.nombre}".')
        if p.precio_variable:
            precio = Decimal(str(l.get('precio_unit') or 0))
            if precio <= 0:
                raise ErrorNegocio(f'Indica el precio de "{p.nombre}".')
        else:
            precio = p.precio_venta
        descuento = Decimal(str(l.get('descuento') or 0))
        bruto = (precio * cantidad).quantize(Decimal('0.01'))
        if descuento < 0 or descuento > bruto:
            raise ErrorNegocio(f'Descuento inválido en "{p.nombre}".')
        lineas.append((p, cantidad, precio, descuento, bruto))

    subtotal = sum((x[4] for x in lineas), CERO)
    descuento_total = sum((x[3] for x in lineas), CERO)
    total = subtotal - descuento_total

    # Validar pagos
    pagos_ok = []
    efectivo = credito = CERO
    for pg in pagos:
        try:
            fp = FormaPago.objects.get(pk=pg['forma_pago_id'], activa=True)
        except (FormaPago.DoesNotExist, ValueError, KeyError):
            raise ErrorNegocio('Forma de pago inválida.')
        monto = Decimal(str(pg.get('monto') or 0))
        if monto <= 0:
            continue
        if fp.requiere_referencia and not (pg.get('referencia') or '').strip():
            raise ErrorNegocio(f'Escribe la referencia del pago por {fp.nombre}.')
        if fp.es_efectivo:
            efectivo += monto
        if fp.es_credito:
            credito += monto
        pagos_ok.append((fp, monto, (pg.get('referencia') or '').strip()))
    pagado = sum((x[1] for x in pagos_ok), CERO)
    if pagado < total:
        raise ErrorNegocio(f'Falta dinero: el total es ${total:,.0f} y se registraron ${pagado:,.0f}.')
    cambio = pagado - total
    if cambio > efectivo:
        raise ErrorNegocio('Solo se puede dar cambio sobre pagos en efectivo. Revisa los montos.')
    if credito > total:
        raise ErrorNegocio('El valor a crédito no puede superar el total de la venta.')

    cliente = None
    if datos.get('cliente_id'):
        cliente = Cliente.objects.filter(pk=datos['cliente_id']).first()
        if not cliente:
            raise ErrorNegocio('El cliente no existe.')
    if credito > 0:
        if not cliente:
            raise ErrorNegocio('Selecciona el cliente para el fiado.')
        validar_cupo(cliente, credito)

    venta = Venta.objects.create(
        numero=Consecutivo.siguiente('venta'), caja=caja, terminal=terminal, usuario=usuario, cliente=cliente,
        subtotal=subtotal, descuento=descuento_total, total=total, total_pagado=pagado, cambio=cambio,
        nota=(datos.get('nota') or '')[:200])

    costo_total = CERO
    for p, cantidad, precio, descuento, bruto in lineas:
        VentaDetalle.objects.create(
            venta=venta, producto=p, nombre_producto=p.nombre, cantidad=cantidad, precio_unit=precio,
            costo_unit=p.precio_costo, descuento=descuento, subtotal=bruto - descuento, tarifa_iva=p.tarifa_iva)
        costo_total += (p.precio_costo * cantidad)
        if p.controla_stock:
            mover_stock(p, 'SALIDA', cantidad, usuario, motivo=f'Venta #{venta.numero}', referencia_tipo='VENTA',
                        referencia_id=venta.id, validar_existencia=not conf.vender_sin_stock)
        elif p.precio_variable and precio != p.precio_venta:
            Producto.objects.filter(pk=p.pk).update(precio_venta=precio)  # recuerda el último precio del día

    venta.costo_total = costo_total.quantize(Decimal('0.01'))
    venta.save(update_fields=['costo_total'])

    # El cambio sale del efectivo: el pago queda registrado por el valor aplicado y se guarda lo recibido
    por_devolver = cambio
    for fp, monto, ref in pagos_ok:
        aplicado = monto
        if fp.es_efectivo and por_devolver > 0:
            descuento_cambio = min(por_devolver, monto)
            aplicado = monto - descuento_cambio
            por_devolver -= descuento_cambio
        if aplicado > 0:
            VentaPago.objects.create(venta=venta, forma_pago=fp, monto=aplicado, recibido=monto, referencia=ref)

    if credito > 0:
        crear_credito(cliente, credito, usuario, venta=venta, notas=f'Venta #{venta.numero}', request=request)

    registrar(usuario, 'INSERT', 'ventas', venta.id, valor_nuevo={'total': total, 'items': len(lineas)},
              detalle=f'Venta #{venta.numero} por ${total:,.0f} ({len(lineas)} productos)', request=request)
    if descuento_total > 0:
        registrar(usuario, 'DESCUENTO', 'ventas', venta.id, valor_nuevo={'descuento': descuento_total},
                  detalle=f'Descuento de ${descuento_total:,.0f} en venta #{venta.numero}', request=request)

    # Facturación electrónica (si el módulo está activo): documento POS con el consecutivo de la resolución
    from facturacion import services as fe
    fe.crear_para_venta(venta, datos.get('adquirente'))

    encolar('venta', venta.id, payload_venta(venta))
    return venta


@transaction.atomic
def anular_venta(venta: Venta, motivo: str, usuario, request=None) -> Venta:
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado != 'COMPLETADA':
        raise ErrorNegocio('La venta ya está anulada.')
    motivo = (motivo or '').strip()
    if len(motivo) < 5:
        raise ErrorNegocio('Escribe el motivo de la anulación (mínimo 5 letras).')
    credito = getattr(venta, 'credito', None)
    if credito and credito.abonado > 0:
        raise ErrorNegocio('La venta tiene un fiado con abonos. Anula primero los abonos o haz una devolución.')

    for d in venta.detalle.select_related('producto__categoria'):
        if d.producto.controla_stock:
            mover_stock(d.producto, 'DEVOLUCION', d.cantidad, usuario, motivo=f'Anulación venta #{venta.numero}',
                        referencia_tipo='VENTA', referencia_id=venta.id)
    if credito:
        credito.estado = 'ANULADO'
        credito.save(update_fields=['estado', 'actualizado'])

    venta.estado = 'ANULADA'
    venta.motivo_anulacion = motivo
    venta.anulada_por = usuario
    venta.anulada_en = timezone.now()
    venta.save(update_fields=['estado', 'motivo_anulacion', 'anulada_por', 'anulada_en', 'actualizado'])
    from facturacion import services as fe
    fe.crear_nota_ajuste(venta, motivo)
    registrar(usuario, 'CANCEL', 'ventas', venta.id, valor_anterior={'estado': 'COMPLETADA'},
              valor_nuevo={'estado': 'ANULADA', 'motivo': motivo},
              detalle=f'Anulación venta #{venta.numero} por ${venta.total:,.0f}: {motivo}', request=request)
    encolar('venta', venta.id, payload_venta(venta))
    return venta


def payload_venta(v: Venta) -> dict:
    return {
        'numero': v.numero, 'terminal': v.terminal, 'fecha_hora': v.creado, 'usuario': v.usuario.nombre,
        'cliente': v.cliente.nombre if v.cliente else None, 'subtotal': v.subtotal, 'descuento': v.descuento,
        'total': v.total, 'costo_total': v.costo_total, 'cambio': v.cambio, 'estado': v.estado,
        'motivo_anulacion': v.motivo_anulacion,
        'detalle': [{'producto_id': d.producto_id, 'nombre': d.nombre_producto, 'cantidad': d.cantidad,
                     'precio_unit': d.precio_unit, 'descuento': d.descuento, 'subtotal': d.subtotal,
                     # existencias después de la venta (o de la anulación): la nube muestra el inventario al día
                     **({'stock': d.producto.stock} if d.producto_id else {})}
                    for d in v.detalle.select_related('producto')],
        'pagos': [{'forma_pago': p.forma_pago.nombre, 'tipo': p.forma_pago.tipo, 'monto': p.monto}
                  for p in v.pagos.select_related('forma_pago')],
    }
