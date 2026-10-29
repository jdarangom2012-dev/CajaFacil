from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import OperationalError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ErrorNegocio(Exception):
    """Error de regla de negocio con mensaje legible para el tendero."""

    def __init__(self, mensaje, codigo=status.HTTP_400_BAD_REQUEST):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo


def _primer_mensaje(detalle):
    if isinstance(detalle, dict):
        for v in detalle.values():
            m = _primer_mensaje(v)
            if m:
                return m
    elif isinstance(detalle, (list, tuple)):
        for v in detalle:
            m = _primer_mensaje(v)
            if m:
                return m
    elif detalle:
        return str(detalle)
    return None


def manejador_errores(exc, context):
    if isinstance(exc, ErrorNegocio):
        return Response({'error': exc.mensaje}, status=exc.codigo)
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(exc.messages)
    if isinstance(exc, OperationalError):
        return Response({'error': 'No hay conexión con la base de datos. Verifique el servicio CajaFacil-DB.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    resp = exception_handler(exc, context)
    if resp is not None and isinstance(resp.data, (dict, list)) and 'error' not in (resp.data if isinstance(resp.data, dict) else {}):
        mensaje = _primer_mensaje(resp.data)
        data = {'error': mensaje or 'Solicitud inválida.'}
        if isinstance(resp.data, dict):
            data['detalle'] = resp.data
        resp.data = data
    return resp
