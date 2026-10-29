import { useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSesion } from '../lib/sesion'
import { useDatos } from '../lib/datos'
import { fechaCorta, numero, pesos } from '../lib/formato'
import { coloresGrafica, useTema } from '../lib/tema'
import { Encabezado, Estado } from '../componentes/Pagina'
import { Segmentos, Tarjeta, Titulo } from '../componentes/ui'

const corto = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.0', '')}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v))

export default function Reportes() {
  const { tienda } = useSesion()
  const [dias, setDias] = useState(30)
  const q = useDatos(tienda && `/t/${tienda.id}/reportes/`, { params: { dias } })
  const [tema] = useTema()
  const col = coloresGrafica(tema)
  return (
    <>
      <Encabezado titulo="¿Cómo le va a la tienda?" volver="/mas" />
      <div className="lg:max-w-md"><Segmentos valor={dias} onCambio={setDias} opciones={[
        { valor: 7, etiqueta: '7 días' }, { valor: 30, etiqueta: '30 días' }, { valor: 90, etiqueta: '3 meses' },
      ]} /></div>
      <div className="mt-3">
        <Estado q={q}>
          {(d) => {
            const conVentas = d.por_dia.filter((x) => x.total > 0)
            const promedio = conVentas.length ? d.totales.total / conVentas.length : 0
            const mejor = conVentas.reduce((a, b) => (!a || b.total > a.total ? b : a), null)
            return (
              <>
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
                  <Tarjeta className="p-3.5"><p className="text-xs font-semibold text-tinta-4">Vendido</p><p className="text-xl font-extrabold tabular-nums">{pesos(d.totales.total)}</p></Tarjeta>
                  <Tarjeta className="p-3.5"><p className="text-xs font-semibold text-tinta-4">Ganancia aprox.</p><p className="text-xl font-extrabold tabular-nums">{pesos(d.totales.utilidad)}</p></Tarjeta>
                  <Tarjeta className="p-3.5"><p className="text-xs font-semibold text-tinta-4">Promedio por día</p><p className="text-lg font-extrabold tabular-nums">{pesos(promedio)}</p></Tarjeta>
                  <Tarjeta className="p-3.5"><p className="text-xs font-semibold text-tinta-4">Ventas</p><p className="text-lg font-extrabold tabular-nums">{numero(d.totales.num_ventas)}</p></Tarjeta>
                </div>
                <Tarjeta className="mt-3 p-4">
                  <p className="text-sm font-extrabold">{mejor ? `El mejor día fue el ${fechaCorta(`${mejor.fecha}T12:00:00`)} con ${pesos(mejor.total)}` : 'Sin ventas en este periodo'}</p>
                  <p className="text-xs text-tinta-4">Ventas de cada día</p>
                  <div className="mt-3 h-48 lg:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={d.por_dia} margin={{ top: 4, right: 0, left: -12, bottom: 0 }}>
                        <XAxis dataKey="fecha" tickFormatter={(f) => fechaCorta(`${f}T12:00:00`)} tickLine={false} axisLine={false}
                          tick={{ fontSize: 11, fill: col.eje }} interval="preserveStartEnd" minTickGap={24} />
                        <YAxis tickFormatter={corto} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: col.ejeSuave }} width={44} />
                        <Tooltip cursor={{ fill: col.cursor }} formatter={(v) => [pesos(v), 'Vendido']} labelFormatter={(f) => fechaCorta(`${f}T12:00:00`)}
                          contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--slate-200))', background: 'rgb(var(--superficie))', boxShadow: '0 8px 24px rgba(0,0,0,.18)', fontSize: 13 }} labelStyle={{ color: 'rgb(var(--tinta))', fontWeight: 700 }} itemStyle={{ color: '#2F7BFF' }} />
                        <Bar dataKey="total" fill="#1570EF" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Tarjeta>
                <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
                {d.top_productos.length > 0 && (
                  <div>
                    <Titulo>Los más vendidos</Titulo>
                    <Tarjeta className="divide-y divide-slate-100">
                      {d.top_productos.map((p, i) => (
                        <div key={p.nombre} className="flex items-center gap-3 px-4 py-3">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-marca-50 text-xs font-extrabold text-marca-700">{i + 1}</span>
                          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.nombre}</p><p className="text-xs text-tinta-4">{numero(p.cantidad)} vendidos</p></div>
                          <span className="font-extrabold tabular-nums">{pesos(p.total)}</span>
                        </div>
                      ))}
                    </Tarjeta>
                  </div>
                )}
                {d.formas_pago.length > 0 && (
                  <div>
                    <Titulo>Cómo le pagaron</Titulo>
                    <Tarjeta className="divide-y divide-slate-100">
                      {d.formas_pago.map((f) => (
                        <div key={f.nombre} className="flex items-center justify-between px-4 py-3">
                          <span className="font-semibold">{f.nombre}</span>
                          <span className="text-right"><b className="tabular-nums">{pesos(f.total)}</b>
                            <span className="ml-2 text-xs text-tinta-4">{d.totales.total ? Math.round((f.total / d.totales.total) * 100) : 0}%</span></span>
                        </div>
                      ))}
                    </Tarjeta>
                  </div>
                )}
                </div>
              </>
            )
          }}
        </Estado>
      </div>
    </>
  )
}
