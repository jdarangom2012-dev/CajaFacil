import { useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, Check, CheckCircle2, CreditCard, FileCheck2, HandCoins, Plus, Printer, Smartphone, Trash2, Wallet, X } from 'lucide-react'
import { api, mensajeError } from '../../api/cliente'
import SelectorCliente from '../../components/SelectorCliente'
import { Boton, Entrada, EntradaDinero, Interruptor, Modal, Selector, cx } from '../../components/ui'
import { useAviso } from '../../context/Aviso'
import { useSesion } from '../../context/Sesion'
import { refrescarFacturacion, useFacturacion, useFormasPago } from '../../hooks/datos'
import { impresionLocal, imprimirVenta } from '../../lib/impresion'
import { pesos } from '../../lib/formato'

const ICONOS = { EFECTIVO: Banknote, TRANSFERENCIA: Smartphone, TARJETA: CreditCard, CREDITO: HandCoins, OTRO: Wallet }

/** Billetes sugeridos para pagar en efectivo según el total. */
function sugerencias(total) {
  const billetes = [2000, 5000, 10000, 20000, 50000, 100000]
  const s = new Set([total])
  for (const b of billetes) {
    const v = Math.ceil(total / b) * b
    if (v > total) s.add(v)
  }
  return [...s].sort((a, b) => a - b).slice(0, 5)
}

function DocumentoEmitido({ doc }) {
  const ok = doc.estado === 'ACEPTADO'
  return (
    <div className={cx('mx-auto mt-4 flex max-w-sm items-start gap-2 rounded-xl px-3 py-2 text-left text-sm',
      ok ? 'bg-exito-50 text-exito-700' : doc.estado === 'RECHAZADO' ? 'bg-peligro-50 text-peligro-700' : 'bg-alerta-50 text-alerta-700')}>
      <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <b>Documento electrónico {doc.numero}</b>{doc.ambiente === 'PRUEBAS' ? ' (pruebas)' : ''}<br />
        {ok ? 'Aceptado por la DIAN.' : doc.estado === 'RECHAZADO' ? 'Rechazado: revísalo en Configuración → Facturación.' : 'Sin conexión: se enviará solo cuando vuelva el internet.'}
      </span>
    </div>
  )
}

const TIPOS_DOC = [['CC', 'Cédula'], ['NIT', 'NIT'], ['CE', 'Cédula de extranjería'], ['PP', 'Pasaporte'], ['TI', 'Tarjeta de identidad']]

/** "Cliente pide factura": datos del adquirente para el documento electrónico. */
function DatosFactura({ factura, setFactura, cliente }) {
  if (!factura) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-sm" data-ayuda="cobrar.factura">
        <span className="flex items-center gap-2 text-tinta-3"><FileCheck2 className="h-4 w-4 text-marca-600" /> Documento a: <b className="text-tinta-2">Consumidor final</b></span>
        <Boton variante="suave" tamano="sm" onClick={() => setFactura({ tipo_doc: 'CC', numero: cliente?.cedula || '', nombre: cliente?.nombre || '', correo: '' })}>Cliente pide factura</Boton>
      </div>
    )
  }
  const set = (k, v) => setFactura((f) => ({ ...f, [k]: v }))
  return (
    <div className="rounded-2xl border border-marca-200 bg-marca-50/40 p-3" data-no-enter data-ayuda="cobrar.factura">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-marca-800">Datos para la factura</span>
        <button onClick={() => setFactura(null)} className="rounded-lg p-1 text-tinta-4 hover:bg-white" title="Volver a consumidor final"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <Selector value={factura.tipo_doc} onChange={(e) => set('tipo_doc', e.target.value)} className="h-10 text-sm">
          {TIPOS_DOC.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </Selector>
        <Entrada className="h-10" placeholder="Número de documento" value={factura.numero} onChange={(e) => set('numero', e.target.value)} />
        <Entrada className="col-span-2 h-10" placeholder="Nombre o razón social" value={factura.nombre} onChange={(e) => set('nombre', e.target.value)} />
        <Entrada className="col-span-2 h-10" type="email" placeholder="Correo (para enviarle el documento)" value={factura.correo} onChange={(e) => set('correo', e.target.value)} />
      </div>
    </div>
  )
}

