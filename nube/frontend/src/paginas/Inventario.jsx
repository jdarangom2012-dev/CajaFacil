import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Package, Search } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { useDatos } from '../lib/datos'
import { numero, pesos } from '../lib/formato'
import { Encabezado, Estado } from '../componentes/Pagina'
import { Segmentos, Tarjeta, Vacio, cx } from '../componentes/ui'

const UNIDADES = { UNIDAD: 'und', KG: 'kg', LIBRA: 'lb', GRAMO: 'g', LITRO: 'L', PAQUETE: 'paq', CAJA: 'caja', BOTELLA: 'bot', BOLSA: 'bolsa', UND: 'und' }

export default function Inventario() {
  const { tienda } = useSesion()
  const [params, setParams] = useSearchParams()
  const filtro = params.get('filtro') || 'todos'
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => { const t = setTimeout(() => setQ(texto.trim()), 350); return () => clearTimeout(t) }, [texto])
  const datos = useDatos(tienda && `/t/${tienda.id}/inventario/`, { params: { filtro, q } })

  return (
    <>
      <Encabezado titulo="Inventario" subtitulo="Lo que hay en la tienda ahora" />
      <div className="lg:flex lg:items-center lg:gap-4">
      <div className="relative lg:w-96">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="campo pl-10" placeholder="Buscar producto o código" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className="mt-3 lg:mt-0 lg:w-[30rem]">
        <Segmentos valor={filtro} onCambio={(v) => setParams(v === 'todos' ? {} : { filtro: v }, { replace: true })} opciones={[
          { valor: 'todos', etiqueta: 'Todos', conteo: datos.datos?.conteo.todos },
          { valor: 'bajo', etiqueta: 'Por acabarse', conteo: datos.datos?.conteo.bajo },
          { valor: 'agotado', etiqueta: 'Agotados', conteo: datos.datos?.conteo.agotado },
        ]} />
      </div>
      </div>
      <div className="mt-3 lg:mt-5">
        <Estado q={datos}>
          {(d) => (
            <>
              {filtro === 'todos' && !q && (
                <p className="mb-2 px-1 text-sm text-tinta-4">Mercancía en la tienda (a precio de costo): <b className="text-tinta-2">{pesos(d.valor_inventario)}</b></p>
              )}
              {d.productos.length > 0 && (
                <Tarjeta className="hidden overflow-hidden lg:block">
                  <table className="tabla w-full">
                    <thead><tr><th>Producto</th><th>Categoría</th><th>Código</th><th className="text-right">Precio</th><th className="text-right">Costo</th><th className="text-right">Mínimo</th><th className="text-right">Hay</th></tr></thead>
                    <tbody>
                      {d.productos.map((p) => {
                        const agotado = p.stock <= 0
                        const bajo = !agotado && p.stock_minimo > 0 && p.stock <= p.stock_minimo
                        return (
                          <tr key={p.id}>
                            <td className="font-semibold">{p.nombre}</td>
                            <td>{p.categoria || '—'}</td>
                            <td className="text-tinta-4">{p.codigo_barras || '—'}</td>
                            <td className="text-right tabular-nums">{pesos(p.precio_venta)}</td>
                            <td className="text-right tabular-nums text-tinta-3">{pesos(p.precio_costo)}</td>
                            <td className="text-right tabular-nums text-tinta-3">{p.stock_minimo > 0 ? numero(p.stock_minimo) : '—'}</td>
                            <td className={cx('text-right font-extrabold tabular-nums', agotado ? 'text-peligro-600' : bajo ? 'text-alerta-600' : '')}>
                              {numero(p.stock)} <span className="text-xs font-semibold text-tinta-4">{UNIDADES[p.unidad] || p.unidad?.toLowerCase()}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Tarjeta>
              )}
              <Tarjeta className={cx('divide-y divide-slate-100', d.productos.length && 'lg:hidden')}>
                {d.productos.length === 0 && (
                  <Vacio icono={Package} titulo={filtro === 'todos' ? 'No hay productos' : '¡Todo bien!'}
                    texto={filtro === 'bajo' ? 'No hay productos por acabarse.' : filtro === 'agotado' ? 'No hay productos agotados.' : 'Prueba con otra búsqueda.'} />
                )}
                {d.productos.map((p) => {
                  const agotado = p.stock <= 0
                  const bajo = !agotado && p.stock_minimo > 0 && p.stock <= p.stock_minimo
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.nombre}</p>
                        <p className="truncate text-xs text-tinta-4">{p.categoria || 'Sin categoría'} · {pesos(p.precio_venta)}</p>
                      </div>
                      <div className="text-right">
                        <p className={cx('font-extrabold tabular-nums', agotado ? 'text-peligro-600' : bajo ? 'text-alerta-600' : '')}>
                          {numero(p.stock)} <span className="text-xs font-semibold text-tinta-4">{UNIDADES[p.unidad] || p.unidad?.toLowerCase()}</span>
                        </p>
                        {p.stock_minimo > 0 && <p className="text-[11px] text-tinta-4">mínimo {numero(p.stock_minimo)}</p>}
                      </div>
                    </div>
                  )
                })}
              </Tarjeta>
            </>
          )}
        </Estado>
      </div>
    </>
  )
}
