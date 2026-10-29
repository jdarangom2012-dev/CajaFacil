import { useEffect, useState } from 'react'
import { Check, Phone, UserPlus, UserRound } from 'lucide-react'
import { api, mensajeError } from '../api/cliente'
import { useAviso } from '../context/Aviso'
import { pesos } from '../lib/formato'
import { Boton, Buscador, Entrada, cx, useDebounce } from './ui'

/** Busca un cliente de fiado o lo crea en el momento. */
export default function SelectorCliente({ valor, onCambio }) {
  const aviso = useAviso()
  const [q, setQ] = useState('')
  const qd = useDebounce(q)
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    api.get('/fiado/clientes/', { params: { q: qd, page_size: 8, orden: qd ? 'nombre' : 'saldo' } })
      .then(({ data }) => vivo && setLista(data.results || data))
      .catch(() => {})
    return () => { vivo = false }
  }, [qd])

  const crear = async () => {
    setGuardando(true)
    try {
      const { data } = await api.post('/fiado/clientes/', nuevo)
      onCambio(data)
      setNuevo(null)
      aviso.exito(`Cliente ${data.nombre} creado`)
    } catch (e) { aviso.error(mensajeError(e)) } finally { setGuardando(false) }
  }

  if (valor) {
    const disponible = Number(valor.cupo_efectivo || 0) - Number(valor.saldo || 0)
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-marca-500 bg-marca-50/50 p-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-marca-600 text-white"><UserRound className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{valor.nombre}</p>
          <p className="text-xs text-tinta-4">Debe {pesos(valor.saldo)} · {Number(valor.cupo_efectivo) ? `disponible ${pesos(Math.max(disponible, 0))}` : 'sin tope'}</p>
        </div>
        <Boton tamano="sm" variante="secundario" onClick={() => onCambio(null)}>Cambiar</Boton>
      </div>
    )
  }

  if (nuevo) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
        <Entrada autoFocus placeholder="Nombre del cliente" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Entrada icono={Phone} placeholder="Celular (para cobrar por WhatsApp)" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
        <div className="flex justify-end gap-2">
          <Boton tamano="sm" variante="fantasma" onClick={() => setNuevo(null)}>Cancelar</Boton>
          <Boton tamano="sm" icono={Check} onClick={crear} cargando={guardando} disabled={nuevo.nombre.trim().length < 2}>Crear cliente</Boton>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Buscador className="flex-1" valor={q} onCambio={setQ} placeholder="Buscar cliente…" />
        <Boton variante="suave" icono={UserPlus} onClick={() => setNuevo({ nombre: q, telefono: '' })}>Nuevo</Boton>
      </div>
      <div className="max-h-48 overflow-y-auto scroll-fino rounded-2xl border border-slate-200">
        {lista.length === 0 && <p className="p-4 text-center text-sm text-tinta-4">Sin resultados. Crea el cliente con “Nuevo”.</p>}
        {lista.map((c) => (
          <button key={c.id} onClick={() => onCambio(c)} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-marca-50">
            <UserRound className="h-4 w-4 text-tinta-4" />
            <span className="flex-1 truncate text-sm font-semibold">{c.nombre}</span>
            <span className={cx('text-xs font-bold', Number(c.saldo) > 0 ? 'text-alerta-700' : 'text-tinta-4')}>{Number(c.saldo) > 0 ? `Debe ${pesos(c.saldo)}` : 'Al día'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
