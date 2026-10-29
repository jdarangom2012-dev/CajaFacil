import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { alCerrarSesion, api, sesion as almacen } from '../api/cliente'

const Ctx = createContext(null)

export function SesionProvider({ children }) {
  const [sistema, setSistema] = useState(null)       // /sistema/estado
  const [errorSistema, setErrorSistema] = useState(null)
  const [sesion, setSesion] = useState(() => almacen.obtener())
  const [caja, setCaja] = useState(null)

  const cargarSistema = useCallback(async () => {
    try {
      const { data } = await api.get('/sistema/estado/')
      setSistema(data)
      setErrorSistema(null)
      return data
    } catch (e) {
      setErrorSistema(e.response?.data?.error || 'No hay conexión con el servicio de CajaFacil.')
      return null
    }
  }, [])

  const cargarCaja = useCallback(async () => {
    if (!almacen.obtener()) return null
    try {
      const { data } = await api.get('/ventas/caja/')
      setCaja(data)
      return data
    } catch { return null }
  }, [])

  useEffect(() => { cargarSistema() }, [cargarSistema])
  useEffect(() => alCerrarSesion(() => { setSesion(null); setCaja(null) }), [])
  useEffect(() => { if (sesion) cargarCaja() }, [sesion, cargarCaja])

  const iniciar = useCallback((datos) => {
    almacen.guardar(datos)
    setSesion(datos)
  }, [])

  const salir = useCallback(async () => {
    try { await api.post('/auth/logout/') } catch { /* sin conexión */ }
    almacen.limpiar()
    setSesion(null)
    setCaja(null)
  }, [])

  const valor = useMemo(() => {
    const usuario = sesion?.usuario
    const rol = usuario?.rol
    return {
      sistema, errorSistema, cargarSistema,
      usuario, rol, iniciar, salir,
      actualizarUsuario: (u) => { const s = { ...almacen.obtener(), usuario: u }; almacen.guardar(s); setSesion(s) },
      esAdmin: rol === 'ADMIN',
      esGestion: rol === 'ADMIN' || rol === 'COORDINADOR',
      puedeInventario: ['ADMIN', 'COORDINADOR', 'ALMACENISTA'].includes(rol),
      licencia: sistema?.licencia,
      negocio: sistema?.negocio,
      caja, cargarCaja,
    }
  }, [sistema, errorSistema, cargarSistema, sesion, iniciar, salir, caja, cargarCaja])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export const useSesion = () => useContext(Ctx)
