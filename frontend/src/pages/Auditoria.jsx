import { useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { Boton, Buscador, Cargando, EncabezadoPagina, Entrada, Indicador, Insignia, Panel, Selector, Tarjeta, Vacio, cx, useDebounce } from '../components/ui'
import { useApi } from '../hooks/datos'
import { fechaHora, haceDiasISO, hoyISO, numero } from '../lib/formato'

const ACCIONES = {
  CANCEL: ['peligro', 'Anulación'], PRECIO: ['alerta', 'Cambio de precio'], AJUSTE: ['alerta', 'Ajuste inventario'],
  DESCUADRE: ['peligro', 'Descuadre'], CAJON: ['alerta', 'Cajón abierto'], LOGIN_FALLIDO: ['peligro', 'Login fallido'],
  DESCUENTO: ['alerta', 'Descuento'], LOGIN: ['gris', 'Inicio sesión'], LOGOUT: ['gris', 'Salida'], INSERT: ['marca', 'Creación'],
  UPDATE: ['marca', 'Modificación'], DELETE: ['peligro', 'Eliminación'], CAJA: ['exito', 'Caja'], RESPALDO: ['gris', 'Respaldo'],
  LICENCIA: ['marca', 'Licencia'], CONFIG: ['gris', 'Configuración'],
}

export default function Auditoria() {
  const [f, setF] = useState({ fecha_desde: haceDiasISO(6), fecha_hasta: hoyISO(), accion: '', solo_alertas: '1', q: '' })
  const q = useDebounce(f.q)
  const [pagina, setPagina] = useState(1)
  const { datos, cargando } = useApi('/auditoria/', { ...f, q, page: pagina, page_size: 50 })
  const { datos: r } = useApi('/auditoria/resumen/')
  const [sel, setSel] = useState(null)
  const set = (k, v) => { setPagina(1); setF({ ...f, [k]: v }) }
  const lista = datos?.results || []
  return (
    <div>
      <EncabezadoPagina icono={ShieldCheck} titulo="Auditoría" descripcion="Todo lo sensible queda registrado y no se puede borrar: anulaciones, precios, descuadres, cajón." />
      {r && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador titulo="Alertas (7 días)" valor={numero(r.alertas)} icono={AlertTriangle} tono="peligro" />
          <Indicador titulo="Eventos (7 días)" valor={numero(r.total)} icono={ShieldCheck} tono="gris" />
          {r.alertas_por_usuario.slice(0, 2).map((u) => (
            <Indicador key={u.usuario_nombre} titulo={`Alertas de ${u.usuario_nombre}`} valor={numero(u.total)} tono="alerta" />
          ))}
        </div>
      )}
      <Tarjeta className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Entrada type="date" value={f.fecha_desde} onChange={(e) => set('fecha_desde', e.target.value)} />
        <Entrada type="date" value={f.fecha_hasta} onChange={(e) => set('fecha_hasta', e.target.value)} />
        <Selector value={f.accion} onChange={(e) => set('accion', e.target.value)}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES).map(([k, [, t]]) => <option key={k} value={k}>{t}</option>)}
        </Selector>
        <Selector value={f.solo_alertas} onChange={(e) => set('solo_alertas', e.target.value)}>
          <option value="1">Solo alertas</option><option value="">Todo</option>
        </Selector>
        <Buscador valor={f.q} onCambio={(v) => set('q', v)} placeholder="Buscar…" />
      </Tarjeta>
      <Tarjeta className="overflow-hidden">
        {cargando && !datos ? <Cargando /> : lista.length === 0 ? <Vacio icono={ShieldCheck} titulo="Sin registros" texto="No hay eventos con esos filtros." /> : (
          <div className="overflow-x-auto">
            <table className="tabla w-full">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
              <tbody>
                {lista.map((a) => {
                  const [tono, txt] = ACCIONES[a.accion] || ['gris', a.accion_display]
                  return (
                    <tr key={a.id} onClick={() => setSel(a)} className={cx('cursor-pointer', a.es_alerta && 'bg-peligro-50/30')}>
                      <td className="whitespace-nowrap">{fechaHora(a.fecha_hora)}<div className="text-xs text-tinta-4">{a.terminal}</div></td>
                      <td className="font-semibold">{a.usuario_nombre}</td>
                      <td><Insignia tono={tono}>{txt}</Insignia></td>
                      <td className="max-w-md truncate text-tinta-3">{a.detalle}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {datos && (datos.next || datos.previous) && (
          <div className="flex justify-end gap-2 px-4 py-3">
            <Boton tamano="sm" variante="secundario" disabled={!datos.previous} onClick={() => setPagina(pagina - 1)}>Anterior</Boton>
            <Boton tamano="sm" variante="secundario" disabled={!datos.next} onClick={() => setPagina(pagina + 1)}>Siguiente</Boton>
          </div>
        )}
      </Tarjeta>
      {sel && (
        <Panel abierto onCerrar={() => setSel(null)} titulo={(ACCIONES[sel.accion] || [, sel.accion_display])[1]} subtitulo={fechaHora(sel.fecha_hora)}>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-tinta-4">Usuario</dt><dd className="font-semibold">{sel.usuario_nombre}</dd></div>
            <div><dt className="text-tinta-4">Equipo</dt><dd className="font-semibold">{sel.terminal || '—'} {sel.ip_dispositivo ? `(${sel.ip_dispositivo})` : ''}</dd></div>
            <div><dt className="text-tinta-4">Detalle</dt><dd>{sel.detalle}</dd></div>
            {sel.valor_anterior && <div><dt className="text-tinta-4">Antes</dt><dd><pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(sel.valor_anterior, null, 2)}</pre></dd></div>}
            {sel.valor_nuevo && <div><dt className="text-tinta-4">Después</dt><dd><pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(sel.valor_nuevo, null, 2)}</pre></dd></div>}
          </dl>
        </Panel>
      )}
    </div>
  )
}
