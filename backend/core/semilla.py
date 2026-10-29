"""Datos iniciales: formas de pago, categorías típicas de tienda de barrio y (opcional) productos de ejemplo."""
from decimal import Decimal

FORMAS_PAGO = [
    ('Efectivo', 'EFECTIVO', False, '#12B76A', 1),
    ('Nequi', 'TRANSFERENCIA', False, '#7A2E8E', 2),
    ('Daviplata', 'TRANSFERENCIA', False, '#E4002B', 3),
    ('Bre-B / Transferencia', 'TRANSFERENCIA', False, '#0B4FD0', 4),
    ('Tarjeta', 'TARJETA', False, '#475467', 5),
    ('Fiado', 'CREDITO', False, '#F79009', 6),
]

CATEGORIAS = [
    ('Abarrotes', '#1570EF', False, True),
    ('Granos', '#B54708', False, True),
    ('Lácteos', '#0BA5EC', False, True),
    ('Bebidas', '#E31B54', False, True),
    ('Panadería', '#DC6803', False, True),
    ('Aseo', '#7A5AF8', False, True),
    ('Cuidado personal', '#EE46BC', False, True),
    ('Mecato', '#F79009', False, True),
    ('Carnes', '#D92D20', False, True),
    ('Fruver', '#12B76A', True, False),
    ('Licores', '#6941C6', False, True),
    ('Varios', '#667085', False, True),
]

EJEMPLO = [
    ('7702004003508', 'Arroz 500 g', 'Granos', 1900, 2500, 'UNIDAD', 30, 8, True),
    ('7702020022001', 'Fríjol cargamanto 500 g', 'Granos', 4300, 5500, 'UNIDAD', 15, 5, False),
    ('7702354950019', 'Aceite 1000 ml', 'Abarrotes', 8200, 9800, 'BOTELLA', 12, 4, False),
    ('7702007041514', 'Panela 500 g', 'Abarrotes', 2200, 3000, 'UNIDAD', 20, 6, True),
    ('7702129000017', 'Gaseosa 400 ml', 'Bebidas', 1600, 2500, 'BOTELLA', 48, 12, True),
    ('7702090023431', 'Agua 600 ml', 'Bebidas', 900, 1500, 'BOTELLA', 36, 12, False),
    ('7702001041015', 'Leche entera 1 L', 'Lácteos', 3400, 4200, 'UNIDAD', 24, 10, True),
    ('7702001112014', 'Huevo AA (unidad)', 'Abarrotes', 520, 700, 'UNIDAD', 90, 30, True),
    ('7702024001125', 'Pan tajado', 'Panadería', 4100, 5200, 'PAQUETE', 10, 3, False),
    ('7702191162016', 'Jabón en barra', 'Aseo', 2300, 3200, 'UNIDAD', 18, 6, False),
    ('7702010381218', 'Papel higiénico x4', 'Aseo', 5200, 6800, 'PAQUETE', 12, 4, False),
    ('7702189000017', 'Papas fritas 45 g', 'Mecato', 1500, 2200, 'BOLSA', 30, 10, True),
    (None, 'Tomate chonto', 'Fruver', 0, 3600, 'KG', 0, 0, True),
    (None, 'Plátano', 'Fruver', 0, 900, 'UNIDAD', 0, 0, True),
    (None, 'Cebolla cabezona', 'Fruver', 0, 3000, 'KG', 0, 0, False),
]


def sembrar_datos_iniciales(usuario, ejemplo=False):
    from catalogo.models import Categoria, Producto
    from catalogo.services import mover_stock, siguiente_codigo_interno
    from ventas.models import FormaPago

    for nombre, tipo, ref, color, orden in FORMAS_PAGO:
        FormaPago.objects.get_or_create(nombre=nombre, defaults={
            'tipo': tipo, 'requiere_referencia': ref, 'color': color, 'orden': orden})
    cats = {}
    for nombre, color, variable, stock in CATEGORIAS:
        cats[nombre], _ = Categoria.objects.get_or_create(nombre=nombre, defaults={
            'color': color, 'precio_variable': variable, 'controla_stock': stock})
    if ejemplo:
        for cod, nombre, cat, costo, venta, unidad, stock, minimo, fav in EJEMPLO:
            p = Producto.objects.create(
                codigo_barras=cod or siguiente_codigo_interno(), nombre=nombre, categoria=cats[cat],
                precio_costo=Decimal(costo), precio_venta=Decimal(venta), unidad_medida=unidad,
                stock_minimo=Decimal(minimo), favorito=fav)
            if stock:
                mover_stock(p, 'INICIAL', stock, usuario, motivo='Datos de ejemplo')
