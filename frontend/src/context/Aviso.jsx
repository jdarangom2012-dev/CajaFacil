import { createContext, useCallback, useContext, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cx } from '../components/ui'

const Ctx = createContext(null)

const ESTILOS = {
  exito: ['bg-noche text-white', CheckCircle2, 'text-exito-500'],
  error: ['bg-peligro-600 text-white', AlertCircle, 'text-white'],
  info: ['bg-superficie text-tinta border border-slate-200', Info, 'text-marca-600'],
}

export function AvisoProvider({ children }) {
  const [avisos, setAvisos] = useState([])
  const quitar = useCallback((id) => setAvisos((a) => a.filter((x) => x.id !== id)), [])
  const mostrar = useCallback((texto, tipo = 'exito', ms = 3200) => {
    const id = Math.random().toString(36).slice(2)
    setAvisos((a) => [...a.slice(-3), { id, texto, tipo }])
    setTimeout(() => quitar(id), ms)
  }, [quitar])
  const api = {
    exito: (t) => mostrar(t, 'exito'),
    error: (t) => mostrar(t, 'error', 5000),
    info: (t) => mostrar(t, 'info'),
  }
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {avisos.map((a) => {
          const [clase, Icono, colorIcono] = ESTILOS[a.tipo]
          return (
            <div key={a.id} className={cx('pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-flotante animate-entrar', clase)}>
              <Icono className={cx('h-5 w-5 shrink-0', colorIcono)} />
              <span>{a.texto}</span>
              <button onClick={() => quitar(a.id)} className="ml-1 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export const useAviso = () => useContext(Ctx)
