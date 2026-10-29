"""
Punto de entrada del ejecutable de CajaFacil (PyInstaller lo empaqueta como cajafacil.exe).

  cajafacil.exe servidor   -> migra la base y sirve la app en http://HOST:PUERTO (servicio CajaFacil-App)
  cajafacil.exe worker     -> respaldos automáticos y sincronización (servicio CajaFacil-Worker)
  cajafacil.exe importar   -> importa los datos de PosTienda/PosFácil (lo usa scripts/migrar-postienda.ps1)
  cajafacil.exe respaldar  -> crea un respaldo manual
  cajafacil.exe manage ... -> cualquier comando de Django (migrate, createsuperuser...)
"""
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cajafacil.settings')


def _django():
    import django
    django.setup()


def servidor():
    _django()
    import logging

    from django.conf import settings
    from django.core.management import call_command
    from waitress import serve

    log = logging.getLogger('cajafacil.servidor')
    call_command('migrate', interactive=False, verbosity=0)
    call_command('collectstatic', interactive=False, verbosity=0)
    from django.core.wsgi import get_wsgi_application
    app = get_wsgi_application()
    host = settings.CFG['servidor']['host']
    puerto = int(settings.CFG['servidor']['puerto'])
    log.info('CajaFacil %s escuchando en http://%s:%s', settings.VERSION, host, puerto)
    serve(app, host=host, port=puerto, threads=8, ident='CajaFacil')


def main():
    args = sys.argv[1:] or ['servidor']
    cmd = args[0]
    if cmd == 'servidor':
        servidor()
    elif cmd == 'worker':
        # Se pasa la instancia del comando (no el nombre) para no depender de que Django
        # descubra los comandos en disco: dentro del ejecutable empaquetado no hay carpeta.
        _django()
        from django.core.management import call_command
        from core.management.commands.worker import Command
        call_command(Command(), *args[1:])
    elif cmd == 'importar':
        _django()
        from django.core.management import call_command
        from core.management.commands.importar_postienda import Command
        call_command(Command(), *args[1:])
    elif cmd == 'respaldar':
        _django()
        from django.core.management import call_command
        from core.management.commands.respaldar import Command
        call_command(Command(), *args[1:])
    elif cmd == 'manage':
        from django.core.management import execute_from_command_line
        execute_from_command_line(['cajafacil'] + args[1:])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
