/**
 * =========================================================================================
 * ARCHIVO: ejercicioService.js
 * RUTA: frontend/src/services/ejercicioService.js
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Servicio para la gestión del catálogo de ejercicios desde el panel del Dueño.
 * =========================================================================================
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
 * Consultar catálogo de ejercicios del gimnasio (excluye ejercicios personales de socios)
 */
export async function getEjerciciosDueno({ grupo_muscular = '', search = '' } = {}) {
  const params = new URLSearchParams({ limit: 'all' });
  if (grupo_muscular && grupo_muscular !== 'todos') {
    params.append('grupo_muscular', grupo_muscular);
  }
  if (search && search.trim()) {
    params.append('search', search.trim());
  }

  const response = await fetch(`${API_URL}/ejercicios?${params.toString()}`, {
    headers: getHeaders()
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.detail || 'Error al obtener el catálogo de ejercicios.');
  }

  const lista = Array.isArray(data) ? data : data.datos || [];
  return lista.filter((ej) => !ej.id_socio);
}

/**
 * Crear un ejercicio oficial asignado al gimnasio del dueño
 */
export async function crearEjercicioDueno(ejercicioData) {
  const response = await fetch(`${API_URL}/ejercicios`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.detail || data.message || 'Error al crear el ejercicio.');
  }

  return data.ejercicio || data;
}

/**
 * Actualizar un ejercicio del gimnasio
 */
export async function actualizarEjercicioDueno(id, ejercicioData) {
  const response = await fetch(`${API_URL}/ejercicios/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.detail || data.message || 'Error al actualizar el ejercicio.');
  }

  return data.ejercicio || data;
}

/**
 * Eliminar un ejercicio del gimnasio
 */
export async function eliminarEjercicioDueno(id) {
  const response = await fetch(`${API_URL}/ejercicios/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.detail || data.message || 'Error al eliminar el ejercicio.');
  }

  return data;
}
