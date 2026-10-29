import uuid
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auditoria.services import registrar
from core.permisos import ADMIN, ALMACENISTA, COORDINADOR, LicenciaPermiteOperar, Roles
from core.sync import encolar
from core.utils import parse_fecha, rango_fechas

from . import importar as imp
from .models import Categoria, MovimientoInventario, Producto
from .serializers import (AjusteSerializer, CategoriaSerializer, EntradaSerializer, MovimientoSerializer,
                          ProductoPOSSerializer, ProductoSerializer)
from .services import mover_stock, payload_producto, siguiente_codigo_interno

INVENTARIO = (ADMIN, COORDINADOR, ALMACENISTA)


class CategoriaViewSet(viewsets.ModelViewSet):
    serializer_class = CategoriaSerializer
    permission_classes = [IsAuthenticated, LicenciaPermiteOperar, Roles(*INVENTARIO, lectura_libre=True)]
    pagination_class = None

    def get_queryset(self):
        qs = Categoria.objects.annotate(total_productos=Count('productos', filter=Q(productos__activo=True)))
        if self.request.query_params.get('activas') in ('1', 'true'):
            qs = qs.filter(activa=True)
        return qs

    def perform_create(self, s):
        c = s.save()
        registrar(self.request.user, 'INSERT', 'categorias', c.id, valor_nuevo={'nombre': c.nombre},
                  detalle=f'Categoría creada: {c.nombre}', request=self.request)

    def destroy(self, request, *args, **kwargs):
        c = self.get_object()
        c.activa = False
        c.save(update_fields=['activa', 'actualizado'])
        registrar(request.user, 'DELETE', 'categorias', c.id, detalle=f'Categoría desactivada: {c.nombre}',
                  request=request)
        return Response({'ok': True})


