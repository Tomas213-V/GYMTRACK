/**
 * =========================================================================================
 * ARCHIVO: main.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Punto de entrada raíz (Entry Point) de la aplicación React con Vite.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * 1. React DOM: Se importa `createRoot` de 'react-dom/client' para habilitar el motor de
 *    renderizado concurrente de React 18+.
 * 2. Estilos Globales: Se importa `index.css` que contiene variables CSS (colores, fuentes, resets).
 * 3. Enrutador: Se envuelve la app en `<BrowserRouter>` para proveer navegación basada en HTML5 History API.
 * 4. Componente Base: `<App />` coordina todas las rutas públicas y protegidas del sistema.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { GymProvider } from './context/GymContext.jsx'

// PASO 1: Localizamos el elemento contenedor '#root' en index.html y montamos el árbol de React.
createRoot(document.getElementById('root')).render(
  // StrictMode ejecuta verificaciones adicionales y advertencias durante el desarrollo
  <StrictMode>
    {/* BrowserRouter gestiona las URLs y la sincronización de la vista en el navegador */}
    <BrowserRouter>
      <GymProvider>
        {/* Componente principal con la definición de rutas */}
        <App />
      </GymProvider>
    </BrowserRouter>
  </StrictMode>,
)
