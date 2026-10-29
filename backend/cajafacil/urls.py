from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve


def spa(request, *args, **kwargs):
    """Sirve el frontend (React). Cualquier ruta que no sea /api devuelve index.html."""
    index = Path(settings.FRONTEND_DIST) / 'index.html'
    if not index.exists():
        return HttpResponse('<h2>CajaFacil</h2><p>El frontend no está compilado. '
                            'Ejecute <code>npm run build</code> en la carpeta frontend.</p>')
    r = FileResponse(open(index, 'rb'), content_type='text/html; charset=utf-8')
    r['Cache-Control'] = 'no-cache'
    return r


def api_404(request, *args, **kwargs):
    return JsonResponse({'error': 'Ruta no encontrada.'}, status=404)


urlpatterns = [
    path('api/sistema/', include('core.urls')),
    path('api/auth/', include('usuarios.urls')),
    path('api/catalogo/', include('catalogo.urls')),
    path('api/ventas/', include('ventas.urls')),
    path('api/fiado/', include('creditos.urls')),
    path('api/auditoria/', include('auditoria.urls')),
    path('api/reportes/', include('reportes.urls')),
    path('api/facturacion/', include('facturacion.urls')),
    re_path(r'^api/.*$', api_404),
    re_path(r'^imagenes/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    re_path(r'^(?!api/|static/|imagenes/).*$', spa),
]
