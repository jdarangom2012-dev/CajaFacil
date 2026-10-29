import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App'
import { ProveedorSesion } from './lib/sesion'
import { iniciarTema } from './lib/tema'

iniciarTema()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </BrowserRouter>
  </React.StrictMode>,
)
