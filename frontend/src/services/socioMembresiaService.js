// ==============================================================================
// SERVICIO DE MEMBRESÍAS Y PAGOS DEL SOCIO — MULTIGIMNASIO
// Fuente de verdad: gymtrack-backend-python/app/routers/dashboard_socio.py
// ==============================================================================

import { apiRequest } from './apiClient';
import { formatFechaArgentina } from '../utils/dateUtils';

const METODO_PAGO_ETIQUETAS = [
  { match: (m) => m.includes('mercadopago') || m === 'mp' || m.includes('mercado pago'), label: 'Mercado Pago' },
  { match: (m) => m.includes('uala') || m.includes('ualá'), label: 'Ualá' },
  { match: (m) => m.includes('efectivo') || m.includes('cash'), label: 'Efectivo' },
  { match: (m) => m.includes('transferencia'), label: 'Transferencia' },
  { match: (m) => m.includes('debito') || m.includes('débito'), label: 'Tarjeta de Débito' },
  { match: (m) => m.includes('credito') || m.includes('crédito') || m.includes('tarjeta'), label: 'Tarjeta de Crédito' }
];

function formatearPrecioARS(monto) {
  if (monto === null || monto === undefined || monto === '' || Number.isNaN(Number(monto))) {
    return '$0';
  }
  return `$${Number(monto).toLocaleString('es-AR')}`;
}

function obtenerEtiquetaMetodoPago(metodoPago) {
  const mNorm = String(metodoPago || '').toLowerCase().trim();
  if (!mNorm) return 'No especificado';
  const found = METODO_PAGO_ETIQUETAS.find((item) => item.match(mNorm));
  return found ? found.label : String(metodoPago).trim();
}

function obtenerEtiquetaEstadoPago(estado) {
  const eNorm = String(estado || 'pendiente').toLowerCase().trim();
  if (eNorm === 'aprobado') return 'Aprobado';
  if (eNorm === 'rechazado') return 'Rechazado';
  if (eNorm === 'anulado') return 'Anulado';
  return 'Pendiente';
}

export function normalizarPagoHistorial(pago) {
  const estadoNorm = String(pago?.estado || 'pendiente').toLowerCase().trim();
  const planNombre =
    pago?.plan_nombre ||
    pago?.membresia_socio?.membresia_gimnasio?.nombre ||
    'Plan de Membresía';
  return {
    ...pago,
    monto_formateado: pago?.monto_formateado || formatearPrecioARS(pago?.monto),
    fecha_formateada: pago?.fecha_formateada || (pago?.fecha_pago ? formatFechaArgentina(pago.fecha_pago) : 'Sin fecha'),
    metodo_pago_etiqueta: pago?.metodo_pago_etiqueta || obtenerEtiquetaMetodoPago(pago?.metodo_pago),
    plan_nombre: planNombre,
    categoria: pago?.categoria || 'Membresía',
    estado: estadoNorm,
    estado_etiqueta: pago?.estado_etiqueta || obtenerEtiquetaEstadoPago(estadoNorm)
  };
}

export async function getMiMembresia({ id_gimnasio = null, signal } = {}) {
  const qs = id_gimnasio ? `?id_gimnasio=${encodeURIComponent(id_gimnasio)}` : '';
  const data = await apiRequest(`/socio/membresia${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
  const rawPagos = Array.isArray(data?.pagos) ? data.pagos : [];
  const pagosNormalizados = rawPagos.map(normalizarPagoHistorial);
  return {
    ...data,
    pagos: pagosNormalizados,
    historial_pagos: pagosNormalizados
  };
}

export async function getPlanesDisponibles({ id_gimnasio = null, signal } = {}) {
  const qs = id_gimnasio ? `?id_gimnasio=${encodeURIComponent(id_gimnasio)}` : '';
  return apiRequest(`/socio/planes-disponibles${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
}

/**
 * Solicita una contratación o renovación en estado 'pendiente' (POST /api/socio/membresia/solicitar).
 * Respeta SolicitarMembresiaSocio (extra="forbid").
 */
export async function solicitarMembresiaPendiente({ id_membresia_gimnasio, fecha_inicio = null }) {
  return apiRequest('/socio/membresia/solicitar', {
    method: 'POST',
    body: {
      id_membresia_gimnasio: Number(id_membresia_gimnasio),
      ...(fecha_inicio ? { fecha_inicio: String(fecha_inicio).split('T')[0] } : {})
    }
  });
}

/**
 * Prepara orden de pago digital en Mercado Pago o Ualá (POST /api/socio/pagos/iniciar).
 * Respeta IniciarPagoSocio (extra="forbid"): { id_membresia_gimnasio, proveedor }.
 * Devuelve { orden, plan, socio }. El cliente nunca confirma la acreditación.
 */
export async function iniciarPagoMembresia({ id_membresia_gimnasio, proveedor = 'mercadopago' }) {
  const prov = proveedor === 'uala' ? 'uala' : 'mercadopago';
  return apiRequest('/socio/pagos/iniciar', {
    method: 'POST',
    body: {
      id_membresia_gimnasio: Number(id_membresia_gimnasio),
      proveedor: prov
    }
  });
}
