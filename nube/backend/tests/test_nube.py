import base64
import hashlib
import io
import json
import shutil
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from datos.models import Credito, Producto, Respaldo, Venta
from tiendas.models import Acceso, Licencia, Pago, Tienda

LLAVE = Ed25519PrivateKey.generate()
PUB = base64.b64encode(LLAVE.public_key().public_bytes(serialization.Encoding.Raw,
                                                       serialization.PublicFormat.Raw)).decode()
TMP = tempfile.mkdtemp()


def firmar(datos):
    can = json.dumps(datos, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
    lic = {'datos': datos, 'firma': base64.b64encode(LLAVE.sign(can)).decode()}
    return base64.b64encode(json.dumps(lic).encode()).decode(), lic


def licencia(lid='CF-TEST-0001', equipo='AAAA-BBBB-CCCC-DDDD', plan='NUBE', cliente='Tienda La Esquina'):
    return firmar({'licencia_id': lid, 'cliente': cliente, 'nit': '900', 'equipo_id': equipo, 'plan': plan,
                   'emitida': '2026-10-28', 'vence': None, 'nube_hasta': '2099-12-31', 'max_cajas': 1})


def token(lic):
    return hashlib.sha256(('cajafacil-nube|' + lic['firma']).encode()).hexdigest()


def ev(tipo, entidad, payload, creado=None, uid=None):
    return {'id': str(uid or uuid.uuid4()), 'tipo': tipo, 'entidad_id': str(entidad),
            'creado': (creado or timezone.now()).isoformat(), 'payload': payload}


@override_settings(LLAVE_PUBLICA_B64=PUB, RESPALDOS_DIR=Path(TMP) / 'resp')
class Base(TestCase):
    def setUp(self):
        self.texto, self.lic = licencia()
        call_command('alta_tienda', licencia=self.texto, usuario='dueno', clave='clave123', meses_gratis=3,
                     stdout=io.StringIO())
        self.t = Tienda.objects.get(licencia_id='CF-TEST-0001')
        self.equipo = APIClient()
        self.equipo.credentials(HTTP_X_CAJAFACIL_LICENCIA='CF-TEST-0001', HTTP_X_CAJAFACIL_EQUIPO='AAAA-BBBB-CCCC-DDDD',
                                HTTP_X_CAJAFACIL_TOKEN=token(self.lic), HTTP_USER_AGENT='CajaFacil/1.2.0')

    def enviar(self, eventos, cliente=None):
        return (cliente or self.equipo).post('/api/sync/eventos', {'instalacion_id': 'inst-1', 'eventos': eventos},
                                             format='json')

    def panel(self, usuario='dueno', clave='clave123'):
        c = APIClient()
        r = c.post('/api/panel/login/', {'usuario': usuario, 'clave': clave}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        c.credentials(HTTP_AUTHORIZATION='Bearer ' + r.data['access'])
        return c


class AltaYAutenticacion(Base):
    def test_alta_con_meses_gratis(self):
        self.assertEqual(self.t.nombre, 'Tienda La Esquina')
        self.assertTrue(self.t.suscripcion_vigente)
        self.assertEqual(Pago.objects.get(tienda=self.t).valor, 0)
        self.assertGreater(self.t.dias_restantes, 85)
        self.assertTrue(Acceso.objects.filter(tienda=self.t, usuario__username='dueno').exists())

    def test_licencia_con_firma_falsa_se_rechaza(self):
        otra = Ed25519PrivateKey.generate()
        datos = {'licencia_id': 'CF-X', 'equipo_id': 'X'}
        can = json.dumps(datos, sort_keys=True, separators=(',', ':')).encode()
        falsa = base64.b64encode(json.dumps({'datos': datos, 'firma': base64.b64encode(otra.sign(can)).decode()}).encode()).decode()
        with self.assertRaises(ValueError):
            Licencia.desde_texto(falsa)

    def test_token_o_equipo_incorrecto(self):
        c = APIClient()
        c.credentials(HTTP_X_CAJAFACIL_LICENCIA='CF-TEST-0001', HTTP_X_CAJAFACIL_EQUIPO='AAAA-BBBB-CCCC-DDDD',
                      HTTP_X_CAJAFACIL_TOKEN='0' * 64)
        self.assertEqual(self.enviar([], c).status_code, 401)
        c.credentials(HTTP_X_CAJAFACIL_LICENCIA='CF-TEST-0001', HTTP_X_CAJAFACIL_EQUIPO='OTRO-PC',
                      HTTP_X_CAJAFACIL_TOKEN=token(self.lic))
        self.assertEqual(self.enviar([], c).status_code, 401)
        c.credentials(HTTP_X_CAJAFACIL_LICENCIA='NO-EXISTE', HTTP_X_CAJAFACIL_EQUIPO='x', HTTP_X_CAJAFACIL_TOKEN='x')
        self.assertEqual(self.enviar([], c).status_code, 401)
        self.assertEqual(APIClient().post('/api/sync/eventos', {}, format='json').status_code, 401)

    def test_suscripcion_vencida_402_y_luego_renovada(self):
        self.t.pagado_hasta = timezone.localdate() - timedelta(days=10)
        self.t.save()
        r = self.enviar([ev('alerta', uuid.uuid4(), {'accion': 'ANULAR', 'detalle': 'x', 'fecha_hora': timezone.now().isoformat()})])
        self.assertEqual(r.status_code, 402)
        self.assertFalse(r.data['suscripcion']['vigente'])
        c = self.panel()
        self.assertEqual(c.get(f'/api/panel/t/{self.t.id}/inicio/').status_code, 402)
        Pago.objects.create(tienda=self.t, meses=1, valor=25000)
        self.t.refresh_from_db()
        self.assertGreaterEqual(self.t.dias_restantes, 27)
        self.assertEqual(self.enviar([]).status_code, 200)

    def test_descarga_licencia_nueva_al_pasar_de_basico(self):
        # La tienda tiene instalada una BÁSICA (no registrada); NautilusTech carga la de NUBE con el mismo id
        _, basica = licencia(plan='BASICO')
        c = APIClient()
        c.credentials(HTTP_X_CAJAFACIL_LICENCIA='CF-TEST-0001', HTTP_X_CAJAFACIL_EQUIPO='AAAA-BBBB-CCCC-DDDD',
                      HTTP_X_CAJAFACIL_TOKEN=token(basica))
        r = c.get('/api/licencias/CF-TEST-0001', {'equipo_id': 'AAAA-BBBB-CCCC-DDDD'})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data['datos']['plan'], 'NUBE')
        self.assertEqual(self.enviar([], c).status_code, 401)  # pero no puede sincronizar con la básica
        c.credentials(HTTP_X_CAJAFACIL_LICENCIA='CF-TEST-0001', HTTP_X_CAJAFACIL_EQUIPO='OTRO', HTTP_X_CAJAFACIL_TOKEN='')
        self.assertEqual(c.get('/api/licencias/CF-TEST-0001').status_code, 401)

    def test_version_publica(self):
        self.assertEqual(APIClient().get('/api/version').status_code, 200)


class Proyeccion(Base):
    def venta(self, num=1, total=10000, costo=7000, estado='COMPLETADA', vid=None, stock=8, cuando=None):
        vid = vid or uuid.uuid4()
        return vid, ev('venta', vid, {
            'numero': num, 'terminal': 'CAJA-1', 'fecha_hora': (cuando or timezone.now()).isoformat(),
            'usuario': 'Ana', 'cliente': None, 'subtotal': str(total), 'descuento': '0', 'total': str(total),
            'costo_total': str(costo), 'cambio': '0', 'estado': estado, 'motivo_anulacion': '',
            'detalle': [{'producto_id': 'p1', 'nombre': 'Arroz Diana 500g', 'cantidad': '2', 'precio_unit': '5000',
                         'descuento': '0', 'subtotal': str(total), 'stock': str(stock)}],
            'pagos': [{'forma_pago': 'Efectivo', 'tipo': 'EFECTIVO', 'monto': str(total)}]}, creado=cuando)

    def test_idempotente_y_ultimo_gana(self):
        prod = ev('producto', 'p1', {'id': 'p1', 'nombre': 'Arroz Diana 500g', 'categoria': 'Granos',
                                      'precio_costo': '3500', 'precio_venta': '5000', 'stock': '10', 'stock_minimo': '5',
                                      'unidad_medida': 'UND', 'activo': True, 'codigo_barras': '770'},
                  creado=timezone.now() - timedelta(minutes=5))
        vid, v = self.venta()
        r = self.enviar([prod, v])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['recibidos']), 2)
        self.assertEqual(self.enviar([v]).data['recibidos'], [v['id']])  # reenviar no duplica
        self.assertEqual(Venta.objects.count(), 1)
        self.assertEqual(Producto.objects.get(local_id='p1').stock, 8)
        # Anulación posterior
        _, anul = self.venta(vid=vid, estado='ANULADA', stock=10, cuando=timezone.now() + timedelta(minutes=1))
        self.enviar([anul])
        self.assertEqual(Venta.objects.get().estado, 'ANULADA')
        self.assertEqual(Producto.objects.get(local_id='p1').stock, 10)
        # Un evento viejo que llega tarde no pisa el estado nuevo
        _, viejo = self.venta(vid=vid, estado='COMPLETADA', stock=8, cuando=timezone.now() - timedelta(hours=1))
        self.enviar([viejo])
        self.assertEqual(Venta.objects.get().estado, 'ANULADA')
        self.assertEqual(Producto.objects.get(local_id='p1').stock, 10)

    def test_payload_malo_no_tumba_el_lote(self):
        bueno_id, bueno = self.venta()
        malo = ev('venta', 'x', {'numero': 'no-es-numero'})
        r = self.enviar([malo, bueno, {'id': 'basura'}])
        self.assertEqual(len(r.data['recibidos']), 2)
        self.assertTrue(Venta.objects.filter(local_id=str(bueno_id)).exists())

    def test_tiendas_aisladas(self):
        texto2, lic2 = licencia('CF-TEST-0002', 'EEEE-FFFF-0000-1111', cliente='Otra tienda')
        call_command('alta_tienda', licencia=texto2, usuario='otro', clave='clave456', meses_gratis=1, stdout=io.StringIO())
        t2 = Tienda.objects.get(licencia_id='CF-TEST-0002')
        _, v = self.venta(total=99000)
        self.enviar([v])
        c2 = self.panel('otro', 'clave456')
        self.assertEqual(c2.get(f'/api/panel/t/{self.t.id}/inicio/').status_code, 404)
        self.assertEqual(c2.get(f'/api/panel/t/{t2.id}/inicio/').data['ventas']['total'], 0)
        # Un evento con el mismo id desde otra tienda no se cruza
        e2 = APIClient()
        e2.credentials(HTTP_X_CAJAFACIL_LICENCIA='CF-TEST-0002', HTTP_X_CAJAFACIL_EQUIPO='EEEE-FFFF-0000-1111',
                       HTTP_X_CAJAFACIL_TOKEN=token(lic2))
        self.assertEqual(self.enviar([v], e2).data['recibidos'], [])

    def test_panel_completo(self):
        prod = ev('producto', 'p2', {'id': 'p2', 'nombre': 'Aceite 1L', 'stock': '1', 'stock_minimo': '3',
                                      'precio_costo': '8000', 'precio_venta': '10000', 'activo': True})
        _, v1 = self.venta(num=1, total=10000, costo=7000)
        _, v2 = self.venta(num=2, total=5000, costo=3000)
        _, v3 = self.venta(num=3, total=4000, estado='ANULADA')
        cred = ev('credito', 'c1', {'numero': 1, 'cliente_id': 'cl1', 'cliente': 'Doña Marta', 'telefono': '300',
                                     'total': '20000', 'abonado': '5000', 'estado': 'PENDIENTE', 'vence': '2026-01-01',
                                     'creado': timezone.now().isoformat()})
        abono = ev('abono', 'g1', {'cliente_id': 'cl1', 'cliente': 'Doña Marta', 'monto': '5000', 'forma_pago': 'Nequi',
                                    'saldo_nuevo': '15000', 'usuario': 'Ana', 'fecha_hora': timezone.now().isoformat()})
        cierre = ev('cierre_caja', 'k1', {'numero': 7, 'terminal': 'CAJA-1', 'abierta_en': timezone.now().isoformat(),
                                           'cerrada_en': timezone.now().isoformat(), 'usuario': 'Ana',
                                           'resumen': {'total_ventas': 15000, 'efectivo_esperado': 15000, 'num_ventas': 2},
                                           'efectivo_contado': '14000', 'diferencia': '-1000'})
        alerta = ev('alerta', 'a1', {'accion': 'ANULAR', 'usuario': 'Ana', 'detalle': 'Anuló la venta #3',
                                      'terminal': 'CAJA-1', 'fecha_hora': timezone.now().isoformat()})
        mov = ev('movimiento_inventario', 'm1', {'producto_id': 'p2', 'producto': 'Aceite 1L', 'tipo': 'AJUSTE',
                                                  'cantidad': '-1', 'stock_anterior': '1', 'stock_nuevo': '0',
                                                  'fecha_hora': timezone.now().isoformat(), 'usuario': 'Ana'})
        r = self.enviar([prod, v1, v2, v3, cred, abono, cierre, alerta, mov])
        self.assertEqual(len(r.data['recibidos']), 9)
        c = self.panel()
        base = f'/api/panel/t/{self.t.id}'
        ini = c.get(f'{base}/inicio/').data
        self.assertEqual(ini['ventas']['total'], 15000)
        self.assertEqual(ini['ventas']['num_ventas'], 2)
        self.assertEqual(ini['ventas']['utilidad'], 5000)
        self.assertEqual(ini['ventas']['anuladas'], 1)
        self.assertEqual(ini['fiado']['saldo'], 15000)
        self.assertEqual(ini['inventario_bajo'], 1)
        self.assertEqual(ini['alertas_sin_ver'], 1)
        self.assertEqual(ini['ultimo_cierre']['diferencia'], -1000)
        self.assertEqual(ini['formas_pago'][0], {'nombre': 'Efectivo', 'total': 15000})
        self.assertEqual(ini['top_productos'][0]['nombre'], 'Arroz Diana 500g')
        ventas = c.get(f'{base}/ventas/').data
        self.assertEqual(len(ventas['ventas']), 3)
        det = c.get(f"{base}/ventas/{ventas['ventas'][0]['id']}/").data
        self.assertEqual(det['items'][0]['nombre'], 'Arroz Diana 500g')
        f = c.get(f'{base}/fiados/').data
        self.assertEqual(f['clientes'][0]['cliente'], 'Doña Marta')
        self.assertTrue(f['clientes'][0]['vencido'])
        fc = c.get(f'{base}/fiados/cl1/').data
        self.assertEqual(fc['saldo'], 15000)
        self.assertEqual(len(fc['abonos']), 1)
        inv = c.get(f'{base}/inventario/', {'filtro': 'agotado'}).data
        self.assertEqual(inv['productos'][0]['nombre'], 'Aceite 1L')
        self.assertEqual(len(c.get(f'{base}/cierres/').data), 1)
        self.assertEqual(c.post(f'{base}/alertas/').data['marcadas'], 1)
        rep = c.get(f'{base}/reportes/', {'dias': 7}).data
        self.assertEqual(len(rep['por_dia']), 7)
        self.assertEqual(rep['por_dia'][-1]['total'], 15000)

    def test_login_malo(self):
        r = APIClient().post('/api/panel/login/', {'usuario': 'dueno', 'clave': 'mala'}, format='json')
        self.assertEqual(r.status_code, 401)
        self.assertIn('error', r.data)


class Respaldos(Base):
    def tearDown(self):
        shutil.rmtree(Path(TMP) / 'resp', ignore_errors=True)

    @override_settings(RESPALDOS_CONSERVAR=2)
    def test_sube_y_conserva_los_ultimos(self):
        for i in range(3):
            f = SimpleUploadedFile(f'cf_{i}.dump', b'x' * 4096)
            r = self.equipo.post('/api/sync/respaldo', {'archivo': f, 'instalacion_id': 'i'}, format='multipart')
            self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Respaldo.objects.filter(tienda=self.t).count(), 2)
        self.assertEqual(len(list((Path(TMP) / 'resp' / str(self.t.pk)).iterdir())), 2)

    def test_vacio_se_rechaza(self):
        f = SimpleUploadedFile('cf.dump', b'')
        self.assertEqual(self.equipo.post('/api/sync/respaldo', {'archivo': f}, format='multipart').status_code, 400)
