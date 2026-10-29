from decimal import Decimal

from django.conf import settings
from django.db import models

from core.models import ModeloBase


class Categoria(ModeloBase):
    nombre = models.CharField(max_length=80, unique=True)
    descripcion = models.CharField(max_length=200, blank=True)
    color = models.CharField(max_length=9, blank=True, default='#1570EF')
    precio_variable = models.BooleanField(
        default=False, help_text='El cajero digita el precio en cada venta (ej. Fruver).')
    controla_stock = models.BooleanField(default=True)
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Producto(ModeloBase):
    UNIDAD_CHOICES = [
        ('UNIDAD', 'Unidad'),
        ('KG', 'Kilogramo'),
        ('LIBRA', 'Libra'),
        ('GRAMO', 'Gramo'),
        ('LITRO', 'Litro'),
        ('PAQUETE', 'Paquete'),
        ('CAJA', 'Caja'),
        ('BOTELLA', 'Botella'),
        ('BOLSA', 'Bolsa'),
    ]
    UNIDADES_PESO = ('KG', 'LIBRA', 'GRAMO')
    TARIFAS_IVA = [(0, 'Sin IVA / excluido'), (5, 'IVA 5%'), (19, 'IVA 19%')]

    codigo_barras = models.CharField(max_length=50, unique=True, null=True, blank=True)
    nombre = models.CharField(max_length=200, db_index=True)
    descripcion = models.CharField(max_length=300, blank=True)
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name='productos')
    precio_costo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2)
    unidad_medida = models.CharField(max_length=10, choices=UNIDAD_CHOICES, default='UNIDAD')
    stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    imagen = models.CharField(max_length=200, blank=True)
    favorito = models.BooleanField(default=False, help_text='Aparece como tecla rápida en la caja.')
    tarifa_iva = models.PositiveSmallIntegerField(choices=TARIFAS_IVA, default=0,
                                                  help_text='IVA incluido en el precio (para facturación electrónica).')
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    @property
    def se_vende_por_peso(self):
        return self.unidad_medida in self.UNIDADES_PESO

    @property
    def precio_variable(self):
        return self.categoria.precio_variable

    @property
    def controla_stock(self):
        return self.categoria.controla_stock

    @property
    def margen(self):
        if self.precio_costo and self.precio_costo > 0:
            return round(float((self.precio_venta - self.precio_costo) / self.precio_costo * 100), 1)
        return None

    @property
    def bajo_minimo(self):
        return self.controla_stock and self.stock <= self.stock_minimo

    @property
    def imagen_url(self):
        return f'{settings.MEDIA_URL}{self.imagen}' if self.imagen else ''


class MovimientoInventario(ModeloBase):
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada de mercancía'),
        ('SALIDA', 'Salida por venta'),
        ('DEVOLUCION', 'Devolución / anulación'),
        ('AJUSTE_POS', 'Ajuste positivo'),
        ('AJUSTE_NEG', 'Ajuste negativo'),
        ('CONTEO', 'Conteo físico'),
        ('INICIAL', 'Inventario inicial'),
    ]
    SUMAN = ('ENTRADA', 'DEVOLUCION', 'AJUSTE_POS', 'INICIAL')
    RESTAN = ('SALIDA', 'AJUSTE_NEG')

    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='movimientos')
    tipo = models.CharField(max_length=12, choices=TIPO_CHOICES, db_index=True)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    stock_anterior = models.DecimalField(max_digits=12, decimal_places=3)
    stock_nuevo = models.DecimalField(max_digits=12, decimal_places=3)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    proveedor = models.CharField(max_length=120, blank=True)
    referencia_tipo = models.CharField(max_length=20, blank=True)
    referencia_id = models.CharField(max_length=40, blank=True)
    motivo = models.CharField(max_length=300, blank=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                related_name='movimientos_inventario')

    class Meta:
        ordering = ['-creado']

    def __str__(self):
        return f'{self.tipo} {self.producto} {self.cantidad}'

    @property
    def diferencia(self) -> Decimal:
        return self.stock_nuevo - self.stock_anterior
