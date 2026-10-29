import { forwardRef, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Inbox, Loader2, Search, X } from 'lucide-react'

export const cx = (...c) => c.filter(Boolean).join(' ')

/* ── Botón ───────────────────────────────────────────────── */
const VARIANTES = {
  primario: 'bg-marca-600 text-white hover:bg-[#0B57D0] shadow-marca active:scale-[.98]',
  secundario: 'bg-superficie text-tinta-2 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
  suave: 'bg-marca-50 text-marca-700 hover:bg-marca-100',
  fantasma: 'text-tinta-3 hover:bg-slate-100 hover:text-tinta',
  exito: 'bg-exito-500 text-white hover:bg-exito-600 shadow-[0_8px_24px_-8px_rgba(18,183,106,.6)] active:scale-[.98]',
  peligro: 'bg-peligro-600 text-white hover:bg-[#B42318]',
  'peligro-suave': 'bg-peligro-50 text-peligro-700 hover:bg-peligro-100',
  oscuro: 'bg-noche text-white hover:bg-noche-2',
}
const TAMANOS = {
  xs: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-2xl',
  xl: 'h-16 px-7 text-lg gap-3 rounded-2xl',
  icono: 'h-10 w-10 rounded-xl',
  'icono-sm': 'h-8 w-8 rounded-lg',
}

export const Boton = forwardRef(function Boton(
  { variante = 'primario', tamano = 'md', cargando, icono: Icono, iconoDer: IconoDer, className, children, disabled, ...p },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || cargando}
      className={cx(
        'inline-flex items-center justify-center font-semibold transition-all select-none whitespace-nowrap',
        'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-200',
        VARIANTES[variante], TAMANOS[tamano], className,
      )}
      {...p}
    >
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : Icono && <Icono className={tamano === 'lg' || tamano === 'xl' ? 'h-5 w-5' : 'h-4 w-4'} />}
      {children}
      {IconoDer && !cargando && <IconoDer className="h-4 w-4" />}
    </button>
  )
})

/* ── Campos ──────────────────────────────────────────────── */
export const Campo = ({ etiqueta, ayuda, error, children, className }) => (
  <label className={cx('block', className)}>
    {etiqueta && <span className="etiqueta">{etiqueta}</span>}
    {children}
    {error ? <span className="mt-1 block text-xs font-medium text-peligro-600">{error}</span>
      : ayuda && <span className="mt-1 block text-xs text-tinta-4">{ayuda}</span>}
  </label>
)

export const Entrada = forwardRef(function Entrada({ className, icono: Icono, ...p }, ref) {
  if (!Icono) return <input ref={ref} className={cx('campo', className)} {...p} />
  return (
    <div className="relative">
      <Icono className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input ref={ref} className={cx('campo pl-10', className)} {...p} />
    </div>
  )
})

