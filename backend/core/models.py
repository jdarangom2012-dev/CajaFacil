import uuid

from django.db import models, transaction


class ModeloBase(models.Model):
    """Todas las tablas de negocio usan UUID: permite sincronizar con la nube sin choques de IDs."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creado = models.DateTimeField(auto_now_add=True, db_index=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Configuracion(models.Model):
    """Configuración única de la instalación (fila id=1)."""

    IMPRESORA_CHOICES = [
        ('NAVEGADOR', 'Imprimir desde la ventana (diálogo de impresión)'),
        ('WINDOWS', 'Impresora instalada en Windows (ESC/POS directo)'),
        ('RED', 'Impresora de red (IP:9100)'),
        ('SERIAL', 'Puerto COM / serial'),
        ('NINGUNA', 'No imprimir'),
    ]
    ANCHO_CHOICES = [(58, '58 mm'), (80, '80 mm')]

    # Negocio
    nombre_negocio = models.CharField(max_length=120, default='Mi Tienda')
    nit = models.CharField('NIT / Cédula', max_length=30, blank=True)
    regimen = models.CharField(max_length=80, blank=True, default='No responsable de IVA')
    direccion = models.CharField(max_length=200, blank=True)
    ciudad = models.CharField(max_length=80, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    mensaje_ticket = models.CharField(max_length=200, blank=True, default='¡Gracias por su compra!')

    # Ventas
    vender_sin_stock = models.BooleanField(
        default=True, help_text='Permite vender aunque el sistema marque stock en cero (avisa en pantalla).')
    pedir_motivo_descuento = models.BooleanField(default=True)

    # Fiado
    tope_credito_defecto = models.DecimalField(max_digits=12, decimal_places=2, default=50000)
    dias_vencimiento_credito = models.PositiveIntegerField(default=30)

    # Impresora / cajón
    impresora_tipo = models.CharField(max_length=10, choices=IMPRESORA_CHOICES, default='NAVEGADOR')
    impresora_destino = models.CharField(
        max_length=120, blank=True,
        help_text='Nombre de la impresora en Windows, IP:puerto o COM3')
    impresora_ancho = models.PositiveSmallIntegerField(choices=ANCHO_CHOICES, default=80)
    imprimir_automatico = models.BooleanField(default=True)
    abrir_cajon_efectivo = models.BooleanField(default=True)

    # Báscula
    bascula_activa = models.BooleanField(default=False)
    bascula_puerto = models.CharField(max_length=30, blank=True, help_text='Ej: COM4')
    bascula_baudios = models.PositiveIntegerField(default=9600)
    bascula_comando = models.CharField(max_length=10, blank=True, default='P',
                                       help_text='Comando para pedir el peso (vacío = lectura continua)')

    # Respaldos
    respaldo_carpeta_extra = models.CharField(max_length=255, blank=True,
                                              help_text='Copia adicional (USB o disco externo)')
    respaldo_dias_conservar = models.PositiveIntegerField(default=15)
    ultimo_respaldo = models.DateTimeField(null=True, blank=True)

    # Nube
    ultima_sincronizacion = models.DateTimeField(null=True, blank=True)
    nube_inicial_enviada = models.BooleanField(default=False,
                                               help_text='Ya se subió lo que existía antes de activar la nube')
    nube_pagado_hasta = models.DateField(null=True, blank=True, help_text='Lo que informa la nube al sincronizar')

    # Instalación
    instalacion_id = models.UUIDField(default=uuid.uuid4, editable=False)
    fecha_instalacion = models.DateTimeField(auto_now_add=True)
    ultima_fecha_vista = models.DateTimeField(null=True, blank=True)
    version_disponible = models.CharField(max_length=20, blank=True)
    url_descarga = models.URLField(blank=True)
    configurado = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Configuración'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def obtener(cls) -> 'Configuracion':
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Consecutivo(models.Model):
    """Numeración consecutiva legible (ventas, créditos, etc.)."""
    nombre = models.CharField(max_length=30, primary_key=True)
    valor = models.PositiveBigIntegerField(default=0)

    @classmethod
    def siguiente(cls, nombre: str) -> int:
        with transaction.atomic():
            obj, _ = cls.objects.select_for_update().get_or_create(nombre=nombre)
            obj.valor += 1
            obj.save(update_fields=['valor'])
            return obj.valor


class EventoSync(models.Model):
    """
    Bandeja de salida (outbox) hacia la nube.
    Se escribe en la misma transacción que la operación de negocio,
    y el sincronizador la envía cuando hay internet y el plan nube está activo.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tipo = models.CharField(max_length=40, db_index=True)
    entidad_id = models.CharField(max_length=40, blank=True)
    payload = models.JSONField()
    creado = models.DateTimeField(auto_now_add=True, db_index=True)
    enviado = models.DateTimeField(null=True, blank=True, db_index=True)
    intentos = models.PositiveIntegerField(default=0)
    ultimo_error = models.TextField(blank=True)

    class Meta:
        ordering = ['creado']
        indexes = [models.Index(fields=['enviado', 'creado'])]


class Respaldo(models.Model):
    ORIGEN_CHOICES = [('AUTO', 'Automático'), ('CIERRE', 'Cierre de caja'), ('MANUAL', 'Manual')]
    archivo = models.CharField(max_length=255)
    tamano = models.PositiveBigIntegerField(default=0)
    origen = models.CharField(max_length=10, choices=ORIGEN_CHOICES, default='AUTO')
    creado = models.DateTimeField(auto_now_add=True)
    subido_nube = models.BooleanField(default=False)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ['-creado']
