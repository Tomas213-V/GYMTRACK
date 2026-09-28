// Navigate nos permite redirigir al usuario hacia otra ruta.
import { Navigate } from 'react-router-dom';

// Importamos la función que comprueba si existe una sesión iniciada.
import { isAuthenticated } from '../services/authService';

/**
 * ProtectedRoute protege las rutas privadas.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} props.permitirSinGimnasio - Si es true (ej: en /crear-gimnasio), permite el acceso aunque no tenga gimnasio.
 */
function ProtectedRoute({ children, permitirSinGimnasio = false }) {
  // 1. Comprobamos si el usuario está autenticado.
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Si el usuario es un socio, permitimos el acceso directo
  const rol = localStorage.getItem('rol');
  if (rol === 'socio') {
    return children;
  }

  // 2. Comprobamos si el usuario tiene un gimnasio asociado.
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

  // 3. Si la ruta requiere gimnasio y no lo tiene, mandarlo a crear su gimnasio
  if (!permitirSinGimnasio && !tieneGimnasio) {
    return <Navigate to="/crear-gimnasio" replace />;
  }

  // 4. Si ya tiene gimnasio y visita /crear-gimnasio, mandarlo al dashboard
  if (permitirSinGimnasio && tieneGimnasio) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si cumple las condiciones, mostramos la página solicitada.
  return children;
}

export default ProtectedRoute;