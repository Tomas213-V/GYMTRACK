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

export async function loginSocio(userData) {
  return apiRequest('/auth/login-socio', {
    method: 'POST',
    body: userData,
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
