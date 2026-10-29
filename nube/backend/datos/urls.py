from django.urls import path

from . import views

urlpatterns = [
    path('sync/eventos', views.EventosView.as_view()),
    path('sync/respaldo', views.RespaldoView.as_view()),
    path('sync/estado', views.EstadoView.as_view()),
    path('licencias/<str:licencia_id>', views.LicenciaView.as_view()),
    path('version', views.VersionView.as_view()),
    path('ia/preguntar', views.AsistenteView.as_view()),
]
