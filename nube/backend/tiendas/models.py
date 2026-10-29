import calendar
from datetime import date, timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from . import licencias


def sumar_meses(desde: date, meses: int) -> date:
    m = desde.month - 1 + meses
    anio, mes = desde.year + m // 12, m % 12 + 1
    return date(anio, mes, min(desde.day, calendar.monthrange(anio, mes)[1]))


class Tienda(models.Model):
    """Un cliente de CajaFácil con plan Nube."""
    nombre = models.CharField(max_length=120)
    nit = models.CharField('NIT / cédula', max_length=30, blank=True)
    telefono = models.CharField('WhatsApp del dueño', max_length=30, blank=True)
    ciudad = models.CharField(max_length=60, blank=True, default='Medellín')
    licencia_id = models.CharField(max_length=40, unique=True)
    equipo_id = models.CharField('Código del equipo', max_length=30)
    instalacion_id = models.CharField(max_length=40, blank=True)

    pagado_hasta = models.DateField('Nube pagada hasta', null=True, blank=True,
                                    help_text='Después de esta fecha (más los días de gracia) la nube deja de recibir datos '
                                              'y el panel pide renovar. La caja de la tienda sigue funcionando igual.')
    activa = models.BooleanField(default=True, help_text='Desmarcar para suspender la tienda por completo.')
    notas = models.TextField(blank=True)
    vendedor = models.CharField(max_length=80, blank=True, help_text='Quién hizo la venta (para comisiones).')

    creada = models.DateTimeField(auto_now_add=True)
    ultima_conexion = models.DateTimeField(null=True, blank=True)
    ultima_sincronizacion = models.DateTimeField(null=True, blank=True)
    ultimo_respaldo = models.DateTimeField(null=True, blank=True)
    version_app = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    @property
    def suscripcion_vigente(self) -> bool:
        if not self.activa or not self.pagado_hasta:
            return False
        return timezone.localdate() <= self.pagado_hasta + timedelta(days=settings.DIAS_GRACIA)

    @property
    def en_gracia(self) -> bool:
        return self.suscripcion_vigente and timezone.localdate() > self.pagado_hasta

    @property
    def dias_restantes(self):
        if not self.pagado_hasta:
            return None
        return (self.pagado_hasta - timezone.localdate()).days

    def extender(self, meses: int):
        """Suma meses desde la fecha pagada (o desde hoy si ya estaba vencida)."""
        hoy = timezone.localdate()
        base = self.pagado_hasta if self.pagado_hasta and self.pagado_hasta >= hoy else hoy
        self.pagado_hasta = sumar_meses(base, meses)
        self.save(update_fields=['pagado_hasta'])

    def licencia_vigente(self):
        return self.licencias.order_by('-creada', '-id').first()


class Licencia(models.Model):
    """Licencias firmadas que NautilusTech carga para la tienda (la más reciente se entrega al renovar)."""
    tienda = models.ForeignKey(Tienda, on_delete=models.CASCADE, related_name='licencias')
    texto = models.TextField(help_text='El texto en base64 que entrega generar_licencia.py')
    datos = models.JSONField()
    firma = models.TextField()
    token = models.CharField(max_length=64, db_index=True)
    creada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creada']

    def __str__(self):
        d = self.datos
        return f"{d.get('licencia_id')} · {d.get('plan')} · emitida {d.get('emitida')}"

    @classmethod
    def desde_texto(cls, texto: str, tienda: Tienda | None = None) -> 'Licencia':
        """Verifica la firma y la guarda. Si no se da tienda, la crea o la encuentra por licencia_id."""
        lic = licencias.decodificar(texto)
        d = lic['datos']
        if tienda is None:
            tienda = Tienda.objects.filter(licencia_id=d['licencia_id']).first()
            if tienda is None:
                tienda = Tienda.objects.create(nombre=d.get('cliente') or d['licencia_id'], nit=d.get('nit') or '',
                                               licencia_id=d['licencia_id'], equipo_id=d['equipo_id'])
        elif tienda.licencia_id != d['licencia_id']:
            raise ValueError(f"Esta licencia es de {d['licencia_id']}, no de {tienda.licencia_id}.")
        if tienda.equipo_id != d['equipo_id']:
            tienda.equipo_id = d['equipo_id']  # cambio de computador: la licencia nueva manda
            tienda.save(update_fields=['equipo_id'])
        existente = tienda.licencias.filter(firma=lic['firma']).first()
        if existente:
            return existente
        return cls.objects.create(tienda=tienda, texto=texto.strip(), datos=d, firma=lic['firma'],
                                  token=licencias.token(lic['firma']))

    def como_json(self):
        return {'datos': self.datos, 'firma': self.firma}


class Acceso(models.Model):
    """Qué usuarios del panel pueden ver qué tienda (un dueño puede tener varias)."""
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='accesos')
    tienda = models.ForeignKey(Tienda, on_delete=models.CASCADE, related_name='accesos')
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('usuario', 'tienda')]
        verbose_name_plural = 'accesos'

    def __str__(self):
        return f'{self.usuario} → {self.tienda}'


class Pago(models.Model):
    """Registro de lo que paga cada tienda por la nube (para cuadrar cuentas y comisiones)."""
    tienda = models.ForeignKey(Tienda, on_delete=models.CASCADE, related_name='pagos')
    fecha = models.DateField(default=timezone.localdate)
    meses = models.PositiveIntegerField(default=1)
    valor = models.PositiveIntegerField(default=0, help_text='En pesos. 0 = meses gratis de promoción.')
    concepto = models.CharField(max_length=120, blank=True)
    pagado_hasta_antes = models.DateField(null=True, blank=True, editable=False)
    pagado_hasta_despues = models.DateField(null=True, blank=True, editable=False)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha', '-id']

    def __str__(self):
        return f'{self.tienda} · {self.meses} mes(es) · ${self.valor:,}'

    def save(self, *args, **kwargs):
        nuevo = self._state.adding
        if nuevo:
            self.pagado_hasta_antes = self.tienda.pagado_hasta
            self.tienda.extender(self.meses)
            self.pagado_hasta_despues = self.tienda.pagado_hasta
        super().save(*args, **kwargs)
