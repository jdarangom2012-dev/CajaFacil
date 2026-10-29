import { useEffect, useState } from 'react'

const CLAVE = 'cf_tema'
const oyentes = new Set()

const sistemaOscuro = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function temaGuardado() {
  try { return localStorage.getItem(CLAVE) } catch { return null }
}

export function temaActual() {
  return document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro'
}

/** Aplica el tema antes de dibujar la app (evita el "flash" blanco). */
export function iniciarTema() {
  const g = temaGuardado()
  const oscuro = g ? g === 'oscuro' : sistemaOscuro()
  document.documentElement.classList.toggle('dark', !!oscuro)
}

export function cambiarTema(tema) {
  document.documentElement.classList.toggle('dark', tema === 'oscuro')
  try { localStorage.setItem(CLAVE, tema) } catch { /* sin almacenamiento */ }
  oyentes.forEach((fn) => fn(tema))
}

export function useTema() {
  const [tema, setTema] = useState(temaActual)
  useEffect(() => {
    oyentes.add(setTema)
    return () => oyentes.delete(setTema)
  }, [])
  return [tema, (t) => cambiarTema(t ?? (tema === 'oscuro' ? 'claro' : 'oscuro'))]
}

/** Colores para gráficas (SVG no lee variables CSS en atributos). */
export const coloresGrafica = (tema) => (tema === 'oscuro'
  ? { rejilla: '#22314D', eje: '#8C9AB2', ejeSuave: '#6F7F9B', cursor: '#1B3261' }
  : { rejilla: '#EEF2F6', eje: '#667085', ejeSuave: '#98A2B3', cursor: '#EEF5FF' })
