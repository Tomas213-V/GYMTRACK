// ==============================================================================
// SERVICIO DE PLANES (membresia_gimnasio) Y CONTRATACIONES (membresia_socio)
// Fuente de verdad: routers/planes_membresia.py y routers/membresias.py
// ==============================================================================

import { apiRequest } from './apiClient';

export async function getPlanesMembresia(estado = 'todos', { id_gimnasio = null, signal } = {}) {
  const params = new URLSearchParams();
  if (estado && estado !== 'todos') params.append('estado', String(estado));
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiRequest(`/planes-membresia${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
  return data.planes || [];
}

export async function getCatalogoPlanes({ id_gimnasio = null, signal } = {}) {
  const qs = id_gimnasio ? `?id_gimnasio=${encodeURIComponent(id_gimnasio)}` : '';
  return apiRequest(`/planes-membresia/catalogo${qs}`, { signal });
}

export async function getPlanMembresiaById(id, { signal } = {}) {
  const data = await apiRequest(`/planes-membresia/${id}`, { signal });
  return data.plan;
}

export async function createPlanMembresia(planData) {
  const payload = {
    nombre: String(planData.nombre || '').trim(),
    descripcion: planData.descripcion ? String(planData.descripcion).trim() : null,
    precio: Number(planData.precio),
    duracion_dias: Number(planData.duracion_dias),
    limite_asistencias_semanales:
      planData.limite_asistencias_semanales !== '' && planData.limite_asistencias_semanales != null
        ? Number(planData.limite_asistencias_semanales)
        : null,
    limite_asistencias_totales:
      planData.limite_asistencias_totales !== '' && planData.limite_asistencias_totales != null
        ? Number(planData.limite_asistencias_totales)
        : null,
    estado: planData.estado !== undefined ? Boolean(planData.estado) : true
  };
  return apiRequest('/planes-membresia', {
    method: 'POST',
    body: payload
  });
}

export async function updatePlanMembresia(id, planData) {
  const payload = {
    ...(planData.nombre !== undefined ? { nombre: String(planData.nombre).trim() } : {}),
    ...(planData.descripcion !== undefined
      ? { descripcion: planData.descripcion ? String(planData.descripcion).trim() : null }
      : {}),
    ...(planData.precio !== undefined ? { precio: Number(planData.precio) } : {}),
    ...(planData.duracion_dias !== undefined ? { duracion_dias: Number(planData.duracion_dias) } : {}),
    ...(planData.limite_asistencias_semanales !== undefined
      ? {
          limite_asistencias_semanales:
            planData.limite_asistencias_semanales !== '' && planData.limite_asistencias_semanales != null
              ? Number(planData.limite_asistencias_semanales)
              : null
        }
      : {}),
    ...(planData.limite_asistencias_totales !== undefined
      ? {
          limite_asistencias_totales:
            planData.limite_asistencias_totales !== '' && planData.limite_asistencias_totales != null
              ? Number(planData.limite_asistencias_totales)
              : null
        }
      : {}),
    ...(planData.estado !== undefined ? { estado: Boolean(planData.estado) } : {})
  };
  return apiRequest(`/planes-membresia/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function cambiarEstadoPlanMembresia(id, estado) {
  return apiRequest(`/planes-membresia/${id}/estado`, {
    method: 'PATCH',
    body: { estado: Boolean(estado) }
  });
}

export async function deshabilitarPlanMembresia(id) {
  return apiRequest(`/planes-membresia/${id}/desactivar`, {
    method: 'PATCH'
  });
}

export async function deletePlanMembresia(id) {
  return apiRequest(`/planes-membresia/${id}`, {
    method: 'DELETE'
  });
}

export async function getMembresiasSocios({ estado = 'todos', id_socio = '', signal } = {}) {
  const params = new URLSearchParams();
  if (estado && estado !== 'todos') params.append('estado', String(estado));
  if (id_socio) params.append('id_socio', String(id_socio));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiRequest(`/membresias${qs}`, { signal });
  return data.membresias || [];
}

export async function getMembresiaSocioById(id, { signal } = {}) {
  const data = await apiRequest(`/membresias/${id}`, { signal });
  return data.membresia;
}

/**
 * Contrata una membresía (MembresiaCreate con extra="forbid").
 * El precio y duración los resuelve el backend desde public.membresia_gimnasio.
 */
export async function createMembresiaSocio(membData) {
  const estadoInicial = String(membData.estado || 'activa').toLowerCase() === 'pendiente' ? 'pendiente' : 'activa';
  const payload = {
    ...(membData.id_socio ? { id_socio: Number(membData.id_socio) } : {}),
    id_membresia_gimnasio: Number(membData.id_membresia_gimnasio),
    ...(membData.id_gimnasio ? { id_gimnasio: Number(membData.id_gimnasio) } : {}),
    ...(membData.fecha_inicio ? { fecha_inicio: String(membData.fecha_inicio).split('T')[0] } : {}),
    estado: estadoInicial,
    registrar_pago: Boolean(membData.registrar_pago),
    ...(membData.metodo_pago ? { metodo_pago: String(membData.metodo_pago).toLowerCase() } : {}),
    ...(membData.estado_pago ? { estado_pago: String(membData.estado_pago).toLowerCase() } : {}),
    ...(membData.comprobante ? { comprobante: String(membData.comprobante).trim() } : {}),
    ...(membData.cancelar_activas_previas ? { cancelar_activas_previas: true } : {})
  };
  return apiRequest('/membresias', {
    method: 'POST',
    body: payload
  });
}

/**
 * Renueva creando una nueva fila histórica (POST /api/membresias/renovar).
 */
export async function renovarMembresiaSocio(membData) {
  const estadoInicial = String(membData.estado || 'activa').toLowerCase() === 'pendiente' ? 'pendiente' : 'activa';
  const payload = {
    ...(membData.id_socio ? { id_socio: Number(membData.id_socio) } : {}),
    id_membresia_gimnasio: Number(membData.id_membresia_gimnasio),
    ...(membData.id_gimnasio ? { id_gimnasio: Number(membData.id_gimnasio) } : {}),
    ...(membData.fecha_inicio ? { fecha_inicio: String(membData.fecha_inicio).split('T')[0] } : {}),
    estado: estadoInicial,
    registrar_pago: Boolean(membData.registrar_pago),
    ...(membData.metodo_pago ? { metodo_pago: String(membData.metodo_pago).toLowerCase() } : {}),
    ...(membData.estado_pago ? { estado_pago: String(membData.estado_pago).toLowerCase() } : {}),
    ...(membData.comprobante ? { comprobante: String(membData.comprobante).trim() } : {}),
    ...(membData.cancelar_activas_previas ? { cancelar_activas_previas: true } : {})
  };
  return apiRequest('/membresias/renovar', {
    method: 'POST',
    body: payload
  });
}

/**
 * Actualiza campos mutables de membresia_socio (estado y/o fecha_vencimiento)
 * y soporta sincronización automática de pago + cancelación de activas previas al activar.
 */
export async function updateMembresiaSocio(id, updateData) {
  const payload = {
    ...(updateData.estado !== undefined ? { estado: String(updateData.estado).toLowerCase() } : {}),
    ...(updateData.fecha_vencimiento
      ? { fecha_vencimiento: String(updateData.fecha_vencimiento).split('T')[0] }
      : {}),
    ...(updateData.registrar_pago_si_falta ? { registrar_pago_si_falta: true } : {}),
    ...(updateData.cancelar_activas_previas ? { cancelar_activas_previas: true } : {}),
    ...(updateData.metodo_pago ? { metodo_pago: String(updateData.metodo_pago).toLowerCase() } : {}),
    ...(updateData.comprobante ? { comprobante: String(updateData.comprobante).trim() } : {})
  };
  return apiRequest(`/membresias/${id}`, {
    method: 'PATCH',
    body: payload
  });
}

export async function cancelarMembresiaSocio(id) {
  return updateMembresiaSocio(id, { estado: 'cancelada' });
}

export async function deleteMembresiaSocio(id) {
  return apiRequest(`/membresias/${id}`, {
    method: 'DELETE'
  });
}

export async function getSociosDropdown({ signal } = {}) {
  const data = await apiRequest('/socios?limit=all', { signal });
  return data.socios || [];
}
