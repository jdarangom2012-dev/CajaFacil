import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, Check, ChevronDown, Home, Lock, LogOut, Menu as MenuIco, Package, Receipt, Settings, Store, Users } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { cx } from './ui'
import { haceCuanto } from '../lib/datos'
import logo from '../assets/logo-cajafacil.png'
import logoOscuro from '../assets/logo-cajafacil-oscuro.png'
import logoNautilus from '../assets/logo-nautilustech.png'

/* Barra de abajo en el celular */
const MENU_CELULAR = [
  { to: '/', icono: Home, texto: 'Inicio', fin: true },
  { to: '/ventas', icono: Receipt, texto: 'Ventas' },
  { to: '/fiados', icono: Users, texto: 'Fiados' },
  { to: '/inventario', icono: Package, texto: 'Inventario' },
  { to: '/mas', icono: MenuIco, texto: 'Más' },
]

/* Menú lateral en el computador: todo a la vista */
const MENU_PC = [
  { to: '/', icono: Home, texto: 'Inicio', fin: true },
  { to: '/ventas', icono: Receipt, texto: 'Ventas' },
  { to: '/cierres', icono: Lock, texto: 'Cierres de caja' },
  { to: '/fiados', icono: Users, texto: 'Fiados' },
  { to: '/inventario', icono: Package, texto: 'Inventario' },
  { to: '/reportes', icono: BarChart3, texto: 'Reportes' },
  { to: '/alertas', icono: Bell, texto: 'Alertas' },
  { to: '/mas', icono: Settings, texto: 'Mi cuenta' },
]

function SelectorTienda({ grande }) {
  const { tiendas, tienda, elegirTienda } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const nav = useNavigate()
  if (!tienda) return null
  const titulo = cx('truncate font-extrabold leading-tight', grande ? 'text-base' : 'text-[15px]')
  if (tiendas.length < 2) return <p className={titulo}>{tienda.nombre}</p>
  return (
    <div className="relative min-w-0">
      <button onClick={() => setAbierto(!abierto)} className="flex max-w-full items-center gap-1">
        <span className={titulo}>{tienda.nombre}</span><ChevronDown className="h-4 w-4 shrink-0 text-tinta-4" />
      </button>
      {abierto && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Cerrar" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-8 z-40 max-h-[60vh] w-72 overflow-auto rounded-2xl border border-slate-200 bg-superficie p-1.5 shadow-flotante animate-aparecer">
            {tiendas.map((t) => (
              <button key={t.id} onClick={() => { elegirTienda(t.id); setAbierto(false); nav('/') }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50">
                <Store className="h-4 w-4 text-marca-600" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{t.nombre}</span>
                {t.id === tienda.id && <Check className="h-4 w-4 text-marca-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Logo({ className }) {
  return (
    <>
      <img src={logo} alt="CajaFácil" className={cx('w-auto dark:hidden', className)} />
      <img src={logoOscuro} alt="CajaFácil" className={cx('hidden w-auto dark:block', className)} />
    </>
  )
}

export default function Layout() {
  const { tienda, sesion, salir } = useSesion()
  const loc = useLocation()
  return (
    <div className="min-h-dvh bg-fondo pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64">
      {/* Menú lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200/70 bg-superficie lg:flex">
        <div className="px-5 pb-4 pt-6"><Logo className="h-9" /></div>
        <div className="mx-3 rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-tinta-4">Tu tienda</p>
          <SelectorTienda grande />
          {tienda && <p className="mt-0.5 text-xs text-tinta-4">Actualizado {haceCuanto(tienda.ultima_sincronizacion)}</p>}
        </div>
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
          {MENU_PC.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.fin}
              className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-bold transition',
                isActive ? 'bg-marca-50 text-marca-700' : 'text-tinta-3 hover:bg-slate-100 hover:text-tinta')}>
              <m.icono className="h-5 w-5" /> {m.texto}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200/70 p-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marca-600 text-sm font-extrabold text-white">
              {(sesion?.nombre || '?').slice(0, 1).toUpperCase()}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-bold">{sesion?.nombre}</p>
            <button onClick={salir} title="Salir" className="grid h-9 w-9 place-items-center rounded-xl text-tinta-4 hover:bg-slate-100 hover:text-peligro-600"><LogOut className="h-4 w-4" /></button>
          </div>
          <a href="https://nautilustech.app/" target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-2 opacity-60 hover:opacity-100">
            <span className="text-[11px] text-tinta-4">Hecho por</span><img src={logoNautilus} alt="NautilusTech" className="h-4 w-auto" />
          </a>
        </div>
      </aside>

      {/* Encabezado (celular) */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-superficie/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Logo className="h-7" />
          <div className="ml-1 min-w-0 flex-1 border-l border-slate-200 pl-3">
            <SelectorTienda />
            {tienda && <p className="text-[11px] text-tinta-4">Actualizado {haceCuanto(tienda.ultima_sincronizacion)}</p>}
          </div>
        </div>
      </header>

      <main key={loc.pathname} className="mx-auto max-w-3xl px-4 pt-4 animate-entrar lg:max-w-[1600px] lg:px-8 2xl:px-12 lg:pb-10 lg:pt-8">
        <Outlet />
      </main>

      {/* Barra de abajo (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {MENU_CELULAR.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.fin}
              className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold',
                isActive ? 'text-marca-600' : 'text-tinta-4')}>
              <m.icono className="h-[22px] w-[22px]" /> {m.texto}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
