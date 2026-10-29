/*
  Ayuda dentro de CajaFácil.
    · F1 con el mouse encima de una opción  → explica para qué sirve esa opción
    · F1 sin señalar nada                   → abre la ayuda de la pantalla actual
    · Botón "?" (o desde el panel)          → Modo ayuda: toca cualquier opción y te explica
    · Esc                                   → cierra
*/
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CircleHelp, MousePointerClick, X } from 'lucide-react'
import { Boton, Panel, cx } from '../components/ui'
import { useSesion } from '../context/Sesion'
import { SECCIONES, elementoPorId, elementoPorTexto, seccionPorId, seccionesDeRuta } from './manual'
import { ContenidoSeccion, IconoSeccion, Numero } from './Contenido'

const Ctx = createContext(null)
export const useAyuda = () => useContext(Ctx)

const INTERACTIVOS = 'button, a, label, input, select, textarea, [role="tab"], th, [data-ayuda-texto]'

function primeraLinea(t) {
  return String(t || '').split('\n').map((x) => x.trim()).find(Boolean) || ''
}

function textosDe(n) {
  const r = []
  if (n.dataset?.ayudaTexto) r.push(n.dataset.ayudaTexto)
  if (n.title) r.push(n.title)
  const tag = n.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    const et = n.closest('label')?.querySelector('.etiqueta')?.textContent
    if (et) r.push(et)
    if (n.placeholder) r.push(n.placeholder)
    if (n.getAttribute('aria-label')) r.push(n.getAttribute('aria-label'))
  } else if (tag === 'LABEL') {
    const et = n.querySelector('.etiqueta')?.textContent
    if (et) r.push(et)
    r.push(primeraLinea(n.innerText))
  } else {
    r.push(primeraLinea(n.innerText))
    if (n.getAttribute('aria-label')) r.push(n.getAttribute('aria-label'))
  }
  return r.filter(Boolean)
}

/** Desde el elemento señalado, sube buscando una opción que el manual conozca. */
export function resolver(el, preferidas) {
  // Dentro de una lista (productos, categorías…) no se lee el texto: puede ser el nombre de un producto
  const grupo = el?.closest?.('[data-ayuda-grupo]')
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.closest?.('[data-ayuda-ui]')) return null
    const id = n.dataset?.ayuda
    if (id) {
      const e = elementoPorId(id)
      if (e) return { e, nodo: n }
    }
    if (grupo && grupo !== n && grupo.contains(n)) continue
    if (n.matches?.(INTERACTIVOS)) {
      const enTabla = !!n.closest('tbody') // filas con datos: solo coincidencias exactas ("Ajustar", "Anular")
      for (const t of textosDe(n)) {
        const e = elementoPorTexto(t, preferidas, enTabla)
        if (e) return { e, nodo: n }
      }
    }
    if (n.classList?.contains('tarjeta') || n.tagName === 'SECTION' || n.tagName === 'ASIDE') {
      const h = n.querySelector('h1, h2, h3')
      if (h) {
        const e = elementoPorTexto(primeraLinea(h.innerText), preferidas)
        if (e) return { e, nodo: n }
      }
    }
  }
  return null
}

/** Ubica en pantalla el elemento de una opción del manual (para numerar los pantallazos). */
export function localizar(id, preferidas) {
  const marcado = [...document.querySelectorAll(`[data-ayuda="${id}"]`)].find(visible)
  if (marcado) return marcado
  for (const n of document.querySelectorAll(INTERACTIVOS + ', .tarjeta, section, aside')) {
    if (!visible(n)) continue
    const r = resolver(n, preferidas)
    if (r?.e.id === id && r.nodo === n) return n
  }
  return null
}

