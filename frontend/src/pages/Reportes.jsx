import { useState } from 'react'
import { BarChart3, Bot, Download, Lock, Receipt, Send, Sparkles, TrendingUp, Users } from 'lucide-react'
import { api, descargarArchivo, mensajeError } from '../api/cliente'
import { Barras, Dona } from '../components/Graficas'
import { Boton, Cargando, EncabezadoPagina, Entrada, Indicador, Pestanas, Tarjeta, Vacio, cx } from '../components/ui'
import { useAviso } from '../context/Aviso'
import { useSesion } from '../context/Sesion'
import { useApi } from '../hooks/datos'
import { fechaCorta, haceDiasISO, hoyISO, numero, pesos } from '../lib/formato'

const inicioMes = () => `${hoyISO().slice(0, 8)}01`
const PRESETS = [
  { valor: 'hoy', etiqueta: 'Hoy', rango: () => [hoyISO(), hoyISO()] },
  { valor: '7', etiqueta: '7 días', rango: () => [haceDiasISO(6), hoyISO()] },
  { valor: '30', etiqueta: '30 días', rango: () => [haceDiasISO(29), hoyISO()] },
  { valor: 'mes', etiqueta: 'Este mes', rango: () => [inicioMes(), hoyISO()] },
]

function Resumen() {
  const aviso = useAviso()
  const [preset, setPreset] = useState('7')
  const [rango, setRango] = useState(PRESETS[1].rango())
  const { datos: d, cargando } = useApi('/reportes/periodo/', { fecha_desde: rango[0], fecha_hasta: rango[1] })
  const elegir = (v) => { setPreset(v); const p = PRESETS.find((x) => x.valor === v); if (p) setRango(p.rango()) }
  const exportar = async (tipo) => {
    try { await descargarArchivo('/reportes/exportar/', { fecha_desde: rango[0], fecha_hasta: rango[1], tipo }, `${tipo}_${rango[0]}_${rango[1]}.xlsx`) }
    catch (e) { aviso.error(mensajeError(e)) }
  }
  const maxCat = Math.max(...(d?.por_categoria || []).map((c) => c.total), 1)

  return (
    <div className="space-y-4">
      <Tarjeta className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <Pestanas valor={preset} onCambio={elegir} opciones={PRESETS.map(({ valor, etiqueta }) => ({ valor, etiqueta }))} />
        <div className="flex items-center gap-2">
          <Entrada type="date" className="h-10" value={rango[0]} onChange={(e) => { setPreset(''); setRango([e.target.value, rango[1]]) }} />
          <span className="text-tinta-4">a</span>
          <Entrada type="date" className="h-10" value={rango[1]} onChange={(e) => { setPreset(''); setRango([rango[0], e.target.value]) }} />
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <Boton variante="secundario" tamano="sm" icono={Download} onClick={() => exportar('ventas')}>Ventas</Boton>
          <Boton variante="secundario" tamano="sm" icono={Download} onClick={() => exportar('detalle')}>Detalle</Boton>
        </div>
      </Tarjeta>
      {cargando && !d ? <Cargando /> : d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador titulo="Total vendido" valor={pesos(d.totales.total_ventas)} icono={TrendingUp} detalle={`${numero(d.totales.num_ventas)} ventas`} />
            <Indicador titulo="Utilidad estimada" valor={pesos(d.totales.utilidad)} icono={Sparkles} tono="exito"
              detalle={d.totales.total_ventas ? `${Math.round((d.totales.utilidad / d.totales.total_ventas) * 100)}% de margen` : ''} />
            <Indicador titulo="Ticket promedio" valor={pesos(d.totales.ticket_promedio)} icono={Receipt} tono="gris" detalle={`Descuentos ${pesos(d.totales.descuentos)}`} />
            <Indicador titulo="Anuladas" valor={numero(d.anuladas.cantidad)} icono={Receipt} tono="peligro" detalle={pesos(d.anuladas.total)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta className="p-5 lg:col-span-2">
              <h3 className="mb-3 font-extrabold">Ventas por día</h3>
              {d.por_dia.length ? <Barras datos={d.por_dia} x="fecha" y="total" alto={240} formatoX={(f) => fechaCorta(`${f}T12:00`)} /> : <Vacio titulo="Sin ventas en el periodo" />}
            </Tarjeta>
            <Tarjeta className="p-5">
              <h3 className="mb-4 font-extrabold">Formas de pago</h3>
              {d.por_forma_pago.length ? <Dona datos={d.por_forma_pago} alto={150} /> : <Vacio titulo="Sin datos" />}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-sm">
                <div><p className="text-xs text-tinta-4">Fiado otorgado</p><b>{pesos(d.fiado.otorgado)}</b></div>
                <div><p className="text-xs text-tinta-4">Abonos recibidos</p><b>{pesos(d.fiado.abonado)}</b></div>
              </div>
            </Tarjeta>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta className="p-5">
              <h3 className="mb-4 font-extrabold">Por categoría</h3>
              {d.por_categoria.length === 0 ? <Vacio titulo="Sin datos" /> : (
                <div className="space-y-3">
                  {d.por_categoria.map((c) => (
                    <div key={c.categoria}>
                      <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{c.categoria}</span><span><b className="tabular-nums">{pesos(c.total)}</b> <span className="text-xs text-tinta-4">{c.porcentaje}%</span></span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(c.total / maxCat) * 100}%`, background: c.color }} /></div>
                      <p className="mt-0.5 text-[11px] text-exito-700">Utilidad {pesos(c.utilidad)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>
            <Tarjeta className="overflow-hidden">
              <h3 className="px-5 pt-5 pb-3 font-extrabold">Productos más vendidos</h3>
              <table className="tabla w-full">
                <thead><tr><th>Producto</th><th className="text-right">Cant.</th><th className="text-right">Vendido</th><th className="hidden sm:table-cell text-right">Utilidad</th></tr></thead>
                <tbody>
                  {d.top_productos.map((p) => (
                    <tr key={p.producto_id}><td className="font-semibold">{p.nombre}</td><td className="text-right tabular-nums">{numero(p.cantidad)}</td>
                      <td className="text-right font-bold tabular-nums">{pesos(p.total)}</td><td className="hidden sm:table-cell text-right text-exito-700 tabular-nums">{pesos(p.utilidad)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          </div>
          <Tarjeta className="p-5">
            <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-marca-600" /><h3 className="font-extrabold">Ventas por cajero</h3></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {d.por_cajero.map((c) => (
                <div key={c.usuario} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-semibold">{c.usuario}</p><p className="text-xl font-extrabold tabular-nums">{pesos(c.total)}</p><p className="text-xs text-tinta-4">{c.cantidad} ventas</p></div>
              ))}
            </div>
          </Tarjeta>
        </>
      )}
    </div>
  )
}

function Asistente() {
  const { licencia } = useSesion()
  const [mensajes, setMensajes] = useState([{ de: 'ia', texto: 'Hola 👋 Soy el asistente de tu tienda. Pregúntame cosas como “¿qué fue lo que más vendí este mes?” o “¿qué categoría me deja más ganancia?”.' }])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const activo = licencia?.nube_activa
  const enviar = async () => {
    const t = texto.trim()
    if (!t) return
    setMensajes((m) => [...m, { de: 'yo', texto: t }])
    setTexto('')
    setCargando(true)
    try {
      const { data } = await api.post('/reportes/asistente/', { mensaje: t })
      setMensajes((m) => [...m, { de: 'ia', texto: data.respuesta }])
    } catch (e) {
      setMensajes((m) => [...m, { de: 'ia', texto: mensajeError(e), error: true }])
    } finally { setCargando(false) }
  }
  if (!activo) {
    return (
      <Tarjeta className="mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-marca-500 to-[#7A5AF8] text-white"><Bot className="h-8 w-8" /></span>
        <h3 className="text-xl font-extrabold">Pregúntale a tu tienda</h3>
        <p className="mt-2 text-sm text-tinta-3">El asistente con inteligencia artificial analiza tus ventas y te responde en palabras sencillas. Está incluido en el <b>plan Nube</b>, junto con el respaldo en la nube y la app del dueño en el celular.</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-tinta-3"><Lock className="h-4 w-4" /> Actívalo desde Configuración → Licencia</p>
      </Tarjeta>
    )
  }
  return (
    <Tarjeta className="mx-auto flex h-[65vh] max-w-3xl flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto scroll-fino p-5">
        {mensajes.map((m, i) => (
          <div key={i} className={cx('flex', m.de === 'yo' ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm', m.de === 'yo' ? 'bg-marca-600 text-white' : m.error ? 'bg-peligro-50 text-peligro-700' : 'bg-slate-100')}>{m.texto}</div>
          </div>
        ))}
        {cargando && <div className="text-sm text-tinta-4">Pensando…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); enviar() }} className="flex gap-2 border-t border-slate-100 p-3">
        <Entrada className="flex-1" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu pregunta…" />
        <Boton type="submit" icono={Send} cargando={cargando}>Enviar</Boton>
      </form>
    </Tarjeta>
  )
}

export default function Reportes() {
  const [tab, setTab] = useState('resumen')
  return (
    <div>
      <EncabezadoPagina icono={BarChart3} titulo="Reportes" descripcion="Cuánto vendes, cuánto ganas y qué se mueve más."
        acciones={<Pestanas valor={tab} onCambio={setTab} opciones={[{ valor: 'resumen', etiqueta: 'Resumen', icono: BarChart3 }, { valor: 'ia', etiqueta: 'Asistente IA', icono: Bot }]} />} />
      {tab === 'resumen' ? <Resumen /> : <Asistente />}
    </div>
  )
}
