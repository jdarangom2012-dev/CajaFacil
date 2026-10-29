"""Módulo de facturación electrónica (documento equivalente POS) con el proveedor simulado."""
import base64
import json
import os
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from django.utils import timezone

from core import licencia
from core.models import Configuracion
from facturacion import services as fe
from facturacion.models import ConfigFacturacion, DocumentoElectronico

from .test_flujos import Base


class FacturacionTests(Base):
    def configurar(self, **extra):
        datos = {'proveedor': 'SIMULADO', 'ambiente': 'PRUEBAS', 'resolucion_numero': '18764000001',
                 'prefijo': 'pos', 'rango_desde': 1, 'rango_hasta': 1000,
                 'fecha_desde': (timezone.localdate() - timedelta(days=30)).isoformat(),
                 'fecha_hasta': (timezone.localdate() + timedelta(days=300)).isoformat(), 'activa': True}
        datos.update(extra)
        return self.c.put('/api/facturacion/configuracion/', datos, format='json')

    def venta_arroz(self, cantidad=1, **extra):
        return self.vender([{'producto_id': str(self.arroz.id), 'cantidad': cantidad}],
                           [{'forma_pago_id': str(self.efectivo.id), 'monto': 2500 * cantidad}], **extra)

    def test_apagada_no_cambia_nada(self):
        self.abrir_caja()
        r = self.venta_arroz()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIsNone(r.data['documento_electronico'])
        self.assertEqual(DocumentoElectronico.objects.count(), 0)
        e = self.c.get('/api/facturacion/estado/').data
        self.assertTrue(e['disponible'])   # modo prueba: se puede probar
        self.assertFalse(e['activa'])

    def test_no_activa_sin_resolucion(self):
        r = self.c.put('/api/facturacion/configuracion/', {'activa': True}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('resolución', r.data['error'])

    def test_venta_genera_documento_con_cude_y_consecutivo(self):
        r = self.configurar()
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data['prefijo'], 'POS')
        self.abrir_caja()
        r1 = self.venta_arroz()
        r2 = self.venta_arroz()
        self.assertEqual(r1.status_code, 201, r1.content)
        d1, d2 = r1.data['documento_electronico'], r2.data['documento_electronico']
        self.assertEqual(d1['numero'], 'POS1')
        self.assertEqual(d2['numero'], 'POS2')
        self.assertEqual(d1['estado'], 'ACEPTADO')
        self.assertEqual(len(d1['cude']), 96)
        self.assertIn(d1['cude'], d1['qr'])
        self.assertEqual(ConfigFacturacion.obtener().restantes, 998)
        # El tiquete impreso lleva el número, la resolución, el CUDE y el QR
        from core.hardware.tickets import ticket_venta
        from ventas.models import Venta
        crudo = ticket_venta(Venta.objects.get(pk=r1.data['id']), Configuracion.obtener())
        self.assertIn(b'POS1', crudo)
        self.assertIn(b'18764000001', crudo)
        self.assertIn(d1['cude'][:40].encode(), crudo)
        self.assertIn(b'(k', crudo)

    def test_iva_incluido_en_precio(self):
        Configuracion.objects.filter(pk=1).update(regimen='Responsable de IVA')
        self.arroz.tarifa_iva = 19
        self.arroz.save()
        self.configurar()
        self.abrir_caja()
        r = self.vender([{'producto_id': str(self.arroz.id), 'cantidad': 2}],
                        [{'forma_pago_id': str(self.efectivo.id), 'monto': 5000}])
        doc = DocumentoElectronico.objects.get()
        armado = fe.armar_documento(doc)
        self.assertEqual(armado['totales']['total'], '5000.00')
        self.assertEqual(armado['totales']['base'], '4201.68')   # 5000 / 1.19
        self.assertEqual(armado['totales']['iva'], '798.32')
        self.assertEqual(armado['impuestos'][0]['tarifa'], 19)
        self.assertEqual(armado['adquirente']['numero'], '222222222222')

    def test_no_responsable_de_iva_no_discrimina(self):
        self.arroz.tarifa_iva = 19
        self.arroz.save()   # el negocio de ejemplo es "No responsable de IVA"
        self.configurar()
        self.abrir_caja()
        self.venta_arroz()
        armado = fe.armar_documento(DocumentoElectronico.objects.get())
        self.assertEqual(armado['totales']['iva'], '0.00')

    def test_cliente_pide_factura(self):
        self.configurar()
        self.abrir_caja()
        r = self.venta_arroz(adquirente={'tipo_doc': 'NIT', 'numero': '900.123.456-7', 'nombre': 'Restaurante La 80',
                                          'correo': 'compras@la80.co'})
        self.assertEqual(r.status_code, 201, r.content)
        doc = DocumentoElectronico.objects.get()
        self.assertEqual(doc.adquirente_numero, '9001234567')
        self.assertEqual(doc.adquirente_nombre, 'Restaurante La 80')
        self.assertIn('Restaurante La 80', r.data['documento_electronico']['adquirente'])
        malo = self.venta_arroz(adquirente={'tipo_doc': 'CC', 'numero': '123456', 'nombre': ''})
        self.assertEqual(malo.status_code, 400)

    def test_sin_internet_queda_pendiente_y_luego_se_envia(self):
        self.configurar()
        self.abrir_caja()
        with mock.patch.dict(os.environ, {'CAJAFACIL_FE_SIMULAR_SIN_INTERNET': '1'}):
            r = self.venta_arroz()
            self.assertEqual(r.status_code, 201, r.content)   # la venta NO se pierde
            self.assertEqual(r.data['documento_electronico']['estado'], 'PENDIENTE')
            self.assertEqual(fe.enviar_pendientes()['enviados'], 0)
        DocumentoElectronico.objects.update(proximo_intento=timezone.now())
        res = fe.enviar_pendientes()
        self.assertEqual(res, {'enviados': 1, 'pendientes': 0})
        self.assertEqual(DocumentoElectronico.objects.get().estado, 'ACEPTADO')

    def test_rango_agotado_o_resolucion_vencida_bloquea(self):
        self.configurar(rango_desde=1, rango_hasta=1)
        self.abrir_caja()
        self.assertEqual(self.venta_arroz().status_code, 201)
        r = self.venta_arroz()
        self.assertEqual(r.status_code, 400)
        self.assertIn('números autorizados', r.data['error'])
        ConfigFacturacion.objects.update(rango_hasta=100, fecha_hasta=timezone.localdate() - timedelta(days=1))
        r = self.venta_arroz()
        self.assertEqual(r.status_code, 400)
        self.assertIn('venció', r.data['error'])
        # apagando el módulo se vuelve a vender
        ConfigFacturacion.objects.update(activa=False)
        self.assertEqual(self.venta_arroz().status_code, 201)

    def test_anular_genera_nota_de_ajuste(self):
        self.configurar()
        self.abrir_caja()
        v = self.venta_arroz().data
        r = self.c.post(f"/api/ventas/historial/{v['id']}/anular/", {'motivo': 'Cliente devolvió el producto'},
                        format='json')
        self.assertEqual(r.status_code, 200, r.content)
        nota = DocumentoElectronico.objects.get(tipo='NOTA_AJUSTE')
        self.assertEqual(nota.numero_completo, 'NA1')
        self.assertEqual(nota.estado, 'ACEPTADO')
        self.assertEqual(fe.armar_documento(nota)['referencia']['numero_completo'], 'POS1')

    def test_no_repite_numeros_al_cambiar_configuracion(self):
        self.configurar()
        self.abrir_caja()
        self.venta_arroz()
        self.venta_arroz()
        r = self.configurar(rango_desde=1, rango_hasta=1000)   # guardan de nuevo la misma resolución
        self.assertEqual(r.data['proximo_numero'], 3)

    def test_produccion_requiere_licencia_con_facturacion(self):
        r = self.configurar(ambiente='PRODUCCION')
        self.assertEqual(r.status_code, 400)
        llave = Ed25519PrivateKey.generate()
        pub = base64.b64encode(llave.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()

        def firmar(datos):
            return json.dumps({'datos': datos, 'firma': base64.b64encode(llave.sign(licencia._canonico(datos))).decode()})

        base_lic = {'licencia_id': 'L-FE', 'cliente': 'Tienda', 'equipo_id': licencia.equipo_id(), 'plan': 'BASICO',
                    'emitida': '2026-10-01', 'vence': None, 'nube_hasta': None, 'max_cajas': 1}
        with mock.patch.object(licencia, 'LLAVE_PUBLICA_B64', pub):
            # Licencia SIN facturación: el módulo no existe para el cliente
            licencia.instalar(firmar(base_lic))
            self.assertFalse(self.c.get('/api/facturacion/estado/').data['disponible'])
            self.assertEqual(self.c.get('/api/facturacion/configuracion/').status_code, 403)
            # Licencia CON facturación: puede ir a producción
            licencia.instalar(firmar({**base_lic, 'licencia_id': 'L-FE2', 'facturacion': True,
                                      'fe_hasta': (timezone.localdate() + timedelta(days=365)).isoformat()}))
            r = self.configurar(ambiente='PRODUCCION')
            self.assertEqual(r.status_code, 200, r.content)
            self.abrir_caja()
            self.assertEqual(self.venta_arroz().data['documento_electronico']['ambiente'], 'PRODUCCION')
