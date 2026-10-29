from decimal import Decimal

from django.db import transaction

from core.errores import ErrorNegocio
from core.sync import encolar

from .models import MovimientoInventario, Producto


@transaction.atomic
def mover_stock(producto: Producto, tipo: str, cantidad, usuario, motivo='', referencia_tipo='',
                referencia_id='', costo_unitario=None, proveedor='', validar_existencia=False):
    """Única puerta para cambiar el stock: bloquea la fila, registra el movimiento y encola la sincronización."""
    cantidad = Decimal(str(cantidad))
    if cantidad < 0:
        raise ErrorNegocio('La cantidad no puede ser negativa.')
    p = Producto.objects.select_for_update().get(pk=producto.pk)
    anterior = p.stock
    if tipo in MovimientoInventario.SUMAN:
        nuevo = anterior + cantidad
    elif tipo in MovimientoInventario.RESTAN:
        if validar_existencia and cantidad > anterior:
            raise ErrorNegocio(f'Stock insuficiente de "{p.nombre}". Disponible: {anterior.normalize():f}.')
        nuevo = anterior - cantidad
    elif tipo == 'CONTEO':
        nuevo = cantidad
    else:
        raise ErrorNegocio('Tipo de movimiento inválido.')

    p.stock = nuevo
    campos = ['stock', 'actualizado']
    if tipo == 'ENTRADA' and costo_unitario:
        p.precio_costo = Decimal(str(costo_unitario))
        campos.append('precio_costo')
    p.save(update_fields=campos)

    mov = MovimientoInventario.objects.create(
        producto=p, tipo=tipo, cantidad=cantidad, stock_anterior=anterior, stock_nuevo=nuevo,
        costo_unitario=costo_unitario, proveedor=proveedor or '', referencia_tipo=referencia_tipo,
        referencia_id=str(referencia_id or ''), motivo=motivo or '', usuario=usuario,
    )
    if tipo not in ('SALIDA', 'DEVOLUCION'):  # las ventas viajan completas en el evento de venta
        encolar('movimiento_inventario', mov.id, {
            'producto_id': p.id, 'producto': p.nombre, 'tipo': tipo, 'cantidad': cantidad,
            'stock_anterior': anterior, 'stock_nuevo': nuevo, 'motivo': motivo,
            'usuario': usuario.nombre, 'fecha_hora': mov.creado,
        })
    producto.stock = nuevo
    return mov


def payload_producto(p: Producto) -> dict:
    return {
        'id': p.id, 'codigo_barras': p.codigo_barras, 'nombre': p.nombre,
        'categoria': p.categoria.nombre, 'precio_costo': p.precio_costo, 'precio_venta': p.precio_venta,
        'unidad_medida': p.unidad_medida, 'stock': p.stock, 'stock_minimo': p.stock_minimo,
        'activo': p.activo,
    }


def siguiente_codigo_interno() -> str:
    codigos = Producto.objects.filter(codigo_barras__startswith='INT-').values_list('codigo_barras', flat=True)
    maximo = 0
    for c in codigos:
        try:
            maximo = max(maximo, int(c[4:]))
        except ValueError:
            pass
    return f'INT-{maximo + 1:05d}'
