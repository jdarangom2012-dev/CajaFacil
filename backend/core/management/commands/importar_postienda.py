"""
Migra una tienda de PosFácil (PosTienda, versión web) a CajaFácil (local).

Pasos:
  1. Restaurar el backup de PosTienda en una base temporal del mismo PostgreSQL:
        createdb -U postgres postienda_import
        psql -U postgres -d postienda_import -f backup_postienda.sql
  2. Con CajaFácil RECIÉN INSTALADO (sin configurar), ejecutar:
        python manage.py importar_postienda --origen-db postienda_import --origen-usuario postgres --origen-clave XXXX
     (con el instalador: "C:\\Program Files\\CajaFacil\\app\\cajafacil.exe" manage importar_postienda ...)

Qué se migra:
  negocio, usuarios (con sus mismas contraseñas), categorías, productos con su stock, formas de pago,
  clientes del fiado (se crean a partir de los nombres), fiados y abonos con su saldo, ventas con su detalle
  y pagos, cierres de caja, movimientos de inventario y auditoría — conservando fechas y numeración.
No se migra: predicciones de Prophet, tablas temporales, imágenes en Azure Blob.
"""
import uuid
from collections import defaultdict
from contextlib import contextmanager
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

CERO = Decimal('0')
UNIDADES = {'PIEZA': 'UNIDAD', 'UNIDAD': 'UNIDAD', 'LITRO': 'LITRO', 'KG': 'KG', 'GRAMO': 'GRAMO',
            'CAJA': 'CAJA', 'PAQUETE': 'PAQUETE', 'BOTELLA': 'BOTELLA', 'BOLSA': 'BOLSA'}
