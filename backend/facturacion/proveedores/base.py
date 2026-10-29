from dataclasses import dataclass, field


class ErrorTemporal(Exception):
    """Sin internet, proveedor caído, tiempo agotado… El documento queda pendiente y se reintenta."""


@dataclass
class Resultado:
    aceptado: bool
    cude: str = ''
    qr: str = ''
    mensaje: str = ''
    respuesta: dict = field(default_factory=dict)


class Proveedor:
    codigo = ''
    nombre = ''
    descripcion = ''
    # Campos de credenciales que pide la pantalla de configuración: api_url, api_usuario, api_clave, api_token
    campos = []

    def __init__(self, conf):
        self.conf = conf

    def emitir(self, documento: dict, timeout: float = 15) -> Resultado:
        """Envía el documento a la DIAN a través del proveedor.
        Devuelve Resultado (aceptado o rechazado) o lanza ErrorTemporal si no se pudo comunicar."""
        raise NotImplementedError

    def probar(self, timeout: float = 10) -> str:
        """Verifica credenciales y conexión. Devuelve un mensaje para el usuario o lanza una excepción."""
        raise NotImplementedError
