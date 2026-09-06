// Navigate nos permite redirigir al usuario
// hacia otra ruta.
import { Navigate } from 'react-router-dom'

// Importamos la función que comprueba
// si existe una sesión iniciada.
import { isAuthenticated } from '../services/authService'


// ProtectedRoute recibe un componente mediante "children".
//
// Por ejemplo:
//
// <ProtectedRoute>
//     <Dashboard />
// </ProtectedRoute>
//
// En ese caso, children sería <Dashboard />.
function ProtectedRoute({ children }) {

    // Comprobamos si el usuario está autenticado.
    if (!isAuthenticated()) {

        // Si NO está autenticado,
        // lo mandamos al Login.
        return <Navigate to="/login" replace />
    }


    // Si está autenticado,
    // mostramos la página que estaba intentando visitar.
    return children
}


// Exportamos el componente para poder utilizarlo
// desde App.jsx.
export default ProtectedRoute