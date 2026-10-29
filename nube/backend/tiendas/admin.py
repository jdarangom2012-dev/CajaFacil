"""
Panel interno de NautilusTech (/nautilus/): dar de alta tiendas, registrar pagos y crear usuarios del dueño.
"""
from django import forms
from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.html import format_html

from .models import Acceso, Licencia, Pago, Tienda

User = get_user_model()


class FormTienda(forms.ModelForm):
    licencia_texto = forms.CharField(
        label='Licencia', required=False, widget=forms.Textarea(attrs={'rows': 4}),
        help_text='Pega el texto que entrega generar_licencia.py. Al crear la tienda es obligatorio; '
                  'después, pega aquí una licencia nueva solo si la cambiaste (cambio de PC, plan, etc.).')
    meses_gratis = forms.IntegerField(label='Meses gratis de nube', required=False, min_value=0, initial=0,
                                      help_text='Promoción de bienvenida (Black Friday: 3).')
    dueno_usuario = forms.CharField(label='Usuario del dueño para el panel', required=False,
                                    help_text='Con este usuario entra a cajafacil.app desde el celular.')
    dueno_clave = forms.CharField(label='Clave del dueño', required=False, widget=forms.PasswordInput(render_value=False),
                                  help_text='Mínimo 6 caracteres. Déjalo vacío para no cambiarla.')
    dueno_nombre = forms.CharField(label='Nombre del dueño', required=False)

    class Meta:
        model = Tienda
        fields = ('nombre', 'nit', 'telefono', 'ciudad', 'vendedor', 'pagado_hasta', 'activa', 'notas')

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        for nombre in ('licencia_texto', 'meses_gratis', 'dueno_usuario', 'dueno_clave', 'dueno_nombre'):
            if nombre in self.fields:
                self.fields[nombre].widget.attrs.setdefault('class', 'form-control')
        nuevo = not self.instance.pk
        self.fields['nombre'].required = False
        if nuevo:
            self.fields['licencia_texto'].required = True
            self.fields['meses_gratis'].initial = 3
        else:
            self.fields.pop('meses_gratis')

    def clean_licencia_texto(self):
        texto = self.cleaned_data.get('licencia_texto', '').strip()
        if texto:
            from .licencias import decodificar
            try:
                lic = decodificar(texto)
            except ValueError as e:
                raise forms.ValidationError(str(e))
            lid = lic['datos']['licencia_id']
            if self.instance.pk and lid != self.instance.licencia_id:
                raise forms.ValidationError(f'Esta licencia es de {lid}, no de esta tienda ({self.instance.licencia_id}).')
            if not self.instance.pk and Tienda.objects.filter(licencia_id=lid).exists():
                raise forms.ValidationError(f'Ya hay una tienda con la licencia {lid}. Búscala y edítala.')
            self._lic = lic
        return texto

    def clean(self):
        c = super().clean()
        lic = getattr(self, '_lic', None)
        if lic and not c.get('nombre'):
            c['nombre'] = lic['datos'].get('cliente') or lic['datos']['licencia_id']
        if lic and not c.get('nit'):
            c['nit'] = lic['datos'].get('nit') or ''
        if not c.get('nombre') and not self.errors:
            self.add_error('nombre', 'Escribe el nombre de la tienda.')
        usuario, clave = (c.get('dueno_usuario') or '').strip(), c.get('dueno_clave') or ''
        if clave and len(clave) < 6:
            self.add_error('dueno_clave', 'La clave debe tener mínimo 6 caracteres.')
        if usuario and clave == '' and not User.objects.filter(username=usuario).exists():
            self.add_error('dueno_clave', 'Para un usuario nuevo escribe una clave.')
        return c


class LicenciaInline(admin.TabularInline):
    model = Licencia
    extra = 0
    fields = ('resumen', 'creada')
    readonly_fields = ('resumen', 'creada')
    can_delete = False
    show_change_link = False

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description='Licencia')
    def resumen(self, obj):
        return str(obj)


class AccesoInline(admin.TabularInline):
    model = Acceso
    extra = 0
    autocomplete_fields = ('usuario',)


class PagoInline(admin.TabularInline):
    model = Pago
    extra = 0
    fields = ('fecha', 'meses', 'valor', 'concepto', 'pagado_hasta_despues')
    readonly_fields = ('pagado_hasta_despues',)
    can_delete = False

    def has_change_permission(self, request, obj=None):
        return False


def _accion_pago(meses, valor, concepto):
    def accion(modeladmin, request, queryset):
        for t in queryset:
            Pago.objects.create(tienda=t, meses=meses, valor=valor, concepto=concepto)
        modeladmin.message_user(request, f'{queryset.count()} tienda(s): {concepto} registrado.', messages.SUCCESS)
    accion.short_description = f'Registrar: {concepto}'
    accion.__name__ = f'pago_{meses}_{valor}'
    return accion


