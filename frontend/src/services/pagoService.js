// ==============================================================================
// SERVICIO DE PAGOS — pago -> membresia_socio (CONTRATO ESTRICTO PagoCreate)
// Fuente de verdad: gymtrack-backend-python/app/routers/pagos.py
// ==============================================================================

import { apiRequest } from './apiClient';

const METODOS_PERMITIDOS = new Set([
  'efectivo',
  'transferencia',
  'tarjeta',
  'debito',
  'credito',
  'mercadopago',
  'uala',
  'otro'
]);

function normalizarMetodoPago(metodo) {
  const m = String(metodo || 'efectivo').trim().toLowerCase();
  if (METODOS_PERMITIDOS.has(m)) return m;
  if (m.includes('débito') || m.includes('debito')) return 'debito';
  if (m.includes('crédito') || m.includes('credito')) return 'credito';
  if (m.includes('mercado')) return 'mercadopago';
  if (m.includes('ual')) return 'uala';
  if (m.includes('transf')) return 'transferencia';
  if (m.includes('tarj')) return 'tarjeta';
  if (m.includes('efec')) return 'efectivo';
  return 'otro';
}

export async function getPagos({
  page = 1,
  limit = 10,
  estado = '',
  desde = '',
  hasta = '',
  id_membresia_socio = null,
  id_gimnasio = null,
  signal
} = {}) {
  const query = new URLSearchParams();
  if (page) query.append('page', String(page));
  if (limit) query.append('limit', String(Math.min(Number(limit) || 10, 200)));
  if (estado && estado !== 'todos') query.append('estado', String(estado).toLowerCase());
  if (desde) query.append('desde', String(desde));
  if (hasta) query.append('hasta', String(hasta));
  if (id_membresia_socio) query.append('id_membresia_socio', String(id_membresia_socio));
  if (id_gimnasio) query.append('id_gimnasio', String(id_gimnasio));

  return apiRequest(`/pagos?${query.toString()}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
}

export async function getResumenPagos({ desde = '', hasta = '', id_gimnasio = null, signal } = {}) {
  const query = new URLSearchParams();
  if (desde) query.append('desde', String(desde));
  if (hasta) query.append('hasta', String(hasta));
  if (id_gimnasio) query.append('id_gimnasio', String(id_gimnasio));
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/pagos/resumen${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
}

export async function getMembresias({ id_gimnasio = null, signal } = {}) {
  const qs = id_gimnasio ? `?id_gimnasio=${encodeURIComponent(id_gimnasio)}` : '';
  return apiRequest(`/pagos/membresias${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
}

export async function getPlanes({ id_gimnasio = null, signal } = {}) {
  const qs = id_gimnasio ? `?id_gimnasio=${encodeURIComponent(id_gimnasio)}` : '';
  const data = await apiRequest(`/pagos/planes${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Registra un pago sobre una contratación existente (PagoCreate, extra="forbid").
 */
export async function registrarPago(datos) {
  const estadoVal = String(datos.estado || 'aprobado').trim().toLowerCase();
  const estadoPermitido = ['pendiente', 'aprobado', 'rechazado'].includes(estadoVal)
    ? estadoVal
    : 'aprobado';

  const payload = {
    id_membresia_socio: Number(datos.id_membresia_socio),
    ...(datos.monto !== undefined && datos.monto !== '' && datos.monto !== null
      ? { monto: Number(datos.monto) }
      : {}),
    metodo_pago: normalizarMetodoPago(datos.metodo_pago),
    estado: estadoPermitido,
    ...(datos.comprobante ? { comprobante: String(datos.comprobante).trim() } : {}),
    ...(datos.fecha_pago ? { fecha_pago: String(datos.fecha_pago) } : {}),
    ...(datos.id_gimnasio ? { id_gimnasio: Number(datos.id_gimnasio) } : {})
  };
  return apiRequest('/pagos', {
    method: 'POST',
    body: payload
  });
}

export async function actualizarEstadoPago(id, estado) {
  return apiRequest(`/pagos/${id}/estado`, {
    method: 'PATCH',
    body: { estado: String(estado).trim().toLowerCase() }
  });
}

export async function getPagoById(id, { signal } = {}) {
  return apiRequest(`/pagos/${id}`, { signal });
}

export async function eliminarPago(id) {
  return apiRequest(`/pagos/${id}`, {
    method: 'DELETE'
  });
}
