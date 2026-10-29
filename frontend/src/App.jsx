import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { DatabaseZap, RefreshCw } from 'lucide-react'
import Layout from './components/layout/Layout'
import { Boton, Cargando } from './components/ui'
import { useSesion } from './context/Sesion'
import Bienvenida from './pages/Bienvenida'
import Login from './pages/Login'
import icono from './assets/icono-cajafacil.png'

const Inicio = lazy(() => import('./pages/Inicio'))
const Vender = lazy(() => import('./pages/vender/Vender'))
const Caja = lazy(() => import('./pages/Caja'))
const Ventas = lazy(() => import('./pages/Ventas'))
const Productos = lazy(() => import('./pages/productos/Productos'))
const PaginaCategorias = lazy(() => import('./pages/productos/PaginaCategorias'))
const Inventario = lazy(() => import('./pages/inventario/Inventario'))
const Fiado = lazy(() => import('./pages/fiado/Fiado'))
const Reportes = lazy(() => import('./pages/Reportes'))
const Auditoria = lazy(() => import('./pages/Auditoria'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Configuracion = lazy(() => import('./pages/configuracion/Configuracion'))
const Manual = lazy(() => import('./pages/Manual'))

function SinServicio({ error, reintentar }) {
  return (
    <div className="fondo-marca grid min-h-[100dvh] place-items-center p-6">
      <div className="tarjeta max-w-md p-8 text-center">
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-peligro-50 text-peligro-600"><DatabaseZap className="h-8 w-8" /></span>
        <h1 className="text-xl font-extrabold">No hay conexión con CajaFacil</h1>
        <p className="mt-2 text-sm text-tinta-3">{error}</p>
        <p className="mt-2 text-sm text-tinta-4">Verifica que los servicios <b>CajaFacil-DB</b> y <b>CajaFacil-App</b> estén iniciados. Si estás en una caja secundaria, revisa que el PC principal esté encendido.</p>
        <Boton className="mt-6" icono={RefreshCw} onClick={reintentar}>Reintentar</Boton>
      </div>
    </div>
  )
}

function Rutas() {
  const s = useSesion()
  const navegar = useNavigate()
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'F3') { e.preventDefault(); navegar('/vender') }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [navegar])

  const solo = (permiso, el) => (s[permiso] ? el : <Navigate to="/" replace />)
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="vender" element={<Vender />} />
          <Route path="caja" element={<Caja />} />
          <Route path="ventas" element={<Ventas />} />
          <Route path="productos" element={<Productos />} />
          <Route path="categorias" element={<PaginaCategorias />} />
          <Route path="inventario" element={solo('puedeInventario', <Inventario />)} />
          <Route path="fiado" element={<Fiado />} />
          <Route path="reportes" element={solo('esGestion', <Reportes />)} />
          <Route path="auditoria" element={solo('esGestion', <Auditoria />)} />
          <Route path="usuarios" element={solo('esAdmin', <Usuarios />)} />
          <Route path="configuracion" element={solo('esAdmin', <Configuracion />)} />
          <Route path="ayuda" element={<Manual />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const { sistema, errorSistema, cargarSistema, usuario } = useSesion()
  if (errorSistema && !sistema) return <SinServicio error={errorSistema} reintentar={cargarSistema} />
  if (!sistema) {
    return (
      <div className="fondo-marca grid min-h-[100dvh] place-items-center">
        <img src={icono} alt="" className="h-20 w-20 animate-pulse" />
      </div>
    )
  }
  if (!sistema.configurado) return <Bienvenida />
  if (!usuario) return <Login />
  return <Rutas />
}
