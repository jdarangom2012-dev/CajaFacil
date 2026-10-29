import { Navigate, Route, Routes } from 'react-router-dom'
import { Store } from 'lucide-react'
import { useSesion } from './lib/sesion'
import Layout from './componentes/Layout'
import { Tarjeta, Vacio } from './componentes/ui'
import Entrar from './paginas/Entrar'
import Inicio from './paginas/Inicio'
import Ventas, { VentaDetalle } from './paginas/Ventas'
import Cierres from './paginas/Cierres'
import Fiados, { FiadoCliente } from './paginas/Fiados'
import Inventario from './paginas/Inventario'
import Alertas from './paginas/Alertas'
import Reportes from './paginas/Reportes'
import Mas from './paginas/Mas'

function SinTiendas() {
  const { salir } = useSesion()
  return (
    <div className="mx-auto max-w-md p-6">
      <Tarjeta><Vacio icono={Store} titulo="No tienes tiendas asignadas" texto="Escríbenos por WhatsApp para activarte la nube.">
        <button onClick={salir} className="mt-4 text-sm font-bold text-marca-600">Salir</button>
      </Vacio></Tarjeta>
    </div>
  )
}

export default function App() {
  const { sesion, tienda } = useSesion()
  if (!sesion?.access) return <Entrar />
  if (!tienda) return <SinTiendas />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="ventas/:id" element={<VentaDetalle />} />
        <Route path="cierres" element={<Cierres />} />
        <Route path="fiados" element={<Fiados />} />
        <Route path="fiados/:id" element={<FiadoCliente />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="alertas" element={<Alertas />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="mas" element={<Mas />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
