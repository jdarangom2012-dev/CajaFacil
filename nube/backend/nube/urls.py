from django.contrib import admin
from django.urls import include, path, re_path

from panel.views import spa

admin.site.site_header = 'CajaFácil Nube — NautilusTech'
admin.site.site_title = 'CajaFácil Nube'
admin.site.index_title = 'Administración de tiendas'

urlpatterns = [
    path('nautilus/', admin.site.urls),
    path('api/', include('datos.urls')),      # lo que llama CajaFácil desde la tienda
    path('api/panel/', include('panel.urls')),  # lo que llama el panel del dueño
    re_path(r'^(?!api/|nautilus/|static/).*$', spa),
]