function Exito({ venta, onNueva, onImprimir, imprimiendo }) {
  const btn = useRef(null)
  useEffect(() => { setTimeout(() => btn.current?.focus(), 80) }, [])
  const cambio = Number(venta.cambio)
  return (
    <div className="py-4 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-exito-50 text-exito-600 animate-pop"><CheckCircle2 className="h-11 w-11" /></span>
      <h2 className="mt-4 text-2xl font-extrabold">¡Venta registrada!</h2>
      <p className="text-sm text-tinta-4">Venta No. {venta.numero} · {pesos(venta.total)}{venta.cliente_nombre ? ` · ${venta.cliente_nombre}` : ''}</p>
      {cambio > 0 && (
        <div className="mx-auto mt-6 max-w-xs rounded-3xl bg-exito-500 px-6 py-5 text-white shadow-[0_12px_32px_-10px_rgba(18,183,106,.7)]">
          <p className="text-sm font-semibold opacity-90">Entrega de cambio</p>
          <p className="text-5xl font-extrabold tracking-tight tabular-nums">{pesos(cambio)}</p>
        </div>
      )}
      {venta.credito_numero && <p className="mt-4 rounded-xl bg-alerta-50 px-3 py-2 text-sm font-semibold text-alerta-700">Se registró el fiado No. {venta.credito_numero}</p>}
      {venta.documento_electronico && <DocumentoEmitido doc={venta.documento_electronico} />}
      <div className="mt-7 grid grid-cols-2 gap-2">
        <Boton variante="secundario" tamano="lg" icono={Printer} onClick={onImprimir} cargando={imprimiendo}>Imprimir</Boton>
        <Boton ref={btn} tamano="lg" onClick={onNueva}>Nueva venta <span className="ml-1 rounded-md bg-white/20 px-1.5 text-xs">Enter</span></Boton>
      </div>
    </div>
  )
}

