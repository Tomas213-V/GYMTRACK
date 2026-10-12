import { useState } from "react";
import { Link } from "react-router-dom";
import "./nav.css";
import { FaExternalLinkAlt, FaBars, FaTimes } from "react-icons/fa";

function NavLanding() {
    const [menuAbierto, setMenuAbierto] = useState(false);

    const toggleMenu = () => {
        setMenuAbierto(prev => !prev);
    };

    const cerrarMenu = () => {
        setMenuAbierto(false);
    };

    return (
        <nav className="Caja-nav-landing">
            <div className="Caja-nav-landing-imagen">
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                    <img src="./logo_verde_sindondo.png" alt="GymTrack Logo" />
                    <b>GYMTRACK</b>
                </Link>
            </div>

            {/* Botón Hamburguesa para Móvil y Tablet */}
            <button 
                className="Caja-nav-landing-toggle" 
                onClick={toggleMenu}
                aria-label="Alternar navegación"
            >
                {menuAbierto ? <FaTimes /> : <FaBars />}
            </button>

            {/* Contenedor colapsable en móvil / horizontal en desktop */}
            <div className={`Caja-nav-landing-collapse ${menuAbierto ? "abierto" : ""}`}>
                <div className="Caja-nav-landing-opciones">
                    <Link to="/" onClick={cerrarMenu}>Inicio</Link>
                    <Link to="/ejercicios" onClick={cerrarMenu}>Ejercicios</Link>
                    <Link to="/progress" onClick={cerrarMenu}>Progreso</Link>
                    <Link to="/precio" onClick={cerrarMenu}>Precio</Link>
                    <Link to="/support" onClick={cerrarMenu}>Soporte</Link>
                </div>

                <div className="Caja-nav-landing-botones">
                    <Link to="/login" onClick={cerrarMenu}>
                        <FaExternalLinkAlt /> Iniciar sesión
                    </Link>
                    <Link to="/register" onClick={cerrarMenu}>
                        Registrarse
                    </Link>  
                </div>
            </div>
        </nav>
    );
}

export default NavLanding;