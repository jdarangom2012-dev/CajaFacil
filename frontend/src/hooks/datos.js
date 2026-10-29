import { useCallback, useEffect, useRef, useState } from 'react'
import { api, mensajeError } from '../api/cliente'

let cacheConfig = null
export const invalidarConfig = () => { cacheConfig = null }

export function useConfiguracion() {
  const [conf, setConf] = useState(cacheConfig)
  useEffect(() => {
    if (cacheConfig) return
    api.get('/sistema/configuracion/').then(({ data }) => { cacheConfig = data; setConf(data) }).catch(() => {})
  }, [])
  return conf
}

let cacheFormas = null
export function useFormasPago() {
  const [formas, setFormas] = useState(cacheFormas || [])
  useEffect(() => {
    api.get('/ventas/formas-pago/', { params: { activas: 1 } }).then(({ data }) => { cacheFormas = data; setFormas(data) }).catch(() => {})
  }, [])
  return formas
}

/** GET con estado de carga y recarga. `params` se compara por JSON. */
export function useApi(url, params, { activo = true } = {}) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const clave = JSON.stringify(params || {})
  const ultima = useRef(0)

  const cargar = useCallback(async () => {
    if (!url || !activo) return
    const id = ++ultima.current
    setCargando(true)
    try {
      const { data } = await api.get(url, { params: JSON.parse(clave) })
      if (id === ultima.current) { setDatos(data); setError(null) }
    } catch (e) {
      if (id === ultima.current) setError(mensajeError(e))
    } finally {
      if (id === ultima.current) setCargando(false)
    }
  }, [url, clave, activo])

  useEffect(() => { cargar() }, [cargar])
  return { datos, cargando, error, recargar: cargar, setDatos }
}

/* ── Facturación electrónica: estado compartido (si el módulo existe, si está activo y sus avisos) ── */
let cacheFE = null
let relojFE = null
const oyentesFE = new Set()
export async function refrescarFacturacion() {
  try {
    const { data } = await api.get('/facturacion/estado/')
    cacheFE = data
  } catch { cacheFE = cacheFE || { disponible: false, activa: false, alertas: [] } }
  oyentesFE.forEach((f) => f(cacheFE))
  return cacheFE
}
export function useFacturacion() {
  const [fe, setFe] = useState(cacheFE)
  useEffect(() => {
    oyentesFE.add(setFe)
    if (!cacheFE) refrescarFacturacion()
    if (!relojFE) relojFE = setInterval(refrescarFacturacion, 120000)
    return () => { oyentesFE.delete(setFe) }
  }, [])
  return fe || { disponible: false, activa: false, alertas: [] }
}
