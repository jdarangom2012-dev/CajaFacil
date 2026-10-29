import axios from 'axios'

const CLAVE = 'cfn_sesion'

export function leerSesion() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || 'null') } catch { return null }
}
export function guardarSesion(s) {
  try { s ? localStorage.setItem(CLAVE, JSON.stringify(s)) : localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ }
}

export const api = axios.create({ baseURL: '/api/panel', timeout: 20000 })

api.interceptors.request.use((cfg) => {
  const s = leerSesion()
  if (s?.access) cfg.headers.Authorization = `Bearer ${s.access}`
  return cfg
})

let renovando = null
api.interceptors.response.use((r) => r, async (error) => {
  const cfg = error.config
  const s = leerSesion()
  if (error.response?.status === 401 && s?.refresh && !cfg._reintento && !cfg.url.includes('/login/')) {
    cfg._reintento = true
    try {
      renovando = renovando || axios.post('/api/panel/refresh/', { refresh: s.refresh })
      const { data } = await renovando
      guardarSesion({ ...s, access: data.access, refresh: data.refresh || s.refresh })
      return api(cfg)
    } catch {
      guardarSesion(null)
      window.dispatchEvent(new Event('cfn-salir'))
    } finally {
      renovando = null
    }
  }
  return Promise.reject(error)
})

export const mensajeError = (e) => {
  if (!e?.response) return 'Sin conexión a internet. Revisa los datos o el wifi.'
  return e.response.data?.error || 'Algo salió mal. Intenta de nuevo.'
}
