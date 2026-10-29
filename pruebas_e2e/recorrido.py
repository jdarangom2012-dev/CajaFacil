"""Recorrido de punta a punta de CajaFacil en el navegador, con capturas."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8770'
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else '/home/claude/e2e/capturas')
OUT.mkdir(parents=True, exist_ok=True)
errores = []


def foto(page, nombre):
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f'{nombre}.png'), full_page=False)
    print('captura', nombre)


with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={'width': 1440, 'height': 900}, locale='es-CO')
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and errores.append(m.text))
    page.on('pageerror', lambda e: errores.append(str(e)))

    # 1. Asistente de bienvenida
    page.goto(BASE)
    expect(page.get_by_text('Configuremos tu caja')).to_be_visible()
    page.get_by_placeholder('Ej: Tienda El Gordo').fill('Tienda El Gordo')
    page.locator('label:has-text("NIT") input').fill('71.234.567')
    page.locator('label:has-text("Teléfono") input').fill('3151355693')
    page.locator('label:has-text("Ciudad") input').fill('Medellín')
    foto(page, '01_bienvenida')
    page.get_by_role('button', name='Continuar').click()
    page.get_by_placeholder('Nombre del dueño o administrador').fill('Juan Arango')
    page.locator('label:has-text("Contraseña *") input').first.fill('1234')
    page.locator('label:has-text("Repite") input').fill('1234')
    page.get_by_role('button', name='Empezar a vender').click()

    # 2. Inicio
    expect(page.get_by_text('Buen', exact=False).first).to_be_visible(timeout=10000)
    page.wait_for_timeout(800)
    foto(page, '02_inicio_vacio')

    # 3. Abrir caja desde Vender
    page.keyboard.press('F3')
    expect(page.get_by_text('Abre la caja para empezar')).to_be_visible()
    page.get_by_role('button', name='$100 mil').click()
    foto(page, '03_abrir_caja')
    page.get_by_role('button', name='Abrir caja').click()
    expect(page.get_by_placeholder('Escanea el código o escribe el nombre del producto…')).to_be_visible()
    page.wait_for_timeout(600)

    # 4. Venta: código de barras con multiplicador + tecla rápida + fruver por valor
    bus = page.get_by_placeholder('Escanea el código o escribe el nombre del producto…')
    bus.fill('2*7702004003508')
    bus.press('Enter')
    page.wait_for_timeout(400)
    bus.fill('7702129000017')
    bus.press('Enter')
    page.wait_for_timeout(400)
    page.locator('button:has-text("Leche entera 1 L")').first.click()
    page.wait_for_timeout(300)
    page.locator('button:has-text("Tomate chonto")').first.click()
    expect(page.get_by_text('¿Cuánto vende?').or_(page.get_by_text('Cantidad (kg)'))).to_be_visible()
    page.get_by_role('button', name='Por valor ($)').click()
    page.get_by_role('button', name='$2.000').click()
    foto(page, '04_fruver_precio_libre')
    page.get_by_role('button', name='Agregar').click()
    page.wait_for_timeout(400)
    bus.fill('pap')
    page.wait_for_timeout(700)
    foto(page, '05_busqueda')
    bus.fill('')
    page.wait_for_timeout(300)
    foto(page, '06_venta_carrito')

    # 5. Cobrar en efectivo con $20.000
    page.keyboard.press('F2')
    expect(page.get_by_text('Total a cobrar').last).to_be_visible()
    page.get_by_role('button', name='$20.000').click()
    page.wait_for_timeout(300)
    foto(page, '07_cobro')
    page.get_by_role('button', name='Confirmar venta').click()
    expect(page.get_by_text('¡Venta registrada!')).to_be_visible(timeout=10000)
    foto(page, '08_venta_exitosa')
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)

    # 6. Venta fiada con cliente nuevo y pago mixto
    bus.fill('7702001112014')
    bus.press('Enter')
    page.wait_for_timeout(300)
    bus.fill('10*7702001112014')
    bus.press('Enter')
    page.wait_for_timeout(300)
    page.locator('button:has-text("Panela 500 g")').first.click()
    page.keyboard.press('F2')
    page.get_by_role('button', name='Fiado').click()
    page.get_by_role('button', name='Nuevo').click()
    page.get_by_placeholder('Nombre del cliente').fill('doña rosa elena')
    page.get_by_placeholder('Celular (para cobrar por WhatsApp)').fill('3001234567')
    page.get_by_role('button', name='Crear cliente').click()
    page.wait_for_timeout(700)
    foto(page, '09_cobro_fiado')
    page.get_by_role('button', name='Confirmar venta').click()
    expect(page.get_by_text('Se registró el fiado')).to_be_visible(timeout=10000)
    page.get_by_role('button', name='Nueva venta').click()
    page.wait_for_timeout(500)

    # 7. Fiado: estado de cuenta
    page.goto(BASE + '/fiado')
    page.wait_for_timeout(900)
    foto(page, '10_fiado')
    page.get_by_text('Doña Rosa Elena').first.click()
    page.wait_for_timeout(900)
    foto(page, '11_estado_cuenta')
    page.get_by_role('button', name='Abonar').click()
    page.get_by_role('button', name='$5.000').click()
    page.get_by_role('button', name='Registrar abono').click()
    page.wait_for_timeout(900)
    page.keyboard.press('Escape')

    # 8. Productos e inventario
    page.goto(BASE + '/productos')
    page.wait_for_timeout(900)
    foto(page, '12_productos')
    page.get_by_role('button', name='Nuevo', exact=True).click()
    page.wait_for_timeout(400)
    foto(page, '13_nuevo_producto')
    page.keyboard.press('Escape')
    page.goto(BASE + '/inventario?tab=pedido')
    page.wait_for_timeout(900)
    foto(page, '14_pedido_sugerido')

    # 9. Caja: salida de efectivo y cierre
    page.goto(BASE + '/caja')
    page.wait_for_timeout(800)
    page.get_by_role('button', name='Sacar dinero').click()
    page.get_by_role('button', name='Pago a proveedor').click()
    page.locator('.campo').first.fill('8000')
    page.get_by_role('button', name='Registrar').click()
    page.wait_for_timeout(800)
    foto(page, '15_caja_turno')
    page.get_by_role('button', name='Cerrar caja').first.click()
    page.get_by_role('button', name='Total directo').click()
    page.wait_for_timeout(300)
    foto(page, '16_cierre')
    page.keyboard.press('Escape')

    # 10. Inicio con datos, reportes, auditoría, configuración
    page.goto(BASE + '/')
    page.wait_for_timeout(1200)
    foto(page, '17_inicio_con_ventas')
    page.goto(BASE + '/reportes')
    page.wait_for_timeout(1200)
    foto(page, '18_reportes')
    page.goto(BASE + '/auditoria')
    page.wait_for_timeout(900)
    foto(page, '19_auditoria')
    page.goto(BASE + '/configuracion?tab=impresora')
    page.wait_for_timeout(900)
    foto(page, '20_config_impresora')
    page.goto(BASE + '/configuracion?tab=licencia')
    page.wait_for_timeout(900)
    foto(page, '21_config_licencia')

    # 11. Móvil
    movil = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    movil.add_init_script(f"localStorage.setItem('cf_sesion', {repr(page.evaluate('localStorage.getItem(\"cf_sesion\")'))})")
    mp = movil.new_page()
    mp.on('pageerror', lambda e: errores.append('movil: ' + str(e)))
    mp.goto(BASE + '/')
    mp.wait_for_timeout(1500)
    foto(mp, '22_movil_inicio')
    mp.goto(BASE + '/vender')
    mp.wait_for_timeout(1200)
    foto(mp, '23_movil_vender')
    mp.goto(BASE + '/fiado')
    mp.wait_for_timeout(1200)
    foto(mp, '24_movil_fiado')

    # tablet
    tab = nav.new_context(viewport={'width': 1024, 'height': 768})
    tab.add_init_script(f"localStorage.setItem('cf_sesion', {repr(page.evaluate('localStorage.getItem(\"cf_sesion\")'))})")
    tp = tab.new_page()
    tp.goto(BASE + '/vender')
    tp.wait_for_timeout(1200)
    foto(tp, '25_tablet_vender')

    # Login
    ctx2 = nav.new_context(viewport={'width': 1440, 'height': 900})
    lp = ctx2.new_page()
    lp.goto(BASE)
    lp.wait_for_timeout(1000)
    foto(lp, '00_login')
    nav.close()

print('ERRORES JS:', errores if errores else 'ninguno')
