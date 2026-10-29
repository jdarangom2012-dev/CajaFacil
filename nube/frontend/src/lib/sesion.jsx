import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, guardarSesion, leerSesion } from './api'

const Ctx = createContext(null)
const CLAVE_TIENDA = 'cfn_tienda'

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(leerSesion)
  const [tiendaId, setTiendaId] = useState(() => { try { return Number(localStorage.getItem(CLAVE_TIENDA)) || null } catch { return null } })

  const salir = useCallback(() => { guardarSesion(null); setSesion(null) }, [])
  useEffect(() => {
    window.addEventListener('cfn-salir', salir)
    return () => window.removeEventListener('cfn-salir', salir)
  }, [salir])

  // Al abrir, refresca la lista de tiendas y el estado de la suscripción
  useEffect(() => {
    if (!sesion?.access) return
    api.get('/yo/').then(({ data }) => {
      const s = { ...leerSesion(), ...data }
      guardarSesion(s)
      setSesion(s)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const entrar = useCallback(async (usuario, clave) => {
    const { data } = await api.post('/login/', { usuario, clave })
    guardarSesion(data)
    setSesion(data)
  }, [])

  const elegirTienda = useCallback((id) => {
    setTiendaId(id)
    try { localStorage.setItem(CLAVE_TIENDA, String(id)) } catch { /* sin almacenamiento */ }
  }, [])

  const tiendas = sesion?.tiendas || []
  const tienda = tiendas.find((t) => t.id === tiendaId) || tiendas[0] || null

  const valor = useMemo(() => ({ sesion, tiendas, tienda, entrar, salir, elegirTienda }),
    [sesion, tiendas, tienda, entrar, salir, elegirTienda])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export const useSesion = () => useContext(Ctx)
