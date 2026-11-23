// ==============================================================================
// SERVICIO DE SUCURSALES (UBICACIONES FÍSICAS POR GIMNASIO ACTIVO)
// ==============================================================================

import { apiRequest } from './apiClient';

export async function getSucursales({ estado = 'todos', id_gimnasio = null, signal } = {}) {
  const params = new URLSearchParams();
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiRequest(`/sucursales${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
  const lista = Array.isArray(data?.sucursales) ? data.sucursales : [];

  if (estado === 'true' || estado === true) {
    return lista.filter((s) => s.estado !== false);
  }
  if (estado === 'false' || estado === false) {
    return lista.filter((s) => s.estado === false);
  }
  return lista;
}

export async function getSucursalById(id, { signal } = {}) {
  const data = await apiRequest(`/sucursales/${id}`, { signal });
  return data.sucursal;
}

export async function createSucursal(sucursalData) {
  const payload = {
    direccion: String(sucursalData?.direccion || '').trim(),
    ...(sucursalData?.telefono ? { telefono: String(sucursalData.telefono).trim() } : {}),
    ...(sucursalData?.descripcion ? { descripcion: String(sucursalData.descripcion).trim() } : {}),
    estado: sucursalData?.estado !== undefined ? Boolean(sucursalData.estado) : true,
    ...(sucursalData?.id_gimnasio ? { id_gimnasio: Number(sucursalData.id_gimnasio) } : {})
  };
  return apiRequest('/sucursales', {
    method: 'POST',
    body: payload
  });
}

export async function updateSucursal(id, sucursalData) {
  const payload = {
    ...(sucursalData?.direccion !== undefined ? { direccion: String(sucursalData.direccion).trim() } : {}),
    ...(sucursalData?.telefono !== undefined ? { telefono: sucursalData.telefono ? String(sucursalData.telefono).trim() : null } : {}),
    ...(sucursalData?.descripcion !== undefined ? { descripcion: sucursalData.descripcion ? String(sucursalData.descripcion).trim() : null } : {}),
    ...(sucursalData?.estado !== undefined ? { estado: Boolean(sucursalData.estado) } : {})
  };
  return apiRequest(`/sucursales/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function cambiarEstadoSucursal(id, estado) {
  return apiRequest(`/sucursales/${id}/estado`, {
    method: 'PATCH',
    body: { estado: Boolean(estado) }
  });
}

export async function desactivarSucursal(id) {
  return cambiarEstadoSucursal(id, false);
}
