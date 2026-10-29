import { AlertTriangle, ChevronRight, Loader2, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'

export const cx = (...c) => c.filter(Boolean).join(' ')

export function Tarjeta({ className, children, ...p }) {
  return <div className={cx('tarjeta', className)} {...p}>{children}</div>
}

export function Boton({ variante = 'primario', className, cargando, icono: Icono, children, ...p }) {
  const v = {
    primario: 'bg-marca-600 text-white shadow-marca hover:bg-marca-700 active:scale-[.98]',
    secundario: 'bg-superficie border border-slate-300 text-tinta-2 hover:bg-slate-50',
    suave: 'bg-marca-50 text-marca-700 hover:bg-marca-100',
    exito: 'bg-exito-600 text-white hover:bg-exito-700',
  }[variante]
  return (
    <button className={cx('inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold transition disabled:opacity-60', v, className)}
      disabled={cargando || p.disabled} {...p}>
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : Icono && <Icono className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Insignia({ tono = 'gris', className, children }) {
  const t = {
    gris: 'bg-slate-100 text-tinta-3', exito: 'bg-exito-50 text-exito-700', alerta: 'bg-alerta-50 text-alerta-700',
    peligro: 'bg-peligro-50 text-peligro-700', marca: 'bg-marca-50 text-marca-700',
  }[tono]
  return <span className={cx('chip', t, className)}>{children}</span>
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="space-y-3 animate-entrar" aria-busy="true" aria-label={texto}>
      {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />)}
    </div>
  )
}

export function Vacio({ icono: Icono, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icono && <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Icono className="h-7 w-7" /></span>}
      <p className="font-extrabold text-tinta">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-sm text-tinta-3">{texto}</p>}
      {children}
    </div>
  )
}

export function ErrorCarga({ texto, onReintentar }) {
  const sinRed = /conexión/i.test(texto || '')
  return (
    <Tarjeta className="p-2">
      <Vacio icono={sinRed ? WifiOff : AlertTriangle} titulo={sinRed ? 'Sin conexión' : 'No se pudo cargar'} texto={texto}>
        {onReintentar && <Boton variante="secundario" className="mt-4" onClick={onReintentar}>Reintentar</Boton>}
      </Vacio>
    </Tarjeta>
  )
}

/** Fila tocable de una lista (lleva a un detalle). */
export function Fila({ to, onClick, izquierda, titulo, subtitulo, derecha, derechaSub, className }) {
  const C = to ? Link : onClick ? 'button' : 'div'
  return (
    <C to={to} onClick={onClick} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-slate-50', className)}>
      {izquierda}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-tinta">{titulo}</p>
        {subtitulo && <p className="truncate text-[13px] text-tinta-4">{subtitulo}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-extrabold tabular-nums text-tinta">{derecha}</p>
        {derechaSub && <p className="text-xs text-tinta-4">{derechaSub}</p>}
      </div>
      {(to || onClick) && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
    </C>
  )
}

export function Titulo({ children, accion }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1 first:mt-0">
      <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-tinta-4">{children}</h2>
      {accion}
    </div>
  )
}

export function Segmentos({ opciones, valor, onCambio }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {opciones.map((o) => (
        <button key={o.valor} onClick={() => onCambio(o.valor)}
          className={cx('flex-1 rounded-lg px-2 py-2 text-[13px] font-bold transition',
            valor === o.valor ? 'bg-superficie text-tinta shadow-suave' : 'text-tinta-3')}>
          {o.etiqueta}{o.conteo != null && <span className="ml-1 text-tinta-4">{o.conteo}</span>}
        </button>
      ))}
    </div>
  )
}