class ProductoViewSet(viewsets.ModelViewSet):
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated, LicenciaPermiteOperar, Roles(*INVENTARIO, lectura_libre=True)]

    def get_queryset(self):
        qs = Producto.objects.select_related('categoria')
        p = self.request.query_params
        estado = p.get('estado', 'activos')
        if estado == 'activos':
            qs = qs.filter(activo=True)
        elif estado == 'inactivos':
            qs = qs.filter(activo=False)
        if p.get('categoria'):
            qs = qs.filter(categoria_id=p['categoria'])
        if p.get('q'):
            for palabra in p['q'].split():
                qs = qs.filter(Q(nombre__icontains=palabra) | Q(codigo_barras__icontains=palabra))
        if p.get('bajo_minimo') in ('1', 'true'):
            qs = qs.filter(categoria__controla_stock=True, stock__lte=F('stock_minimo'))
        if p.get('favoritos') in ('1', 'true'):
            qs = qs.filter(favorito=True)
        orden = p.get('orden', 'nombre')
        if orden.lstrip('-') in ('nombre', 'precio_venta', 'stock', 'creado'):
            qs = qs.order_by(orden)
        return qs

    @transaction.atomic
    def perform_create(self, s):
        stock_inicial = s.validated_data.pop('stock_inicial', None)
        if not s.validated_data.get('codigo_barras'):
            s.validated_data['codigo_barras'] = siguiente_codigo_interno()
        p = s.save()
        if stock_inicial:
            mover_stock(p, 'INICIAL', stock_inicial, self.request.user, motivo='Stock inicial')
        registrar(self.request.user, 'INSERT', 'productos', p.id,
                  valor_nuevo={'nombre': p.nombre, 'precio_venta': p.precio_venta},
                  detalle=f'Producto creado: {p.nombre}', request=self.request)
        encolar('producto', p.id, payload_producto(p))

    @transaction.atomic
    def perform_update(self, s):
        s.validated_data.pop('stock_inicial', None)
        antes = {'precio_venta': s.instance.precio_venta, 'precio_costo': s.instance.precio_costo}
        p = s.save()
        if antes['precio_venta'] != p.precio_venta or antes['precio_costo'] != p.precio_costo:
            registrar(self.request.user, 'PRECIO', 'productos', p.id, valor_anterior=antes,
                      valor_nuevo={'precio_venta': p.precio_venta, 'precio_costo': p.precio_costo},
                      detalle=f'Cambio de precio {p.nombre}: ${antes["precio_venta"]:,.0f} → ${p.precio_venta:,.0f}',
                      request=self.request)
        else:
            registrar(self.request.user, 'UPDATE', 'productos', p.id, detalle=f'Producto modificado: {p.nombre}',
                      request=self.request)
        encolar('producto', p.id, payload_producto(p))

    def destroy(self, request, *args, **kwargs):
        p = self.get_object()
        p.activo = False
        p.save(update_fields=['activo', 'actualizado'])
        registrar(request.user, 'DELETE', 'productos', p.id, detalle=f'Producto desactivado: {p.nombre}',
                  request=request)
        encolar('producto', p.id, payload_producto(p))
        return Response({'ok': True})

    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        p = self.get_object()
        p.activo = True
        p.save(update_fields=['activo', 'actualizado'])
        return Response(ProductoSerializer(p).data)

    @action(detail=True, methods=['post'])
    def favorito(self, request, pk=None):
        p = self.get_object()
        p.favorito = not p.favorito
        p.save(update_fields=['favorito', 'actualizado'])
        return Response({'favorito': p.favorito})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def buscar(self, request):
        """Búsqueda para la caja: por código exacto (lector) o por texto."""
        codigo = (request.query_params.get('codigo') or '').strip()
        q = (request.query_params.get('q') or '').strip()
        base = Producto.objects.select_related('categoria').filter(activo=True)
        if codigo:
            p = base.filter(codigo_barras=codigo).first()
            return Response(ProductoPOSSerializer(p).data if p else None)
        if not q:
            return Response([])
        qs = base
        for palabra in q.split():
            qs = qs.filter(Q(nombre__icontains=palabra) | Q(codigo_barras__icontains=palabra))
        return Response(ProductoPOSSerializer(qs.order_by('-favorito', 'nombre')[:30], many=True).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def rapidos(self, request):
        """Teclas rápidas de la caja: favoritos y productos de precio variable."""
        qs = Producto.objects.select_related('categoria').filter(activo=True).filter(
            Q(favorito=True) | Q(categoria__precio_variable=True)).order_by('-favorito', 'nombre')[:60]
        return Response(ProductoPOSSerializer(qs, many=True).data)

    @action(detail=False, methods=['post'], url_path='crear-rapido', permission_classes=[IsAuthenticated])
    def crear_rapido(self, request):
        """Desde la caja: crea (o reutiliza) un producto de precio variable (Fruver) con nombre y precio."""
        nombre = (request.data.get('nombre') or '').strip()
        try:
            precio = float(request.data.get('precio') or 0)
        except ValueError:
            precio = 0
        if len(nombre) < 2 or precio <= 0:
            return Response({'error': 'Indica nombre y precio.'}, status=400)
        cat = Categoria.objects.filter(precio_variable=True, activa=True).first()
        if not cat:
            cat = Categoria.objects.create(nombre='Fruver', precio_variable=True, controla_stock=False,
                                           color='#12B76A')
        p = Producto.objects.filter(categoria=cat, nombre__iexact=nombre).first()
        if p:
            p.activo = True
            p.save(update_fields=['activo', 'actualizado'])
        else:
            p = Producto.objects.create(nombre=nombre, categoria=cat, precio_venta=precio,
                                        codigo_barras=siguiente_codigo_interno(), unidad_medida='UNIDAD')
            registrar(request.user, 'INSERT', 'productos', p.id, detalle=f'Producto creado desde la caja: {nombre}',
                      request=request)
        return Response(ProductoPOSSerializer(p).data, status=201)

    @action(detail=False, methods=['get'], url_path='siguiente-codigo')
    def siguiente_codigo(self, request):
        return Response({'codigo': siguiente_codigo_interno()})

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def imagen(self, request, pk=None):
        p = self.get_object()
        f = request.FILES.get('imagen')
        if not f:
            return Response({'error': 'Selecciona una imagen.'}, status=400)
        ext = Path(f.name).suffix.lower()
        if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
            return Response({'error': 'Formato no permitido (usa JPG, PNG o WEBP).'}, status=400)
        if f.size > 3 * 1024 * 1024:
            return Response({'error': 'La imagen supera 3 MB.'}, status=400)
        carpeta = Path(settings.MEDIA_ROOT) / 'productos'
        carpeta.mkdir(parents=True, exist_ok=True)
        nombre = f'productos/{p.id}_{uuid.uuid4().hex[:6]}{ext}'
        with open(Path(settings.MEDIA_ROOT) / nombre, 'wb') as out:
            for chunk in f.chunks():
                out.write(chunk)
        if p.imagen:
            (Path(settings.MEDIA_ROOT) / p.imagen).unlink(missing_ok=True)
        p.imagen = nombre
        p.save(update_fields=['imagen', 'actualizado'])
        return Response(ProductoSerializer(p).data)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def importar(self, request):
        f = request.FILES.get('archivo')
        if not f:
            return Response({'error': 'Selecciona el archivo Excel o CSV.'}, status=400)
        try:
            res = imp.importar(f, request.user, request.data.get('actualizar', 'true') in ('true', '1', True))
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        registrar(request.user, 'INSERT', 'productos',
                  detalle=f'Importación: {res["creados"]} creados, {res["actualizados"]} actualizados',
                  request=request)
        return Response(res)

    @action(detail=False, methods=['get'])
    def plantilla(self, request):
        r = HttpResponse(imp.plantilla(),
                         content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        r['Content-Disposition'] = 'attachment; filename="plantilla_productos_cajafacil.xlsx"'
        return r

    @action(detail=False, methods=['get'])
    def exportar(self, request):
        r = HttpResponse(imp.exportar(self.get_queryset()),
                         content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        r['Content-Disposition'] = 'attachment; filename="productos_cajafacil.xlsx"'
        return r

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        qs = Producto.objects.filter(activo=True)
        con_stock = qs.filter(categoria__controla_stock=True)
        valor = con_stock.filter(stock__gt=0).aggregate(
            costo=Sum(F('stock') * F('precio_costo')), venta=Sum(F('stock') * F('precio_venta')))
        return Response({
            'total_productos': qs.count(),
            'bajo_minimo': con_stock.filter(stock__lte=F('stock_minimo')).count(),
            'agotados': con_stock.filter(stock__lte=0).count(),
            'valor_inventario_costo': float(valor['costo'] or 0),
            'valor_inventario_venta': float(valor['venta'] or 0),
        })


class MovimientoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MovimientoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = MovimientoInventario.objects.select_related('producto', 'usuario')
        p = self.request.query_params
        if p.get('producto'):
            qs = qs.filter(producto_id=p['producto'])
        if p.get('tipo'):
            qs = qs.filter(tipo=p['tipo'])
        if p.get('q'):
            qs = qs.filter(Q(producto__nombre__icontains=p['q']) | Q(motivo__icontains=p['q']))
        desde, hasta = parse_fecha(p.get('fecha_desde')), parse_fecha(p.get('fecha_hasta'))
        if desde or hasta:
            ini, fin = rango_fechas(desde or hasta, hasta or desde)
            qs = qs.filter(creado__gte=ini, creado__lt=fin)
        return qs


class EntradaMercanciaView(APIView):
    """Recepción de mercancía de un proveedor (varios productos en una sola entrada)."""
    permission_classes = [IsAuthenticated, LicenciaPermiteOperar, Roles(*INVENTARIO)]

    @transaction.atomic
    def post(self, request):
        s = EntradaSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        ref = str(uuid.uuid4())
        motivo = 'Entrada de mercancía' + (f' — factura {d["factura"]}' if d.get('factura') else '')
        total = 0
        for l in d['lineas']:
            p = Producto.objects.get(pk=l['producto_id'])
            mover_stock(p, 'ENTRADA', l['cantidad'], request.user, motivo=motivo, referencia_tipo='COMPRA',
                        referencia_id=ref, costo_unitario=l.get('costo_unitario'), proveedor=d.get('proveedor', ''))
            if l.get('precio_venta'):
                anterior = p.precio_venta
                p.refresh_from_db()
                if anterior != l['precio_venta']:
                    p.precio_venta = l['precio_venta']
                    p.save(update_fields=['precio_venta', 'actualizado'])
                    registrar(request.user, 'PRECIO', 'productos', p.id,
                              valor_anterior={'precio_venta': anterior}, valor_nuevo={'precio_venta': p.precio_venta},
                              detalle=f'Cambio de precio en entrada {p.nombre}: ${anterior:,.0f} → ${p.precio_venta:,.0f}',
                              request=request)
            total += float(l['cantidad']) * float(l.get('costo_unitario') or 0)
        registrar(request.user, 'INSERT', 'inventario', ref,
                  valor_nuevo={'proveedor': d.get('proveedor', ''), 'items': len(d['lineas']), 'total': total},
                  detalle=f'Entrada de mercancía ({len(d["lineas"])} productos) {d.get("proveedor", "")}'.strip(),
                  request=request)
        return Response({'ok': True, 'referencia': ref, 'items': len(d['lineas']), 'total_costo': total},
                        status=status.HTTP_201_CREATED)


class AjusteInventarioView(APIView):
    permission_classes = [IsAuthenticated, LicenciaPermiteOperar, Roles(*INVENTARIO)]

    def post(self, request):
        s = AjusteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        p = Producto.objects.get(pk=d['producto_id'])
        mov = mover_stock(p, d['tipo'], d['cantidad'], request.user, motivo=d['motivo'], referencia_tipo='AJUSTE')
        registrar(request.user, 'AJUSTE', 'inventario', mov.id,
                  valor_anterior={'stock': mov.stock_anterior}, valor_nuevo={'stock': mov.stock_nuevo, 'tipo': d['tipo']},
                  detalle=f'{mov.get_tipo_display()} {p.nombre}: {mov.stock_anterior:f} → {mov.stock_nuevo:f}. {d["motivo"]}',
                  request=request)
        return Response(MovimientoSerializer(mov).data, status=201)
