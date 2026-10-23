/**
 * =========================================================================================
 * ARCHIVO: socios.jsx
 * RUTA: frontend/src/pages/socios/socios.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Vista contenedor para el módulo de Administración de Socios y Alumnos.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * 1. Arquitectura de Layout: Emplea una estructura en cuadrícula que integra la barra
 *    superior de navegación global (`<NavGlobal />`) y el menú lateral del dueño (`<Sidebar />`).
 * 2. Desacoplamiento de Lógica: Delega toda la lógica de filtrado, paginación y ventanas
 *    modales en el componente interno `<SocioContent />`.
 */

import NavGlobal from '../../components/nav-global/nav-global'
import Sidebar from '../../components/sidebar/sidebar'
import SocioContent from '../../components/socios/socio-content/content'
import './socios.css'

function Socios() {

  return (
    <div className="socios-page-layout">
      <NavGlobal />
      <div className="socios-main-wrapper">
        <Sidebar />
        <section className="socios-content-area">
          <SocioContent />
        </section>
      </div>
    </div>
  )
}

export default Socios