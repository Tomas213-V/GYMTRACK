import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaBell, FaUser, FaChevronDown } from "react-icons/fa";
import "./nav-global.css";

function NavGlobal() {
  const [nombreUsuario, setNombreUsuario] = useState("Admin");

  useEffect(() => {
    try {
      const guardado = localStorage.getItem("usuario");
      if (guardado) {
        const u = JSON.parse(guardado);
        if (u.nombre) {
          setNombreUsuario(u.nombre);
        }
      }
    } catch {
      // Usar fallback "Admin"
    }
  }, []);

  return (
    <header className="Caja-nav-global">
      <div className="Caja-nav-global-logo">
        <button className="Caja-nav-global-menu-btn" aria-label="Abrir menú">
          <FaBars />
        </button>

        <Link to="/" className="Caja-nav-global-marca">
          <b>GYM<span>TRACK</span></b>
        </Link>
      </div>

      <div className="Caja-nav-global-icono-perfil">
        <button className="Caja-nav-global-notificacion-btn" aria-label="Notificaciones">
          <FaBell />
          <span className="Caja-nav-global-notificacion-punto"></span>
        </button>

        <div className="Caja-nav-global-icono-usuario" role="button" tabIndex={0}>
          <div className="Caja-nav-global-usuario-avatar">
            <FaUser />
          </div>
          <p>{nombreUsuario}</p>
          <FaChevronDown className="Caja-nav-global-usuario-chevron" />
        </div>
      </div>
    </header>
  );
}

export default NavGlobal;