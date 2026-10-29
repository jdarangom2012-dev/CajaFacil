from django.urls import path

from . import views

urlpatterns = [
    path('estado/', views.EstadoSistemaView.as_view()),
    path('configuracion-inicial/', views.ConfiguracionInicialView.as_view()),
    path('configuracion/', views.ConfiguracionView.as_view()),
    path('licencia/', views.LicenciaView.as_view()),
    path('info/', views.InfoView.as_view()),
    path('hardware/', views.HardwareInfoView.as_view()),
    path('hardware/imprimir-venta/<uuid:pk>/', views.ImprimirVentaView.as_view()),
    path('hardware/imprimir-cierre/<uuid:pk>/', views.ImprimirCierreView.as_view()),
    path('hardware/abrir-cajon/', views.AbrirCajonView.as_view()),
    path('hardware/probar-impresora/', views.ProbarImpresoraView.as_view()),
    path('hardware/bascula/', views.LeerBasculaView.as_view()),
    path('respaldos/', views.RespaldosView.as_view()),
    path('respaldos/<int:pk>/descargar/', views.DescargarRespaldoView.as_view()),
    path('nube/', views.NubeView.as_view()),
]
