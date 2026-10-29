import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeCheck, Cloud, CloudOff, Copy, CreditCard, DatabaseBackup, Download, FileCheck2, HardDrive, KeyRound, Monitor, Plus,
  Printer, RefreshCw, Save, Scale, Settings, Store, Vault,
} from 'lucide-react'
import Facturacion from './Facturacion'
import { api, descargarArchivo, mensajeError, terminal } from '../../api/cliente'
import {
  AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Entrada, EntradaDinero, Insignia, Interruptor, Modal, Selector,
  Tarjeta, cx,
} from '../../components/ui'
import { useAviso } from '../../context/Aviso'
import { useSesion } from '../../context/Sesion'
import { invalidarConfig, useApi, useFacturacion } from '../../hooks/datos'
import { fecha, fechaHora, numero } from '../../lib/formato'
import { impresionLocal, setImpresionLocal } from '../../lib/impresion'

const SECCIONES = [
  { valor: 'negocio', etiqueta: 'Negocio', icono: Store },
  { valor: 'ventas', etiqueta: 'Ventas y fiado', icono: Settings },
  { valor: 'impresora', etiqueta: 'Impresora y cajón', icono: Printer },
  { valor: 'bascula', etiqueta: 'Báscula', icono: Scale },
  { valor: 'pagos', etiqueta: 'Formas de pago', icono: CreditCard },
  { valor: 'facturacion', etiqueta: 'Facturación electrónica', icono: FileCheck2, soloFE: true },
  { valor: 'respaldos', etiqueta: 'Respaldos', icono: DatabaseBackup },
  { valor: 'licencia', etiqueta: 'Licencia y nube', icono: KeyRound },
  { valor: 'equipo', etiqueta: 'Este equipo', icono: Monitor },
]

function useFormConfig() {
  const aviso = useAviso()
  const { cargarSistema } = useSesion()
  const { datos, setDatos } = useApi('/sistema/configuracion/')
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setDatos((d) => ({ ...d, [k]: v }))
  const guardar = async (campos) => {
    setGuardando(true)
    try {
      const datosEnviar = Object.fromEntries(campos.map((c) => [c, datos[c]]))
      const { data } = await api.patch('/sistema/configuracion/', datosEnviar)
      setDatos(data)
      invalidarConfig()
      cargarSistema()
      aviso.exito('Configuración guardada')
    } catch (e) { aviso.error(mensajeError(e)) } finally { setGuardando(false) }
  }
  return { c: datos, set, guardar, guardando }
}

const BotonGuardar = ({ onClick, cargando }) => <div className="mt-6 flex justify-end"><Boton icono={Save} onClick={onClick} cargando={cargando}>Guardar cambios</Boton></div>

function Negocio() {
  const { c, set, guardar, guardando } = useFormConfig()
  if (!c) return <Cargando />
  const campos = ['nombre_negocio', 'nit', 'regimen', 'direccion', 'ciudad', 'telefono', 'email', 'mensaje_ticket']
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre del negocio" className="sm:col-span-2"><Entrada value={c.nombre_negocio} onChange={(e) => set('nombre_negocio', e.target.value)} /></Campo>
        <Campo etiqueta="NIT o cédula"><Entrada value={c.nit} onChange={(e) => set('nit', e.target.value)} /></Campo>
        <Campo etiqueta="Régimen" ayuda="Aparece en el ticket."><Entrada value={c.regimen} onChange={(e) => set('regimen', e.target.value)} /></Campo>
        <Campo etiqueta="Dirección"><Entrada value={c.direccion} onChange={(e) => set('direccion', e.target.value)} /></Campo>
        <Campo etiqueta="Ciudad"><Entrada value={c.ciudad} onChange={(e) => set('ciudad', e.target.value)} /></Campo>
        <Campo etiqueta="Teléfono / WhatsApp"><Entrada value={c.telefono} onChange={(e) => set('telefono', e.target.value)} /></Campo>
        <Campo etiqueta="Correo"><Entrada value={c.email} onChange={(e) => set('email', e.target.value)} /></Campo>
        <Campo etiqueta="Mensaje al final del ticket" className="sm:col-span-2"><Entrada value={c.mensaje_ticket} onChange={(e) => set('mensaje_ticket', e.target.value)} /></Campo>
      </div>
      <BotonGuardar onClick={() => guardar(campos)} cargando={guardando} />
    </>
  )
}

