// ==============================================================================
// SERVICIO DE EMPLEADOS REUTILIZABLES Y ASIGNACIONES POR SUCURSAL (N:M)
// Fuente de verdad: gymtrack-backend-python/app/routers/empleados.py
// ==============================================================================

import { apiRequest } from './apiClient';

export async function getEmpleados({
  estado = 'todos',
  search = '',
  id_sucursal = 'todas',
  rol = '',
  solo_activos = false,
  signal
} = {}) {
  const params = new URLSearchParams();
  if (id_sucursal && id_sucursal !== 'todas') params.append('id_sucursal', String(id_sucursal));
  if (rol && rol !== 'todos') params.append('rol', String(rol));
  if (solo_activos || estado === 'true' || estado === true) {
    params.append('solo_activos', 'true');
  }
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiRequest(`/empleados${qs}`, { signal });
  let lista = Array.isArray(data?.empleados) ? data.empleados : [];

  if (estado === 'false' || estado === false) {
    lista = lista.filter((e) => e.estado === false || (e.asignaciones || []).every((a) => a.estado === false));
  }

  const q = String(search || '').trim().toLowerCase();
  if (q) {
    lista = lista.filter((e) =>
      [e.nombre, e.apellido, `${e.nombre || ''} ${e.apellido || ''}`, e.dni, e.email, e.telefono]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }

  return lista;
}

export async function getMisAsignacionesEmpleado({ signal } = {}) {
  return apiRequest('/empleados/mis-asignaciones', { signal });
}

export async function getEmpleadoById(id, { signal } = {}) {
  const data = await apiRequest(`/empleados/${id}`, { signal });
  return data.empleado;
}

/**
 * Registra un nuevo empleado o reutiliza una identidad existente (por DNI/email/id_empleado)
 * y lo asigna a una sucursal con rol operativo mediante POST /api/empleados.
 */
export async function createEmpleado(empleadoData) {
  const payload = {
    id_sucursal: Number(empleadoData.id_sucursal),
    rol: String(empleadoData.rol || 'recepcionista').toLowerCase(),
    ...(empleadoData.id_empleado ? { id_empleado: Number(empleadoData.id_empleado) } : {}),
    ...(empleadoData.nombre ? { nombre: String(empleadoData.nombre).trim() } : {}),
    ...(empleadoData.apellido ? { apellido: String(empleadoData.apellido).trim() } : {}),
    ...(empleadoData.dni ? { dni: String(empleadoData.dni).trim() } : {}),
    ...(empleadoData.email ? { email: String(empleadoData.email).trim().toLowerCase() } : {}),
    ...(empleadoData.telefono ? { telefono: String(empleadoData.telefono).trim() } : {}),
    ...(empleadoData.contrasena_inicial && String(empleadoData.contrasena_inicial).trim()
      ? { contrasena_inicial: String(empleadoData.contrasena_inicial).trim() }
      : {}),
    ...(empleadoData.confirmar_incorporacion ? { confirmar_incorporacion: true } : {})
  };
  return apiRequest('/empleados', {
    method: 'POST',
    body: payload
  });
}

/**
 * Asigna un empleado existente a una sucursal adicional (POST /api/empleados/{id}/asignaciones).
 */
export async function asignarEmpleadoASucursal(idEmpleado, { id_sucursal, rol }) {
  return apiRequest(`/empleados/${idEmpleado}/asignaciones`, {
    method: 'POST',
    body: {
      id_sucursal: Number(id_sucursal),
      rol: String(rol || 'recepcionista').toLowerCase()
    }
  });
}

/**
 * Actualiza datos personales de public.empleado (PUT /api/empleados/{id_empleado}).
 */
export async function updateEmpleado(id, empleadoData) {
  const payload = {
    ...(empleadoData.nombre !== undefined ? { nombre: String(empleadoData.nombre).trim() } : {}),
    ...(empleadoData.apellido !== undefined ? { apellido: String(empleadoData.apellido).trim() } : {}),
    ...(empleadoData.dni !== undefined ? { dni: empleadoData.dni ? String(empleadoData.dni).trim() : null } : {}),
    ...(empleadoData.email !== undefined ? { email: empleadoData.email ? String(empleadoData.email).trim().toLowerCase() : null } : {}),
    ...(empleadoData.telefono !== undefined ? { telefono: empleadoData.telefono ? String(empleadoData.telefono).trim() : null } : {}),
    ...(empleadoData.estado !== undefined ? { estado: Boolean(empleadoData.estado) } : {})
  };
  return apiRequest(`/empleados/${id}`, {
    method: 'PUT',
    body: payload
  });
}

/**
 * Actualiza rol y/o estado de una asignación específica (PUT /api/empleados/asignaciones/{id}).
 */
export async function updateAsignacionEmpleado(idEmpleadoSucursal, { rol, estado }) {
  const payload = {
    ...(rol !== undefined ? { rol: String(rol).toLowerCase() } : {}),
    ...(estado !== undefined ? { estado: Boolean(estado) } : {})
  };
  return apiRequest(`/empleados/asignaciones/${idEmpleadoSucursal}`, {
    method: 'PUT',
    body: payload
  });
}

/**
 * Activa o desactiva una asignación empleado_sucursal sin eliminar la identidad del empleado.
 */
export async function cambiarEstadoAsignacionEmpleado(idEmpleadoSucursal, estado) {
  return apiRequest(`/empleados/asignaciones/${idEmpleadoSucursal}/estado`, {
    method: 'PATCH',
    body: { estado: Boolean(estado) }
  });
}

export async function desactivarAsignacionEmpleado(idEmpleadoSucursal) {
  return apiRequest(`/empleados/asignaciones/${idEmpleadoSucursal}`, {
    method: 'DELETE'
  });
}
