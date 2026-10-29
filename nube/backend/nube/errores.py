from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class ErrorNegocio(APIException):
    status_code = 400
    default_detail = 'No se pudo completar la operación.'

    def __init__(self, mensaje, status=400):
        super().__init__(mensaje)
        self.status_code = status


def manejador(exc, context):
    """Todas las respuestas de error traen {"error": "<mensaje en español>"}."""
    r = exception_handler(exc, context)
    if r is not None and isinstance(r.data, dict) and 'detail' in r.data and 'error' not in r.data:
        r.data = {'error': str(r.data['detail']), **{k: v for k, v in r.data.items() if k != 'detail'}}
    return r
