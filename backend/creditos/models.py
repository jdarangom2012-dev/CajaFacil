from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import F, Sum
from django.utils import timezone

from core.models import ModeloBase


class Cliente(ModeloBase):
    nombre = models.CharField(max_length=150, db_index=True)
    telefono = models.CharField(max_length=30, blank=True)
    documento = models.CharField(max_length=30, blank=True)
    direccion = models.CharField(max_length=200, blank=True)
    cupo = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                               help_text='Tope de fiado. Vacío = el de Configuración.')
    notas = models.CharField(max_length=300, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    def saldo_actual(self) -> Decimal:
        r = self.creditos.filter(estado='PENDIENTE').aggregate(s=Sum(F('total') - F('abonado')))
        return r['s'] or Decimal('0')

    def cupo_efectivo(self) -> Decimal:
        if self.cupo is not None:
            return self.cupo
        from core.models import Configuracion
        return Configuracion.obtener().tope_credito_defecto


class Credito(ModeloBase):
    ESTADO_CHOICES = [('PENDIENTE', 'Pendiente'), ('PAGADO', 'Pagado'), ('ANULADO', 'Anulado')]

    numero = models.PositiveIntegerField(unique=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name='creditos')
    venta = models.OneToOneField('ventas.Venta', on_delete=models.PROTECT, null=True, blank=True,
                                 related_name='credito')
    total = models.DecimalField(max_digits=12, decimal_places=2)
    abonado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='PENDIENTE', db_index=True)
    vence = models.DateField(null=True, blank=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='creditos')
    notas = models.CharField(max_length=300, blank=True)
    pagado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-creado']

    def __str__(self):
        return f'Crédito #{self.numero} {self.cliente}'

    @property
    def saldo(self) -> Decimal:
        return self.total - self.abonado

    @property
    def vencido(self) -> bool:
        return self.estado == 'PENDIENTE' and bool(self.vence) and self.vence < timezone.localdate()

    @property
    def dias_mora(self) -> int:
        if not self.vencido:
            return 0
        return (timezone.localdate() - self.vence).days


class AbonoCredito(ModeloBase):
    credito = models.ForeignKey(Credito, on_delete=models.PROTECT, related_name='abonos')
    grupo = models.UUIDField(db_index=True, help_text='Un pago del cliente puede repartirse en varios créditos.')
    forma_pago = models.ForeignKey('ventas.FormaPago', on_delete=models.PROTECT, related_name='abonos')
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    referencia = models.CharField(max_length=100, blank=True)
    nota = models.CharField(max_length=200, blank=True)
    caja = models.ForeignKey('ventas.Caja', on_delete=models.PROTECT, null=True, blank=True, related_name='abonos')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='abonos')

    class Meta:
        ordering = ['-creado']
