import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowDownToLine, Boxes, ClipboardList, History, Lightbulb, PackageCheck, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { api, mensajeError } from '../../api/cliente'
import {
  AreaTexto, Boton, Buscador, Campo, Cargando, EncabezadoPagina, Entrada, EntradaDinero, Indicador, Insignia, Modal,
  Pestanas, Selector, Tarjeta, Vacio, cx, useDebounce,
} from '../../components/ui'
import { useAviso } from '../../context/Aviso'
import { useApi } from '../../hooks/datos'
import { aNumero, cantidad, fechaHora, numero, pesos } from '../../lib/formato'

function ModalAjuste({ producto, onCerrar, onListo }) {
  const aviso = useAviso()
  const [tipo, setTipo] = useState('CONTEO')
  const [cant, setCant] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const guardar = async () => {
    setCargando(true)
    try {
      await api.post('/catalogo/ajustes/', { producto_id: producto.id, tipo, cantidad: aNumero(cant), motivo })
      aviso.exito('Inventario ajustado')
      onListo()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  const nuevo = tipo === 'CONTEO' ? aNumero(cant) : tipo === 'AJUSTE_POS' ? Number(producto.stock) + aNumero(cant) : Number(producto.stock) - aNumero(cant)
  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Ajustar: ${producto.nombre}`} descripcion={`Stock actual: ${cantidad(producto.stock, producto.unidad_medida)}`} ancho="sm"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={cargando}>Guardar ajuste</Boton></>}>
      <div className="space-y-4">
        <Pestanas className="w-full" valor={tipo} onCambio={setTipo} opciones={[
          { valor: 'CONTEO', etiqueta: 'Conteo físico' }, { valor: 'AJUSTE_POS', etiqueta: 'Sumar' }, { valor: 'AJUSTE_NEG', etiqueta: 'Restar' }]} />
        <Campo etiqueta={tipo === 'CONTEO' ? '¿Cuántos hay realmente?' : 'Cantidad'}>
          <Entrada autoFocus inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value)} className="h-14 text-xl font-bold" />
        </Campo>
        <p className="text-sm text-tinta-4">Quedará en <b className="text-tinta">{numero(nuevo)}</b></p>
        <Campo etiqueta="Motivo"><AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: producto vencido, conteo de fin de mes, se rompió…" /></Campo>
        <div className="flex flex-wrap gap-2">
          {['Conteo físico', 'Producto vencido', 'Producto dañado', 'Consumo de la tienda', 'Error de digitación'].map((m) => (
            <button key={m} onClick={() => setMotivo(m)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200">{m}</button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function Existencias() {
  const [q, setQ] = useState('')
  const qd = useDebounce(q)
  const [bajo, setBajo] = useState(false)
  const [pagina, setPagina] = useState(1)
  const { datos, cargando, recargar } = useApi('/catalogo/productos/', { q: qd, bajo_minimo: bajo ? 1 : '', page: pagina, page_size: 50, orden: bajo ? 'stock' : 'nombre' })
  const { datos: res, recargar: recargarRes } = useApi('/catalogo/productos/resumen/')
  const [ajuste, setAjuste] = useState(null)
  const lista = (datos?.results || []).filter((p) => p.controla_stock)
  return (
    <>
      {res && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador titulo="Productos activos" valor={numero(res.total_productos)} icono={Boxes} tono="gris" />
          <Indicador titulo="Por agotarse" valor={numero(res.bajo_minimo)} icono={AlertTriangle} tono="alerta" />
          <Indicador titulo="Inventario a costo" valor={pesos(res.valor_inventario_costo)} icono={PackageCheck} />
          <Indicador titulo="Inventario a precio de venta" valor={pesos(res.valor_inventario_venta)} icono={PackageCheck} tono="exito" />
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Buscador className="flex-1" valor={q} onCambio={(v) => { setPagina(1); setQ(v) }} placeholder="Buscar producto…" />
        <Boton variante={bajo ? 'primario' : 'secundario'} icono={AlertTriangle} onClick={() => { setPagina(1); setBajo(!bajo) }}>Solo por agotarse</Boton>
      </div>
      <Tarjeta className="overflow-hidden">
        {cargando && !datos ? <Cargando /> : lista.length === 0 ? <Vacio icono={Boxes} titulo="Sin productos" /> : (
          <div className="overflow-x-auto">
            <table className="tabla w-full">
              <thead><tr><th>Producto</th><th className="text-right">Stock</th><th className="hidden sm:table-cell text-right">Mínimo</th><th className="hidden md:table-cell text-right">Costo</th><th></th></tr></thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td><p className="font-bold">{p.nombre}</p><p className="text-xs text-tinta-4">{p.codigo_barras} · {p.categoria_nombre}</p></td>
                    <td className="text-right">
                      <span className={cx('font-extrabold tabular-nums', Number(p.stock) <= 0 ? 'text-peligro-600' : p.bajo_minimo ? 'text-alerta-600' : '')}>{cantidad(p.stock, p.unidad_medida)}</span>
                    </td>
                    <td className="hidden sm:table-cell text-right text-tinta-4">{numero(p.stock_minimo)}</td>
                    <td className="hidden md:table-cell text-right tabular-nums">{pesos(p.precio_costo)}</td>
                    <td className="text-right"><Boton tamano="xs" variante="suave" icono={SlidersHorizontal} onClick={() => setAjuste(p)}>Ajustar</Boton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {datos && (datos.next || datos.previous) && (
          <div className="flex justify-end gap-2 px-4 py-3">
            <Boton tamano="sm" variante="secundario" disabled={!datos.previous} onClick={() => setPagina(pagina - 1)}>Anterior</Boton>
            <Boton tamano="sm" variante="secundario" disabled={!datos.next} onClick={() => setPagina(pagina + 1)}>Siguiente</Boton>
          </div>
        )}
      </Tarjeta>
      {ajuste && <ModalAjuste producto={ajuste} onCerrar={() => setAjuste(null)} onListo={() => { setAjuste(null); recargar(); recargarRes() }} />}
    </>
  )
}

function BuscarProducto({ onElegir }) {
  const [q, setQ] = useState('')
  const qd = useDebounce(q, 200)
  const [res, setRes] = useState([])
  useEffect(() => {
    if (qd.length < 2) { setRes([]); return }
    api.get('/catalogo/productos/buscar/', { params: { q: qd } }).then(({ data }) => setRes(data)).catch(() => {})
  }, [qd])
  const enter = async (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const { data } = await api.get('/catalogo/productos/buscar/', { params: { codigo: q.trim() } })
    if (data) { onElegir(data); setQ('') } else if (res[0]) { onElegir(res[0]); setQ('') }
  }
  return (
    <div className="relative" onKeyDown={enter}>
      <Buscador valor={q} onCambio={setQ} placeholder="Escanea o busca el producto que llegó…" autoFocus />
      {res.length > 0 && (
        <div className="absolute inset-x-0 top-12 z-20 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-superficie p-1 shadow-flotante">
          {res.filter((p) => p.controla_stock).map((p) => (
            <button key={p.id} onClick={() => { onElegir(p); setQ('') }} className="flex w-full justify-between rounded-xl px-3 py-2 text-left hover:bg-marca-50">
              <span className="font-semibold">{p.nombre}</span><span className="text-xs text-tinta-4">stock {numero(p.stock)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Entrada_() {
  const aviso = useAviso()
  const [proveedor, setProveedor] = useState('')
  const [factura, setFactura] = useState('')
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(false)
  const agregar = async (p) => {
    if (lineas.some((l) => l.producto.id === p.id)) return aviso.info('Ese producto ya está en la lista')
    const { data } = await api.get(`/catalogo/productos/${p.id}/`)
    setLineas([...lineas, { producto: data, cantidad: '', costo_unitario: Number(data.precio_costo), precio_venta: Number(data.precio_venta) }])
  }
  const upd = (i, k, v) => setLineas(lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const total = lineas.reduce((s, l) => s + aNumero(l.cantidad) * (l.costo_unitario || 0), 0)
  const guardar = async () => {
    const validas = lineas.filter((l) => aNumero(l.cantidad) > 0)
    if (!validas.length) return aviso.error('Escribe las cantidades recibidas.')
    setCargando(true)
    try {
      await api.post('/catalogo/entradas/', {
        proveedor, factura,
        lineas: validas.map((l) => ({ producto_id: l.producto.id, cantidad: aNumero(l.cantidad), costo_unitario: l.costo_unitario || null, precio_venta: l.precio_venta || null })),
      })
      aviso.exito(`Entrada registrada: ${validas.length} productos`)
      setLineas([]); setProveedor(''); setFactura('')
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Tarjeta className="p-5">
        <BuscarProducto onElegir={agregar} />
        {lineas.length === 0 ? <Vacio icono={ArrowDownToLine} titulo="Agrega los productos que llegaron" texto="Puedes escanear el código de cada producto." /> : (
          <div className="mt-4 space-y-2">
            {lineas.map((l, i) => {
              const margen = l.costo_unitario > 0 ? ((l.precio_venta - l.costo_unitario) / l.costo_unitario) * 100 : null
              return (
                <div key={l.producto.id} className="grid grid-cols-2 items-end gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[1.4fr_.7fr_1fr_1fr_auto]">
                  <div className="col-span-2 sm:col-span-1"><p className="font-bold">{l.producto.nombre}</p><p className="text-xs text-tinta-4">Stock actual {cantidad(l.producto.stock, l.producto.unidad_medida)}</p></div>
                  <label><span className="text-xs font-semibold text-tinta-4">Cantidad</span><Entrada autoFocus inputMode="decimal" value={l.cantidad} onChange={(e) => upd(i, 'cantidad', e.target.value)} className="h-10" /></label>
                  <label><span className="text-xs font-semibold text-tinta-4">Costo c/u</span><EntradaDinero valor={l.costo_unitario} onCambio={(v) => upd(i, 'costo_unitario', v)} className="h-10" /></label>
                  <label><span className="text-xs font-semibold text-tinta-4">Venta {margen != null && <span className="text-exito-700">+{margen.toFixed(0)}%</span>}</span><EntradaDinero valor={l.precio_venta} onCambio={(v) => upd(i, 'precio_venta', v)} className="h-10" /></label>
                  <button onClick={() => setLineas(lineas.filter((_, j) => j !== i))} className="mb-1 grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-peligro-50 hover:text-peligro-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              )
            })}
          </div>
        )}
      </Tarjeta>
      <Tarjeta className="h-fit space-y-4 p-5">
        <Campo etiqueta="Proveedor"><Entrada value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej: Distribuidora La 80" /></Campo>
        <Campo etiqueta="No. factura / remisión"><Entrada value={factura} onChange={(e) => setFactura(e.target.value)} /></Campo>
        <div className="flex justify-between rounded-2xl bg-slate-50 p-4"><span className="text-sm text-tinta-4">Total compra</span><b className="text-xl tabular-nums">{pesos(total)}</b></div>
        <Boton tamano="lg" className="w-full" icono={Plus} onClick={guardar} cargando={cargando} disabled={!lineas.length}>Registrar entrada</Boton>
        <p className="text-xs text-tinta-4">Si cambias el precio de venta, queda registrado en la auditoría.</p>
      </Tarjeta>
    </div>
  )
}

const TIPOS = { ENTRADA: 'exito', SALIDA: 'gris', DEVOLUCION: 'marca', AJUSTE_POS: 'exito', AJUSTE_NEG: 'peligro', CONTEO: 'alerta', INICIAL: 'marca' }

function Movimientos() {
  const [tipo, setTipo] = useState('')
  const [q, setQ] = useState('')
  const qd = useDebounce(q)
  const [pagina, setPagina] = useState(1)
  const { datos, cargando } = useApi('/catalogo/movimientos/', { tipo, q: qd, page: pagina, page_size: 50 })
  const lista = datos?.results || []
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Buscador className="flex-1" valor={q} onCambio={setQ} placeholder="Producto o motivo…" />
        <Selector className="sm:w-56" value={tipo} onChange={(e) => { setPagina(1); setTipo(e.target.value) }}>
          <option value="">Todos los movimientos</option>
          <option value="ENTRADA">Entradas</option><option value="SALIDA">Ventas</option><option value="DEVOLUCION">Anulaciones</option>
          <option value="AJUSTE_POS">Ajustes +</option><option value="AJUSTE_NEG">Ajustes −</option><option value="CONTEO">Conteos</option>
        </Selector>
      </div>
      <Tarjeta className="overflow-hidden">
        {cargando && !datos ? <Cargando /> : lista.length === 0 ? <Vacio icono={History} titulo="Sin movimientos" /> : (
          <div className="overflow-x-auto">
            <table className="tabla w-full">
              <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="text-right">Cantidad</th><th className="hidden md:table-cell text-right">Stock</th><th className="hidden lg:table-cell">Motivo</th></tr></thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{fechaHora(m.creado)}<div className="text-xs text-tinta-4">{m.usuario_nombre}</div></td>
                    <td className="font-semibold">{m.producto_nombre}</td>
                    <td><Insignia tono={TIPOS[m.tipo]}>{m.tipo_display}</Insignia></td>
                    <td className="text-right font-bold tabular-nums">{numero(m.cantidad)}</td>
                    <td className="hidden md:table-cell text-right text-tinta-4 tabular-nums">{numero(m.stock_anterior)} → <b className="text-tinta">{numero(m.stock_nuevo)}</b></td>
                    <td className="hidden lg:table-cell text-tinta-3">{m.motivo}{m.proveedor ? ` · ${m.proveedor}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {datos && (datos.next || datos.previous) && (
          <div className="flex justify-end gap-2 px-4 py-3">
            <Boton tamano="sm" variante="secundario" disabled={!datos.previous} onClick={() => setPagina(pagina - 1)}>Anterior</Boton>
            <Boton tamano="sm" variante="secundario" disabled={!datos.next} onClick={() => setPagina(pagina + 1)}>Siguiente</Boton>
          </div>
        )}
      </Tarjeta>
    </>
  )
}

function PedidoSugerido() {
  const [cobertura, setCobertura] = useState(7)
  const { datos, cargando } = useApi('/reportes/pedido-sugerido/', { dias_cobertura: cobertura })
  const urg = { CRITICO: ['peligro', 'Urgente'], PRONTO: ['alerta', 'Pronto'], NORMAL: ['gris', 'Reponer'] }
  return (
    <>
      <Tarjeta className="mb-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-alerta-50 text-alerta-600"><Lightbulb className="h-5 w-5" /></span>
        <p className="flex-1 text-sm text-tinta-3">Calculado con lo que vendiste en los últimos 28 días. Te dice qué se va a acabar y cuánto pedir para cubrir los próximos días.</p>
        <label className="flex items-center gap-2 text-sm font-semibold">Cubrir
          <Selector className="h-10 w-28" value={cobertura} onChange={(e) => setCobertura(e.target.value)}>
            {[3, 7, 15, 30].map((d) => <option key={d} value={d}>{d} días</option>)}
          </Selector>
        </label>
      </Tarjeta>
      <Tarjeta className="overflow-hidden">
        {cargando && !datos ? <Cargando /> : !datos?.productos.length ? <Vacio icono={ClipboardList} titulo="No hay nada urgente por pedir" texto="Cuando haya más historial de ventas, verás aquí las sugerencias." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="tabla w-full">
                <thead><tr><th>Producto</th><th>Urgencia</th><th className="text-right">Stock</th><th className="hidden md:table-cell text-right">Vende/día</th><th className="hidden md:table-cell text-right">Alcanza</th><th className="text-right">Pedir</th><th className="hidden sm:table-cell text-right">Costo</th></tr></thead>
                <tbody>
                  {datos.productos.map((p) => (
                    <tr key={p.producto_id}>
                      <td><p className="font-bold">{p.nombre}</p><p className="text-xs text-tinta-4">{p.categoria}</p></td>
                      <td><Insignia tono={urg[p.urgencia][0]} punto>{urg[p.urgencia][1]}</Insignia></td>
                      <td className="text-right tabular-nums">{cantidad(p.stock, p.unidad)}</td>
                      <td className="hidden md:table-cell text-right tabular-nums">{numero(p.venta_diaria)}</td>
                      <td className="hidden md:table-cell text-right">{p.dias_restantes == null ? '—' : `${numero(p.dias_restantes)} días`}</td>
                      <td className="text-right font-extrabold text-marca-700 tabular-nums">{numero(p.sugerido)}</td>
                      <td className="hidden sm:table-cell text-right tabular-nums">{pesos(p.costo_estimado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-4 py-3 text-sm">Total estimado del pedido: <b className="ml-2">{pesos(datos.total_costo)}</b></div>
          </>
        )}
      </Tarjeta>
    </>
  )
}

export default function Inventario() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'existencias'
  return (
    <div>
      <EncabezadoPagina icono={Boxes} titulo="Inventario" descripcion="Existencias, entradas de mercancía, ajustes y pedido sugerido."
        acciones={<Pestanas valor={tab} onCambio={(t) => setParams({ tab: t })} opciones={[
          { valor: 'existencias', etiqueta: 'Existencias', icono: Boxes },
          { valor: 'entrada', etiqueta: 'Entrada', icono: ArrowDownToLine },
          { valor: 'pedido', etiqueta: 'Pedido sugerido', icono: Lightbulb },
          { valor: 'movimientos', etiqueta: 'Movimientos', icono: History },
        ]} />} />
      {tab === 'existencias' && <Existencias />}
      {tab === 'entrada' && <Entrada_ />}
      {tab === 'pedido' && <PedidoSugerido />}
      {tab === 'movimientos' && <Movimientos />}
    </div>
  )
}
