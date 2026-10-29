const fmtPesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmtNum = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export const pesos = (v) => fmtPesos.format(Math.round(Number(v || 0))).replace(/\s/g, '')
export const numero = (v) => fmtNum.format(Number(v || 0))

export const UNIDADES = {
  UNIDAD: 'und', KG: 'kg', LIBRA: 'lb', GRAMO: 'g', LITRO: 'L', PAQUETE: 'paq', CAJA: 'caja', BOTELLA: 'bot', BOLSA: 'bolsa',
}
export const cantidad = (v, unidad) => `${numero(v)} ${UNIDADES[unidad] || ''}`.trim()

export const fecha = (v) => (v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
export const fechaCorta = (v) => (v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '')
export const hora = (v) => (v ? new Date(v).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '')
export const fechaHora = (v) => (v ? `${fecha(v)} · ${hora(v)}` : '')

export const hoyISO = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
export const haceDiasISO = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

/** Convierte lo que el usuario escribe ("12.500", "12500", "12,5") en número. */
export const aNumero = (txt) => {
  if (typeof txt === 'number') return txt
  let s = String(txt || '').replace(/[$\s]/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export const iniciales = (nombre = '') =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

export const saludo = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export const descargar = (blob, nombre) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
