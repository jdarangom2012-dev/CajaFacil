from decimal import Decimal
from urllib.parse import quote

from django.db import transaction
from django.db.models import Count, DecimalField, Exists, F, OuterRef, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from auditoria.services import registrar
from core.models import Configuracion
from core.permisos import GESTION, LicenciaPermiteOperar, Roles
from core.utils import parse_fecha, rango_fechas
from ventas.models import FormaPago
from ventas.services import caja_abierta

from . import services
from .models import AbonoCredito, Cliente, Credito
from .serializers import (AbonarSerializer, AbonoSerializer, ClienteSerializer, CrearCreditoSerializer,
                          CreditoSerializer)

DEC = DecimalField(max_digits=14, decimal_places=2)


def _clientes_con_saldo():
    pendientes = Q(creditos__estado='PENDIENTE')
    vencidos = Credito.objects.filter(cliente=OuterRef('pk'), estado='PENDIENTE', vence__lt=timezone.localdate())
    return Cliente.objects.annotate(
        saldo=Coalesce(Sum(F('creditos__total') - F('creditos__abonado'), filter=pendientes), Value(Decimal('0')),
                       output_field=DEC),
        creditos_pendientes=Count('creditos', filter=pendientes),
        tiene_vencidos=Exists(vencidos),
    )


def _mensaje_whatsapp(cliente, saldo):
    conf = Configuracion.obtener()
    texto = (f'Hola {cliente.nombre.split()[0]}, te saludamos de {conf.nombre_negocio}. '
             f'Te recordamos que tienes un saldo pendiente de ${saldo:,.0f}. '
             f'Puedes pasar a abonar cuando quieras. ¡Gracias por tu confianza!').replace(',', '.')
    tel = ''.join(ch for ch in (cliente.telefono or '') if ch.isdigit())
    if len(tel) == 10:
        tel = '57' + tel
    return {'telefono': tel, 'mensaje': texto,
            'url': f'https://wa.me/{tel}?text={quote(texto)}' if tel else ''}


class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated, LicenciaPermiteOperar]

    def get_queryset(self):
        qs = _clientes_con_saldo()
        p = self.request.query_params
        if p.get('q'):
            q = p['q'].strip()
            qs = qs.filter(Q(nombre__icontains=q) | Q(telefono__icontains=q) | Q(documento__icontains=q))
        if p.get('con_deuda') in ('1', 'true'):
            qs = qs.filter(saldo__gt=0)
        if p.get('vencidos') in ('1', 'true'):
            qs = qs.filter(tiene_vencidos=True)
        if p.get('estado', 'activos') == 'activos':
            qs = qs.filter(activo=True)
        orden = p.get('orden', 'nombre')
        return qs.order_by('-saldo', 'nombre') if orden == 'saldo' else qs.order_by('nombre')

    def perform_create(self, s):
        c = s.save()
        registrar(self.request.user, 'INSERT', 'clientes', c.id, detalle=f'Cliente creado: {c.nombre}',
                  request=self.request)

    def destroy(self, request, *args, **kwargs):
        c = self.get_object()
        if c.saldo_actual() > 0:
            return Response({'error': 'El cliente tiene saldo pendiente.'}, status=400)
        c.activo = False
        c.save(update_fields=['activo', 'actualizado'])
        return Response({'ok': True})

    @action(detail=True, methods=['get'], url_path='estado-cuenta')
    def estado_cuenta(self, request, pk=None):
        c = self.get_object()
        creditos = (c.creditos.select_related('venta', 'usuario').prefetch_related(
            'abonos__forma_pago', 'abonos__usuario', 'venta__detalle').order_by('-creado')[:200])
        saldo = c.saldo_actual()
        return Response({
            'cliente': ClienteSerializer(c).data,
            'saldo': saldo,
            'creditos': CreditoSerializer(creditos, many=True).data,
            'whatsapp': _mensaje_whatsapp(c, saldo),
        })

    @action(detail=True, methods=['post'])
    def abonar(self, request, pk=None):
        cliente = self.get_object()
        s = AbonarSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        fp = FormaPago.objects.get(pk=d['forma_pago_id'])
        with transaction.atomic():
            res = services.abonar(cliente, d['monto'], fp, request.user, caja=caja_abierta(request.terminal),
                                  nota=d.get('nota', ''), referencia=d.get('referencia', ''), request=request)
        impreso = None
        if d.get('imprimir'):
            from core.views import imprimir_bytes
            from core.hardware.tickets import comprobante_abono
            conf = Configuracion.obtener()
            impreso = imprimir_bytes(comprobante_abono(cliente, res, fp, request.user, conf), conf)
        return Response({
            'grupo': res['grupo'], 'saldo_anterior': res['saldo_anterior'], 'saldo_nuevo': res['saldo_nuevo'],
            'abonos': AbonoSerializer(res['abonos'], many=True).data, 'impresion': impreso,
        })

    @action(detail=True, methods=['get'])
    def whatsapp(self, request, pk=None):
        c = self.get_object()
        return Response(_mensaje_whatsapp(c, c.saldo_actual()))


class CreditoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                     viewsets.GenericViewSet):
    serializer_class = CreditoSerializer
    permission_classes = [IsAuthenticated, LicenciaPermiteOperar]

    def get_queryset(self):
        qs = Credito.objects.select_related('cliente', 'venta', 'usuario').prefetch_related(
            'abonos__forma_pago', 'abonos__usuario', 'venta__detalle')
        p = self.request.query_params
        estado = p.get('estado')
        if estado == 'VENCIDO':
            qs = qs.filter(estado='PENDIENTE', vence__lt=timezone.localdate())
        elif estado:
            qs = qs.filter(estado=estado)
        if p.get('cliente'):
            qs = qs.filter(cliente_id=p['cliente'])
        if p.get('q'):
            qs = qs.filter(cliente__nombre__icontains=p['q'])
        desde, hasta = parse_fecha(p.get('fecha_desde')), parse_fecha(p.get('fecha_hasta'))
        if desde or hasta:
            ini, fin = rango_fechas(desde or hasta, hasta or desde)
            qs = qs.filter(creado__gte=ini, creado__lt=fin)
        return qs

    def create(self, request, *args, **kwargs):
        """Fiado manual (sin venta): por ejemplo, pasar las deudas del cuaderno al sistema."""
        if not Roles(*GESTION)().has_permission(request, self):
            return Response({'error': 'Solo administrador o coordinador puede registrar fiados manuales.'}, status=403)
        s = CrearCreditoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        cliente = Cliente.objects.get(pk=s.validated_data['cliente_id'])
        with transaction.atomic():
            c = services.crear_credito(cliente, s.validated_data['total'], request.user,
                                       notas=s.validated_data.get('notas') or 'Fiado manual', request=request)
        return Response(CreditoSerializer(c).data, status=201)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        pend = Credito.objects.filter(estado='PENDIENTE')
        hoy = timezone.localdate()
        cartera = pend.aggregate(s=Sum(F('total') - F('abonado'), output_field=DEC))['s'] or 0
        vencida = pend.filter(vence__lt=hoy).aggregate(s=Sum(F('total') - F('abonado'), output_field=DEC))['s'] or 0
        ini, fin = rango_fechas(hoy, hoy)
        abonos_hoy = AbonoCredito.objects.filter(creado__gte=ini, creado__lt=fin).aggregate(
            s=Sum('monto'), n=Count('grupo', distinct=True))
        fiado_hoy = Credito.objects.filter(creado__gte=ini, creado__lt=fin).exclude(estado='ANULADO').aggregate(
            s=Sum('total'))
        top = list(_clientes_con_saldo().filter(saldo__gt=0).order_by('-saldo')[:5]
                   .values('id', 'nombre', 'telefono', 'saldo'))
        return Response({
            'cartera_total': cartera,
            'cartera_vencida': vencida,
            'clientes_con_deuda': pend.values('cliente').distinct().count(),
            'creditos_pendientes': pend.count(),
            'creditos_vencidos': pend.filter(vence__lt=hoy).count(),
            'abonos_hoy': abonos_hoy['s'] or 0,
            'num_abonos_hoy': abonos_hoy['n'] or 0,
            'fiado_hoy': fiado_hoy['s'] or 0,
            'tope_defecto': Configuracion.obtener().tope_credito_defecto,
            'top_deudores': top,
        })


class AbonoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AbonoSerializer

    def get_queryset(self):
        qs = AbonoCredito.objects.select_related('credito__cliente', 'forma_pago', 'usuario')
        p = self.request.query_params
        if p.get('cliente'):
            qs = qs.filter(credito__cliente_id=p['cliente'])
        desde, hasta = parse_fecha(p.get('fecha_desde')), parse_fecha(p.get('fecha_hasta'))
        if desde or hasta:
            ini, fin = rango_fechas(desde or hasta, hasta or desde)
            qs = qs.filter(creado__gte=ini, creado__lt=fin)
        return qs
