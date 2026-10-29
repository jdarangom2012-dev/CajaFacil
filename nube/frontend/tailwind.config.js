/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        superficie: 'rgb(var(--superficie) / <alpha-value>)',
        noche: { DEFAULT: 'rgb(var(--noche) / <alpha-value>)', 2: 'rgb(var(--noche-2) / <alpha-value>)' },
        fondo: 'rgb(var(--fondo) / <alpha-value>)',
        tinta: { DEFAULT: 'rgb(var(--tinta) / <alpha-value>)', 2: 'rgb(var(--tinta-2) / <alpha-value>)', 3: 'rgb(var(--tinta-3) / <alpha-value>)', 4: 'rgb(var(--tinta-4) / <alpha-value>)' },
        slate: {
          50: 'rgb(var(--slate-50) / <alpha-value>)', 100: 'rgb(var(--slate-100) / <alpha-value>)', 200: 'rgb(var(--slate-200) / <alpha-value>)', 300: 'rgb(var(--slate-300) / <alpha-value>)', 400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)', 600: 'rgb(var(--slate-600) / <alpha-value>)', 700: 'rgb(var(--slate-700) / <alpha-value>)', 800: '#1E293B', 900: '#0F172A',
        },
        marca: {
          50: 'rgb(var(--marca-50) / <alpha-value>)', 100: 'rgb(var(--marca-100) / <alpha-value>)', 200: 'rgb(var(--marca-200) / <alpha-value>)', 300: 'rgb(var(--marca-300) / <alpha-value>)', 400: '#5A9BFF',
          500: '#2F7BFF', 600: '#1570EF', 700: 'rgb(var(--marca-700) / <alpha-value>)', 800: 'rgb(var(--marca-800) / <alpha-value>)', 900: 'rgb(var(--marca-900) / <alpha-value>)',
        },
        exito: { 50: 'rgb(var(--exito-50) / <alpha-value>)', 100: 'rgb(var(--exito-100) / <alpha-value>)', 500: '#12B76A', 600: '#039855', 700: 'rgb(var(--exito-700) / <alpha-value>)' },
        alerta: { 50: 'rgb(var(--alerta-50) / <alpha-value>)', 100: 'rgb(var(--alerta-100) / <alpha-value>)', 200: 'rgb(var(--alerta-200) / <alpha-value>)', 500: '#F79009', 600: '#DC6803', 700: 'rgb(var(--alerta-700) / <alpha-value>)' },
        peligro: { 50: 'rgb(var(--peligro-50) / <alpha-value>)', 100: 'rgb(var(--peligro-100) / <alpha-value>)', 500: '#F04438', 600: '#D92D20', 700: 'rgb(var(--peligro-700) / <alpha-value>)' },
      },
      boxShadow: {
        suave: '0 1px 2px rgba(16,24,40,.04), 0 4px 16px -4px rgba(16,24,40,.08)',
        flotante: '0 12px 40px -8px rgba(16,24,40,.25)',
        marca: '0 8px 24px -8px rgba(21,112,239,.55)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        entrar: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        subir: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        aparecer: { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        entrar: 'entrar .25s ease-out both',
        subir: 'subir .28s cubic-bezier(.2,.8,.2,1) both',
        aparecer: 'aparecer .18s ease-out both',
        pop: 'pop .3s ease-out',
      },
    },
  },
  plugins: [],
}
