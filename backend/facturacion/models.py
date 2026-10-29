from django.db import models
from django.utils import timezone

from core.models import ModeloBase


class ConfigFacturacion(models.Model):
    """Configuración única (pk=1) del módulo de facturación electrónica."""
    AMBIENTES = [('PRUEBAS', 'Pruebas (habilitación)'), ('PRODUCCION', 'Producción')]

    activa = models.BooleanField(default=False)
    proveedor = models.CharField(max_length=30, default='SIMULADO')
    ambiente = models.CharField(max_length=12, choices=AMBIENTES, default='PRUEBAS')
    # Credenciales del proveedor tecnológico (se guardan solo en este equipo)
    api_url = models.CharField(max_length=200, blank=True)
    api_usuario = models.CharField(max_length=120, blank=True)
    api_clave = models.CharField(max_length=200, blank=True)
    api_token = models.TextField(blank=True)
    # Resolución de numeración DIAN para documento equivalente POS
    resolucion_numero = models.CharField(max_length=40, blank=True)
    prefijo = models.CharField(max_length=10, blank=True)
    rango_desde = models.PositiveBigIntegerField(null=True, blank=True)
    rango_hasta = models.PositiveBigIntegerField(null=True, blank=True)
    fecha_desde = models.DateField(null=True, blank=True)
    fecha_hasta = models.DateField(null=True, blank=True)
    clave_tecnica = models.CharField(max_length=120, blank=True)
    siguiente_numero = models.PositiveBigIntegerField(null=True, blank=True)
    aviso_numeros = models.PositiveIntegerField(default=500, help_text='Avisar cuando queden estos números o menos.')
    aviso_dias = models.PositiveIntegerField(default=15, help_text='Avisar estos días antes de que venza la resolución.')
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuración de facturación'

    @classmethod
    def obtener(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def proximo(self):
        return self.siguiente_numero or self.rango_desde

    @property
    def restantes(self):
        if not self.rango_hasta or not self.proximo:
            return None
        return max(0, self.rango_hasta - self.proximo + 1)


class DocumentoElectronico(ModeloBase):
    TIPOS = [('POS', 'Documento equivalente POS'), ('NOTA_AJUSTE', 'Nota de ajuste')]
    ESTADOS = [
        ('PENDIENTE', 'Pendiente de envío'),
        ('ACEPTADO', 'Aceptado por la DIAN'),
        ('RECHAZADO', 'Rechazado'),
    ]
    TIPOS_DOC = [('CF', 'Consumidor final'), ('CC', 'Cédula'), ('NIT', 'NIT'), ('CE', 'Cédula de extranjería'),
                 ('PP', 'Pasaporte'), ('TI', 'Tarjeta de identidad')]

    tipo = models.CharField(max_length=12, choices=TIPOS, default='POS')
    venta = models.ForeignKey('ventas.Venta', on_delete=models.PROTECT, related_name='documentos')
    referencia = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='notas')
    prefijo = models.CharField(max_length=10, blank=True)
    numero = models.PositiveBigIntegerField()
    ambiente = models.CharField(max_length=12, default='PRUEBAS')
    proveedor = models.CharField(max_length=30, default='SIMULADO')
    resolucion_numero = models.CharField(max_length=40, blank=True)
    estado = models.CharField(max_length=12, choices=ESTADOS, default='PENDIENTE', db_index=True)
    cude = models.CharField(max_length=200, blank=True)
    qr = models.TextField(blank=True)
    motivo = models.CharField(max_length=300, blank=True)  # para notas de ajuste
    # Adquirente (quien compra). Por defecto, consumidor final.
    adquirente_tipo_doc = models.CharField(max_length=4, choices=TIPOS_DOC, default='CF')
    adquirente_numero = models.CharField(max_length=30, default='222222222222')
    adquirente_nombre = models.CharField(max_length=150, default='Consumidor final')
    adquirente_correo = models.EmailField(blank=True)
    adquirente_telefono = models.CharField(max_length=30, blank=True)
    adquirente_direccion = models.CharField(max_length=200, blank=True)
    # Envío
    intentos = models.PositiveIntegerField(default=0)
    proximo_intento = models.DateTimeField(default=timezone.now)
    ultimo_error = models.TextField(blank=True)
    enviado_en = models.DateTimeField(null=True, blank=True)
    respuesta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-creado']
        constraints = [models.UniqueConstraint(fields=['tipo', 'prefijo', 'numero', 'ambiente'], name='fe_numero_unico')]

    def __str__(self):
        return self.numero_completo

    @property
    def numero_completo(self):
        return f'{self.prefijo}{self.numero}'
