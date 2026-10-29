import { Tags } from 'lucide-react'
import { EncabezadoPagina } from '../../components/ui'
import Categorias from './Categorias'

export default function PaginaCategorias() {
  return (
    <div>
      <EncabezadoPagina icono={Tags} titulo="Categorías"
        descripcion="Agrupa tus productos (Bebidas, Aseo, Fruver…), define colores, precio libre y si controlan inventario." />
      <Categorias />
    </div>
  )
}
