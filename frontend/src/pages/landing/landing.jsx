import { Link } from "react-router-dom"
import "./landing.css"
import NavLanding from "../../components/landing/nav/nav"
import Aviso from "../../components/landing/aviso/aviso"
import Titulo from "../../components/landing/titulo-landing/titulo"
import Subtitulo from "../../components/landing/subtitulo-landing/subtitulo"
import Botones from "../../components/landing/botones-landing/botones"
import Calificaciones from "../../components/landing/calificaciones/calificaciones"
import Caracteristicas from "../../components/landing/caracteristicas/caracteristicas"
import Foother from "../../components/Foother/foother"
function Landing(params) {
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