from datetime import timedelta

from django.db.models import Count, Q
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permisos import GESTION, Roles
from core.utils import hoy, parse_fecha, rango_fechas

from .models import Auditoria


class AuditoriaSerializer(serializers.ModelSerializer):
    accion_display = serializers.CharField(source='get_accion_display', read_only=True)
    es_alerta = serializers.BooleanField(read_only=True)

    class Meta:
        model = Auditoria
        fields = '__all__'


class AuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditoriaSerializer
    permission_classes = [Roles(*GESTION)]

    def get_queryset(self):
        qs = Auditoria.objects.all()
        p = self.request.query_params
        if p.get('accion'):
            qs = qs.filter(accion=p['accion'])
        if p.get('usuario'):
            qs = qs.filter(usuario_nombre__icontains=p['usuario'])
        if p.get('solo_alertas') in ('1', 'true'):
            qs = qs.filter(accion__in=Auditoria.ALERTAS)
        if p.get('q'):
            qs = qs.filter(Q(detalle__icontains=p['q']) | Q(usuario_nombre__icontains=p['q']))
        desde = parse_fecha(p.get('fecha_desde'))
        hasta = parse_fecha(p.get('fecha_hasta'))
        if desde or hasta:
            ini, fin = rango_fechas(desde or hasta, hasta or desde)
            qs = qs.filter(fecha_hora__gte=ini, fecha_hora__lt=fin)
        return qs

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        desde = hoy() - timedelta(days=6)
        ini, fin = rango_fechas(desde, hoy())
        qs = Auditoria.objects.filter(fecha_hora__gte=ini, fecha_hora__lt=fin)
        por_accion = list(qs.values('accion').annotate(total=Count('id')).order_by('-total'))
        por_usuario = list(qs.filter(accion__in=Auditoria.ALERTAS)
                           .values('usuario_nombre').annotate(total=Count('id')).order_by('-total')[:10])
        return Response({
            'desde': desde, 'hasta': hoy(),
            'total': qs.count(),
            'alertas': qs.filter(accion__in=Auditoria.ALERTAS).count(),
            'por_accion': por_accion,
            'alertas_por_usuario': por_usuario,
        })
