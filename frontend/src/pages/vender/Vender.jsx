import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote, Barcode, ChevronUp, Clock, Inbox, Minus, PauseCircle, Plus, ScanLine, Settings2, ShoppingBasket, Star,
  Trash2, Vault, X,
} from 'lucide-react'
import { api, mensajeError } from '../../api/cliente'
import AbrirCaja from '../../components/AbrirCaja'
import { Boton, Cargando, Entrada, Modal, cx, useDebounce } from '../../components/ui'
import { useAviso } from '../../context/Aviso'
import { useSesion } from '../../context/Sesion'
import { useConfiguracion } from '../../hooks/datos'
import { aNumero, cantidad as fmtCant, numero, pesos, UNIDADES } from '../../lib/formato'
import { impresionLocal } from '../../lib/impresion'
import ModalCobro from './ModalCobro'
import ModalPrecio from './ModalPrecio'

const nuevaClave = () => Math.random().toString(36).slice(2, 10)

function lineaDesdeProducto(p, cantidad = 1, precio = null) {
  return {
    clave: nuevaClave(), producto_id: p.id, nombre: p.nombre, codigo: p.codigo_barras,
    precio_unit: Number(precio ?? p.precio_venta), cantidad: Number(cantidad), descuento: 0,
    unidad: p.unidad_medida, precio_variable: p.precio_variable, por_peso: p.se_vende_por_peso,
    controla_stock: p.controla_stock, stock: Number(p.stock), color: p.categoria_color,
  }
}

const totalLinea = (l) => l.precio_unit * l.cantidad - (l.descuento || 0)

/* ── Tecla rápida de producto ───────────────────────────── */
function TeclaProducto({ p, onClick }) {
  const agotado = p.controla_stock && Number(p.stock) <= 0
  return (
    <button onClick={() => onClick(p)}
      className="group relative flex h-full min-h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-superficie p-3 text-left transition hover:-translate-y-0.5 hover:border-marca-300 hover:shadow-suave active:scale-[.98]">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.categoria_color || '#1570EF' }} />
      {p.imagen_url
        ? <img src={p.imagen_url} alt="" className="mb-1 h-12 w-full rounded-lg object-contain" />
        : null}
      <span className="line-clamp-2 text-[13px] font-bold leading-snug text-tinta-2">{p.nombre}</span>
      <span className="mt-1 flex items-end justify-between gap-1">
        <span className="text-sm font-extrabold text-marca-700 tabular-nums">
          {p.precio_variable ? <span className="text-xs font-bold text-exito-700">Precio libre</span> : pesos(p.precio_venta)}
        </span>
        {p.controla_stock && (
          <span className={cx('text-[10px] font-bold', agotado ? 'text-peligro-600' : 'text-tinta-4')}>
            {agotado ? 'Agotado' : `${numero(p.stock)} ${UNIDADES[p.unidad_medida] || ''}`}
          </span>
        )}
      </span>
    </button>
  )
}

