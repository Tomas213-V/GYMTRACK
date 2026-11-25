// ==============================================================================
// SERVICIO DE INTEGRACIÓN DE PAGOS (MERCADO PAGO OAUTH) — GYMTRACK FRONTEND
// Fuente de verdad: gymtrack-backend-python/app/routers/integraciones_pago.py
// Nunca maneja ni almacena tokens OAuth en el navegador.
// ==============================================================================

import { apiRequest } from './apiClient';

export async function getEstadoIntegracionMP(idGimnasio = null, { signal } = {}) {
  const qs = idGimnasio ? `?id_gimnasio=${encodeURIComponent(String(idGimnasio))}` : '';
  return apiRequest(`/integraciones/mercadopago${qs}`, {
    signal,
    ...(idGimnasio ? { gimnasioId: idGimnasio } : {})
  });
}

export async function iniciarConexionMP({ id_gimnasio = null, reconectar = false } = {}) {
  return apiRequest('/integraciones/mercadopago/conectar', {
    method: 'POST',
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {}),
    body: {
      ...(id_gimnasio ? { id_gimnasio: Number(id_gimnasio) } : {}),
      reconectar: Boolean(reconectar)
    }
  });
}

export async function desconectarMP(idGimnasio = null) {
  return apiRequest('/integraciones/mercadopago/desconectar', {
    method: 'POST',
    ...(idGimnasio ? { gimnasioId: idGimnasio } : {}),
    body: {
      ...(idGimnasio ? { id_gimnasio: Number(idGimnasio) } : {})
    }
  });
}

export async function completarConexionSimuladaMP({ state, autorizado = true, id_gimnasio = null }) {
  return apiRequest('/integraciones/mercadopago/callback-simulado', {
    method: 'POST',
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {}),
    body: {
      state,
      autorizado: Boolean(autorizado)
    }
  });
}
