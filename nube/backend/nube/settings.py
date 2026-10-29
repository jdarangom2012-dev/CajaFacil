"""
CajaFácil Nube — servidor de NautilusTech.

Recibe lo que mandan las tiendas con plan Nube (ventas, cierres, fiados, inventario, alertas y
copias de seguridad) y lo muestra al dueño en un panel web para el celular.

Toda la configuración sale de variables de entorno (ver ejemplo-configuracion.txt).
"""
import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _env(nombre, defecto=''):
    return os.environ.get(nombre, defecto)


DEBUG = _env('NUBE_DEBUG', '0') == '1'
SECRET_KEY = _env('NUBE_SECRET_KEY') or ('solo-desarrollo-no-usar-en-produccion' if DEBUG else '')
if not SECRET_KEY:
    raise RuntimeError('Falta NUBE_SECRET_KEY')

ALLOWED_HOSTS = [h.strip() for h in _env('NUBE_HOSTS', 'cajafacil.app,www.cajafacil.app,cajafacil.nautilustech.app,localhost,127.0.0.1').split(',') if h.strip()]
CSRF_TRUSTED_ORIGINS = [f'https://{h}' for h in ALLOWED_HOSTS if '.' in h and not h[0].isdigit()]
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

INSTALLED_APPS = [
    'jazzmin',  # tema del panel de NautilusTech (/nautilus/); debe ir antes de django.contrib.admin
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'tiendas',
    'datos',
    'panel',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'nube.urls'
FRONTEND_DIR = Path(_env('NUBE_FRONTEND_DIR', str(BASE_DIR / 'frontend_dist')))
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [FRONTEND_DIR],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'nube.wsgi.application'

if _env('NUBE_DB_NAME'):
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': _env('NUBE_DB_NAME'),
        'USER': _env('NUBE_DB_USER', 'cajafacil_nube'),
        'PASSWORD': _env('NUBE_DB_PASSWORD'),
        'HOST': _env('NUBE_DB_HOST', 'localhost'),
        'PORT': _env('NUBE_DB_PORT', '5432'),
        'CONN_MAX_AGE': 60,
    }}
else:  # desarrollo y pruebas
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'nube_dev.sqlite3'}}

AUTH_PASSWORD_VALIDATORS = [{'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
                             'OPTIONS': {'min_length': 6}}]
LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'static_root'
WHITENOISE_ROOT = FRONTEND_DIR if FRONTEND_DIR.exists() else None
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Copias de seguridad que suben las tiendas
RESPALDOS_DIR = Path(_env('NUBE_RESPALDOS_DIR', str(BASE_DIR / 'respaldos')))
RESPALDOS_CONSERVAR = int(_env('NUBE_RESPALDOS_CONSERVAR', '10'))
RESPALDO_MAX_MB = int(_env('NUBE_RESPALDO_MAX_MB', '300'))
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# Licencias: la nube solo VERIFICA firmas (la llave privada nunca vive en el servidor)
LLAVE_PUBLICA_B64 = _env('CAJAFACIL_LLAVE_PUBLICA', 'eTLjA2b9nqQblfzpLbR4A5tR9Kx+LjkKAYWmCkioNqY=')
DIAS_GRACIA = int(_env('NUBE_DIAS_GRACIA', '5'))

# Versión publicada de CajaFácil (la app la consulta para avisar actualizaciones)
VERSION_PUBLICADA = _env('CAJAFACIL_VERSION_PUBLICADA', '')
URL_DESCARGA = _env('CAJAFACIL_URL_DESCARGA', '')

# Asistente con IA (opcional)
OPENAI_API_KEY = _env('OPENAI_API_KEY')
OPENAI_MODELO = _env('OPENAI_MODELO', 'gpt-4o-mini')

SOPORTE_WHATSAPP = _env('NUBE_SOPORTE_WHATSAPP', '573151355693')
URL_PANEL = _env('NUBE_URL_PANEL', 'https://cajafacil.app')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_RENDERER_CLASSES': ('rest_framework.renderers.JSONRenderer',),
    'DEFAULT_THROTTLE_RATES': {'login': '10/min', 'equipo': '120/min'},
    'EXCEPTION_HANDLER': 'nube.errores.manejador',
}
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'UPDATE_LAST_LOGIN': True,
}

# ── Panel de NautilusTech (/nautilus/) con Jazzmin ─────────────────
JAZZMIN_SETTINGS = {
    'site_title': 'CajaFácil Nube',
    'site_header': 'CajaFácil Nube',
    'site_brand': 'CajaFácil Nube',
    'site_logo': 'nube/icono-cajafacil.png',
    'login_logo': 'nube/logo-cajafacil.png',
    'login_logo_dark': 'nube/logo-cajafacil.png',
    'site_logo_classes': 'img-circle',
    'site_icon': 'nube/favicon.png',
    'welcome_sign': 'Administración de tiendas — NautilusTech',
    'copyright': 'NautilusTech S.A.S.',
    'search_model': ['tiendas.Tienda'],
    'user_avatar': None,
    'topmenu_links': [
        {'name': 'Tiendas', 'url': 'admin:tiendas_tienda_changelist'},
        {'name': 'Pagos', 'url': 'admin:tiendas_pago_changelist'},
        {'name': 'Panel del dueño', 'url': '/', 'new_window': True},
        {'name': 'nautilustech.app', 'url': 'https://nautilustech.app/', 'new_window': True},
    ],
    'show_sidebar': True,
    'navigation_expanded': True,
    'hide_models': ['tiendas.licencia'],
    'order_with_respect_to': ['tiendas', 'tiendas.tienda', 'tiendas.pago', 'tiendas.acceso',
                              'datos', 'datos.respaldo', 'datos.evento', 'auth'],
    'icons': {
        'auth': 'fas fa-users-cog',
        'auth.user': 'fas fa-user',
        'auth.Group': 'fas fa-users',
        'tiendas.Tienda': 'fas fa-store',
        'tiendas.Pago': 'fas fa-money-bill-wave',
        'tiendas.Acceso': 'fas fa-key',
        'datos.Respaldo': 'fas fa-cloud-upload-alt',
        'datos.Evento': 'fas fa-stream',
    },
    'default_icon_parents': 'fas fa-folder',
    'default_icon_children': 'fas fa-circle',
    'related_modal_active': True,
    'changeform_format': 'single',
    'custom_css': 'nube/admin.css',
    'show_ui_builder': False,
    'language_chooser': False,
}
JAZZMIN_UI_TWEAKS = {
    'theme': 'flatly',
    'dark_mode_theme': None,
    'navbar': 'navbar-primary navbar-dark',
    'brand_colour': False,
    'accent': 'accent-primary',
    'sidebar': 'sidebar-dark-primary',
    'sidebar_nav_compact_style': False,
    'sidebar_nav_child_indent': True,
    'navbar_small_text': False,
    'button_classes': {'primary': 'btn-primary', 'secondary': 'btn-outline-secondary', 'info': 'btn-info',
                       'warning': 'btn-warning', 'danger': 'btn-danger', 'success': 'btn-success'},
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'consola': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['consola'], 'level': 'INFO'},
}