function visible(n) {
  const r = n.getBoundingClientRect()
  if (!(r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth)) return false
  // que no esté tapado ni escondido dentro de un contenedor con scroll
  const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1)
  const y = Math.min(Math.max(r.top + Math.min(r.height / 2, 20), 1), innerHeight - 1)
  const arriba = document.elementFromPoint(x, y)
  return !!arriba && (n === arriba || n.contains(arriba) || arriba.contains(n))
}

/* ── Cajita que explica una opción ─────────────────────────────────── */
function Explicacion({ info, onCerrar, onPantalla }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const caja = info.rect

  useLayoutEffect(() => {
    const w = Math.min(360, innerWidth - 24)
    const h = ref.current?.offsetHeight || 180
    let top = caja.bottom + 12
    if (top + h > innerHeight - 12) top = Math.max(12, caja.top - h - 12)
    let left = caja.left + caja.width / 2 - w / 2
    left = Math.max(12, Math.min(left, innerWidth - w - 12))
    setPos({ top, left, w })
  }, [caja])

  const seccion = seccionPorId(info.e.seccion)
  return (
    <div data-ayuda-ui className="fixed inset-0 z-[70]" onMouseDown={onCerrar}>
      <div className="pointer-events-none fixed rounded-xl ring-4 ring-marca-500/70 ring-offset-2 transition-all"
        style={{ top: caja.top - 4, left: caja.left - 4, width: caja.width + 8, height: caja.height + 8 }} />
      <div ref={ref} onMouseDown={(e) => e.stopPropagation()}
        className="fixed rounded-2xl border border-slate-200 bg-superficie p-4 shadow-flotante animate-aparecer"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: pos?.w ?? 360 }}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-600"><CircleHelp className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-tinta-4">{seccion?.titulo}</p>
            <p className="text-base font-extrabold leading-snug text-tinta">{info.e.titulo}</p>
          </div>
          <button onClick={onCerrar} className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-tinta-2">{info.e.texto}</p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <button onClick={() => onPantalla(info.e.seccion, info.e.id)} className="text-sm font-bold text-marca-700 hover:underline">Ver la ayuda de esta pantalla</button>
          <span className="hidden text-xs text-tinta-4 sm:inline"><span className="kbd">Esc</span> cerrar</span>
        </div>
      </div>
    </div>
  )
}

