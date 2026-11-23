// ==============================================================================
// SERVICIO DE ASISTENCIAS — SUCURSALES, INGRESO, SALIDA, ANULACIÓN Y FILTROS
// ==============================================================================

import { apiRequest } from './apiClient';

export async function fetchAsistencias({
  page = 1,
  limit = 10,
  search = '',
  desde = '',
  hasta = '',
  id_socio = '',
  id_sucursal = '',
  id_gimnasio = '',
  estado = '',
  signal
} = {}) {
  const params = new URLSearchParams();
  if (page) params.append('page', String(page));
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 10));
  params.append('limit', String(safeLimit));
  if (search) params.append('search', search);
  if (desde) params.append('desde', desde);
  if (hasta) params.append('hasta', hasta);
  if (id_socio && id_socio !== 'todos') params.append('id_socio', String(id_socio));
  if (id_sucursal && id_sucursal !== 'todas') params.append('id_sucursal', String(id_sucursal));
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  if (estado && estado !== 'todos') params.append('estado', estado);

  return apiRequest(`/asistencias?${params.toString()}`, { signal });
}

export async function fetchMisAsistencias({ id_gimnasio = null, id_sucursal = null, estado = '', signal } = {}) {
  const params = new URLSearchParams();
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  if (id_sucursal) params.append('id_sucursal', String(id_sucursal));
  if (estado && estado !== 'todos') params.append('estado', estado);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/asistencias/mis-asistencias${qs}`, { signal });
}

export async function registrarAsistencia({ id_socio, dni, id_sucursal } = {}) {
  const body = {};
  if (id_sucursal != null && id_sucursal !== '') body.id_sucursal = Number(id_sucursal);
  if (id_socio != null && id_socio !== '') body.id_socio = Number(id_socio);
  if (dni && String(dni).trim()) body.dni = String(dni).trim();

  return apiRequest('/asistencias', {
    method: 'POST',
    body
  });
}

export async function checkoutAsistencia(id_asistencia_socio) {
  return apiRequest(`/asistencias/${id_asistencia_socio}/salida`, {
    method: 'PATCH'
  });
}

export async function registrarSalidaAbierta({ id_socio = null } = {}) {
  const body = id_socio != null ? { id_socio: Number(id_socio) } : {};
  return apiRequest('/asistencias/salida', {
    method: 'POST',
    body
  });
}

export async function fetchEstadisticasAsistencias({ id_sucursal = '', id_gimnasio = '', signal } = {}) {
  const params = new URLSearchParams();
  if (id_sucursal && id_sucursal !== 'todas') params.append('id_sucursal', String(id_sucursal));
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/asistencias/estadisticas${qs}`, { signal });
}

export async function fetchHistorialPorSocio(id_socio, { id_gimnasio = null, id_sucursal = null, signal } = {}) {
  const params = new URLSearchParams();
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  if (id_sucursal) params.append('id_sucursal', String(id_sucursal));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/asistencias/socio/${id_socio}${qs}`, { signal });
}

export async function anularAsistencia(id_asistencia_socio, motivo = '') {
  return apiRequest(`/asistencias/${id_asistencia_socio}/anular`, {
    method: 'PATCH',
    body: {
      motivo: motivo && String(motivo).trim() ? String(motivo).trim() : null
    }
  });
}

export async function deleteAsistencia(id_asistencia_socio, motivo = '') {
  return anularAsistencia(id_asistencia_socio, motivo);
}
