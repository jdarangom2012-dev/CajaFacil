import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, HandCoins, Package, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useSesion } from '../lib/sesion'
import { useDatos } from '../lib/datos'
import { fecha, fechaHora, hoyISO, numero, pesos, saludo } from '../lib/formato'
import { coloresGrafica, useTema } from '../lib/tema'
import { Estado } from '../componentes/Pagina'
import { AvisoSuscripcion } from '../componentes/Suscripcion'
import { Fila, Tarjeta, Titulo, cx } from '../componentes/ui'

const moverDia = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function Comparacion({ hoy, antes, texto }) {
  if (!antes) return <p className="text-sm text-white/70">{texto}: sin ventas</p>
  const pct = Math.round(((hoy - antes) / antes) * 100)
  const sube = pct >= 0
  const Ico = sube ? TrendingUp : TrendingDown
  return (
    <p className="flex items-center gap-1 text-sm text-white/85">
      <Ico className="h-4 w-4" /> <b>{sube ? '+' : ''}{pct}%</b> vs {texto} ({pesos(antes)})
    </p>
  )
}

function Mini({ titulo, valor, sub }) {
  return (
    <div className="rounded-2xl bg-superficie p-3.5 shadow-suave border border-slate-200/80 lg:p-4">
      <p className="text-xs font-semibold text-tinta-4">{titulo}</p>
      <p className="mt-0.5 truncate text-lg font-extrabold tabular-nums lg:text-2xl">{valor}</p>
      {sub && <p className="text-[11px] text-tinta-4">{sub}</p>}
    </div>
  )
}

function VentasPorHora({ datos }) {
  const [tema] = useTema()
  const col = coloresGrafica(tema)
  const conVentas = datos.filter((d) => d.total > 0)
  if (!conVentas.length) return null
  const desde = Math.max(0, Math.min(...conVentas.map((d) => d.hora)) - 1)
  const hasta = Math.min(23, Math.max(...conVentas.map((d) => d.hora)) + 1)
  const serie = datos.slice(desde, hasta + 1).map((d) => ({ ...d, etiqueta: `${d.hora % 12 || 12}${d.hora < 12 ? 'a' : 'p'}` }))
  const pico = conVentas.reduce((a, b) => (b.total > a.total ? b : a))
  return (
    <Tarjeta className="h-full p-4">
      <p className="text-sm font-extrabold">La hora más fuerte fue a las {pico.hora % 12 || 12} {pico.hora < 12 ? 'a. m.' : 'p. m.'}</p>
      <p className="text-xs text-tinta-4">{pesos(pico.total)} vendidos en esa hora</p>
      <div className="mt-3 h-36 lg:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: col.eje }} interval="preserveStartEnd" />
            <Tooltip cursor={{ fill: col.cursor }} formatter={(v) => [pesos(v), 'Ventas']} labelFormatter={(l) => `Hora ${l}`}
              contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--slate-200))', background: 'rgb(var(--superficie))', boxShadow: '0 8px 24px rgba(0,0,0,.18)', fontSize: 13 }} labelStyle={{ color: 'rgb(var(--tinta))', fontWeight: 700 }} itemStyle={{ color: '#2F7BFF' }} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#1570EF" fillOpacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Tarjeta>
  )
}

