import { useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Calculator, History, Lock, Printer, Wallet } from 'lucide-react'
import { api, mensajeError } from '../api/cliente'
import AbrirCaja from '../components/AbrirCaja'
import {
  AreaTexto, Boton, Cargando, Campo, EncabezadoPagina, Entrada, EntradaDinero, Indicador, Insignia, Modal, Panel,
  Pestanas, Tarjeta, Vacio, cx,
} from '../components/ui'
import { useAviso } from '../context/Aviso'
import { useSesion } from '../context/Sesion'
import { useApi } from '../hooks/datos'
import { fechaHora, hora, numero, pesos } from '../lib/formato'

const DENOMINACIONES = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50]

function ResumenFormas({ resumen }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabla w-full">
        <thead><tr><th>Forma de pago</th><th className="text-right">Ventas</th><th className="text-right">Abonos fiado</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {resumen.por_forma_pago.length === 0 && <tr><td colSpan={4} className="text-center text-tinta-4">Sin movimientos todavía</td></tr>}
          {resumen.por_forma_pago.map((f) => (
            <tr key={f.forma_pago_id}>
              <td><span className="inline-flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />{f.nombre}</span></td>
              <td className="text-right tabular-nums">{pesos(f.ventas)}</td>
              <td className="text-right tabular-nums">{pesos(f.abonos)}</td>
              <td className="text-right font-bold tabular-nums">{pesos(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CuadreEfectivo({ resumen }) {
  const filas = [
    ['Base inicial', resumen.base, ''],
    ['+ Ventas y abonos en efectivo', resumen.por_forma_pago.filter((f) => f.tipo === 'EFECTIVO').reduce((s, f) => s + f.total, 0), ''],
    ['+ Ingresos de efectivo', resumen.ingresos_efectivo, ''],
    ['− Salidas de efectivo', resumen.egresos_efectivo, 'neg'],
  ]
  return (
    <div className="space-y-1.5 text-sm">
      {filas.map(([t, v, s]) => (
        <div key={t} className="flex justify-between"><span className="text-tinta-4">{t}</span><span className={cx('tabular-nums font-semibold', s && 'text-peligro-600')}>{pesos(v)}</span></div>
      ))}
      <div className="mt-2 flex justify-between border-t border-dashed border-slate-300 pt-2 text-base">
        <b>Debe haber en el cajón</b><b className="tabular-nums">{pesos(resumen.efectivo_esperado)}</b>
      </div>
    </div>
  )
}

function ModalMovimiento({ tipo, onCerrar, onListo }) {
  const aviso = useAviso()
  const [monto, setMonto] = useState(0)
  const [concepto, setConcepto] = useState('')
  const [cargando, setCargando] = useState(false)
  const guardar = async () => {
    setCargando(true)
    try {
      await api.post('/ventas/caja/movimientos/', { tipo, monto, concepto })
      aviso.exito(tipo === 'EGRESO' ? 'Salida registrada' : 'Ingreso registrado')
      onListo()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  const sugeridos = tipo === 'EGRESO' ? ['Pago a proveedor', 'Gastos de la tienda', 'Retiro del dueño', 'Domicilio'] : ['Aporte del dueño', 'Cambio (sencillo)', 'Otro ingreso']
  return (
    <Modal abierto onCerrar={onCerrar} ancho="sm" titulo={tipo === 'EGRESO' ? 'Sacar efectivo de la caja' : 'Meter efectivo a la caja'}
      descripcion="Queda registrado para el cuadre y la auditoría."
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={cargando} variante={tipo === 'EGRESO' ? 'peligro' : 'primario'}>Registrar</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Valor"><EntradaDinero grande autoFocus valor={monto} onCambio={setMonto} /></Campo>
        <Campo etiqueta="Concepto"><Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="¿Para qué?" /></Campo>
        <div className="flex flex-wrap gap-2">
          {sugeridos.map((s) => <button key={s} onClick={() => setConcepto(s)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200">{s}</button>)}
        </div>
      </div>
    </Modal>
  )
}

function ModalCierre({ caja, onCerrar, onCerrada }) {
  const aviso = useAviso()
  const [modo, setModo] = useState('billetes')
  const [conteo, setConteo] = useState({})
  const [directo, setDirecto] = useState(0)
  const [notas, setNotas] = useState('')
  const [cargando, setCargando] = useState(false)
  const totalConteo = DENOMINACIONES.reduce((s, d) => s + d * (Number(conteo[d]) || 0), 0)
  const contado = modo === 'billetes' ? totalConteo : directo
  const dif = contado - caja.resumen.efectivo_esperado

  const cerrar = async () => {
    setCargando(true)
    try {
      const { data } = await api.post('/ventas/caja/cerrar/', { efectivo_contado: contado, notas })
      onCerrada(data)
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Cerrar caja #${caja.numero}`} descripcion="Cuenta el efectivo que hay en el cajón." ancho="lg"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton variante="oscuro" icono={Lock} onClick={cerrar} cargando={cargando}>Cerrar caja</Boton></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Pestanas className="mb-3" valor={modo} onCambio={setModo} opciones={[{ valor: 'billetes', etiqueta: 'Contar billetes', icono: Calculator }, { valor: 'directo', etiqueta: 'Total directo' }]} />
          {modo === 'billetes' ? (
            <div className="grid grid-cols-2 gap-2">
              {DENOMINACIONES.map((d) => (
                <label key={d} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5">
                  <span className="w-16 text-xs font-bold text-tinta-3">{pesos(d)}</span>
                  <span className="text-xs text-tinta-4">×</span>
                  <input inputMode="numeric" className="h-8 w-full rounded-lg border border-slate-200 px-2 text-right text-sm font-bold outline-none focus:border-marca-500"
                    value={conteo[d] || ''} onChange={(e) => setConteo({ ...conteo, [d]: e.target.value.replace(/\D/g, '') })} />
                </label>
              ))}
            </div>
          ) : (
            <Campo etiqueta="Efectivo contado"><EntradaDinero grande autoFocus valor={directo} onCambio={setDirecto} /></Campo>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4"><CuadreEfectivo resumen={caja.resumen} /></div>
          <div className={cx('rounded-2xl p-4 text-center', dif === 0 ? 'bg-exito-50 text-exito-700' : dif > 0 ? 'bg-marca-50 text-marca-800' : 'bg-peligro-50 text-peligro-700')}>
            <p className="text-sm font-semibold">Contado: {pesos(contado)}</p>
            <p className="text-2xl font-extrabold">{dif === 0 ? '¡Caja cuadrada!' : `${dif > 0 ? 'Sobran' : 'Faltan'} ${pesos(Math.abs(dif))}`}</p>
          </div>
          <Campo etiqueta="Notas (opcional)"><AreaTexto value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: se pagó el gas con plata de la caja" /></Campo>
        </div>
      </div>
    </Modal>
  )
}

function DetalleCaja({ caja, onCerrar }) {
  const aviso = useAviso()
  const [imprimiendo, setImprimiendo] = useState(false)
  if (!caja) return null
  const r = caja.resumen || {}
  const imprimir = async () => {
    setImprimiendo(true)
    try {
      const { data } = await api.post(`/sistema/hardware/imprimir-cierre/${caja.id}/`)
      if (data.ok) aviso.exito('Cierre impreso')
      else aviso.error(data.error || 'Configura una impresora directa para imprimir el cierre.')
    } catch (e) { aviso.error(mensajeError(e)) } finally { setImprimiendo(false) }
  }
  return (
    <Panel abierto onCerrar={onCerrar} titulo={`Caja #${caja.numero}`} subtitulo={`${caja.terminal} · ${fechaHora(caja.abierta_en)}`}
      pie={<Boton variante="secundario" icono={Printer} onClick={imprimir} cargando={imprimiendo}>Imprimir cierre</Boton>}>
      <div className="grid grid-cols-2 gap-3">
        <Indicador titulo="Total vendido" valor={pesos(r.total_ventas)} detalle={`${r.num_ventas || 0} ventas`} />
        <Indicador titulo="Diferencia" valor={pesos(caja.diferencia)} tono={Number(caja.diferencia) === 0 ? 'exito' : 'peligro'}
          detalle={Number(caja.diferencia) === 0 ? 'Cuadrada' : Number(caja.diferencia) > 0 ? 'Sobrante' : 'Faltante'} />
      </div>
      <div className="mt-4 text-sm text-tinta-3">
        <p>Abrió: <b>{caja.usuario_apertura_nombre}</b> · {fechaHora(caja.abierta_en)}</p>
        {caja.cerrada_en && <p>Cerró: <b>{caja.usuario_cierre_nombre}</b> · {fechaHora(caja.cerrada_en)}</p>}
      </div>
      {r.por_forma_pago && <Tarjeta className="mt-4 overflow-hidden"><ResumenFormas resumen={r} /></Tarjeta>}
      {r.por_forma_pago && <div className="mt-4 rounded-2xl bg-slate-50 p-4"><CuadreEfectivo resumen={r} />
        <div className="mt-2 flex justify-between text-base"><b>Contado</b><b className="tabular-nums">{pesos(caja.efectivo_contado)}</b></div></div>}
      {caja.movimientos?.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 font-bold">Entradas y salidas de efectivo</h4>
          {caja.movimientos.map((m) => (
            <div key={m.id} className="flex justify-between border-b border-slate-100 py-2 text-sm">
              <span>{m.concepto} <span className="text-xs text-tinta-4">· {m.usuario_nombre} {hora(m.creado)}</span></span>
              <b className={m.tipo === 'EGRESO' ? 'text-peligro-600' : 'text-exito-700'}>{m.tipo === 'EGRESO' ? '−' : '+'}{pesos(m.monto)}</b>
            </div>
          ))}
        </div>
      )}
      {caja.notas && <p className="mt-4 rounded-xl bg-alerta-50 p-3 text-sm">{caja.notas}</p>}
    </Panel>
  )
}

function Historial() {
  const { datos, cargando } = useApi('/ventas/cajas/', { estado: 'CERRADA', page_size: 60 })
  const [sel, setSel] = useState(null)
  const abrir = async (id) => { const { data } = await api.get(`/ventas/cajas/${id}/`); setSel(data) }
  if (cargando && !datos) return <Cargando />
  const lista = datos?.results || []
  return (
    <Tarjeta className="overflow-hidden">
      {lista.length === 0 ? <Vacio icono={History} titulo="Aún no hay cierres" /> : (
        <div className="overflow-x-auto">
          <table className="tabla w-full">
            <thead><tr><th>Caja</th><th>Apertura</th><th className="hidden md:table-cell">Cierre</th><th className="text-right">Vendido</th><th className="text-right">Diferencia</th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} onClick={() => abrir(c.id)} className="cursor-pointer">
                  <td><b>#{c.numero}</b> <span className="text-xs text-tinta-4">{c.terminal}</span></td>
                  <td>{fechaHora(c.abierta_en)}<div className="text-xs text-tinta-4">{c.usuario_apertura_nombre}</div></td>
                  <td className="hidden md:table-cell">{fechaHora(c.cerrada_en)}<div className="text-xs text-tinta-4">{c.usuario_cierre_nombre}</div></td>
                  <td className="text-right font-semibold tabular-nums">{pesos(c.resumen?.total_ventas)}</td>
                  <td className="text-right">
                    <Insignia tono={Number(c.diferencia) === 0 ? 'exito' : Number(c.diferencia) > 0 ? 'marca' : 'peligro'}>
                      {Number(c.diferencia) === 0 ? 'Cuadrada' : pesos(c.diferencia)}
                    </Insignia>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DetalleCaja caja={sel} onCerrar={() => setSel(null)} />
    </Tarjeta>
  )
}

export default function Caja() {
  const { caja, cargarCaja, esGestion } = useSesion()
  const aviso = useAviso()
  const [tab, setTab] = useState('actual')
  const [mov, setMov] = useState(null)
  const [cerrando, setCerrando] = useState(false)
  const [cerrada, setCerrada] = useState(null)

  return (
    <div>
      <EncabezadoPagina icono={Wallet} titulo="Caja" descripcion="Apertura, entradas y salidas de efectivo y cierre del turno."
        acciones={esGestion && <Pestanas valor={tab} onCambio={setTab} opciones={[{ valor: 'actual', etiqueta: 'Turno actual' }, { valor: 'historial', etiqueta: 'Historial de cierres' }]} />} />
      {tab === 'historial' ? <Historial /> : !caja ? <Cargando /> : !caja.abierta ? <AbrirCaja /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador titulo="Vendido en el turno" valor={pesos(caja.resumen.total_ventas)} detalle={`${caja.resumen.num_ventas} ventas`} />
            <Indicador titulo="Efectivo en cajón" valor={pesos(caja.resumen.efectivo_esperado)} tono="exito" detalle="según el sistema" />
            <Indicador titulo="Base" valor={pesos(caja.base)} tono="gris" detalle={`Abrió ${caja.usuario_apertura_nombre} · ${hora(caja.abierta_en)}`} />
            <Indicador titulo="Anuladas" valor={numero(caja.resumen.num_anuladas)} tono="peligro" detalle={pesos(caja.resumen.total_anulado)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta className="overflow-hidden lg:col-span-2">
              <h3 className="px-5 pt-5 pb-3 font-extrabold">Por forma de pago</h3>
              <ResumenFormas resumen={caja.resumen} />
            </Tarjeta>
            <Tarjeta className="p-5">
              <h3 className="mb-3 font-extrabold">Cuadre de efectivo</h3>
              <CuadreEfectivo resumen={caja.resumen} />
              <Boton variante="oscuro" tamano="lg" icono={Lock} className="mt-5 w-full" onClick={() => setCerrando(true)}>Cerrar caja</Boton>
            </Tarjeta>
          </div>
          <Tarjeta className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold">Entradas y salidas de efectivo</h3>
              <div className="flex gap-2">
                <Boton variante="peligro-suave" tamano="sm" icono={ArrowUpCircle} onClick={() => setMov('EGRESO')}>Sacar dinero</Boton>
                <Boton variante="suave" tamano="sm" icono={ArrowDownCircle} onClick={() => setMov('INGRESO')}>Meter dinero</Boton>
              </div>
            </div>
            {caja.movimientos.length === 0 ? <p className="py-6 text-center text-sm text-tinta-4">Registra aquí pagos a proveedores, gastos o retiros para que la caja cuadre.</p> : (
              caja.movimientos.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
                  <div className="flex items-center gap-3">
                    {m.tipo === 'EGRESO' ? <ArrowUpCircle className="h-5 w-5 text-peligro-500" /> : <ArrowDownCircle className="h-5 w-5 text-exito-500" />}
                    <div><p className="text-sm font-semibold">{m.concepto}</p><p className="text-xs text-tinta-4">{m.usuario_nombre} · {hora(m.creado)}</p></div>
                  </div>
                  <b className={cx('tabular-nums', m.tipo === 'EGRESO' ? 'text-peligro-600' : 'text-exito-700')}>{m.tipo === 'EGRESO' ? '−' : '+'}{pesos(m.monto)}</b>
                </div>
              ))
            )}
          </Tarjeta>
        </div>
      )}
      {mov && <ModalMovimiento tipo={mov} onCerrar={() => setMov(null)} onListo={() => { setMov(null); cargarCaja() }} />}
      {cerrando && caja?.abierta && <ModalCierre caja={caja} onCerrar={() => setCerrando(false)}
        onCerrada={(c) => { setCerrando(false); setCerrada(c); cargarCaja(); aviso.exito(`Caja #${c.numero} cerrada. Se creó un respaldo.`) }} />}
      {cerrada && <DetalleCaja caja={cerrada} onCerrar={() => setCerrada(null)} />}
    </div>
  )
}
