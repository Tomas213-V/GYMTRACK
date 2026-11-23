// ==============================================================================
// SERVICIO DE DASHBOARD DEL SOCIO — MULTIGIMNASIO + CHECK-IN/OUT POR SUCURSAL
// Alineado 100% con app/routers/dashboard_socio.py y app/routers/asistencias.py
// ==============================================================================

import { apiRequest } from './apiClient';

export async function fetchDashboardSocio({ id_gimnasio = null, signal } = {}) {
  const qs = id_gimnasio ? `?id_gimnasio=${encodeURIComponent(id_gimnasio)}` : '';
  return apiRequest(`/socio/dashboard${qs}`, { signal });
}

export async function realizarCheckinSocio({ id_sucursal } = {}) {
  return apiRequest('/socio/checkin', {
    method: 'POST',
    body: { id_sucursal: Number(id_sucursal) }
  });
}

export async function realizarCheckoutSocio({ id_asistencia_socio = null } = {}) {
  if (id_asistencia_socio) {
    return apiRequest(`/asistencias/${id_asistencia_socio}/salida`, {
      method: 'PATCH'
    });
  }
  return apiRequest('/asistencias/salida', {
    method: 'POST',
    body: {}
  });
}