export default function Inicio() {
  const { tienda, sesion } = useSesion()
  const [dia, setDia] = useState(hoyISO())
  const esHoy = dia === hoyISO()
  const q = useDatos(tienda && `/t/${tienda.id}/inicio/`, { params: { fecha: dia }, cadaSeg: esHoy ? 60 : 0 })

  return (
    <>
      <AvisoSuscripcion />
      <p className="mb-3 px-1 text-[15px] text-tinta-3 lg:mb-5 lg:text-2xl lg:font-extrabold lg:text-tinta">{saludo()}{sesion?.nombre ? `, ${sesion.nombre.split(' ')[0]}` : ''}</p>
      <Estado q={q}>
        {(d) => {
          const v = d.ventas
          return (
            <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
              {/* Fila 1: total del día + indicadores */}
              <div className="flex flex-col justify-center rounded-3xl bg-gradient-to-br from-marca-600 to-[#0B4DB8] p-5 text-white shadow-marca lg:col-span-5 lg:p-7">
                <div className="flex items-center justify-between">
                  <button onClick={() => setDia(moverDia(dia, -1))} className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 hover:bg-white/25" aria-label="Día anterior"><ChevronLeft className="h-5 w-5" /></button>
                  <p className="text-sm font-bold text-white/90">{esHoy ? 'Vendido hoy' : `Vendido el ${fecha(`${dia}T12:00:00`)}`}</p>
                  <button onClick={() => setDia(moverDia(dia, 1))} disabled={esHoy} className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-30" aria-label="Día siguiente"><ChevronRight className="h-5 w-5" /></button>
                </div>
                <p className="mt-3 text-center text-[42px] font-extrabold leading-none tracking-tight tabular-nums lg:mt-5 lg:text-[52px]">{pesos(v.total)}</p>
                <div className="mt-3 flex flex-col items-center gap-0.5">
                  <Comparacion hoy={v.total} antes={d.comparacion.ayer} texto={esHoy ? 'ayer a esta hora' : 'el día anterior'} />
                </div>
              </div>

              <div className="grid gap-3 lg:col-span-7 lg:gap-4">
                <div className="grid grid-cols-3 gap-2.5 lg:gap-4">
                  <Mini titulo="Ventas" valor={numero(v.num_ventas)} sub={v.anuladas ? `${v.anuladas} anulada${v.anuladas > 1 ? 's' : ''}` : 'ninguna anulada'} />
                  <Mini titulo="Ganancia" valor={pesos(v.utilidad)} sub="aproximada" />
                  <Mini titulo="Por cliente" valor={pesos(v.ticket_promedio)} sub="en promedio" />
                </div>
                <div className="grid grid-cols-2 gap-2.5 lg:gap-4">
                  <Link to="/fiados" className="tarjeta flex items-center gap-3 p-3.5 transition hover:border-alerta-200 active:scale-[.99] lg:p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-alerta-50 text-alerta-600"><HandCoins className="h-5 w-5" /></span>
                    <div className="min-w-0"><p className="text-xs font-semibold text-tinta-4">Le deben</p><p className="truncate font-extrabold tabular-nums lg:text-lg">{pesos(d.fiado.saldo)}</p>
                      <p className="text-[11px] text-tinta-4">{d.fiado.clientes} cliente{d.fiado.clientes === 1 ? '' : 's'}</p></div>
                  </Link>
                  <Link to="/inventario?filtro=bajo" className="tarjeta flex items-center gap-3 p-3.5 transition hover:border-peligro-100 active:scale-[.99] lg:p-4">
                    <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', d.inventario_bajo ? 'bg-peligro-50 text-peligro-600' : 'bg-exito-50 text-exito-600')}><Package className="h-5 w-5" /></span>
                    <div className="min-w-0"><p className="text-xs font-semibold text-tinta-4">Por acabarse</p><p className="font-extrabold tabular-nums lg:text-lg">{d.inventario_bajo}</p>
                      <p className="text-[11px] text-tinta-4">{d.inventario_bajo ? `producto${d.inventario_bajo === 1 ? '' : 's'}, toca pedir` : 'todo bien'}</p></div>
                  </Link>
                </div>
                {d.alertas_sin_ver > 0 && (
                  <Link to="/alertas" className="flex items-center gap-3 rounded-2xl bg-peligro-50 p-4 text-peligro-700">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p className="min-w-0 flex-1 text-sm"><b>{d.alertas_sin_ver} alerta{d.alertas_sin_ver > 1 ? 's' : ''} sin revisar.</b> <span className="line-clamp-1">{d.alertas[0]?.detalle}</span></p>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>

              {/* Fila 2: ventas por hora + formas de pago */}
              <div className="lg:col-span-7">
                {v.num_ventas > 0
                  ? <VentasPorHora datos={d.por_hora} />
                  : (
                    <Tarjeta className="flex h-full min-h-[10rem] flex-col items-center justify-center p-6 text-center">
                      <p className="font-extrabold">{esHoy ? 'Todavía no hay ventas hoy' : 'No hubo ventas ese día'}</p>
                      <p className="mt-1 text-sm text-tinta-4">{esHoy ? 'Aquí verás a qué horas se vende más. Se actualiza sola cada minuto.' : 'Usa las flechas para ver otro día.'}</p>
                    </Tarjeta>
                  )}
              </div>
              <div className="lg:col-span-5">
                <Titulo>Cómo le pagaron</Titulo>
                <Tarjeta className="divide-y divide-slate-100">
                  {d.formas_pago.length === 0 && <p className="px-4 py-6 text-center text-sm text-tinta-4">Sin pagos registrados</p>}
                  {d.formas_pago.map((f) => (
                    <div key={f.nombre} className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-tinta-4" />{f.nombre}</span>
                      <span className="font-extrabold tabular-nums">{pesos(f.total)}</span>
                    </div>
                  ))}
                </Tarjeta>
              </div>

              {/* Fila 3: más vendidos + último cierre */}
              <div className="lg:col-span-7">
                <Titulo>Lo que más se vendió</Titulo>
                <Tarjeta className="divide-y divide-slate-100">
                  {d.top_productos.length === 0 && <p className="px-4 py-6 text-center text-sm text-tinta-4">Aún no hay productos vendidos</p>}
                  {d.top_productos.map((p, i) => (
                    <div key={p.nombre} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-marca-50 text-xs font-extrabold text-marca-700">{i + 1}</span>
                      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.nombre}</p><p className="text-xs text-tinta-4">{numero(p.cantidad)} vendidos</p></div>
                      <span className="font-extrabold tabular-nums">{pesos(p.total)}</span>
                    </div>
                  ))}
                </Tarjeta>
              </div>
              <div className="lg:col-span-5">
                <Titulo accion={<Link to="/cierres" className="text-sm font-bold text-marca-600">Ver todos</Link>}>Último cierre de caja</Titulo>
                <Tarjeta>
                  {d.ultimo_cierre
                    ? <Fila to="/cierres" titulo={`Caja #${d.ultimo_cierre.numero} · ${d.ultimo_cierre.usuario}`}
                        subtitulo={fechaHora(d.ultimo_cierre.cerrada_en)} derecha={pesos(d.ultimo_cierre.total_ventas)}
                        derechaSub={<Diferencia v={d.ultimo_cierre.diferencia} />} />
                    : <p className="px-4 py-6 text-center text-sm text-tinta-4">Aún no han cerrado caja</p>}
                </Tarjeta>
              </div>
            </div>
          )
        }}
      </Estado>
    </>
  )
}

export function Diferencia({ v }) {
  if (!v) return <span className="font-bold text-exito-700">Cuadró exacto</span>
  return v > 0
    ? <span className="font-bold text-alerta-700">Sobró {pesos(v)}</span>
    : <span className="font-bold text-peligro-700">Faltó {pesos(-v)}</span>
}
