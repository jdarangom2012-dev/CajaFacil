from datetime import date

from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auditoria.services import registrar
from core.errores import ErrorNegocio
from core.permisos import ADMIN, GESTION, Roles

from . import proveedores, services
from .models import ConfigFacturacion, DocumentoElectronico

CAMPOS_TEXTO = ('proveedor', 'api_url', 'api_usuario', 'resolucion_numero', 'prefijo', 'clave_tecnica')
CAMPOS_ENTEROS = ('rango_desde', 'rango_hasta', 'aviso_numeros', 'aviso_dias')
CAMPOS_FECHA = ('fecha_desde', 'fecha_hasta')


def _doc_dict(d: DocumentoElectronico, detalle=False):
    r = {
        'id': d.id, 'tipo': d.tipo, 'tipo_display': d.get_tipo_display(), 'numero': d.numero_completo,
        'venta_id': d.venta_id, 'venta_numero': d.venta.numero, 'total': d.venta.total, 'creado': d.creado,
        'estado': d.estado, 'estado_display': d.get_estado_display(), 'ambiente': d.ambiente,
        'cude': d.cude, 'intentos': d.intentos, 'ultimo_error': d.ultimo_error, 'enviado_en': d.enviado_en,
        'adquirente': d.adquirente_nombre, 'adquirente_documento': f'{d.adquirente_tipo_doc} {d.adquirente_numero}',
    }
    if detalle:
        r['qr'] = d.qr
        r['documento'] = services.armar_documento(d)
        r['respuesta'] = d.respuesta
    return r


def _config_dict(c: ConfigFacturacion):
    return {
        'activa': c.activa, 'proveedor': c.proveedor, 'ambiente': c.ambiente,
        'api_url': c.api_url, 'api_usuario': c.api_usuario,
        'tiene_clave': bool(c.api_clave), 'tiene_token': bool(c.api_token),
        'resolucion_numero': c.resolucion_numero, 'prefijo': c.prefijo,
        'rango_desde': c.rango_desde, 'rango_hasta': c.rango_hasta,
        'fecha_desde': c.fecha_desde, 'fecha_hasta': c.fecha_hasta, 'clave_tecnica': c.clave_tecnica,
        'proximo_numero': c.proximo, 'restantes': c.restantes,
        'aviso_numeros': c.aviso_numeros, 'aviso_dias': c.aviso_dias,
        'proveedores': proveedores.opciones(),
        'problemas': services.problemas_configuracion(c) if c.activa or c.resolucion_numero else [],
    }


class EstadoView(APIView):
    """Lo mínimo que necesita la app para saber si muestra el módulo y los avisos."""
    permission_classes = [AllowAny]

    def get(self, request):
        c = ConfigFacturacion.obtener()
        est = services._lic()
        base = {'disponible': est.fe_disponible, 'licenciada': est.fe_licenciada,
                'activa': services.activa(c), 'ambiente': c.ambiente}
        if not request.user.is_authenticated:
            return Response({**base, 'alertas': []})
        return Response({
            **base,
            'alertas': services.alertas(c),
            'pendientes': DocumentoElectronico.objects.filter(estado='PENDIENTE').count(),
            'rechazados': DocumentoElectronico.objects.filter(estado='RECHAZADO').count(),
            'restantes': c.restantes,
        })


