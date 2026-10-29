import logging
import socket
from pathlib import Path

from django.conf import settings
from django.db import connection, transaction
from django.http import FileResponse, Http404
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auditoria.services import registrar

from . import licencia, respaldo, sync
from .errores import ErrorNegocio
from .hardware import bascula, impresora, tickets
from .hardware.escpos import Ticket
from .models import Configuracion, EventoSync, Respaldo
from .permisos import ADMIN, GESTION, Roles
from .semilla import sembrar_datos_iniciales

log = logging.getLogger(__name__)


def version_mayor(a: str, b: str) -> bool:
    def t(v):
        try:
            return tuple(int(x) for x in (v or '').split('.'))
        except ValueError:
            return ()
    return bool(a) and t(a) > t(b)


def ip_local() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return '127.0.0.1'


class ConfiguracionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Configuracion
        exclude = ('id',)
        read_only_fields = ('instalacion_id', 'fecha_instalacion', 'configurado', 'ultimo_respaldo',
                            'ultima_sincronizacion', 'ultima_fecha_vista', 'version_disponible', 'url_descarga')


def _negocio_publico(conf):
    return {
        'nombre_negocio': conf.nombre_negocio, 'nit': conf.nit, 'direccion': conf.direccion,
        'ciudad': conf.ciudad, 'telefono': conf.telefono, 'regimen': conf.regimen,
        'mensaje_ticket': conf.mensaje_ticket,
    }


