"""
Conectores con proveedores tecnológicos de facturación electrónica.

Para agregar un proveedor real (MATIAS API, Plemsi, Factus…):
  1. Crear un archivo (ej. matias.py) con una clase que herede de base.Proveedor
     e implemente emitir() y probar().
  2. Registrarla en PROVEEDORES abajo.
  3. Listo: aparece en Configuración → Facturación electrónica. El resto de CajaFacil no cambia.

emitir() recibe el documento ya armado por CajaFacil (ver services.armar_documento): emisor,
adquirente, resolución, líneas con IVA, totales y pagos. El conector solo traduce ese formato al
JSON del proveedor y devuelve un Resultado.
"""
from .base import ErrorTemporal, Proveedor, Resultado
from .simulado import Simulado

PROVEEDORES = {
    Simulado.codigo: Simulado,
}


def obtener(codigo: str, conf) -> Proveedor:
    clase = PROVEEDORES.get(codigo)
    if not clase:
        raise ValueError(f'Proveedor de facturación "{codigo}" no está disponible en esta versión.')
    return clase(conf)


def opciones():
    return [{'codigo': c.codigo, 'nombre': c.nombre, 'descripcion': c.descripcion, 'campos': c.campos}
            for c in PROVEEDORES.values()]


__all__ = ['ErrorTemporal', 'Proveedor', 'Resultado', 'PROVEEDORES', 'obtener', 'opciones']
