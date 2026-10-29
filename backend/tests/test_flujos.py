"""Pruebas de los flujos principales de CajaFacil (equivalentes a PosFácil + mejoras)."""
import base64
import json
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from auditoria.models import Auditoria
from catalogo.models import Categoria, Producto
from core import licencia
from core.models import Configuracion, EventoSync
from creditos.models import Cliente, Credito
from ventas.models import FormaPago, Venta

_tmp = TemporaryDirectory()


@override_settings(LICENCIA_FILE=Path(_tmp.name) / 'licencia.json', RESPALDOS_DIR=Path(_tmp.name) / 'resp',
                   CAJAFACIL_HOME=Path(_tmp.name))
class Base(TestCase):
    def setUp(self):
        Path(_tmp.name, 'licencia.json').unlink(missing_ok=True)
        Path(_tmp.name, '.cf_inicio').unlink(missing_ok=True)
        self.c = APIClient()
        r = self.c.post('/api/sistema/configuracion-inicial/', {
            'nombre_negocio': 'Tienda El Gordo', 'nit': '123', 'admin_nombre': 'Juan Dueño',
            'admin_usuario': 'admin', 'admin_password': '1234', 'datos_ejemplo': True}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.c.credentials(HTTP_AUTHORIZATION='Bearer ' + r.data['access'], HTTP_X_TERMINAL='CAJA-1')
        self.efectivo = FormaPago.objects.get(tipo='EFECTIVO')
        self.nequi = FormaPago.objects.get(nombre='Nequi')
        self.fiado = FormaPago.objects.get(tipo='CREDITO')
        self.arroz = Producto.objects.get(nombre='Arroz 500 g')
        self.tomate = Producto.objects.get(nombre='Tomate chonto')

    def abrir_caja(self, base=50000):
        r = self.c.post('/api/ventas/caja/', {'base': base}, format='json')
        self.assertEqual(r.status_code, 201, r.content)

    def vender(self, detalle, pagos, **extra):
        return self.c.post('/api/ventas/procesar/', dict(detalle=detalle, pagos=pagos, **extra), format='json')


class ConfiguracionYLicenciaTests(Base):
    def test_estado_publico_y_prueba(self):
        r = APIClient().get('/api/sistema/estado/')
        self.assertTrue(r.data['configurado'])
        self.assertEqual(r.data['licencia']['estado'], 'PRUEBA')
        self.assertTrue(r.data['licencia']['puede_vender'])

    def test_no_se_puede_configurar_dos_veces(self):
        r = APIClient().post('/api/sistema/configuracion-inicial/', {
            'nombre_negocio': 'X', 'admin_nombre': 'X', 'admin_usuario': 'x', 'admin_password': '1234'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_prueba_vencida_bloquea_ventas(self):
        self.abrir_caja()
        Configuracion.objects.filter(pk=1).update(fecha_instalacion=timezone.now() - timedelta(days=40))
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 1}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 2500}])
        self.assertEqual(r.status_code, 403)

    def test_prueba_no_se_reinicia_al_reinstalar(self):
        # Primer arranque hace 20 días: queda sellado fuera de la base de datos
        hace20 = timezone.now() - timedelta(days=20)
        Configuracion.objects.filter(pk=1).update(fecha_instalacion=hace20)
        self.assertEqual(licencia.estado_actual().estado, 'VENCIDA')
        # "Reinstalan" la base: la fecha de instalación vuelve a hoy
        Configuracion.objects.filter(pk=1).update(fecha_instalacion=timezone.now())
        self.assertEqual(licencia.estado_actual().estado, 'VENCIDA')
        self.assertTrue(Path(_tmp.name, '.cf_inicio').exists())

    def test_reloj_atrasado_bloquea(self):
        self.abrir_caja()
        Configuracion.objects.filter(pk=1).update(ultima_fecha_vista=timezone.now() + timedelta(days=5))
        est = licencia.estado_actual()
        self.assertEqual(est.estado, 'RELOJ')
        self.assertFalse(est.puede_vender)
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 1}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 2500}])
        self.assertEqual(r.status_code, 403)
        Configuracion.objects.filter(pk=1).update(ultima_fecha_vista=timezone.now())
        self.assertEqual(licencia.estado_actual().estado, 'PRUEBA')

    def test_licencia_firmada(self):
        llave = Ed25519PrivateKey.generate()
        pub = base64.b64encode(llave.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
        datos = {'licencia_id': 'L-1', 'cliente': 'Tienda', 'equipo_id': licencia.equipo_id(), 'plan': 'NUBE',
                 'emitida': '2026-10-01', 'vence': None,
                 'nube_hasta': (timezone.localdate() + timedelta(days=20)).isoformat(), 'max_cajas': 2}
        firma = base64.b64encode(llave.sign(licencia._canonico(datos))).decode()
        texto = base64.b64encode(json.dumps({'datos': datos, 'firma': firma}).encode()).decode()
        with mock.patch.object(licencia, 'LLAVE_PUBLICA_B64', pub):
            r = self.c.post('/api/sistema/licencia/', {'licencia': texto}, format='json')
            self.assertEqual(r.status_code, 200, r.content)
            self.assertEqual(r.data['estado'], 'ACTIVA')
            self.assertTrue(r.data['nube_activa'])
            # plan nube vencido hace 10 días: caja sigue operando, nube apagada
            datos['nube_hasta'] = (timezone.localdate() - timedelta(days=10)).isoformat()
            datos['licencia_id'] = 'L-2'
            firma = base64.b64encode(llave.sign(licencia._canonico(datos))).decode()
            est = licencia.instalar(json.dumps({'datos': datos, 'firma': firma}))
            self.assertTrue(est.puede_vender)
            self.assertFalse(est.nube_activa)
            # licencia de otro equipo
            datos['equipo_id'] = 'AAAA-BBBB-CCCC-DDDD'
            firma = base64.b64encode(llave.sign(licencia._canonico(datos))).decode()
            r = self.c.post('/api/sistema/licencia/', {'licencia': json.dumps({'datos': datos, 'firma': firma})},
                            format='json')
            self.assertEqual(r.status_code, 400)

    def test_licencia_falsificada(self):
        r = self.c.post('/api/sistema/licencia/', {'licencia': json.dumps(
            {'datos': {'plan': 'NUBE', 'equipo_id': '*'}, 'firma': base64.b64encode(b'x' * 64).decode()})},
            format='json')
        self.assertEqual(r.status_code, 400)


class VentaTests(Base):
    def test_no_vende_sin_caja(self):
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 1}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 2500}])
        self.assertEqual(r.status_code, 400)
        self.assertIn('Abre la caja', r.data['error'])

    def test_venta_efectivo_con_cambio_y_stock(self):
        self.abrir_caja()
        stock = self.arroz.stock
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 2}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 10000}])
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Decimal(str(r.data['total'])), Decimal('5000'))
        self.assertEqual(Decimal(str(r.data['cambio'])), Decimal('5000'))
        self.assertEqual(r.data['numero'], 1)
        pago = r.data['pagos'][0]
        self.assertEqual(Decimal(str(pago['monto'])), Decimal('5000'))      # aplicado (neto de cambio)
        self.assertEqual(Decimal(str(pago['recibido'])), Decimal('10000'))  # lo que entregó el cliente
        d = self.c.get('/api/reportes/dashboard/').data
        self.assertEqual(sum(f['total'] for f in d['por_forma_pago']), d['hoy']['total_ventas'])
        self.arroz.refresh_from_db()
        self.assertEqual(self.arroz.stock, stock - 2)
        self.assertTrue(EventoSync.objects.filter(tipo='venta').exists())

    def test_fruver_precio_variable_sin_stock(self):
        self.abrir_caja()
        r = self.vender([{'producto_id': str(self.tomate.id), 'cantidad': '1.250', 'precio_unit': 4000}],
                        [{'forma_pago_id': str(self.nequi.id), 'monto': 5000}])
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Decimal(str(r.data['total'])), Decimal('5000'))
        r = self.vender([{'producto_id': str(self.tomate.id), 'cantidad': 1}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 5000}])
        self.assertEqual(r.status_code, 400)

    def test_precio_no_manipulable(self):
        self.abrir_caja()
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 1, 'precio_unit': 1}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 2500}])
        self.assertEqual(Decimal(str(r.data['total'])), Decimal('2500'))

    def test_pago_insuficiente_y_cambio_solo_efectivo(self):
        self.abrir_caja()
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 1}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 1000}])
        self.assertEqual(r.status_code, 400)
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 1}],
                        [{'forma_pago_id': str(self.nequi.id), 'monto': 5000}])
        self.assertEqual(r.status_code, 400)

    def test_stock_estricto(self):
        self.abrir_caja()
        Configuracion.objects.filter(pk=1).update(vender_sin_stock=False)
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 999}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 9999999}])
        self.assertEqual(r.status_code, 400)
        self.assertIn('Stock insuficiente', r.data['error'])

    def test_anulacion_devuelve_stock_y_audita(self):
        self.abrir_caja()
        stock = self.arroz.stock
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 3}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 7500}])
        vid = r.data['id']
        r = self.c.post(f'/api/ventas/historial/{vid}/anular/', {'motivo': 'Cliente devolvió'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.arroz.refresh_from_db()
        self.assertEqual(self.arroz.stock, stock)
        self.assertTrue(Auditoria.objects.filter(accion='CANCEL').exists())
        r = self.c.post(f'/api/ventas/historial/{vid}/anular/', {'motivo': 'otra vez'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_pago_mixto_y_cierre_caja(self):
        self.abrir_caja(50000)
        self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 4}],  # 10.000
                    [{'forma_pago_id': str(self.efectivo.id), 'monto': 6000},
                     {'forma_pago_id': str(self.nequi.id), 'monto': 4000}])
        self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 1}],  # 2.500, paga 5.000 -> cambio 2.500
                    [{'forma_pago_id': str(self.efectivo.id), 'monto': 5000}])
        self.c.post('/api/ventas/caja/movimientos/', {'tipo': 'EGRESO', 'monto': 3000, 'concepto': 'Pago hielo'},
                    format='json')
        r = self.c.get('/api/ventas/caja/')
        res = r.data['resumen']
        # 50.000 + 6.000 + 5.000 - 2.500 - 3.000
        self.assertEqual(res['efectivo_esperado'], 55500)
        with mock.patch('core.respaldo.crear'):
            r = self.c.post('/api/ventas/caja/cerrar/', {'efectivo_contado': 55000}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Decimal(str(r.data['diferencia'])), Decimal('-500'))
        self.assertTrue(Auditoria.objects.filter(accion='DESCUADRE').exists())
        self.assertFalse(self.c.get('/api/ventas/caja/').data['abierta'])

    def test_cuentas_en_espera(self):
        r = self.c.post('/api/ventas/en-espera/', {'nombre': 'Doña Rosa', 'items': [{'x': 1}], 'total': 5000},
                        format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(self.c.get('/api/ventas/en-espera/').data), 1)
        self.c.delete(f'/api/ventas/en-espera/{r.data["id"]}/')
        self.assertEqual(len(self.c.get('/api/ventas/en-espera/').data), 0)


