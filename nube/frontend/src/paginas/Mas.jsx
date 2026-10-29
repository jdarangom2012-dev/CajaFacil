import { useState } from 'react'
import { BarChart3, Bell, CloudUpload, KeyRound, Lock, LogOut, MessageCircle, Moon, Sun } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { useDatos, haceCuanto } from '../lib/datos'
import { api, mensajeError } from '../lib/api'
import { fecha } from '../lib/formato'
import { useTema } from '../lib/tema'
import { Encabezado } from '../componentes/Pagina'
import { Boton, Fila, Insignia, Tarjeta, Titulo } from '../componentes/ui'
import logoNautilus from '../assets/logo-nautilustech.png'

const Ico = ({ i: I, tono = 'bg-marca-50 text-marca-600' }) => (
  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tono}`}><I className="h-[18px] w-[18px]" /></span>
)

function CambiarClave({ onListo }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [msg, setMsg] = useState(null)
  const [cargando, setCargando] = useState(false)
  const guardar = async (e) => {
    e.preventDefault()
    setCargando(true)
    try { await api.post('/clave/', { actual, nueva }); setMsg({ ok: true, t: 'Clave cambiada.' }); setActual(''); setNueva(''); setTimeout(onListo, 1200) } catch (err) { setMsg({ ok: false, t: mensajeError(err) }) }
    setCargando(false)
  }
  return (
    <form onSubmit={guardar} className="space-y-3 border-t border-slate-100 p-4">
      <input className="campo" type="password" placeholder="Clave actual" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
      <input className="campo" type="password" placeholder="Clave nueva (mínimo 6)" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required minLength={6} />
      {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-exito-700' : 'text-peligro-700'}`}>{msg.t}</p>}
      <Boton type="submit" className="w-full" cargando={cargando}>Guardar clave</Boton>
    </form>
  )
}

export default function Mas() {
  const { tienda, sesion, salir } = useSesion()
  const [tema, cambiarTema] = useTema()
  const [clave, setClave] = useState(false)
  const resp = useDatos(tienda && `/t/${tienda.id}/respaldos/`)
  const s = tienda?.suscripcion
  const ultimo = resp.datos?.[0]
  return (
    <>
      <div className="lg:max-w-3xl">
      <Encabezado titulo={<><span className="lg:hidden">Más</span><span className="hidden lg:inline">Mi cuenta</span></>} subtitulo={sesion?.nombre} />
      <Tarjeta className="divide-y divide-slate-100 lg:hidden">
        <Fila to="/reportes" izquierda={<Ico i={BarChart3} />} titulo="¿Cómo le va a la tienda?" subtitulo="Ventas de los últimos días y lo más vendido" />
        <Fila to="/cierres" izquierda={<Ico i={Lock} />} titulo="Cierres de caja" subtitulo="Si cuadró la plata cada día" />
        <Fila to="/alertas" izquierda={<Ico i={Bell} tono="bg-peligro-50 text-peligro-600" />} titulo="Alertas" subtitulo="Anulaciones, descuadres, cambios de precio" />
      </Tarjeta>

      <Titulo>Tu tienda en la nube</Titulo>
      <Tarjeta className="divide-y divide-slate-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <Ico i={CloudUpload} tono="bg-exito-50 text-exito-600" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Copia de seguridad</p>
            <p className="text-[13px] text-tinta-4">{ultimo ? `La última llegó ${haceCuanto(ultimo.recibido)}` : 'Todavía no ha llegado ninguna'}</p>
          </div>
          {ultimo && <Insignia tono="exito">Protegida</Insignia>}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-tinta-3">Nube pagada hasta</span>
          <span className="font-bold">{s?.pagado_hasta ? fecha(`${s.pagado_hasta}T12:00:00`) : '—'}</span>
        </div>
      </Tarjeta>

      <Titulo>Tu cuenta</Titulo>
      <Tarjeta className="divide-y divide-slate-100">
        <Fila onClick={() => cambiarTema()} izquierda={<Ico i={tema === 'oscuro' ? Sun : Moon} tono="bg-slate-100 text-tinta-3" />}
          titulo={tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'} />
        <div>
          <Fila onClick={() => setClave(!clave)} izquierda={<Ico i={KeyRound} tono="bg-slate-100 text-tinta-3" />} titulo="Cambiar mi clave" />
          {clave && <CambiarClave onListo={() => setClave(false)} />}
        </div>
        <a href={`https://wa.me/${sesion?.soporte_whatsapp}?text=${encodeURIComponent(`Hola, necesito ayuda con CajaFácil Nube (${tienda?.nombre || ''})`)}`}
          target="_blank" rel="noreferrer" className="block">
          <Fila izquierda={<Ico i={MessageCircle} tono="bg-exito-50 text-exito-600" />} titulo="Ayuda por WhatsApp" subtitulo="Te respondemos rápido" />
        </a>
        <Fila onClick={salir} izquierda={<Ico i={LogOut} tono="bg-peligro-50 text-peligro-600" />} titulo="Salir" />
      </Tarjeta>

      <a href="https://nautilustech.app/" target="_blank" rel="noreferrer" className="mt-8 flex items-center justify-center gap-2 opacity-70">
        <span className="text-xs text-tinta-4">CajaFácil es de</span><img src={logoNautilus} alt="NautilusTech" className="h-5 w-auto" />
      </a>
      </div>
    </>
  )
}
