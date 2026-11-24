// ==============================================================================
// BARRA SUPERIOR DE NAVEGACIÓN GLOBAL — CON SELECTOR DE GIMNASIO MULTIGIMNASIO
// ==============================================================================

import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaBell, FaChevronDown, FaBuilding, FaPlus } from 'react-icons/fa';
import { useGymContext } from '../../context/GymContext';
import './nav-global.css';

function calcularIniciales(usuario) {
  if (!usuario) return { nombre: 'Usuario', iniciales: 'GT' };
  const nombreCompleto = usuario.nombre
    ? usuario.apellido
      ? `${usuario.nombre} ${usuario.apellido}`.trim()
      : usuario.nombre
    : usuario.email
    ? usuario.email.split('@')[0]
    : 'Usuario';

  let ini = 'GT';
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length >= 2 && partes[0][0] && partes[1][0]) {
    ini = (partes[0][0] + partes[1][0]).toUpperCase();
  } else if (partes.length === 1 && partes[0].length > 0) {
    ini = partes[0].slice(0, 2).toUpperCase();
  }
  return { nombre: nombreCompleto, iniciales: ini };
}

function NavGlobal() {
  const navigate = useNavigate();
  const {
    usuario,
    rol,
    esSocio,
    esDueno,
    esAdministrador,
    esEmpleado,
    gimnasioActivo,
    sucursalActiva,
    gimnasios
  } = useGymContext();

  const { nombre: nombreUsuario, iniciales } = calcularIniciales(usuario);

  const etiquetaRol = esDueno
    ? 'Dueño'
    : esAdministrador
    ? 'Admin. Org.'
    : esEmpleado
    ? (usuario?.roles_empleado?.[0]
        ? usuario.roles_empleado[0] === 'administrador'
          ? 'Admin. Sucursal'
          : usuario.roles_empleado[0].charAt(0).toUpperCase() + usuario.roles_empleado[0].slice(1)
        : 'Empleado')
    : 'Socio';

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

        <Link to={esSocio ? '/dashboard-socio' : '/dashboard-dueño'} className="Caja-nav-global-marca">
          <b>
            GYM<span>TRACK</span>
          </b>
        </Link>

        {/* CONTEXTO DE GIMNASIO ACTIVO (SOLO LECTURA — PARA CAMBIAR DE GIMNASIO CERRAR SESIÓN) */}
        {(gimnasioActivo || gimnasios.length > 0 || esDueno) && (
          <div
            className="Caja-nav-global-gym-selector"
            title="Para ingresar a otro gimnasio, cerrá sesión y volvé a iniciar sesión."
          >
            <FaBuilding className="Caja-nav-global-gym-icon" />
            <span className="Caja-nav-global-gym-label">
              {esSocio ? 'Mi gimnasio:' : 'Gimnasio:'}
            </span>
            {gimnasioActivo ? (
              <span
                className="Caja-nav-global-gym-select"
                style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {gimnasioActivo.nombre}
                {esEmpleado && sucursalActiva?.direccion ? ` — ${sucursalActiva.direccion}` : ''}
                {gimnasioActivo.estado === false ? ' (Inactivo)' : ''}
              </span>
            ) : (
              esDueno && (
                <button
                  type="button"
                  className="Caja-nav-global-gym-add-btn"
                  onClick={() => navigate('/crear-gimnasio-dueño')}
                >
                  <FaPlus /> Crear gimnasio
                </button>
              )
            )}
            {esDueno && gimnasioActivo && (
              <button
                type="button"
                className="Caja-nav-global-gym-add-btn"
                onClick={() => navigate('/crear-gimnasio-dueño')}
                title="Registrar un nuevo gimnasio"
              >
                <FaPlus /> Nuevo
              </button>
            )}
          </div>
        )}
      </div>

      <div className="Caja-nav-global-icono-perfil">
        {rol && (
          <span className="Caja-nav-global-rol-chip" title={`Rol: ${etiquetaRol}`}>
            {etiquetaRol}
          </span>
        )}

        <button className="Caja-nav-global-notificacion-btn" aria-label="Notificaciones">
          <FaBell />
          <span className="Caja-nav-global-notificacion-punto"></span>
        </button>

        <Link
          to={esSocio ? '/perfil-socio' : '/perfil-dueño'}
          className="Caja-nav-global-icono-usuario"
          role="button"
          tabIndex={0}
          style={{ textDecoration: 'none' }}
        >
          <div
            className="Caja-nav-global-usuario-avatar"
            style={{ fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px' }}
          >
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
