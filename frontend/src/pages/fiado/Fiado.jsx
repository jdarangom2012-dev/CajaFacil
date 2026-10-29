import { useState } from 'react'
import { AlertTriangle, BookOpen, CalendarClock, HandCoins, MessageCircle, Pencil, Plus, UserPlus, Users, Wallet } from 'lucide-react'
import { api, mensajeError } from '../../api/cliente'
import {
  Boton, Buscador, Campo, Cargando, EncabezadoPagina, Entrada, EntradaDinero, Indicador, Insignia, Interruptor, Modal,
  Panel, Pestanas, Tarjeta, Vacio, cx, useDebounce,
} from '../../components/ui'
import { useAviso } from '../../context/Aviso'
import { useSesion } from '../../context/Sesion'
import { useApi, useConfiguracion, useFormasPago } from '../../hooks/datos'
import { fecha, fechaHora, iniciales, numero, pesos } from '../../lib/formato'

function ModalCliente({ cliente, onCerrar, onGuardado }) {
  const aviso = useAviso()
  const [f, setF] = useState({ nombre: '', telefono: '', documento: '', direccion: '', cupo: null, notas: '', ...cliente })
  const [cupoPropio, setCupoPropio] = useState(cliente?.cupo != null)
  const [cargando, setCargando] = useState(false)
  const guardar = async () => {
    setCargando(true)
    try {
      const datos = { ...f, cupo: cupoPropio ? f.cupo || 0 : null }
      const { data } = f.id ? await api.patch(`/fiado/clientes/${f.id}/`, datos) : await api.post('/fiado/clientes/', datos)
      aviso.exito('Cliente guardado')
      onGuardado(data)
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <Modal abierto onCerrar={onCerrar} titulo={f.id ? 'Editar cliente' : 'Nuevo cliente'} ancho="md"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={cargando}>Guardar</Boton></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo *" className="sm:col-span-2"><Entrada autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
        <Campo etiqueta="Celular / WhatsApp"><Entrada inputMode="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></Campo>
        <Campo etiqueta="Cédula"><Entrada value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></Campo>
        <Campo etiqueta="Dirección" className="sm:col-span-2"><Entrada value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></Campo>
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4 sm:col-span-2">
          <Interruptor activo={cupoPropio} onCambio={setCupoPropio} etiqueta="Cupo de fiado propio" descripcion="Si está apagado, usa el tope general de Configuración." />
          {cupoPropio && <EntradaDinero valor={f.cupo} onCambio={(v) => setF({ ...f, cupo: v })} />}
        </div>
        <Campo etiqueta="Notas" className="sm:col-span-2"><Entrada value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Ej: paga los viernes" /></Campo>
      </div>
    </Modal>
  )
}

function ModalAbono({ cliente, saldo, onCerrar, onListo }) {
  const aviso = useAviso()
  const formas = useFormasPago().filter((f) => f.tipo !== 'CREDITO')
  const conf = useConfiguracion()
  const [monto, setMonto] = useState(saldo)
  const [forma, setForma] = useState(null)
  const [nota, setNota] = useState('')
  const [imprimir, setImprimir] = useState(false)
  const [cargando, setCargando] = useState(false)
  const fp = forma || formas[0]
  const guardar = async () => {
    setCargando(true)
    try {
      const { data } = await api.post(`/fiado/clientes/${cliente.id}/abonar/`, { monto, forma_pago_id: fp.id, nota, imprimir })
      aviso.exito(Number(data.saldo_nuevo) === 0 ? `¡${cliente.nombre} quedó a paz y salvo!` : `Abono registrado. Saldo: ${pesos(data.saldo_nuevo)}`)
      if (data.impresion?.error) aviso.error(data.impresion.error)
      onListo()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Abono de ${cliente.nombre}`} descripcion={`Debe ${pesos(saldo)}. El abono paga primero los fiados más antiguos.`} ancho="sm"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton variante="exito" onClick={guardar} cargando={cargando} disabled={!monto || !fp}>Registrar abono</Boton></>}>
      <div className="space-y-4">
        <EntradaDinero grande autoFocus valor={monto} onCambio={setMonto} />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMonto(saldo)} className="rounded-xl bg-exito-50 px-3 py-1.5 text-sm font-bold text-exito-700">Todo ({pesos(saldo)})</button>
          {[5000, 10000, 20000, 50000].filter((v) => v < saldo).map((v) => <button key={v} onClick={() => setMonto(v)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-bold">{pesos(v)}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {formas.map((f) => (
            <button key={f.id} onClick={() => setForma(f)} className={cx('rounded-xl border-2 px-3 py-2.5 text-sm font-bold', fp?.id === f.id ? 'border-marca-600 bg-marca-50 text-marca-800' : 'border-slate-200')}>{f.nombre}</button>
          ))}
        </div>
        <Entrada placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
        {conf && !['NAVEGADOR', 'NINGUNA'].includes(conf.impresora_tipo) && <Interruptor activo={imprimir} onCambio={setImprimir} etiqueta="Imprimir comprobante" />}
      </div>
    </Modal>
  )
}

function ModalFiadoManual({ cliente, onCerrar, onListo }) {
  const aviso = useAviso()
  const [total, setTotal] = useState(0)
  const [notas, setNotas] = useState('Deuda del cuaderno')
  const [cargando, setCargando] = useState(false)
  const guardar = async () => {
    setCargando(true)
    try { await api.post('/fiado/', { cliente_id: cliente.id, total, notas }); aviso.exito('Fiado registrado'); onListo() }
    catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <Modal abierto onCerrar={onCerrar} titulo="Registrar deuda anterior" descripcion="Para pasar al sistema lo que estaba anotado en el cuaderno." ancho="sm"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={cargando}>Guardar</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Valor"><EntradaDinero grande autoFocus valor={total} onCambio={setTotal} /></Campo>
        <Campo etiqueta="Detalle"><Entrada value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}

function EstadoCuenta({ id, onCerrar, onCambio }) {
  const { esGestion } = useSesion()
  const { datos: d, recargar } = useApi(id ? `/fiado/clientes/${id}/estado-cuenta/` : null)
  const [abonar, setAbonar] = useState(false)
  const [editar, setEditar] = useState(false)
  const [manual, setManual] = useState(false)
  if (!id) return null
  const saldo = Number(d?.saldo || 0)
  const listo = () => { setAbonar(false); setEditar(false); setManual(false); recargar(); onCambio() }
  return (
    <Panel abierto onCerrar={onCerrar} titulo={d?.cliente.nombre || 'Cliente'} subtitulo={d?.cliente.telefono} ancho="max-w-2xl"
      pie={d && <>
        {esGestion && <Boton variante="fantasma" icono={BookOpen} onClick={() => setManual(true)}>Deuda anterior</Boton>}
        <Boton variante="secundario" icono={Pencil} onClick={() => setEditar(true)}>Editar</Boton>
        {d.whatsapp.url && saldo > 0 && <a href={d.whatsapp.url} target="_blank" rel="noreferrer"><Boton variante="secundario" icono={MessageCircle} className="!text-[#128C7E]">Cobrar por WhatsApp</Boton></a>}
        <Boton variante="exito" icono={HandCoins} onClick={() => setAbonar(true)} disabled={saldo <= 0}>Abonar</Boton>
      </>}>
      {!d ? <Cargando /> : (
        <div className="space-y-4">
          <div className={cx('rounded-3xl p-5 text-white', saldo > 0 ? 'bg-gradient-to-br from-alerta-500 to-[#B54708]' : 'bg-gradient-to-br from-exito-500 to-[#027A48]')}>
            <p className="text-sm font-semibold opacity-90">{saldo > 0 ? 'Saldo pendiente' : 'A paz y salvo'}</p>
            <p className="text-4xl font-extrabold tabular-nums">{pesos(saldo)}</p>
            <p className="mt-1 text-sm opacity-90">{Number(d.cliente.cupo_efectivo) ? `Cupo ${pesos(d.cliente.cupo_efectivo)} · disponible ${pesos(Math.max(d.cliente.cupo_efectivo - saldo, 0))}` : 'Sin tope de fiado'}</p>
          </div>
          {d.cliente.notas && <p className="rounded-xl bg-slate-50 p-3 text-sm text-tinta-3">{d.cliente.notas}</p>}
          <h4 className="font-extrabold">Historial de fiados</h4>
          {d.creditos.length === 0 && <Vacio titulo="Sin fiados" />}
          {d.creditos.map((c) => (
            <Tarjeta key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">Fiado No. {c.numero}{c.venta_numero ? ` · venta #${c.venta_numero}` : ''}</p>
                  <p className="text-xs text-tinta-4">{fechaHora(c.creado)} · {c.usuario_nombre}{c.notas ? ` · ${c.notas}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold tabular-nums">{pesos(c.total)}</p>
                  {c.estado === 'PAGADO' ? <Insignia tono="exito">Pagado</Insignia> : c.estado === 'ANULADO' ? <Insignia>Anulado</Insignia>
                    : c.vencido ? <Insignia tono="peligro">Vencido {c.dias_mora}d</Insignia> : <Insignia tono="alerta">Debe {pesos(c.saldo)}</Insignia>}
                </div>
              </div>
              {c.productos.length > 0 && <p className="mt-2 text-xs text-tinta-3">{c.productos.map((p) => `${numero(p.cantidad)} ${p.nombre}`).join(' · ')}</p>}
              {c.vence && c.estado === 'PENDIENTE' && <p className="mt-1 flex items-center gap-1 text-xs text-tinta-4"><CalendarClock className="h-3.5 w-3.5" /> Vence {fecha(c.vence)}</p>}
              {c.abonos.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-dashed border-slate-200 pt-2">
                  {c.abonos.map((a) => (
                    <div key={a.id} className="flex justify-between text-xs"><span className="text-tinta-4">Abono {fechaHora(a.creado)} · {a.forma_pago_nombre}</span><b className="text-exito-700">−{pesos(a.monto)}</b></div>
                  ))}
                </div>
              )}
            </Tarjeta>
          ))}
        </div>
      )}
      {abonar && <ModalAbono cliente={d.cliente} saldo={saldo} onCerrar={() => setAbonar(false)} onListo={listo} />}
      {editar && <ModalCliente cliente={d.cliente} onCerrar={() => setEditar(false)} onGuardado={listo} />}
      {manual && <ModalFiadoManual cliente={d.cliente} onCerrar={() => setManual(false)} onListo={listo} />}
    </Panel>
  )
}

export default function Fiado() {
  const [filtro, setFiltro] = useState('deuda')
  const [q, setQ] = useState('')
  const qd = useDebounce(q)
  const [pagina, setPagina] = useState(1)
  const params = { q: qd, page: pagina, page_size: 50, orden: 'saldo', con_deuda: filtro === 'deuda' ? 1 : '', vencidos: filtro === 'vencidos' ? 1 : '' }
  const { datos, cargando, recargar } = useApi('/fiado/clientes/', params)
  const { datos: r, recargar: recargarR } = useApi('/fiado/resumen/')
  const [sel, setSel] = useState(null)
  const [nuevo, setNuevo] = useState(false)
  const lista = datos?.results || []
  const refrescar = () => { recargar(); recargarR() }

  return (
    <div>
      <EncabezadoPagina icono={HandCoins} titulo="Fiado" descripcion="El cuaderno del fiado, pero ordenado: cupos, abonos y cobro por WhatsApp."
        acciones={<Boton icono={UserPlus} onClick={() => setNuevo(true)}>Nuevo cliente</Boton>} />
      {r && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador titulo="Por cobrar" valor={pesos(r.cartera_total)} icono={Wallet} tono="alerta" detalle={`${r.clientes_con_deuda} clientes`} />
          <Indicador titulo="Vencido" valor={pesos(r.cartera_vencida)} icono={AlertTriangle} tono="peligro" detalle={`${r.creditos_vencidos} fiados`} />
          <Indicador titulo="Fiado hoy" valor={pesos(r.fiado_hoy)} icono={Plus} tono="gris" />
          <Indicador titulo="Abonos hoy" valor={pesos(r.abonos_hoy)} icono={HandCoins} tono="exito" detalle={`${r.num_abonos_hoy} pagos`} />
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Buscador className="flex-1" valor={q} onCambio={(v) => { setPagina(1); setQ(v) }} placeholder="Buscar por nombre, celular o cédula…" />
        <Pestanas valor={filtro} onCambio={(v) => { setPagina(1); setFiltro(v) }} opciones={[
          { valor: 'deuda', etiqueta: 'Con deuda' }, { valor: 'vencidos', etiqueta: 'Vencidos' }, { valor: 'todos', etiqueta: 'Todos' }]} />
      </div>
      {cargando && !datos ? <Cargando /> : lista.length === 0 ? (
        <Tarjeta><Vacio icono={Users} titulo={filtro === 'deuda' ? 'Nadie te debe 🎉' : 'Sin clientes'} texto="Los clientes se crean al fiar desde la caja o con “Nuevo cliente”." /></Tarjeta>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => {
            const saldo = Number(c.saldo)
            const uso = c.cupo_efectivo ? Math.min((saldo / Number(c.cupo_efectivo)) * 100, 100) : 0
            return (
              <button key={c.id} onClick={() => setSel(c.id)} className="tarjeta p-4 text-left transition hover:-translate-y-0.5 hover:shadow-flotante">
                <div className="flex items-center gap-3">
                  <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold', saldo > 0 ? 'bg-alerta-100 text-alerta-700' : 'bg-exito-100 text-exito-700')}>{iniciales(c.nombre)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{c.nombre}</p>
                    <p className="text-xs text-tinta-4">{c.telefono || 'Sin celular'} · {c.creditos_pendientes} pendientes</p>
                  </div>
                  <div className="text-right">
                    <p className={cx('font-extrabold tabular-nums', saldo > 0 ? 'text-alerta-700' : 'text-exito-700')}>{pesos(saldo)}</p>
                    {c.tiene_vencidos && <Insignia tono="peligro">Vencido</Insignia>}
                  </div>
                </div>
                {saldo > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full', uso >= 90 ? 'bg-peligro-500' : uso >= 60 ? 'bg-alerta-500' : 'bg-marca-500')} style={{ width: `${uso}%` }} /></div>
                    <p className="mt-1 text-[11px] text-tinta-4">{Number(c.cupo_efectivo) ? `Usa el ${Math.round(uso)}% de su cupo (${pesos(c.cupo_efectivo)})` : 'Sin tope de fiado'}</p>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
      {datos && (datos.next || datos.previous) && (
        <div className="mt-4 flex justify-end gap-2">
          <Boton tamano="sm" variante="secundario" disabled={!datos.previous} onClick={() => setPagina(pagina - 1)}>Anterior</Boton>
          <Boton tamano="sm" variante="secundario" disabled={!datos.next} onClick={() => setPagina(pagina + 1)}>Siguiente</Boton>
        </div>
      )}
      <EstadoCuenta id={sel} onCerrar={() => setSel(null)} onCambio={refrescar} />
      {nuevo && <ModalCliente onCerrar={() => setNuevo(false)} onGuardado={(c) => { setNuevo(false); refrescar(); setSel(c.id) }} />}
    </div>
  )
}

