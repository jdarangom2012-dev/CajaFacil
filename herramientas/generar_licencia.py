"""
Generador de licencias de CajaFacil — USO INTERNO DE NAUTILUSTECH.

La llave privada (claves/nautilus_licencias_PRIVADA.pem) NUNCA se entrega con la app ni se sube a GitHub.
La app solo trae la llave pública y con ella verifica la firma.

Ejemplos:
  # Licencia básica perpetua (100% local) para un equipo
  python generar_licencia.py --cliente "Tienda El Gordo" --nit 71234567 --equipo 0C9B-534B-8142-33CA

  # Plan nube pagado hasta el 30/11/2026, hasta 2 cajas
  python generar_licencia.py --cliente "Tienda El Gordo" --equipo 0C9B-534B-8142-33CA --plan NUBE --nube-hasta 2026-11-30 --cajas 2

  # Plan nube SIN fecha (recomendado): el pago mensual se registra en el panel de la nube, no aquí
  python generar_licencia.py --cliente "Tienda El Gordo" --equipo 0C9B-534B-8142-33CA --plan NUBE
  #   → luego pegar el texto en cajafacil.app/nautilus/ → Tiendas → Agregar

  # Pasar un cliente BÁSICO a NUBE: mismo --id, --plan NUBE (la app la descarga sola si ya está en la nube,
  # o el cliente la pega en Configuración → Licencia y nube)
  # Renovar el mes de nube a la antigua (fecha en la licencia): mismo --id, nueva --nube-hasta
  python generar_licencia.py --id CF-20261011-AB12 --cliente "Tienda El Gordo" --equipo ... --plan NUBE --nube-hasta 2026-12-31
  # Con facturación electrónica (documento POS DIAN):
  python generar_licencia.py --cliente "..." --equipo ... --fe --fe-hasta 2027-10-17

  # Generar un par de llaves nuevo (solo una vez; luego actualizar LLAVE_PUBLICA_B64 en backend/core/licencia.py)
  python generar_licencia.py --nuevas-llaves

La salida es un texto en base64 que el cliente pega en Configuración → Licencia y nube.
"""
import argparse
import base64
import json
import secrets
import sys
from datetime import date
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

AQUI = Path(__file__).resolve().parent
LLAVE = AQUI / 'claves' / 'nautilus_licencias_PRIVADA.pem'


def canonico(datos: dict) -> bytes:
    return json.dumps(datos, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def nuevas_llaves():
    if LLAVE.exists():
        sys.exit(f'Ya existe {LLAVE}. Muévela antes de generar otra (las licencias emitidas dejarían de servir).')
    k = Ed25519PrivateKey.generate()
    LLAVE.parent.mkdir(exist_ok=True)
    LLAVE.write_bytes(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                      serialization.NoEncryption()))
    pub = k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    print('Llave privada guardada en', LLAVE)
    print('LLAVE_PUBLICA_B64 =', base64.b64encode(pub).decode())


def firmar(datos: dict) -> str:
    if not LLAVE.exists():
        sys.exit(f'No se encontró la llave privada en {LLAVE}')
    k = serialization.load_pem_private_key(LLAVE.read_bytes(), password=None)
    lic = {'datos': datos, 'firma': base64.b64encode(k.sign(canonico(datos))).decode()}
    return base64.b64encode(json.dumps(lic, ensure_ascii=False).encode('utf-8')).decode()


REGISTRO = AQUI / 'claves' / 'registro_licencias.csv'


def registrar(datos: dict):
    """Lleva el registro de todas las licencias emitidas (quién, qué plan, hasta cuándo)."""
    import csv
    nuevo = not REGISTRO.exists()
    with open(REGISTRO, 'a', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f, delimiter=';')
        if nuevo:
            w.writerow(['fecha_emision', 'licencia_id', 'cliente', 'nit', 'equipo_id', 'plan', 'vence',
                        'nube_hasta', 'max_cajas', 'facturacion'])
        w.writerow([datos['emitida'], datos['licencia_id'], datos['cliente'], datos['nit'], datos['equipo_id'],
                    datos['plan'], datos['vence'] or 'perpetua', datos['nube_hasta'] or '', datos['max_cajas'],
                    ('SI hasta ' + (datos.get('fe_hasta') or 'sin vencimiento')) if datos.get('facturacion') else ''])


def listar():
    if not REGISTRO.exists():
        print('Aún no se han emitido licencias.')
        return
    print(REGISTRO.read_text(encoding='utf-8-sig'))


def main():
    p = argparse.ArgumentParser(description='Genera licencias firmadas de CajaFacil')
    p.add_argument('--nuevas-llaves', action='store_true')
    p.add_argument('--listar', action='store_true', help='Muestra el registro de licencias emitidas')
    p.add_argument('--id', help='ID de licencia (para renovar). Si no se da, se genera.')
    p.add_argument('--cliente')
    p.add_argument('--nit', default='')
    p.add_argument('--equipo', help='Código del equipo que muestra la app (XXXX-XXXX-XXXX-XXXX)')
    p.add_argument('--plan', choices=['BASICO', 'NUBE'], default='BASICO')
    p.add_argument('--vence', help='Fecha de vencimiento de la licencia (AAAA-MM-DD). Vacío = perpetua')
    p.add_argument('--nube-hasta', help='Hasta cuándo está pagado el plan nube (AAAA-MM-DD)')
    p.add_argument('--cajas', type=int, default=1)
    p.add_argument('--fe', action='store_true', help='Incluye el módulo de facturación electrónica')
    p.add_argument('--fe-hasta', help='Hasta cuándo está pagado el módulo de facturación (AAAA-MM-DD). Vacío = sin vencimiento')
    p.add_argument('--salida', help='Guardar también en un archivo .txt')
    a = p.parse_args()

    if a.nuevas_llaves:
        return nuevas_llaves()
    if a.listar:
        return listar()
    if not a.cliente or not a.equipo:
        p.error('--cliente y --equipo son obligatorios')
    if a.plan == 'NUBE' and not a.nube_hasta:
        # El cobro mensual/anual de la nube se controla en el servidor (cajafacil.app/nautilus):
        # la licencia queda con el plan NUBE abierto y no hay que volver a firmarla cada mes.
        a.nube_hasta = '2099-12-31'

    datos = {
        'licencia_id': a.id or f'CF-{date.today():%Y%m%d}-{secrets.token_hex(2).upper()}',
        'cliente': a.cliente,
        'nit': a.nit,
        'equipo_id': a.equipo.strip().upper(),
        'plan': a.plan,
        'emitida': date.today().isoformat(),
        'vence': a.vence,
        'nube_hasta': a.nube_hasta,
        'max_cajas': a.cajas,
    }
    if a.fe:
        datos['facturacion'] = True
        datos['fe_hasta'] = a.fe_hasta
    texto = firmar(datos)
    registrar(datos)
    print(json.dumps(datos, indent=2, ensure_ascii=False))
    print('\n--- Texto de la licencia (enviar al cliente) ---\n')
    print(texto)
    if a.salida:
        Path(a.salida).write_text(texto, encoding='utf-8')
        print('\nGuardada en', a.salida)


if __name__ == '__main__':
    main()
