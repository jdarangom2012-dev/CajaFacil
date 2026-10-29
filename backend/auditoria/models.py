import uuid

from django.db import models


class Auditoria(models.Model):
    """
    Registro inmutable de acciones críticas. Solo se permite insertar.
    Es la base del "antirrobo hormiga": anulaciones, cambios de precio,
    ajustes de inventario, descuadres de caja y descuentos quedan registrados.
    """
    ACCION_CHOICES = [
        ('INSERT', 'Creación'),
        ('UPDATE', 'Modificación'),
        ('DELETE', 'Eliminación / desactivación'),
        ('LOGIN', 'Inicio de sesión'),
        ('LOGIN_FALLIDO', 'Intento de inicio fallido'),
        ('LOGOUT', 'Cierre de sesión'),
        ('CANCEL', 'Anulación de venta'),
        ('AJUSTE', 'Ajuste de inventario'),
        ('PRECIO', 'Cambio de precio'),
        ('DESCUENTO', 'Descuento en venta'),
        ('CAJA', 'Apertura / cierre de caja'),
        ('DESCUADRE', 'Descuadre de caja'),
        ('CAJON', 'Apertura manual del cajón'),
        ('RESPALDO', 'Respaldo / restauración'),
        ('LICENCIA', 'Licencia'),
        ('CONFIG', 'Configuración'),
    ]
    ALERTAS = ('CANCEL', 'PRECIO', 'AJUSTE', 'DESCUADRE', 'CAJON', 'LOGIN_FALLIDO', 'DESCUENTO')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)
    usuario_id_ref = models.CharField(max_length=40, blank=True)
    usuario_nombre = models.CharField(max_length=150)
    accion = models.CharField(max_length=20, choices=ACCION_CHOICES, db_index=True)
    tabla_afectada = models.CharField(max_length=50, blank=True)
    registro_id = models.CharField(max_length=40, blank=True)
    valor_anterior = models.JSONField(blank=True, null=True)
    valor_nuevo = models.JSONField(blank=True, null=True)
    terminal = models.CharField(max_length=30, blank=True)
    ip_dispositivo = models.GenericIPAddressField(blank=True, null=True)
    detalle = models.TextField(blank=True)

    class Meta:
        ordering = ['-fecha_hora']
        default_permissions = ('add', 'view')

    def __str__(self):
        return f'[{self.fecha_hora:%Y-%m-%d %H:%M}] {self.accion} {self.usuario_nombre}'

    @property
    def es_alerta(self):
        return self.accion in self.ALERTAS

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise PermissionError('Los registros de auditoría no pueden modificarse.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError('Los registros de auditoría no pueden eliminarse.')
