from django.urls import path

from . import views

urlpatterns = [
    path('estado/', views.EstadoView.as_view()),
    path('configuracion/', views.ConfiguracionView.as_view()),
    path('probar/', views.ProbarView.as_view()),
    path('documentos/', views.DocumentosView.as_view()),
    path('documentos/<uuid:pk>/', views.DocumentoView.as_view()),
    path('documentos/<uuid:pk>/reintentar/', views.ReintentarView.as_view()),
    path('enviar-pendientes/', views.EnviarPendientesView.as_view()),
]
