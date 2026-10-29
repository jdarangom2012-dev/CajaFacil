from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('login/', views.LoginView.as_view()),
    path('refresh/', TokenRefreshView.as_view()),
    path('yo/', views.YoView.as_view()),
    path('clave/', views.ClaveView.as_view()),
    path('t/<int:tienda>/inicio/', views.InicioView.as_view()),
    path('t/<int:tienda>/ventas/', views.VentasView.as_view()),
    path('t/<int:tienda>/ventas/<int:venta>/', views.VentaView.as_view()),
    path('t/<int:tienda>/cierres/', views.CierresView.as_view()),
    path('t/<int:tienda>/fiados/', views.FiadosView.as_view()),
    path('t/<int:tienda>/fiados/<str:cliente>/', views.FiadoClienteView.as_view()),
    path('t/<int:tienda>/inventario/', views.InventarioView.as_view()),
    path('t/<int:tienda>/alertas/', views.AlertasView.as_view()),
    path('t/<int:tienda>/reportes/', views.ReportesView.as_view()),
    path('t/<int:tienda>/respaldos/', views.RespaldosView.as_view()),
]
