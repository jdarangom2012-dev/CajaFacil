"""
Copia en la nube de lo que pasa en cada tienda.

Cada tienda manda "eventos" (venta, cierre_caja, credito, abono, producto, movimiento_inventario, alerta).
Se guardan tal cual en Evento (idempotente por id) y se proyectan a tablas fáciles de consultar.
Todas las tablas llevan la tienda: el panel SIEMPRE filtra por las tiendas del usuario.
"""
import uuid

from django.db import models

from tiendas.models import Tienda


class Evento(models.Model):
    id = models.UUIDField(primary_key=True)  # el mismo id que generó la tienda
    tienda = models.ForeignKey(Tienda, on_delete=models.CASCADE, related_name='eventos')
    tipo = models.CharField(max_length=40, db_index=True)
    entidad_id = models.CharField(max_length=40, blank=True)
    creado_local = models.DateTimeField(help_text='Cuándo ocurrió en la tienda')
    recibido = models.DateTimeField(auto_now_add=True)
    payload = models.JSONField()
    error = models.TextField(blank=True)

    class Meta:
        ordering = ['creado_local']
        indexes = [models.Index(fields=['tienda', 'tipo', 'creado_local'])]


class Proyectado(models.Model):
    """Base: fila que viene de la tienda (local_id) y se reemplaza con el evento más reciente."""
    tienda = models.ForeignKey(Tienda, on_delete=models.CASCADE)
    local_id = models.CharField(max_length=40)
    evento_en = models.DateTimeField(help_text='Fecha local del evento que dejó esta fila así')

    class Meta:
        abstract = True


class Venta(Proyectado):
    numero = models.PositiveIntegerField(default=0)
    terminal = models.CharField(max_length=40, blank=True)
    fecha = models.DateTimeField(db_index=True)
    usuario = models.CharField(max_length=120, blank=True)
    cliente = models.CharField(max_length=150, blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    costo_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    estado = models.CharField(max_length=12, default='COMPLETADA', db_index=True)
    motivo_anulacion = models.TextField(blank=True)
    pagos = models.JSONField(default=list)

    class Meta:
        unique_together = [('tienda', 'local_id')]
        ordering = ['-fecha']
        indexes = [models.Index(fields=['tienda', 'estado', 'fecha'])]


class VentaItem(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='items')
    producto_id = models.CharField(max_length=40, blank=True)
    nombre = models.CharField(max_length=200)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    precio_unit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)


class Producto(Proyectado):
    codigo_barras = models.CharField(max_length=60, blank=True)
    nombre = models.CharField(max_length=200)
    categoria = models.CharField(max_length=100, blank=True)
    precio_costo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    unidad_medida = models.CharField(max_length=20, blank=True)
    stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_en = models.DateTimeField(null=True, blank=True, help_text='Fecha local del último dato de existencias')
    activo = models.BooleanField(default=True)

    class Meta:
        unique_together = [('tienda', 'local_id')]
        ordering = ['nombre']


class MovimientoInventario(Proyectado):
    producto_id = models.CharField(max_length=40, blank=True)
    producto = models.CharField(max_length=200, blank=True)
    tipo = models.CharField(max_length=20)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_anterior = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_nuevo = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    motivo = models.TextField(blank=True)
    usuario = models.CharField(max_length=120, blank=True)
    fecha = models.DateTimeField(db_index=True)

    class Meta:
        unique_together = [('tienda', 'local_id')]
        ordering = ['-fecha']


class Cierre(Proyectado):
    numero = models.PositiveIntegerField(default=0)
    terminal = models.CharField(max_length=40, blank=True)
    abierta_en = models.DateTimeField(null=True, blank=True)
    cerrada_en = models.DateTimeField(db_index=True)
    usuario = models.CharField(max_length=120, blank=True)
    total_ventas = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    efectivo_esperado = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    efectivo_contado = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    diferencia = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    resumen = models.JSONField(default=dict)

    class Meta:
        unique_together = [('tienda', 'local_id')]
        ordering = ['-cerrada_en']


class Credito(Proyectado):
    numero = models.PositiveIntegerField(default=0)
    cliente_id = models.CharField(max_length=40, db_index=True)
    cliente = models.CharField(max_length=150)
    telefono = models.CharField(max_length=40, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    abonado = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    estado = models.CharField(max_length=10, default='PENDIENTE', db_index=True)
    vence = models.DateField(null=True, blank=True)
    venta_id = models.CharField(max_length=40, blank=True)
    creado_local = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('tienda', 'local_id')]
        ordering = ['-creado_local']

    @property
    def saldo(self):
        return self.total - self.abonado


class Abono(Proyectado):
    cliente_id = models.CharField(max_length=40, db_index=True)
    cliente = models.CharField(max_length=150)
    monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    forma_pago = models.CharField(max_length=60, blank=True)
    saldo_nuevo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    usuario = models.CharField(max_length=120, blank=True)
    fecha = models.DateTimeField(db_index=True)

    class Meta:
        unique_together = [('tienda', 'local_id')]
        ordering = ['-fecha']


class Alerta(Proyectado):
    accion = models.CharField(max_length=20)
    usuario = models.CharField(max_length=120, blank=True)
    detalle = models.TextField(blank=True)
    terminal = models.CharField(max_length=40, blank=True)
    fecha = models.DateTimeField(db_index=True)
    vista = models.BooleanField(default=False)

    class Meta:
        unique_together = [('tienda', 'local_id')]
        ordering = ['-fecha']


class Respaldo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tienda = models.ForeignKey(Tienda, on_delete=models.CASCADE, related_name='respaldos')
    nombre = models.CharField(max_length=200)
    ruta = models.CharField(max_length=400)
    tamano = models.PositiveBigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True)
    recibido = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-recibido']
