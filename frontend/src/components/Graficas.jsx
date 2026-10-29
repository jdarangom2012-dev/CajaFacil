import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { pesos } from '../lib/formato'
import { coloresGrafica, useTema } from '../lib/tema'

const corto = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.0', '')}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${v}`)

function Globo({ active, payload, label, formatoEtiqueta }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-superficie px-3 py-2 text-xs shadow-flotante">
      <p className="mb-1 font-semibold text-tinta-4">{formatoEtiqueta ? formatoEtiqueta(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-bold text-tinta">{p.name}: {pesos(p.value)}</p>
      ))}
    </div>
  )
}

export function Barras({ datos, x, y, nombre = 'Ventas', alto = 220, color = '#1570EF', formatoX, resaltarUltima }) {
  const [tema] = useTema()
  const c = coloresGrafica(tema)
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.rejilla} />
        <XAxis dataKey={x} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.eje }} tickFormatter={formatoX} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.ejeSuave }} tickFormatter={corto} width={44} />
        <Tooltip cursor={{ fill: c.cursor }} content={<Globo formatoEtiqueta={formatoX} />} />
        <Bar dataKey={y} name={nombre} radius={[6, 6, 2, 2]} maxBarSize={36}>
          {datos.map((_, i) => <Cell key={i} fill={resaltarUltima && i === datos.length - 1 ? (tema === 'oscuro' ? '#5A9BFF' : '#0B57D0') : color} fillOpacity={resaltarUltima && i !== datos.length - 1 ? 0.55 : 1} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Dona({ datos, valor = 'total', nombre = 'nombre', alto = 180 }) {
  const total = datos.reduce((s, d) => s + Number(d[valor] || 0), 0)
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative" style={{ width: alto, height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos} dataKey={valor} nameKey={nombre} innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
              {datos.map((d, i) => <Cell key={i} fill={d.color || ['#1570EF', '#12B76A', '#F79009', '#7A5AF8', '#E31B54', '#0BA5EC'][i % 6]} />)}
            </Pie>
            <Tooltip content={<Globo />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="text-[11px] font-semibold text-tinta-4">Total</p><p className="text-sm font-extrabold">{pesos(total)}</p></div>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2">
        {datos.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color || ['#1570EF', '#12B76A', '#F79009', '#7A5AF8', '#E31B54', '#0BA5EC'][i % 6] }} />
            <span className="flex-1 truncate text-tinta-3">{d[nombre]}</span>
            <b className="tabular-nums">{pesos(d[valor])}</b>
            <span className="w-10 text-right text-xs text-tinta-4">{total ? Math.round((d[valor] / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
