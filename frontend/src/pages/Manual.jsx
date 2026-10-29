import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpen, Keyboard, LifeBuoy, MessageCircle, MousePointerClick, Printer, Wrench } from 'lucide-react'
import { Boton, Buscador, EncabezadoPagina, Tarjeta, Vacio, cx } from '../components/ui'
import { useSesion } from '../context/Sesion'
import { ATAJOS, PROBLEMAS, SECCIONES, SOPORTE, normalizar } from '../ayuda/manual'
import { ContenidoSeccion, IconoSeccion } from '../ayuda/Contenido'
import { useAyuda } from '../ayuda/Ayuda'
import { useFacturacion } from '../hooks/datos'

const PERMISO = { inventario: 'puedeInventario', reportes: 'esGestion', auditoria: 'esGestion', usuarios: 'esAdmin', configuracion: 'esAdmin' }

const textoSeccion = (s) => normalizar([
  s.titulo, s.resumen, ...(s.consejos || []),
  ...(s.tareas || []).flatMap((t) => [t.titulo, ...t.pasos]),
  ...s.elementos.flatMap((e) => [e.titulo, e.texto]),
].join(' '))

function imprimir() {
  const html = document.documentElement
  html.classList.add('imprimir-manual')
  const fin = () => { html.classList.remove('imprimir-manual'); window.removeEventListener('afterprint', fin) }
  window.addEventListener('afterprint', fin)
  setTimeout(() => window.print(), 50)
}

export default function Manual() {
  const sesion = useSesion()
  const ayuda = useAyuda()
  const fe = useFacturacion()
  const loc = useLocation()
  const [q, setQ] = useState('')

  const secciones = useMemo(() => SECCIONES.filter((s) => (!PERMISO[s.id] || sesion[PERMISO[s.id]]) && (s.id !== 'facturacion' || fe.disponible)), [sesion, fe.disponible])
  const filtradas = useMemo(() => {
    const t = normalizar(q)
    if (!t) return secciones
    const palabras = t.split(' ')
    return secciones.filter((s) => { const x = textoSeccion(s); return palabras.every((p) => x.includes(p)) })
  }, [q, secciones])
  const problemas = useMemo(() => {
    const t = normalizar(q)
    return t ? PROBLEMAS.filter((p) => normalizar(p.p + ' ' + p.s).includes(t)) : PROBLEMAS
  }, [q])

  useEffect(() => {
    const id = loc.hash.slice(1)
    if (!id) return
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
    return () => clearTimeout(t)
  }, [loc.hash])

  return (
    <div className="manual">
      <EncabezadoPagina titulo="Ayuda y manual" icono={BookOpen}
        descripcion="Todo lo que necesitas saber para usar CajaFácil, explicado paso a paso."
        acciones={<Boton variante="secundario" icono={Printer} onClick={imprimir} className="no-imprimir">Imprimir manual</Boton>} />

      <div className="no-imprimir mb-6 grid gap-3 md:grid-cols-3">
        <Tarjeta className="flex gap-3 p-4">
          <span className="kbd h-fit text-base">F1</span>
          <p className="text-sm text-tinta-3"><b className="block text-tinta">¿No sabes qué hace un botón?</b>Pon el mouse encima y presiona <b>F1</b>.</p>
        </Tarjeta>
        <button onClick={ayuda.activarModo} className="tarjeta flex gap-3 p-4 text-left hover:border-marca-300">
          <MousePointerClick className="h-6 w-6 shrink-0 text-marca-600" />
          <p className="text-sm text-tinta-3"><b className="block text-tinta">Modo ayuda</b>Toca aquí y luego toca cualquier opción de la pantalla.</p>
        </button>
        <a href={`https://wa.me/${SOPORTE.whatsapp}?text=${encodeURIComponent('Hola, necesito ayuda con CajaFácil')}`} target="_blank" rel="noreferrer"
          className="tarjeta flex gap-3 p-4 hover:border-exito-300">
          <MessageCircle className="h-6 w-6 shrink-0 text-exito-600" />
          <p className="text-sm text-tinta-3"><b className="block text-tinta">Soporte por WhatsApp</b>{SOPORTE.whatsappTexto}</p>
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="no-imprimir lg:sticky lg:top-24 lg:h-fit">
          <Buscador valor={q} onCambio={setQ} placeholder="¿Qué necesitas? Ej: fiar, cerrar caja" />
          <nav className="mt-3 hidden flex-col gap-0.5 lg:flex">
            {filtradas.map((s) => (
              <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }) }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-tinta-3 hover:bg-slate-100 hover:text-tinta">
                <IconoSeccion nombre={s.icono} className="h-4 w-4 text-marca-600" /> {s.titulo}
              </a>
            ))}
            <a href="#atajos" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-tinta-3 hover:bg-slate-100"><Keyboard className="h-4 w-4 text-marca-600" /> Teclas rápidas</a>
            <a href="#problemas" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-tinta-3 hover:bg-slate-100"><Wrench className="h-4 w-4 text-marca-600" /> Problemas frecuentes</a>
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          {filtradas.length === 0 && problemas.length === 0 && (
            <Tarjeta><Vacio icono={LifeBuoy} titulo="No encontramos eso" texto="Prueba con otra palabra, o escríbenos por WhatsApp y te ayudamos." /></Tarjeta>
          )}
          {filtradas.map((s, i) => (
            <Tarjeta key={s.id} id={s.id} className="scroll-mt-24 p-5 sm:p-7 [break-inside:avoid-page]">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-marca-50 text-marca-600"><IconoSeccion nombre={s.icono} className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-tinta-4">Capítulo {i + 1}</p>
                  <h2 className="text-xl font-extrabold tracking-tight">{s.titulo}</h2>
                </div>
              </div>
              <ContenidoSeccion seccion={s} />
            </Tarjeta>
          ))}

          {!q && (
            <Tarjeta id="atajos" className="scroll-mt-24 p-5 sm:p-7">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold"><Keyboard className="h-5 w-5 text-marca-600" /> Teclas rápidas</h2>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {ATAJOS.map((a) => (
                  <div key={a.tecla} className="flex items-center gap-4 px-4 py-3">
                    <span className="kbd min-w-[72px] justify-center text-sm">{a.tecla}</span>
                    <span className="text-[15px] text-tinta-2">{a.que}</span>
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}

          {problemas.length > 0 && (
            <Tarjeta id="problemas" className="scroll-mt-24 p-5 sm:p-7">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold"><Wrench className="h-5 w-5 text-marca-600" /> Problemas frecuentes</h2>
              <div className="space-y-3">
                {problemas.map((p) => (
                  <div key={p.p} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-bold text-tinta">{p.p}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-tinta-3">{p.s}</p>
                  </div>
                ))}
              </div>
              <p className={cx('mt-5 text-sm text-tinta-3')}>¿Sigue sin funcionar? Escríbenos al WhatsApp <b>{SOPORTE.whatsappTexto}</b> · {SOPORTE.web}</p>
            </Tarjeta>
          )}
        </div>
      </div>
    </div>
  )
}
