// ==============================================================================
// SERVICIO DE GIMNASIOS — MULTIGIMNASIO (ORGANIZACIÓN, CATÁLOGO Y SUCURSAL INICIAL)
// ==============================================================================

import { apiRequest } from './apiClient';

export async function listarMisGimnasios({ signal } = {}) {
  return apiRequest('/gimnasios', { signal });
}

export async function listarCatalogoGimnasios({ search = '', signal } = {}) {
  const data = await apiRequest('/gimnasios/catalogo', { signal });
  const lista = Array.isArray(data?.gimnasios) ? data.gimnasios : [];
  const q = String(search || '').trim().toLowerCase();
  if (!q) return { ...data, gimnasios: lista };
  const filtrados = lista.filter(
    (g) =>
      String(g.nombre || '').toLowerCase().includes(q) ||
      String(g.telefono || '').toLowerCase().includes(q)
  );
  return { ...data, total: filtrados.length, gimnasios: filtrados };
}

export async function crearGimnasio(datosGimnasio) {
  const payload = {
    nombre: String(datosGimnasio?.nombre || '').trim(),
    ...(datosGimnasio?.telefono ? { telefono: String(datosGimnasio.telefono).trim() } : {}),
    ...(datosGimnasio?.email ? { email: String(datosGimnasio.email).trim() } : {}),
    ...(datosGimnasio?.estado !== undefined ? { estado: Boolean(datosGimnasio.estado) } : {})
  };
  return apiRequest('/gimnasios', {
    method: 'POST',
    body: payload
  });
}

export async function crearSucursalEnGimnasio(idGimnasio, sucursalData) {
  const payload = {
    direccion: String(sucursalData?.direccion || '').trim(),
    ...(sucursalData?.telefono ? { telefono: String(sucursalData.telefono).trim() } : {}),
    ...(sucursalData?.descripcion ? { descripcion: String(sucursalData.descripcion).trim() } : {}),
    ...(sucursalData?.estado !== undefined ? { estado: Boolean(sucursalData.estado) } : {})
  };
  return apiRequest(`/gimnasios/${idGimnasio}/sucursales`, {
    method: 'POST',
    gimnasioId: idGimnasio,
    body: payload
  });
}

export async function obtenerMiGimnasio({ signal } = {}) {
  return apiRequest('/gimnasios/mi-gimnasio', { signal });
}

export async function actualizarMiGimnasio(datosGimnasio, id = null) {
  const path = id ? `/gimnasios/${id}` : '/gimnasios/mi-gimnasio';
  const payload = {
    ...(datosGimnasio?.nombre !== undefined ? { nombre: String(datosGimnasio.nombre).trim() } : {}),
    ...(datosGimnasio?.telefono !== undefined ? { telefono: datosGimnasio.telefono ? String(datosGimnasio.telefono).trim() : null } : {}),
    ...(datosGimnasio?.email !== undefined ? { email: datosGimnasio.email ? String(datosGimnasio.email).trim() : null } : {}),
    ...(datosGimnasio?.estado !== undefined ? { estado: Boolean(datosGimnasio.estado) } : {})
  };
  return apiRequest(path, {
    method: 'PUT',
    body: payload
  });
}

export async function cambiarEstadoGimnasio(idGimnasio, estado) {
  return apiRequest(`/gimnasios/${idGimnasio}/estado`, {
    method: 'PATCH',
    body: { estado: Boolean(estado) }
  });
}