function Ventas() {
  const { c, set, guardar, guardando } = useFormConfig()
  if (!c) return <Cargando />
  return (
    <>
      <div className="space-y-5">
        <Interruptor activo={c.vender_sin_stock} onCambio={(v) => set('vender_sin_stock', v)} etiqueta="Permitir vender aunque el sistema marque cero"
          descripcion="Recomendado mientras organizas el inventario. Si lo apagas, la caja no deja vender productos agotados." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Cupo de fiado por defecto" ayuda="Tope de deuda por cliente si no tiene un cupo propio. 0 = sin tope.">
            <EntradaDinero valor={c.tope_credito_defecto} onCambio={(v) => set('tope_credito_defecto', v)} />
          </Campo>
          <Campo etiqueta="Días para que un fiado se considere vencido" ayuda="0 = nunca vence.">
            <Entrada inputMode="numeric" value={c.dias_vencimiento_credito} onChange={(e) => set('dias_vencimiento_credito', e.target.value.replace(/\D/g, ''))} />
          </Campo>
        </div>
      </div>
      <BotonGuardar onClick={() => guardar(['vender_sin_stock', 'tope_credito_defecto', 'dias_vencimiento_credito'])} cargando={guardando} />
    </>
  )
}

function Impresora() {
  const aviso = useAviso()
  const { c, set, guardar, guardando } = useFormConfig()
  const { datos: hw, recargar } = useApi('/sistema/hardware/')
  const [probando, setProbando] = useState(false)
  if (!c) return <Cargando />
  const campos = ['impresora_tipo', 'impresora_destino', 'impresora_ancho', 'imprimir_automatico', 'abrir_cajon_efectivo']
  const probar = async (cajon) => {
    await guardar(campos)
    setProbando(true)
    try {
      const { data } = await api.post('/sistema/hardware/probar-impresora/', { cajon })
      if (data.ok) aviso.exito(cajon ? 'Prueba enviada y cajón abierto' : 'Prueba enviada a la impresora')
      else aviso.error(data.error || 'Este modo no imprime directo. Usa "Impresora instalada en Windows".')
    } catch (e) { aviso.error(mensajeError(e)) } finally { setProbando(false) }
  }
  const tipos = [
    ['WINDOWS', 'Impresora térmica instalada en Windows', 'Recomendado. Imprime sin preguntar y abre el cajón conectado a la impresora.'],
    ['RED', 'Impresora de red (WiFi / Ethernet)', 'Escribe la IP, por ejemplo 192.168.1.50:9100.'],
    ['SERIAL', 'Puerto COM / serial', 'Para impresoras antiguas, por ejemplo COM3.'],
    ['NAVEGADOR', 'Diálogo de impresión', 'Funciona con cualquier impresora, pero pregunta cada vez y no abre el cajón.'],
    ['NINGUNA', 'No imprimir tickets', ''],
  ]
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {tipos.map(([v, t, d]) => (
          <button key={v} onClick={() => set('impresora_tipo', v)} className={cx('rounded-2xl border-2 p-4 text-left transition', c.impresora_tipo === v ? 'border-marca-600 bg-marca-50' : 'border-slate-200 hover:border-slate-300')}>
            <p className="font-bold">{t}</p>{d && <p className="mt-0.5 text-xs text-tinta-4">{d}</p>}
          </button>
        ))}
      </div>
      {['WINDOWS', 'RED', 'SERIAL'].includes(c.impresora_tipo) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={c.impresora_tipo === 'WINDOWS' ? 'Impresora' : c.impresora_tipo === 'RED' ? 'IP:puerto' : 'Puerto'}>
            {c.impresora_tipo === 'WINDOWS' && hw?.impresoras?.length ? (
              <div className="flex gap-2">
                <Selector value={c.impresora_destino} onChange={(e) => set('impresora_destino', e.target.value)}>
                  <option value="">(Impresora predeterminada)</option>
                  {hw.impresoras.map((i) => <option key={i} value={i}>{i}</option>)}
                </Selector>
                <Boton variante="secundario" className="px-3" onClick={recargar}><RefreshCw className="h-4 w-4" /></Boton>
              </div>
            ) : c.impresora_tipo === 'SERIAL' && hw?.puertos?.length ? (
              <Selector value={c.impresora_destino} onChange={(e) => set('impresora_destino', e.target.value)}>
                <option value="">Selecciona…</option>
                {hw.puertos.map((p) => <option key={p.puerto} value={p.puerto}>{p.puerto} — {p.descripcion}</option>)}
              </Selector>
            ) : (
              <Entrada value={c.impresora_destino} onChange={(e) => set('impresora_destino', e.target.value)} placeholder={c.impresora_tipo === 'RED' ? '192.168.1.50:9100' : 'Nombre de la impresora'} />
            )}
          </Campo>
          <Campo etiqueta="Ancho del papel">
            <Selector value={c.impresora_ancho} onChange={(e) => set('impresora_ancho', Number(e.target.value))}><option value={80}>80 mm</option><option value={58}>58 mm</option></Selector>
          </Campo>
        </div>
      )}
      <div className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4">
        <Interruptor activo={c.imprimir_automatico} onCambio={(v) => set('imprimir_automatico', v)} etiqueta="Imprimir el ticket automáticamente al vender" />
        <Interruptor activo={c.abrir_cajon_efectivo} onCambio={(v) => set('abrir_cajon_efectivo', v)} etiqueta="Abrir el cajón monedero en pagos en efectivo" descripcion="El cajón debe estar conectado a la impresora (cable RJ11)." />
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" icono={Printer} onClick={() => probar(false)} cargando={probando}>Imprimir prueba</Boton>
        <Boton variante="secundario" icono={Vault} onClick={() => probar(true)} cargando={probando}>Probar cajón</Boton>
        <Boton icono={Save} onClick={() => guardar(campos)} cargando={guardando}>Guardar</Boton>
      </div>
    </>
  )
}

