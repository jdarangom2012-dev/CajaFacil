import uuid
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from auditoria.services import registrar
from core.errores import ErrorNegocio
from core.models import Configuracion, Consecutivo
from core.sync import encolar

from .models import AbonoCredito, Cliente, Credito


def validar_cupo(cliente: Cliente, monto: Decimal):
    saldo = cliente.saldo_actual()
    cupo = cliente.cupo_efectivo()
    if cupo and saldo + monto > cupo:
        disponible = max(cupo - saldo, Decimal('0'))
        raise ErrorNegocio(
            f'{cliente.nombre} supera su cupo de fiado (${cupo:,.0f}). '
            f'Debe ${saldo:,.0f}; disponible ${disponible:,.0f}.')


def crear_credito(cliente: Cliente, monto, usuario, venta=None, notas='', request=None) -> Credito:
    monto = Decimal(str(monto))
    if monto <= 0:
        raise ErrorNegocio('El valor del crédito debe ser mayor a 0.')
    if not cliente.activo:
        raise ErrorNegocio('El cliente está inactivo.')
    validar_cupo(cliente, monto)
    conf = Configuracion.obtener()
    c = Credito.objects.create(
        numero=Consecutivo.siguiente('credito'), cliente=cliente, venta=venta, total=monto,
        vence=timezone.localdate() + timedelta(days=conf.dias_vencimiento_credito) if conf.dias_vencimiento_credito else None,
        usuario=usuario, notas=notas or '')
    registrar(usuario, 'INSERT', 'creditos', c.id, valor_nuevo={'cliente': cliente.nombre, 'total': monto},
              detalle=f'Fiado #{c.numero} a {cliente.nombre} por ${monto:,.0f}', request=request)
    encolar('credito', c.id, payload_credito(c))
    return c


@transaction.atomic
def abonar(cliente: Cliente, monto, forma_pago, usuario, caja=None, nota='', referencia='', request=None):
    """Aplica un pago del cliente a sus créditos pendientes, del más antiguo al más reciente."""
    monto = Decimal(str(monto))
    if monto <= 0:
        raise ErrorNegocio('El abono debe ser mayor a 0.')
    if forma_pago.es_credito:
        raise ErrorNegocio('No se puede abonar con la forma de pago Crédito.')
    pendientes = list(Credito.objects.select_for_update().filter(cliente=cliente, estado='PENDIENTE')
                      .order_by('creado'))
    saldo = sum((c.saldo for c in pendientes), Decimal('0'))
    if saldo <= 0:
        raise ErrorNegocio(f'{cliente.nombre} no tiene saldo pendiente.')
    if monto > saldo:
        raise ErrorNegocio(f'El abono supera la deuda (${saldo:,.0f}).')

    grupo = uuid.uuid4()
    restante = monto
    abonos = []
    for c in pendientes:
        if restante <= 0:
            break
        aplicar = min(restante, c.saldo)
        abonos.append(AbonoCredito.objects.create(
            credito=c, grupo=grupo, forma_pago=forma_pago, monto=aplicar, nota=nota or '',
            referencia=referencia or '', caja=caja, usuario=usuario))
        c.abonado += aplicar
        if c.saldo <= 0:
            c.estado = 'PAGADO'
            c.pagado_en = timezone.now()
        c.save(update_fields=['abonado', 'estado', 'pagado_en', 'actualizado'])
        encolar('credito', c.id, payload_credito(c))
        restante -= aplicar

    nuevo_saldo = saldo - monto
    registrar(usuario, 'INSERT', 'abonos', grupo,
              valor_nuevo={'cliente': cliente.nombre, 'monto': monto, 'forma_pago': forma_pago.nombre},
              detalle=f'Abono de {cliente.nombre} por ${monto:,.0f} ({forma_pago.nombre}). Saldo: ${nuevo_saldo:,.0f}',
              request=request)
    encolar('abono', grupo, {
        'cliente_id': cliente.id, 'cliente': cliente.nombre, 'monto': monto, 'forma_pago': forma_pago.nombre,
        'saldo_nuevo': nuevo_saldo, 'usuario': usuario.nombre, 'fecha_hora': timezone.now(),
    })
    return {'grupo': grupo, 'abonos': abonos, 'saldo_anterior': saldo, 'saldo_nuevo': nuevo_saldo}


def payload_credito(c: Credito) -> dict:
    return {
        'numero': c.numero, 'cliente_id': c.cliente_id, 'cliente': c.cliente.nombre,
        'telefono': c.cliente.telefono, 'total': c.total, 'abonado': c.abonado, 'estado': c.estado,
        'vence': c.vence, 'venta_id': c.venta_id, 'creado': c.creado,
    }
