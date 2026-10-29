import { useState } from 'react'
import { Pencil, Plus, Tags } from 'lucide-react'
import { api, mensajeError } from '../../api/cliente'
import { Boton, Campo, Cargando, Entrada, Insignia, Interruptor, Modal, Tarjeta, Vacio, cx } from '../../components/ui'
import { useAviso } from '../../context/Aviso'
import { useSesion } from '../../context/Sesion'
import { useApi } from '../../hooks/datos'

const COLORES = ['#1570EF', '#0BA5EC', '#12B76A', '#F79009', '#DC6803', '#E31B54', '#D92D20', '#7A5AF8', '#6941C6', '#EE46BC', '#B54708', '#667085']

function ModalCategoria({ categoria, onCerrar, onGuardado }) {
  const aviso = useAviso()
  const [f, setF] = useState({ nombre: '', descripcion: '', color: COLORES[0], precio_variable: false, controla_stock: true, activa: true, ...categoria })
  const [cargando, setCargando] = useState(false)
  const guardar = async () => {
    setCargando(true)
    try {
      if (f.id) await api.patch(`/catalogo/categorias/${f.id}/`, f)
      else await api.post('/catalogo/categorias/', f)
      aviso.exito('Categoría guardada')
      onGuardado()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <Modal abierto onCerrar={onCerrar} titulo={f.id ? 'Editar categoría' : 'Nueva categoría'} ancho="sm"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={cargando}>Guardar</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Nombre"><Entrada autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
        <div>
          <span className="etiqueta">Color</span>
          <div className="flex flex-wrap gap-2">
            {COLORES.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} className={cx('h-8 w-8 rounded-full ring-offset-2 transition', f.color === c && 'ring-2 ring-tinta')} style={{ background: c }} />)}
          </div>
        </div>
        <Interruptor activo={f.precio_variable} onCambio={(v) => setF({ ...f, precio_variable: v, controla_stock: v ? false : f.controla_stock })}
          etiqueta="Precio libre al vender" descripcion="Para Fruver, carnes o granel: el cajero escribe el precio o el valor en cada venta." />
        <Interruptor activo={f.controla_stock} onCambio={(v) => setF({ ...f, controla_stock: v })}
          etiqueta="Controlar inventario" descripcion="Descuenta existencias al vender y avisa cuando se están agotando." />
        {f.id && <Interruptor activo={f.activa} onCambio={(v) => setF({ ...f, activa: v })} etiqueta="Categoría activa" />}
      </div>
    </Modal>
  )
}

export default function Categorias() {
  const { puedeInventario } = useSesion()
  const { datos, cargando, recargar } = useApi('/catalogo/categorias/')
  const [editar, setEditar] = useState(null)
  if (cargando && !datos) return <Cargando />
  return (
    <>
      {puedeInventario && <div className="mb-4 flex justify-end"><Boton icono={Plus} onClick={() => setEditar({})}>Nueva categoría</Boton></div>}
      {!datos?.length ? <Vacio icono={Tags} titulo="Sin categorías" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {datos.map((c) => (
            <Tarjeta key={c.id} className={cx('flex items-center gap-3 p-4', !c.activa && 'opacity-50')}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white" style={{ background: c.color }}>{c.nombre[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{c.nombre}</p>
                <p className="text-xs text-tinta-4">{c.total_productos} productos</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.precio_variable && <Insignia tono="exito">Precio libre</Insignia>}
                  {!c.controla_stock && <Insignia>Sin inventario</Insignia>}
                  {!c.activa && <Insignia tono="peligro">Inactiva</Insignia>}
                </div>
              </div>
              {puedeInventario && <Boton variante="fantasma" tamano="icono-sm" onClick={() => setEditar(c)}><Pencil className="h-4 w-4" /></Boton>}
            </Tarjeta>
          ))}
        </div>
      )}
      {editar && <ModalCategoria categoria={editar} onCerrar={() => setEditar(null)} onGuardado={() => { setEditar(null); recargar() }} />}
    </>
  )
}
