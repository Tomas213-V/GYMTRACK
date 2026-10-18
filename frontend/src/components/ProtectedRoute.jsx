// Navigate nos permite redirigir al usuario hacia otra ruta.
import { Navigate } from 'react-router-dom';

// Importamos la función que comprueba si existe una sesión iniciada.
import { isAuthenticated } from '../services/authService';

/**
 * ProtectedRoute protege las rutas privadas.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.permitirSinGimnasio=false] - Si es true (ej: en /crear-gimnasio), permite el acceso aunque no tenga gimnasio.
 * @param {'dueño'|'socio'|null} [props.rolRequerido=null] - Si se especifica, restringe el acceso al rol correspondiente.
 */
function ProtectedRoute({ children, permitirSinGimnasio = false, rolRequerido = null }) {
  const rol = localStorage.getItem('rol');
  const esSocio = rol === 'socio' || Boolean(localStorage.getItem('socio'));

  // 1. Comprobamos si el usuario está autenticado.
  if (!isAuthenticated()) {
    return <Navigate to={esSocio ? "/login-socio" : "/login-dueño"} replace />;
  }

  // 2. Control de acceso según rol requerido
  if (rolRequerido === 'dueño' && esSocio) {
    return <Navigate to="/dashboard-socio" replace />;
  }

  if (rolRequerido === 'socio' && !esSocio) {
    return <Navigate to="/dashboard-dueño" replace />;
  }

  // Si el usuario es un socio y la ruta no está reservada para dueño, permitimos el acceso directo
  if (esSocio) {
    return children;
  }

  // 3. Comprobamos si el usuario (dueño) tiene un gimnasio asociado.
  const usuarioGuardado = localStorage.getItem('usuario');
  let tieneGimnasio = false;

  if (usuarioGuardado) {
    try {
      const u = JSON.parse(usuarioGuardado);
      tieneGimnasio = Boolean(u.gimnasio && u.gimnasio.id_gimnasio);
    } catch {
      // Ignorar error de lectura
    }
  }

  // 4. Si la ruta requiere gimnasio y no lo tiene, mandarlo a crear su gimnasio
  if (!permitirSinGimnasio && !tieneGimnasio) {
    return <Navigate to="/crear-gimnasio-dueño" replace />;
  }

  // 5. Si ya tiene gimnasio y visita /crear-gimnasio, mandarlo al dashboard
  if (permitirSinGimnasio && tieneGimnasio) {
    return <Navigate to="/dashboard-dueño" replace />;
  }

  // Si cumple las condiciones, mostramos la página solicitada.
  return children;
}

export default ProtectedRoute;