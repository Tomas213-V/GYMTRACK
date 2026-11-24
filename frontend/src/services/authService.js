// ==============================================================================
// SERVICIO DE AUTENTICACIÓN — GYMTRACK FRONTEND (SUPABASE AUTH VÍA FASTAPI)
// ==============================================================================

import { apiRequest, getStoredToken, clearSessionStorage } from './apiClient';

export async function register(userData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: userData,
    skipAuthRefresh: true
  });
}

export async function registerSocio(userData) {
  return apiRequest('/auth/register-socio', {
    method: 'POST',
    body: userData,
    skipAuthRefresh: true
  });
}

export async function login(userData) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: userData,
    skipAuthRefresh: true
  });
}

export async function loginDueno(userData) {
  return apiRequest('/auth/login-dueno', {
    method: 'POST',
    body: userData,
    skipAuthRefresh: true
  });
}

export async function loginAdministrador(userData) {
  return apiRequest('/auth/login-administrador', {
    method: 'POST',
    body: userData,
    skipAuthRefresh: true
  });
}

export async function loginEmpleado(userData) {
  return apiRequest('/auth/login-empleado', {
    method: 'POST',
    body: userData,
    skipAuthRefresh: true
  });
}

export async function loginSocio(userData) {
  return apiRequest('/auth/login-socio', {
    method: 'POST',
    body: userData,
    skipAuthRefresh: true
  });
}

export async function getContextosDisponibles({ signal } = {}) {
  return apiRequest('/auth/contextos', { signal });
}

export async function verificarIdentidad({ tipo_perfil, dni = null, email = null, id_gimnasio = null, id_sucursal = null }) {
  return apiRequest('/auth/identidades/verificar', {
    method: 'POST',
    body: {
      tipo_perfil,
      ...(dni && String(dni).trim() ? { dni: String(dni).trim() } : {}),
      ...(email && String(email).trim() ? { email: String(email).trim().toLowerCase() } : {}),
      ...(id_gimnasio ? { id_gimnasio: Number(id_gimnasio) } : {}),
      ...(id_sucursal ? { id_sucursal: Number(id_sucursal) } : {})
    }
  });
}

export async function cambiarContrasena({ contrasena_actual, nueva_contrasena, confirmar_contrasena }) {
  return apiRequest('/auth/cambiar-contrasena', {
    method: 'POST',
    body: {
      contrasena_actual,
      nueva_contrasena,
      ...(confirmar_contrasena !== undefined ? { confirmar_contrasena } : {})
    }
  });
}

export async function recuperarContrasena(email) {
  return apiRequest('/auth/recuperar-contrasena', {
    method: 'POST',
    body: { email: String(email || '').trim().toLowerCase() },
    skipAuthRefresh: true
  });
}

export async function logoutBackend() {
  return apiRequest('/auth/logout', {
    method: 'POST',
    skipAuthRefresh: true
  });
}

export async function vincularPerfil(perfilTipo) {
  const normalized = perfilTipo === 'dueño' ? 'dueno' : perfilTipo;
  return apiRequest('/auth/vincular-perfil', {
    method: 'POST',
    body: { perfil_tipo: normalized }
  });
}

export function isAuthenticated() {
  return Boolean(getStoredToken());
}

export function logoutLocal() {
  clearSessionStorage();
}

export async function getPerfilOwner({ signal } = {}) {
  return apiRequest('/auth/me', { signal });
}

export async function updatePerfilOwner(datos) {
  return apiRequest('/auth/me', {
    method: 'PUT',
    body: datos
  });
}
