import { Link } from "react-router-dom"
import "./nav.css"
import { FaExternalLinkAlt } from "react-icons/fa";
function NavLanding() {
    return (
        <>
            <nav className="Caja-nav-landing">

                <div className="Caja-nav-landing-imagen">
                    <img src="./logo_verde_sindondo.png" alt="" />
                    <b>GYMTRACK</b>
                </div>

                <div className="Caja-nav-landing-opciones">
                <Link to="/">Inicio</Link>
                <Link to="/">Ejercicios</Link>
                <Link to="/">Progreso</Link>
                <Link to="/">Precio</Link>
                <Link to="/">Soporte</Link>  
                </div>
               
               
                <div className="Caja-nav-landing-botones">
               <Link to="/"><FaExternalLinkAlt/>Iniciar sesion</Link>
                <Link to="/">Registrarse</Link>  
                </div>

              

            </nav>
        </>
    )
}
export default NavLanding