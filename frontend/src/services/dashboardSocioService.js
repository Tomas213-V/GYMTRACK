const API_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/socio` 
  : 'http://localhost:3000/api/socio';

/**
 * Obtener headers comunes con token JWT
 */
function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Obtener toda la información consolidada del Dashboard de Socio
 */
export async function fetchDashboardSocio() {
  try {
    const res = await fetch(`${API_URL}/dashboard`, {
      headers: getHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener la información del dashboard.');
    }
    return data;
  } catch (error) {
    console.warn('Fallo fetchDashboardSocio:', error.message);
    throw error;
  }
}

/**
 * Registrar asistencia / check-in rápido del socio
 */
export async function realizarCheckinSocio() {
  try {
    const res = await fetch(`${API_URL}/checkin`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al registrar la asistencia.');
    }
    return data;
  } catch (error) {
    console.error('Fallo realizarCheckinSocio:', error);
    throw error;
  }
}

/**
 * Registrar nuevo progreso de peso del socio
 * @param {Object} param0 - { peso, observaciones, fecha }
 */
export async function registrarProgresoSocio({ peso, observaciones, fecha }) {
  try {
    const res = await fetch(`${API_URL}/progreso`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ peso, observaciones, fecha })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al registrar el progreso.');
    }
    return data;
  } catch (error) {
    console.error('Fallo registrarProgresoSocio:', error);
    throw error;
  }
}
