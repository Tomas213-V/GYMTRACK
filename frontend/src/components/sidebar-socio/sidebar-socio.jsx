// ==============================================================================
// MENÚ LATERAL DEL PORTAL DE SOCIOS
// ==============================================================================

import { useState, useEffect } from 'react';
import '../sidebar-dueno/sidebar.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaCalendarCheck,
  FaDumbbell,
  FaUser,
  FaCreditCard,
  FaSignOutAlt,
  FaRunning,
  FaTimes
} from 'react-icons/fa';
import { FaHouse } from 'react-icons/fa6';
import { useGymContext } from '../../context/GymContext';

function SidebarSocio() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mvpMode, logout } = useGymContext();
  const [abiertoMovil, setAbiertoMovil] = useState(false);

  useEffect(() => {
    const toggleHandler = () => setAbiertoMovil((prev) => !prev);
    window.addEventListener('gymtrack:toggle-sidebar', toggleHandler);
    return () => window.removeEventListener('gymtrack:toggle-sidebar', toggleHandler);
  }, []);

  useEffect(() => {
    setAbiertoMovil((prev) => (prev ? false : prev));
  }, [location.pathname]);

  const todasLasOpciones = [
    { ruta: '/dashboard-socio', nombre: 'Inicio', icono: <FaHouse />, alias: ['/socio/dashboard'], mvp: false },
    { ruta: '/rutinas-socio', nombre: 'Rutinas', icono: <FaDumbbell />, alias: ['/socio/rutinas', '/rutinas'], mvp: false },
    { ruta: '/ejercicios-socio', nombre: 'Ejercicios', icono: <FaRunning />, alias: ['/socio/ejercicios', '/ejercicios'], mvp: false },
    { ruta: '/asistencia-socio', nombre: 'Asistencia', icono: <FaCalendarCheck />, alias: ['/asistencias', '/socio/asistencia', '/asistencias-socio'], mvp: true },
    {
      ruta: '/membresia-socio',
      nombre: 'Membresía',
      icono: <FaCreditCard />,
      alias: ['/socio/membresia', '/membresia', '/mi-membresia'],
      mvp: true
    },
    { ruta: '/perfil-socio', nombre: 'Perfil', icono: <FaUser />, alias: ['/perfil'], mvp: true }
  ];

  const opciones = mvpMode ? todasLasOpciones.filter((op) => op.mvp) : todasLasOpciones;

  const handleLogout = () => {
    logout();
    navigate('/login-socio');
  };

  return (
    <>
      {abiertoMovil && (
        <div
          className="Caja-sidebar-overlay"
          onClick={() => setAbiertoMovil(false)}
          aria-label="Cerrar menú lateral"
        />
      )}

      <aside className={`Caja-sidebar ${abiertoMovil ? 'abierto-movil' : ''}`}>
        <div className="Caja-sidebar-mobile-header">
          <div className="Caja-sidebar-mobile-logo">
            <b>
              GYM<span>TRACK</span>
            </b>
          </div>
          <button
            className="Caja-sidebar-close-btn"
            onClick={() => setAbiertoMovil(false)}
            aria-label="Cerrar navegación"
          >
            <FaTimes />
          </button>
        </div>

        <div className="Caja-sidebar-opciones">
          {opciones.map((opcion, index) => {
            const esActivo =
              location.pathname === opcion.ruta ||
              (opcion.alias && opcion.alias.includes(location.pathname));

            return (
              <Link
                to={opcion.ruta}
                key={index}
                className={esActivo ? 'Caja-sidebar-link-activo' : ''}
                onClick={() => setAbiertoMovil(false)}
              >
                <i className="Caja-sidebar-icono">{opcion.icono}</i>
                <span>{opcion.nombre}</span>
              </Link>
            );
          })}
        </div>

        <div className="Caja-sidebar-bottom">
          <button onClick={handleLogout} className="Caja-sidebar-logout-btn">
            <FaSignOutAlt className="Caja-sidebar-logout-icon" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default SidebarSocio;
