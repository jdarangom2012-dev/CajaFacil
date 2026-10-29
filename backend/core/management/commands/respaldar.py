from django.core.management.base import BaseCommand, CommandError

from core import respaldo


class Command(BaseCommand):
    help = 'Crea un respaldo de la base de datos, o restaura uno con --restaurar ARCHIVO.'

    def add_arguments(self, parser):
        parser.add_argument('--restaurar', metavar='ARCHIVO')

    def handle(self, *args, **opts):
        try:
            if opts['restaurar']:
                respaldo.restaurar(opts['restaurar'])
                self.stdout.write(self.style.SUCCESS('Respaldo restaurado.'))
            else:
                r = respaldo.crear('MANUAL')
                self.stdout.write(self.style.SUCCESS(f'Respaldo creado: {r.archivo}'))
        except respaldo.ErrorRespaldo as e:
            raise CommandError(str(e))
