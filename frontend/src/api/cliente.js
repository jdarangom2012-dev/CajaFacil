import axios from 'axios'

const CLAVE_SESION = 'cf_sesion'
const CLAVE_TERMINAL = 'cf_terminal'

const leer = (k, def = null) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? def } catch { return def }
}
const guardar = (k, v) => {
  try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ }
}

export const sesion = {
  obtener: () => leer(CLAVE_SESION),
  guardar: (s) => guardar(CLAVE_SESION, s),
  limpiar: () => guardar(CLAVE_SESION, null),
}

export const terminal = {
  obtener: () => leer(CLAVE_TERMINAL, 'CAJA-1') || 'CAJA-1',
  guardar: (t) => guardar(CLAVE_TERMINAL, (t || 'CAJA-1').toUpperCase().replace(/[^\w\- ]/g, '').slice(0, 30)),
}

export const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.request.use((cfg) => {
  const s = sesion.obtener()
  if (s?.access) cfg.headers.Authorization = `Bearer ${s.access}`
  cfg.headers['X-Terminal'] = terminal.obtener()
  return cfg
})

let refrescando = null
const oyentesSalida = new Set()
export const alCerrarSesion = (fn) => { oyentesSalida.add(fn); return () => oyentesSalida.delete(fn) }

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    const s = sesion.obtener()
    if (error.response?.status === 401 && s?.refresh && !original._reintento && !original.url.includes('/auth/')) {
      original._reintento = true
      try {
        refrescando = refrescando || axios.post('/api/auth/refresh/', { refresh: s.refresh })
        const { data } = await refrescando
        sesion.guardar({ ...s, access: data.access, refresh: data.refresh || s.refresh })
        return api(original)
      } catch {
        sesion.limpiar()
        oyentesSalida.forEach((fn) => fn())
      } finally {
        refrescando = null
      }
    }
    return Promise.reject(error)
  },
)

/** Mensaje legible de un error de la API. */
export const mensajeError = (e, defecto = 'Ocurrió un error. Intenta de nuevo.') => {
  if (!e?.response) return 'No hay conexión con CajaFacil. Verifica que el servicio esté encendido.'
  const d = e.response.data
  if (d instanceof Blob) return defecto
  return d?.error || d?.detail || defecto
}

export const descargarArchivo = async (url, params, nombre) => {
  const { data } = await api.get(url, { params, responseType: 'blob' })
  const { descargar } = await import('../lib/formato')
  descargar(data, nombre)
}
