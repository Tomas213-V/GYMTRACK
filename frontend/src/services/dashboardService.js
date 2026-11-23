// ==============================================================================
// SERVICIO DE DASHBOARD GERENCIAL — 100% DATOS REALES (SIN FALLBACKS FICTICIOS)
// ==============================================================================

import { apiRequest } from './apiClient';

export async function fetchDashboardAdmin({ id_sucursal = '', signal } = {}) {
  const qs = id_sucursal && id_sucursal !== 'todas' ? `?id_sucursal=${encodeURIComponent(id_sucursal)}` : '';
  return apiRequest(`/dashboard/admin${qs}`, { signal });
}
