import { useEffect } from 'react'
import { BellOff, ShieldAlert } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { useDatos } from '../lib/datos'
import { api } from '../lib/api'
import { fechaHora } from '../lib/formato'
import { Encabezado, Estado } from '../componentes/Pagina'
import { Tarjeta, Vacio, cx } from '../componentes/ui'

const NOMBRES = {
  CANCEL: 'Venta anulada', DESCUADRE: 'Descuadre de caja', PRECIO: 'Cambio de precio', AJUSTE: 'Ajuste de inventario',
  CAJON: 'Abrieron el cajón sin venta', LOGIN_FALLIDO: 'Intento de entrada fallido', DESCUENTO: 'Descuento grande',
}

export default function Alertas() {
  const { tienda } = useSesion()
  const q = useDatos(tienda && `/t/${tienda.id}/alertas/`)
  useEffect(() => {
    if (!q.datos?.some((a) => !a.vista)) return
    const t = setTimeout(() => api.post(`/t/${tienda.id}/alertas/`).catch(() => {}), 1500)
    return () => clearTimeout(t)
  }, [q.datos, tienda])
  return (
    <>
      <Encabezado titulo="Alertas" volver="/mas" subtitulo="Cosas que pasaron en la tienda y conviene revisar" />
      <Estado q={q}>
        {(lista) => (
          <Tarjeta className="divide-y divide-slate-100 lg:max-w-4xl">
            {lista.length === 0 && <Vacio icono={BellOff} titulo="Sin alertas" texto="Aquí te avisamos si anulan ventas, hay descuadres en la caja o cambian precios." />}
            {lista.map((a) => (
              <div key={a.id} className={cx('flex gap-3 px-4 py-3', !a.vista && 'bg-peligro-50/50')}>
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-peligro-50 text-peligro-600"><ShieldAlert className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{NOMBRES[a.accion] || a.accion}</p>
                  <p className="text-sm text-tinta-2">{a.detalle}</p>
                  <p className="mt-0.5 text-xs text-tinta-4">{fechaHora(a.fecha)} · {a.usuario}{a.terminal && ` · ${a.terminal}`}</p>
                </div>
              </div>
            ))}
          </Tarjeta>
        )}
      </Estado>
    </>
  )
}
