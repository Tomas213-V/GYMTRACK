// ==============================================================================
// COMPONENTE GUARDIÁN DE RUTAS — DUEÑO / ADMIN ORGANIZACIONAL / EMPLEADO / SOCIO
// ==============================================================================

import { Navigate, useLocation } from 'react-router-dom';
import { useGymContext } from '../context/GymContext';

const MVP_STAFF_PATHS = new Set([
  '/sucursales-dueño',
  '/sucursales-dueno',
  '/sucursales',
  '/socios-dueño',
  '/socios-dueno',
  '/socios',
  '/empleado/socios',
  '/membresia-dueño',
  '/membresia-dueno',
  '/membresias-dueño',
  '/membresias-dueno',
  '/membresia-admin',
  '/membresias',
  '/membresias-admin',
  '/membresia',
  '/asistencias-dueño',
  '/asistencias-dueno',
  '/empleado/asistencias',
  '/asistencias',
  '/pagos-dueño',
  '/pagos-dueno',
  '/pagos',
  '/empleado/pagos',
  '/perfil-dueño',
  '/perfil-dueno',
  '/empleado/perfil',
  '/perfil',
  '/crear-gimnasio-dueño',
  '/crear-gimnasio-dueno',
  '/crear-gimnasio',
  '/seleccionar-gimnasio'
]);

const MVP_SOCIO_PATHS = new Set([
  '/asistencia-socio',
  '/asistencias-socio',
  '/socio/asistencia',
  '/asistencias',
  '/membresia-socio',
  '/socio/membresia',
  '/mi-membresia',
  '/membresia',
  '/perfil-socio',
  '/perfil',
  '/seleccionar-gimnasio'
]);

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.permitirSinGimnasio=false]
 * @param {boolean} [props.permitirSinContexto=false]
 * @param {boolean} [props.bloquearEmpleado=false]
 * @param {'dueño'|'administrador'|'empleado'|'staff'|'socio'|null} [props.rolRequerido=null]
 * @param {string|null} [props.permisoRequerido=null]
 */
function ProtectedRoute({
  children,
  permitirSinGimnasio = false,
  permitirSinContexto = false,
  bloquearEmpleado = false,
  rolRequerido = null,
  permisoRequerido = null
}) {
  const location = useLocation();
  const {
    isAuthenticated,
    esSocio,
    esDueno,
    esAdministrador,
    esEmpleado,
    esStaff,
    mvpMode,
    gimnasios,
    gimnasioActivo,
    requiereSeleccionContexto,
    hasPermission
  } = useGymContext();

  const homeNoAutorizado = esSocio
    ? mvpMode
      ? '/asistencia-socio'
      : '/dashboard-socio'
    : esEmpleado || mvpMode
      ? '/socios-dueño'
      : '/dashboard-dueño';

  // 1. Verificar sesión autenticada
  if (!isAuthenticated) {
    if (rolRequerido === 'socio') return <Navigate to="/login-socio" replace />;
    if (rolRequerido === 'administrador') return <Navigate to="/login-administrador" replace />;
    if (rolRequerido === 'empleado') return <Navigate to="/login-empleado" replace />;
    return <Navigate to="/login-dueño" replace />;
  }

  // 1b. Si el usuario tiene múltiples gimnasios/sucursales, exigir selección de contexto antes de entrar al panel
  if (requiereSeleccionContexto && !permitirSinContexto) {
    return <Navigate to="/seleccionar-gimnasio" replace />;
  }

  // 1c. Bloquear rutas administrativas/financieras exclusivas de dueño/admin para el rol Empleado
  if (bloquearEmpleado && esEmpleado) {
    return <Navigate to="/socios-dueño" replace />;
  }

  // 2. Control de acceso por rol
  if (rolRequerido === 'dueño' && !esDueno) {
    return <Navigate to={homeNoAutorizado} replace />;
  }

  if (rolRequerido === 'administrador' && !esAdministrador) {
    return <Navigate to={homeNoAutorizado} replace />;
  }

  if (rolRequerido === 'empleado' && !esEmpleado) {
    return <Navigate to={homeNoAutorizado} replace />;
  }

  if (rolRequerido === 'staff' && !esStaff) {
    return <Navigate to="/dashboard-socio" replace />;
  }

  if (rolRequerido === 'socio' && !esSocio) {
    return <Navigate to={esEmpleado ? '/socios-dueño' : '/dashboard-dueño'} replace />;
  }

  // 3. Control de permiso granular para administradores organizacionales y empleados
  if (permisoRequerido && !hasPermission(permisoRequerido)) {
    return <Navigate to={homeNoAutorizado} replace />;
  }

  // 3b. Restricción de rutas cuando el modo MVP está activo
  if (mvpMode && !permitirSinGimnasio && !permitirSinContexto) {
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(location.pathname);
    } catch {
      decodedPath = location.pathname;
    }
    const normalizedPath = decodedPath.toLowerCase();
    const allowedSet = esSocio ? MVP_SOCIO_PATHS : MVP_STAFF_PATHS;
    if (!allowedSet.has(normalizedPath)) {
      return <Navigate to={homeNoAutorizado} replace />;
    }
  }

  // 4. Si es socio, permitir acceso incluso si aún no tiene membresías activas
  if (esSocio) {
    return children;
  }

  // 5. Si es dueño y aún no creó ningún gimnasio, redirigir a onboarding
  const tieneGimnasio = Boolean(gimnasioActivo?.id_gimnasio || (gimnasios && gimnasios.length > 0));

  if (esDueno && !permitirSinGimnasio && !tieneGimnasio) {
    return <Navigate to="/crear-gimnasio-dueño" replace />;
  }

  return children;
}

export default ProtectedRoute;
