"""
Proveedor simulado: no se comunica con la DIAN. Sirve para probar todo el flujo (numeración,
tiquete con CUDE y QR, notas de ajuste, cola sin internet) mientras se escoge el proveedor real.
Los documentos simulados NO tienen validez fiscal.
"""
import hashlib
import os

from .base import ErrorTemporal, Proveedor, Resultado

URL_QR = 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey='


class Simulado(Proveedor):
    codigo = 'SIMULADO'
    nombre = 'Simulado (pruebas internas)'
    descripcion = 'No envía nada a la DIAN. Úselo para probar el módulo. Los documentos no tienen validez fiscal.'
    campos = []

    def emitir(self, documento, timeout=15):
        if os.environ.get('CAJAFACIL_FE_SIMULAR_SIN_INTERNET'):
            raise ErrorTemporal('Sin conexión con el proveedor (simulado).')
        if not documento['emisor']['nit']:
            return Resultado(False, mensaje='El NIT del negocio está vacío (Configuración → Negocio).')
        base = '|'.join(str(x) for x in (
            documento['numero_completo'], documento['fecha'], documento['totales']['total'],
            documento['emisor']['nit'], documento['adquirente']['numero'], documento['tipo']))
        cude = hashlib.sha384(base.encode()).hexdigest()
        return Resultado(True, cude=cude, qr=URL_QR + cude, mensaje='Documento simulado aceptado (sin validez fiscal).',
                         respuesta={'simulado': True})

    def probar(self, timeout=10):
        return 'Proveedor simulado listo. Recuerde: no envía documentos reales a la DIAN.'