/* ── Línea del carrito ──────────────────────────────────── */
function LineaCarrito({ l, onCantidad, onQuitar, onEditar, resaltada }) {
  const decimal = l.por_peso
  return (
    <div data-ayuda="vender.linea" data-ayuda-grupo className={cx('group flex gap-3 rounded-2xl border px-3 py-2.5 transition', resaltada ? 'border-marca-300 bg-marca-50/60 animate-pop' : 'border-transparent hover:bg-slate-50')}>
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: l.color || '#1570EF' }} />
      <div className="min-w-0 flex-1">
        <button onClick={onEditar} className="block w-full truncate text-left text-sm font-bold text-tinta-2 hover:text-marca-700">{l.nombre}</button>
        <p className="text-xs text-tinta-4 tabular-nums">
          {pesos(l.precio_unit)}{decimal ? ` / ${UNIDADES[l.unidad]}` : ''}
          {l.descuento > 0 && <span className="ml-1 font-semibold text-exito-700">− {pesos(l.descuento)}</span>}
          {l.controla_stock && l.cantidad > l.stock && <span className="ml-1 font-semibold text-alerta-600">· stock {numero(l.stock)}</span>}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-extrabold tabular-nums">{pesos(totalLinea(l))}</span>
        <div className="flex items-center gap-1">
          {decimal
            ? <button onClick={onEditar} className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums hover:bg-slate-200">{fmtCant(l.cantidad, l.unidad)}</button>
            : <>
              <button onClick={() => onCantidad(l.cantidad - 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-7 text-center text-sm font-bold tabular-nums">{numero(l.cantidad)}</span>
              <button onClick={() => onCantidad(l.cantidad + 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200"><Plus className="h-3.5 w-3.5" /></button>
            </>}
          <button onClick={onQuitar} className="ml-0.5 grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-peligro-50 hover:text-peligro-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  )
}

/* ── Editar línea (cantidad, precio libre, descuento) ───── */
function ModalLinea({ linea, onCerrar, onGuardar }) {
  const [c, setC] = useState(linea?.cantidad ?? 1)
  const [d, setD] = useState(linea?.descuento ?? 0)
  const [pr, setPr] = useState(linea?.precio_unit ?? 0)
  useEffect(() => { if (linea) { setC(linea.cantidad); setD(linea.descuento); setPr(linea.precio_unit) } }, [linea])
  if (!linea) return null
  const bruto = pr * aNumero(c)
  return (
    <Modal abierto onCerrar={onCerrar} titulo={linea.nombre} ancho="sm"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => onGuardar({ cantidad: aNumero(c), descuento: Math.min(aNumero(d), bruto), precio_unit: aNumero(pr) })}>Aplicar</Boton></>}>
      <div className="space-y-4">
        <label className="block"><span className="etiqueta">Cantidad {linea.por_peso ? `(${UNIDADES[linea.unidad]})` : ''}</span>
          <Entrada autoFocus inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} onFocus={(e) => e.target.select()} /></label>
        {linea.precio_variable && (
          <label className="block"><span className="etiqueta">Precio por {UNIDADES[linea.unidad]}</span>
            <Entrada inputMode="decimal" value={pr} onChange={(e) => setPr(aNumero(e.target.value))} /></label>
        )}
        <label className="block"><span className="etiqueta">Descuento en pesos</span>
          <Entrada inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} onFocus={(e) => e.target.select()} /></label>
        <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span className="text-tinta-4">Total línea</span><b className="tabular-nums">{pesos(bruto - Math.min(aNumero(d), bruto))}</b>
        </div>
        <p className="text-xs text-tinta-4">Los descuentos quedan registrados en la auditoría.</p>
      </div>
    </Modal>
  )
}

