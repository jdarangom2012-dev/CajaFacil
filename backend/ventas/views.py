from django.db.models import Count, Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.errores import ErrorNegocio
from core.permisos import ADMIN, COORDINADOR, GESTION, LicenciaPermiteOperar, Roles, tiene_rol
from core.utils import parse_fecha, rango_fechas

from . import services
from .models import Caja, CuentaEspera, FormaPago, Venta
from .serializers import (CajaSerializer, CuentaEsperaSerializer, FormaPagoSerializer, MovimientoCajaSerializer,
                          VentaListaSerializer, VentaSerializer)


class FormaPagoViewSet(viewsets.ModelViewSet):
    serializer_class = FormaPagoSerializer
    permission_classes = [IsAuthenticated, Roles(ADMIN, lectura_libre=True)]
    pagination_class = None

    def get_queryset(self):
        qs = FormaPago.objects.all()
        if self.request.query_params.get('activas') in ('1', 'true'):
            qs = qs.filter(activa=True)
        return qs

    def destroy(self, request, *args, **kwargs):
        fp = self.get_object()
        fp.activa = False
        fp.save(update_fields=['activa', 'actualizado'])
        return Response({'ok': True})


class VentaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return VentaListaSerializer if self.action == 'list' else VentaSerializer

    def get_queryset(self):
        qs = (Venta.objects.select_related('usuario', 'cliente', 'caja', 'anulada_por')
              .prefetch_related('pagos__forma_pago', 'detalle__producto', 'documentos'))
        p = self.request.query_params
        # Un cajero solo ve sus ventas de las cajas abiertas; gestión ve todo
        if not tiene_rol(self.request.user, *GESTION):
            qs = qs.filter(usuario=self.request.user)
        desde, hasta = parse_fecha(p.get('fecha_desde')), parse_fecha(p.get('fecha_hasta'))
        if desde or hasta:
            ini, fin = rango_fechas(desde or hasta, hasta or desde)
            qs = qs.filter(creado__gte=ini, creado__lt=fin)
        if p.get('estado'):
            qs = qs.filter(estado=p['estado'])
        if p.get('caja'):
            qs = qs.filter(caja_id=p['caja'])
        if p.get('usuario'):
            qs = qs.filter(usuario_id=p['usuario'])
        if p.get('forma_pago'):
            qs = qs.filter(pagos__forma_pago_id=p['forma_pago']).distinct()
        if p.get('q'):
            q = p['q'].strip()
            filtro = Q(cliente__nombre__icontains=q) | Q(detalle__nombre_producto__icontains=q)
            if q.isdigit():
                filtro |= Q(numero=int(q))
            qs = qs.filter(filtro).distinct()
        if self.action == 'list':
            qs = qs.annotate(items=Count('detalle', distinct=True))
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, Roles(*GESTION)])
    def anular(self, request, pk=None):
        venta = services.anular_venta(self.get_object(), request.data.get('motivo'), request.user, request)
        _enviar_documentos(venta)
        return Response(VentaSerializer(venta).data)


def _enviar_documentos(venta):
    """Intenta enviar enseguida el documento electrónico (para que el tiquete salga con CUDE).
    Si no hay internet o el proveedor tarda, queda pendiente y el worker lo reintenta."""
    from facturacion import services as fe
    for doc in venta.documentos.filter(estado='PENDIENTE').order_by('tipo'):
        try:
            fe.enviar(doc, timeout=6)
        except Exception:  # nunca se debe perder la venta por esto
            pass


class ProcesarVentaView(APIView):
    permission_classes = [IsAuthenticated, LicenciaPermiteOperar]

    def post(self, request):
        venta = services.procesar_venta(request.data, request.user, request.terminal, request)
        _enviar_documentos(venta)
        venta = Venta.objects.select_related('usuario', 'cliente', 'caja').prefetch_related(
            'detalle__producto', 'pagos__forma_pago').get(pk=venta.pk)
        return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)


class CajaActualView(APIView):
    """Caja (turno) del equipo que hace la petición."""

    def get(self, request):
        caja = services.caja_abierta(request.terminal)
        if not caja:
            return Response({'abierta': False, 'terminal': request.terminal})
        data = CajaSerializer(caja).data
        data['abierta'] = True
        data['resumen'] = services.calcular_resumen(caja)
        data['movimientos'] = MovimientoCajaSerializer(caja.movimientos.select_related('usuario'), many=True).data
        return Response(data)

    def post(self, request):
        if not LicenciaPermiteOperar().has_permission(request, self):
            return Response({'error': LicenciaPermiteOperar.message}, status=403)
        caja = services.abrir_caja(request.terminal, request.user, request.data.get('base'), request)
        return Response(CajaSerializer(caja).data, status=201)


class CerrarCajaView(APIView):
    def post(self, request):
        caja = services.caja_abierta(request.terminal)
        if not caja:
            raise ErrorNegocio('No hay caja abierta en este equipo.')
        caja = services.cerrar_caja(caja, request.user, request.data.get('efectivo_contado'),
                                    request.data.get('notas', ''), request)
        try:
            from core.respaldo import crear
            crear('CIERRE')
        except Exception:  # el respaldo nunca debe impedir cerrar la caja
            pass
        return Response(CajaSerializer(caja).data)


class MovimientoCajaView(APIView):
    def post(self, request):
        caja = services.caja_abierta(request.terminal)
        if not caja:
            raise ErrorNegocio('No hay caja abierta en este equipo.')
        tipo = request.data.get('tipo')
        if tipo not in ('INGRESO', 'EGRESO'):
            raise ErrorNegocio('Tipo inválido.')
        mov = services.registrar_movimiento_caja(caja, tipo, request.data.get('monto'),
                                                 request.data.get('concepto'), request.user, request)
        return Response(MovimientoCajaSerializer(mov).data, status=201)


class CajaHistorialViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CajaSerializer
    permission_classes = [IsAuthenticated, Roles(*GESTION)]

    def get_queryset(self):
        qs = Caja.objects.select_related('usuario_apertura', 'usuario_cierre')
        p = self.request.query_params
        if p.get('estado'):
            qs = qs.filter(estado=p['estado'])
        desde, hasta = parse_fecha(p.get('fecha_desde')), parse_fecha(p.get('fecha_hasta'))
        if desde or hasta:
            ini, fin = rango_fechas(desde or hasta, hasta or desde)
            qs = qs.filter(abierta_en__gte=ini, abierta_en__lt=fin)
        return qs

    def retrieve(self, request, *args, **kwargs):
        caja = self.get_object()
        data = CajaSerializer(caja).data
        if caja.estado == 'ABIERTA':
            data['resumen'] = services.calcular_resumen(caja)
        data['movimientos'] = MovimientoCajaSerializer(caja.movimientos.select_related('usuario'), many=True).data
        return Response(data)


class CuentaEsperaViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin,
                          viewsets.GenericViewSet):
    serializer_class = CuentaEsperaSerializer
    pagination_class = None

    def get_queryset(self):
        return CuentaEspera.objects.filter(terminal=self.request.terminal).select_related('usuario')

    def perform_create(self, s):
        s.save(usuario=self.request.user, terminal=self.request.terminal)
