"""
Dar de alta (o actualizar) una tienda desde la terminal del servidor.

  python manage.py alta_tienda --licencia "<texto de generar_licencia.py>" \
      --usuario elgordo --clave "clave-del-dueño" --meses-gratis 3 --telefono 3001234567
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from tiendas.models import Acceso, Licencia, Pago


class Command(BaseCommand):
    help = 'Registra la licencia de una tienda en la nube y le crea el usuario del dueño.'

    def add_arguments(self, p):
        p.add_argument('--licencia', required=True)
        p.add_argument('--usuario')
        p.add_argument('--clave')
        p.add_argument('--nombre-dueno', default='')
        p.add_argument('--telefono', default='')
        p.add_argument('--vendedor', default='')
        p.add_argument('--meses-gratis', type=int, default=0)

    @transaction.atomic
    def handle(self, *a, **o):
        try:
            lic = Licencia.desde_texto(o['licencia'])
        except ValueError as e:
            raise CommandError(str(e))
        t = lic.tienda
        if o['telefono']:
            t.telefono = o['telefono']
        if o['vendedor']:
            t.vendedor = o['vendedor']
        t.save()
        if o['meses_gratis']:
            Pago.objects.create(tienda=t, meses=o['meses_gratis'], valor=0,
                                concepto=f"{o['meses_gratis']} meses gratis de bienvenida")
        if o['usuario']:
            User = get_user_model()
            u, creado = User.objects.get_or_create(username=o['usuario'])
            if creado and not o['clave']:
                raise CommandError('Para un usuario nuevo da --clave.')
            if o['clave']:
                if len(o['clave']) < 6:
                    raise CommandError('La clave debe tener mínimo 6 caracteres.')
                u.set_password(o['clave'])
            if o['nombre_dueno']:
                u.first_name = o['nombre_dueno']
            u.save()
            Acceso.objects.get_or_create(usuario=u, tienda=t)
        t.refresh_from_db()
        self.stdout.write(self.style.SUCCESS(
            f'Tienda «{t.nombre}» ({t.licencia_id}) lista. Nube pagada hasta: {t.pagado_hasta or "sin pagar"}.'))