function Bascula() {
  const aviso = useAviso()
  const { c, set, guardar, guardando } = useFormConfig()
  const { datos: hw } = useApi('/sistema/hardware/')
  const [peso, setPeso] = useState(null)
  if (!c) return <Cargando />
  const campos = ['bascula_activa', 'bascula_puerto', 'bascula_baudios', 'bascula_comando']
  const probar = async () => {
    await guardar(campos)
    try { const { data } = await api.get('/sistema/hardware/bascula/'); setPeso(data.peso_kg) } catch (e) { aviso.error(mensajeError(e)) }
  }
  return (
    <>
      <Interruptor activo={c.bascula_activa} onCambio={(v) => set('bascula_activa', v)} etiqueta="Tengo báscula conectada al computador"
        descripcion="Al vender productos por peso aparecerá el botón “Leer peso de la báscula”." />
      {c.bascula_activa && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Puerto">
            {hw?.puertos?.length ? (
              <Selector value={c.bascula_puerto} onChange={(e) => set('bascula_puerto', e.target.value)}>
                <option value="">Selecciona…</option>
                {hw.puertos.map((p) => <option key={p.puerto} value={p.puerto}>{p.puerto} — {p.descripcion}</option>)}
              </Selector>
            ) : <Entrada value={c.bascula_puerto} onChange={(e) => set('bascula_puerto', e.target.value)} placeholder="COM4" />}
          </Campo>
          <Campo etiqueta="Velocidad (baudios)">
            <Selector value={c.bascula_baudios} onChange={(e) => set('bascula_baudios', Number(e.target.value))}>
              {[2400, 4800, 9600, 19200].map((b) => <option key={b} value={b}>{b}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Comando de lectura" ayuda="P, W, ENQ o vacío si envía el peso solo.">
            <Entrada value={c.bascula_comando} onChange={(e) => set('bascula_comando', e.target.value)} />
          </Campo>
        </div>
      )}
      {peso != null && <p className="mt-4 rounded-2xl bg-exito-50 p-4 text-center text-2xl font-extrabold text-exito-700">{numero(peso)} kg</p>}
      <div className="mt-6 flex justify-end gap-2">
        {c.bascula_activa && <Boton variante="secundario" icono={Scale} onClick={probar}>Leer peso de prueba</Boton>}
        <Boton icono={Save} onClick={() => guardar(campos)} cargando={guardando}>Guardar</Boton>
      </div>
    </>
  )
}

function FormasPago() {
  const aviso = useAviso()
  const { datos, recargar } = useApi('/ventas/formas-pago/')
  const [editar, setEditar] = useState(null)
  const guardar = async () => {
    try {
      if (editar.id) await api.patch(`/ventas/formas-pago/${editar.id}/`, editar)
      else await api.post('/ventas/formas-pago/', editar)
      setEditar(null); recargar(); aviso.exito('Forma de pago guardada')
    } catch (e) { aviso.error(mensajeError(e)) }
  }
  if (!datos) return <Cargando />
  return (
    <>
      <div className="space-y-2">
        {datos.map((f) => (
          <button key={f.id} onClick={() => setEditar(f)} className={cx('flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left hover:bg-slate-50', !f.activa && 'opacity-50')}>
            <span className="h-8 w-8 rounded-xl" style={{ background: f.color }} />
            <span className="flex-1"><b>{f.nombre}</b><span className="block text-xs text-tinta-4">{f.tipo_display}</span></span>
            {!f.activa && <Insignia tono="peligro">Inactiva</Insignia>}
            {f.requiere_referencia && <Insignia>Pide referencia</Insignia>}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end"><Boton icono={Plus} onClick={() => setEditar({ nombre: '', tipo: 'TRANSFERENCIA', color: '#1570EF', orden: 10, activa: true, requiere_referencia: false })}>Agregar</Boton></div>
      {editar && (
        <Modal abierto onCerrar={() => setEditar(null)} titulo={editar.id ? 'Editar forma de pago' : 'Nueva forma de pago'} ancho="sm"
          pie={<><Boton variante="secundario" onClick={() => setEditar(null)}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></>}>
          <div className="space-y-4">
            <Campo etiqueta="Nombre"><Entrada value={editar.nombre} onChange={(e) => setEditar({ ...editar, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Tipo" ayuda="El efectivo suma al cuadre del cajón; el crédito crea un fiado.">
              <Selector value={editar.tipo} onChange={(e) => setEditar({ ...editar, tipo: e.target.value })}>
                <option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia / billetera</option>
                <option value="TARJETA">Tarjeta</option><option value="CREDITO">Crédito (fiado)</option><option value="OTRO">Otro</option>
              </Selector>
            </Campo>
            <Campo etiqueta="Color"><input type="color" value={editar.color} onChange={(e) => setEditar({ ...editar, color: e.target.value })} className="h-11 w-20 rounded-xl border border-slate-300" /></Campo>
            <Interruptor activo={editar.requiere_referencia} onCambio={(v) => setEditar({ ...editar, requiere_referencia: v })} etiqueta="Pedir número de referencia" />
            <Interruptor activo={editar.activa} onCambio={(v) => setEditar({ ...editar, activa: v })} etiqueta="Activa en la caja" />
          </div>
        </Modal>
      )}
    </>
  )
}

function Respaldos() {
  const aviso = useAviso()
  const { datos, recargar } = useApi('/sistema/respaldos/')
  const { c, set, guardar, guardando } = useFormConfig()
  const [creando, setCreando] = useState(false)
  const crear = async () => {
    setCreando(true)
    try { await api.post('/sistema/respaldos/', {}, { timeout: 600000 }); aviso.exito('Respaldo creado'); recargar() }
    catch (e) { aviso.error(mensajeError(e)) } finally { setCreando(false) }
  }
  if (!datos || !c) return <Cargando />
  const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-exito-50 p-4"><p className="text-sm text-exito-700">Último respaldo</p><p className="text-lg font-extrabold">{datos.ultimo ? fechaHora(datos.ultimo) : 'Nunca'}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-tinta-4">Carpeta</p><p className="break-all text-sm font-semibold">{datos.carpeta}</p></div>
      </div>
      <p className="mb-4 text-sm text-tinta-3">CajaFacil hace un respaldo <b>automático cada día</b> y otro <b>en cada cierre de caja</b>. Para más seguridad, configura una copia en una memoria USB o disco externo.</p>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Campo etiqueta="Copia adicional (USB / disco externo)" ayuda="Ej: E:\RespaldosCajaFacil — si no está conectada, se omite sin error.">
          <Entrada value={c.respaldo_carpeta_extra} onChange={(e) => set('respaldo_carpeta_extra', e.target.value)} />
        </Campo>
        <Campo etiqueta="Conservar (días)"><Entrada inputMode="numeric" value={c.respaldo_dias_conservar} onChange={(e) => set('respaldo_dias_conservar', e.target.value.replace(/\D/g, ''))} /></Campo>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Boton variante="secundario" icono={Save} onClick={() => guardar(['respaldo_carpeta_extra', 'respaldo_dias_conservar'])} cargando={guardando}>Guardar</Boton>
        <Boton icono={HardDrive} onClick={crear} cargando={creando}>Respaldar ahora</Boton>
      </div>
      <Tarjeta className="mt-5 overflow-hidden">
        <table className="tabla w-full">
          <thead><tr><th>Fecha</th><th className="hidden sm:table-cell">Origen</th><th className="text-right">Tamaño</th><th></th></tr></thead>
          <tbody>
            {datos.respaldos.length === 0 && <tr><td colSpan={4} className="text-center text-tinta-4">Aún no hay respaldos</td></tr>}
            {datos.respaldos.map((r) => (
              <tr key={r.id}>
                <td>{fechaHora(r.creado)}{r.error && <p className="text-xs text-peligro-600">{r.error.slice(0, 80)}</p>}</td>
                <td className="hidden sm:table-cell"><Insignia>{{ AUTO: 'Automático', CIERRE: 'Cierre de caja', MANUAL: 'Manual' }[r.origen]}</Insignia>{r.subido_nube && <Insignia tono="exito" className="ml-1">En la nube</Insignia>}</td>
                <td className="text-right tabular-nums">{r.tamano ? mb(r.tamano) : '—'}</td>
                <td className="text-right">{r.existe && <Boton tamano="xs" variante="fantasma" icono={Download} onClick={() => descargarArchivo(`/sistema/respaldos/${r.id}/descargar/`, {}, r.nombre)}>Descargar</Boton>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </>
  )
}

function Licencia() {
  const aviso = useAviso()
  const { cargarSistema } = useSesion()
  const { datos: lic, recargar } = useApi('/sistema/licencia/')
  const { datos: nube, recargar: recargarNube } = useApi('/sistema/nube/')
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const activar = async () => {
    setCargando(true)
    try { await api.post('/sistema/licencia/', { licencia: texto }); aviso.exito('¡Licencia activada!'); setTexto(''); recargar(); recargarNube(); cargarSistema() }
    catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  const sincronizar = async () => {
    setSincronizando(true)
    try { const { data } = await api.post('/sistema/nube/'); aviso.info(data.error ? `Pendiente: ${data.error}` : `Sincronizados ${data.enviados} registros`); recargarNube() }
    catch (e) { aviso.error(mensajeError(e)) } finally { setSincronizando(false) }
  }
  if (!lic) return <Cargando />
  const tono = { ACTIVA: 'exito', PRUEBA: 'alerta', VENCIDA: 'peligro', INVALIDA: 'peligro', RELOJ: 'peligro' }[lic.estado]
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-marca-600" /><h4 className="font-extrabold">Licencia</h4><Insignia tono={tono} punto className="ml-auto">{lic.estado}</Insignia></div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-tinta-4">Plan</dt><dd className="font-bold">{lic.plan === 'NUBE' ? 'Local + Nube' : 'Básico (100% local)'}</dd></div>
            {lic.cliente && <div className="flex justify-between"><dt className="text-tinta-4">A nombre de</dt><dd className="font-semibold">{lic.cliente}</dd></div>}
            {lic.estado === 'PRUEBA' && <div className="flex justify-between"><dt className="text-tinta-4">Prueba</dt><dd className="font-semibold">{lic.dias_prueba_restantes} días restantes</dd></div>}
            {lic.vence && <div className="flex justify-between"><dt className="text-tinta-4">Vence</dt><dd>{fecha(lic.vence)}</dd></div>}
            <div className="flex justify-between"><dt className="text-tinta-4">Cajas permitidas</dt><dd>{lic.max_cajas}</dd></div>
          </dl>
          {lic.mensaje && <p className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-tinta-3">{lic.mensaje}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2">{lic.nube_activa ? <Cloud className="h-5 w-5 text-exito-600" /> : <CloudOff className="h-5 w-5 text-slate-400" />}<h4 className="font-extrabold">Nube</h4>
            <Insignia tono={lic.nube_activa ? 'exito' : 'gris'} className="ml-auto">{lic.nube_activa ? 'Activa' : 'Inactiva'}</Insignia></div>
          {lic.nube_activa ? (
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-tinta-4">Pagado hasta</dt><dd className="font-semibold">{nube?.pagado_hasta ? fecha(nube.pagado_hasta) : (lic.nube_hasta && lic.nube_hasta < '2090' ? fecha(lic.nube_hasta) : '—')}</dd></div>
              <div className="flex justify-between"><dt className="text-tinta-4">Última sincronización</dt><dd>{nube?.ultima_sincronizacion ? fechaHora(nube.ultima_sincronizacion) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-tinta-4">Pendientes por subir</dt><dd>{numero(nube?.pendientes)}</dd></div>
              {nube?.ultimo_error && <p className="rounded-xl bg-alerta-50 p-2.5 text-xs text-alerta-700">{nube.ultimo_error}</p>}
              <Boton tamano="sm" variante="suave" icono={RefreshCw} className="mt-2" onClick={sincronizar} cargando={sincronizando}>Sincronizar ahora</Boton>
              <p className="pt-2 text-xs text-tinta-3">Ve tu tienda desde el celular en <a href={nube?.panel || 'https://cajafacil.app'} target="_blank" rel="noreferrer" className="font-bold text-marca-600">{(nube?.panel || 'https://cajafacil.app').replace(/^https?:\/\//, '')}</a></p>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-tinta-3">La caja funciona 100% local. Con el <b>plan Nube</b> tienes respaldo fuera de la tienda, ves las ventas desde el celular, recibes alertas y usas el asistente con IA.</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl bg-slate-50 p-5">
        <p className="text-sm font-semibold">Código de este equipo</p>
        <p className="text-xs text-tinta-4">Envíalo a NautilusTech para generar tu licencia.</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="rounded-xl bg-superficie px-4 py-2.5 text-lg font-bold tracking-widest border border-slate-200">{lic.equipo_id}</code>
          <Boton variante="secundario" className="px-3" onClick={() => { navigator.clipboard?.writeText(lic.equipo_id); aviso.info('Código copiado') }}><Copy className="h-4 w-4" /></Boton>
        </div>
      </div>
      <Campo etiqueta="Pegar licencia" ayuda="Pega aquí el texto de la licencia que te enviamos por WhatsApp o correo.">
        <AreaTexto className="font-mono text-xs" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </Campo>
      <div className="flex justify-end"><Boton icono={KeyRound} onClick={activar} cargando={cargando} disabled={!texto.trim()}>Activar licencia</Boton></div>
    </div>
  )
}

function Equipo() {
  const aviso = useAviso()
  const { datos: info } = useApi('/sistema/info/')
  const [nombre, setNombre] = useState(terminal.obtener())
  const [local, setLocal] = useState(impresionLocal())
  const guardar = () => { terminal.guardar(nombre); setNombre(terminal.obtener()); aviso.exito('Nombre del equipo guardado. Recarga la página.'); setTimeout(() => window.location.reload(), 800) }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Campo etiqueta="Nombre de esta caja" ayuda="Cada computador o tablet que vende debe tener un nombre distinto (CAJA-1, CAJA-2…). Cada una abre y cierra su propia caja.">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} />
        </Campo>
        <Boton icono={Save} onClick={guardar}>Guardar</Boton>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4">
        <Interruptor activo={local} onCambio={(v) => { setImpresionLocal(v); setLocal(v); aviso.info('Preferencia de impresión guardada en este equipo') }}
          etiqueta="Imprimir con la impresora de ESTE equipo"
          descripcion="Actívalo en cajas secundarias (otro PC o tablet). El ticket se imprime en la impresora predeterminada de este equipo, sin usar la del PC principal." />
      </div>
      {info && (
        <div className="rounded-2xl border border-slate-200 p-5">
          <h4 className="mb-3 font-extrabold">Información del sistema</h4>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {[['Versión', `CajaFácil ${info.version}`], ['Base de datos', info.base_datos], ['Carpeta de datos', info.carpeta_datos],
              ['Modo', info.modo === 'principal' ? 'PC principal (servidor)' : 'Caja secundaria'], ['Código del equipo', info.equipo_id]].map(([k, v]) => (
              <div key={k}><dt className="text-tinta-4">{k}</dt><dd className="break-all font-semibold">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4 rounded-2xl bg-marca-50 p-4 text-sm">
            <p className="font-bold text-marca-800">¿Más cajas en la misma tienda?</p>
            <p className="mt-1 text-marca-900">Desde otro computador, tablet o celular conectado al mismo WiFi abre:</p>
            <code className="mt-2 block rounded-xl bg-superficie px-3 py-2 font-bold">http://{info.ip_local}:{info.puerto}</code>
            <p className="mt-1 text-xs text-marca-900">Para eso, el servicio debe escuchar en la red (host 0.0.0.0 en cajafacil.ini) y el firewall debe permitir el puerto.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Configuracion() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'negocio'
  const fe = useFacturacion()
  const secciones = SECCIONES.filter((s) => !s.soloFE || fe.disponible)
  const seccion = secciones.find((s) => s.valor === tab) || secciones[0]
  useEffect(() => { window.scrollTo(0, 0) }, [tab])
  const Comp = { negocio: Negocio, ventas: Ventas, impresora: Impresora, bascula: Bascula, pagos: FormasPago, facturacion: Facturacion, respaldos: Respaldos, licencia: Licencia, equipo: Equipo }[seccion.valor]
  return (
    <div>
      <EncabezadoPagina icono={Settings} titulo="Configuración" descripcion="Datos del negocio, impresora, báscula, respaldos y licencia." />
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <nav className="flex gap-1 overflow-x-auto scroll-fino lg:flex-col">
          {secciones.map(({ valor, etiqueta, icono: Icono }) => (
            <button key={valor} onClick={() => setParams({ tab: valor })}
              className={cx('flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                seccion.valor === valor ? 'bg-superficie text-marca-700 shadow-suave border border-slate-200' : 'text-tinta-3 hover:bg-superficie/70')}>
              <Icono className="h-4 w-4" /> {etiqueta}
            </button>
          ))}
        </nav>
        <Tarjeta className="p-5 sm:p-7">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-extrabold"><seccion.icono className="h-5 w-5 text-marca-600" />{seccion.etiqueta}</h2>
          <Comp />
        </Tarjeta>
      </div>
    </div>
  )
}
