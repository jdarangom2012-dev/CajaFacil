import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    ROL_CHOICES = [
        ('ADMIN', 'Administrador (dueño)'),
        ('COORDINADOR', 'Coordinador'),
        ('CAJERO', 'Cajero'),
        ('ALMACENISTA', 'Almacenista'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre_completo = models.CharField(max_length=120, blank=True)
    rol = models.CharField(max_length=20, choices=ROL_CHOICES, default='CAJERO')
    telefono = models.CharField(max_length=30, blank=True)

    class Meta:
        verbose_name = 'Usuario'
        ordering = ['nombre_completo', 'username']

    def __str__(self):
        return self.nombre_completo or self.username

    @property
    def nombre(self):
        return self.nombre_completo or self.username
