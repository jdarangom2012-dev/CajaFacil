"""
Configuración Django de CajaFacil (instalación local).
Los valores de máquina se leen de cajafacil.ini (ver rutas.py).
Variables de entorno CAJAFACIL_DB_* tienen prioridad (útil en desarrollo y pruebas).
"""
import os
from datetime import timedelta
from pathlib import Path

from . import rutas

BASE_DIR = Path(__file__).resolve().parent.parent
CFG = rutas.cargar_config()

VERSION = '1.0.0'

SECRET_KEY = os.environ.get('CAJAFACIL_SECRET_KEY') or CFG['seguridad']['secret_key']
DEBUG = os.environ.get('CAJAFACIL_DEBUG', '0') == '1'

# La app corre en la red local; en multicaja otras cajas entran por la IP del PC principal.
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'core',
    'usuarios',
    'catalogo',
    'ventas',
    'creditos',
    'auditoria',
    'reportes',
    'facturacion',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.TerminalMiddleware',
]

ROOT_URLCONF = 'cajafacil.urls'

# El frontend compilado (Vite) se sirve desde aquí
FRONTEND_DIST = Path(os.environ.get('CAJAFACIL_FRONTEND', rutas.RECURSOS_DIR / 'frontend_dist'))

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [FRONTEND_DIST],
        'APP_DIRS': True,
        'OPTIONS': {'context_processors': ['django.template.context_processors.request']},
    },
]

WSGI_APPLICATION = 'cajafacil.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('CAJAFACIL_DB_NAME') or CFG['base_datos']['nombre'],
        'USER': os.environ.get('CAJAFACIL_DB_USER') or CFG['base_datos']['usuario'],
        'PASSWORD': os.environ.get('CAJAFACIL_DB_PASSWORD', CFG['base_datos']['clave']),
        'HOST': os.environ.get('CAJAFACIL_DB_HOST') or CFG['base_datos']['host'],
        'PORT': os.environ.get('CAJAFACIL_DB_PORT') or CFG['base_datos']['puerto'],
        'CONN_MAX_AGE': 60,
        'OPTIONS': {'connect_timeout': 5},
    }
}

AUTH_USER_MODEL = 'usuarios.Usuario'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 4}},
]

LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = rutas.HOME / 'static'
STATICFILES_DIRS = [d for d in [FRONTEND_DIST / 'assets'] if d.exists()]
WHITENOISE_ROOT = FRONTEND_DIST if FRONTEND_DIST.exists() else None
WHITENOISE_USE_FINDERS = True
WHITENOISE_AUTOREFRESH = DEBUG or os.environ.get('CAJAFACIL_DESARROLLO') == '1'  # ve el frontend recién compilado sin reiniciar

MEDIA_URL = '/imagenes/'
MEDIA_ROOT = rutas.MEDIA_DIR

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'core.paginacion.Paginacion',
    'PAGE_SIZE': 50,
    'COERCE_DECIMAL_TO_STRING': False,
    'EXCEPTION_HANDLER': 'core.errores.manejador_errores',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'USER_ID_CLAIM': 'user_id',
}

# Rutas de la instalación
CAJAFACIL_HOME = rutas.HOME
RESPALDOS_DIR = rutas.RESPALDOS_DIR
LICENCIA_FILE = rutas.LICENCIA_FILE
PG_BIN = os.environ.get('CAJAFACIL_PG_BIN') or CFG['base_datos'].get('pg_bin', '')
NUBE_URL = os.environ.get('CAJAFACIL_NUBE_URL') or CFG['nube']['url']
MODO_SERVIDOR = CFG['servidor']['modo']

# Días de prueba sin licencia
DIAS_PRUEBA = 15

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'simple': {'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'}},
    'handlers': {
        'consola': {'class': 'logging.StreamHandler', 'formatter': 'simple'},
    },
    'root': {'handlers': ['consola'], 'level': 'INFO'},
}

if not os.environ.get('CAJAFACIL_SIN_LOG_ARCHIVO'):
    try:
        rutas.asegurar_carpetas()
        # Si el archivo existe pero no se puede escribir (lo creó el servicio de Windows y este
        # proceso corre con otro usuario), se sigue solo con la consola en vez de fallar.
        with open(rutas.LOGS_DIR / 'cajafacil.log', 'a', encoding='utf-8'):
            pass
        LOGGING['handlers']['archivo'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(rutas.LOGS_DIR / 'cajafacil.log'),
            'maxBytes': 5 * 1024 * 1024,
            'backupCount': 5,
            'encoding': 'utf-8',
            'formatter': 'simple',
        }
        LOGGING['root']['handlers'].append('archivo')
    except OSError:
        pass
