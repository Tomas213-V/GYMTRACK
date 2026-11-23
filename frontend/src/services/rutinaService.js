// ==============================================================================
// SERVICIO DE RUTINAS — RUTINA_SOCIO, RUTINA_GIMNASIO Y ASIGNACIONES
// Contratos alineados 100% con app/routers/rutinas.py (extra="forbid")
// ==============================================================================

import { apiRequest } from './apiClient';

// ------------------------------------------------------------------------------
// 0. RESUMEN CONSOLIDADO (`GET /api/rutinas`)
// ------------------------------------------------------------------------------
export async function fetchRutinasResumen({ id_gimnasio = null, solo_activas = false, signal } = {}) {
  const params = new URLSearchParams();
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  if (solo_activas) params.append('solo_activas', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/rutinas${qs}`, { signal });
}

// ------------------------------------------------------------------------------
// 1. RUTINAS PERSONALES DEL SOCIO (`public.rutina_socio` / `rutina_ejercicio_socio`)
// ------------------------------------------------------------------------------
export async function fetchRutinasPersonales({ solo_activas = false, signal } = {}) {
  const qs = solo_activas ? '?solo_activas=true' : '';
  const data = await apiRequest(`/rutinas/personales${qs}`, { signal });
  return data.rutinas || [];
}

export async function fetchRutinaPersonalById(id_rutina_socio, { signal } = {}) {
  const data = await apiRequest(`/rutinas/personales/${id_rutina_socio}`, { signal });
  return data.rutina || data;
}

export async function createRutinaPersonal({
  nombre,
  descripcion = null,
  fecha_inicio = null,
  fecha_fin = null,
  estado = true
}) {
  const body = {
    nombre: String(nombre || '').trim(),
    descripcion: descripcion ? String(descripcion).trim() : null,
    estado: Boolean(estado)
  };
  if (fecha_inicio) body.fecha_inicio = fecha_inicio;
  if (fecha_fin) body.fecha_fin = fecha_fin;

  const data = await apiRequest('/rutinas/personales', {
    method: 'POST',
    body
  });
  return data.rutina || data;
}

export async function updateRutinaPersonal(id_rutina_socio, cambios) {
  const body = {};
  if (cambios.nombre !== undefined) body.nombre = String(cambios.nombre).trim();
  if (cambios.descripcion !== undefined) body.descripcion = cambios.descripcion ? String(cambios.descripcion).trim() : null;
  if (cambios.fecha_inicio !== undefined) body.fecha_inicio = cambios.fecha_inicio || null;
  if (cambios.fecha_fin !== undefined) body.fecha_fin = cambios.fecha_fin || null;
  if (cambios.estado !== undefined) body.estado = Boolean(cambios.estado);

  const data = await apiRequest(`/rutinas/personales/${id_rutina_socio}`, {
    method: 'PUT',
    body
  });
  return data.rutina || data;
}

export async function deleteRutinaPersonal(id_rutina_socio) {
  return apiRequest(`/rutinas/personales/${id_rutina_socio}`, {
    method: 'DELETE'
  });
}

export async function addEjercicioRutinaPersonal(id_rutina_socio, {
  id_ejercicio_socio,
  series = 4,
  repeticiones = 12,
  peso = 0,
  descanso = 60,
  orden = 1
}) {
  return apiRequest(`/rutinas/personales/${id_rutina_socio}/ejercicios`, {
    method: 'POST',
    body: {
      id_ejercicio_socio: Number(id_ejercicio_socio),
      series: Number(series),
      repeticiones: Number(repeticiones),
      peso: Number(peso ?? 0),
      descanso: Number(descanso ?? 60),
      orden: Number(orden)
    }
  });
}

export async function updateEjercicioRutinaPersonal(id_rutina_socio, id_item, cambios) {
  const body = {};
  if (cambios.series !== undefined) body.series = Number(cambios.series);
  if (cambios.repeticiones !== undefined) body.repeticiones = Number(cambios.repeticiones);
  if (cambios.peso !== undefined) body.peso = Number(cambios.peso);
  if (cambios.descanso !== undefined) body.descanso = Number(cambios.descanso);
  if (cambios.orden !== undefined) body.orden = Number(cambios.orden);

  return apiRequest(`/rutinas/personales/${id_rutina_socio}/ejercicios/${id_item}`, {
    method: 'PUT',
    body
  });
}

export async function removeEjercicioRutinaPersonal(id_rutina_socio, id_item) {
  return apiRequest(`/rutinas/personales/${id_rutina_socio}/ejercicios/${id_item}`, {
    method: 'DELETE'
  });
}

export async function reordenarRutinaPersonal(id_rutina_socio, ids_ordenados) {
  return apiRequest(`/rutinas/personales/${id_rutina_socio}/reordenar`, {
    method: 'PUT',
    body: { ids_ordenados: ids_ordenados.map((x) => Number(x)) }
  });
}

// ------------------------------------------------------------------------------
// 2. RUTINAS DEL GIMNASIO (`public.rutina_gimnasio` / `rutina_ejercicio_gimnasio`)
// ------------------------------------------------------------------------------
export async function fetchRutinasGimnasio({ id_gimnasio = null, solo_activas = false, signal } = {}) {
  const params = new URLSearchParams();
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  if (solo_activas) params.append('solo_activas', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiRequest(`/rutinas/gimnasio${qs}`, { signal });
  return data.rutinas || [];
}

export async function fetchRutinaGimnasioById(id_rutina_gimnasio, { signal } = {}) {
  const data = await apiRequest(`/rutinas/gimnasio/${id_rutina_gimnasio}`, { signal });
  return data.rutina || data;
}

export async function createRutinaGimnasio({
  nombre,
  descripcion = null,
  nivel = null,
  estado = true,
  id_gimnasio = null
}) {
  const body = {
    nombre: String(nombre || '').trim(),
    descripcion: descripcion ? String(descripcion).trim() : null,
    nivel: nivel ? String(nivel).trim() : null,
    estado: Boolean(estado)
  };
  if (id_gimnasio != null && id_gimnasio !== '') {
    body.id_gimnasio = Number(id_gimnasio);
  }

  const data = await apiRequest('/rutinas/gimnasio', {
    method: 'POST',
    body
  });
  return data.rutina || data;
}

export async function updateRutinaGimnasio(id_rutina_gimnasio, cambios) {
  const body = {};
  if (cambios.nombre !== undefined) body.nombre = String(cambios.nombre).trim();
  if (cambios.descripcion !== undefined) body.descripcion = cambios.descripcion ? String(cambios.descripcion).trim() : null;
  if (cambios.nivel !== undefined) body.nivel = cambios.nivel ? String(cambios.nivel).trim() : null;
  if (cambios.estado !== undefined) body.estado = Boolean(cambios.estado);

  const data = await apiRequest(`/rutinas/gimnasio/${id_rutina_gimnasio}`, {
    method: 'PUT',
    body
  });
  return data.rutina || data;
}

export async function deleteRutinaGimnasio(id_rutina_gimnasio) {
  return apiRequest(`/rutinas/gimnasio/${id_rutina_gimnasio}`, {
    method: 'DELETE'
  });
}

export async function addEjercicioRutinaGimnasio(id_rutina_gimnasio, {
  id_ejercicio_gimnasio,
  series = 4,
  repeticiones = 12,
  peso = 0,
  descanso = 60,
  orden = 1
}) {
  return apiRequest(`/rutinas/gimnasio/${id_rutina_gimnasio}/ejercicios`, {
    method: 'POST',
    body: {
      id_ejercicio_gimnasio: Number(id_ejercicio_gimnasio),
      series: Number(series),
      repeticiones: Number(repeticiones),
      peso: Number(peso ?? 0),
      descanso: Number(descanso ?? 60),
      orden: Number(orden)
    }
  });
}

export async function updateEjercicioRutinaGimnasio(id_rutina_gimnasio, id_item, cambios) {
  const body = {};
  if (cambios.series !== undefined) body.series = Number(cambios.series);
  if (cambios.repeticiones !== undefined) body.repeticiones = Number(cambios.repeticiones);
  if (cambios.peso !== undefined) body.peso = Number(cambios.peso);
  if (cambios.descanso !== undefined) body.descanso = Number(cambios.descanso);
  if (cambios.orden !== undefined) body.orden = Number(cambios.orden);

  return apiRequest(`/rutinas/gimnasio/${id_rutina_gimnasio}/ejercicios/${id_item}`, {
    method: 'PUT',
    body
  });
}

export async function removeEjercicioRutinaGimnasio(id_rutina_gimnasio, id_item) {
  return apiRequest(`/rutinas/gimnasio/${id_rutina_gimnasio}/ejercicios/${id_item}`, {
    method: 'DELETE'
  });
}

export async function reordenarRutinaGimnasio(id_rutina_gimnasio, ids_ordenados) {
  return apiRequest(`/rutinas/gimnasio/${id_rutina_gimnasio}/reordenar`, {
    method: 'PUT',
    body: { ids_ordenados: ids_ordenados.map((x) => Number(x)) }
  });
}

// ------------------------------------------------------------------------------
// 3. ASIGNACIONES DE RUTINAS (`public.rutinas_asignadas_socio_gimnasio`)
// ------------------------------------------------------------------------------
export async function fetchAsignacionesRutinas({
  id_gimnasio = null,
  id_socio = null,
  solo_activas = false,
  signal
} = {}) {
  const params = new URLSearchParams();
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));
  if (id_socio) params.append('id_socio', String(id_socio));
  if (solo_activas) params.append('solo_activas', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiRequest(`/rutinas/asignaciones${qs}`, { signal });
  return data.asignaciones || [];
}

export async function asignarRutinaASocio({
  id_rutina_gimnasio,
  id_socio_gimnasio,
  fecha_finalizacion = null,
  observaciones = null,
  id_empleado_responsable = null
}) {
  const body = {
    id_rutina_gimnasio: Number(id_rutina_gimnasio),
    id_socio_gimnasio: Number(id_socio_gimnasio)
  };
  if (fecha_finalizacion) body.fecha_finalizacion = fecha_finalizacion;
  if (observaciones && String(observaciones).trim()) body.observaciones = String(observaciones).trim();
  if (id_empleado_responsable != null && id_empleado_responsable !== '') {
    body.id_empleado_responsable = Number(id_empleado_responsable);
  }

  return apiRequest('/rutinas/asignaciones', {
    method: 'POST',
    body
  });
}

export async function reasignarResponsableRutina(id_rutina_asignada, {
  id_empleado_responsable,
  observaciones = null
}) {
  const body = {
    id_empleado_responsable: Number(id_empleado_responsable)
  };
  if (observaciones !== undefined) {
    body.observaciones = observaciones && String(observaciones).trim() ? String(observaciones).trim() : null;
  }

  return apiRequest(`/rutinas/asignaciones/${id_rutina_asignada}/responsable`, {
    method: 'PATCH',
    body
  });
}

export async function finalizarAsignacionRutina(id_rutina_asignada, {
  fecha_finalizacion = null,
  observaciones = null
} = {}) {
  const body = {};
  if (fecha_finalizacion) body.fecha_finalizacion = fecha_finalizacion;
  if (observaciones && String(observaciones).trim()) body.observaciones = String(observaciones).trim();

  return apiRequest(`/rutinas/asignaciones/${id_rutina_asignada}/finalizar`, {
    method: 'PATCH',
    body
  });
}
