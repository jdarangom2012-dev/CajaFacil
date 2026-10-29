from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('categorias', views.CategoriaViewSet, basename='categoria')
router.register('productos', views.ProductoViewSet, basename='producto')
router.register('movimientos', views.MovimientoViewSet, basename='movimiento')

urlpatterns = [
    path('entradas/', views.EntradaMercanciaView.as_view()),
    path('ajustes/', views.AjusteInventarioView.as_view()),
    path('', include(router.urls)),
]
