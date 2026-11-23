// ==============================================================================
// SERVICIO DE EJERCICIOS DEL SOCIO (`public.ejercicio_socio` + lectura gym)
// ==============================================================================

import { apiRequest } from './apiClient';

export async function getEjerciciosSocio({
  origen = 'todos',
  id_gimnasio = null,
  grupo_muscular = '',
  search = '',
  signal
} = {}) {
  const params = new URLSearchParams();
  // El backend usa default="propio", por eso siempre enviamos origen explícito
  params.append('origen', origen || 'todos');
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  if (grupo_muscular && grupo_muscular !== 'todos') params.append('grupo_muscular', grupo_muscular);
  if (search && search.trim()) params.append('search', search.trim());

  const data = await apiRequest(`/socio/ejercicios?${params.toString()}`, { signal });
  return Array.isArray(data) ? data : [];
}

export async function crearEjercicioSocio(ejercicioData) {
  const payload = {
    nombre: String(ejercicioData.nombre || '').trim(),
    descripcion: ejercicioData.descripcion ? String(ejercicioData.descripcion).trim() : null,
    grupo_muscular: ejercicioData.grupo_muscular ? String(ejercicioData.grupo_muscular).trim() : null,
    dificultad: ejercicioData.dificultad ? String(ejercicioData.dificultad).trim() : null,
    estado: ejercicioData.estado !== undefined ? Boolean(ejercicioData.estado) : true
  };

  const data = await apiRequest('/socio/ejercicios', {
    method: 'POST',
    body: payload
  });
  return data.ejercicio || data;
}

export async function actualizarEjercicioSocio(id_ejercicio_socio, ejercicioData) {
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

  const data = await apiRequest(`/socio/ejercicios/${id_ejercicio_socio}`, {
    method: 'PUT',
    body: payload
  });
  return data.ejercicio || data;
}

export async function eliminarEjercicioSocio(id_ejercicio_socio) {
  return apiRequest(`/socio/ejercicios/${id_ejercicio_socio}`, {
    method: 'DELETE'
  });
}
