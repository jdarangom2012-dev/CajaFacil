from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from auditoria.services import registrar
from core.permisos import ADMIN, Roles

from .models import Usuario
from .serializers import CambiarPasswordSerializer, PerfilSerializer, UsuarioSerializer


class LoginThrottle(AnonRateThrottle):
    rate = '20/min'


def datos_sesion(usuario):
    refresh = RefreshToken.for_user(usuario)
    refresh['rol'] = usuario.rol
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'usuario': PerfilSerializer(usuario).data,
    }


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginThrottle]

    def post(self, request):
        username = (request.data.get('username') or '').strip().lower()
        password = request.data.get('password') or ''
        usuario = authenticate(request, username=username, password=password)
        if not usuario:
            registrar(None, 'LOGIN_FALLIDO', 'usuarios', detalle=f'Intento fallido: {username}',
                      usuario_nombre=username or '?', request=request)
            return Response({'error': 'Usuario o contraseña incorrectos.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not usuario.is_active:
            return Response({'error': 'Este usuario está inactivo.'}, status=status.HTTP_403_FORBIDDEN)
        usuario.last_login = timezone.now()
        usuario.save(update_fields=['last_login'])
        registrar(usuario, 'LOGIN', 'usuarios', registro_id=usuario.id,
                  detalle=f'Inicio de sesión en {request.terminal}', request=request)
        return Response(datos_sesion(usuario))


class LogoutView(APIView):
    def post(self, request):
        registrar(request.user, 'LOGOUT', 'usuarios', registro_id=request.user.id,
                  detalle='Cierre de sesión', request=request)
        return Response({'ok': True})


class PerfilView(APIView):
    def get(self, request):
        return Response(PerfilSerializer(request.user).data)

    def patch(self, request):
        s = PerfilSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class CambiarPasswordView(APIView):
    def post(self, request):
        s = CambiarPasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if not request.user.check_password(s.validated_data['actual']):
            return Response({'error': 'La contraseña actual no es correcta.'}, status=400)
        request.user.set_password(s.validated_data['nueva'])
        request.user.save()
        registrar(request.user, 'UPDATE', 'usuarios', registro_id=request.user.id,
                  detalle='Cambio de contraseña propia', request=request)
        return Response({'ok': True})


class UsuarioViewSet(viewsets.ModelViewSet):
    serializer_class = UsuarioSerializer
    permission_classes = [IsAuthenticated, Roles(ADMIN)]
    pagination_class = None

    def get_queryset(self):
        return Usuario.objects.all()

    def perform_create(self, s):
        u = s.save()
        registrar(self.request.user, 'INSERT', 'usuarios', registro_id=u.id,
                  valor_nuevo={'username': u.username, 'rol': u.rol},
                  detalle=f'Usuario creado: {u.username} ({u.get_rol_display()})', request=self.request)

    def perform_update(self, s):
        antes = {'rol': s.instance.rol, 'activo': s.instance.is_active}
        u = s.save()
        registrar(self.request.user, 'UPDATE', 'usuarios', registro_id=u.id, valor_anterior=antes,
                  valor_nuevo={'rol': u.rol, 'activo': u.is_active},
                  detalle=f'Usuario modificado: {u.username}', request=self.request)

    def destroy(self, request, *args, **kwargs):
        u = self.get_object()
        if u == request.user:
            return Response({'error': 'No puedes desactivar tu propio usuario.'}, status=400)
        u.is_active = False
        u.save(update_fields=['is_active'])
        registrar(request.user, 'DELETE', 'usuarios', registro_id=u.id,
                  detalle=f'Usuario desactivado: {u.username}', request=request)
        return Response({'ok': True})

    @action(detail=True, methods=['post'], url_path='activar')
    def activar(self, request, pk=None):
        u = self.get_object()
        u.is_active = True
        u.save(update_fields=['is_active'])
        return Response(UsuarioSerializer(u).data)
