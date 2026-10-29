import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, FileCheck2, PlugZap, RefreshCw, Save, Send } from 'lucide-react'
import { api, mensajeError } from '../../api/cliente'
import { Boton, Campo, Cargando, Entrada, Insignia, Interruptor, Modal, Pestanas, Selector, Vacio, cx } from '../../components/ui'
import { useAviso } from '../../context/Aviso'
import { refrescarFacturacion, useApi, useFacturacion } from '../../hooks/datos'
import { fechaHora, numero, pesos } from '../../lib/formato'

const TONO_ESTADO = { ACEPTADO: 'exito', PENDIENTE: 'alerta', RECHAZADO: 'peligro' }
const CAMPOS_CRED = {
  api_url: { etiqueta: 'URL de la API', placeholder: 'https://…' },
  api_usuario: { etiqueta: 'Usuario o correo' },
  api_clave: { etiqueta: 'Contraseña', tipo: 'password', secreto: 'tiene_clave' },
  api_token: { etiqueta: 'Token de acceso', tipo: 'password', secreto: 'tiene_token' },
}

export function EstadoDocumento({ estado }) {
  const txt = { ACEPTADO: 'Aceptado DIAN', PENDIENTE: 'Pendiente', RECHAZADO: 'Rechazado' }[estado] || estado
  return <Insignia tono={TONO_ESTADO[estado] || 'gris'} punto>{txt}</Insignia>
}

