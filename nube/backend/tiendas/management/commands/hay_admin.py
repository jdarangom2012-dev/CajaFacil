"""Sale con código 0 si ya existe un superusuario, 1 si no (lo usa iniciar-nube-desarrollo.ps1)."""
import sys

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Indica (con el código de salida) si ya hay un usuario administrador.'

    def handle(self, *args, **opts):
        hay = get_user_model().objects.filter(is_superuser=True).exists()
        self.stdout.write('Usuario de NautilusTech: ' + ('ya existe' if hay else 'no existe'))
        sys.exit(0 if hay else 1)
