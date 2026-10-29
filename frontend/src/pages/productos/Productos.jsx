import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, ImagePlus, Package, Plus, Star, Tags, Upload, Wand2 } from 'lucide-react'
import { api, descargarArchivo, mensajeError } from '../../api/cliente'
import {
  Boton, Buscador, Campo, Cargando, EncabezadoPagina, Entrada, EntradaDinero, Insignia, Interruptor, Modal, Pestanas,
  Selector, Tarjeta, Vacio, cx, useDebounce,
} from '../../components/ui'
import { useAviso } from '../../context/Aviso'
import { useSesion } from '../../context/Sesion'
import { useApi, useFacturacion } from '../../hooks/datos'
import { cantidad, numero, pesos } from '../../lib/formato'
import Categorias from './Categorias'

const UNIDADES = [['UNIDAD', 'Unidad'], ['KG', 'Kilogramo'], ['LIBRA', 'Libra'], ['GRAMO', 'Gramo'], ['LITRO', 'Litro'],
  ['PAQUETE', 'Paquete'], ['CAJA', 'Caja'], ['BOTELLA', 'Botella'], ['BOLSA', 'Bolsa']]

export function ModalProducto({ producto, categorias, onCerrar, onGuardado }) {
  const aviso = useAviso()
  const nuevo = !producto?.id
  const [f, setF] = useState(() => ({
    codigo_barras: '', nombre: '', categoria: categorias[0]?.id || '', unidad_medida: 'UNIDAD', precio_costo: 0,
    precio_venta: 0, stock_minimo: 0, stock_inicial: 0, favorito: false, descripcion: '', tarifa_iva: 0, ...producto,
  }))
  const fe = useFacturacion()
  const [cargando, setCargando] = useState(false)
  const [imagen, setImagen] = useState(producto?.imagen_url || '')
  const archivo = useRef(null)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const margen = f.precio_costo > 0 ? ((f.precio_venta - f.precio_costo) / f.precio_costo) * 100 : null
  const cat = categorias.find((c) => c.id === f.categoria)

  const guardar = async () => {
    setCargando(true)
    try {
      const datos = { ...f }
      if (!nuevo) delete datos.stock_inicial
      const { data } = nuevo ? await api.post('/catalogo/productos/', datos) : await api.patch(`/catalogo/productos/${producto.id}/`, datos)
      aviso.exito(nuevo ? 'Producto creado' : 'Producto actualizado')
      onGuardado(data)
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  const subirImagen = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('imagen', file)
    try {
      const { data } = await api.post(`/catalogo/productos/${producto.id}/imagen/`, fd)
      setImagen(data.imagen_url)
      aviso.exito('Imagen actualizada')
    } catch (er) { aviso.error(mensajeError(er)) }
  }
  const generarCodigo = async () => {
    const { data } = await api.get('/catalogo/productos/siguiente-codigo/')
    set('codigo_barras', data.codigo)
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={nuevo ? 'Nuevo producto' : 'Editar producto'} ancho="lg"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={cargando}>Guardar</Boton></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre *" className="sm:col-span-2"><Entrada autoFocus value={f.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Arroz Diana 500 g" /></Campo>
        <Campo etiqueta="Código de barras" ayuda="Escanéalo aquí o déjalo vacío para un código interno.">
          <div className="flex gap-2">
            <Entrada value={f.codigo_barras || ''} onChange={(e) => set('codigo_barras', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
            <Boton variante="secundario" className="px-3" onClick={generarCodigo} title="Generar código interno"><Wand2 className="h-4 w-4" /></Boton>
          </div>
        </Campo>
        <Campo etiqueta="Categoría *">
          <Selector value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.precio_variable ? ' (precio libre)' : ''}</option>)}
          </Selector>
        </Campo>
        <Campo etiqueta="Se vende por">
          <Selector value={f.unidad_medida} onChange={(e) => set('unidad_medida', e.target.value)}>
            {UNIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Selector>
        </Campo>
        <Campo etiqueta="Stock mínimo" ayuda="Te avisamos cuando quede esta cantidad o menos.">
          <Entrada inputMode="decimal" value={f.stock_minimo} onChange={(e) => set('stock_minimo', e.target.value)} />
        </Campo>
        <Campo etiqueta="Precio de costo"><EntradaDinero valor={f.precio_costo} onCambio={(v) => set('precio_costo', v)} /></Campo>
        <Campo etiqueta={cat?.precio_variable ? 'Precio de referencia' : 'Precio de venta *'}
          ayuda={margen != null ? `Ganancia: ${pesos(f.precio_venta - f.precio_costo)} (${margen.toFixed(0)}%)` : cat?.precio_variable ? 'El cajero confirma el precio en cada venta.' : ''}>
          <EntradaDinero valor={f.precio_venta} onCambio={(v) => set('precio_venta', v)} />
        </Campo>
        {fe.disponible && (
          <Campo etiqueta="IVA incluido en el precio" ayuda="Para la facturación electrónica. Si no eres responsable de IVA, déjalo en Sin IVA.">
            <Selector value={f.tarifa_iva ?? 0} onChange={(e) => set('tarifa_iva', Number(e.target.value))}>
              <option value={0}>Sin IVA / excluido</option>
              <option value={5}>IVA 5%</option>
              <option value={19}>IVA 19%</option>
            </Selector>
          </Campo>
        )}
        {nuevo && cat?.controla_stock !== false && (
          <Campo etiqueta="Cantidad inicial en tienda"><Entrada inputMode="decimal" value={f.stock_inicial} onChange={(e) => set('stock_inicial', e.target.value)} /></Campo>
        )}
        <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
          <Interruptor activo={f.favorito} onCambio={(v) => set('favorito', v)} etiqueta="Tecla rápida en la caja" descripcion="Aparece en la pestaña ⭐ Rápidos de la pantalla de venta." />
        </div>
        {!nuevo && (
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {imagen ? <img src={imagen} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="h-6 w-6 text-slate-400" />}
            </div>
            <div>
              <Boton variante="secundario" tamano="sm" icono={Upload} onClick={() => archivo.current?.click()}>Subir foto</Boton>
              <p className="mt-1 text-xs text-tinta-4">JPG o PNG hasta 3 MB. Se guarda en este computador.</p>
              <input ref={archivo} type="file" accept="image/*" hidden onChange={subirImagen} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function ModalImportar({ onCerrar, onListo }) {
  const aviso = useAviso()
  const [archivo, setArchivo] = useState(null)
  const [actualizar, setActualizar] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [res, setRes] = useState(null)
  const importar = async () => {
    const fd = new FormData()
    fd.append('archivo', archivo)
    fd.append('actualizar', actualizar ? 'true' : 'false')
    setCargando(true)
    try {
      const { data } = await api.post('/catalogo/productos/importar/', fd, { timeout: 180000 })
      setRes(data)
      onListo()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <Modal abierto onCerrar={onCerrar} titulo="Importar productos desde Excel" ancho="md"
      pie={res ? <Boton onClick={onCerrar}>Listo</Boton> : <><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton icono={Upload} onClick={importar} cargando={cargando} disabled={!archivo}>Importar</Boton></>}>
      {res ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-exito-50 p-4 text-center"><p className="text-3xl font-extrabold text-exito-700">{res.creados}</p><p className="text-sm">creados</p></div>
            <div className="rounded-2xl bg-marca-50 p-4 text-center"><p className="text-3xl font-extrabold text-marca-700">{res.actualizados}</p><p className="text-sm">actualizados</p></div>
          </div>
          {res.total_errores > 0 && (
            <div className="rounded-2xl bg-peligro-50 p-3 text-sm text-peligro-700">
              <b>{res.total_errores} filas con error:</b>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">{res.errores.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-tinta-3">
            <li>Descarga la plantilla y llénala (o usa tu propio Excel/CSV con columnas <b>nombre</b> y <b>precio_venta</b>).</li>
            <li>Las categorías que no existan se crean solas.</li>
            <li>Si el código ya existe, el producto se actualiza.</li>
          </ol>
          <Boton variante="suave" icono={Download} onClick={() => descargarArchivo('/catalogo/productos/plantilla/', {}, 'plantilla_productos_cajafacil.xlsx')}>Descargar plantilla</Boton>
          <label className={cx('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition', archivo ? 'border-exito-500 bg-exito-50/40' : 'border-slate-300 hover:border-marca-400 hover:bg-marca-50/30')}>
            <FileSpreadsheet className="mb-2 h-8 w-8 text-marca-600" />
            <span className="font-semibold">{archivo ? archivo.name : 'Selecciona el archivo .xlsx o .csv'}</span>
            <input type="file" accept=".xlsx,.csv" hidden onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
          </label>
          <Interruptor activo={actualizar} onCambio={setActualizar} etiqueta="Actualizar productos existentes" descripcion="Precios y cantidades del archivo reemplazan los actuales." />
        </div>
      )}
    </Modal>
  )
}

function ListaProductos() {
  const { puedeInventario } = useSesion()
  const aviso = useAviso()
  const [q, setQ] = useState('')
  const qd = useDebounce(q, 250)
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState('activos')
  const [pagina, setPagina] = useState(1)
  const { datos, cargando, recargar } = useApi('/catalogo/productos/', { q: qd, categoria, estado, page: pagina, page_size: 50 })
  const { datos: categorias } = useApi('/catalogo/categorias/')
  const [editar, setEditar] = useState(null)
  const [importar, setImportar] = useState(false)
  const lista = datos?.results || []

  const favorito = async (p) => {
    try { await api.post(`/catalogo/productos/${p.id}/favorito/`); recargar() } catch (e) { aviso.error(mensajeError(e)) }
  }
  const alternarActivo = async (p) => {
    try {
      if (p.activo) await api.delete(`/catalogo/productos/${p.id}/`)
      else await api.post(`/catalogo/productos/${p.id}/activar/`)
      recargar()
    } catch (e) { aviso.error(mensajeError(e)) }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <Buscador className="flex-1" valor={q} onCambio={(v) => { setPagina(1); setQ(v) }} placeholder="Buscar por nombre o código…" />
        <Selector className="lg:w-56" value={categoria} onChange={(e) => { setPagina(1); setCategoria(e.target.value) }}>
          <option value="">Todas las categorías</option>
          {(categorias || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Selector>
        <Selector className="lg:w-40" value={estado} onChange={(e) => { setPagina(1); setEstado(e.target.value) }}>
          <option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option>
        </Selector>
        {puedeInventario && <div className="flex gap-2">
          <Boton variante="secundario" icono={Upload} onClick={() => setImportar(true)}>Importar</Boton>
          <Boton variante="secundario" icono={Download} onClick={() => descargarArchivo('/catalogo/productos/exportar/', { categoria, estado }, 'productos_cajafacil.xlsx')} className="hidden sm:inline-flex">Exportar</Boton>
          <Boton icono={Plus} onClick={() => setEditar({})} disabled={!categorias?.length}>Nuevo</Boton>
        </div>}
      </div>
      <Tarjeta className="overflow-hidden">
        {cargando && !datos ? <Cargando /> : lista.length === 0 ? (
          <Vacio icono={Package} titulo="No hay productos" texto="Crea tu primer producto o impórtalos desde Excel."
            accion={puedeInventario && <Boton icono={Plus} onClick={() => setEditar({})}>Crear producto</Boton>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabla w-full">
                <thead><tr><th className="w-10"></th><th>Producto</th><th className="hidden md:table-cell">Categoría</th><th className="text-right">Precio</th><th className="text-right">Stock</th><th></th></tr></thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id} className={cx(!p.activo && 'opacity-50')}>
                      <td><button onClick={() => puedeInventario && favorito(p)} title="Tecla rápida"><Star className={cx('h-5 w-5', p.favorito ? 'fill-alerta-500 text-alerta-500' : 'text-slate-300 hover:text-alerta-500')} /></button></td>
                      <td>
                        <button onClick={() => puedeInventario && setEditar(p)} className="flex items-center gap-3 text-left">
                          {p.imagen_url ? <img src={p.imagen_url} alt="" className="h-10 w-10 rounded-xl border border-slate-200 object-contain" />
                            : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-white" style={{ background: p.categoria_color }}>{p.nombre[0]}</span>}
                          <span><span className="block font-bold hover:text-marca-700">{p.nombre}</span><span className="block text-xs text-tinta-4">{p.codigo_barras}</span></span>
                        </button>
                      </td>
                      <td className="hidden md:table-cell"><span className="chip" style={{ background: `${p.categoria_color}1A`, color: p.categoria_color }}>{p.categoria_nombre}</span></td>
                      <td className="text-right">
                        <b className="tabular-nums">{p.precio_variable ? 'Libre' : pesos(p.precio_venta)}</b>
                        {p.margen != null && <div className="text-xs text-exito-700">+{p.margen}%</div>}
                      </td>
                      <td className="text-right">
                        {p.controla_stock
                          ? <span className={cx('font-bold tabular-nums', p.bajo_minimo && 'text-peligro-600')}>{cantidad(p.stock, p.unidad_medida)}</span>
                          : <span className="text-xs text-tinta-4">No aplica</span>}
                      </td>
                      <td className="text-right">
                        {puedeInventario && <Boton tamano="xs" variante="fantasma" onClick={() => alternarActivo(p)}>{p.activo ? 'Desactivar' : 'Activar'}</Boton>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm text-tinta-4">
              <span>{numero(datos.count)} productos</span>
              <div className="flex gap-2">
                <Boton tamano="sm" variante="secundario" disabled={!datos.previous} onClick={() => setPagina(pagina - 1)}>Anterior</Boton>
                <Boton tamano="sm" variante="secundario" disabled={!datos.next} onClick={() => setPagina(pagina + 1)}>Siguiente</Boton>
              </div>
            </div>
          </>
        )}
      </Tarjeta>
      {editar && <ModalProducto producto={editar.id ? editar : null} categorias={(categorias || []).filter((c) => c.activa)} onCerrar={() => setEditar(null)} onGuardado={() => { setEditar(null); recargar() }} />}
      {importar && <ModalImportar onCerrar={() => setImportar(false)} onListo={recargar} />}
    </>
  )
}

export default function Productos() {
  const [tab, setTab] = useState('productos')
  return (
    <div>
      <EncabezadoPagina icono={Package} titulo="Productos" descripcion="Tu catálogo: precios, códigos, categorías y teclas rápidas."
        acciones={<Pestanas valor={tab} onCambio={setTab} opciones={[{ valor: 'productos', etiqueta: 'Productos', icono: Package }, { valor: 'categorias', etiqueta: 'Categorías', icono: Tags }]} />} />
      {tab === 'productos' ? <ListaProductos /> : <Categorias />}
    </div>
  )
}
