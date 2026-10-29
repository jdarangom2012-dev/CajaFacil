import { useCallback, useEffect, useRef, useState } from 'react'
import { api, mensajeError } from './api'

/** Trae datos de la API y los vuelve a pedir cada `cadaSeg` segundos (si la pestaña está visible). */
export function useDatos(url, { params, cadaSeg = 0 } = {}) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: '', codigo: 0 })
  const clave = url ? url + JSON.stringify(params || {}) : null
  const actual = useRef(clave)
  actual.current = clave

  const cargar = useCallback(async (silencioso = false) => {
    if (!url) return
    if (!silencioso) setEstado((s) => ({ ...s, cargando: true, error: '' }))
    try {
      const { data } = await api.get(url, { params })
      if (actual.current === clave) setEstado({ datos: data, cargando: false, error: '', codigo: 200 })
    } catch (e) {
      if (actual.current === clave) setEstado((s) => ({ ...s, cargando: false, error: mensajeError(e), codigo: e.response?.status || 0 }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  useEffect(() => { setEstado({ datos: null, cargando: true, error: '', codigo: 0 }); cargar() }, [cargar])
  useEffect(() => {
    if (!cadaSeg) return
    const id = setInterval(() => { if (document.visibilityState === 'visible') cargar(true) }, cadaSeg * 1000)
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(true) }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', alVolver) }
  }, [cargar, cadaSeg])

  return { ...estado, recargar: () => cargar(true) }
}

/** "hace 5 min", "hace 2 h", "ayer"... */
export function haceCuanto(v) {
  if (!v) return 'nunca'
  const min = Math.round((Date.now() - new Date(v).getTime()) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}
