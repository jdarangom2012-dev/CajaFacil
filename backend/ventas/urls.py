from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('formas-pago', views.FormaPagoViewSet, basename='forma-pago')
router.register('historial', views.VentaViewSet, basename='venta')
router.register('cajas', views.CajaHistorialViewSet, basename='caja')
router.register('en-espera', views.CuentaEsperaViewSet, basename='en-espera')

urlpatterns = [
    path('procesar/', views.ProcesarVentaView.as_view()),
    path('caja/', views.CajaActualView.as_view()),
    path('caja/cerrar/', views.CerrarCajaView.as_view()),
    path('caja/movimientos/', views.MovimientoCajaView.as_view()),
    path('', include(router.urls)),
]
