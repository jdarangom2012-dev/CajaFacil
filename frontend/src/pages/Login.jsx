import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, LogIn, User } from 'lucide-react'
import { api, mensajeError, terminal } from '../api/cliente'
import { useSesion } from '../context/Sesion'
import { Boton, Campo, Entrada } from '../components/ui'
import Logo from '../components/Logo'
import BotonTema from '../components/BotonTema'
import logoNautilus from '../assets/logo-nautilustech.png'

export default function Login() {
  const { iniciar, negocio, sistema } = useSesion()
  const [f, setF] = useState({ username: '', password: '' })
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const { data } = await api.post('/auth/login/', f)
      iniciar(data)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fondo-marca relative flex min-h-[100dvh] flex-col">
      <BotonTema className="absolute right-4 top-4" />
      <div className="flex flex-1 items-center justify-center p-5">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-superficie shadow-flotante lg:grid-cols-2">
          {/* Lado de marca */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-noche p-10 text-white lg:flex">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-marca-600/40 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-exito-500/20 blur-3xl" />
            <div className="relative">
              <p className="text-sm font-semibold text-[#BCD7FF]">Bienvenido a</p>
              <h2 className="mt-1 text-3xl font-extrabold leading-tight">{negocio?.nombre_negocio}</h2>
            </div>
            <div className="relative space-y-4">
              {[
                ['Vende rápido', 'Lector de código, teclas rápidas y báscula.'],
                ['Controla tu fiado', 'Cupos por cliente y cobro por WhatsApp.'],
                ['Funciona sin internet', 'Todo queda guardado en este computador.'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-marca-400" />
                  <div><p className="font-bold">{t}</p><p className="text-sm text-white/70">{d}</p></div>
                </div>
              ))}
            </div>
            <div className="relative flex items-center gap-3 text-xs text-white/55">
              <img src={logoNautilus} alt="" className="h-8 w-8 rounded-lg" /> CajaFácil v{sistema?.version} · NautilusTech
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={entrar} className="flex flex-col justify-center p-7 sm:p-12">
            <Logo className="mb-8 h-14 w-auto self-start" />
            <h1 className="text-2xl font-extrabold">Inicia sesión</h1>
            <p className="mt-1 text-sm text-tinta-4">Ingresa con tu usuario para abrir la caja.</p>
            <div className="mt-7 space-y-4">
              <Campo etiqueta="Usuario">
                <Entrada icono={User} autoFocus autoComplete="username" value={f.username}
                  onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="tu usuario" />
              </Campo>
              <Campo etiqueta="Contraseña">
                <div className="relative">
                  <Entrada icono={LockKeyhole} type={ver ? 'text' : 'password'} autoComplete="current-password" value={f.password}
                    onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••" className="pr-11" />
                  <button type="button" onClick={() => setVer(!ver)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                    {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Campo>
            </div>
            {error && <p className="mt-4 rounded-xl bg-peligro-50 px-3.5 py-2.5 text-sm font-semibold text-peligro-700">{error}</p>}
            <Boton type="submit" tamano="lg" className="mt-6 w-full" cargando={cargando} icono={LogIn}>Entrar</Boton>
            <p className="mt-6 text-center text-xs text-tinta-4">Equipo: <b>{terminal.obtener()}</b></p>
          </form>
        </div>
      </div>
    </div>
  )
}