class FiadoTests(Base):
    def setUp(self):
        super().setUp()
        self.abrir_caja()
        r = self.c.post('/api/fiado/clientes/', {'nombre': 'josé pérez', 'telefono': '3001234567'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.cliente_id = r.data['id']
        self.assertEqual(r.data['nombre'], 'José Pérez')

    def test_venta_fiada_abono_y_cupo(self):
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 4}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 2000},
                         {'forma_pago_id': str(self.fiado.id), 'monto': 8000}], cliente_id=self.cliente_id)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIsNotNone(r.data['credito_numero'])
        cli = Cliente.objects.get(pk=self.cliente_id)
        self.assertEqual(cli.saldo_actual(), Decimal('8000'))
        # fiado sin cliente
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 1}],
                        [{'forma_pago_id': str(self.fiado.id), 'monto': 2500}])
        self.assertEqual(r.status_code, 400)
        # supera cupo (50.000 por defecto)
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 20}],
                        [{'forma_pago_id': str(self.fiado.id), 'monto': 50000}], cliente_id=self.cliente_id)
        self.assertEqual(r.status_code, 400)
        self.assertIn('cupo', r.data['error'])
        # abono parcial
        r = self.c.post(f'/api/fiado/clientes/{self.cliente_id}/abonar/',
                        {'monto': 5000, 'forma_pago_id': str(self.efectivo.id)}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Decimal(str(r.data['saldo_nuevo'])), Decimal('3000'))
        # abono mayor a la deuda
        r = self.c.post(f'/api/fiado/clientes/{self.cliente_id}/abonar/',
                        {'monto': 9000, 'forma_pago_id': str(self.efectivo.id)}, format='json')
        self.assertEqual(r.status_code, 400)
        # el abono en efectivo entra al cuadre de caja
        res = self.c.get('/api/ventas/caja/').data['resumen']
        ef = [f for f in res['por_forma_pago'] if f['tipo'] == 'EFECTIVO'][0]
        self.assertEqual(ef['abonos'], 5000)
        estado = self.c.get(f'/api/fiado/clientes/{self.cliente_id}/estado-cuenta/').data
        self.assertIn('wa.me/573001234567', estado['whatsapp']['url'])

    def test_abono_reparte_fifo_y_paga(self):
        for monto in (3000, 4000):
            self.c.post('/api/fiado/', {'cliente_id': self.cliente_id, 'total': monto}, format='json')
        self.c.post(f'/api/fiado/clientes/{self.cliente_id}/abonar/',
                    {'monto': 7000, 'forma_pago_id': str(self.nequi.id)}, format='json')
        self.assertEqual(Credito.objects.filter(cliente_id=self.cliente_id, estado='PAGADO').count(), 2)
        r = self.c.get('/api/fiado/resumen/')
        self.assertEqual(Decimal(str(r.data['cartera_total'])), Decimal('0'))


