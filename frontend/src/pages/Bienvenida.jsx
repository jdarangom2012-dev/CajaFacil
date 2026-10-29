import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, PartyPopper, Store, UserCog } from 'lucide-react'
import { api, mensajeError } from '../api/cliente'
import { useSesion } from '../context/Sesion'
import { Boton, Campo, Entrada, Interruptor, cx } from '../components/ui'
import Logo from '../components/Logo'
import BotonTema from '../components/BotonTema'

export default function Bienvenida() {
  const { iniciar, cargarSistema } = useSesion()
  const [paso, setPaso] = useState(0)
  const [f, setF] = useState({
    nombre_negocio: '', nit: '', telefono: '', direccion: '', ciudad: '',
    admin_nombre: '', admin_usuario: 'admin', admin_password: '', repetir: '', datos_ejemplo: true,
  })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const siguiente = () => {
    setError('')
    if (paso === 0 && f.nombre_negocio.trim().length < 2) return setError('Escribe el nombre de tu negocio.')
    setPaso(paso + 1)
  }

  const terminar = async () => {
    setError('')
    if (!f.admin_nombre.trim()) return setError('Escribe tu nombre.')
    if (f.admin_password.length < 4) return setError('La contraseña debe tener al menos 4 caracteres.')
    if (f.admin_password !== f.repetir) return setError('Las contraseñas no coinciden.')
    setCargando(true)
    try {
      const { data } = await api.post('/sistema/configuracion-inicial/', f)
      iniciar(data)
      await cargarSistema()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }

  const pasos = [{ t: 'Tu negocio', i: Store }, { t: 'Administrador', i: UserCog }]

  return (
    <div className="fondo-marca relative flex min-h-[100dvh] items-center justify-center p-5">
      <BotonTema className="absolute right-4 top-4" />
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center"><Logo className="h-14" /></div>
        <div className="tarjeta p-6 sm:p-9">
          <div className="mb-6 flex items-center gap-2">
            <PartyPopper className="h-6 w-6 text-marca-600" />
            <h1 className="text-xl font-extrabold">¡Bienvenido! Configuremos tu caja</h1>
          </div>
          <div className="mb-7 flex gap-2">
            {pasos.map((p, i) => (
              <div key={p.t} className="flex flex-1 items-center gap-2">
                <span className={cx('grid h-8 w-8 place-items-center rounded-full text-sm font-bold',
                  i < paso ? 'bg-exito-500 text-white' : i === paso ? 'bg-marca-600 text-white' : 'bg-slate-100 text-tinta-4')}>
                  {i < paso ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cx('text-sm font-semibold', i === paso ? 'text-tinta' : 'text-tinta-4')}>{p.t}</span>
                {i < pasos.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
              </div>
            ))}
          </div>

          {paso === 0 && (
            <div className="grid gap-4 sm:grid-cols-2 animate-entrar">
              <Campo etiqueta="Nombre del negocio *" className="sm:col-span-2">
                <Entrada autoFocus value={f.nombre_negocio} onChange={set('nombre_negocio')} placeholder="Ej: Tienda El Gordo" />
              </Campo>
              <Campo etiqueta="NIT o cédula"><Entrada value={f.nit} onChange={set('nit')} /></Campo>
              <Campo etiqueta="Teléfono / WhatsApp"><Entrada value={f.telefono} onChange={set('telefono')} /></Campo>
              <Campo etiqueta="Dirección"><Entrada value={f.direccion} onChange={set('direccion')} /></Campo>
              <Campo etiqueta="Ciudad"><Entrada value={f.ciudad} onChange={set('ciudad')} placeholder="Medellín" /></Campo>
            </div>
          )}

          {paso === 1 && (
            <div className="grid gap-4 sm:grid-cols-2 animate-entrar">
              <Campo etiqueta="Tu nombre *" className="sm:col-span-2"><Entrada autoFocus value={f.admin_nombre} onChange={set('admin_nombre')} placeholder="Nombre del dueño o administrador" /></Campo>
              <Campo etiqueta="Usuario *" className="sm:col-span-2"><Entrada value={f.admin_usuario} onChange={set('admin_usuario')} /></Campo>
              <Campo etiqueta="Contraseña *"><Entrada type="password" value={f.admin_password} onChange={set('admin_password')} /></Campo>
              <Campo etiqueta="Repite la contraseña *"><Entrada type="password" value={f.repetir} onChange={set('repetir')} /></Campo>
              <div className="rounded-2xl bg-marca-50/60 p-4 sm:col-span-2">
                <Interruptor activo={f.datos_ejemplo} onCambio={(v) => setF({ ...f, datos_ejemplo: v })}
                  etiqueta="Cargar productos de ejemplo"
                  descripcion="15 productos típicos de tienda para practicar. Los puedes borrar o importar los tuyos desde Excel." />
              </div>
            </div>
          )}

          {error && <p className="mt-5 rounded-xl bg-peligro-50 px-3.5 py-2.5 text-sm font-semibold text-peligro-700">{error}</p>}

          <div className="mt-7 flex justify-between gap-3">
            {paso > 0 ? <Boton variante="secundario" icono={ArrowLeft} onClick={() => setPaso(paso - 1)}>Atrás</Boton> : <span />}
            {paso < pasos.length - 1
              ? <Boton iconoDer={ArrowRight} onClick={siguiente}>Continuar</Boton>
              : <Boton variante="exito" icono={Check} onClick={terminar} cargando={cargando}>Empezar a vender</Boton>}
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-tinta-4">Tus datos quedan guardados en este computador. Tienes 15 días de prueba gratis.</p>
      </div>
    </div>
  )
}
