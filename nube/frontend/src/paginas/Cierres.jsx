import { useState } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { useDatos } from '../lib/datos'
import { fechaHora, hora, pesos } from '../lib/formato'
import { Encabezado, Estado } from '../componentes/Pagina'
import { Tarjeta, Vacio, cx } from '../componentes/ui'
import { Diferencia } from './Inicio'

function Cierre({ c }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Tarjeta>
      <button onClick={() => setAbierto(!abierto)} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-bold">Caja #{c.numero} · {c.usuario}</p>
          <p className="text-[13px] text-tinta-4">{fechaHora(c.cerrada_en)}</p>
        </div>
        <div className="text-right">
          <p className="font-extrabold tabular-nums">{pesos(c.total_ventas)}</p>
          <p className="text-xs"><Diferencia v={c.diferencia} /></p>
        </div>
        <ChevronDown className={cx('h-4 w-4 text-slate-400 transition', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <dl className="space-y-1.5 border-t border-slate-100 px-4 py-3 text-sm">
          <div className="flex justify-between"><dt className="text-tinta-3">Abrió</dt><dd>{hora(c.abierta_en)} con base de {pesos(c.base)}</dd></div>
          <div className="flex justify-between"><dt className="text-tinta-3">Ventas</dt><dd>{c.num_ventas ?? '—'}{c.num_anuladas ? ` (${c.num_anuladas} anuladas)` : ''}</dd></div>
          {c.por_forma_pago.filter((f) => f.total).map((f) => (
            <div key={f.nombre} className="flex justify-between"><dt className="text-tinta-3">{f.nombre}</dt><dd className="tabular-nums">{pesos(f.total)}</dd></div>
          ))}
          {!!c.ingresos && <div className="flex justify-between"><dt className="text-tinta-3">Entradas de efectivo</dt><dd className="tabular-nums">{pesos(c.ingresos)}</dd></div>}
          {!!c.egresos && <div className="flex justify-between"><dt className="text-tinta-3">Salidas de efectivo</dt><dd className="tabular-nums">-{pesos(c.egresos)}</dd></div>}
          <div className="flex justify-between border-t border-slate-100 pt-1.5"><dt className="text-tinta-3">Debía haber en efectivo</dt><dd className="font-bold tabular-nums">{pesos(c.efectivo_esperado)}</dd></div>
          <div className="flex justify-between"><dt className="text-tinta-3">Contaron</dt><dd className="font-bold tabular-nums">{pesos(c.efectivo_contado)}</dd></div>
          {c.utilidad != null && <div className="flex justify-between"><dt className="text-tinta-3">Ganancia aprox.</dt><dd className="tabular-nums">{pesos(c.utilidad)}</dd></div>}
        </dl>
      )}
    </Tarjeta>
  )
}

export default function Cierres() {
  const { tienda } = useSesion()
  const q = useDatos(tienda && `/t/${tienda.id}/cierres/`)
  return (
    <>
      <Encabezado titulo="Cierres de caja" volver="/mas" subtitulo="Cuánto se vendió y si cuadró la plata" />
      <Estado q={q}>
        {(lista) => lista.length === 0
          ? <Tarjeta><Vacio icono={Lock} titulo="Aún no hay cierres" texto="Aquí aparece cada cierre de caja cuando lo hagan en la tienda." /></Tarjeta>
          : <div className="grid gap-2.5 lg:grid-cols-2 lg:items-start lg:gap-4">{lista.map((c) => <Cierre key={c.id} c={c} />)}</div>}
      </Estado>
    </>
  )
}
