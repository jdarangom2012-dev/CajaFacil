import { useState } from 'react'
import { LockOpen, Wallet } from 'lucide-react'
import { api, mensajeError, terminal } from '../api/cliente'
import { useAviso } from '../context/Aviso'
import { useSesion } from '../context/Sesion'
import { Boton, EntradaDinero, Tarjeta } from './ui'

/** Tarjeta para abrir el turno de caja con la base en efectivo. */
export default function AbrirCaja({ onAbierta, compacto }) {
  const { cargarCaja, licencia } = useSesion()
  const aviso = useAviso()
  const [base, setBase] = useState(0)
  const [cargando, setCargando] = useState(false)
  const abrir = async () => {
    setCargando(true)
    try {
      await api.post('/ventas/caja/', { base })
      await cargarCaja()
      aviso.exito('Caja abierta. ¡Buenas ventas!')
      onAbierta?.()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <Tarjeta className={compacto ? 'p-6' : 'mx-auto max-w-md p-8'}>
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-marca-50 text-marca-600"><Wallet className="h-7 w-7" /></span>
      <h2 className="text-xl font-extrabold">Abre la caja para empezar</h2>
      <p className="mt-1 text-sm text-tinta-4">Cuenta el efectivo con el que inicias el día (la base) en <b>{terminal.obtener()}</b>.</p>
      <div className="mt-5">
        <span className="etiqueta">Base en efectivo</span>
        <EntradaDinero data-ayuda="vender.base" grande valor={base} onCambio={setBase} autoFocus onKeyDown={(e) => e.key === 'Enter' && abrir()} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[0, 50000, 100000, 200000].map((v) => (
          <button key={v} onClick={() => setBase(v)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold hover:bg-slate-200">
            {v ? `$${(v / 1000).toLocaleString('es-CO')} mil` : 'Sin base'}
          </button>
        ))}
      </div>
      <Boton tamano="lg" className="mt-6 w-full" icono={LockOpen} onClick={abrir} cargando={cargando} disabled={licencia && !licencia.puede_vender}>
        Abrir caja
      </Boton>
      {licencia && !licencia.puede_vender && <p className="mt-3 text-center text-sm font-semibold text-peligro-600">{licencia.mensaje}</p>}
    </Tarjeta>
  )
}
