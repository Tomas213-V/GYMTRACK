const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Obtener headers comunes con token JWT si está disponible
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
 * Registrar un nuevo gimnasio vinculado al usuario autenticado
 * @param {Object} datosGimnasio - { nombre, direccion, telefono, email }
 */
export async function crearGimnasio(datosGimnasio) {
  try {
    const res = await fetch(`${API_URL}/gimnasios`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datosGimnasio),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Error al registrar el gimnasio');
    }

    return data;
  } catch (error) {
    console.error('Error en crearGimnasio:', error);
    throw error;
  }
}

/**
 * Obtener el gimnasio del usuario actualmente autenticado
 */
export async function obtenerMiGimnasio() {
  try {
    const res = await fetch(`${API_URL}/gimnasios/mi-gimnasio`, {
      headers: getHeaders(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Error al consultar el gimnasio');
    }

    return data;
  } catch (error) {
    console.error('Error en obtenerMiGimnasio:', error);
    throw error;
  }
}
