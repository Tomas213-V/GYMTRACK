// ==============================================================================
// COMPONENTE GUARDIÁN DE RUTAS — DUEÑO / ADMIN ORGANIZACIONAL / EMPLEADO / SOCIO
// ==============================================================================

import { Navigate } from 'react-router-dom';
import { useGymContext } from '../context/GymContext';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.permitirSinGimnasio=false]
 * @param {'dueño'|'staff'|'socio'|null} [props.rolRequerido=null]
 * @param {string|null} [props.permisoRequerido=null]
 */
function ProtectedRoute({
  children,
  permitirSinGimnasio = false,
  rolRequerido = null,
  permisoRequerido = null
}) {
  const {
    isAuthenticated,
    esSocio,
    esDueno,
    esAdministrador,
    esEmpleado,
    esStaff,
    gimnasios,
    gimnasioActivo,
    hasPermission
  } = useGymContext();

  // 1. Verificar sesión autenticada
  if (!isAuthenticated) {
    return <Navigate to={rolRequerido === 'socio' ? '/login-socio' : '/login-dueño'} replace />;
  }

  // 2. Control de acceso por rol
  if (rolRequerido === 'dueño' && !esDueno) {
    if (esSocio) return <Navigate to="/dashboard-socio" replace />;
    if (esAdministrador || esEmpleado) return <Navigate to="/dashboard-dueño" replace />;
  }

  if (rolRequerido === 'staff' && !esStaff) {
    return <Navigate to="/dashboard-socio" replace />;
  }

  if (rolRequerido === 'socio' && !esSocio) {
    return <Navigate to="/dashboard-dueño" replace />;
  }

  // 3. Control de permiso granular para administradores organizacionales y empleados
  if (permisoRequerido && !hasPermission(permisoRequerido)) {
    return <Navigate to={esSocio ? '/dashboard-socio' : '/dashboard-dueño'} replace />;
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
