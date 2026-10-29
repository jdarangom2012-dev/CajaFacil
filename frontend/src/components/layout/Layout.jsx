import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Boxes, ChevronDown, HandCoins, KeyRound, LayoutDashboard, LogOut, Menu, Package, Receipt,
  Settings, ShieldCheck, ShoppingCart, Tags, Users, Wallet, X, Cloud, CloudOff, Monitor, LifeBuoy,
} from 'lucide-react'
import Logo from '../Logo'
import BotonTema from '../BotonTema'
import icono from '../../assets/icono-cajafacil.png'
import logoNautilus from '../../assets/logo-nautilustech.png'
import { useSesion } from '../../context/Sesion'
import { terminal } from '../../api/cliente'
import { cx, useClickFuera } from '../ui'
import { iniciales } from '../../lib/formato'
import CambiarClave from './CambiarClave'
import { BotonAyuda } from '../../ayuda/Ayuda'
import { useFacturacion } from '../../hooks/datos'

export const MENU = [
  { a: '/', etiqueta: 'Inicio', icono: LayoutDashboard },
  { a: '/vender', etiqueta: 'Vender', icono: ShoppingCart, destacado: true },
  { a: '/caja', etiqueta: 'Caja', icono: Wallet },
  { a: '/ventas', etiqueta: 'Ventas', icono: Receipt },
  { a: '/productos', etiqueta: 'Productos', icono: Package },
  { a: '/categorias', etiqueta: 'Categorías', icono: Tags },
  { a: '/inventario', etiqueta: 'Inventario', icono: Boxes, permiso: 'puedeInventario' },
  { a: '/fiado', etiqueta: 'Fiado', icono: HandCoins },
  { a: '/reportes', etiqueta: 'Reportes', icono: BarChart3, permiso: 'esGestion' },
  { a: '/auditoria', etiqueta: 'Auditoría', icono: ShieldCheck, permiso: 'esGestion' },
  { a: '/usuarios', etiqueta: 'Usuarios', icono: Users, permiso: 'esAdmin' },
  { a: '/configuracion', etiqueta: 'Configuración', icono: Settings, permiso: 'esAdmin' },
  { a: '/ayuda', etiqueta: 'Ayuda', icono: LifeBuoy },
]

