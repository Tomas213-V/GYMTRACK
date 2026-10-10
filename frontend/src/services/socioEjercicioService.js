const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Consultar ejercicios disponibles del gimnasio y propios creados por el socio
 */
export async function getEjerciciosSocio({ origen = 'todos', grupo_muscular = '', search = '' } = {}) {
  const params = new URLSearchParams();
  if (origen && origen !== 'todos') params.append('origen', origen);
  if (grupo_muscular && grupo_muscular !== 'todos') params.append('grupo_muscular', grupo_muscular);
  if (search && search.trim()) params.append('search', search.trim());

  const response = await fetch(`${API_URL}/socio/ejercicios?${params.toString()}`, {
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener los ejercicios del socio.');
  }
  return data;
}

/**
 * Crear un ejercicio personalizado propio del socio
 */
export async function crearEjercicioSocio(ejercicioData) {
  const response = await fetch(`${API_URL}/socio/ejercicios`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al crear el ejercicio personalizado.');
  }
  return data;
}

/**
 * Actualizar un ejercicio propio del socio
 */
export async function actualizarEjercicioSocio(id, ejercicioData) {
  const response = await fetch(`${API_URL}/socio/ejercicios/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(ejercicioData)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al actualizar el ejercicio propio.');
  }
  return data;
}

/**
 * Eliminar un ejercicio propio del socio
 */
export async function eliminarEjercicioSocio(id) {
  const response = await fetch(`${API_URL}/socio/ejercicios/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al eliminar el ejercicio propio.');
  }
  return data;
}
