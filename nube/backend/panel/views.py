"""API del panel del dueño (lo que se ve desde el celular)."""
from datetime import datetime, time, timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDate, TruncHour
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from datos.models import Abono, Alerta, Cierre, Credito, Producto, Respaldo, Venta
from datos.views import estado_suscripcion
from nube.errores import ErrorNegocio
from tiendas.models import Tienda


def spa(request):
    """Sirve el index.html del panel (React) para cualquier ruta que no sea de la API."""
    ruta = settings.FRONTEND_DIR / 'index.html'
    if not ruta.exists():
        return HttpResponse('<h1>CajaFácil Nube</h1><p>El panel no está compilado (npm run build).</p>', status=503)
    return HttpResponse(ruta.read_bytes(), content_type='text/html; charset=utf-8')


def tiendas_de(usuario):
    if usuario.is_staff:
        return Tienda.objects.all()
    return Tienda.objects.filter(accesos__usuario=usuario, activa=True)


def _tienda_dict(t):
    return {'id': t.id, 'nombre': t.nombre, 'ciudad': t.ciudad, 'suscripcion': estado_suscripcion(t),
            'ultima_sincronizacion': t.ultima_sincronizacion, 'ultimo_respaldo': t.ultimo_respaldo}


def _usuario_dict(u):
    return {'usuario': u.username, 'nombre': u.get_full_name() or u.username, 'es_nautilus': u.is_staff,
            'tiendas': [_tienda_dict(t) for t in tiendas_de(u)[:200]],
            'soporte_whatsapp': settings.SOPORTE_WHATSAPP}


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        usuario = str(request.data.get('usuario') or '').strip()
        clave = str(request.data.get('clave') or '')
        u = authenticate(request, username=usuario, password=clave)
        if u is None or not u.is_active:
            raise ErrorNegocio('Usuario o clave incorrectos.', 401)
        if not u.is_staff and not tiendas_de(u).exists():
            raise ErrorNegocio('Tu usuario no tiene tiendas asignadas. Escríbenos por WhatsApp.', 403)
        r = RefreshToken.for_user(u)
        u.last_login = timezone.now()
        u.save(update_fields=['last_login'])
        return Response({'access': str(r.access_token), 'refresh': str(r), **_usuario_dict(u)})


class YoView(APIView):
    def get(self, request):
        return Response(_usuario_dict(request.user))


class ClaveView(APIView):
    def post(self, request):
        actual, nueva = request.data.get('actual') or '', request.data.get('nueva') or ''
        if not request.user.check_password(actual):
            raise ErrorNegocio('La clave actual no es correcta.')
        if len(nueva) < 6:
            raise ErrorNegocio('La clave nueva debe tener mínimo 6 caracteres.')
        request.user.set_password(nueva)
        request.user.save()
        return Response({'ok': True})


# ── Datos de una tienda ─────────────────────────────────────────────

def _rango(dia):
    tz = timezone.get_current_timezone()
    ini = timezone.make_aware(datetime.combine(dia, time.min), tz)
    return ini, ini + timedelta(days=1)


def _dia(request, nombre='fecha'):
    d = parse_date(request.query_params.get(nombre) or '')
    return d or timezone.localdate()


def _f(v):
    return float(v or 0)


