import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8770',
      '/imagenes': 'http://127.0.0.1:8770',
    },
  },
  build: {
    outDir: '../backend/frontend_dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
