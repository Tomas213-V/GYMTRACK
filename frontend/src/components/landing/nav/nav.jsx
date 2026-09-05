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
                <Link to="/ejercicios">Ejercicios</Link>
                <Link to="/progress">Progreso</Link>
                <Link to="/precio">Precio</Link>
                <Link to="/">Soporte</Link>  
                </div>
               
               
                <div className="Caja-nav-landing-botones">
               <Link to="/login"><FaExternalLinkAlt/>Iniciar sesion</Link>
                <Link to="/register">Registrarse</Link>  
                </div>

              

            </nav>
        </>
    )
}
export default NavLanding