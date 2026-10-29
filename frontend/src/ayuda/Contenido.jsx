import { useEffect, useState } from 'react'
import {
  BarChart3, Banknote, Boxes, CircleHelp, DatabaseBackup, FileCheck2, HandCoins, LayoutDashboard, Lightbulb, Menu, Package, Receipt,
  Settings, ShieldCheck, ShoppingCart, Sparkles, Tags, Users, Wallet, ZoomIn,
} from 'lucide-react'
import { Modal, cx } from '../components/ui'

/** Texto con **negritas** sencillas. */
export function Texto({ children, className }) {
  const partes = String(children || '').split(/\*\*(.+?)\*\*/g)
  return <span className={className}>{partes.map((p, i) => (i % 2 ? <b key={i} className="font-bold text-tinta">{p}</b> : p))}</span>
}

const ICONOS = {
  BarChart3, Banknote, Boxes, DatabaseBackup, FileCheck2, HandCoins, LayoutDashboard, Menu, Package, Receipt,
  Settings, ShieldCheck, ShoppingCart, Sparkles, Tags, Users, Wallet,
}

export function IconoSeccion({ nombre, className }) {
  const I = ICONOS[nombre] || CircleHelp
  return <I className={className} />
}

/* Qué elementos quedaron numerados en cada pantallazo (lo genera el script de capturas). */
let cacheCapturas = null
export function useCapturas() {
  const [mapa, setMapa] = useState(cacheCapturas)
  useEffect(() => {
    if (cacheCapturas) return
    fetch('/manual/capturas.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((m) => { cacheCapturas = m; setMapa(m) })
  }, [])
  return mapa || {}
}

export function numeracion(seccion, capturas) {
  const ids = capturas[seccion.id] || []
  const n = {}
  ids.forEach((id, i) => { n[id] = i + 1 })
  return n
}

export const Numero = ({ n, className }) => (
  <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F04438] text-xs font-extrabold text-white ring-2 ring-white', className)}>{n}</span>
)

export function Captura({ seccion }) {
  const [grande, setGrande] = useState(false)
  const [error, setError] = useState(false)
  if (!seccion.captura || error) return null
  const src = `/manual/${seccion.captura}`
  return (
    <>
      <button type="button" onClick={() => setGrande(true)} className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-suave">
        <img src={src} alt={`Pantalla de ${seccion.titulo}`} loading="lazy" onError={() => setError(true)} className="w-full" />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-noche/80 px-2 py-1 text-xs font-bold text-white opacity-90 group-hover:opacity-100">
          <ZoomIn className="h-3.5 w-3.5" /> Ver grande
        </span>
      </button>
      <Modal abierto={grande} onCerrar={() => setGrande(false)} titulo={seccion.titulo} ancho="xl">
        <img src={src} alt="" className="w-full rounded-xl border border-slate-200" />
      </Modal>
    </>
  )
}

/** El contenido de una sección del manual (se usa en el panel de ayuda y en la página Ayuda). */
export function ContenidoSeccion({ seccion, compacto, resaltar }) {
  const capturas = useCapturas()
  const num = numeracion(seccion, capturas)
  const elementos = [...seccion.elementos].sort((a, b) => (num[a.id] || 999) - (num[b.id] || 999))
  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-tinta-2"><Texto>{seccion.resumen}</Texto></p>
      {seccion.quien && <p className="-mt-3 text-sm text-tinta-4">Disponible para: <b className="text-tinta-3">{seccion.quien}</b></p>}

      <Captura seccion={seccion} />

      {seccion.tareas?.map((t) => (
        <div key={t.titulo}>
          <h4 className="mb-2 text-base font-extrabold text-tinta">{t.titulo}</h4>
          <ol className="space-y-2">
            {t.pasos.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-marca-50 text-xs font-extrabold text-marca-700">{i + 1}</span>
                <Texto className="text-[15px] leading-relaxed text-tinta-2">{p}</Texto>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {seccion.consejos?.length > 0 && (
        <div className="rounded-2xl bg-alerta-50 p-4">
          {seccion.consejos.map((c, i) => (
            <p key={i} className="flex gap-2 text-sm leading-relaxed text-alerta-700 [&+&]:mt-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> <Texto>{c}</Texto>
            </p>
          ))}
        </div>
      )}

      {elementos.length > 0 && (
        <div>
          <h4 className="mb-2 text-base font-extrabold text-tinta">{compacto ? 'Qué hace cada opción' : 'Para qué sirve cada opción'}</h4>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {elementos.map((e) => (
              <div key={e.id} id={`ayuda-${e.id}`} className={cx('flex gap-3 px-4 py-3', resaltar === e.id && 'bg-marca-50')}>
                {num[e.id] ? <Numero n={num[e.id]} className="mt-0.5" /> : <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-300 mx-2" />}
                <div className="min-w-0">
                  <p className="font-bold text-tinta">{e.titulo}</p>
                  <p className="text-sm leading-relaxed text-tinta-3">{e.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
