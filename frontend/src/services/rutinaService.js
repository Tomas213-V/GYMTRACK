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

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al crear la rutina.');
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

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al actualizar la rutina.');
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
 * Crear un ejercicio personalizado propio para el socio
 */
export async function createEjercicioPersonalizado(ejercicioData) {
  const response = await fetch(`${API_URL}/ejercicios/personalizado`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al crear el ejercicio personalizado.');
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
