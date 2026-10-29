from decimal import Decimal

from django.conf import settings
from django.db import models

from core.models import ModeloBase


class FormaPago(ModeloBase):
    TIPO_CHOICES = [
        ('EFECTIVO', 'Efectivo'),
        ('TRANSFERENCIA', 'Transferencia / billetera (Nequi, Daviplata, Bre-B)'),
        ('TARJETA', 'Tarjeta (datáfono)'),
        ('CREDITO', 'Crédito (fiado)'),
        ('OTRO', 'Otro'),
    ]
    nombre = models.CharField(max_length=50, unique=True)
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES, default='OTRO')
    requiere_referencia = models.BooleanField(default=False)
    color = models.CharField(max_length=9, default='#1570EF')
    orden = models.PositiveSmallIntegerField(default=10)
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre

    @property
    def es_efectivo(self):
        return self.tipo == 'EFECTIVO'

    @property
    def es_credito(self):
        return self.tipo == 'CREDITO'


class Caja(ModeloBase):
    """Turno de caja: desde la apertura (con base) hasta el cierre (con conteo)."""
    ESTADO_CHOICES = [('ABIERTA', 'Abierta'), ('CERRADA', 'Cerrada')]

    numero = models.PositiveIntegerField(db_index=True)
    terminal = models.CharField(max_length=30, default='CAJA-1', db_index=True)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='ABIERTA', db_index=True)
    usuario_apertura = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                         related_name='cajas_abiertas')
    usuario_cierre = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True,
                                       blank=True, related_name='cajas_cerradas')
    abierta_en = models.DateTimeField(auto_now_add=True)
    cerrada_en = models.DateTimeField(null=True, blank=True)
    base = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    resumen = models.JSONField(default=dict, blank=True)
    efectivo_esperado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    efectivo_contado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    diferencia = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    notas = models.TextField(blank=True)

    class Meta:
        ordering = ['-abierta_en']
        constraints = [
            models.UniqueConstraint(fields=['terminal'], condition=models.Q(estado='ABIERTA'),
                                    name='una_caja_abierta_por_terminal'),
        ]

    def __str__(self):
        return f'Caja #{self.numero} {self.terminal} ({self.estado})'


class MovimientoCaja(ModeloBase):
    """Entradas y salidas de efectivo que no son ventas: pago a proveedores, gastos, retiros, etc."""
    TIPO_CHOICES = [('INGRESO', 'Ingreso de efectivo'), ('EGRESO', 'Salida de efectivo')]
    caja = models.ForeignKey(Caja, on_delete=models.PROTECT, related_name='movimientos')
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    concepto = models.CharField(max_length=200)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        ordering = ['-creado']


class Venta(ModeloBase):
    ESTADO_CHOICES = [('COMPLETADA', 'Completada'), ('ANULADA', 'Anulada')]

    numero = models.PositiveIntegerField(unique=True)
    caja = models.ForeignKey(Caja, on_delete=models.PROTECT, related_name='ventas', null=True, blank=True)
    terminal = models.CharField(max_length=30, default='CAJA-1')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='ventas')
    cliente = models.ForeignKey('creditos.Cliente', on_delete=models.PROTECT, null=True, blank=True,
                                related_name='ventas')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_pagado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cambio = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    costo_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=12, choices=ESTADO_CHOICES, default='COMPLETADA', db_index=True)
    motivo_anulacion = models.CharField(max_length=300, blank=True)
    anulada_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
                                    related_name='ventas_anuladas')
    anulada_en = models.DateTimeField(null=True, blank=True)
    nota = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-creado']

    def __str__(self):
        return f'Venta #{self.numero}'

    @property
    def utilidad(self) -> Decimal:
        return self.total - self.costo_total


class VentaDetalle(ModeloBase):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='detalle')
    producto = models.ForeignKey('catalogo.Producto', on_delete=models.PROTECT, related_name='ventas_detalle')
    nombre_producto = models.CharField(max_length=200)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    precio_unit = models.DecimalField(max_digits=12, decimal_places=2)
    costo_unit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tarifa_iva = models.PositiveSmallIntegerField(default=0)  # % de IVA incluido al momento de vender

    class Meta:
        ordering = ['creado']


class VentaPago(ModeloBase):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='pagos')
    forma_pago = models.ForeignKey(FormaPago, on_delete=models.PROTECT, related_name='pagos')
    monto = models.DecimalField(max_digits=12, decimal_places=2, help_text='Valor aplicado a la venta (sin el cambio).')
    recibido = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                   help_text='Lo que entregó el cliente (efectivo: incluye el cambio).')
    referencia = models.CharField(max_length=100, blank=True)


class CuentaEspera(ModeloBase):
    """Venta en espera (el cliente fue por algo más). Antes vivía en localStorage del navegador."""
    terminal = models.CharField(max_length=30, default='CAJA-1')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    nombre = models.CharField(max_length=60, blank=True)
    items = models.JSONField(default=list)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['creado']
