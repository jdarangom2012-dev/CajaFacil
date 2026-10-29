import { useState } from 'react'
import { api, mensajeError } from '../../api/cliente'
import { useAviso } from '../../context/Aviso'
import { Boton, Campo, Entrada, Modal } from '../ui'

export default function CambiarClave({ abierto, onCerrar }) {
  const aviso = useAviso()
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' })
  const [cargando, setCargando] = useState(false)
  const guardar = async () => {
    if (f.nueva.length < 4) return aviso.error('La nueva contraseña debe tener al menos 4 caracteres.')
    if (f.nueva !== f.repetir) return aviso.error('Las contraseñas no coinciden.')
    setCargando(true)
    try {
      await api.post('/auth/cambiar-password/', { actual: f.actual, nueva: f.nueva })
      aviso.exito('Contraseña actualizada')
      setF({ actual: '', nueva: '', repetir: '' })
      onCerrar()
    } catch (e) { aviso.error(mensajeError(e)) } finally { setCargando(false) }
  }
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Cambiar contraseña" ancho="sm"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} cargando={cargando}>Guardar</Boton></>}>
      <div className="space-y-3">
        <Campo etiqueta="Contraseña actual"><Entrada type="password" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} /></Campo>
        <Campo etiqueta="Nueva contraseña"><Entrada type="password" value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} /></Campo>
        <Campo etiqueta="Repite la nueva contraseña"><Entrada type="password" value={f.repetir} onChange={(e) => setF({ ...f, repetir: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}