class VistaTienda(APIView):
    """Comprueba que el usuario pueda ver la tienda y que la suscripción esté al día."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.tienda = get_object_or_404(tiendas_de(request.user), pk=kwargs['tienda'])
        if not self.tienda.suscripcion_vigente and not request.user.is_staff:
            raise ErrorNegocio('La suscripción de CajaFácil Nube está vencida.', 402)

    def ventas(self):
        return Venta.objects.filter(tienda=self.tienda)


def _totales(qs):
    ok = qs.filter(estado='COMPLETADA')
    a = ok.aggregate(total=Sum('total'), costo=Sum('costo_total'), n=Count('id'))
    an = qs.filter(estado='ANULADA').aggregate(total=Sum('total'), n=Count('id'))
    total, n = _f(a['total']), a['n']
    return {'total': total, 'num_ventas': n, 'ticket_promedio': round(total / n) if n else 0,
            'utilidad': total - _f(a['costo']), 'anuladas': an['n'], 'total_anulado': _f(an['total'])}


def _top(qs, n=5):
    from datos.models import VentaItem
    return [{'nombre': r['nombre'], 'cantidad': _f(r['cant']), 'total': _f(r['tot'])}
            for r in VentaItem.objects.filter(venta__in=qs.filter(estado='COMPLETADA'))
            .values('nombre').annotate(cant=Sum('cantidad'), tot=Sum('subtotal')).order_by('-tot')[:n]]


def _formas_pago(qs):
    tot = {}
    for pagos in qs.filter(estado='COMPLETADA').values_list('pagos', flat=True):
        for p in pagos or []:
            tot[p.get('forma_pago') or 'Otro'] = tot.get(p.get('forma_pago') or 'Otro', 0) + _f(p.get('monto'))
    return [{'nombre': k, 'total': v} for k, v in sorted(tot.items(), key=lambda x: -x[1])]


def _bajos(tienda):
    return Producto.objects.filter(tienda=tienda, activo=True, stock_minimo__gt=0, stock__lte=F('stock_minimo'))


def _saldo_fiado(tienda):
    a = Credito.objects.filter(tienda=tienda, estado='PENDIENTE').aggregate(
        t=Sum('total'), ab=Sum('abonado'), c=Count('cliente_id', distinct=True))
    return {'saldo': _f(a['t']) - _f(a['ab']), 'clientes': a['c']}


class InicioView(VistaTienda):
    def get(self, request, tienda):
        dia = _dia(request)
        ini, fin = _rango(dia)
        hoy = self.ventas().filter(fecha__gte=ini, fecha__lt=fin)
        ayer = self.ventas().filter(fecha__gte=ini - timedelta(days=1), fecha__lt=fin - timedelta(days=1))
        semana = self.ventas().filter(fecha__gte=ini - timedelta(days=7), fecha__lt=fin - timedelta(days=7))
        # Para comparar justo: si es hoy, se compara contra ayer HASTA esta misma hora
        if dia == timezone.localdate():
            corte = timezone.now() - ini
            ayer = ayer.filter(fecha__lt=ini - timedelta(days=1) + corte)
            semana = semana.filter(fecha__lt=ini - timedelta(days=7) + corte)
        tz = timezone.get_current_timezone()
        por_hora = {r['h'].astimezone(tz).hour: _f(r['t']) for r in hoy.filter(estado='COMPLETADA')
                    .annotate(h=TruncHour('fecha', tzinfo=tz)).values('h').annotate(t=Sum('total'))}
        ultimo_cierre = Cierre.objects.filter(tienda=self.tienda).first()
        t = self.tienda
        return Response({
            'tienda': _tienda_dict(t), 'fecha': dia, 'es_hoy': dia == timezone.localdate(),
            'ventas': _totales(hoy),
            'comparacion': {'ayer': _totales(ayer)['total'], 'semana_pasada': _totales(semana)['total']},
            'por_hora': [{'hora': h, 'total': por_hora.get(h, 0)} for h in range(24)],
            'formas_pago': _formas_pago(hoy),
            'top_productos': _top(hoy),
            'fiado': _saldo_fiado(t),
            'inventario_bajo': _bajos(t).count(),
            'alertas': [_alerta_dict(a) for a in Alerta.objects.filter(tienda=t)[:5]],
            'alertas_sin_ver': Alerta.objects.filter(tienda=t, vista=False).count(),
            'ultimo_cierre': _cierre_dict(ultimo_cierre) if ultimo_cierre else None,
        })


def _venta_dict(v, detalle=False):
    r = {'id': v.id, 'numero': v.numero, 'fecha': v.fecha, 'total': _f(v.total), 'estado': v.estado,
         'usuario': v.usuario, 'cliente': v.cliente, 'terminal': v.terminal,
         'formas_pago': ', '.join(sorted({p.get('forma_pago', '') for p in v.pagos or []}))}
    if detalle:
        r.update({'subtotal': _f(v.subtotal), 'descuento': _f(v.descuento), 'utilidad': _f(v.total - v.costo_total),
                  'motivo_anulacion': v.motivo_anulacion, 'pagos': v.pagos,
                  'items': [{'nombre': i.nombre, 'cantidad': _f(i.cantidad), 'precio_unit': _f(i.precio_unit),
                             'descuento': _f(i.descuento), 'subtotal': _f(i.subtotal)} for i in v.items.all()]})
    return r


class VentasView(VistaTienda):
    def get(self, request, tienda):
        dia = _dia(request)
        ini, fin = _rango(dia)
        qs = self.ventas().filter(fecha__gte=ini, fecha__lt=fin)
        if request.query_params.get('estado') in ('COMPLETADA', 'ANULADA'):
            qs = qs.filter(estado=request.query_params['estado'])
        return Response({'fecha': dia, 'totales': _totales(self.ventas().filter(fecha__gte=ini, fecha__lt=fin)),
                         'ventas': [_venta_dict(v) for v in qs[:500]]})


class VentaView(VistaTienda):
    def get(self, request, tienda, venta):
        v = get_object_or_404(self.ventas().prefetch_related('items'), pk=venta)
        return Response(_venta_dict(v, detalle=True))


def _cierre_dict(c):
    r = c.resumen or {}
    return {'id': c.id, 'numero': c.numero, 'terminal': c.terminal, 'abierta_en': c.abierta_en,
            'cerrada_en': c.cerrada_en, 'usuario': c.usuario, 'total_ventas': _f(c.total_ventas),
            'efectivo_esperado': _f(c.efectivo_esperado), 'efectivo_contado': _f(c.efectivo_contado),
            'diferencia': _f(c.diferencia), 'num_ventas': r.get('num_ventas'), 'num_anuladas': r.get('num_anuladas'),
            'utilidad': r.get('utilidad_estimada'), 'por_forma_pago': r.get('por_forma_pago') or [],
            'egresos': r.get('egresos_efectivo'), 'ingresos': r.get('ingresos_efectivo'), 'base': r.get('base')}


class CierresView(VistaTienda):
    def get(self, request, tienda):
        qs = Cierre.objects.filter(tienda=self.tienda)
        return Response([_cierre_dict(c) for c in qs[:90]])


class FiadosView(VistaTienda):
    def get(self, request, tienda):
        filas = (Credito.objects.filter(tienda=self.tienda, estado='PENDIENTE')
                 .values('cliente_id').annotate(total=Sum('total'), abonado=Sum('abonado'), n=Count('id')))
        nombres = {}
        for c in Credito.objects.filter(tienda=self.tienda).order_by('evento_en').values('cliente_id', 'cliente', 'telefono', 'vence', 'estado'):
            nombres[c['cliente_id']] = c
        vencidos = set(Credito.objects.filter(tienda=self.tienda, estado='PENDIENTE', vence__lt=timezone.localdate())
                       .values_list('cliente_id', flat=True))
        clientes = sorted([{
            'cliente_id': f['cliente_id'], 'cliente': nombres.get(f['cliente_id'], {}).get('cliente', ''),
            'telefono': nombres.get(f['cliente_id'], {}).get('telefono', ''), 'saldo': _f(f['total']) - _f(f['abonado']),
            'creditos': f['n'], 'vencido': f['cliente_id'] in vencidos,
        } for f in filas if _f(f['total']) - _f(f['abonado']) > 0], key=lambda x: -x['saldo'])
        f = _saldo_fiado(self.tienda)
        return Response({'saldo': f['saldo'], 'num_clientes': f['clientes'], 'clientes': clientes})


class FiadoClienteView(VistaTienda):
    def get(self, request, tienda, cliente):
        creditos = Credito.objects.filter(tienda=self.tienda, cliente_id=cliente)
        if not creditos.exists():
            raise ErrorNegocio('Cliente no encontrado.', 404)
        abonos = Abono.objects.filter(tienda=self.tienda, cliente_id=cliente)[:100]
        c0 = creditos.order_by('-evento_en').first()
        return Response({
            'cliente': c0.cliente, 'telefono': c0.telefono,
            'saldo': sum(_f(c.total) - _f(c.abonado) for c in creditos if c.estado == 'PENDIENTE'),
            'creditos': [{'id': c.id, 'numero': c.numero, 'fecha': c.creado_local, 'total': _f(c.total),
                          'abonado': _f(c.abonado), 'saldo': _f(c.total) - _f(c.abonado), 'estado': c.estado,
                          'vence': c.vence} for c in creditos[:100]],
            'abonos': [{'id': a.id, 'fecha': a.fecha, 'monto': _f(a.monto), 'forma_pago': a.forma_pago,
                        'saldo_nuevo': _f(a.saldo_nuevo), 'usuario': a.usuario} for a in abonos],
        })


class InventarioView(VistaTienda):
    def get(self, request, tienda):
        qs = Producto.objects.filter(tienda=self.tienda, activo=True)
        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(Q(nombre__icontains=q) | Q(codigo_barras__icontains=q) | Q(categoria__icontains=q))
        filtro = request.query_params.get('filtro') or 'todos'
        if filtro == 'bajo':
            qs = qs.filter(stock_minimo__gt=0, stock__lte=F('stock_minimo'))
        elif filtro == 'agotado':
            qs = qs.filter(stock__lte=0)
        base = Producto.objects.filter(tienda=self.tienda, activo=True)
        valor = sum(_f(p.stock) * _f(p.precio_costo) for p in base.filter(stock__gt=0).only('stock', 'precio_costo'))
        return Response({
            'conteo': {'todos': base.count(), 'bajo': _bajos(self.tienda).count(), 'agotado': base.filter(stock__lte=0).count()},
            'valor_inventario': valor,
            'productos': [{'id': p.id, 'nombre': p.nombre, 'codigo_barras': p.codigo_barras, 'categoria': p.categoria,
                           'stock': _f(p.stock), 'stock_minimo': _f(p.stock_minimo), 'unidad': p.unidad_medida,
                           'precio_venta': _f(p.precio_venta), 'precio_costo': _f(p.precio_costo)}
                          for p in qs.order_by('stock' if filtro != 'todos' else 'nombre')[:400]],
        })


def _alerta_dict(a):
    return {'id': a.id, 'accion': a.accion, 'usuario': a.usuario, 'detalle': a.detalle, 'terminal': a.terminal,
            'fecha': a.fecha, 'vista': a.vista}


class AlertasView(VistaTienda):
    def get(self, request, tienda):
        return Response([_alerta_dict(a) for a in Alerta.objects.filter(tienda=self.tienda)[:200]])

    def post(self, request, tienda):
        """Marcar todas como vistas."""
        n = Alerta.objects.filter(tienda=self.tienda, vista=False).update(vista=True)
        return Response({'marcadas': n})


class ReportesView(VistaTienda):
    def get(self, request, tienda):
        try:
            dias = max(7, min(int(request.query_params.get('dias') or 30), 365))
        except ValueError:
            dias = 30
        hoy = timezone.localdate()
        ini, _ = _rango(hoy - timedelta(days=dias - 1))
        _, fin = _rango(hoy)
        qs = self.ventas().filter(fecha__gte=ini, fecha__lt=fin)
        tz = timezone.get_current_timezone()
        por_dia = {r['d']: r for r in qs.filter(estado='COMPLETADA').annotate(d=TruncDate('fecha', tzinfo=tz))
                   .values('d').annotate(t=Sum('total'), c=Sum('costo_total'), n=Count('id'))}
        serie = []
        for i in range(dias):
            d = hoy - timedelta(days=dias - 1 - i)
            r = por_dia.get(d)
            serie.append({'fecha': d, 'total': _f(r['t']) if r else 0, 'utilidad': _f(r['t']) - _f(r['c']) if r else 0,
                          'ventas': r['n'] if r else 0})
        return Response({'dias': dias, 'totales': _totales(qs), 'por_dia': serie, 'top_productos': _top(qs, 15),
                         'formas_pago': _formas_pago(qs)})


class RespaldosView(VistaTienda):
    def get(self, request, tienda):
        return Response([{'id': r.id, 'nombre': r.nombre, 'tamano': r.tamano, 'recibido': r.recibido}
                         for r in Respaldo.objects.filter(tienda=self.tienda)[:30]])
