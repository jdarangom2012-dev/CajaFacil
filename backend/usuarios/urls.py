from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register('usuarios', views.UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('login/', views.LoginView.as_view()),
    path('logout/', views.LogoutView.as_view()),
    path('refresh/', TokenRefreshView.as_view()),
    path('perfil/', views.PerfilView.as_view()),
    path('cambiar-password/', views.CambiarPasswordView.as_view()),
    path('', include(router.urls)),
]
