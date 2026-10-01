const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

async function parseAsistenciaResponse(response, fallbackMessage) {
  let data;

  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`${fallbackMessage} (HTTP ${response.status}; respuesta vacía o inválida).`);
    }
    throw new Error(`El servidor devolvió una respuesta vacía o inválida (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }

  return data;
}

/**
 * Obtener listado de asistencias con paginación y filtros
 */
export async function fetchAsistencias({ page = 1, limit = 10, search = '', desde = '', hasta = '', id_socio = '' } = {}) {
  const params = new URLSearchParams();
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);
  if (search) params.append('search', search);
  if (desde) params.append('desde', desde);
  if (hasta) params.append('hasta', hasta);
  if (id_socio && id_socio !== 'todos') params.append('id_socio', id_socio);

  const response = await fetch(`${API_URL}/asistencias?${params.toString()}`, {
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener asistencias.');
  return data;
}

/**
 * Registrar asistencia mediante id_socio o DNI
 */
export async function registrarAsistencia({ id_socio, dni } = {}) {
  const response = await fetch(`${API_URL}/asistencias`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ id_socio, dni })
  });

  return parseAsistenciaResponse(response, 'Error al registrar la asistencia.');
}

/**
 * Obtener estadísticas de asistencias (mes actual, mes anterior y tendencia)
 */
export async function fetchEstadisticasAsistencias() {
  const response = await fetch(`${API_URL}/asistencias/estadisticas`, {
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener estadísticas.');
  return data;
}

/**
 * Obtener historial de asistencias de un socio específico
 */
export async function fetchHistorialPorSocio(id_socio) {
  const response = await fetch(`${API_URL}/asistencias/socio/${id_socio}`, {
    headers: getHeaders()
  });

  return parseAsistenciaResponse(response, 'Error al obtener historial del socio.');
}

/**
 * Eliminar una asistencia por ID
 */
export async function deleteAsistencia(id_asistencia) {
  const response = await fetch(`${API_URL}/asistencias/${id_asistencia}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al eliminar la asistencia.');
  return data;
}
