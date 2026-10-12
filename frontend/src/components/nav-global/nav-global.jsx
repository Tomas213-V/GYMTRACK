import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaBell, FaChevronDown } from "react-icons/fa";
import "./nav-global.css";

function NavGlobal() {
  const [nombreUsuario, setNombreUsuario] = useState("Juan Diaz");
  const [iniciales, setIniciales] = useState("JD");

  useEffect(() => {
    try {
      const guardado = localStorage.getItem("socio") || localStorage.getItem("usuario");
      if (guardado) {
        const u = JSON.parse(guardado);
        const nombreCompleto = u.nombre 
          ? (u.apellido ? `${u.nombre} ${u.apellido}` : u.nombre)
          : (u.email ? u.email.split('@')[0] : "Juan Diaz");
        
        setNombreUsuario(nombreCompleto);

        // Generar 2 iniciales (ej: JD para Juan Diaz)
        const partes = nombreCompleto.trim().split(/\s+/);
        if (partes.length >= 2) {
          setIniciales((partes[0][0] + partes[1][0]).toUpperCase());
        } else if (partes.length === 1 && partes[0].length > 0) {
          setIniciales(partes[0].slice(0, 2).toUpperCase());
        }
      }
    } catch {
      // Usar fallback "JD"
    }
  }, []);

  return (
    <header className="Caja-nav-global">
      <div className="Caja-nav-global-logo">
        <button 
          className="Caja-nav-global-menu-btn" 
          aria-label="Abrir menú"
          onClick={() => window.dispatchEvent(new CustomEvent('gymtrack:toggle-sidebar'))}
        >
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

        <Link to="/perfil" className="Caja-nav-global-icono-usuario" role="button" tabIndex={0} style={{ textDecoration: 'none' }}>
          <div className="Caja-nav-global-usuario-avatar" style={{ fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px' }}>
            {iniciales}
          </div>
          <p>{nombreUsuario}</p>
          <FaChevronDown className="Caja-nav-global-usuario-chevron" />
        </Link>
      </div>
    </header>
  );
}

export default NavGlobal;