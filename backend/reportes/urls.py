from django.urls import path

from . import views

urlpatterns = [
    path('dashboard/', views.DashboardView.as_view()),
    path('periodo/', views.ResumenPeriodoView.as_view()),
    path('productos/', views.VentasProductoView.as_view()),
    path('pedido-sugerido/', views.PedidoSugeridoView.as_view()),
    path('asistente/', views.AsistenteView.as_view()),
    path('exportar/', views.ExportarVentasView.as_view()),
]
