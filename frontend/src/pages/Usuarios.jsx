import { useState } from 'react'
import { Pencil, Plus, Users } from 'lucide-react'
import { api, mensajeError } from '../api/cliente'
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, Insignia, Interruptor, Modal, Selector, Tarjeta, cx } from '../components/ui'
import { useAviso } from '../context/Aviso'
import { useSesion } from '../context/Sesion'
import { useApi } from '../hooks/datos'
import { fechaHora, iniciales } from '../lib/formato'

const ROLES = [
  ['ADMIN', 'Administrador (dueño)', 'Todo: configuración, usuarios, reportes y auditoría.'],
  ['COORDINADOR', 'Coordinador', 'Vende, anula ventas, maneja inventario y ve reportes.'],
  ['CAJERO', 'Cajero', 'Vende, abre/cierra su caja y recibe abonos.'],
  ['ALMACENISTA', 'Almacenista', 'Productos, entradas de mercancía y ajustes de inventario.'],
]
const TONO = { ADMIN: 'oscuro', COORDINADOR: 'marca', CAJERO: 'exito', ALMACENISTA: 'alerta' }

function ModalUsuario({ usuario, onCerrar, onGuardado }) {
  const aviso = useAviso()
  const [f, setF] = useState({ username: '', nombre_completo: '', rol: 'CAJERO', telefono: '', password: '', is_active: true, ...usuario })
  const [cargando, setCargando] = useState(false)
  const guardar = async () => {
    setCargando(true)
    try {
      const datos = { ...f }
      if (!datos.password) delete datos.password
      if (f.id) await api.patch(`/auth/usuarios/${f.id}/`, datos)
      else await api.post('/auth/usuarios/', datos)
      aviso.exito('Usuario guardado')
      onGuardado()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <Modal abierto onCerrar={onCerrar} titulo={f.id ? 'Editar usuario' : 'Nuevo usuario'} ancho="md"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={cargando}>Guardar</Boton></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo" className="sm:col-span-2"><Entrada autoFocus value={f.nombre_completo} onChange={(e) => setF({ ...f, nombre_completo: e.target.value })} /></Campo>
        <Campo etiqueta="Usuario (para entrar)"><Entrada value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Campo>
        <Campo etiqueta={f.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}><Entrada type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Campo>
        <div className="sm:col-span-2">
          <span className="etiqueta">Rol</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map(([v, t, d]) => (
              <button key={v} onClick={() => setF({ ...f, rol: v })} className={cx('rounded-2xl border-2 p-3 text-left transition', f.rol === v ? 'border-marca-600 bg-marca-50' : 'border-slate-200 hover:border-slate-300')}>
                <p className="text-sm font-bold">{t}</p><p className="text-xs text-tinta-4">{d}</p>
              </button>
            ))}
          </div>
        </div>
        <Campo etiqueta="Celular"><Entrada value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></Campo>
        {f.id && <div className="flex items-end pb-2"><Interruptor activo={f.is_active} onCambio={(v) => setF({ ...f, is_active: v })} etiqueta="Usuario activo" /></div>}
      </div>
    </Modal>
  )
}

export default function Usuarios() {
  const { usuario: yo } = useSesion()
  const { datos, cargando, recargar } = useApi('/auth/usuarios/')
  const [editar, setEditar] = useState(null)
  return (
    <div>
      <EncabezadoPagina icono={Users} titulo="Usuarios" descripcion="Quién puede entrar y qué puede hacer cada uno."
        acciones={<Boton icono={Plus} onClick={() => setEditar({})}>Nuevo usuario</Boton>} />
      {cargando && !datos ? <Cargando /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(datos || []).map((u) => (
            <Tarjeta key={u.id} className={cx('flex items-center gap-3 p-4', !u.is_active && 'opacity-50')}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-marca-500 to-[#0B57D0] font-bold text-white">{iniciales(u.nombre_completo || u.username)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{u.nombre_completo || u.username} {u.id === yo?.id && <span className="text-xs text-tinta-4">(tú)</span>}</p>
                <p className="text-xs text-tinta-4">@{u.username} · {u.last_login ? `último ingreso ${fechaHora(u.last_login)}` : 'nunca ha entrado'}</p>
                <div className="mt-1 flex gap-1"><Insignia tono={TONO[u.rol]}>{u.rol_display}</Insignia>{!u.is_active && <Insignia tono="peligro">Inactivo</Insignia>}</div>
              </div>
              <Boton variante="fantasma" tamano="icono-sm" onClick={() => setEditar(u)}><Pencil className="h-4 w-4" /></Boton>
            </Tarjeta>
          ))}
        </div>
      )}
      {editar && <ModalUsuario usuario={editar.id ? editar : null} onCerrar={() => setEditar(null)} onGuardado={() => { setEditar(null); recargar() }} />}
    </div>
  )
}
