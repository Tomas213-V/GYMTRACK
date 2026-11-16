/**
 * =========================================================================================
 * ARCHIVO: rutinaService.js
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Servicio para la creación y gestión de rutinas de entrenamiento y ejercicios.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * 1. Estructura de Rutina: Cada rutina contiene información general (nombre, objetivo, socio asignado, estado)
 *    y una colección de días de entrenamiento con sus correspondientes ejercicios, series, repeticiones y descansos.
 * 2. Operaciones:
 *    - `fetchRutinas()`: Búsqueda con filtros por socio y estado.
 *    - `fetchRutinaById()`: Detalle completo para visualización o edición.
 *    - `createRutina()` / `updateRutina()`: Guardado de la rutina y sus bloques de ejercicios.
 *    - `deleteRutina()`: Eliminación de la rutina.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};


/**
 * Obtener todas las rutinas con filtros opcionales
 */
export async function fetchRutinas({ search = '', id_socio = '', estado = '' } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (id_socio && id_socio !== 'todos') params.append('id_socio', id_socio);
  if (estado && estado !== 'todos') params.append('estado', estado);

  const response = await fetch(`${API_URL}/rutinas?${params.toString()}`, {
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener las rutinas.');
  return data;
}

/**
 * Obtener una rutina específica por su ID
 */
export async function fetchRutinaById(id) {
  const response = await fetch(`${API_URL}/rutinas/${id}`, {
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Error al obtener la rutina.');
  return data;
}

/**
 * Crear una nueva rutina
 */
export async function createRutina(rutinaData) {
  const response = await fetch(`${API_URL}/rutinas`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(rutinaData)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || data.message || 'Error al crear la rutina.');
  return data;
}

/**
 * Actualizar una rutina existente
 */
export async function updateRutina(id, rutinaData) {
  const response = await fetch(`${API_URL}/rutinas/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(rutinaData)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || data.message || 'Error al actualizar la rutina.');
  return data;
}

/**
 * Eliminar una rutina
 */
export async function deleteRutina(id) {
  const response = await fetch(`${API_URL}/rutinas/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al eliminar la rutina.');
  return data;
}

/**
 * Asociar un ejercicio a una rutina
 */
export async function addEjercicioToRutina(rutinaId, ejercicioData) {
  const response = await fetch(`${API_URL}/rutinas/${rutinaId}/ejercicios`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al agregar el ejercicio a la rutina.');
  return data;
}

/**
 * Actualizar parámetros de un ejercicio en la rutina
 */
export async function updateEjercicioEnRutina(rutinaId, ejercicioId, ejercicioData) {
  const response = await fetch(`${API_URL}/rutinas/${rutinaId}/ejercicios/${ejercicioId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al actualizar el ejercicio en la rutina.');
  return data;
}

/**
 * Desvincular un ejercicio de una rutina
 */
export async function removeEjercicioFromRutina(rutinaId, ejercicioId) {
  const response = await fetch(`${API_URL}/rutinas/${rutinaId}/ejercicios/${ejercicioId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al desvincular el ejercicio.');
  return data;
}

/**
 * Obtener ejercicios disponibles para el socio (del gimnasio + personalizados propios)
 * Permite filtrar por origen: 'todos' | 'gimnasio' | 'propio'
 */
export async function fetchEjerciciosDisponibles({ id_socio = '', origen = 'todos', grupo_muscular = '', search = '' } = {}) {
  const params = new URLSearchParams();
  if (id_socio) params.append('id_socio', id_socio);
  if (origen && origen !== 'todos') params.append('origen', origen);
  if (grupo_muscular && grupo_muscular !== 'todos') params.append('grupo_muscular', grupo_muscular);
  if (search) params.append('search', search);
  params.append('limit', '100');

  const response = await fetch(`${API_URL}/ejercicios/disponibles?${params.toString()}`, {
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener ejercicios disponibles.');
  return Array.isArray(data) ? data : data.datos || [];
}

/**
 * Obtener catálogo general de ejercicios
 */
export async function fetchCatalogoEjercicios({ id_socio = '', origen = 'todos', search = '', grupo_muscular = '' } = {}) {
  try {
    return await fetchEjerciciosDisponibles({ id_socio, origen, search, grupo_muscular });
  } catch {
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.append('search', search);
    if (grupo_muscular && grupo_muscular !== 'todos') params.append('grupo_muscular', grupo_muscular);
    const response = await fetch(`${API_URL}/ejercicios?${params.toString()}`, {
      headers: getHeaders()
    });
    const data = await response.json();
    return Array.isArray(data) ? data : data.datos || [];
  }
}

/**
 * Crear un ejercicio oficial asignado al gimnasio (para dueño / administrador)
 */
export async function createEjercicio(ejercicioData) {
  const response = await fetch(`${API_URL}/ejercicios`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || data.message || 'Error al crear el ejercicio del gimnasio.');
  return data.ejercicio || data;
}

/**
 * Crear un ejercicio personalizado propio para el socio
 */
export async function createEjercicioPersonalizado(ejercicioData) {
  const response = await fetch(`${API_URL}/ejercicios/personalizado`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || data.message || 'Error al crear el ejercicio personalizado.');
  return data.ejercicio || data;
}

/**
 * Eliminar un ejercicio personalizado
 */
export async function deleteEjercicioPersonalizado(id) {
  const response = await fetch(`${API_URL}/ejercicios/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al eliminar el ejercicio.');
  return data;
}

/**
 * Obtener las rutinas oficiales que ofrece el gimnasio a los socios
 */
export async function fetchRutinasOfrecidasGym() {
  const response = await fetch(`${API_URL}/rutinas/gym/ofrecidas`, {
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener programas del gimnasio.');
  return data;
}

/**
 * Adoptar / Comenzar una rutina ofrecida por el gimnasio
 */
export async function adoptarRutinaGym({ plantilla, id_plantilla, id_socio, nombre_personalizado }) {
  const response = await fetch(`${API_URL}/rutinas/adoptar`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ plantilla, id_plantilla, id_socio, nombre_personalizado })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Error al adoptar la rutina.');
  return data.rutina || data;
}

/**
 * Establecer una rutina como la rutina activa principal del socio
 */
export async function activarRutina(id) {
  const response = await fetch(`${API_URL}/rutinas/${id}/activar`, {
    method: 'PUT',
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Error al activar la rutina.');
  return data.rutina || data;
}

