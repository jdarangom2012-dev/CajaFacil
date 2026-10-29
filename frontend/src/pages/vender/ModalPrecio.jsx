import { useEffect, useState } from 'react'
import { Plus, Scale } from 'lucide-react'
import { api, mensajeError } from '../../api/cliente'
import { Boton, Entrada, EntradaDinero, Modal, Pestanas } from '../../components/ui'
import { aNumero, numero, pesos, UNIDADES } from '../../lib/formato'

/**
 * Productos de precio libre (Fruver, carnes, granel):
 *  - "Por valor":   el cliente pide "$2.000 de tomate"
 *  - "Por cantidad": se pesa (báscula o manual) y se multiplica por el precio del día
 */
export default function ModalPrecio({ datos, conf, onCerrar, onAgregar }) {
  const p = datos?.producto
  const [modo, setModo] = useState('valor')
  const [valor, setValor] = useState(0)
  const [precio, setPrecio] = useState(0)
  const [cant, setCant] = useState('1')
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!p) return
    setPrecio(Number(p.precio_venta) || 0)
    setCant(String(datos.cantidad || 1))
    setValor(0)
    setError('')
    setModo(p.se_vende_por_peso ? 'cantidad' : 'valor')
  }, [p, datos])

  if (!p) return null
  const unidad = UNIDADES[p.unidad_medida] || 'und'
  const cantNum = aNumero(cant)
  const totalCantidad = cantNum * precio

  const leerBascula = async () => {
    setLeyendo(true)
    setError('')
    try {
      const { data } = await api.get('/sistema/hardware/bascula/')
      let peso = data.peso_kg
      if (p.unidad_medida === 'LIBRA') peso = peso / 0.453592
      if (p.unidad_medida === 'GRAMO') peso = peso * 1000
      setCant(String(Math.round(peso * 1000) / 1000))
    } catch (e) { setError(mensajeError(e)) } finally { setLeyendo(false) }
  }

  const agregar = () => {
    if (modo === 'valor') {
      if (valor <= 0) return setError('Escribe el valor a vender.')
      // Se registra como 1 unidad por el valor exacto que pidió el cliente (sin redondeos de peso).
      onAgregar({ ...p, se_vende_por_peso: false, unidad_medida: 'UNIDAD' }, 1, valor)
    } else {
      if (cantNum <= 0) return setError('Escribe la cantidad.')
      if (precio <= 0) return setError('Escribe el precio.')
      onAgregar(p, cantNum, precio)
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={p.nombre} descripcion={`${p.categoria_nombre} · precio libre`} ancho="sm"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton icono={Plus} onClick={agregar}>Agregar</Boton></>}>
      <Pestanas className="mb-4 w-full" valor={modo} onCambio={setModo} opciones={[
        { valor: 'valor', etiqueta: 'Por valor ($)' },
        { valor: 'cantidad', etiqueta: `Por ${p.se_vende_por_peso ? 'peso' : 'cantidad'}` },
      ]} />
      <form onSubmit={(e) => { e.preventDefault(); agregar() }}>
        {modo === 'valor' ? (
          <div className="space-y-3">
            <label className="block"><span className="etiqueta">¿Cuánto vende?</span>
              <EntradaDinero grande autoFocus valor={valor} onCambio={setValor} /></label>
            <div className="flex flex-wrap gap-2">
              {[1000, 2000, 3000, 5000, 10000].map((v) => (
                <button type="button" key={v} onClick={() => setValor(v)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold hover:bg-slate-200">{pesos(v)}</button>
              ))}
            </div>
            {p.se_vende_por_peso && precio > 0 && valor > 0 && (
              <p className="text-sm text-tinta-4">Equivale a <b>{numero(valor / precio)} {unidad}</b> a {pesos(precio)}/{unidad}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="etiqueta">Cantidad ({unidad})</span>
                <Entrada autoFocus inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value)} onFocus={(e) => e.target.select()} className="h-14 text-xl font-bold" /></label>
              <label className="block"><span className="etiqueta">Precio por {unidad}</span>
                <EntradaDinero valor={precio} onCambio={setPrecio} className="h-14 text-xl" /></label>
            </div>
            {conf?.bascula_activa && p.se_vende_por_peso && (
              <Boton type="button" variante="suave" icono={Scale} className="w-full" onClick={leerBascula} cargando={leyendo}>Leer peso de la báscula</Boton>
            )}
            <div className="flex items-center justify-between rounded-2xl bg-marca-50 px-4 py-3">
              <span className="text-sm font-semibold text-marca-800">Total</span>
              <span className="text-2xl font-extrabold tabular-nums text-marca-800">{pesos(totalCantidad)}</span>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-peligro-600">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
