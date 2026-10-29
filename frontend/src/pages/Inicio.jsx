import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Banknote, HandCoins, PackageX, Receipt, ShoppingCart, TrendingUp, Trophy, Wallet } from 'lucide-react'
import { Barras, Dona } from '../components/Graficas'
import { Boton, Cargando, Indicador, Tarjeta, Vacio } from '../components/ui'
import { useSesion } from '../context/Sesion'
import { useApi } from '../hooks/datos'
import { cantidad, fechaCorta, hora, numero, pesos, saludo } from '../lib/formato'

const variacion = (hoy, ayer) => (ayer ? ((hoy - ayer) / ayer) * 100 : null)

export default function Inicio() {
  const { usuario, caja, esGestion } = useSesion()
  const navegar = useNavigate()
  const { datos: d, cargando } = useApi('/reportes/dashboard/')

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-3xl bg-noche p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:p-7 relative overflow-hidden">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-marca-600/40 blur-3xl" />
        <div className="relative">
          <p className="text-sm text-white/70">{saludo()},</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{(usuario?.nombre_completo || usuario?.username || '').split(' ')[0]} 👋</h1>
          <p className="mt-1 text-sm text-white/70">
            {caja?.abierta ? <>La caja #{caja.numero} está abierta desde las {hora(caja.abierta_en)}.</> : 'La caja está cerrada. Ábrela para empezar a vender.'}
          </p>
        </div>
        <div className="relative flex gap-2">
          <Boton tamano="lg" icono={ShoppingCart} onClick={() => navegar('/vender')}>Vender <span className="ml-1 rounded-md bg-white/20 px-1.5 text-xs">F3</span></Boton>
          <Boton tamano="lg" variante="secundario" icono={Wallet} onClick={() => navegar('/caja')} className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20">Caja</Boton>
        </div>
      </div>

      {cargando && !d ? <Cargando /> : d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Indicador titulo="Vendido hoy" valor={pesos(d.hoy.total_ventas)} icono={TrendingUp}
              tendencia={variacion(d.hoy.total_ventas, d.ayer.total_ventas)} detalle="vs. ayer" />
            <Indicador titulo="Ventas" valor={numero(d.hoy.num_ventas)} icono={Receipt} tono="gris"
              detalle={`Ticket promedio ${pesos(d.hoy.ticket_promedio)}`} />
            {esGestion
              ? <Indicador titulo="Utilidad estimada" valor={pesos(d.hoy.utilidad)} icono={Banknote} tono="exito"
                  detalle={d.hoy.total_ventas ? `${Math.round((d.hoy.utilidad / d.hoy.total_ventas) * 100)}% de margen` : 'según costos'} />
              : <Indicador titulo="Anuladas hoy" valor={numero(d.anuladas_hoy)} icono={Receipt} tono="peligro" />}
            <Indicador titulo="Fiado por cobrar" valor={pesos(d.fiado.cartera)} icono={HandCoins} tono="alerta"
              detalle={d.fiado.vencidos ? `${d.fiado.vencidos} vencidos` : `Abonos hoy ${pesos(d.fiado.abonos_hoy)}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta className="p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-extrabold">Ventas por hora</h3>
                <span className="text-xs text-tinta-4">Hoy</span>
              </div>
              <Barras datos={d.por_hora} x="hora" y="total" formatoX={(h) => `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`} />
            </Tarjeta>
            <Tarjeta className="p-5">
              <h3 className="mb-4 font-extrabold">Cómo te pagaron hoy</h3>
              {d.por_forma_pago.length ? <Dona datos={d.por_forma_pago} alto={150} /> : <Vacio titulo="Aún no hay ventas hoy" icono={Banknote} />}
            </Tarjeta>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta className="p-5">
              <h3 className="mb-3 font-extrabold">Últimos 7 días</h3>
              <Barras datos={d.semana} x="fecha" y="total" alto={180} resaltarUltima formatoX={(f) => fechaCorta(`${f}T12:00`)} />
            </Tarjeta>
            <Tarjeta className="p-5">
              <div className="mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-alerta-500" /><h3 className="font-extrabold">Lo más vendido hoy</h3></div>
              {d.top_productos.length === 0 ? <Vacio titulo="Sin ventas todavía" /> : (
                <ol className="space-y-2.5">
                  {d.top_productos.map((p, i) => (
                    <li key={p.producto_id} className="flex items-center gap-3">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs font-extrabold">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.nombre}</span>
                      <span className="text-xs text-tinta-4">{numero(p.cantidad)}</span>
                      <b className="w-20 text-right text-sm tabular-nums">{pesos(p.total)}</b>
                    </li>
                  ))}
                </ol>
              )}
            </Tarjeta>
            <Tarjeta className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-peligro-500" /><h3 className="font-extrabold">Por agotarse</h3></div>
                {d.stock_bajo.total > 0 && <Link to="/inventario?tab=pedido" className="text-xs font-bold text-marca-700 hover:underline">Pedido sugerido</Link>}
              </div>
              {d.stock_bajo.total === 0 ? <Vacio titulo="Todo en orden" texto="No hay productos por debajo del mínimo." icono={PackageX} /> : (
                <ul className="space-y-2">
                  {d.stock_bajo.productos.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-peligro-50/50 px-3 py-2">
                      <span className="truncate text-sm font-semibold">{p.nombre}</span>
                      <span className="shrink-0 text-xs font-bold text-peligro-700">{cantidad(p.stock, p.unidad_medida)} / mín {numero(p.stock_minimo)}</span>
                    </li>
                  ))}
                  {d.stock_bajo.total > d.stock_bajo.productos.length && <li className="text-xs text-tinta-4">y {d.stock_bajo.total - d.stock_bajo.productos.length} más…</li>}
                </ul>
              )}
            </Tarjeta>
          </div>

          <Tarjeta className="overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-extrabold">Últimas ventas</h3>
              <Link to="/ventas" className="inline-flex items-center gap-1 text-sm font-bold text-marca-700 hover:underline">Ver todas <ArrowRight className="h-4 w-4" /></Link>
            </div>
            {d.ultimas_ventas.length === 0 ? <Vacio titulo="Aún no hay ventas hoy" texto="Cuando vendas, aparecerán aquí." /> : (
              <div className="overflow-x-auto">
                <table className="tabla w-full">
                  <thead><tr><th>No.</th><th>Hora</th><th>Atendió</th><th className="hidden sm:table-cell">Cliente</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {d.ultimas_ventas.map((v) => (
                      <tr key={v.id}><td className="font-bold">#{v.numero}</td><td>{hora(v.creado)}</td><td>{v.usuario}</td>
                        <td className="hidden sm:table-cell text-tinta-4">{v.cliente || '—'}</td><td className="text-right font-bold tabular-nums">{pesos(v.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </>
      )}
    </div>
  )
}
