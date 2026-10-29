import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { useDatos } from '../lib/datos'
import { fecha, fechaHora, hora, hoyISO, numero, pesos } from '../lib/formato'
import { Encabezado, Estado } from '../componentes/Pagina'
import { Fila, Insignia, Segmentos, Tarjeta, Titulo, Vacio } from '../componentes/ui'

const moverDia = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function Ventas() {
  const { tienda } = useSesion()
  const [params, setParams] = useSearchParams()
  const dia = params.get('fecha') || hoyISO()
  const [estado, setEstado] = useState('')
  const nav = useNavigate()
  const q = useDatos(tienda && `/t/${tienda.id}/ventas/`, { params: { fecha: dia }, cadaSeg: dia === hoyISO() ? 60 : 0 })
  const esHoy = dia === hoyISO()
  const ir = (n) => setParams({ fecha: moverDia(dia, n) }, { replace: true })

  return (
    <>
      <Encabezado titulo="Ventas" />
      <div className="mb-3 flex items-center gap-2 lg:max-w-md">
        <button onClick={() => ir(-1)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-superficie" aria-label="Día anterior"><ChevronLeft className="h-5 w-5" /></button>
        <input type="date" className="campo flex-1 text-center font-bold" value={dia} max={hoyISO()}
          onChange={(e) => e.target.value && setParams({ fecha: e.target.value }, { replace: true })} />
        <button onClick={() => ir(1)} disabled={esHoy} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-superficie disabled:opacity-40" aria-label="Día siguiente"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <Estado q={q}>
        {(d) => {
          const lista = d.ventas.filter((v) => !estado || v.estado === estado)
          return (
            <>
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
                <Tarjeta className="p-3.5 lg:p-4"><p className="text-xs font-semibold text-tinta-4">Total vendido</p><p className="text-xl font-extrabold tabular-nums lg:text-2xl">{pesos(d.totales.total)}</p></Tarjeta>
                <Tarjeta className="p-3.5 lg:p-4"><p className="text-xs font-semibold text-tinta-4">Ganancia aprox.</p><p className="text-xl font-extrabold tabular-nums lg:text-2xl">{pesos(d.totales.utilidad)}</p></Tarjeta>
                <Tarjeta className="hidden p-4 lg:block"><p className="text-xs font-semibold text-tinta-4">Ventas</p><p className="text-2xl font-extrabold tabular-nums">{numero(d.totales.num_ventas)}</p></Tarjeta>
                <Tarjeta className="hidden p-4 lg:block"><p className="text-xs font-semibold text-tinta-4">Por cliente</p><p className="text-2xl font-extrabold tabular-nums">{pesos(d.totales.ticket_promedio)}</p></Tarjeta>
              </div>
              <div className="mt-3 lg:max-w-sm">
                <Segmentos valor={estado} onCambio={setEstado} opciones={[
                  { valor: '', etiqueta: 'Todas', conteo: d.ventas.length },
                  { valor: 'ANULADA', etiqueta: 'Anuladas', conteo: d.totales.anuladas },
                ]} />
              </div>
              <Titulo>{esHoy ? 'Hoy' : fecha(`${dia}T12:00:00`)}</Titulo>
              {lista.length > 0 && (
                <Tarjeta className="hidden overflow-hidden lg:block">
                  <table className="tabla w-full">
                    <thead><tr><th>#</th><th>Hora</th><th>Cliente</th><th>Pago</th><th>Atendió</th><th>Estado</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {lista.map((v) => (
                        <tr key={v.id} className="cursor-pointer" onClick={() => nav(`/ventas/${v.id}`)}>
                          <td className="font-bold">#{v.numero}</td>
                          <td>{hora(v.fecha)}</td>
                          <td>{v.cliente || <span className="text-tinta-4">—</span>}</td>
                          <td>{v.formas_pago || '—'}</td>
                          <td>{v.usuario}</td>
                          <td>{v.estado === 'ANULADA' ? <Insignia tono="peligro">Anulada</Insignia> : <Insignia tono="exito">Pagada</Insignia>}</td>
                          <td className={`text-right font-extrabold tabular-nums ${v.estado === 'ANULADA' ? 'text-tinta-4 line-through' : ''}`}>{pesos(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Tarjeta>
              )}
              <Tarjeta className={`divide-y divide-slate-100 ${lista.length ? 'lg:hidden' : ''}`}>
                {lista.length === 0 && <Vacio icono={Receipt} titulo="Sin ventas" texto={estado ? 'No hubo ventas anuladas este día.' : 'No hay ventas registradas este día.'} />}
                {lista.map((v) => (
                  <Fila key={v.id} to={`/ventas/${v.id}`}
                    titulo={<>#{v.numero} {v.cliente && <span className="font-semibold text-tinta-3">· {v.cliente}</span>}</>}
                    subtitulo={`${hora(v.fecha)} · ${v.formas_pago || '—'} · ${v.usuario}`}
                    derecha={<span className={v.estado === 'ANULADA' ? 'text-tinta-4 line-through' : ''}>{pesos(v.total)}</span>}
                    derechaSub={v.estado === 'ANULADA' && <Insignia tono="peligro">Anulada</Insignia>} />
                ))}
              </Tarjeta>
            </>
          )
        }}
      </Estado>
    </>
  )
}

export function VentaDetalle() {
  const { tienda } = useSesion()
  const { id } = useParams()
  const q = useDatos(tienda && `/t/${tienda.id}/ventas/${id}/`)
  return (
    <Estado q={q}>
      {(v) => (
        <>
          <Encabezado volver="/ventas" titulo={`Venta #${v.numero}`} subtitulo={fechaHora(v.fecha)}
            accion={v.estado === 'ANULADA' && <Insignia tono="peligro">Anulada</Insignia>} />
          {v.estado === 'ANULADA' && v.motivo_anulacion && (
            <p className="mb-3 rounded-2xl bg-peligro-50 p-4 text-sm text-peligro-700"><b>Motivo de la anulación:</b> {v.motivo_anulacion}</p>
          )}
          <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-4">
          <Tarjeta className="divide-y divide-slate-100 lg:col-span-8">
            {v.items.map((i, n) => (
              <div key={n} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{i.nombre}</p>
                  <p className="text-xs text-tinta-4">{numero(i.cantidad)} × {pesos(i.precio_unit)}{i.descuento > 0 && ` · desc. ${pesos(i.descuento)}`}</p>
                </div>
                <p className="font-extrabold tabular-nums">{pesos(i.subtotal)}</p>
              </div>
            ))}
          </Tarjeta>
          <div className="lg:col-span-4">
          <Tarjeta className="mt-3 space-y-1.5 p-4 text-[15px] lg:mt-0">
            {v.descuento > 0 && <div className="flex justify-between"><span className="text-tinta-3">Descuento</span><span className="tabular-nums">-{pesos(v.descuento)}</span></div>}
            <div className="flex justify-between text-lg font-extrabold"><span>Total</span><span className="tabular-nums">{pesos(v.total)}</span></div>
            {v.pagos.map((p, n) => <div key={n} className="flex justify-between text-sm"><span className="text-tinta-3">{p.forma_pago}</span><span className="tabular-nums">{pesos(p.monto)}</span></div>)}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-sm"><span className="text-tinta-3">Ganancia aprox.</span><span className="font-bold tabular-nums">{pesos(v.utilidad)}</span></div>
          </Tarjeta>
          <p className="mt-3 px-1 text-sm text-tinta-4">Atendió <b>{v.usuario}</b>{v.terminal && ` en ${v.terminal}`}{v.cliente && ` · Cliente: ${v.cliente}`}</p>
          </div>
          </div>
        </>
      )}
    </Estado>
  )
}
