import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Cargando, ErrorCarga } from './ui'
import { SuscripcionVencida } from './Suscripcion'

/** Encabezado de página con botón de volver opcional. */
export function Encabezado({ titulo, subtitulo, volver, accion }) {
  const nav = useNavigate()
  return (
    <div className="mb-4 flex items-center gap-2 lg:mb-6">
      {volver && (
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav(volver))} aria-label="Volver"
          className={`-ml-2 grid h-10 w-10 place-items-center rounded-xl text-tinta-3 hover:bg-slate-100 ${volver === '/mas' ? 'lg:hidden' : ''}`}>
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold tracking-tight lg:text-2xl">{titulo}</h1>
        {subtitulo && <p className="truncate text-sm text-tinta-4">{subtitulo}</p>}
      </div>
      {accion}
    </div>
  )
}

/** Muestra cargando / error / suscripción vencida, o el contenido. */
export function Estado({ q, children }) {
  if (q.codigo === 402) return <SuscripcionVencida />
  if (q.cargando && !q.datos) return <Cargando />
  if (q.error && !q.datos) return <ErrorCarga texto={q.error} onReintentar={q.recargar} />
  return children(q.datos)
}
