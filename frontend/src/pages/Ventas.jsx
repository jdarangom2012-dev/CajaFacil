import { useState } from 'react'
import { Ban, Download, Printer, Receipt } from 'lucide-react'
import { api, descargarArchivo, mensajeError } from '../api/cliente'
import {
  AreaTexto, Boton, Buscador, Cargando, Confirmar, EncabezadoPagina, Entrada, Insignia, Panel, Selector, Tarjeta, Vacio,
  useDebounce,
} from '../components/ui'
import { useAviso } from '../context/Aviso'
import { useSesion } from '../context/Sesion'
import { useApi, useConfiguracion } from '../hooks/datos'
import { imprimirVenta } from '../lib/impresion'
import { cantidad, fechaHora, hoyISO, pesos } from '../lib/formato'
import { EstadoDocumento } from './configuracion/Facturacion'

function DetalleVenta({ id, onCerrar, onCambio }) {
  const { esGestion, negocio } = useSesion()
  const conf = useConfiguracion()
  const aviso = useAviso()
  const { datos: v, recargar } = useApi(id ? `/ventas/historial/${id}/` : null)
  const [anular, setAnular] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false)
  if (!id) return null

  const confirmarAnular = async () => {
    setCargando(true)
    try {
      await api.post(`/ventas/historial/${id}/anular/`, { motivo })
      aviso.exito('Venta anulada. El inventario fue devuelto.')
      setAnular(false)
      recargar()
      onCambio()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  const imprimir = async () => {
    try {
      const r = await imprimirVenta(v, conf, negocio, { copia: true })
      if (r?.ok === false && r.error) aviso.error(r.error)
    } catch (e) { aviso.error(mensajeError(e)) }
  }

  return (
    <Panel abierto onCerrar={onCerrar} titulo={v ? `Venta No. ${v.numero}` : 'Venta'} subtitulo={v && fechaHora(v.creado)}
      pie={v && <>
        {esGestion && v.estado === 'COMPLETADA' && <Boton variante="peligro-suave" icono={Ban} onClick={() => setAnular(true)}>Anular</Boton>}
        <Boton variante="secundario" icono={Printer} onClick={imprimir}>Reimprimir</Boton>
      </>}>
      {!v ? <Cargando /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Insignia tono={v.estado === 'ANULADA' ? 'peligro' : 'exito'} punto>{v.estado === 'ANULADA' ? 'Anulada' : 'Completada'}</Insignia>
            <Insignia>{v.terminal}{v.caja_numero ? ` · Caja #${v.caja_numero}` : ''}</Insignia>
            <Insignia>Atendió {v.usuario_nombre}</Insignia>
            {v.cliente_nombre && <Insignia tono="alerta">Cliente: {v.cliente_nombre}</Insignia>}
          </div>
          {v.documento_electronico && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <b>Documento electrónico {v.documento_electronico.numero}</b>
                <EstadoDocumento estado={v.documento_electronico.estado} />
                {v.documento_electronico.ambiente === 'PRUEBAS' && <Insignia>Pruebas</Insignia>}
              </div>
              {v.documento_electronico.adquirente && <p className="mt-1 text-tinta-3">Adquirente: {v.documento_electronico.adquirente}</p>}
              {v.documento_electronico.cude && <p className="mt-1 break-all font-mono text-[11px] text-tinta-4">CUDE {v.documento_electronico.cude}</p>}
            </div>
          )}
          {v.estado === 'ANULADA' && (
            <p className="rounded-xl bg-peligro-50 p-3 text-sm text-peligro-700"><b>Anulada por {v.anulada_por_nombre}</b> · {fechaHora(v.anulada_en)}<br />{v.motivo_anulacion}</p>
          )}
          <Tarjeta className="overflow-hidden">
            <table className="tabla w-full">
              <thead><tr><th>Producto</th><th className="text-right">Cant.</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {v.detalle.map((d) => (
                  <tr key={d.id}>
                    <td><p className="font-semibold">{d.nombre_producto}</p><p className="text-xs text-tinta-4">{pesos(d.precio_unit)} c/u{Number(d.descuento) ? ` · desc. ${pesos(d.descuento)}` : ''}</p></td>
                    <td className="text-right">{cantidad(d.cantidad, d.unidad_medida)}</td>
                    <td className="text-right font-bold tabular-nums">{pesos(d.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
          <div className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm">
            {Number(v.descuento) > 0 && <div className="flex justify-between"><span>Descuentos</span><b className="text-exito-700">−{pesos(v.descuento)}</b></div>}
            <div className="flex justify-between text-lg"><b>Total</b><b className="tabular-nums">{pesos(v.total)}</b></div>
            {v.pagos.map((p) => <div key={p.id} className="flex justify-between text-tinta-3"><span>{p.forma_pago_nombre}{p.referencia ? ` (${p.referencia})` : ''}{Number(p.recibido) > Number(p.monto) ? ` · recibido ${pesos(p.recibido)}` : ''}</span><span className="tabular-nums">{pesos(p.monto)}</span></div>)}
            {Number(v.cambio) > 0 && <div className="flex justify-between"><span>Cambio</span><b className="tabular-nums">{pesos(v.cambio)}</b></div>}
            {v.credito_numero && <div className="flex justify-between text-alerta-700"><span>Fiado No.</span><b>{v.credito_numero}</b></div>}
          </div>
        </div>
      )}
      <Confirmar abierto={anular} onCerrar={() => setAnular(false)} onConfirmar={confirmarAnular} peligro cargando={cargando}
        titulo={`¿Anular la venta No. ${v?.numero}?`} texto="Los productos vuelven al inventario y la anulación queda en la auditoría." textoBoton="Sí, anular">
        <AreaTexto className="mt-3" autoFocus placeholder="Motivo de la anulación (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Confirmar>
    </Panel>
  )
}

export default function Ventas() {
  const { esGestion } = useSesion()
  const aviso = useAviso()
  const [f, setF] = useState({ fecha_desde: hoyISO(), fecha_hasta: hoyISO(), estado: '', q: '' })
  const q = useDebounce(f.q, 300)
  const [pagina, setPagina] = useState(1)
  const { datos, cargando, recargar } = useApi('/ventas/historial/', { ...f, q, page: pagina, page_size: 50 })
  const [sel, setSel] = useState(null)
  const lista = datos?.results || []
  const set = (k) => (e) => { setPagina(1); setF({ ...f, [k]: e.target.value }) }

  const exportar = async (tipo) => {
    try { await descargarArchivo('/reportes/exportar/', { fecha_desde: f.fecha_desde, fecha_hasta: f.fecha_hasta, tipo }, `${tipo}_${f.fecha_desde}_${f.fecha_hasta}.xlsx`) }
    catch (e) { aviso.error(mensajeError(e)) }
  }

  return (
    <div>
      <EncabezadoPagina icono={Receipt} titulo="Ventas" descripcion="Historial, reimpresión y anulaciones."
        acciones={esGestion && <>
          <Boton variante="secundario" icono={Download} onClick={() => exportar('ventas')}>Excel ventas</Boton>
          <Boton variante="secundario" icono={Download} onClick={() => exportar('detalle')}>Excel detalle</Boton>
        </>} />
      <Tarjeta className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr]">
        <label><span className="etiqueta">Desde</span><Entrada type="date" value={f.fecha_desde} onChange={set('fecha_desde')} /></label>
        <label><span className="etiqueta">Hasta</span><Entrada type="date" value={f.fecha_hasta} onChange={set('fecha_hasta')} /></label>
        <label><span className="etiqueta">Estado</span>
          <Selector value={f.estado} onChange={set('estado')}><option value="">Todas</option><option value="COMPLETADA">Completadas</option><option value="ANULADA">Anuladas</option></Selector></label>
        <label><span className="etiqueta">Buscar</span><Buscador valor={f.q} onCambio={(v) => { setPagina(1); setF({ ...f, q: v }) }} placeholder="Número, cliente o producto" /></label>
      </Tarjeta>
      <Tarjeta className="overflow-hidden">
        {cargando && !datos ? <Cargando /> : lista.length === 0 ? <Vacio icono={Receipt} titulo="No hay ventas en este periodo" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="tabla w-full">
                <thead><tr><th>No.</th><th>Fecha</th><th className="hidden md:table-cell">Atendió</th><th className="hidden lg:table-cell">Pago</th><th className="hidden sm:table-cell">Cliente</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {lista.map((v) => (
                    <tr key={v.id} onClick={() => setSel(v.id)} className="cursor-pointer">
                      <td><b>#{v.numero}</b>{v.estado === 'ANULADA' && <Insignia tono="peligro" className="ml-2">Anulada</Insignia>}
                        {v.fe && <span className={`ml-2 text-[11px] font-bold ${v.fe.estado === 'ACEPTADO' ? 'text-exito-700' : v.fe.estado === 'RECHAZADO' ? 'text-peligro-600' : 'text-alerta-700'}`} title={`Documento electrónico: ${v.fe.estado}`}>{v.fe.numero}</span>}</td>
                      <td className="whitespace-nowrap">{fechaHora(v.creado)}</td>
                      <td className="hidden md:table-cell">{v.usuario_nombre}<div className="text-xs text-tinta-4">{v.terminal}</div></td>
                      <td className="hidden lg:table-cell text-tinta-3">{v.formas_pago.join(', ')}</td>
                      <td className="hidden sm:table-cell text-tinta-3">{v.cliente_nombre || '—'}</td>
                      <td className={`text-right font-bold tabular-nums ${v.estado === 'ANULADA' ? 'text-tinta-4 line-through' : ''}`}>{pesos(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm text-tinta-4">
              <span>{datos.count} ventas</span>
              <div className="flex gap-2">
                <Boton tamano="sm" variante="secundario" disabled={!datos.previous} onClick={() => setPagina(pagina - 1)}>Anterior</Boton>
                <Boton tamano="sm" variante="secundario" disabled={!datos.next} onClick={() => setPagina(pagina + 1)}>Siguiente</Boton>
              </div>
            </div>
          </>
        )}
      </Tarjeta>
      <DetalleVenta id={sel} onCerrar={() => setSel(null)} onCambio={recargar} />
    </div>
  )
}