export default function ModalCobro({ carrito, total, conf, onCerrar, onVendido, onNueva }) {
  const formas = useFormasPago()
  const aviso = useAviso()
  const { negocio } = useSesion()
  const [pagos, setPagos] = useState([])
  const [cliente, setCliente] = useState(null)
  const [imprimir, setImprimir] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [venta, setVenta] = useState(null)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [error, setError] = useState('')
  const fe = useFacturacion()
  const [factura, setFactura] = useState(null)

  useEffect(() => { if (conf) setImprimir(conf.impresora_tipo !== 'NINGUNA' && conf.imprimir_automatico) }, [conf])
  useEffect(() => {
    if (formas.length && !pagos.length) {
      const ef = formas.find((f) => f.tipo === 'EFECTIVO') || formas[0]
      setPagos([{ forma: ef, monto: total, referencia: '' }])
    }
  }, [formas]) // eslint-disable-line

  const pagado = useMemo(() => pagos.reduce((s, p) => s + Number(p.monto || 0), 0), [pagos])
  const falta = Math.max(total - pagado, 0)
  const cambio = Math.max(pagado - total, 0)
  const efectivo = pagos.filter((p) => p.forma.tipo === 'EFECTIVO').reduce((s, p) => s + Number(p.monto || 0), 0)
  const hayFiado = pagos.some((p) => p.forma.tipo === 'CREDITO' && Number(p.monto) > 0)
  const cambioInvalido = cambio > 0 && cambio > efectivo

  const elegirForma = (f) => {
    setError('')
    if (pagos.length <= 1) setPagos([{ forma: f, monto: total, referencia: '' }])
    else setPagos((ps) => [...ps.slice(0, -1), { ...ps[ps.length - 1], forma: f }])
  }
  const dividir = () => {
    const usadas = new Set(pagos.map((p) => p.forma.id))
    const sig = formas.find((f) => !usadas.has(f.id)) || formas[0]
    const primero = pagos[0]
    const nuevoPrimero = { ...primero, monto: Math.min(Number(primero.monto), total) }
    const resto = Math.max(total - nuevoPrimero.monto - pagos.slice(1).reduce((s, p) => s + Number(p.monto || 0), 0), 0)
    setPagos([nuevoPrimero, ...pagos.slice(1), { forma: sig, monto: resto, referencia: '' }])
  }
  const actualizar = (i, cambios) => setPagos((ps) => ps.map((p, j) => (j === i ? { ...p, ...cambios } : p)))

  const confirmar = async () => {
    if (procesando) return
    setError('')
    if (falta > 0) return setError(`Faltan ${pesos(falta)} por pagar.`)
    if (cambioInvalido) return setError('El cambio solo puede salir de un pago en efectivo.')
    if (hayFiado && !cliente) return setError('Selecciona el cliente del fiado.')
    setProcesando(true)
    try {
      const { data } = await api.post('/ventas/procesar/', {
        detalle: carrito.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, precio_unit: l.precio_unit, descuento: l.descuento || 0 })),
        pagos: pagos.filter((p) => Number(p.monto) > 0).map((p) => ({ forma_pago_id: p.forma.id, monto: p.monto, referencia: p.referencia })),
        cliente_id: cliente?.id || null,
        adquirente: fe.activa && factura?.numero ? factura : null,
      })
      if (data.documento_electronico) refrescarFacturacion()
      setVenta(data)
      onVendido(data)
      if (imprimir) {
        imprimirVenta(data, conf, negocio, { abrirCajon: efectivo > 0 }).then((r) => {
          if (r && r.ok === false && r.error) aviso.error(`No se imprimió: ${r.error}`)
        }).catch(() => aviso.error('No se pudo imprimir el ticket.'))
      } else if (efectivo > 0 && conf?.abrir_cajon_efectivo && !impresionLocal() && !['NAVEGADOR', 'NINGUNA'].includes(conf?.impresora_tipo)) {
        api.post('/sistema/hardware/abrir-cajon/').catch(() => {})
      }
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setProcesando(false)
    }
  }

  const reimprimir = async () => {
    setImprimiendo(true)
    try {
      const r = await imprimirVenta(venta, conf, negocio)
      if (r?.ok === false && r.error) aviso.error(r.error)
    } catch (e) { aviso.error(mensajeError(e)) } finally { setImprimiendo(false) }
  }

  // Enter confirma; en éxito, Enter = nueva venta (lo maneja el foco del botón)
  useEffect(() => {
    const h = (e) => {
      if (venta) { if (e.key === 'Escape') onNueva(); return }
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.tagName !== 'BUTTON') {
        if (document.activeElement?.closest('[data-no-enter]')) return
        e.preventDefault()
        confirmar()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  if (venta) {
    return (
      <Modal abierto onCerrar={onNueva} ancho="sm" sinCerrar>
        <Exito venta={venta} onNueva={onNueva} onImprimir={reimprimir} imprimiendo={imprimiendo} />
      </Modal>
    )
  }

  const unico = pagos.length === 1 ? pagos[0] : null

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Cobrar" ancho="lg"
      pie={<>
        {conf && conf.impresora_tipo !== 'NINGUNA' && <div className="mr-auto"><Interruptor activo={imprimir} onCambio={setImprimir} etiqueta="Imprimir ticket" /></div>}
        <Boton variante="secundario" onClick={onCerrar}>Volver</Boton>
        <Boton variante="exito" tamano="lg" icono={Check} onClick={confirmar} cargando={procesando} disabled={falta > 0}>
          Confirmar venta <span className="ml-1 rounded-md bg-white/20 px-1.5 text-xs">Enter</span>
        </Boton>
      </>}>
      <div className="grid gap-5 md:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col justify-between rounded-3xl bg-noche p-5 text-white">
          <div>
            <p className="text-sm font-semibold text-white/70">Total a cobrar</p>
            <p className="text-5xl font-extrabold tracking-tight tabular-nums">{pesos(total)}</p>
            <p className="mt-1 text-sm text-white/55">{carrito.length} {carrito.length === 1 ? 'línea' : 'líneas'}</p>
          </div>
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-white/70">Recibido</span><b className="tabular-nums">{pesos(pagado)}</b></div>
            {falta > 0 && <div className="flex justify-between text-lg"><span className="text-alerta-500 font-semibold">Falta</span><b className="tabular-nums text-alerta-500">{pesos(falta)}</b></div>}
            <div className={cx('flex items-center justify-between rounded-2xl px-4 py-3', cambio > 0 ? 'bg-exito-500' : 'bg-white/10')}>
              <span className="font-semibold">Cambio</span><span className="text-3xl font-extrabold tabular-nums">{pesos(cambio)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div data-ayuda="cobrar.forma">
            <span className="etiqueta">Forma de pago</span>
            <div className="grid grid-cols-3 gap-2">
              {formas.map((f) => {
                const Icono = ICONOS[f.tipo] || Wallet
                const activa = pagos[pagos.length - 1]?.forma.id === f.id
                return (
                  <button key={f.id} onClick={() => elegirForma(f)} data-ayuda={f.tipo === 'CREDITO' ? 'cobrar.fiado' : undefined}
                    className={cx('flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-xs font-bold transition',
                      activa ? 'border-marca-600 bg-marca-50 text-marca-800' : 'border-slate-200 text-tinta-3 hover:border-slate-300')}>
                    <Icono className="h-5 w-5" style={{ color: activa ? undefined : f.color }} />
                    <span className="truncate max-w-full">{f.nombre}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {unico ? (
            <div data-ayuda="cobrar.recibido">
              <span className="etiqueta">{unico.forma.tipo === 'EFECTIVO' ? 'Con cuánto paga' : 'Valor'}</span>
              <EntradaDinero grande autoFocus valor={unico.monto} onCambio={(v) => actualizar(0, { monto: v })} />
              {unico.forma.tipo === 'EFECTIVO' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {sugerencias(total).map((v) => (
                    <button key={v} onClick={() => actualizar(0, { monto: v })}
                      className={cx('rounded-xl px-3 py-2 text-sm font-bold transition', Number(unico.monto) === v ? 'bg-marca-600 text-white' : 'bg-slate-100 hover:bg-slate-200')}>
                      {v === total ? 'Exacto' : pesos(v)}
                    </button>
                  ))}
                </div>
              )}
              {unico.forma.tipo === 'TRANSFERENCIA' && (
                <Entrada className="mt-2" placeholder={`Referencia ${unico.forma.requiere_referencia ? '(obligatoria)' : '(opcional)'}`} value={unico.referencia}
                  onChange={(e) => actualizar(0, { referencia: e.target.value })} />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pagos.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-2xl border border-slate-200 p-2">
                  <select className="campo h-10 w-36 shrink-0 text-sm" value={p.forma.id} onChange={(e) => actualizar(i, { forma: formas.find((f) => f.id === e.target.value) })}>
                    {formas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                  <div className="flex-1"><EntradaDinero valor={p.monto} onCambio={(v) => actualizar(i, { monto: v })} className="h-10" /></div>
                  <button onClick={() => setPagos(pagos.filter((_, j) => j !== i))} className="rounded-lg p-2 text-slate-400 hover:bg-peligro-50 hover:text-peligro-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
          <Boton variante="fantasma" tamano="sm" icono={Plus} onClick={dividir}>Dividir el pago (ej. parte efectivo, parte Nequi)</Boton>

          {fe.activa && <DatosFactura factura={factura} setFactura={setFactura} cliente={cliente} />}

          {hayFiado && (
            <div data-no-enter>
              <span className="etiqueta">Cliente del fiado</span>
              <SelectorCliente valor={cliente} onCambio={setCliente} />
            </div>
          )}
          {error && <p className="rounded-xl bg-peligro-50 px-3.5 py-2.5 text-sm font-semibold text-peligro-700">{error}</p>}
        </div>
      </div>
    </Modal>
  )
}
