import { useState } from 'react'
import { Eye, EyeOff, LogIn, MessageCircle } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { mensajeError } from '../lib/api'
import { Boton } from '../componentes/ui'
import logo from '../assets/logo-cajafacil.png'
import logoOscuro from '../assets/logo-cajafacil-oscuro.png'
import logoNautilus from '../assets/logo-nautilustech.png'

export default function Entrar() {
  const { entrar } = useSesion()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    setCargando(true)
    setError('')
    try { await entrar(usuario.trim(), clave) } catch (err) { setError(mensajeError(err)) }
    setCargando(false)
  }

  return (
    <div className="fondo-marca flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-entrar">
        <img src={logo} alt="CajaFácil" className="mx-auto h-12 w-auto dark:hidden" />
        <img src={logoOscuro} alt="CajaFácil" className="mx-auto hidden h-12 w-auto dark:block" />
        <p className="mt-3 text-center text-[15px] text-tinta-3">Tu tienda en el celular, estés donde estés.</p>

        <form onSubmit={enviar} className="tarjeta mt-8 space-y-4 p-6">
          <div>
            <label className="etiqueta" htmlFor="usuario">Usuario</label>
            <input id="usuario" className="campo h-12" autoComplete="username" autoCapitalize="none" autoCorrect="off"
              value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
          </div>
          <div>
            <label className="etiqueta" htmlFor="clave">Clave</label>
            <div className="relative">
              <input id="clave" className="campo h-12 pr-12" type={ver ? 'text' : 'password'} autoComplete="current-password"
                value={clave} onChange={(e) => setClave(e.target.value)} required />
              <button type="button" onClick={() => setVer(!ver)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-tinta-4"
                aria-label={ver ? 'Ocultar clave' : 'Ver clave'}>
                {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {error && <p className="rounded-xl bg-peligro-50 p-3 text-sm font-semibold text-peligro-700">{error}</p>}
          <Boton type="submit" className="h-12 w-full" cargando={cargando} icono={LogIn}>Entrar</Boton>
        </form>

        <a href="https://wa.me/573151355693?text=Hola%2C%20no%20puedo%20entrar%20a%20CajaF%C3%A1cil%20Nube"
          target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-tinta-3">
          <MessageCircle className="h-4 w-4 text-exito-600" /> ¿Olvidaste la clave? Escríbenos
        </a>
        <a href="https://nautilustech.app/" target="_blank" rel="noreferrer" className="mt-10 flex items-center justify-center gap-2 opacity-70">
          <span className="text-xs text-tinta-4">Hecho por</span><img src={logoNautilus} alt="NautilusTech" className="h-5 w-auto" />
        </a>
      </div>
    </div>
  )
}