class EstadoSistemaView(APIView):
    """Endpoint público: lo consulta el frontend al arrancar."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            conf = Configuracion.obtener()
            db_ok = True
        except Exception as e:
            log.error('Base de datos no disponible: %s', e)
            return Response({'db': False, 'error': 'No hay conexión con la base de datos.'}, status=503)
        return Response({
            'db': db_ok,
            'version': settings.VERSION,
            'configurado': conf.configurado,
            'negocio': _negocio_publico(conf),
            'licencia': licencia.estado_actual().a_dict(),
            'terminal': request.terminal,
            'modo': settings.MODO_SERVIDOR,
            'actualizacion': ({'version': conf.version_disponible, 'url': conf.url_descarga}
                              if version_mayor(conf.version_disponible, settings.VERSION) else None),
        })


class ConfiguracionInicialSerializer(serializers.Serializer):
    nombre_negocio = serializers.CharField(max_length=120)
    nit = serializers.CharField(max_length=30, required=False, allow_blank=True)
    telefono = serializers.CharField(max_length=30, required=False, allow_blank=True)
    direccion = serializers.CharField(max_length=200, required=False, allow_blank=True)
    ciudad = serializers.CharField(max_length=80, required=False, allow_blank=True)
    admin_nombre = serializers.CharField(max_length=120)
    admin_usuario = serializers.CharField(max_length=40)
    admin_password = serializers.CharField(min_length=4, max_length=128)
    datos_ejemplo = serializers.BooleanField(required=False, default=False)


class ConfiguracionInicialView(APIView):
    """Asistente de primer arranque: datos del negocio + usuario administrador."""
    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def post(self, request):
        from usuarios.models import Usuario
        from usuarios.views import datos_sesion
        conf = Configuracion.objects.select_for_update().get_or_create(pk=1)[0]
        if conf.configurado:
            return Response({'error': 'El sistema ya fue configurado.'}, status=400)
        s = ConfiguracionInicialSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        username = d['admin_usuario'].strip().lower()
        if Usuario.objects.filter(username=username).exists():
            return Response({'error': 'Ese usuario ya existe.'}, status=400)
        for campo in ('nombre_negocio', 'nit', 'telefono', 'direccion', 'ciudad'):
            if d.get(campo) is not None:
                setattr(conf, campo, d[campo].strip())
        conf.configurado = True
        conf.save()
        admin = Usuario(username=username, nombre_completo=d['admin_nombre'].strip(), rol='ADMIN', is_staff=True)
        admin.set_password(d['admin_password'])
        admin.save()
        sembrar_datos_iniciales(admin, ejemplo=d.get('datos_ejemplo', False))
        registrar(admin, 'CONFIG', 'configuracion', detalle=f'Configuración inicial: {conf.nombre_negocio}',
                  request=request)
        return Response(datos_sesion(admin), status=201)


class ConfiguracionView(APIView):
    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method == 'GET' else [IsAuthenticated(), Roles(ADMIN)()]

    def get(self, request):
        return Response(ConfiguracionSerializer(Configuracion.obtener()).data)

    def patch(self, request):
        conf = Configuracion.obtener()
        s = ConfiguracionSerializer(conf, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        registrar(request.user, 'CONFIG', 'configuracion', detalle='Configuración actualizada: ' +
                  ', '.join(sorted(request.data.keys()))[:250], request=request)
        return Response(s.data)


class LicenciaView(APIView):
    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method == 'GET' else [IsAuthenticated(), Roles(ADMIN)()]

    def get(self, request):
        return Response(licencia.estado_actual().a_dict())

    def post(self, request):
        try:
            est = licencia.instalar(request.data.get('licencia', ''))
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        registrar(request.user, 'LICENCIA', 'licencia', est.licencia_id,
                  detalle=f'Licencia activada: plan {est.plan} ({est.cliente})', request=request)
        return Response(est.a_dict())


# ── Hardware ─────────────────────────────────────────────────────────

def imprimir_bytes(datos: bytes, conf=None) -> dict:
    conf = conf or Configuracion.obtener()
    if conf.impresora_tipo in ('NAVEGADOR', 'NINGUNA'):
        return {'ok': False, 'modo': conf.impresora_tipo, 'error': ''}
    try:
        impresora.enviar(conf.impresora_tipo, conf.impresora_destino, datos)
        return {'ok': True, 'modo': conf.impresora_tipo}
    except impresora.ErrorImpresora as e:
        log.warning('Error de impresión: %s', e)
        return {'ok': False, 'modo': conf.impresora_tipo, 'error': str(e)}


class HardwareInfoView(APIView):
    def get(self, request):
        return Response({'impresoras': impresora.listar_impresoras(), 'puertos': impresora.listar_puertos()})


class ImprimirVentaView(APIView):
    def post(self, request, pk):
        from ventas.models import Venta
        try:
            venta = Venta.objects.select_related('usuario', 'cliente').prefetch_related(
                'detalle', 'pagos__forma_pago').get(pk=pk)
        except Venta.DoesNotExist:
            raise Http404
        conf = Configuracion.obtener()
        abrir = bool(request.data.get('abrir_cajon')) and conf.abrir_cajon_efectivo
        res = imprimir_bytes(tickets.ticket_venta(venta, conf, abrir_cajon=abrir,
                                                  copia=bool(request.data.get('copia'))), conf)
        return Response(res)


class ImprimirCierreView(APIView):
    def post(self, request, pk):
        from ventas.models import Caja
        try:
            caja = Caja.objects.select_related('usuario_apertura', 'usuario_cierre').get(pk=pk)
        except Caja.DoesNotExist:
            raise Http404
        return Response(imprimir_bytes(tickets.ticket_cierre(caja, Configuracion.obtener())))


class AbrirCajonView(APIView):
    def post(self, request):
        conf = Configuracion.obtener()
        t = Ticket(conf.impresora_ancho)
        t.buf = bytearray()
        t.abrir_cajon()
        res = imprimir_bytes(t.bytes(), conf)
        registrar(request.user, 'CAJON', 'hardware', detalle=f'Apertura manual del cajón ({request.terminal})',
                  request=request)
        return Response(res)


class ProbarImpresoraView(APIView):
    permission_classes = [IsAuthenticated, Roles(*GESTION)]

    def post(self, request):
        conf = Configuracion.obtener()
        t = Ticket(conf.impresora_ancho)
        t.alinear('centro').negrita().grande().linea('CajaFacil').grande(False).negrita(False)
        t.linea('Prueba de impresión').linea('Tildes: áéíóú ñ Ñ ¿?¡!').separador()
        t.dos_columnas('Ancho configurado', f'{conf.impresora_ancho} mm')
        t.dos_columnas('Columnas', str(t.cols))
        t.linea('').linea('Si lees esto, la impresora está lista.')
        if request.data.get('cajon'):
            t.abrir_cajon()
        return Response(imprimir_bytes(t.cortar().bytes(), conf))


class LeerBasculaView(APIView):
    def get(self, request):
        conf = Configuracion.obtener()
        if not conf.bascula_activa:
            return Response({'error': 'La báscula no está activada en Configuración.'}, status=400)
        try:
            peso = bascula.leer_peso(conf.bascula_puerto, conf.bascula_baudios, conf.bascula_comando)
        except bascula.ErrorBascula as e:
            return Response({'error': str(e)}, status=400)
        return Response({'peso_kg': peso})


# ── Respaldos ────────────────────────────────────────────────────────

class RespaldoSerializer(serializers.ModelSerializer):
    nombre = serializers.SerializerMethodField()
    existe = serializers.SerializerMethodField()

    class Meta:
        model = Respaldo
        fields = ('id', 'nombre', 'archivo', 'tamano', 'origen', 'creado', 'subido_nube', 'error', 'existe')

    def get_nombre(self, o):
        return Path(o.archivo).name

    def get_existe(self, o):
        return Path(o.archivo).exists()


class RespaldosView(APIView):
    permission_classes = [IsAuthenticated, Roles(ADMIN)]

    def get(self, request):
        conf = Configuracion.obtener()
        return Response({
            'carpeta': str(settings.RESPALDOS_DIR),
            'carpeta_extra': conf.respaldo_carpeta_extra,
            'ultimo': conf.ultimo_respaldo,
            'respaldos': RespaldoSerializer(Respaldo.objects.all()[:60], many=True).data,
        })

    def post(self, request):
        try:
            r = respaldo.crear('MANUAL')
        except respaldo.ErrorRespaldo as e:
            return Response({'error': str(e)}, status=500)
        registrar(request.user, 'RESPALDO', 'respaldos', r.id, detalle=f'Respaldo manual: {Path(r.archivo).name}',
                  request=request)
        if licencia.estado_actual().nube_activa:
            sync.subir_respaldo(r)
        return Response(RespaldoSerializer(r).data, status=201)


class DescargarRespaldoView(APIView):
    permission_classes = [IsAuthenticated, Roles(ADMIN)]

    def get(self, request, pk):
        try:
            r = Respaldo.objects.get(pk=pk)
        except Respaldo.DoesNotExist:
            raise Http404
        ruta = Path(r.archivo)
        if not ruta.exists():
            raise Http404
        return FileResponse(open(ruta, 'rb'), as_attachment=True, filename=ruta.name)


# ── Nube ─────────────────────────────────────────────────────────────

class NubeView(APIView):
    permission_classes = [IsAuthenticated, Roles(*GESTION)]

    def get(self, request):
        est = licencia.estado_actual()
        conf = Configuracion.obtener()
        return Response({
            'licencia': est.a_dict(),
            'url': settings.NUBE_URL,
            'pendientes': EventoSync.objects.filter(enviado__isnull=True).count(),
            'enviados': EventoSync.objects.filter(enviado__isnull=False).count(),
            'ultima_sincronizacion': conf.ultima_sincronizacion,
            'pagado_hasta': conf.nube_pagado_hasta,
            'panel': settings.NUBE_URL,
            'ultimo_error': EventoSync.objects.filter(enviado__isnull=True).exclude(ultimo_error='')
                            .values_list('ultimo_error', flat=True).first() or '',
        })

    def post(self, request):
        if not licencia.estado_actual().nube_activa:
            raise ErrorNegocio('El plan nube no está activo en esta licencia.')
        return Response(sync.enviar_pendientes())


class InfoView(APIView):
    def get(self, request):
        db = settings.DATABASES['default']
        version_pg = ''
        try:
            with connection.cursor() as c:
                c.execute('SHOW server_version')
                version_pg = c.fetchone()[0]
        except Exception:
            pass
        return Response({
            'version': settings.VERSION,
            'equipo_id': licencia.equipo_id(),
            'terminal': request.terminal,
            'ip_local': ip_local(),
            'puerto': settings.CFG['servidor']['puerto'],
            'modo': settings.MODO_SERVIDOR,
            'base_datos': f'PostgreSQL {version_pg} ({db["HOST"]}:{db["PORT"]})',
            'carpeta_datos': str(settings.CAJAFACIL_HOME),
        })
