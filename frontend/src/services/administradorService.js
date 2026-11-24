// ==============================================================================
// SERVICIO DE ADMINISTRADORES ORGANIZACIONALES (administrador + administrador_gimnasio)
// Fuente de verdad: gymtrack-backend-python/app/routers/administradores.py
// ==============================================================================

import { apiRequest } from './apiClient';

export async function getAdministradores({ id_gimnasio = null, signal } = {}) {
  const params = new URLSearchParams();
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/administradores${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
}

export async function getMisAsignacionesAdministrador({ signal } = {}) {
  return apiRequest('/administradores/mis-asignaciones', { signal });
}

export async function createAdministrador(adminData) {
  const payload = {
    nombre: String(adminData.nombre || '').trim(),
    apellido: String(adminData.apellido || '').trim(),
    email: String(adminData.email || '').trim().toLowerCase(),
    ...(adminData.dni ? { dni: String(adminData.dni).trim() } : {}),
    ...(adminData.telefono ? { telefono: String(adminData.telefono).trim() } : {}),
    ...(adminData.id_gimnasio ? { id_gimnasio: Number(adminData.id_gimnasio) } : {}),
    ...(adminData.contrasena_inicial && String(adminData.contrasena_inicial).trim()
      ? { contrasena_inicial: String(adminData.contrasena_inicial).trim() }
      : {}),
    ...(adminData.confirmar_incorporacion ? { confirmar_incorporacion: true } : {})
  };
  return apiRequest('/administradores', {
    method: 'POST',
    body: payload
  });
}

export async function updateAdministrador(idAdministrador, adminData) {
  const payload = {
    ...(adminData.nombre !== undefined ? { nombre: String(adminData.nombre).trim() } : {}),
    ...(adminData.apellido !== undefined ? { apellido: String(adminData.apellido).trim() } : {}),
    ...(adminData.dni !== undefined ? { dni: adminData.dni ? String(adminData.dni).trim() : null } : {}),
    ...(adminData.telefono !== undefined ? { telefono: adminData.telefono ? String(adminData.telefono).trim() : null } : {}),
    ...(adminData.email !== undefined ? { email: adminData.email ? String(adminData.email).trim().toLowerCase() : null } : {}),
    ...(adminData.estado !== undefined ? { estado: Boolean(adminData.estado) } : {})
  };
  return apiRequest(`/administradores/${idAdministrador}`, {
    method: 'PUT',
    body: payload
  });
}

export async function cambiarEstadoAsignacionAdministrador(idAdministradorGimnasio, estado) {
  return apiRequest(`/administradores/asignaciones/${idAdministradorGimnasio}/estado`, {
    method: 'PATCH',
    body: { estado: Boolean(estado) }
  });
}

export async function desactivarAsignacionAdministrador(idAdministradorGimnasio) {
  return apiRequest(`/administradores/asignaciones/${idAdministradorGimnasio}`, {
    method: 'DELETE'
  });
}
