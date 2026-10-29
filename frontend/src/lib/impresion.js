import { api } from '../api/cliente'
import { cantidad, pesos } from './formato'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

async function qrSvg(texto) {
  if (!texto) return ''
  try {
    const QR = (await import('qrcode')).default
    return await QR.toString(texto, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  } catch { return '' }
}

/** Ticket HTML para imprimir desde el navegador (modo "NAVEGADOR"). `qr` es el SVG del código QR (si hay). */
export function htmlTicket(venta, negocio, ancho = 80, qr = '') {
  const fe = venta.documento_electronico
  const w = ancho >= 80 ? '72mm' : '48mm'
  const filas = venta.detalle.map((d) => `
    <div class="p">${esc(d.nombre_producto)}</div>
    <div class="f"><span>&nbsp;&nbsp;${cantidad(d.cantidad, d.unidad_medida)} x ${pesos(d.precio_unit)}</span><span>${pesos(Number(d.precio_unit) * Number(d.cantidad))}</span></div>
    ${Number(d.descuento) ? `<div class="f"><span>&nbsp;&nbsp;Descuento</span><span>-${pesos(d.descuento)}</span></div>` : ''}`).join('')
  const pagos = venta.pagos.map((p) => `<div class="f"><span>${esc(p.forma_pago_nombre)}${p.referencia ? ` (${esc(p.referencia)})` : ''}</span><span>${pesos(Number(p.recibido) || p.monto)}</span></div>`).join('')
  const fecha = new Date(venta.creado).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
  return `
  <style>
    #zona-impresion .t{width:${w};font:12px/1.35 'Courier New',monospace;color:#000;padding:2mm}
    #zona-impresion .c{text-align:center} #zona-impresion .b{font-weight:700}
    #zona-impresion .g{font-size:16px;font-weight:700}
    #zona-impresion .f{display:flex;justify-content:space-between;gap:6px}
    #zona-impresion hr{border:0;border-top:1px dashed #000;margin:4px 0}
  </style>
  <div class="t">
    <div class="c g">${esc(negocio?.nombre_negocio)}</div>
    ${negocio?.nit ? `<div class="c">NIT/CC ${esc(negocio.nit)}</div>` : ''}
    ${negocio?.regimen ? `<div class="c">${esc(negocio.regimen)}</div>` : ''}
    ${negocio?.direccion ? `<div class="c">${esc(negocio.direccion)}${negocio.ciudad ? ' - ' + esc(negocio.ciudad) : ''}</div>` : ''}
    ${negocio?.telefono ? `<div class="c">Tel. ${esc(negocio.telefono)}</div>` : ''}
    <hr/>
    ${fe ? `<div class="c b">DOCUMENTO EQUIVALENTE<br/>ELECTRÓNICO POS</div><div class="c g">${esc(fe.numero)}</div>
      ${fe.resolucion ? `<div class="c">Res. DIAN No. ${esc(fe.resolucion)}</div>` : ''}
      ${fe.ambiente === 'PRUEBAS' ? '<div class="c b">*** PRUEBAS - SIN VALIDEZ FISCAL ***</div>' : ''}
      ${fe.adquirente ? `<div>Adquirente: ${esc(fe.adquirente)}</div>` : ''}<hr/>` : ''}
    <div class="f"><span class="b">Venta No. ${venta.numero}</span><span>${fecha}</span></div>
    <div>Atendió: ${esc(venta.usuario_nombre)}</div>
    ${venta.cliente_nombre ? `<div>Cliente: ${esc(venta.cliente_nombre)}</div>` : ''}
    ${venta.estado === 'ANULADA' ? '<div class="c b">*** VENTA ANULADA ***</div>' : ''}
    <hr/>${filas}<hr/>
    ${Number(venta.descuento) ? `<div class="f"><span>Subtotal</span><span>${pesos(venta.subtotal)}</span></div><div class="f"><span>Descuentos</span><span>-${pesos(venta.descuento)}</span></div>` : ''}
    <div class="f g"><span>TOTAL</span><span>${pesos(venta.total)}</span></div>
    ${pagos}
    ${Number(venta.cambio) ? `<div class="f b"><span>Cambio</span><span>${pesos(venta.cambio)}</span></div>` : ''}
    ${venta.credito_numero ? `<hr/><div>Fiado No. ${venta.credito_numero}</div><br/><div>Firma: ____________________</div>` : ''}
    <hr/>
    <div class="c">${esc(negocio?.mensaje_ticket || '')}</div>
    ${fe ? (fe.cude
    ? `<div class="c">CUDE:</div><div class="c" style="word-break:break-all;font-size:10px">${esc(fe.cude)}</div>${qr ? `<div class="c" style="margin:6px auto;width:30mm">${qr}</div>` : ''}`
    : '<div class="c">Documento pendiente de envío a la DIAN.</div>')
    : '<div class="c">Documento interno - no es factura electrónica</div>'}
  </div>`
}

export function imprimirHtml(html) {
  let zona = document.getElementById('zona-impresion')
  if (!zona) {
    zona = document.createElement('div')
    zona.id = 'zona-impresion'
    zona.style.position = 'fixed'
    zona.style.left = '-9999px'
    document.body.appendChild(zona)
  }
  zona.innerHTML = html
  setTimeout(() => {
    window.print()
    setTimeout(() => { zona.innerHTML = '' }, 500)
  }, 50)
}

/** En cajas secundarias (multicaja) se imprime con la impresora de ESE equipo, vía navegador. */
export const impresionLocal = () => {
  try { return localStorage.getItem('cf_impresion_local') === '1' } catch { return false }
}
export const setImpresionLocal = (v) => {
  try { v ? localStorage.setItem('cf_impresion_local', '1') : localStorage.removeItem('cf_impresion_local') } catch { /* */ }
}

/**
 * Imprime una venta según la configuración:
 * impresora directa (ESC/POS desde el servidor) o diálogo de impresión del navegador.
 */
export async function imprimirVenta(venta, conf, negocio, { abrirCajon = false, copia = false } = {}) {
  if (!conf || conf.impresora_tipo === 'NINGUNA') return { ok: false }
  if (conf.impresora_tipo === 'NAVEGADOR' || impresionLocal()) {
    const qr = await qrSvg(venta.documento_electronico?.qr || venta.documento_electronico?.cude)
    imprimirHtml(htmlTicket(venta, negocio, conf.impresora_ancho, qr))
    return { ok: true }
  }
  const { data } = await api.post(`/sistema/hardware/imprimir-venta/${venta.id}/`, { abrir_cajon: abrirCajon, copia })
  return data
}
