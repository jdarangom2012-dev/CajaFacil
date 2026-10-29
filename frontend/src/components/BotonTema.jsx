import { Moon, Sun } from 'lucide-react'
import { useTema } from '../lib/tema'
import { cx } from './ui'

export default function BotonTema({ className }) {
  const [tema, alternar] = useTema()
  const oscuro = tema === 'oscuro'
  return (
    <button type="button" data-ayuda="menu.tema" onClick={() => alternar()} title={oscuro ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      className={cx('grid h-10 w-10 place-items-center rounded-xl text-tinta-3 transition hover:bg-slate-100 hover:text-tinta', className)}>
      {oscuro ? <Sun className="h-5 w-5 text-alerta-500" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