export default function Vender() {
  const { caja, cargarCaja, esGestion, puedeInventario } = useSesion()
  const aviso = useAviso()
  const navegar = useNavigate()
  const conf = useConfiguracion()
  const busRef = useRef(null)

  const [carrito, setCarrito] = useState([])
  const [ultimaClave, setUltimaClave] = useState(null)
  const [texto, setTexto] = useState('')
  const textoD = useDebounce(texto, 180)
  const [resultados, setResultados] = useState([])
  const [rapidos, setRapidos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cat, setCat] = useState('rapidos')
  const [productosCat, setProductosCat] = useState([])
  const [precioPara, setPrecioPara] = useState(null)
  const [editar, setEditar] = useState(null)
  const [cobrar, setCobrar] = useState(false)
  const [esperas, setEsperas] = useState([])
  const [verCarrito, setVerCarrito] = useState(false)

  const total = useMemo(() => carrito.reduce((s, l) => s + totalLinea(l), 0), [carrito])
  const descuentos = useMemo(() => carrito.reduce((s, l) => s + (l.descuento || 0), 0), [carrito])
  const items = useMemo(() => carrito.reduce((s, l) => s + (l.por_peso ? 1 : l.cantidad), 0), [carrito])

  const enfocar = useCallback(() => setTimeout(() => busRef.current?.focus(), 30), [])

  const cargarEsperas = useCallback(() => api.get('/ventas/en-espera/').then(({ data }) => setEsperas(data)).catch(() => {}), [])
  useEffect(() => {
    api.get('/catalogo/productos/rapidos/').then(({ data }) => setRapidos(data)).catch(() => {})
    api.get('/catalogo/categorias/', { params: { activas: 1 } }).then(({ data }) => setCategorias(data)).catch(() => {})
    cargarEsperas()
  }, [cargarEsperas])

  useEffect(() => {
    if (cat === 'rapidos') return
    api.get('/catalogo/productos/', { params: { categoria: cat, page_size: 120 } })
      .then(({ data }) => setProductosCat(data.results || data)).catch(() => {})
  }, [cat])

  useEffect(() => {
    const q = textoD.replace(/^\d+(\.\d+)?\*/, '').trim()
    if (q.length < 2 || /^\d{6,}$/.test(q)) { setResultados([]); return }
    api.get('/catalogo/productos/buscar/', { params: { q } }).then(({ data }) => setResultados(data)).catch(() => {})
  }, [textoD])

  const agregar = useCallback((p, cant = 1, precio = null) => {
    if (p.precio_variable && precio == null) { setPrecioPara({ producto: p, cantidad: cant }); return }
    setCarrito((c) => {
      const idx = !p.precio_variable && !p.se_vende_por_peso ? c.findIndex((l) => l.producto_id === p.id && !l.descuento) : -1
      if (idx >= 0) {
        const copia = [...c]
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + Number(cant) }
        setUltimaClave(copia[idx].clave)
        return copia
      }
      const l = lineaDesdeProducto(p, cant, precio)
      setUltimaClave(l.clave)
      return [...c, l]
    })
    setTexto('')
    setResultados([])
    enfocar()
  }, [enfocar])

  /** Enter en el buscador: código de barras (admite "3*codigo") o primer resultado. */
  const alEnter = async () => {
    const t = texto.trim()
    if (!t) { if (carrito.length) setCobrar(true); return }
    let cant = 1
    let cod = t
    const m = t.match(/^(\d+(?:[.,]\d+)?)\*(.+)$/)
    if (m) { cant = aNumero(m[1]); cod = m[2].trim() }
    try {
      const { data } = await api.get('/catalogo/productos/buscar/', { params: { codigo: cod } })
      if (data) { agregar(data, cant); return }
    } catch { /* sigue con texto */ }
    if (resultados.length === 1 || (resultados.length && !/^\d+$/.test(cod))) { agregar(resultados[0], cant); return }
    aviso.error(`No se encontró el código "${cod}"`)
    setTexto('')
  }

  const cambiarCantidad = (clave, cant) => {
    if (cant <= 0) { setCarrito((c) => c.filter((l) => l.clave !== clave)); return }
    setCarrito((c) => c.map((l) => (l.clave === clave ? { ...l, cantidad: cant } : l)))
  }

  const ponerEnEspera = async () => {
    if (!carrito.length) return
    const nombre = window.prompt('Nombre para identificar la cuenta (opcional):', '') ?? null
    if (nombre === null) return
    try {
      await api.post('/ventas/en-espera/', { nombre, items: carrito, total })
      setCarrito([])
      cargarEsperas()
      aviso.info('Venta puesta en espera')
      enfocar()
    } catch (e) { aviso.error(mensajeError(e)) }
  }

  const recuperar = async (cuenta) => {
    try {
      if (carrito.length) await api.post('/ventas/en-espera/', { nombre: 'Venta en curso', items: carrito, total })
      await api.delete(`/ventas/en-espera/${cuenta.id}/`)
      setCarrito(cuenta.items)
      cargarEsperas()
      enfocar()
    } catch (e) { aviso.error(mensajeError(e)) }
  }

  const abrirCajon = async () => {
    if (impresionLocal()) { aviso.info('En esta caja el cajón se abre con la impresora local.'); return }
    try {
      const { data } = await api.post('/sistema/hardware/abrir-cajon/')
      if (data.ok) aviso.info('Cajón abierto')
      else aviso.error(data.error || 'El cajón se abre con la impresora directa (configúrala en Configuración).')
    } catch (e) { aviso.error(mensajeError(e)) }
  }

  // Atajos de teclado
  useEffect(() => {
    const h = (e) => {
      if (cobrar || precioPara || editar) return
      if (e.key === 'F2') { e.preventDefault(); if (carrito.length) setCobrar(true) }
      else if (e.key === 'F4') { e.preventDefault(); ponerEnEspera() }
      else if (e.key === 'F8') { e.preventDefault(); abrirCajon() }
      else if (e.key === 'Escape') { setTexto(''); setResultados([]) }
      else if (e.key === 'Delete' && document.activeElement === busRef.current && !texto && carrito.length) {
        setCarrito((c) => c.slice(0, -1))
      } else if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        busRef.current?.focus() // un lector de código siempre llega al buscador
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  if (!caja) return <Cargando />
  if (!caja.abierta) return <div className="p-5 lg:p-10"><AbrirCaja onAbierta={enfocar} /></div>

  const lista = cat === 'rapidos' ? rapidos : productosCat

  const panelCarrito = (
    <div className="flex h-full flex-col" data-ayuda="vender.carrito">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-5 w-5 text-marca-600" />
          <h2 className="font-extrabold">Venta actual</h2>
          {items > 0 && <span className="chip bg-marca-50 text-marca-700">{numero(items)} {items === 1 ? 'producto' : 'productos'}</span>}
        </div>
        {carrito.length > 0 && <button onClick={() => setCarrito([])} className="text-xs font-bold text-tinta-4 hover:text-peligro-600">Vaciar</button>}
      </div>
      {esperas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scroll-fino px-4 pb-2">
          {esperas.map((e) => (
            <button key={e.id} onClick={() => recuperar(e)} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-alerta-200 bg-alerta-50 px-2.5 py-1.5 text-xs font-bold text-alerta-700 hover:bg-alerta-100">
              <Clock className="h-3.5 w-3.5" /> {e.nombre || 'En espera'} · {pesos(e.total)}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto scroll-fino px-2">
        {carrito.length === 0
          ? <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center text-tinta-4">
              <span className="mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-slate-100"><ScanLine className="h-8 w-8 text-slate-400" /></span>
              <p className="font-bold text-tinta-3">Escanea o busca un producto</p>
              <p className="mt-1 text-sm">Usa <span className="kbd">3*</span> antes del código para vender varias unidades.</p>
            </div>
          : carrito.map((l) => (
            <LineaCarrito key={l.clave} l={l} resaltada={l.clave === ultimaClave}
              onCantidad={(n) => cambiarCantidad(l.clave, n)}
              onQuitar={() => cambiarCantidad(l.clave, 0)}
              onEditar={() => setEditar(l)} />
          ))}
      </div>
      <div className="border-t border-slate-200 bg-slate-50/60 p-4">
        {descuentos > 0 && <div className="mb-1 flex justify-between text-sm text-exito-700"><span>Descuentos</span><b>−{pesos(descuentos)}</b></div>}
        <div className="flex items-end justify-between" data-ayuda="vender.total">
          <span className="text-sm font-semibold text-tinta-4">Total a cobrar</span>
          <span className="text-4xl font-extrabold tracking-tight tabular-nums">{pesos(total)}</span>
        </div>
        <div className="mt-3 grid grid-cols-[auto_auto_1fr] gap-2">
          <Boton variante="secundario" tamano="lg" className="px-3" onClick={ponerEnEspera} disabled={!carrito.length} title="Poner en espera (F4)"><PauseCircle className="h-5 w-5" /></Boton>
          <Boton variante="secundario" tamano="lg" className="px-3" onClick={abrirCajon} title="Abrir cajón (F8)"><Vault className="h-5 w-5" /></Boton>
          <Boton variante="exito" tamano="lg" icono={Banknote} disabled={!carrito.length} onClick={() => setCobrar(true)}>
            Cobrar <span className="ml-1 rounded-md bg-white/20 px-1.5 text-xs">F2</span>
          </Boton>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:flex-row">
      {/* Columna de productos */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative border-b border-slate-200 bg-superficie px-4 py-3 lg:px-6">
          <div className="relative">
            <Barcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-marca-600" />
            <input
              ref={busRef}
              data-ayuda="vender.buscar"
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); alEnter() } }}
              placeholder="Escanea el código o escribe el nombre del producto…"
              className="h-14 w-full rounded-2xl border-2 border-marca-200 bg-marca-50/30 pl-12 pr-12 text-lg font-semibold outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-marca-500 focus:bg-superficie focus:ring-4 focus:ring-marca-100"
            />
            {texto && <button onClick={() => { setTexto(''); setResultados([]); enfocar() }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>}
          </div>
          {resultados.length > 0 && (
            <div data-ayuda="vender.buscar" data-ayuda-grupo className="absolute inset-x-4 top-[72px] z-20 max-h-[60vh] overflow-y-auto scroll-fino rounded-2xl border border-slate-200 bg-superficie p-1.5 shadow-flotante lg:inset-x-6">
              {resultados.map((p, i) => (
                <button key={p.id} onClick={() => agregar(p)} className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-marca-50', i === 0 && 'bg-slate-50')}>
                  <span className="h-8 w-1.5 rounded-full" style={{ background: p.categoria_color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.nombre}</span>
                    <span className="block text-xs text-tinta-4">{p.codigo_barras} · {p.categoria_nombre}{p.controla_stock ? ` · stock ${numero(p.stock)}` : ''}</span>
                  </span>
                  <span className="font-extrabold text-marca-700 tabular-nums">{p.precio_variable ? 'Precio libre' : pesos(p.precio_venta)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2 overflow-x-auto scroll-fino pb-1" data-ayuda="vender.categorias" data-ayuda-grupo>
            <button onClick={() => setCat('rapidos')} className={cx('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition', cat === 'rapidos' ? 'bg-marca-600 text-white' : 'bg-slate-100 text-tinta-3 hover:bg-slate-200')}>
              <Star className="h-3.5 w-3.5" /> Rápidos
            </button>
            {categorias.filter((c) => c.total_productos > 0).map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={cx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition', cat === c.id ? 'text-white' : 'bg-slate-100 text-tinta-3 hover:bg-slate-200')}
                style={cat === c.id ? { background: c.color } : undefined}>
                {c.nombre}
              </button>
            ))}
            {puedeInventario && (
              <button onClick={() => navegar('/categorias')} title="Administrar categorías" data-ayuda="vender.admin-categorias"
                className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300 px-3.5 py-1.5 text-sm font-bold text-tinta-4 hover:border-marca-400 hover:text-marca-700">
                <Settings2 className="h-3.5 w-3.5" /> Categorías
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scroll-fino p-4 pb-28 lg:p-6 lg:pb-6">
          {lista.length === 0
            ? <div className="flex flex-col items-center py-16 text-center text-tinta-4">
                <Inbox className="mb-2 h-8 w-8" />
                <p className="text-sm">{cat === 'rapidos' ? 'Marca productos como favoritos (⭐) para tenerlos aquí como teclas rápidas.' : 'Esta categoría no tiene productos.'}</p>
                {cat === 'rapidos' && <Boton variante="suave" tamano="sm" className="mt-3" onClick={() => navegar('/productos')}>Ir a productos</Boton>}
              </div>
            : <div data-ayuda="vender.cuadricula" data-ayuda-grupo className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {lista.map((p) => <TeclaProducto key={p.id} p={p} onClick={(x) => agregar(x)} />)}
              </div>}
        </div>
        <div data-ayuda="vender.atajos" className="hidden items-center gap-4 border-t border-slate-200 bg-superficie px-6 py-2 text-xs text-tinta-4 xl:flex">
          <span><span className="kbd">Enter</span> agregar / cobrar</span>
          <span><span className="kbd">F2</span> cobrar</span>
          <span><span className="kbd">F4</span> en espera</span>
          <span><span className="kbd">F8</span> abrir cajón</span>
          <span><span className="kbd">Supr</span> quitar último</span>
          <span className="ml-auto">Caja #{caja.numero} · {caja.terminal}</span>
        </div>
      </section>

      {/* Carrito: lateral en escritorio */}
      <aside className="hidden w-[380px] shrink-0 border-l border-slate-200 bg-superficie lg:block 2xl:w-[440px]">{panelCarrito}</aside>

      {/* Carrito: barra inferior + hoja en móvil/tablet */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-superficie p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-flotante lg:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setVerCarrito(true)} className="flex flex-1 items-center gap-3 rounded-2xl bg-slate-100 px-4 py-2.5 text-left">
            <span className="relative"><ShoppingBasket className="h-6 w-6 text-marca-600" />
              {items > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-marca-600 px-1 text-[10px] font-bold text-white">{Math.round(items)}</span>}
            </span>
            <span className="flex-1"><span className="block text-xs text-tinta-4">Total</span><span className="block text-xl font-extrabold tabular-nums">{pesos(total)}</span></span>
            <ChevronUp className="h-5 w-5 text-tinta-4" />
          </button>
          <Boton variante="exito" tamano="lg" icono={Banknote} disabled={!carrito.length} onClick={() => setCobrar(true)}>Cobrar</Boton>
        </div>
      </div>
      {verCarrito && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-noche/40" onClick={() => setVerCarrito(false)} />
          <div className="absolute inset-x-0 bottom-0 h-[85dvh] rounded-t-3xl bg-superficie shadow-flotante animate-subir">
            <button onClick={() => setVerCarrito(false)} className="absolute right-3 top-3 z-10 rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            {panelCarrito}
          </div>
        </div>
      )}

      <ModalPrecio datos={precioPara} conf={conf} onCerrar={() => { setPrecioPara(null); enfocar() }}
        onAgregar={(p, cant, precio) => { setPrecioPara(null); agregar(p, cant, precio) }} />
      <ModalLinea linea={editar} onCerrar={() => { setEditar(null); enfocar() }}
        onGuardar={(cambios) => {
          if (cambios.cantidad <= 0) cambiarCantidad(editar.clave, 0)
          else setCarrito((c) => c.map((l) => (l.clave === editar.clave ? { ...l, ...cambios } : l)))
          setEditar(null); enfocar()
        }} />
      {cobrar && (
        <ModalCobro carrito={carrito} total={total} conf={conf} puedeFiar
          onCerrar={() => { setCobrar(false); enfocar() }}
          onVendido={() => { setCarrito([]); setVerCarrito(false); cargarCaja() }}
          onNueva={() => { setCobrar(false); enfocar(); api.get('/catalogo/productos/rapidos/').then(({ data }) => setRapidos(data)).catch(() => {}) }}
          esGestion={esGestion} />
      )}
    </div>
  )
}

