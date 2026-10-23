/**
 * =========================================================================================
 * ARCHIVO: socioService.js
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Capa de servicios para la administración integral de socios y alumnos.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * 1. Autenticación Bearer: Todas las llamadas a este servicio incluyen el token JWT en el encabezado
 *    `Authorization: Bearer <token>` mediante la función auxiliar `getHeaders()`.
 * 2. Operaciones soportadas:
 *    - `fetchSocios()`: Obtención paginada con filtrado dinámico por estado (activo/inactivo/pendiente) y texto.
 *    - `createSocio()`: Registro de un nuevo socio vinculado al gimnasio actual.
 *    - `getSocioById()`: Detalle completo de un socio (membresía, pagos, contacto).
 *    - `updateSocio()`: Modificación de información de contacto o datos personales.
 *    - `deleteSocio()`: Baja física o lógica del socio.
 *    - `changeEstadoSocio()`: Transición de estado rápida mediante HTTP PATCH.
 *    - `getPerfilSocio()` / `updatePerfilSocio()`: Auto-gestión del perfil del alumno.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Función auxiliar para generar las cabeceras HTTP requeridas por el backend.
 * Recupera el token JWT almacenado al iniciar sesión para autorizar la petición.
 */
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

/**
 * PASO 1: Listado paginado de socios con filtros.
 * Construye dinámicamente los parámetros URL (query string).
 * 
 * @param {Object} params
 * @param {number} [params.page=1] - Número de página actual
 * @param {number} [params.limit=6] - Cantidad de socios por página
 * @param {string} [params.estado=''] - Filtro por estado ('activo', 'inactivo', 'pendiente')
 * @param {string} [params.search=''] - Búsqueda por DNI, nombre o teléfono
 * @returns {Promise<{socios: Array, total: number, totalPages: number}>}
 */
export async function fetchSocios({ page = 1, limit = 6, estado = '', search = '' }) {
  const params = new URLSearchParams();
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);
  if (estado && estado !== 'todos') params.append('estado', estado);
  if (search) params.append('search', search);

  const response = await fetch(`${API_URL}/socios?${params.toString()}`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener socios.');
  return data;
}

/**
 * PASO 1b: Verificación preventiva de DNI y vinculación con otros gimnasios.
 * 
 * @param {string|number} dni - Documento a verificar
 * @returns {Promise<{existeEnEsteGimnasio: boolean, vinculadoOtroGimnasio: boolean, gimnasio?: Object, socio?: Object, mensaje?: string}>}
 */
export async function verificarDniSocio(dni) {
  if (!dni) return null;
  const cleanDni = dni.toString().trim();
  if (!cleanDni) return null;

  const response = await fetch(`${API_URL}/socios/verificar-dni?dni=${encodeURIComponent(cleanDni)}`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al verificar DNI');
  return data;
}

/**
 * PASO 2: Creación de un nuevo socio en el gimnasio.
 * 
 * @param {Object} socioData - Datos del formulario (nombre, apellido, dni, email, telefono, etc.)
 * @returns {Promise<Object>} Datos del socio creado
 */
export async function createSocio(socioData) {
  const response = await fetch(`${API_URL}/socios`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(socioData)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Error al crear socio.');
    error.status = response.status;
    error.alertaVinculacion = data.alertaVinculacion || false;
    error.gimnasioNombre = data.gimnasioNombre;
    error.socioNombre = data.socioNombre;
    error.dni = data.dni;
    throw error;
  }
  return data;
}

/**
 * PASO 3: Consulta individual por ID.
 * 
 * @param {string|number} id - Identificador único del socio
 * @returns {Promise<Object>} Datos individuales del socio
 */
export async function getSocioById(id) {
  const response = await fetch(`${API_URL}/socios/${id}`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener socio.');
  return data.socio;
}

/**
 * PASO 4: Actualización completa de datos de un socio.
 * 
 * @param {string|number} id - Identificador único
 * @param {Object} socioData - Nuevos datos modificados
 * @returns {Promise<Object>}
 */
export async function updateSocio(id, socioData) {
  const response = await fetch(`${API_URL}/socios/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(socioData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al actualizar socio.');
  return data;
}

/**
 * PASO 5: Eliminación de un socio.
 * 
 * @param {string|number} id - Identificador del socio a dar de baja
 * @returns {Promise<Object>} Confirmación de eliminación
 */
export async function deleteSocio(id) {
  const response = await fetch(`${API_URL}/socios/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al eliminar socio.');
  return data;
}

/**
 * PASO 6: Cambio ágil de estado (activo/inactivo).
 * 
 * @param {string|number} id - ID del socio
 * @param {string} estado - Nuevo estado
 * @returns {Promise<Object>}
 */
export async function changeEstadoSocio(id, estado) {
  const response = await fetch(`${API_URL}/socios/${id}/estado`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ estado })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al cambiar estado del socio.');
  return data;
}

/**
 * PASO 7: Consulta de perfil propio (usado en la vista de perfil de socio).
 * 
 * @param {string|number|null} [id=null]
 * @returns {Promise<Object>} Perfil y datos del socio actual
 */
export async function getPerfilSocio(id = null) {
  const url = id ? `${API_URL}/socios/perfil?id=${id}` : `${API_URL}/socios/perfil`;
  const response = await fetch(url, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener el perfil.');
  return data;
}

/**
 * PASO 8: Actualización de perfil propio del socio.
 * 
 * @param {Object} datos - Nuevos datos de contacto o perfil
 * @returns {Promise<Object>}
 */
export async function updatePerfilSocio(datos) {
  const response = await fetch(`${API_URL}/socios/perfil`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(datos)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al actualizar el perfil.');
  return data;
}