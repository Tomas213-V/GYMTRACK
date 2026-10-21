/**
 * =========================================================================================
 * ARCHIVO: ProtectedRoute.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Componente guardián (Route Guard) para proteger rutas privadas y validar roles.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * Este componente envuelve las rutas que no deben ser accesibles de manera pública.
 * Ejecuta 5 pasos de validación antes de renderizar el componente hijo (`children`):
 * 
 * - PASO 1: Comprueba si existe un token JWT válido en el almacenamiento local (`localStorage`).
 *           Si no hay sesión activa, redirige al login correspondiente (socio o dueño).
 * - PASO 2: Control de roles (`rolRequerido`). Si un socio intenta entrar a una ruta de dueño,
 *           se lo desvía a su dashboard (`/dashboard-socio`), y viceversa.
 * - PASO 3: Validación de pertenencia a gimnasio para dueños.
 * - PASO 4: Si el dueño aún no creó su gimnasio, se le exige crearlo antes de continuar (`/crear-gimnasio-dueño`).
 * - PASO 5: Si ya tiene gimnasio y visita la pantalla de creación, se lo redirige a su panel principal.
 */

// Navigate nos permite redirigir al usuario hacia otra ruta programáticamente.
import { Navigate } from 'react-router-dom';

// Importamos la función auxiliar que comprueba la presencia de credenciales activas.
import { isAuthenticated } from '../services/authService';

/**
 * Componente ProtectedRoute
 * @param {Object} props
 * @param {React.ReactNode} props.children - El componente o página a renderizar si cumple las reglas.
 * @param {boolean} [props.permitirSinGimnasio=false] - Habilita el acceso temporal sin gimnasio asociado (ej: creación inicial).
 * @param {'dueño'|'socio'|null} [props.rolRequerido=null] - Restringe el acceso estrictamente al rol indicado.
 */
function ProtectedRoute({ children, permitirSinGimnasio = false, rolRequerido = null }) {
  // Obtenemos el rol actual almacenado en localStorage
  const rol = localStorage.getItem('rol');
  const esSocio = rol === 'socio' || Boolean(localStorage.getItem('socio'));

  // ---------------------------------------------------------------------------------------
  // PASO 1: VERIFICAR SI EL USUARIO ESTÁ AUTENTICADO
  // ---------------------------------------------------------------------------------------
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