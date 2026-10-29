from rest_framework.permissions import SAFE_METHODS, BasePermission

from . import licencia

ADMIN = 'ADMIN'
COORDINADOR = 'COORDINADOR'
CAJERO = 'CAJERO'
ALMACENISTA = 'ALMACENISTA'

GESTION = (ADMIN, COORDINADOR)


def rol_de(user):
    if getattr(user, 'is_superuser', False):
        return ADMIN
    return getattr(user, 'rol', None)


def tiene_rol(user, *roles):
    return bool(user and user.is_authenticated and rol_de(user) in roles)


def Roles(*roles, lectura_libre=False):
    """Fábrica de permisos: Roles(ADMIN, COORDINADOR). Con lectura_libre=True, GET está permitido a todos."""

    class _Permiso(BasePermission):
        message = 'No tienes permiso para realizar esta acción.'

        def has_permission(self, request, view):
            if not (request.user and request.user.is_authenticated):
                return False
            if lectura_libre and request.method in SAFE_METHODS:
                return True
            return rol_de(request.user) in roles

    _Permiso.__name__ = 'Roles_' + '_'.join(roles)
    return _Permiso


class LicenciaPermiteOperar(BasePermission):
    """Bloquea operaciones de escritura si la licencia/prueba está vencida (modo solo lectura)."""
    message = 'La licencia no está activa. El sistema está en modo solo lectura.'

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return licencia.estado_actual().puede_vender