function Navegacion({ onNavegar }) {
  const s = useSesion()
  const items = MENU.filter((m) => !m.permiso || s[m.permiso])
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ a, etiqueta, icono: Icono, destacado }) => (
        <NavLink
          key={a}
          data-ayuda={`menu.${a === '/' ? 'inicio' : a.slice(1)}`}
          to={a}
          end={a === '/'}
          onClick={onNavegar}
          className={({ isActive }) => cx(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition',
            isActive ? 'bg-marca-600 text-white shadow-marca' : 'text-tinta-3 hover:bg-slate-100 hover:text-tinta',
          )}
        >
          {({ isActive }) => (
            <>
              <Icono className={cx('h-5 w-5', !isActive && destacado && 'text-marca-600')} />
              <span className="flex-1">{etiqueta}</span>
              {destacado && !isActive && <span className="kbd">F3</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function EstadoCaja() {
  const { caja } = useSesion()
  if (!caja) return null
  return (
    <Link to="/caja" data-ayuda="menu.estado-caja" className={cx(
      'hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition',
      caja.abierta ? 'bg-exito-50 text-exito-700 hover:bg-exito-100' : 'bg-alerta-50 text-alerta-700 hover:bg-alerta-100',
    )}>
      <span className={cx('h-2 w-2 rounded-full', caja.abierta ? 'bg-exito-500 animate-pulse' : 'bg-alerta-500')} />
      {caja.abierta ? `Caja #${caja.numero} abierta` : 'Caja cerrada'}
    </Link>
  )
}

function MenuUsuario() {
  const { usuario, salir } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const [clave, setClave] = useState(false)
  const ref = useClickFuera(() => setAbierto(false))
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setAbierto(!abierto)} data-ayuda="menu.usuario" className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-slate-100">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-marca-500 to-[#0B57D0] text-sm font-bold text-white">
          {iniciales(usuario?.nombre_completo || usuario?.username)}
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-sm font-bold leading-tight">{usuario?.nombre_completo || usuario?.username}</span>
          <span className="block text-xs text-tinta-4 leading-tight">{usuario?.rol_display}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-tinta-4 md:block" />
      </button>
      {abierto && (
        <div className="absolute right-0 top-12 z-40 w-60 rounded-2xl border border-slate-200 bg-superficie p-1.5 shadow-flotante animate-aparecer">
          <div className="px-3 py-2 md:hidden">
            <p className="text-sm font-bold">{usuario?.nombre_completo}</p>
            <p className="text-xs text-tinta-4">{usuario?.rol_display}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-tinta-4"><Monitor className="h-4 w-4" /> Este equipo: <b className="text-tinta-2">{terminal.obtener()}</b></div>
          <button onClick={() => { setAbierto(false); setClave(true) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-100">
            <KeyRound className="h-4 w-4" /> Cambiar contraseña
          </button>
          <button onClick={salir} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-peligro-600 hover:bg-peligro-50">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      )}
      <CambiarClave abierto={clave} onCerrar={() => setClave(false)} />
    </div>
  )
}

function AvisoLicencia() {
  const { licencia, esAdmin } = useSesion()
  if (!licencia) return null
  const { estado, mensaje, dias_prueba_restantes: dias, nube_en_gracia } = licencia
  if (estado === 'ACTIVA' && !nube_en_gracia) return null
  if (estado === 'PRUEBA' && dias > 5) return null
  const grave = ['VENCIDA', 'INVALIDA', 'RELOJ'].includes(estado)
  return (
    <div className={cx('flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-semibold',
      grave ? 'bg-peligro-600 text-white' : 'bg-alerta-100 text-alerta-700')}>
      <span>{mensaje}</span>
      {esAdmin && <Link to="/configuracion?tab=licencia" className="underline underline-offset-2">Activar licencia</Link>}
    </div>
  )
}

function AvisoFacturacion() {
  const { esGestion, esAdmin } = useSesion()
  const fe = useFacturacion()
  const a = (fe.alertas || []).filter((x) => x.nivel !== 'info')
  if (!esGestion || !a.length) return null
  const grave = a.some((x) => x.nivel === 'grave')
  return (
    <div className={cx('flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-semibold',
      grave ? 'bg-peligro-600 text-white' : 'bg-alerta-100 text-alerta-700')}>
      <span>{a[0].mensaje}{a.length > 1 ? ` (+${a.length - 1} aviso${a.length > 2 ? 's' : ''})` : ''}</span>
      {esAdmin && <Link to="/configuracion?tab=facturacion" className="underline underline-offset-2">Ver facturación</Link>}
    </div>
  )
}

function AvisoActualizacion() {
  const { sistema, esAdmin } = useSesion()
  const act = sistema?.actualizacion
  if (!act || !esAdmin) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-marca-600 px-4 py-2 text-center text-sm font-semibold text-white">
      <span>Hay una versión nueva de CajaFácil ({act.version}).</span>
      {act.url && <a href={act.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">Descargar actualización</a>}
    </div>
  )
}

function NavInferior({ onMas }) {
  const items = ['/', '/vender', '/fiado', '/productos'].map((a) => MENU.find((m) => m.a === a))
  return (
    <nav className="no-imprimir fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-superficie/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid grid-cols-5">
        {items.map(({ a, etiqueta, icono: Icono, destacado }) => (
          <NavLink key={a} to={a} end={a === '/'} data-ayuda={`menu.${a === '/' ? 'inicio' : a.slice(1)}`} className={({ isActive }) => cx(
            'flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold',
            isActive ? 'text-marca-600' : 'text-tinta-4',
          )}>
            {destacado
              ? <span className="-mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-marca-600 text-white shadow-marca"><Icono className="h-6 w-6" /></span>
              : <Icono className="h-5 w-5" />}
            {etiqueta}
          </NavLink>
        ))}
        <button onClick={onMas} data-ayuda="menu.mas" className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-tinta-4">
          <Menu className="h-5 w-5" /> Más
        </button>
      </div>
    </nav>
  )
}

export default function Layout() {
  const [cajon, setCajon] = useState(false)
  const { negocio, licencia } = useSesion()
  const loc = useLocation()
  const nav = useNavigate()
  const pantallaCompleta = loc.pathname.startsWith('/vender')

  return (
    <div className="flex min-h-[100dvh]">
      {/* Barra lateral (escritorio) */}
      <aside className={cx('no-imprimir sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-slate-200 bg-superficie', pantallaCompleta ? 'xl:flex' : 'lg:flex')}>
        <button onClick={() => nav('/')} className="px-5 pt-5 pb-4"><Logo className="h-11 w-auto" /></button>
        <div className="flex-1 overflow-y-auto scroll-fino px-3"><Navegacion /></div>
        <div className="m-3 rounded-2xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-tinta-3">
            {licencia?.nube_activa ? <Cloud className="h-4 w-4 text-exito-600" /> : <CloudOff className="h-4 w-4 text-slate-400" />}
            {licencia?.nube_activa ? 'Respaldo en la nube activo' : 'Modo 100% local'}
          </div>
          <a href="https://nautilustech.app/" target="_blank" rel="noreferrer" title="Visitar nautilustech.app"
            className="-mx-1 mt-2 flex items-center gap-2 rounded-lg px-1 py-0.5 transition hover:bg-slate-100">
            <img src={logoNautilus} alt="" className="h-6 w-6 rounded-md" />
            <span className="text-[11px] leading-tight text-tinta-4">Desarrollado por<br /><b className="text-tinta-3">NautilusTech</b></span>
          </a>
        </div>
      </aside>

      {/* Cajón (móvil / tablet) */}
      {cajon && (
        <div className={cx('fixed inset-0 z-50', pantallaCompleta ? 'xl:hidden' : 'lg:hidden')}>
          <div className="absolute inset-0 bg-noche/40" onClick={() => setCajon(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-superficie shadow-flotante animate-entrar">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <Logo className="h-10 w-auto" />
              <button onClick={() => setCajon(false)} className="rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3"><Navegacion onNavegar={() => setCajon(false)} /></div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AvisoLicencia />
        <AvisoFacturacion />
        <AvisoActualizacion />
        <header className="no-imprimir sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-superficie/90 px-4 backdrop-blur lg:px-6">
          <button onClick={() => setCajon(true)} className={cx('rounded-xl p-2 hover:bg-slate-100', pantallaCompleta ? 'xl:hidden' : 'lg:hidden')}><Menu className="h-5 w-5" /></button>
          <img src={icono} alt="" className={cx('h-8 w-8', pantallaCompleta ? 'xl:hidden' : 'lg:hidden')} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold leading-tight">{negocio?.nombre_negocio}</p>
            <p className="hidden truncate text-xs text-tinta-4 sm:block">{new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <EstadoCaja />
          <BotonAyuda />
          <BotonTema />
          <MenuUsuario />
        </header>
        <main className={cx('flex-1', pantallaCompleta ? '' : 'px-4 py-5 pb-28 lg:px-8 lg:py-7 lg:pb-10')}>
          <div className={pantallaCompleta ? 'h-full' : 'mx-auto max-w-7xl animate-entrar'} key={loc.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
      {!pantallaCompleta && <NavInferior onMas={() => setCajon(true)} />}
    </div>
  )
}
