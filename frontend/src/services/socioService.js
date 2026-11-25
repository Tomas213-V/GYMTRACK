// ==============================================================================
// SERVICIO DE SOCIOS — IDENTIDAD ÚNICA Y ASOCIACIONES socio_gimnasio (N:M)
// Fuente de verdad: gymtrack-backend-python/app/routers/socios.py
// ==============================================================================

import { apiRequest } from './apiClient';

export async function fetchSocios({ page = 1, limit = 6, estado = '', search = '', id_gimnasio = null, signal } = {}) {
  const params = new URLSearchParams();
  if (page) params.append('page', String(page));
  if (limit) params.append('limit', String(limit));
  if (estado && estado !== 'todos') params.append('estado', String(estado));
  if (search) params.append('search', String(search));
  if (id_gimnasio) params.append('id_gimnasio', String(id_gimnasio));

  return apiRequest(`/socios?${params.toString()}`, { signal });
}

export async function verificarDniSocio(dni, idGimnasio = null, email = null) {
  const cleanDni = String(dni || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanDni && !cleanEmail) return null;
  const params = new URLSearchParams();
  if (cleanDni) params.append('dni', cleanDni);
  if (cleanEmail) params.append('email', cleanEmail);
  if (idGimnasio) params.append('id_gimnasio', String(idGimnasio));
  return apiRequest(`/socios/verificar-dni?${params.toString()}`);
}

/**
 * Crea un socio nuevo (con contraseña inicial opcional vía Supabase Auth) o reutiliza una
 * identidad existente y la asocia al gimnasio activo.
 */
export async function createSocio(socioData) {
  const payload = {
    ...(socioData.id_gimnasio ? { id_gimnasio: Number(socioData.id_gimnasio) } : {}),
    ...(socioData.nombre ? { nombre: String(socioData.nombre).trim() } : {}),
    ...(socioData.apellido ? { apellido: String(socioData.apellido).trim() } : {}),
    ...(socioData.dni ? { dni: String(socioData.dni).trim() } : {}),
    ...(socioData.telefono ? { telefono: String(socioData.telefono).trim() } : {}),
    ...(socioData.email ? { email: String(socioData.email).trim().toLowerCase() } : {}),
    ...(socioData.contrasena_inicial && String(socioData.contrasena_inicial).trim()
      ? { contrasena_inicial: String(socioData.contrasena_inicial).trim() }
      : {}),
    ...(socioData.confirmar_incorporacion ? { confirmar_incorporacion: true } : {})
  };
  return apiRequest('/socios', {
    method: 'POST',
    body: payload
  });
}

export async function asociarSocioGimnasio(idSocio, idGimnasio = null) {
  return apiRequest('/socios/asociar', {
    method: 'POST',
    body: {
      id_socio: Number(idSocio),
      ...(idGimnasio ? { id_gimnasio: Number(idGimnasio) } : {})
    }
  });
}

export async function listarMisGimnasiosSocio({ solo_activas = false, signal } = {}) {
  const qs = solo_activas ? '?solo_activas=true' : '';
  return apiRequest(`/socios/mis-gimnasios${qs}`, { signal });
}

export async function getSocioById(id, { id_gimnasio = null, signal } = {}) {
  const qs = id_gimnasio ? `?id_gimnasio=${encodeURIComponent(id_gimnasio)}` : '';
  const data = await apiRequest(`/socios/${id}${qs}`, {
    signal,
    ...(id_gimnasio ? { gimnasioId: id_gimnasio } : {})
  });
  if (!data?.socio) return null;
  const membresias = Array.isArray(data.membresias)
    ? data.membresias
    : (Array.isArray(data.socio.membresias)
        ? data.socio.membresias
        : (Array.isArray(data.socio.membresia) ? data.socio.membresia : []));
  const membresiaActual = data.membresia_actual || data.socio.membresia_actual || membresias[0] || null;
  return {
    ...data.socio,
    membresia: membresias,
    membresias,
    membresia_actual: membresiaActual
  };
}

/**
 * Actualiza datos personales de public.socio por personal autorizado (SocioUpdate).
 */
export async function updateSocio(id, socioData, idGimnasio = null) {
  let estadoBool;
  if (typeof socioData.estado === 'boolean') {
    estadoBool = socioData.estado;
  } else if (typeof socioData.estado === 'string') {
    const est = socioData.estado.trim().toLowerCase();
    if (est === 'activo' || est === 'activa' || est === 'true') estadoBool = true;
    else if (est === 'inactivo' || est === 'inactiva' || est === 'false') estadoBool = false;
  }

  const payload = {
    ...(socioData.nombre !== undefined ? { nombre: String(socioData.nombre).trim() } : {}),
    ...(socioData.apellido !== undefined ? { apellido: String(socioData.apellido).trim() } : {}),
    ...(socioData.dni !== undefined ? { dni: socioData.dni ? String(socioData.dni).trim() : null } : {}),
    ...(socioData.telefono !== undefined ? { telefono: socioData.telefono ? String(socioData.telefono).trim() : null } : {}),
    ...(socioData.email !== undefined ? { email: socioData.email ? String(socioData.email).trim().toLowerCase() : null } : {}),
    ...(estadoBool !== undefined ? { estado: estadoBool } : {})
  };
  const qs = idGimnasio ? `?id_gimnasio=${encodeURIComponent(idGimnasio)}` : '';
  return apiRequest(`/socios/${id}${qs}`, {
    method: 'PUT',
    body: payload
  });
}

export async function deleteSocio(id, idGimnasio = null) {
  const qs = idGimnasio ? `?id_gimnasio=${encodeURIComponent(idGimnasio)}` : '';
  return apiRequest(`/socios/${id}${qs}`, {
    method: 'DELETE'
  });
}

export async function changeEstadoSocio(id, estado, idGimnasio = null) {
  const estadoBool =
    typeof estado === 'boolean'
      ? estado
      : ['activo', 'activa', 'true', '1'].includes(String(estado).toLowerCase().trim());
  return apiRequest(`/socios/${id}/estado`, {
    method: 'PATCH',
    body: {
      estado: estadoBool,
      ...(idGimnasio ? { id_gimnasio: Number(idGimnasio) } : {})
    }
  });
}

export async function cambiarEstadoAsociacionSocio(idSocioGimnasio, estado) {
  return apiRequest(`/socios/asociaciones/${idSocioGimnasio}/estado`, {
    method: 'PATCH',
    body: { estado: Boolean(estado) }
  });
}

export async function getPerfilSocio(id = null, { signal } = {}) {
  const path = id ? `/socios/perfil?id=${encodeURIComponent(id)}` : '/socios/perfil';
  return apiRequest(path, { signal });
}

/**
 * Actualiza los datos personales propios del socio autenticado (SocioUpdatePerfil).
 * NO envía id_socio ni contraseñas (el cambio de contraseña va a PUT /api/auth/me).
 */
export async function updatePerfilSocio(datos) {
  const payload = {
    ...(datos.nombre !== undefined ? { nombre: String(datos.nombre).trim() } : {}),
    ...(datos.apellido !== undefined ? { apellido: String(datos.apellido).trim() } : {}),
    ...(datos.telefono !== undefined ? { telefono: datos.telefono ? String(datos.telefono).trim() : null } : {}),
    ...(datos.email !== undefined ? { email: datos.email ? String(datos.email).trim().toLowerCase() : null } : {}),
    ...(datos.dni !== undefined ? { dni: datos.dni ? String(datos.dni).trim() : null } : {})
  };
  return apiRequest('/socios/perfil', {
    method: 'PUT',
    body: payload
  });
}