@admin.register(Tienda)
class TiendaAdmin(admin.ModelAdmin):
    form = FormTienda
    list_display = ('nombre', 'licencia_id', 'estado_nube', 'pagado_hasta', 'conexion', 'version_app', 'vendedor')
    list_filter = ('activa', 'vendedor', 'ciudad')
    search_fields = ('nombre', 'nit', 'licencia_id', 'equipo_id', 'telefono')
    readonly_fields = ('licencia_id', 'equipo_id', 'instalacion_id', 'creada', 'ultima_conexion',
                       'ultima_sincronizacion', 'ultimo_respaldo', 'version_app')
    inlines = [PagoInline, AccesoInline, LicenciaInline]
    actions = [
        _accion_pago(1, 25000, '1 mes de nube ($25.000)'),
        _accion_pago(12, 300000, '1 año de nube ($300.000)'),
        _accion_pago(3, 0, '3 meses gratis (promoción)'),
    ]

    def get_inlines(self, request, obj):
        return self.inlines if obj else []

    def get_fieldsets(self, request, obj=None):
        dueno = ('Usuario del dueño (panel del celular)', {'fields': ('dueno_nombre', 'dueno_usuario', 'dueno_clave')})
        if obj is None:
            return [
                ('Licencia', {'fields': ('licencia_texto', 'meses_gratis')}),
                ('Datos de la tienda (si los dejas vacíos se toman de la licencia)',
                 {'fields': ('nombre', 'nit', 'telefono', 'ciudad', 'vendedor', 'notas')}),
                dueno,
            ]
        return [
            (None, {'fields': ('nombre', 'nit', 'telefono', 'ciudad', 'vendedor', 'activa', 'notas')}),
            ('Suscripción a la nube', {'fields': ('pagado_hasta',),
                                       'description': 'Para cobrar, usa “Pagos” abajo o las acciones de la lista: '
                                                      'así queda el registro y la fecha se corre sola.'}),
            dueno,
            ('Licencia y equipo', {'fields': ('licencia_texto', 'licencia_id', 'equipo_id', 'instalacion_id')}),
            ('Actividad', {'fields': ('creada', 'ultima_conexion', 'ultima_sincronizacion', 'ultimo_respaldo', 'version_app')}),
        ]

    @admin.display(description='Nube')
    def estado_nube(self, t):
        if not t.activa:
            return format_html('<b style="color:#888">Suspendida</b>')
        if t.suscripcion_vigente:
            if t.en_gracia:
                return format_html('<b style="color:#DC6803">En gracia</b>')
            d = t.dias_restantes
            if d is not None and d <= 7:
                return format_html('<b style="color:#DC6803">Vence en {} días</b>', d)
            return format_html('<b style="color:#039855">Activa</b>')
        return format_html('<b style="color:#D92D20">Vencida</b>')

    @admin.display(description='Última conexión', ordering='ultima_conexion')
    def conexion(self, t):
        if not t.ultima_conexion:
            return 'Nunca'
        horas = (timezone.now() - t.ultima_conexion).total_seconds() / 3600
        if horas > 24:
            return format_html('<span style="color:#D92D20">hace {} días</span>', int(horas // 24))
        return timezone.localtime(t.ultima_conexion).strftime('%d/%m %H:%M')

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        lic = getattr(form, '_lic', None)
        if not change:
            d = lic['datos']
            obj.licencia_id = d['licencia_id']
            obj.equipo_id = d['equipo_id']
            obj.nombre = obj.nombre or d.get('cliente') or d['licencia_id']
            obj.nit = obj.nit or d.get('nit') or ''
        super().save_model(request, obj, form, change)
        if lic:
            Licencia.desde_texto(form.cleaned_data['licencia_texto'], tienda=obj)
        meses = form.cleaned_data.get('meses_gratis') or 0
        if not change and meses:
            Pago.objects.create(tienda=obj, meses=meses, valor=0, concepto=f'{meses} meses gratis de bienvenida')
        usuario = (form.cleaned_data.get('dueno_usuario') or '').strip()
        if usuario:
            u, creado = User.objects.get_or_create(username=usuario)
            if form.cleaned_data.get('dueno_nombre'):
                u.first_name = form.cleaned_data['dueno_nombre'][:150]
            if form.cleaned_data.get('dueno_clave'):
                u.set_password(form.cleaned_data['dueno_clave'])
            u.save()
            Acceso.objects.get_or_create(usuario=u, tienda=obj)
            self.message_user(request, f'Usuario «{usuario}» {"creado" if creado else "actualizado"} con acceso a {obj}.')


@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'tienda', 'meses', 'valor', 'concepto', 'pagado_hasta_despues')
    list_filter = ('fecha',)
    search_fields = ('tienda__nombre', 'concepto')
    autocomplete_fields = ('tienda',)
    readonly_fields = ('pagado_hasta_antes', 'pagado_hasta_despues')

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Acceso)
class AccesoAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'tienda', 'creado')
    search_fields = ('usuario__username', 'tienda__nombre')
    autocomplete_fields = ('usuario', 'tienda')
