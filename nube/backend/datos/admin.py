from django.contrib import admin

from .models import Evento, Respaldo


@admin.register(Respaldo)
class RespaldoAdmin(admin.ModelAdmin):
    list_display = ('tienda', 'nombre', 'tamano_mb', 'recibido')
    list_filter = ('tienda',)
    readonly_fields = [f.name for f in Respaldo._meta.fields]

    @admin.display(description='Tamaño (MB)')
    def tamano_mb(self, r):
        return f'{r.tamano / 1024 / 1024:.1f}'

    def has_add_permission(self, request):
        return False


@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    """Para soporte: ver qué ha mandado una tienda y si algo falló al procesarse."""
    list_display = ('creado_local', 'tienda', 'tipo', 'entidad_id', 'con_error')
    list_filter = ('tipo', 'tienda')
    search_fields = ('entidad_id',)
    readonly_fields = [f.name for f in Evento._meta.fields]

    @admin.display(boolean=True, description='Error')
    def con_error(self, e):
        return bool(e.error)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
