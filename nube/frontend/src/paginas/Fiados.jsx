import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { HandCoins, MessageCircle, Search } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { useDatos } from '../lib/datos'
import { fechaCorta, fechaHora, iniciales, pesos } from '../lib/formato'
import { Encabezado, Estado } from '../componentes/Pagina'
import { Boton, Fila, Insignia, Tarjeta, Titulo, Vacio } from '../componentes/ui'

const telWa = (t) => {
  const d = String(t || '').replace(/\D/g, '')
  return d.length === 10 ? `57${d}` : d
}

export default function Fiados() {
  const { tienda } = useSesion()
  const q = useDatos(tienda && `/t/${tienda.id}/fiados/`, { cadaSeg: 120 })
  const [buscar, setBuscar] = useState('')
  return (
    <>
      <Encabezado titulo="Fiados" subtitulo="Quién te debe y cuánto" />
      <Estado q={q}>
        {(d) => {
          const lista = d.clientes.filter((c) => !buscar || c.cliente.toLowerCase().includes(buscar.toLowerCase()))
          return (
            <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
              <div className="lg:sticky lg:top-8 lg:col-span-4">
              <div className="rounded-3xl bg-gradient-to-br from-alerta-500 to-alerta-600 p-5 text-white lg:p-7">
                <p className="text-sm font-bold text-white/90">Te deben en total</p>
                <p className="mt-1 text-[36px] font-extrabold leading-none tabular-nums">{pesos(d.saldo)}</p>
                <p className="mt-2 text-sm text-white/85">{d.num_clientes} cliente{d.num_clientes === 1 ? '' : 's'} con saldo pendiente</p>
              </div>
              {d.clientes.length > 6 && (
                <div className="relative mt-3 lg:mt-4">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className="campo pl-10" placeholder="Buscar cliente" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                </div>
              )}
              </div>
              <div className="lg:col-span-8">
              <Titulo>De mayor a menor</Titulo>
              <Tarjeta className="divide-y divide-slate-100">
                {lista.length === 0 && <Vacio icono={HandCoins} titulo="Nadie te debe" texto="Cuando fíes en la tienda, aquí ves los saldos." />}
                {lista.map((c) => (
                  <Fila key={c.cliente_id} to={`/fiados/${c.cliente_id}`}
                    izquierda={<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-alerta-50 text-sm font-extrabold text-alerta-700">{iniciales(c.cliente)}</span>}
                    titulo={c.cliente} subtitulo={`${c.creditos} fiado${c.creditos > 1 ? 's' : ''} pendiente${c.creditos > 1 ? 's' : ''}`}
                    derecha={pesos(c.saldo)} derechaSub={c.vencido && <Insignia tono="peligro">Vencido</Insignia>} />
                ))}
              </Tarjeta>
              </div>
            </div>
          )
        }}
      </Estado>
    </>
  )
}

export function FiadoCliente() {
  const { tienda } = useSesion()
  const { id } = useParams()
  const q = useDatos(tienda && `/t/${tienda.id}/fiados/${encodeURIComponent(id)}/`)
  return (
    <Estado q={q}>
      {(d) => <DetalleCliente d={d} tienda={tienda} />}
    </Estado>
  )
}

function DetalleCliente({ d, tienda }) {
  const pendientes = useMemo(() => d.creditos.filter((c) => c.estado === 'PENDIENTE'), [d])
  const mensaje = `Hola ${d.cliente.split(' ')[0]}, te escribimos de ${tienda.nombre}. Tienes un saldo pendiente de ${pesos(d.saldo)}. ¡Gracias!`
  return (
    <>
      <Encabezado volver="/fiados" titulo={d.cliente} subtitulo={d.telefono || 'Sin teléfono'} />
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div>
      <Tarjeta className="p-5 text-center">
        <p className="text-sm font-semibold text-tinta-4">Debe</p>
        <p className="text-[34px] font-extrabold tabular-nums">{pesos(d.saldo)}</p>
        {d.telefono && d.saldo > 0 && (
          <a href={`https://wa.me/${telWa(d.telefono)}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noreferrer">
            <Boton variante="exito" className="mt-3 w-full" icono={MessageCircle}>Recordarle por WhatsApp</Boton>
          </a>
        )}
      </Tarjeta>
      {pendientes.length > 0 && (
        <>
          <Titulo>Fiados pendientes</Titulo>
          <Tarjeta className="divide-y divide-slate-100">
            {pendientes.map((c) => (
              <Fila key={c.id} titulo={`Fiado #${c.numero}`} subtitulo={`${fechaCorta(c.fecha)}${c.vence ? ` · vence ${fechaCorta(`${c.vence}T12:00:00`)}` : ''}`}
                derecha={pesos(c.saldo)} derechaSub={`de ${pesos(c.total)}`} />
            ))}
          </Tarjeta>
        </>
      )}
      </div>
      <div>
      {d.abonos.length > 0 && (
        <>
          <Titulo>Abonos</Titulo>
          <Tarjeta className="divide-y divide-slate-100">
            {d.abonos.map((a) => (
              <Fila key={a.id} titulo={pesos(a.monto)} subtitulo={`${fechaHora(a.fecha)} · ${a.forma_pago}`}
                derecha={<span className="text-sm font-semibold text-tinta-3">quedó en {pesos(a.saldo_nuevo)}</span>} />
            ))}
          </Tarjeta>
        </>
      )}
      </div>
      </div>
    </>
  )
}
