"""Autenticación de los equipos de las tiendas (no de personas)."""
import hmac

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

from .models import Tienda


class EquipoTienda:
    """Lo que queda en request.user cuando llama una tienda."""
    is_authenticated = True
    is_anonymous = False

    def __init__(self, tienda: Tienda, licencia):
        self.tienda = tienda
        self.licencia = licencia
        self.pk = None

    def __str__(self):
        return f'equipo de {self.tienda}'


class AutenticacionEquipo(BaseAuthentication):
    """
    Cabeceras que manda CajaFácil:
      X-CajaFacil-Licencia: licencia_id
      X-CajaFacil-Equipo:   código del PC (debe coincidir con la licencia)
      X-CajaFacil-Token:    sha256 de la firma de la licencia (prueba de que tiene el archivo)
    """
    requiere_token = True

    def authenticate(self, request):
        lic_id = request.headers.get('X-CajaFacil-Licencia', '').strip()
        if not lic_id:
            return None
        equipo = request.headers.get('X-CajaFacil-Equipo', '').strip()
        token = request.headers.get('X-CajaFacil-Token', '').strip()
        tienda = Tienda.objects.filter(licencia_id=lic_id).first()
        if tienda is None:
            raise AuthenticationFailed('Esta licencia no está registrada en CajaFácil Nube. Contacta a NautilusTech.')
        if not tienda.activa:
            raise AuthenticationFailed('Esta tienda está suspendida en CajaFácil Nube.')
        licencia = None
        for lic in tienda.licencias.all():
            if token and hmac.compare_digest(lic.token, token):
                licencia = lic
                break
        if licencia is None:
            if self.requiere_token:
                raise AuthenticationFailed('La licencia de este equipo no coincide con la registrada en la nube.')
            # Solo para descargar la licencia nueva (p. ej. al pasar de plan Básico a Nube): basta con el
            # código del equipo, porque la licencia que se entrega solo sirve en ese mismo computador.
            if equipo != tienda.equipo_id:
                raise AuthenticationFailed('Este computador no es el de la licencia.')
        elif licencia.datos.get('equipo_id') not in ('*', equipo):
            raise AuthenticationFailed('Este computador no es el de la licencia.')
        Tienda.objects.filter(pk=tienda.pk).update(
            ultima_conexion=timezone.now(),
            version_app=(request.headers.get('User-Agent', '').split('/')[-1][:20]
                         if request.headers.get('User-Agent', '').startswith('CajaFacil/') else tienda.version_app))
        return EquipoTienda(tienda, licencia), None

    def authenticate_header(self, request):
        return 'CajaFacil'


class AutenticacionEquipoSinToken(AutenticacionEquipo):
    requiere_token = False


class EsEquipo(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, EquipoTienda)
