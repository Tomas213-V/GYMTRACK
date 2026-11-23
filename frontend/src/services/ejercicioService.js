// ==============================================================================
// SERVICIO DE EJERCICIOS DEL GIMNASIO (`public.ejercicio_gimnasio`)
// ==============================================================================

import { apiRequest } from './apiClient';

export async function getEjerciciosDueno({
  grupo_muscular = '',
  search = '',
  id_gimnasio = null,
  solo_activos = false,
  limit = 200,
  signal
} = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 200));
  const params = new URLSearchParams({ limit: String(safeLimit) });
  if (grupo_muscular && grupo_muscular !== 'todos') params.append('grupo_muscular', grupo_muscular);
  if (search && search.trim()) params.append('search', search.trim());
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  if (solo_activos) params.append('solo_activos', 'true');

  const data = await apiRequest(`/ejercicios?${params.toString()}`, { signal });
  return Array.isArray(data) ? data : data.datos || [];
}

export async function crearEjercicioDueno(ejercicioData) {
  const payload = {
    nombre: String(ejercicioData.nombre || '').trim(),
    descripcion: ejercicioData.descripcion ? String(ejercicioData.descripcion).trim() : null,
    grupo_muscular: ejercicioData.grupo_muscular ? String(ejercicioData.grupo_muscular).trim() : null,
    dificultad: ejercicioData.dificultad ? String(ejercicioData.dificultad).trim() : null,
    estado: ejercicioData.estado !== undefined ? Boolean(ejercicioData.estado) : true
  };
  if (ejercicioData.id_gimnasio != null && ejercicioData.id_gimnasio !== '') {
    payload.id_gimnasio = Number(ejercicioData.id_gimnasio);
  }

  const data = await apiRequest('/ejercicios', {
    method: 'POST',
    body: payload
  });
  return data.ejercicio || data;
}

export async function actualizarEjercicioDueno(id_ejercicio_gimnasio, ejercicioData) {
  const payload = {};
  if (ejercicioData.nombre !== undefined) payload.nombre = String(ejercicioData.nombre).trim();
  if (ejercicioData.descripcion !== undefined) {
    payload.descripcion = ejercicioData.descripcion ? String(ejercicioData.descripcion).trim() : null;
  }
  if (ejercicioData.grupo_muscular !== undefined) {
    payload.grupo_muscular = ejercicioData.grupo_muscular ? String(ejercicioData.grupo_muscular).trim() : null;
  }
  if (ejercicioData.dificultad !== undefined) {
    payload.dificultad = ejercicioData.dificultad ? String(ejercicioData.dificultad).trim() : null;
  }
  if (ejercicioData.estado !== undefined) payload.estado = Boolean(ejercicioData.estado);

  const data = await apiRequest(`/ejercicios/${id_ejercicio_gimnasio}`, {
    method: 'PUT',
    body: payload
  });
  return data.ejercicio || data;
}

export async function eliminarEjercicioDueno(id_ejercicio_gimnasio) {
  return apiRequest(`/ejercicios/${id_ejercicio_gimnasio}`, {
    method: 'DELETE'
  });
}