class ConfiguracionView(APIView):
    permission_classes = [IsAuthenticated, Roles(ADMIN)]

    def get(self, request):
        if not services.disponible():
            raise ErrorNegocio('Tu licencia no incluye facturación electrónica.', 403)
        return Response(_config_dict(ConfigFacturacion.obtener()))

    @transaction.atomic
    def put(self, request):
        if not services.disponible():
            raise ErrorNegocio('Tu licencia no incluye facturación electrónica.', 403)
        c = ConfigFacturacion.objects.select_for_update().get_or_create(pk=1)[0]
        antes = _config_dict(c)
        d = request.data
        for k in CAMPOS_TEXTO:
            if k in d:
                setattr(c, k, (d.get(k) or '').strip())
        c.prefijo = c.prefijo.upper()
        for k in CAMPOS_ENTEROS:
            if k in d:
                v = d.get(k)
                try:
                    setattr(c, k, int(v) if v not in (None, '') else None)
                except (TypeError, ValueError):
                    raise ErrorNegocio('Revisa los números: deben ser enteros.')
        c.aviso_numeros = c.aviso_numeros or 0
        c.aviso_dias = c.aviso_dias or 0
        for k in CAMPOS_FECHA:
            if k in d:
                v = d.get(k)
                try:
                    setattr(c, k, date.fromisoformat(v) if v else None)
                except ValueError:
                    raise ErrorNegocio('Revisa las fechas de la resolución.')
        # Las claves solo se cambian si se escriben (la pantalla nunca las muestra)
        for k in ('api_clave', 'api_token'):
            if d.get(k):
                setattr(c, k, d[k].strip())
        if 'ambiente' in d:
            if d['ambiente'] not in ('PRUEBAS', 'PRODUCCION'):
                raise ErrorNegocio('Ambiente inválido.')
            if d['ambiente'] == 'PRODUCCION' and not services._lic().fe_licenciada:
                raise ErrorNegocio('Para facturar en producción la licencia debe incluir facturación electrónica.')
            c.ambiente = d['ambiente']
        if 'activa' in d:
            c.activa = bool(d['activa'])
        if c.proveedor and c.proveedor not in proveedores.PROVEEDORES:
            raise ErrorNegocio('Proveedor no disponible en esta versión.')
        if c.activa:
            problemas = services.problemas_configuracion(c)
            if problemas:
                raise ErrorNegocio('No se puede activar todavía: ' + problemas[0])
        # Siguiente número: nunca repetir uno ya usado con el mismo prefijo y ambiente
        usado = (DocumentoElectronico.objects.filter(tipo='POS', prefijo=c.prefijo, ambiente=c.ambiente)
                 .aggregate(m=Max('numero'))['m'])
        if c.rango_desde:
            c.siguiente_numero = max(c.rango_desde, (usado or 0) + 1)
        c.save()
        despues = _config_dict(c)
        cambios = {k: despues[k] for k in ('activa', 'ambiente', 'proveedor', 'resolucion_numero', 'prefijo',
                                           'rango_desde', 'rango_hasta', 'fecha_hasta') if antes[k] != despues[k]}
        if cambios:
            registrar(request.user, 'CONFIG', 'facturacion', 1, valor_anterior={k: antes[k] for k in cambios},
                      valor_nuevo=cambios, detalle='Cambio en la configuración de facturación electrónica',
                      request=request)
        return Response(despues)


class ProbarView(APIView):
    permission_classes = [IsAuthenticated, Roles(ADMIN)]

    def post(self, request):
        c = ConfigFacturacion.obtener()
        try:
            msg = proveedores.obtener(c.proveedor, c).probar()
        except Exception as e:
            raise ErrorNegocio(f'No se pudo conectar con el proveedor: {e}')
        return Response({'mensaje': msg})


class DocumentosView(APIView):
    permission_classes = [IsAuthenticated, Roles(*GESTION)]

    def get(self, request):
        qs = DocumentoElectronico.objects.select_related('venta')
        estado = request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)
        return Response([_doc_dict(d) for d in qs[:200]])


class DocumentoView(APIView):
    permission_classes = [IsAuthenticated, Roles(*GESTION)]

    def get(self, request, pk):
        d = get_object_or_404(DocumentoElectronico.objects.select_related('venta'), pk=pk)
        return Response(_doc_dict(d, detalle=True))


class ReintentarView(APIView):
    permission_classes = [IsAuthenticated, Roles(*GESTION)]

    def post(self, request, pk):
        d = get_object_or_404(DocumentoElectronico.objects.select_related('venta'), pk=pk)
        return Response(_doc_dict(services.reintentar(d)))


class EnviarPendientesView(APIView):
    permission_classes = [IsAuthenticated, Roles(*GESTION)]

    def post(self, request):
        return Response(services.enviar_pendientes())