function Documentos() {
  const aviso = useAviso()
  const [filtro, setFiltro] = useState('')
  const { datos, cargando, recargar } = useApi('/facturacion/documentos/', filtro ? { estado: filtro } : {})
  const [ver, setVer] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const reintentar = async (d) => {
    try {
      const { data } = await api.post(`/facturacion/documentos/${d.id}/reintentar/`)
      aviso[data.estado === 'ACEPTADO' ? 'exito' : 'error'](data.estado === 'ACEPTADO' ? `Documento ${data.numero} aceptado` : (data.ultimo_error || 'Sigue pendiente'))
      recargar(); refrescarFacturacion()
    } catch (e) { aviso.error(mensajeError(e)) }
  }
  const enviarPendientes = async () => {
    setEnviando(true)
    try {
      const { data } = await api.post('/facturacion/enviar-pendientes/')
      aviso.exito(`${data.enviados} enviados · ${data.pendientes} pendientes`)
      recargar(); refrescarFacturacion()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setEnviando(false) }
  }
  const abrir = async (d) => {
    try { const { data } = await api.get(`/facturacion/documentos/${d.id}/`); setVer(data) } catch (e) { aviso.error(mensajeError(e)) }
  }

  return (
    <div className="mt-8 border-t border-slate-100 pt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-extrabold">Documentos emitidos</h3>
        <div className="flex flex-wrap gap-2">
          <Pestanas valor={filtro} onCambio={setFiltro} opciones={[
            { valor: '', etiqueta: 'Todos' }, { valor: 'PENDIENTE', etiqueta: 'Pendientes' }, { valor: 'RECHAZADO', etiqueta: 'Rechazados' }]} />
          <Boton tamano="sm" variante="secundario" icono={Send} cargando={enviando} onClick={enviarPendientes}>Enviar pendientes</Boton>
        </div>
      </div>
      {cargando && !datos ? <Cargando /> : !datos?.length ? <Vacio icono={FileCheck2} titulo="Sin documentos" texto="Cuando vendas con la facturación activa, los documentos aparecen aquí." /> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="tabla">
            <thead><tr><th>Número</th><th>Fecha</th><th>Venta</th><th>Cliente</th><th className="text-right">Total</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.id}>
                  <td className="font-bold">{d.numero}{d.tipo === 'NOTA_AJUSTE' && <span className="ml-1 text-xs font-semibold text-tinta-4">(nota)</span>}</td>
                  <td className="whitespace-nowrap text-tinta-3">{fechaHora(d.creado)}</td>
                  <td>#{d.venta_numero}</td>
                  <td className="max-w-[180px] truncate">{d.adquirente}</td>
                  <td className="text-right tabular-nums">{pesos(d.total)}</td>
                  <td><EstadoDocumento estado={d.estado} />{d.ultimo_error && d.estado !== 'ACEPTADO' && <p className="mt-1 max-w-[220px] truncate text-xs text-peligro-600" title={d.ultimo_error}>{d.ultimo_error}</p>}</td>
                  <td className="whitespace-nowrap text-right">
                    <Boton tamano="icono-sm" variante="fantasma" title="Ver detalle" onClick={() => abrir(d)}><Eye className="h-4 w-4" /></Boton>
                    {d.estado !== 'ACEPTADO' && <Boton tamano="icono-sm" variante="fantasma" title="Reintentar envío" onClick={() => reintentar(d)}><RefreshCw className="h-4 w-4" /></Boton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal abierto={!!ver} onCerrar={() => setVer(null)} titulo={ver ? `Documento ${ver.numero}` : ''} ancho="lg"
        descripcion={ver ? `${ver.tipo_display} · venta #${ver.venta_numero}` : ''}>
        {ver && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><EstadoDocumento estado={ver.estado} /><Insignia>{ver.ambiente === 'PRUEBAS' ? 'Ambiente de pruebas' : 'Producción'}</Insignia><span className="text-tinta-4">{ver.intentos} intento(s)</span></div>
            {ver.cude && <div><p className="etiqueta">CUDE</p><p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-xs">{ver.cude}</p></div>}
            {ver.ultimo_error && <p className="rounded-xl bg-peligro-50 p-3 text-peligro-700">{ver.ultimo_error}</p>}
            <div>
              <p className="etiqueta">Lo que se envía al proveedor</p>
              <pre className="max-h-72 overflow-auto rounded-xl bg-noche p-3 text-[11px] leading-relaxed text-white/80">{JSON.stringify(ver.documento, null, 2)}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function Facturacion() {
  const aviso = useAviso()
  const fe = useFacturacion()
  const { datos: c0, cargando, error, setDatos } = useApi('/facturacion/configuracion/')
  const [c, setC] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  useEffect(() => { if (c0) setC({ ...c0, api_clave: '', api_token: '' }) }, [c0])

  if (error) return <Vacio icono={AlertTriangle} titulo="Módulo no disponible" texto={error} />
  if (cargando || !c) return <Cargando />
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }))
  const prov = c.proveedores.find((p) => p.codigo === c.proveedor)

  const guardar = async () => {
    setGuardando(true)
    try {
      const cuerpo = { ...c }
      delete cuerpo.proveedores; delete cuerpo.problemas
      const { data } = await api.put('/facturacion/configuracion/', cuerpo)
      setDatos(data)
      aviso.exito(data.activa ? 'Facturación electrónica activa' : 'Configuración guardada')
      refrescarFacturacion()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setGuardando(false) }
  }
  const probar = async () => {
    setProbando(true)
    try { const { data } = await api.post('/facturacion/probar/'); aviso.exito(data.mensaje) } catch (e) { aviso.error(mensajeError(e)) } finally { setProbando(false) }
  }

  return (
    <>
      <p className="mb-5 text-sm leading-relaxed text-tinta-3">
        Cada venta se convierte en un <b>documento equivalente electrónico POS</b> validado por la DIAN, con su CUDE y su código QR en el tiquete.
        Si no hay internet, la venta se hace igual y el documento se envía solo cuando vuelva la conexión.
      </p>
      {!fe.licenciada && (
        <div className="mb-5 flex gap-3 rounded-2xl bg-alerta-50 p-4 text-sm text-alerta-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Puedes probar el módulo en <b>ambiente de pruebas</b>. Para facturar de verdad (producción), la licencia debe incluir facturación electrónica: contáctanos.</p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 p-4">
        <Interruptor activo={c.activa} onCambio={(v) => set('activa', v)} etiqueta="Facturación electrónica activa"
          descripcion="Apagada, la caja funciona como siempre (tiquete interno). Encendida, cada venta genera su documento ante la DIAN." />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Proveedor tecnológico" ayuda={prov?.descripcion}>
          <Selector value={c.proveedor} onChange={(e) => set('proveedor', e.target.value)}>
            {c.proveedores.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
          </Selector>
        </Campo>
        <Campo etiqueta="Ambiente" ayuda="Pruebas no tiene validez fiscal. Úsalo para la habilitación ante la DIAN.">
          <Selector value={c.ambiente} onChange={(e) => set('ambiente', e.target.value)}>
            <option value="PRUEBAS">Pruebas (habilitación)</option>
            <option value="PRODUCCION" disabled={!fe.licenciada}>Producción{!fe.licenciada ? ' (requiere licencia)' : ''}</option>
          </Selector>
        </Campo>
        {(prov?.campos || []).map((k) => {
          const def = CAMPOS_CRED[k]
          return (
            <Campo key={k} etiqueta={def.etiqueta} ayuda={def.secreto && c[def.secreto] ? 'Ya está guardada. Escribe solo si la quieres cambiar.' : undefined}>
              <Entrada type={def.tipo || 'text'} value={c[k] || ''} placeholder={def.placeholder} onChange={(e) => set(k, e.target.value)} autoComplete="off" />
            </Campo>
          )
        })}
      </div>

      <h3 className="mt-8 mb-1 text-base font-extrabold">Resolución de numeración DIAN</h3>
      <p className="mb-4 text-sm text-tinta-4">Los datos de la resolución que te dio la DIAN para el documento POS (portal DIAN → Numeración).</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Número de resolución" className="sm:col-span-2"><Entrada value={c.resolucion_numero} onChange={(e) => set('resolucion_numero', e.target.value)} placeholder="Ej: 18764000001234" /></Campo>
        <Campo etiqueta="Prefijo"><Entrada value={c.prefijo} onChange={(e) => set('prefijo', e.target.value.toUpperCase())} placeholder="Ej: POS" /></Campo>
        <Campo etiqueta="Desde el número"><Entrada inputMode="numeric" value={c.rango_desde ?? ''} onChange={(e) => set('rango_desde', e.target.value.replace(/\D/g, ''))} /></Campo>
        <Campo etiqueta="Hasta el número"><Entrada inputMode="numeric" value={c.rango_hasta ?? ''} onChange={(e) => set('rango_hasta', e.target.value.replace(/\D/g, ''))} /></Campo>
        <Campo etiqueta="Clave técnica (si aplica)"><Entrada value={c.clave_tecnica} onChange={(e) => set('clave_tecnica', e.target.value)} /></Campo>
        <Campo etiqueta="Vigente desde"><Entrada type="date" value={c.fecha_desde || ''} onChange={(e) => set('fecha_desde', e.target.value)} /></Campo>
        <Campo etiqueta="Vigente hasta"><Entrada type="date" value={c.fecha_hasta || ''} onChange={(e) => set('fecha_hasta', e.target.value)} /></Campo>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="text-tinta-4">Próximo número</p>
          <p className="text-lg font-extrabold">{c.proximo_numero ? `${c.prefijo}${c.proximo_numero}` : '—'}</p>
          {c.restantes != null && <p className={cx('text-xs font-semibold', c.restantes <= c.aviso_numeros ? 'text-alerta-700' : 'text-tinta-4')}>Quedan {numero(c.restantes)}</p>}
        </div>
        <Campo etiqueta="Avisar cuando queden" ayuda="números o menos"><Entrada inputMode="numeric" value={c.aviso_numeros ?? ''} onChange={(e) => set('aviso_numeros', e.target.value.replace(/\D/g, ''))} /></Campo>
        <Campo etiqueta="Avisar antes de vencer" ayuda="días"><Entrada inputMode="numeric" value={c.aviso_dias ?? ''} onChange={(e) => set('aviso_dias', e.target.value.replace(/\D/g, ''))} /></Campo>
      </div>

      {c.problemas?.length > 0 && (
        <div className="mt-5 rounded-2xl bg-peligro-50 p-4 text-sm text-peligro-700">
          <p className="mb-1 font-bold">Falta para poder facturar:</p>
          <ul className="list-disc space-y-0.5 pl-5">{c.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {c0.activa && !c.problemas?.length && (
        <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-exito-700"><CheckCircle2 className="h-4 w-4" /> Facturando {c0.ambiente === 'PRUEBAS' ? 'en ambiente de pruebas' : 'en producción'}.</p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" icono={PlugZap} cargando={probando} onClick={probar}>Probar conexión</Boton>
        <Boton icono={Save} cargando={guardando} onClick={guardar}>Guardar cambios</Boton>
      </div>

      <Documentos />
    </>
  )
}
