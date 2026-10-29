"""Formatos de impresión: ticket de venta, comprobante de abono y cierre de caja."""
from django.utils import timezone

from .escpos import Ticket


def _m(v) -> str:
    return '$' + f'{float(v or 0):,.0f}'.replace(',', '.')


def _cant(v) -> str:
    v = float(v)
    return f'{v:g}' if v != int(v) else f'{int(v)}'


def _encabezado(t: Ticket, conf):
    t.alinear('centro').negrita().grande().linea(conf.nombre_negocio[:t.cols // 2]).grande(False).negrita(False)
    if conf.nit:
        t.linea(f'NIT/CC {conf.nit}')
    if conf.regimen:
        t.linea(conf.regimen)
    if conf.direccion:
        t.linea(conf.direccion + (f' - {conf.ciudad}' if conf.ciudad else ''))
    if conf.telefono:
        t.linea(f'Tel. {conf.telefono}')
    t.alinear('izq').separador()


def ticket_venta(venta, conf, abrir_cajon=False, copia=False) -> bytes:
    t = Ticket(conf.impresora_ancho)
    if abrir_cajon:
        t.abrir_cajon()
    _encabezado(t, conf)
    from facturacion.models import ConfigFacturacion
    doc = venta.documentos.filter(tipo='POS').first()
    if doc:
        fc = ConfigFacturacion.obtener()
        t.alinear('centro').negrita().linea('DOCUMENTO EQUIVALENTE')
        t.linea('ELECTRONICO POS').grande().linea(doc.numero_completo).grande(False).negrita(False)
        if doc.resolucion_numero:
            rango = f' del {fc.prefijo}{fc.rango_desde} al {fc.prefijo}{fc.rango_hasta}' if fc.rango_desde else ''
            vig = f' vigencia {fc.fecha_desde:%d/%m/%Y}-{fc.fecha_hasta:%d/%m/%Y}' if fc.fecha_desde and fc.fecha_hasta else ''
            t.parrafo(f'Res. DIAN No. {doc.resolucion_numero}{rango}{vig}')
        if doc.ambiente == 'PRUEBAS':
            t.negrita().linea('*** PRUEBAS - SIN VALIDEZ FISCAL ***').negrita(False)
        t.alinear('izq').separador()
        if doc.adquirente_tipo_doc != 'CF':
            t.linea(f'Adquirente: {doc.adquirente_nombre}')
            t.linea(f'{doc.adquirente_tipo_doc} {doc.adquirente_numero}')
    fecha = timezone.localtime(venta.creado)
    t.dos_columnas(f'Venta No. {venta.numero}', fecha.strftime('%d/%m/%Y %I:%M %p'))
    t.linea(f'Atendió: {venta.usuario.nombre}  ({venta.terminal})')
    if venta.cliente:
        t.linea(f'Cliente: {venta.cliente.nombre}')
    if copia:
        t.alinear('centro').negrita().linea('*** COPIA ***').negrita(False).alinear('izq')
    if venta.estado == 'ANULADA':
        t.alinear('centro').negrita().linea('*** VENTA ANULADA ***').negrita(False).alinear('izq')
    t.separador()
    for d in venta.detalle.all():
        t.linea(d.nombre_producto)
        t.dos_columnas(f'  {_cant(d.cantidad)} x {_m(d.precio_unit)}', _m(d.precio_unit * d.cantidad))
        if d.descuento:
            t.dos_columnas('  Descuento', '-' + _m(d.descuento))
    t.separador()
    if venta.descuento:
        t.dos_columnas('Subtotal', _m(venta.subtotal))
        t.dos_columnas('Descuentos', '-' + _m(venta.descuento))
    t.negrita().grande().dos_columnas('TOTAL', _m(venta.total)).grande(False).negrita(False)
    for p in venta.pagos.select_related('forma_pago'):
        t.dos_columnas(p.forma_pago.nombre + (f' ({p.referencia})' if p.referencia else ''), _m(p.recibido or p.monto))
    if venta.cambio:
        t.negrita().dos_columnas('Cambio', _m(venta.cambio)).negrita(False)
    credito = getattr(venta, 'credito', None)
    if credito:
        t.separador()
        t.linea(f'Fiado No. {credito.numero} - saldo cliente: {_m(venta.cliente.saldo_actual())}')
        t.avanzar(2).linea('Firma: ______________________________')
    if doc:
        from facturacion.services import armar_documento
        imp = [i for i in armar_documento(doc)['impuestos'] if i['tarifa']]
        if imp:
            t.separador()
            for i in imp:
                t.dos_columnas(f"Base IVA {i['tarifa']}%", _m(i['base']))
                t.dos_columnas(f"IVA {i['tarifa']}%", _m(i['valor']))
    t.separador()
    t.alinear('centro')
    if conf.mensaje_ticket:
        t.linea(conf.mensaje_ticket)
    if doc:
        if doc.cude:
            t.linea('CUDE:').parrafo(doc.cude)
            t.qr(doc.qr or doc.cude)
        else:
            t.linea('Documento pendiente de envio a la DIAN.')
            t.linea('Consultelo despues con su numero.')
    else:
        t.linea('Documento interno - no es factura electrónica')
    t.linea('CajaFacil - nautilustech.app')
    return t.cortar().bytes()


def comprobante_abono(cliente, resultado, forma_pago, usuario, conf) -> bytes:
    t = Ticket(conf.impresora_ancho)
    _encabezado(t, conf)
    t.alinear('centro').negrita().linea('COMPROBANTE DE ABONO').negrita(False).alinear('izq')
    t.linea(timezone.localtime().strftime('%d/%m/%Y %I:%M %p'))
    t.linea(f'Cliente: {cliente.nombre}')
    t.linea(f'Recibió: {usuario.nombre}')
    t.separador()
    for a in resultado['abonos']:
        t.dos_columnas(f'Fiado No. {a.credito.numero}', _m(a.monto))
    t.separador()
    t.dos_columnas('Saldo anterior', _m(resultado['saldo_anterior']))
    t.negrita().dos_columnas(f'Abono ({forma_pago.nombre})', _m(resultado['saldo_anterior'] - resultado['saldo_nuevo']))
    t.dos_columnas('Saldo pendiente', _m(resultado['saldo_nuevo'])).negrita(False)
    t.alinear('centro').linea('').linea('¡Gracias por su pago!')
    return t.cortar().bytes()


def ticket_cierre(caja, conf) -> bytes:
    r = caja.resumen or {}
    t = Ticket(conf.impresora_ancho)
    _encabezado(t, conf)
    t.alinear('centro').negrita().linea(f'CIERRE DE CAJA No. {caja.numero}').negrita(False).alinear('izq')
    t.linea(f'{caja.terminal}')
    t.linea('Apertura: ' + timezone.localtime(caja.abierta_en).strftime('%d/%m/%Y %I:%M %p'))
    if caja.cerrada_en:
        t.linea('Cierre:   ' + timezone.localtime(caja.cerrada_en).strftime('%d/%m/%Y %I:%M %p'))
    t.linea(f'Abrió: {caja.usuario_apertura.nombre}')
    if caja.usuario_cierre:
        t.linea(f'Cerró: {caja.usuario_cierre.nombre}')
    t.separador()
    t.dos_columnas('Ventas', f'{r.get("num_ventas", 0)}')
    t.dos_columnas('Total vendido', _m(r.get('total_ventas')))
    t.dos_columnas('Anuladas', f'{r.get("num_anuladas", 0)} ({_m(r.get("total_anulado"))})')
    t.separador()
    t.negrita().linea('Por forma de pago').negrita(False)
    for f in r.get('por_forma_pago', []):
        t.dos_columnas(f['nombre'], _m(f['total']))
        if f.get('abonos'):
            t.dos_columnas('  (abonos de fiado)', _m(f['abonos']))
    t.separador()
    t.dos_columnas('Base', _m(r.get('base')))
    t.dos_columnas('Ingresos de efectivo', _m(r.get('ingresos_efectivo')))
    t.dos_columnas('Salidas de efectivo', '-' + _m(r.get('egresos_efectivo')))
    t.negrita().dos_columnas('Efectivo esperado', _m(caja.efectivo_esperado))
    t.dos_columnas('Efectivo contado', _m(caja.efectivo_contado))
    dif = float(caja.diferencia or 0)
    etiqueta = 'CUADRADA' if dif == 0 else ('SOBRANTE' if dif > 0 else 'FALTANTE')
    t.dos_columnas(etiqueta, _m(abs(dif))).negrita(False)
    if caja.notas:
        t.separador().linea(f'Notas: {caja.notas}')
    t.avanzar(2).linea('Firma: ______________________________')
    return t.cortar().bytes()