class InventarioTests(Base):
    def test_entrada_ajuste_conteo(self):
        stock = self.arroz.stock
        r = self.c.post('/api/catalogo/entradas/', {'proveedor': 'Distribuidora X', 'lineas': [
            {'producto_id': str(self.arroz.id), 'cantidad': 10, 'costo_unitario': 2000, 'precio_venta': 2700}]},
            format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.arroz.refresh_from_db()
        self.assertEqual(self.arroz.stock, stock + 10)
        self.assertEqual(self.arroz.precio_costo, Decimal('2000'))
        self.assertEqual(self.arroz.precio_venta, Decimal('2700'))
        self.assertTrue(Auditoria.objects.filter(accion='PRECIO').exists())
        r = self.c.post('/api/catalogo/ajustes/', {'producto_id': str(self.arroz.id), 'tipo': 'CONTEO',
                                                   'cantidad': 7, 'motivo': 'Conteo físico'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.arroz.refresh_from_db()
        self.assertEqual(self.arroz.stock, Decimal('7'))

    def test_crear_producto_codigo_interno_y_duplicado(self):
        cat = Categoria.objects.get(nombre='Abarrotes')
        r = self.c.post('/api/catalogo/productos/', {'nombre': 'Sal 1 kg', 'categoria': str(cat.id),
                                                     'precio_venta': 1800, 'stock_inicial': 5}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.data['codigo_barras'].startswith('INT-'))
        r = self.c.post('/api/catalogo/productos/', {'nombre': 'Otro', 'categoria': str(cat.id),
                                                     'codigo_barras': self.arroz.codigo_barras,
                                                     'precio_venta': 100}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_busqueda_codigo_y_texto(self):
        r = self.c.get('/api/catalogo/productos/buscar/', {'codigo': self.arroz.codigo_barras})
        self.assertEqual(r.data['nombre'], 'Arroz 500 g')
        r = self.c.get('/api/catalogo/productos/buscar/', {'q': 'arr 500'})
        self.assertEqual(len(r.data), 1)

    def test_importar_plantilla(self):
        r = self.c.get('/api/catalogo/productos/plantilla/')
        self.assertEqual(r.status_code, 200)
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile('p.xlsx', r.content)
        r = self.c.post('/api/catalogo/productos/importar/', {'archivo': f}, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data['total_errores'], 0)
        self.assertGreaterEqual(r.data['creados'] + r.data['actualizados'], 3)

    def test_csv_con_punto_y_coma(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        csv = 'Código;Producto;Categoria;Costo;Precio;Cantidad\n111;Chocolatina;Mecato;800;1.200;10\n'
        r = self.c.post('/api/catalogo/productos/importar/',
                        {'archivo': SimpleUploadedFile('p.csv', csv.encode())}, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)
        p = Producto.objects.get(codigo_barras='111')
        self.assertEqual(p.precio_venta, Decimal('1200'))
        self.assertEqual(p.stock, Decimal('10'))


class PermisosYReportesTests(Base):
    def test_cajero_no_anula_ni_ve_reportes(self):
        r = self.c.post('/api/auth/usuarios/', {'username': 'Caja1', 'nombre_completo': 'Ana', 'rol': 'CAJERO',
                                                'password': '1111'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        cajero = APIClient()
        tok = cajero.post('/api/auth/login/', {'username': 'caja1', 'password': '1111'}, format='json').data
        cajero.credentials(HTTP_AUTHORIZATION='Bearer ' + tok['access'], HTTP_X_TERMINAL='CAJA-2')
        cajero.post('/api/ventas/caja/', {'base': 0}, format='json')
        v = cajero.post('/api/ventas/procesar/', {
            'detalle': [{'producto_id': str(self.arroz.id), 'cantidad': 1}],
            'pagos': [{'forma_pago_id': str(self.efectivo.id), 'monto': 2500}]}, format='json')
        self.assertEqual(v.status_code, 201, v.content)
        self.assertEqual(cajero.post(f'/api/ventas/historial/{v.data["id"]}/anular/', {'motivo': 'prueba x'},
                                     format='json').status_code, 403)
        self.assertEqual(cajero.get('/api/reportes/periodo/').status_code, 403)
        self.assertNotIn('utilidad', cajero.get('/api/reportes/dashboard/').data['hoy'])
        self.assertEqual(cajero.get('/api/auditoria/').status_code, 403)

    def test_reportes(self):
        self.abrir_caja()
        self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 2}],
                    [{'forma_pago_id': str(self.efectivo.id), 'monto': 5000}])
        d = self.c.get('/api/reportes/dashboard/').data
        self.assertEqual(d['hoy']['total_ventas'], 5000)
        self.assertEqual(d['hoy']['utilidad'], 1200)
        p = self.c.get('/api/reportes/periodo/').data
        self.assertEqual(p['totales']['num_ventas'], 1)
        self.assertEqual(self.c.get('/api/reportes/pedido-sugerido/').status_code, 200)
        self.assertEqual(self.c.get('/api/reportes/exportar/', {'tipo': 'detalle'}).status_code, 200)
        r = self.c.post('/api/reportes/asistente/', {'mensaje': 'hola'}, format='json')
        self.assertEqual(r.status_code, 402)

    def test_login_fallido_audita(self):
        r = APIClient().post('/api/auth/login/', {'username': 'admin', 'password': 'mala'}, format='json')
        self.assertEqual(r.status_code, 401)
        self.assertTrue(Auditoria.objects.filter(accion='LOGIN_FALLIDO').exists())

    def test_auditoria_inmutable(self):
        a = Auditoria.objects.first()
        with self.assertRaises(PermissionError):
            a.detalle = 'x'
            a.save()
        with self.assertRaises(PermissionError):
            a.delete()


class TicketTests(Base):
    def test_ticket_escpos(self):
        from core.hardware.tickets import ticket_venta
        self.abrir_caja()
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 2, 'descuento': 500}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 5000}])
        v = Venta.objects.get(pk=r.data['id'])
        data = ticket_venta(v, Configuracion.obtener(), abrir_cajon=True)
        self.assertIn(b'Tienda El Gordo', data)
        self.assertIn(b'\x1bp\x00', data)  # pulso de cajón
        self.assertTrue(data.endswith(b'\x1dVA\x03'))

    def test_bascula_tramas(self):
        from core.hardware.bascula import interpretar
        self.assertEqual(interpretar('ST,GS,+001.235kg'), 1.235)
        self.assertEqual(interpretar('  0.540'), 0.54)
        self.assertEqual(interpretar('1250 g'), 1.25)
