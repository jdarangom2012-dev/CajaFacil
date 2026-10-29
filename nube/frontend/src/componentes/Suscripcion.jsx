import { CalendarClock, MessageCircle } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { fecha } from '../lib/formato'
import { Boton, Tarjeta } from './ui'

const whatsapp = (num, tienda) =>
  `https://wa.me/${num}?text=${encodeURIComponent(`Hola, quiero renovar CajaFácil Nube de ${tienda}`)}`

/** Aviso cuando la suscripción está por vencer o en días de gracia. */
export function AvisoSuscripcion() {
  const { tienda, sesion } = useSesion()
  const s = tienda?.suscripcion
  if (!s || !s.vigente || sesion?.es_nautilus) return null
  if (!s.en_gracia && (s.dias_restantes == null || s.dias_restantes > 7)) return null
  return (
    <a href={whatsapp(sesion?.soporte_whatsapp, tienda.nombre)} target="_blank" rel="noreferrer"
      className="mb-4 flex items-center gap-3 rounded-2xl bg-alerta-50 p-4 text-alerta-700">
      <CalendarClock className="h-5 w-5 shrink-0" />
      <p className="text-sm">
        {s.en_gracia
          ? <><b>Tu nube venció el {fecha(s.pagado_hasta)}.</b> Renueva para no perder la conexión.</>
          : <><b>Tu nube vence {s.dias_restantes === 0 ? 'hoy' : `en ${s.dias_restantes} días`}.</b> Toca aquí para renovar.</>}
      </p>
    </a>
  )
}

/** Pantalla cuando la suscripción está vencida (la API responde 402). */
export function SuscripcionVencida() {
  const { tienda, sesion } = useSesion()
  return (
    <Tarjeta className="p-6 text-center">
      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-alerta-50 text-alerta-600"><CalendarClock className="h-7 w-7" /></span>
      <h1 className="text-lg font-extrabold">Tu suscripción a la nube venció</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-tinta-3">
        La caja de tu tienda <b>sigue funcionando normal</b> y no se pierde nada: cuando renueves, todo lo que
        vendiste aparece aquí otra vez.
      </p>
      <p className="mt-4 text-2xl font-extrabold">$25.000 <span className="text-base font-semibold text-tinta-4">al mes</span></p>
      <p className="text-sm text-tinta-4">o $300.000 al año</p>
      <a href={whatsapp(sesion?.soporte_whatsapp, tienda?.nombre)} target="_blank" rel="noreferrer">
        <Boton variante="exito" className="mt-5 h-12 w-full max-w-xs" icono={MessageCircle}>Renovar por WhatsApp</Boton>
      </a>
    </Tarjeta>
  )
}
