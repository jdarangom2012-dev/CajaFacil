from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('clientes', views.ClienteViewSet, basename='cliente')
router.register('abonos', views.AbonoViewSet, basename='abono')
router.register('', views.CreditoViewSet, basename='credito')
urlpatterns = router.urls