/* ── Panel con la ayuda de la pantalla ─────────────────────────────── */
function PanelPantalla({ estado, onCerrar, onModo, onManual, hayManual }) {
  const [actual, setActual] = useState(estado?.secciones[0])
  useEffect(() => { setActual(estado?.secciones[0]) }, [estado])
  useEffect(() => {
    if (!estado?.resaltar) return
    const t = setTimeout(() => document.getElementById(`ayuda-${estado.resaltar}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)
    return () => clearTimeout(t)
  }, [estado, actual])
  if (!estado) return null
  const s = seccionPorId(actual) || seccionPorId(estado.secciones[0])
  return (
    <Panel abierto onCerrar={onCerrar} ancho="max-w-2xl"
      titulo={<span className="flex items-center gap-2"><IconoSeccion nombre={s.icono} className="h-5 w-5 text-marca-600" /> Ayuda: {s.titulo}</span>}
      subtitulo="Lee con calma. Puedes volver aquí cuando quieras con la tecla F1."
      pie={<>
        {hayManual && <Boton variante="secundario" icono={BookOpen} onClick={onManual}>Manual completo</Boton>}
        <Boton icono={MousePointerClick} onClick={onModo}>Señalar una opción</Boton>
      </>}>
      <div data-ayuda-ui>
        {estado.secciones.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {estado.secciones.map((id) => {
              const x = seccionPorId(id)
              return (
                <button key={id} onClick={() => setActual(id)} className={cx('rounded-full px-3.5 py-1.5 text-sm font-bold',
                  id === s.id ? 'bg-marca-600 text-white' : 'bg-slate-100 text-tinta-3 hover:bg-slate-200')}>{x.titulo}</button>
              )
            })}
          </div>
        )}
        <ContenidoSeccion seccion={s} compacto resaltar={estado.resaltar} />
      </div>
    </Panel>
  )
}

/* ── Barra del modo ayuda ──────────────────────────────────────────── */
function BarraModo({ onSalir, onPantalla, hover }) {
  return (
    <>
      {hover && (
        <div className="pointer-events-none fixed z-[65] rounded-xl border-2 border-dashed border-marca-500 bg-marca-500/10"
          style={{ top: hover.top - 4, left: hover.left - 4, width: hover.width + 8, height: hover.height + 8 }} />
      )}
      <div data-ayuda-ui className="fixed inset-x-0 top-3 z-[75] flex justify-center px-3">
        <div className="flex max-w-xl flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl bg-noche px-5 py-3 text-white shadow-flotante animate-aparecer">
          <span className="flex items-center gap-2 text-sm font-bold"><MousePointerClick className="h-5 w-5 text-marca-300" /> Modo ayuda: toca cualquier opción para saber para qué sirve</span>
          <span className="flex gap-2">
            <button onClick={onPantalla} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">Ayuda de la pantalla</button>
            <button onClick={onSalir} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-noche hover:bg-slate-100">Salir</button>
          </span>
        </div>
      </div>
    </>
  )
}

export function AyudaProvider({ children }) {
  const loc = useLocation()
  const navegar = useNavigate()
  const { usuario } = useSesion()
  const [explicacion, setExplicacion] = useState(null)
  const [panel, setPanel] = useState(null)
  const [modo, setModo] = useState(false)
  const [hover, setHover] = useState(null)
  const mouse = useRef({ x: -1, y: -1, t: 0 })
  const foco = useRef(0)

  const secciones = useCallback(() => {
    if (!usuario) return ['primeros-pasos']
    const s = seccionesDeRuta(loc.pathname).map((x) => x.id)
    return s.length ? s : ['primeros-pasos']
  }, [loc.pathname, usuario])
  const preferidas = useCallback(() => secciones().map(seccionPorId), [secciones])

  const explicar = useCallback((el) => {
    const r = el && resolver(el, preferidas())
    if (!r) return false
    setExplicacion({ e: r.e, rect: r.nodo.getBoundingClientRect() })
    return true
  }, [preferidas])

  const abrirPantalla = useCallback((seccion, resaltar) => {
    setExplicacion(null)
    setModo(false)
    const lista = secciones()
    const orden = seccion && !lista.includes(seccion) ? [seccion, ...lista] : seccion ? [seccion, ...lista.filter((x) => x !== seccion)] : lista
    setPanel({ secciones: orden, resaltar })
  }, [secciones])

  const abrirManual = useCallback((seccion) => {
    setPanel(null); setExplicacion(null); setModo(false)
    navegar(seccion ? `/ayuda#${seccion}` : '/ayuda')
  }, [navegar])

  // Teclado: F1 y Esc (en captura, para ganarle a las ventanas abiertas)
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'F1') {
        e.preventDefault(); e.stopPropagation()
        if (explicacion) { setExplicacion(null); return }
        if (panel) { setPanel(null); return }
        // Lo último que usó la persona: el mouse (lo que señala) o el teclado (la casilla donde escribe)
        const { x, y, t } = mouse.current
        const activo = document.activeElement
        const usaTeclado = foco.current > t && activo && activo !== document.body
        if (usaTeclado && explicar(activo)) return
        const bajo = x >= 0 ? document.elementFromPoint(x, y) : null
        if (explicar(bajo)) return
        abrirPantalla()
      } else if (e.key === 'Tab' || (e.target?.matches?.('input, textarea, select') && e.key.length === 1)) {
        foco.current = Date.now()
      } else if (e.key === 'Escape') {
        if (explicacion) { e.preventDefault(); e.stopPropagation(); setExplicacion(null) }
        else if (modo) { e.preventDefault(); e.stopPropagation(); setModo(false); setHover(null) }
      }
    }
    const m = (e) => {
      const p = mouse.current
      if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 3) mouse.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    }
    window.addEventListener('keydown', h, true)
    window.addEventListener('mousemove', m, { passive: true })
    return () => { window.removeEventListener('keydown', h, true); window.removeEventListener('mousemove', m) }
  }, [explicacion, panel, modo, explicar, abrirPantalla])

  // Modo ayuda: los clics explican en vez de ejecutar
  useEffect(() => {
    if (!modo) return
    const propio = (t) => t.closest?.('[data-ayuda-ui]')
    const bloquear = (e) => { if (!propio(e.target)) { e.preventDefault(); e.stopPropagation() } }
    const clic = (e) => {
      if (propio(e.target)) return
      e.preventDefault(); e.stopPropagation()
      setHover(null)
      if (!explicar(e.target)) {
        setExplicacion({ e: { id: '', seccion: secciones()[0], titulo: 'Esta parte no tiene explicación propia', texto: 'Toca un botón, una casilla o un título. También puedes ver la ayuda completa de esta pantalla.' }, rect: e.target.getBoundingClientRect() })
      }
    }
    let raf = 0
    const mover = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (propio(e.target)) return setHover(null)
        const r = resolver(e.target, preferidas())
        setHover(r ? r.nodo.getBoundingClientRect() : null)
      })
    }
    document.addEventListener('pointerdown', bloquear, true)
    document.addEventListener('mousedown', bloquear, true)
    document.addEventListener('click', clic, true)
    document.addEventListener('mousemove', mover, true)
    return () => {
      document.removeEventListener('pointerdown', bloquear, true)
      document.removeEventListener('mousedown', bloquear, true)
      document.removeEventListener('click', clic, true)
      document.removeEventListener('mousemove', mover, true)
      cancelAnimationFrame(raf)
    }
  }, [modo, explicar, preferidas, secciones])

  // Al cambiar de pantalla se cierra todo
  useEffect(() => { setExplicacion(null); setPanel(null) }, [loc.pathname])

  // Para el script que toma los pantallazos del manual
  useEffect(() => {
    window.__cfAyuda = {
      secciones: () => SECCIONES.map((s) => ({ id: s.id, elementos: s.elementos.map((e) => e.id) })),
      localizar: (id, seccion) => {
        const n = localizar(id, [seccionPorId(seccion)].filter(Boolean))
        if (!n) return null
        const r = n.getBoundingClientRect()
        return { top: r.top, left: r.left, width: r.width, height: r.height }
      },
    }
  }, [])

  const valor = { abrirPantalla, abrirManual, activarModo: () => { setPanel(null); setExplicacion(null); setModo(true) }, modo }
  return (
    <Ctx.Provider value={valor}>
      {children}
      {modo && <BarraModo hover={hover} onSalir={() => { setModo(false); setHover(null) }} onPantalla={() => abrirPantalla()} />}
      {explicacion && (
        <Explicacion info={explicacion} onCerrar={() => setExplicacion(null)}
          onPantalla={(s, id) => abrirPantalla(s, id)} />
      )}
      <PanelPantalla estado={panel} onCerrar={() => setPanel(null)} hayManual={!!usuario}
        onModo={() => { setPanel(null); setModo(true) }} onManual={() => abrirManual(panel?.secciones[0])} />
    </Ctx.Provider>
  )
}

/** Botón "?" de la barra superior. */
export function BotonAyuda() {
  const a = useAyuda()
  return (
    <button data-ayuda-ui onClick={() => (a.modo ? null : a.activarModo())} title="Ayuda (F1)"
      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-tinta-3 hover:border-marca-300 hover:bg-marca-50 hover:text-marca-700">
      <CircleHelp className="h-5 w-5" />
      <span className="hidden md:inline">Ayuda</span>
      <span className="kbd hidden md:inline">F1</span>
    </button>
  )
}

export { Numero }
