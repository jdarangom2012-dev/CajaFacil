import claro from '../assets/logo-cajafacil.png'
import oscuro from '../assets/logo-cajafacil-oscuro.png'
import { cx } from './ui'

/** Logo de CajaFácil que se adapta al modo día / noche. */
export default function Logo({ className }) {
  return (
    <>
      <img src={claro} alt="CajaFácil" className={cx(className, 'dark:hidden')} />
      <img src={oscuro} alt="CajaFácil" className={cx(className, 'hidden dark:block')} />
    </>
  )
}
