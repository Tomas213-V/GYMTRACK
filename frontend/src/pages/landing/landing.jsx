/**
 * =========================================================================================
 * ARCHIVO: landing.jsx
 * RUTA: frontend/src/pages/landing/landing.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Página de inicio y presentación comercial (Landing Page pública).
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 1. Propósito: Actúa como la carta de presentación del SaaS GymTrack para potenciales clientes.
 * 2. Composición Modular de Componentes:
 *    - `<NavLanding />`: Barra de navegación de marketing con enlaces a precios y login.
 *    - `<Aviso />`: Banner promocional o de novedades.
 *    - `<Titulo />` y `<Subtitulo />`: Hero section con propuesta de valor principal.
 *    - `<Botones />`: CTAs para registro de dueños o inicio de sesión.
 *    - `<Calificaciones />`: Prueba social, testimonios y puntuación.
 *    - `<Caracteristicas />`: Grilla con beneficios (control de socios, finanzas, rutinas).
 *    - `<Foother />`: Pie de página legal, derechos de autor y redes de contacto.
 */

import "./landing.css"
import NavLanding from "../../components/landing/nav/nav"
import Aviso from "../../components/landing/aviso/aviso"
import Titulo from "../../components/landing/titulo-landing/titulo"
import Subtitulo from "../../components/landing/subtitulo-landing/subtitulo"
import Botones from "../../components/landing/botones-landing/botones"
import Calificaciones from "../../components/landing/calificaciones/calificaciones"
import Caracteristicas from "../../components/landing/caracteristicas/caracteristicas"
import Foother from "../../components/Foother/foother"

function Landing() {

    return (
        <>
            <div className="Caja-landing">
                 <NavLanding/>
                 <Aviso/> 
                 <Titulo/>
                 <Subtitulo/>
                 <Botones/>
                 <Calificaciones/>
                 <Caracteristicas/>
                 <Foother/>
            </div>
           
        </>
    )
}
export default Landing