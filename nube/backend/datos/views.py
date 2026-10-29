"""API que llama CajaFácil desde cada tienda (autenticada con la licencia del equipo)."""
import logging

import requests
from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from tiendas.autenticacion import AutenticacionEquipo, AutenticacionEquipoSinToken, EsEquipo

from . import services

log = logging.getLogger(__name__)


def estado_suscripcion(t):
    return {
        'vigente': t.suscripcion_vigente, 'en_gracia': t.en_gracia,
        'pagado_hasta': t.pagado_hasta.isoformat() if t.pagado_hasta else None,
        'dias_restantes': t.dias_restantes, 'panel': settings.URL_PANEL,
    }


def _vencida(t):
    return Response({'error': 'La suscripción de CajaFácil Nube está vencida. Los datos quedan guardados en la '
                              'tienda y se envían solos cuando se renueve.',
                     'suscripcion': estado_suscripcion(t)}, status=402)


class VistaEquipo(APIView):
    authentication_classes = [AutenticacionEquipo]
    permission_classes = [EsEquipo]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'equipo'


class EventosView(VistaEquipo):
    def post(self, request):
        t = request.user.tienda
        if not t.suscripcion_vigente:
            return _vencida(t)
        inst = str(request.data.get('instalacion_id') or '')[:40]
        if inst and inst != t.instalacion_id:
            type(t).objects.filter(pk=t.pk).update(instalacion_id=inst)
        recibidos = services.recibir(t, request.data.get('eventos') or [])
        return Response({'recibidos': recibidos, 'suscripcion': estado_suscripcion(t)})


class RespaldoView(VistaEquipo):
    def post(self, request):
        t = request.user.tienda
        if not t.suscripcion_vigente:
            return _vencida(t)
        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'error': 'Falta el archivo.'}, status=400)
        r = services.guardar_respaldo(t, archivo)
        return Response({'id': str(r.id), 'tamano': r.tamano, 'sha256': r.sha256})


class EstadoView(VistaEquipo):
    def get(self, request):
        return Response({'tienda': request.user.tienda.nombre, 'suscripcion': estado_suscripcion(request.user.tienda)})


class LicenciaView(VistaEquipo):
    """Devuelve la licencia más reciente que NautilusTech cargó para esta tienda."""
    authentication_classes = [AutenticacionEquipoSinToken]

    def get(self, request, licencia_id):
        t = request.user.tienda
        if licencia_id != t.licencia_id:
            return Response({'error': 'Licencia no encontrada.'}, status=404)
        lic = t.licencia_vigente()
        if lic is None:
            return Response({'error': 'Sin licencia.'}, status=404)
        return Response(lic.como_json())


class VersionView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'version': settings.VERSION_PUBLICADA, 'url': settings.URL_DESCARGA})


PROMPT = (
    'Eres el asistente de CajaFácil, el programa de caja de una tienda de barrio en Colombia. '
    'Responde en español sencillo, corto y práctico, como le hablarías al tendero. Usa pesos colombianos '
    'con puntos de miles (ej: $1.250.000). Usa SOLO los datos que te doy; si no alcanzan, dilo. '
    'No inventes cifras.'
)


class AsistenteView(VistaEquipo):
    def post(self, request):
        t = request.user.tienda
        if not t.suscripcion_vigente:
            return _vencida(t)
        if not settings.OPENAI_API_KEY:
            return Response({'error': 'El asistente con IA estará disponible muy pronto.'}, status=503)
        pregunta = str(request.data.get('pregunta') or '')[:500].strip()
        if not pregunta:
            return Response({'error': 'Escribe tu pregunta.'}, status=400)
        import json
        contexto = json.dumps(request.data.get('contexto') or {}, ensure_ascii=False, default=str)[:12000]
        try:
            r = requests.post('https://api.openai.com/v1/chat/completions', timeout=35, headers={
                'Authorization': f'Bearer {settings.OPENAI_API_KEY}'}, json={
                'model': settings.OPENAI_MODELO, 'temperature': 0.2, 'max_tokens': 500,
                'messages': [{'role': 'system', 'content': PROMPT},
                             {'role': 'user', 'content': f'Datos de la tienda:\n{contexto}\n\nPregunta: {pregunta}'}]})
            r.raise_for_status()
            texto = r.json()['choices'][0]['message']['content']
        except Exception as e:
            log.warning('Asistente IA falló para %s: %s', t, e)
            return Response({'error': 'El asistente no respondió. Intenta de nuevo en un momento.'}, status=503)
        return Response({'respuesta': texto})
