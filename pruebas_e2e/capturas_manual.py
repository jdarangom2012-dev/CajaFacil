"""
Toma los pantallazos del manual de ayuda, con las opciones numeradas en rojo.

  python capturas_manual.py [URL] [usuario] [clave]
  (por defecto http://127.0.0.1:8770 admin 1234)

Usar SIEMPRE con datos de ejemplo (nunca con datos reales de un cliente): estas imágenes
se distribuyen dentro del instalador.

Guarda en frontend/public/manual/:
  <pantalla>.webp   pantallazo con números
  capturas.json     qué opción quedó con qué número (la app lo usa para la leyenda)
"""
import io
import json
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8770'
USUARIO = sys.argv[2] if len(sys.argv) > 2 else 'admin'
CLAVE = sys.argv[3] if len(sys.argv) > 3 else '1234'
SALIDA = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'manual'
SALIDA.mkdir(parents=True, exist_ok=True)
ANCHO = 1360

MARCAR = """
([seccion, ids]) => {
  document.getElementById('cf-marcas')?.remove()
  const capa = document.createElement('div')
  capa.id = 'cf-marcas'
  capa.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none'
  const hallados = []
  for (const id of ids) {
    const r = window.__cfAyuda.localizar(id, seccion)
    if (r && r.top >= 0 && r.top < innerHeight - 8) hallados.push({ id, r })
  }
  // orden de lectura: de arriba a abajo, de izquierda a derecha
  hallados.sort((a, b) => (Math.round(a.r.top / 48) - Math.round(b.r.top / 48)) || (a.r.left - b.r.left))
  const puestos = []
  hallados.forEach((h, i) => {
    const { r } = h
    const marco = document.createElement('div')
    marco.style.cssText = `position:fixed;top:${r.top - 3}px;left:${r.left - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;border:2px solid #F04438;border-radius:12px;box-shadow:0 0 0 3px rgba(240,68,56,.15)`
    capa.appendChild(marco)
    let x = Math.max(4, r.left - 14), y = Math.max(4, r.top - 14)
    while (puestos.some((p) => Math.abs(p.x - x) < 26 && Math.abs(p.y - y) < 26)) x += 28
    puestos.push({ x, y })
    const n = document.createElement('div')
    n.textContent = i + 1
    n.style.cssText = `position:fixed;top:${y}px;left:${x}px;width:28px;height:28px;border-radius:999px;background:#F04438;color:#fff;font:800 14px/28px "Plus Jakarta Sans Variable",sans-serif;text-align:center;box-shadow:0 0 0 3px #fff,0 4px 10px rgba(0,0,0,.25)`
    capa.appendChild(n)
  })
  document.body.appendChild(capa)
  return hallados.map((h) => h.id)
}
"""

mapa = {}


def foto(page, seccion, archivo):
    page.mouse.move(2, 2)
    page.wait_for_timeout(700)
    secciones = {s['id']: s['elementos'] for s in page.evaluate('window.__cfAyuda.secciones()')}
    ids = page.evaluate(MARCAR, [seccion, secciones[seccion]])
    page.wait_for_timeout(150)
    png = page.screenshot(full_page=False)
    page.evaluate("document.getElementById('cf-marcas')?.remove()")
    img = Image.open(io.BytesIO(png)).convert('RGB')
    if img.width > ANCHO:
        img = img.resize((ANCHO, round(img.height * ANCHO / img.width)), Image.LANCZOS)
    img.save(SALIDA / archivo, 'WEBP', quality=82, method=6)
    mapa[seccion] = ids
    print(f'{archivo:22s} {len(ids):2d} opciones numeradas')


with sync_playwright() as p:
    nav = p.chromium.launch()
    vista = {'width': 1440, 'height': 900}

    # Pantalla de ingreso (sin sesión)
    ctx0 = nav.new_context(viewport=vista, locale='es-CO')
    ctx0.add_init_script("localStorage.setItem('cf_tema','claro')")
    lp = ctx0.new_page()
    lp.goto(BASE)
    lp.wait_for_selector('text=Inicia sesión')
    lp.wait_for_function('!!window.__cfAyuda')
    foto(lp, 'primeros-pasos', 'login.webp')
    lp.get_by_placeholder('tu usuario').fill(USUARIO)
    lp.get_by_placeholder('••••').fill(CLAVE)
    lp.get_by_role('button', name='Entrar').click()
    lp.wait_for_timeout(1500)
    sesion = lp.evaluate("localStorage.getItem('cf_sesion')")
    ctx0.close()

    ctx = nav.new_context(viewport=vista, locale='es-CO')
    ctx.add_init_script(f"localStorage.setItem('cf_sesion', {json.dumps(sesion)}); localStorage.setItem('cf_tema','claro')")
    page = ctx.new_page()
    errores = []
    page.on('pageerror', lambda e: errores.append(str(e)))

    def ir(ruta, espera=1300):
        page.goto(BASE + ruta)
        page.wait_for_function('!!window.__cfAyuda')
        page.wait_for_timeout(espera)

    # Datos de ejemplo extra: una cajera (si no existe)
    page.goto(BASE + '/')
    page.evaluate("""async () => {
      const s = JSON.parse(localStorage.getItem('cf_sesion'))
      const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access }
      const r = await fetch('/api/auth/usuarios/', { headers: h }).then((x) => x.json())
      const lista = r.results || r
      if (!lista.some((u) => u.username === 'maria'))
        await fetch('/api/auth/usuarios/', { method: 'POST', headers: h, body: JSON.stringify(
          { username: 'maria', nombre_completo: 'María Gómez', rol: 'CAJERO', password: 'maria123', telefono: '3001112233' }) })
    }""")

    ir('/')
    foto(page, 'inicio', 'inicio.webp')

    ir('/vender')
    bus = page.get_by_placeholder('Escanea el código o escribe el nombre del producto…')
    for cod in ['2*7702004003508', '7702129000017', '7702001112014']:
        bus.fill(cod)
        bus.press('Enter')
        page.wait_for_timeout(350)
    foto(page, 'vender', 'vender.webp')

    page.keyboard.press('F2')
    page.wait_for_selector('text=Total a cobrar')
    page.get_by_role('button', name='$20.000').first.click()
    page.wait_for_timeout(400)
    foto(page, 'cobrar', 'cobrar.webp')
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    page.get_by_role('button', name='Vaciar').click()

    ir('/caja')
    foto(page, 'caja', 'caja.webp')
    ir('/ventas')
    foto(page, 'ventas', 'ventas.webp')
    ir('/productos')
    foto(page, 'productos', 'productos.webp')
    ir('/categorias')
    foto(page, 'categorias', 'categorias.webp')
    ir('/inventario')
    foto(page, 'inventario', 'inventario.webp')
    ir('/fiado')
    foto(page, 'fiado', 'fiado.webp')
    ir('/reportes')
    page.get_by_role('button', name='Este mes').first.click()
    page.wait_for_timeout(1200)
    foto(page, 'reportes', 'reportes.webp')
    ir('/auditoria')
    foto(page, 'auditoria', 'auditoria.webp')
    ir('/usuarios')
    foto(page, 'usuarios', 'usuarios.webp')
    ir('/configuracion?tab=impresora')
    foto(page, 'configuracion', 'configuracion.webp')

    (SALIDA / 'capturas.json').write_text(json.dumps(mapa, ensure_ascii=False, indent=1), encoding='utf-8')
    nav.close()
    print('Errores JS:', errores or 'ninguno')
    print('Listo:', SALIDA)