export const Selector = forwardRef(function Selector({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cx('campo appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%23667085%27 stroke-width=%272%27%3E%3Cpath d=%27M4 6l4 4 4-4%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} {...p}>
      {children}
    </select>
  )
})

export const AreaTexto = (p) => <textarea {...p} className={cx('campo h-auto min-h-[80px] py-2.5', p.className)} />

/** Campo de dinero: muestra separador de miles mientras se escribe. */
export const EntradaDinero = forwardRef(function EntradaDinero({ valor, onCambio, className, grande, ...p }, ref) {
  const mostrar = (v) => (v ? Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '')
  const leer = (t) => Number(String(t).replace(/\./g, '').replace(',', '.')) || 0
  const [txt, setTxt] = useState(mostrar(valor))
  useEffect(() => {
    if (leer(txt) !== Number(valor || 0)) setTxt(mostrar(valor))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])
  return (
    <div className="relative">
      <span className={cx('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-slate-400', grande && 'text-xl left-4')}>$</span>
      <input
        ref={ref}
        inputMode="decimal"
        className={cx('campo pl-8 font-semibold tabular-nums', grande && 'h-16 pl-10 text-3xl rounded-2xl', className)}
        value={txt}
        onChange={(e) => {
          // En pesos colombianos el punto es separador de miles y la coma es decimal
          const limpio = e.target.value.replace(/[^\d,]/g, '')
          const [entero, ...dec] = limpio.split(',')
          const decimales = dec.join('').slice(0, 2)
          const n = Number(entero || 0) + (decimales ? Number(`0.${decimales}`) : 0)
          const conMiles = entero ? Number(entero).toLocaleString('es-CO') : ''
          setTxt(limpio.includes(',') ? `${conMiles || '0'},${decimales}` : conMiles)
          onCambio?.(n)
        }}
        onFocus={(e) => e.target.select()}
        {...p}
      />
    </div>
  )
})

export const Interruptor = ({ activo, onCambio, etiqueta, descripcion, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onCambio(!activo)}
    className="flex w-full items-start gap-3 text-left disabled:opacity-50"
  >
    <span className={cx('mt-0.5 relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', activo ? 'bg-marca-600' : 'bg-slate-300')}>
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-superficie shadow transition-all', activo ? 'left-[22px]' : 'left-0.5')} />
    </span>
    <span>
      <span className="block text-sm font-semibold text-tinta-2">{etiqueta}</span>
      {descripcion && <span className="block text-xs text-tinta-4 mt-0.5">{descripcion}</span>}
    </span>
  </button>
)

export const Buscador = ({ valor, onCambio, placeholder = 'Buscar…', className, autoFocus }) => (
  <div className={cx('relative', className)}>
    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input className="campo pl-10 pr-9" value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
    {valor && (
      <button type="button" onClick={() => onCambio('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
)

/* ── Contenedores ────────────────────────────────────────── */
export const Tarjeta = ({ className, children, ...p }) => <div className={cx('tarjeta', className)} {...p}>{children}</div>

export const EncabezadoPagina = ({ titulo, descripcion, acciones, icono: Icono }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="flex items-center gap-3 min-w-0">
      {Icono && (
        <span className="hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-superficie border border-slate-200 text-marca-600 shadow-suave">
          <Icono className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-tinta">{titulo}</h1>
        {descripcion && <p className="text-sm text-tinta-4 mt-0.5">{descripcion}</p>}
      </div>
    </div>
    {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
  </div>
)

const TONOS = {
  gris: 'bg-slate-100 text-slate-700',
  marca: 'bg-marca-50 text-marca-700',
  exito: 'bg-exito-50 text-exito-700',
  alerta: 'bg-alerta-50 text-alerta-700',
  peligro: 'bg-peligro-50 text-peligro-700',
  oscuro: 'bg-noche text-white',
}
export const Insignia = ({ tono = 'gris', children, className, punto }) => (
  <span className={cx('chip', TONOS[tono], className)}>
    {punto && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
)

export const Cargando = ({ texto = 'Cargando…', className }) => (
  <div className={cx('flex items-center justify-center gap-2 py-16 text-tinta-4', className)}>
    <Loader2 className="h-5 w-5 animate-spin text-marca-600" /> <span className="text-sm">{texto}</span>
  </div>
)

export const Vacio = ({ icono: Icono = Inbox, titulo = 'Nada por aquí', texto, accion, className }) => (
  <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
    <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-marca-50 text-marca-600">
      <Icono className="h-6 w-6" />
    </span>
    <p className="font-bold text-tinta-2">{titulo}</p>
    {texto && <p className="mt-1 max-w-sm text-sm text-tinta-4">{texto}</p>}
    {accion && <div className="mt-4">{accion}</div>}
  </div>
)

export const Pestanas = ({ opciones, valor, onCambio, className }) => (
  <div className={cx('inline-flex max-w-full overflow-x-auto scroll-fino rounded-xl bg-slate-100 p-1 gap-1', className)}>
    {opciones.map((o) => {
      const Icono = o.icono
      return (
        <button
          key={o.valor}
          type="button"
          onClick={() => onCambio(o.valor)}
          className={cx(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
            valor === o.valor ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-4 hover:text-tinta-2',
          )}
        >
          {Icono && <Icono className="h-4 w-4" />}
          {o.etiqueta}
          {o.contador != null && <span className="ml-0.5 rounded-full bg-slate-200 px-1.5 text-[11px]">{o.contador}</span>}
        </button>
      )
    })}
  </div>
)

/* ── Modal y panel lateral ───────────────────────────────── */
function useEscape(abierto, onCerrar) {
  useEffect(() => {
    if (!abierto) return
    const h = (e) => e.key === 'Escape' && onCerrar?.()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [abierto, onCerrar])
}

const ANCHOS = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }

export function Modal({ abierto, onCerrar, titulo, descripcion, children, pie, ancho = 'md', sinCerrar }) {
  useEscape(abierto, sinCerrar ? null : onCerrar)
  if (!abierto) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-noche/50 backdrop-blur-[2px] animate-aparecer" onClick={sinCerrar ? undefined : onCerrar} />
      <div className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-superficie shadow-flotante sm:rounded-3xl animate-subir sm:animate-aparecer', ANCHOS[ancho])}>
        {(titulo || !sinCerrar) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6">
            <div>
              {titulo && <h2 className="text-lg font-extrabold text-tinta">{titulo}</h2>}
              {descripcion && <p className="text-sm text-tinta-4 mt-0.5">{descripcion}</p>}
            </div>
            {!sinCerrar && (
              <button type="button" onClick={onCerrar} className="-mr-2 -mt-1 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-tinta">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto scroll-fino px-5 pb-5 sm:px-6">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Panel({ abierto, onCerrar, titulo, subtitulo, children, pie, ancho = 'max-w-xl' }) {
  useEscape(abierto, onCerrar)
  if (!abierto) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-noche/40 backdrop-blur-[2px] animate-aparecer" onClick={onCerrar} />
      <div className={cx('relative flex h-full w-full flex-col bg-superficie shadow-flotante animate-entrar', ancho)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold">{titulo}</h2>
            {subtitulo && <div className="text-sm text-tinta-4">{subtitulo}</div>}
          </div>
          <button type="button" onClick={onCerrar} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-tinta">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-fino p-5">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Confirmar({ abierto, onCerrar, onConfirmar, titulo, texto, textoBoton = 'Confirmar', peligro, cargando, children }) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} ancho="sm"
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton variante={peligro ? 'peligro' : 'primario'} onClick={onConfirmar} cargando={cargando}>{textoBoton}</Boton>
      </>}>
      <div className="flex gap-4">
        <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', peligro ? 'bg-peligro-50 text-peligro-600' : 'bg-marca-50 text-marca-600')}>
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="pt-1">
          <h3 className="text-lg font-extrabold">{titulo}</h3>
          {texto && <p className="mt-1 text-sm text-tinta-3">{texto}</p>}
          {children}
        </div>
      </div>
    </Modal>
  )
}

/* ── Indicadores ─────────────────────────────────────────── */
export const Indicador = ({ titulo, valor, detalle, icono: Icono, tono = 'marca', tendencia, className }) => {
  const fondos = {
    marca: 'bg-marca-50 text-marca-600', exito: 'bg-exito-50 text-exito-600',
    alerta: 'bg-alerta-50 text-alerta-600', peligro: 'bg-peligro-50 text-peligro-600', gris: 'bg-slate-100 text-slate-600',
  }
  return (
    <Tarjeta className={cx('p-4 sm:p-5', className)} data-ayuda-texto={typeof titulo === 'string' ? titulo : undefined}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-tinta-4">{titulo}</p>
        {Icono && <span className={cx('grid h-9 w-9 place-items-center rounded-xl', fondos[tono])}><Icono className="h-[18px] w-[18px]" /></span>}
      </div>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums sm:text-[28px]">{valor}</p>
      {(detalle || tendencia != null) && (
        <div className="mt-1 flex items-center gap-2 text-xs text-tinta-4">
          {tendencia != null && Number.isFinite(tendencia) && (
            <span className={cx('chip', tendencia >= 0 ? 'bg-exito-50 text-exito-700' : 'bg-peligro-50 text-peligro-700')}>
              {tendencia >= 0 ? '▲' : '▼'} {Math.abs(tendencia).toFixed(0)}%
            </span>
          )}
          {detalle}
        </div>
      )}
    </Tarjeta>
  )
}

/** Hook: ejecuta onEnter cuando un lector de código de barras "escribe" rápido en cualquier parte. */
export function useAutoFoco(ref, deps = []) {
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 60); return () => clearTimeout(t) }, deps) // eslint-disable-line
}

export function useDebounce(valor, ms = 250) {
  const [v, setV] = useState(valor)
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t) }, [valor, ms])
  return v
}

export function useClickFuera(onFuera) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onFuera()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onFuera])
  return ref
}
