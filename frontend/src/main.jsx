import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App'
import { iniciarTema } from './lib/tema'
import { AvisoProvider } from './context/Aviso'
import { SesionProvider } from './context/Sesion'
import { AyudaProvider } from './ayuda/Ayuda'

iniciarTema()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AvisoProvider>
        <SesionProvider>
          <AyudaProvider>
            <App />
          </AyudaProvider>
        </SesionProvider>
      </AvisoProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