ACCIONES_AUD = {'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'CANCEL', 'AJUSTE', 'PRECIO'}
COLORES = ['#1570EF', '#0BA5EC', '#12B76A', '#F79009', '#DC6803', '#E31B54', '#D92D20', '#7A5AF8',
           '#6941C6', '#EE46BC', '#B54708', '#667085']


@contextmanager
def fechas_originales(*modelos):
    """Desactiva auto_now / auto_now_add para conservar las fechas históricas."""
    guardado = []
    for m in modelos:
        for f in m._meta.local_fields:
            if getattr(f, 'auto_now', False) or getattr(f, 'auto_now_add', False):
                guardado.append((f, f.auto_now, f.auto_now_add))
                f.auto_now = f.auto_now_add = False
    try:
        yield
    finally:
        for f, a, b in guardado:
            f.auto_now, f.auto_now_add = a, b


def separar_telefono(t: str):
    """En PosTienda a veces se escribían fechas o notas en el teléfono ("23/06", "mayo 25")."""
    import re
    t = (t or '').strip()
    digitos = ''.join(ch for ch in t if ch.isdigit())
    pareceTel = (len(digitos) == 10 and digitos.startswith(('3', '60'))) or \
        (len(digitos) == 12 and digitos.startswith('57')) or (len(digitos) == 7 and ' ' not in t)
    if re.fullmatch(r'[\d\s+\-().]+', t) and pareceTel:
        return t[:30], ''
    return '', t


def normalizar_nombre(n: str) -> str:
    return ' '.join((n or '').split()).title()[:150] or 'Cliente sin nombre'


class Command(BaseCommand):
    help = 'Migra los datos de una tienda de PosFácil (PosTienda) a esta instalación de CajaFácil.'

    def add_arguments(self, p):
        db = settings.DATABASES['default']
        p.add_argument('--origen-db', default='postienda_import', help='Base donde se restauró el backup de PosTienda')
        p.add_argument('--origen-host', default=db['HOST'])
        p.add_argument('--origen-puerto', default=str(db['PORT']))
        p.add_argument('--origen-usuario', default=db['USER'])
        p.add_argument('--origen-clave', default=db['PASSWORD'])
        p.add_argument('--tienda', help='Código de la tienda en PosTienda (ej. TIENDA-001). Si hay una sola, se toma sola.')
        p.add_argument('--admin', help='Usuario de PosTienda que será Administrador (dueño). Por defecto el primer coordinador.')
        p.add_argument('--sin-historial', action='store_true',
                       help='Solo catálogo, stock, clientes y saldos de fiado (sin ventas, cierres ni auditoría)')
        p.add_argument('--tope-fiado', type=int, default=None,
                       help='Cupo de fiado por cliente en CajaFácil. 0 = sin tope (como PosFácil en producción). '
                            'Por defecto se toma el mayor saldo actual de un cliente, redondeado.')
        p.add_argument('--forzar', action='store_true', help='Permite importar aunque CajaFácil ya tenga datos (NO recomendado)')

    # ── utilidades ──────────────────────────────────────────────
    def q(self, sql, params=None):
        with self.src.cursor() as c:
            c.execute(sql, params or ())
            cols = [d.name for d in c.description]
            return [dict(zip(cols, r)) for r in c.fetchall()]

    def paso(self, txt):
        self.stdout.write(self.style.HTTP_INFO(f'→ {txt}'))

    # ── principal ───────────────────────────────────────────────
    def handle(self, *a, **o):
        import psycopg
        from catalogo.models import Producto
        from core.models import Configuracion
        from ventas.models import Venta

        conf = Configuracion.obtener()
        if not o['forzar'] and (conf.configurado or Producto.objects.exists() or Venta.objects.exists()):
            raise CommandError('Esta instalación de CajaFácil ya tiene datos. La migración se hace sobre una '
                               'instalación nueva (sin pasar por el asistente). Use --forzar solo si sabe lo que hace.')
        try:
            self.src = psycopg.connect(host=o['origen_host'], port=o['origen_puerto'], dbname=o['origen_db'],
                                       user=o['origen_usuario'], password=o['origen_clave'], connect_timeout=10)
        except Exception as e:
            raise CommandError(f'No se pudo conectar a la base de PosTienda "{o["origen_db"]}": {e}')

        tiendas = self.q("SELECT * FROM usuarios_tienda WHERE codigo <> 'N/A' ORDER BY id")
        if o['tienda']:
            tiendas = [t for t in tiendas if t['codigo'].upper() == o['tienda'].upper()]
        if len(tiendas) != 1:
            disponibles = ', '.join(f"{t['codigo']} ({t['nombre']})" for t in self.q('SELECT * FROM usuarios_tienda'))
            raise CommandError(f'Indique la tienda con --tienda. Disponibles: {disponibles}')
        self.tienda = tiendas[0]
        tid = self.tienda['id']
        self.stdout.write(self.style.SUCCESS(f"Migrando «{self.tienda['nombre']}» ({self.tienda['codigo']})"))

        with transaction.atomic():
            self.negocio(conf, o['tope_fiado'], tid)
            self.usuarios(tid, o['admin'])
            self.categorias(tid)
            self.productos(tid)
            self.formas_pago(tid)
            self.clientes(tid)
            if not o['sin_historial']:
                self.cajas(tid)
                self.ventas(tid)
            self.creditos(tid, con_ventas=not o['sin_historial'])
            if not o['sin_historial']:
                self.movimientos(tid)
                self.auditoria()
                self.resumen_cajas()
            self.favoritos()
            self.consecutivos()
            self.validar(tid, o['sin_historial'])
        self.src.close()
        self.stdout.write(self.style.SUCCESS('\n¡Migración terminada! Ya puede entrar a CajaFácil con los mismos usuarios y contraseñas de PosTienda.'))

    # ── pasos ───────────────────────────────────────────────────
    def negocio(self, conf, tope, tid):
        self.paso('Datos del negocio')
        if tope is None:
            # Sin tope explícito: el mayor saldo actual de un cliente, redondeado hacia arriba a $50.000,
            # para que nadie quede bloqueado el primer día.
            mayor = self.q("""SELECT COALESCE(MAX(s),0) m FROM (SELECT lower(trim(cliente_nombre)) c,
                             SUM(total_deuda - total_abonado) s FROM creditos WHERE tienda_id=%s AND estado='PENDIENTE'
                             GROUP BY 1) x""", [tid])[0]['m']
            tope = max(50000, int(-(-float(mayor) // 50000) * 50000))
        t = self.tienda
        conf.nombre_negocio = t['nombre'][:120]
        conf.direccion = (t['direccion'] or '')[:200]
        conf.telefono = (t['telefono'] or '')[:30]
        conf.email = t['email'] or ''
        conf.tope_credito_defecto = Decimal(tope)
        self.stdout.write(f'   Cupo de fiado por cliente: {"sin tope" if not tope else f"${tope:,.0f}"} (cámbielo en Configuración)')
        conf.configurado = True
        conf.save()

    def usuarios(self, tid, admin):
        from usuarios.models import Usuario
        self.paso('Usuarios (conservan su contraseña)')
        filas = self.q('SELECT * FROM usuarios_usuario WHERE tienda_id = %s ORDER BY id', [tid])
        if not filas:
            raise CommandError('La tienda no tiene usuarios.')
        if admin and not any(f['username'] == admin for f in filas):
            raise CommandError(f'El usuario "{admin}" no existe en la tienda.')
        admin = admin or next((f['username'] for f in filas if f['rol'] == 'COORDINADOR'), filas[0]['username'])
        self.mapa_usuario = {}
        with fechas_originales(Usuario):
            for f in filas:
                rol = 'ADMIN' if f['username'] == admin else (f['rol'] if f['rol'] in ('COORDINADOR', 'CAJERO', 'ALMACENISTA') else 'CAJERO')
                u = Usuario(username=f['username'].lower(), password=f['password'], first_name=f['first_name'] or '',
                            last_name=f['last_name'] or '', email=f['email'] or '', is_active=f['is_active'],
                            is_staff=rol == 'ADMIN', date_joined=f['date_joined'], last_login=f['last_login'],
                            nombre_completo=(f['nombre_completo'] or f['username'])[:120], rol=rol)
                u.save()
                self.mapa_usuario[f['id']] = u
                self.stdout.write(f"   {u.username:<14} {u.get_rol_display()}")
        self.usuario_defecto = next(u for u in self.mapa_usuario.values() if u.rol == 'ADMIN')
        sa = self.q("SELECT id, username FROM usuarios_usuario WHERE rol = 'SUPERADMIN' OR tienda_id IS DISTINCT FROM %s", [tid])
        self.ids_ajenos = {str(x['id']) for x in sa}
        self.nombres_ajenos = {x['username'] for x in sa}

    def usuario(self, old_id):
        return self.mapa_usuario.get(old_id, self.usuario_defecto)

    def categorias(self, tid):
        from catalogo.models import Categoria
        self.paso('Categorías')
        filas = self.q("""SELECT c.* FROM categorias c WHERE c.tienda_id = %s OR c.id IN
                           (SELECT DISTINCT categoria_id FROM productos WHERE tienda_id = %s) ORDER BY c.activa DESC, c.id""",
                       [tid, tid])
        self.mapa_cat = {}
        por_nombre = {}
        unidas = []
        for i, f in enumerate(filas):
            clave = ' '.join(f['nombre'].split()).lower()
            if clave in por_nombre:  # "ferreteria" / "Ferreteria", "PAPELERIA" / "Papeleria"
                self.mapa_cat[f['id']] = por_nombre[clave]
                unidas.append(f['nombre'])
                continue
            es_fruver = clave in ('fruver', 'frutas y verduras', 'verduras')
            nombre = ' '.join(f['nombre'].split())
            nombre = nombre.capitalize() if nombre.isupper() or nombre.islower() else nombre
            c = Categoria.objects.create(nombre=nombre[:80], descripcion=(f['descripcion'] or '')[:200],
                                         color='#12B76A' if es_fruver else COLORES[i % len(COLORES)],
                                         precio_variable=es_fruver, controla_stock=not es_fruver, activa=f['activa'])
            por_nombre[clave] = c
            self.mapa_cat[f['id']] = c
        self.stdout.write(f'   {len(por_nombre)} categorías' + (f' (unidas por nombre repetido: {", ".join(unidas)})' if unidas else ''))

    def productos(self, tid):
        from catalogo.models import Producto
        self.paso('Productos y existencias')
        filas = self.q("""SELECT p.*, COALESCE(i.cantidad_actual, 0) AS stock FROM productos p
                          LEFT JOIN inventario i ON i.producto_id = p.id WHERE p.tienda_id = %s ORDER BY p.id""", [tid])
        self.mapa_prod = {}
        usados = set()
        objs = []
        for f in filas:
            codigo = (f['codigo_barras'] or '').strip() or None
            if codigo in usados:
                codigo = f'{codigo}-{f["id"]}'
            if codigo:
                usados.add(codigo)
            p = Producto(id=uuid.uuid4(), codigo_barras=codigo, nombre=' '.join(f['nombre'].split())[:200],
                         descripcion=(f['descripcion'] or '')[:300], categoria=self.mapa_cat[f['categoria_id']],
                         precio_costo=f['precio_costo'] or CERO, precio_venta=f['precio_venta'] or CERO,
                         unidad_medida=UNIDADES.get(f['unidad_medida'], 'UNIDAD'), stock=f['stock'] or CERO,
                         stock_minimo=Decimal(f['stock_minimo'] or 0), activo=f['activo'],
                         creado=f['created_at'], actualizado=f['updated_at'])
            if not p.categoria.controla_stock:
                p.stock = CERO
            objs.append(p)
            self.mapa_prod[f['id']] = p
        with fechas_originales(Producto):
            Producto.objects.bulk_create(objs, batch_size=500)
        self.stdout.write(f'   {len(objs)} productos')

    def formas_pago(self, tid):
        from ventas.models import FormaPago
        self.paso('Formas de pago')
        filas = self.q('SELECT * FROM formas_pago WHERE tienda_id = %s OR tienda_id IS NULL ORDER BY id', [tid])
        self.mapa_fp = {}
        orden = 1
        for f in filas:
            n = f['nombre'].strip()
            l = n.lower()
            if 'efectivo' in l:
                tipo, color = 'EFECTIVO', '#12B76A'
            elif 'crédito' in l or 'credito' in l or 'fiado' in l:
                tipo, color, n = 'CREDITO', '#F79009', 'Fiado'
            elif 'tarjeta' in l or 'dat' in l:
                tipo, color = 'TARJETA', '#475467'
            else:
                tipo, color = 'TRANSFERENCIA', {'nequi': '#7A2E8E', 'daviplata': '#E4002B'}.get(l, '#0B4FD0')
            fp, _ = FormaPago.objects.get_or_create(nombre=n, defaults={
                'tipo': tipo, 'color': color, 'orden': orden, 'activa': f['activa'] or tipo == 'CREDITO'})
            self.mapa_fp[f['id']] = fp
            orden += 1
        for nombre, tipo, color in (('Bre-B / Transferencia', 'TRANSFERENCIA', '#0B4FD0'), ('Tarjeta', 'TARJETA', '#475467')):
            if not FormaPago.objects.filter(tipo=tipo, nombre__iexact=nombre).exists():
                FormaPago.objects.get_or_create(nombre=nombre, defaults={'tipo': tipo, 'color': color, 'orden': orden})
                orden += 1
        self.fp_por_nombre = {fp.nombre.lower(): fp for fp in FormaPago.objects.all()}
        if not FormaPago.objects.filter(tipo='CREDITO').exists():
            FormaPago.objects.create(nombre='Fiado', tipo='CREDITO', color='#F79009', orden=orden)
        self.stdout.write('   ' + ', '.join(FormaPago.objects.values_list('nombre', flat=True)))

    def clientes(self, tid):
        from creditos.models import Cliente
        self.paso('Clientes del fiado')
        filas = self.q('SELECT cliente_nombre, cliente_telefono, created_at FROM creditos WHERE tienda_id = %s ORDER BY created_at', [tid])
        self.mapa_cliente = {}
        with fechas_originales(Cliente):
            for f in filas:
                clave = ' '.join((f['cliente_nombre'] or '').split()).lower()
                c = self.mapa_cliente.get(clave)
                tel, nota = separar_telefono(f['cliente_telefono'])
                if not c:
                    c = Cliente.objects.create(nombre=normalizar_nombre(f['cliente_nombre']), telefono=tel,
                                               notas=f'Nota en PosFácil: {nota}'[:300] if nota else '',
                                               creado=f['created_at'], actualizado=f['created_at'])
                    self.mapa_cliente[clave] = c
                elif not c.telefono and tel:
                    c.telefono = tel
                    c.save(update_fields=['telefono'])
        self.stdout.write(f'   {len(self.mapa_cliente)} clientes')

    def cliente_de(self, nombre):
        return self.mapa_cliente.get(' '.join((nombre or '').split()).lower())

    def cajas(self, tid):
        from ventas.models import Caja
        self.paso('Cierres de caja')
        filas = self.q('SELECT * FROM cierres_caja WHERE tienda_id = %s ORDER BY hora_apertura', [tid])
        self.caja_por_fecha = {}
        objs = []
        sin_cerrar = 0
        for f in filas:
            # Todas las cajas migradas quedan cerradas: el primer día en CajaFácil se abre una caja nueva
            abierta = False
            if f['estado'] == 'ABIERTA':
                sin_cerrar += 1
                f['notas'] = ((f['notas'] or '') + ' [Quedó abierta en PosFácil; cerrada por la migración]').strip()
            u = self.usuario(f['usuario_id'])
            c = Caja(id=uuid.uuid4(), numero=f['id'], terminal='CAJA-1', estado='ABIERTA' if abierta else 'CERRADA',
                     usuario_apertura=u, usuario_cierre=None if abierta else u, abierta_en=f['hora_apertura'],
                     cerrada_en=None if abierta else (f['hora_cierre'] or f['hora_apertura']),
                     base=f['monto_apertura'] or CERO, efectivo_esperado=f['monto_esperado'] or CERO,
                     efectivo_contado=None if abierta else f['monto_real'],
                     diferencia=None if abierta else f['diferencia'], notas=f['notas'] or '',
                     creado=f['created_at'], actualizado=f['hora_cierre'] or f['created_at'])
            objs.append(c)
            self.caja_por_fecha.setdefault(f['fecha'], c)
        with fechas_originales(Caja):
            Caja.objects.bulk_create(objs)
        self.cajas_creadas = objs
        self.stdout.write(f'   {len(objs)} cajas' + (f' ({sin_cerrar} estaban abiertas en PosFácil y quedaron cerradas)' if sin_cerrar else ''))

    def caja_de(self, momento):
        if not hasattr(self, 'caja_por_fecha'):
            return None
        return self.caja_por_fecha.get(timezone.localtime(momento).date())

    def ventas(self, tid):
        from ventas.models import Venta, VentaDetalle, VentaPago
        self.paso('Ventas (puede tardar un poco)')
        filas = self.q('SELECT * FROM ventas WHERE tienda_id = %s ORDER BY id', [tid])
        detalle = defaultdict(list)
        for d in self.q('SELECT d.* FROM ventas_detalle d JOIN ventas v ON v.id = d.venta_id WHERE v.tienda_id = %s ORDER BY d.id', [tid]):
            detalle[d['venta_id']].append(d)
        pagos = defaultdict(list)
        for p in self.q('SELECT p.* FROM ventas_pagos p JOIN ventas v ON v.id = p.venta_id WHERE v.tienda_id = %s ORDER BY p.id', [tid]):
            pagos[p['venta_id']].append(p)
        cliente_venta = {c['venta_id']: c['cliente_nombre'] for c in
                         self.q('SELECT venta_id, cliente_nombre FROM creditos WHERE tienda_id = %s AND venta_id IS NOT NULL', [tid])}

        self.mapa_venta = {}
        ventas, lineas, pagos_obj = [], [], []
        for f in filas:
            total = f['total'] or CERO
            pg = pagos[f['id']]
            pagado = sum((p['monto'] for p in pg), CERO)
            cambio = max(pagado - total, CERO)
            costo = CERO
            v = Venta(id=uuid.uuid4(), numero=f['id'], caja=self.caja_de(f['fecha_hora']), terminal='CAJA-1',
                      usuario=self.usuario(f['usuario_id']), cliente=self.cliente_de(cliente_venta.get(f['id'])),
                      subtotal=f['subtotal'] or CERO, descuento=f['descuento'] or CERO, total=total,
                      total_pagado=pagado, cambio=cambio,
                      estado='COMPLETADA' if f['estado'] == 'COMPLETADA' else 'ANULADA',
                      motivo_anulacion=(f['motivo_cancelacion'] or '')[:300], creado=f['fecha_hora'],
                      actualizado=f['created_at'] or f['fecha_hora'])
            for d in detalle[f['id']]:
                prod = self.mapa_prod.get(d['producto_id'])
                if not prod:
                    continue
                costo += prod.precio_costo * d['cantidad']
                lineas.append(VentaDetalle(id=uuid.uuid4(), venta=v, producto=prod, nombre_producto=prod.nombre,
                                           cantidad=d['cantidad'], precio_unit=d['precio_unit'], costo_unit=prod.precio_costo,
                                           descuento=d['descuento'] or CERO, subtotal=d['subtotal'],
                                           creado=f['fecha_hora'], actualizado=f['fecha_hora']))
            v.costo_total = costo.quantize(Decimal('0.01'))
            por_devolver = cambio
            for p in pg:
                fp = self.mapa_fp[p['forma_pago_id']]
                aplicado = p['monto']
                if fp.es_efectivo and por_devolver > 0:
                    quita = min(por_devolver, aplicado)
                    aplicado -= quita
                    por_devolver -= quita
                if aplicado > 0:
                    pagos_obj.append(VentaPago(id=uuid.uuid4(), venta=v, forma_pago=fp, monto=aplicado, recibido=p['monto'],
                                               referencia=(p['referencia'] or '')[:100], creado=f['fecha_hora'],
                                               actualizado=f['fecha_hora']))
            ventas.append(v)
            self.mapa_venta[f['id']] = v
        with fechas_originales(Venta, VentaDetalle, VentaPago):
            Venta.objects.bulk_create(ventas, batch_size=1000)
            VentaDetalle.objects.bulk_create(lineas, batch_size=2000)
            VentaPago.objects.bulk_create(pagos_obj, batch_size=2000)
        self.stdout.write(f'   {len(ventas)} ventas, {len(lineas)} líneas, {len(pagos_obj)} pagos')

    def creditos(self, tid, con_ventas):
        from creditos.models import AbonoCredito, Credito
        self.paso('Fiados y abonos')
        dias = 30
        filas = self.q('SELECT * FROM creditos WHERE tienda_id = %s ORDER BY id', [tid])
        abonos = defaultdict(list)
        for a in self.q('SELECT a.* FROM creditos_abonocredito a JOIN creditos c ON c.id = a.credito_id WHERE c.tienda_id = %s ORDER BY a.id', [tid]):
            abonos[a['credito_id']].append(a)
        creds, abs_ = [], []
        efectivo = self.fp_por_nombre.get('efectivo')
        for f in filas:
            ab = abonos[f['id']]
            abonado = f['total_abonado'] or CERO
            pagado = f['estado'] == 'PAGADO' or (f['total_deuda'] - abonado) <= 0
            c = Credito(id=uuid.uuid4(), numero=f['id'], cliente=self.cliente_de(f['cliente_nombre']),
                        venta=self.mapa_venta.get(f['venta_id']) if con_ventas else None, total=f['total_deuda'],
                        abonado=abonado, estado='PAGADO' if pagado else 'PENDIENTE',
                        vence=timezone.localtime(f['created_at']).date() + timedelta(days=dias),
                        usuario=self.usuario(f['usuario_id']), notas=(f['notas'] or '')[:300],
                        pagado_en=(ab[-1]['created_at'] if ab else f['updated_at']) if pagado else None,
                        creado=f['created_at'], actualizado=f['updated_at'])
            creds.append(c)
            for a in ab:
                fp = self.fp_por_nombre.get(a['forma_pago'].lower()) or efectivo
                abs_.append(AbonoCredito(id=uuid.uuid4(), credito=c, grupo=uuid.uuid4(), forma_pago=fp, monto=a['monto'],
                                         nota=(a['nota'] or '')[:200], caja=self.caja_de(a['created_at']) if con_ventas else None,
                                         usuario=self.usuario(a['usuario_id']), creado=a['created_at'], actualizado=a['created_at']))
        with fechas_originales(Credito, AbonoCredito):
            Credito.objects.bulk_create(creds, batch_size=1000)
            AbonoCredito.objects.bulk_create(abs_, batch_size=1000)
        pend = [c for c in creds if c.estado == 'PENDIENTE']
        self.stdout.write(f'   {len(creds)} fiados ({len(pend)} pendientes), {len(abs_)} abonos')

    def movimientos(self, tid):
        from catalogo.models import MovimientoInventario
        self.paso('Movimientos de inventario')
        objs = []
        for f in self.q('SELECT * FROM movimientos_inventario WHERE tienda_id = %s ORDER BY id', [tid]):
            prod = self.mapa_prod.get(f['producto_id'])
            if not prod:
                continue
            ref = ''
            if f['referencia_tipo'] == 'VENTA' and f['referencia_id'] in self.mapa_venta:
                ref = str(self.mapa_venta[f['referencia_id']].id)
            elif f['referencia_id']:
                ref = str(f['referencia_id'])
            tipo = f['tipo_movimiento'] if f['tipo_movimiento'] in ('ENTRADA', 'SALIDA', 'DEVOLUCION', 'AJUSTE_POS', 'AJUSTE_NEG') else 'AJUSTE_POS'
            objs.append(MovimientoInventario(id=uuid.uuid4(), producto=prod, tipo=tipo, cantidad=f['cantidad'],
                                             stock_anterior=f['stock_anterior'], stock_nuevo=f['stock_nuevo'],
                                             referencia_tipo=f['referencia_tipo'] or '', referencia_id=ref,
                                             motivo=(f['motivo'] or '')[:300], usuario=self.usuario(f['usuario_id']),
                                             creado=f['created_at'], actualizado=f['created_at']))
        with fechas_originales(MovimientoInventario):
            MovimientoInventario.objects.bulk_create(objs, batch_size=2000)
        self.stdout.write(f'   {len(objs)} movimientos')

    def auditoria(self):
        from auditoria.models import Auditoria
        self.paso('Auditoría')
        nuevos = {str(k): str(u.id) for k, u in self.mapa_usuario.items()}
        objs = []
        for f in self.q('SELECT * FROM auditoria ORDER BY fecha_hora'):
            if str(f['usuario_id_ref'] or '') in self.ids_ajenos or f['usuario_nombre'] in self.nombres_ajenos:
                continue
            objs.append(Auditoria(id=uuid.uuid4(), fecha_hora=f['fecha_hora'],
                                  usuario_id_ref=nuevos.get(str(f['usuario_id_ref'] or ''), ''),
                                  usuario_nombre=f['usuario_nombre'][:150],
                                  accion=f['accion'] if f['accion'] in ACCIONES_AUD else 'UPDATE',
                                  tabla_afectada=f['tabla_afectada'] or '', registro_id=str(f['registro_id'] or ''),
                                  valor_anterior=f['valor_anterior'], valor_nuevo=f['valor_nuevo'], terminal='CAJA-1',
                                  ip_dispositivo=str(f['ip_dispositivo']) if f['ip_dispositivo'] else None, detalle=f['detalle'] or ''))
        with fechas_originales(Auditoria):
            Auditoria.objects.bulk_create(objs, batch_size=2000)
        Auditoria.objects.create(usuario_nombre='Sistema', accion='CONFIG', tabla_afectada='configuracion',
                                 detalle=f'Migración desde PosFácil ({self.tienda["codigo"]}): {len(objs)} eventos históricos')
        self.stdout.write(f'   {len(objs)} eventos')

    def resumen_cajas(self):
        from ventas.models import Caja
        from ventas.services import calcular_resumen
        self.paso('Resumen de cada cierre')
        for c in Caja.objects.all():
            res = calcular_resumen(c)
            Caja.objects.filter(pk=c.pk).update(resumen=res)

    def favoritos(self):
        from catalogo.models import Producto
        from ventas.models import VentaDetalle
        desde = timezone.now() - timedelta(days=60)
        top = (VentaDetalle.objects.filter(venta__creado__gte=desde, producto__activo=True,
                                           producto__categoria__precio_variable=False)
               .values('producto').annotate(c=Sum('cantidad')).order_by('-c')[:24])
        ids = [t['producto'] for t in top]
        if ids:
            Producto.objects.filter(id__in=ids).update(favorito=True)
            self.stdout.write(f'   {len(ids)} productos más vendidos marcados como teclas rápidas')

    def consecutivos(self):
        from core.models import Consecutivo
        from creditos.models import Credito
        from ventas.models import Caja, Venta
        from django.db.models import Max
        for nombre, modelo in (('venta', Venta), ('credito', Credito), ('caja', Caja)):
            m = modelo.objects.aggregate(m=Max('numero'))['m'] or 0
            Consecutivo.objects.update_or_create(nombre=nombre, defaults={'valor': m})

    def validar(self, tid, sin_historial):
        from catalogo.models import Producto
        from creditos.models import Credito
        from django.db.models import F
        from ventas.models import Venta
        self.paso('Verificación (PosTienda → CajaFácil)')
        filas = []
        o = self.q("""SELECT COUNT(*) n, COALESCE(SUM(i.cantidad_actual) FILTER (WHERE lower(trim(c.nombre)) <> 'fruver'),0) s
                      FROM productos p LEFT JOIN inventario i ON i.producto_id=p.id JOIN categorias c ON c.id=p.categoria_id
                      WHERE p.tienda_id=%s""", [tid])[0]
        filas.append(('Productos', o['n'], Producto.objects.count()))
        filas.append(('Unidades en stock', o['s'], Producto.objects.filter(categoria__controla_stock=True).aggregate(s=Sum('stock'))['s'] or 0))
        o = self.q("SELECT COALESCE(SUM(total_deuda - total_abonado),0) s, COUNT(*) FILTER (WHERE estado='PENDIENTE') n FROM creditos WHERE tienda_id=%s", [tid])[0]
        filas.append(('Fiados pendientes', o['n'], Credito.objects.filter(estado='PENDIENTE').count()))
        filas.append(('Cartera por cobrar $', o['s'], Credito.objects.filter(estado='PENDIENTE').aggregate(s=Sum(F('total') - F('abonado')))['s'] or 0))
        if not sin_historial:
            o = self.q('SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM ventas WHERE tienda_id=%s', [tid])[0]
            filas.append(('Ventas', o['n'], Venta.objects.count()))
            filas.append(('Total vendido $', o['s'], Venta.objects.aggregate(s=Sum('total'))['s'] or 0))
        ok = True
        for nombre, antes, ahora in filas:
            igual = Decimal(str(antes)) == Decimal(str(ahora))
            ok &= igual
            self.stdout.write(f"   {'✓' if igual else '✗'} {nombre:<24} {antes!s:>16} → {ahora!s:>16}")
        if not ok:
            self.stdout.write(self.style.WARNING('   Hay diferencias: revise los ✗ (puede ser por productos sin categoría o datos huérfanos).'))
