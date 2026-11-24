// ==============================================================================
// CLIENTE HTTP CENTRALIZADO — GYMTRACK FRONTEND (FASTAPI + SUPABASE AUTH JWT)
// - Inyecta Authorization: Bearer <Supabase JWT>
// - Inyecta X-Gimnasio-Id, X-Sucursal-Id (si aplica) y X-Active-Role en ASCII
// - Intenta refresh automático ante 401 si existe refresh_token
// - Limpia sesión y notifica a GymContext si el token ya no es recuperable
// - Interpreta errores HTTP 400/401/403/404/409/422 (incl. FastAPI detail[])
// ==============================================================================

// Usamos 127.0.0.1 por defecto en lugar de localhost para evitar colisiones IPv6 (::1) en Windows con uvicorn (0.0.0.0)
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api').replace(/\/+$/, '');

const ACTIVE_GYM_STORAGE_KEY = 'gymtrack_active_gym_id';

export function normalizeRoleForHeader(rol) {
  if (!rol || typeof rol !== 'string') return null;
  const clean = rol.trim().toLowerCase();
  if (!clean) return null;
  if (clean === 'dueño' || clean === 'dueno' || clean === 'owner') return 'dueno';
  if (clean === 'administrador' || clean === 'admin' || clean === 'administrador_gimnasio') {
    return 'administrador';
  }
  if (clean === 'empleado' || clean === 'staff' || clean.startsWith('empleado:')) {
    return clean;
  }
  if (clean === 'socio') return 'socio';
  return null;
}

export function normalizeRoleInternal(rol) {
  const ascii = normalizeRoleForHeader(rol);
  if (ascii === 'dueno') return 'dueño';
  if (ascii && ascii.startsWith('empleado:')) return 'empleado';
  return ascii;
}

export function getStoredToken() {
  return localStorage.getItem('token');
}

export function getStoredRefreshToken() {
  return localStorage.getItem('refresh_token');
}

export function getStoredActiveGymId() {
  const raw = localStorage.getItem(ACTIVE_GYM_STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function setStoredActiveGymId(id) {
  if (id && Number(id) > 0) {
    localStorage.setItem(ACTIVE_GYM_STORAGE_KEY, String(id));
  } else {
    localStorage.removeItem(ACTIVE_GYM_STORAGE_KEY);
  }
}

export function clearSessionStorage() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('usuario');
  localStorage.removeItem('socio');
  localStorage.removeItem('rol');
  localStorage.removeItem(ACTIVE_GYM_STORAGE_KEY);
}

export function extractApiErrorMessage(data, status) {
  if (data && typeof data === 'object') {
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail.trim();
    }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        const loc = Array.isArray(first.loc)
          ? first.loc.filter((part) => part !== 'body' && part !== 'query').join('.')
          : '';
        const msg = first.msg || 'Dato inválido en la solicitud.';
        return loc ? `${loc}: ${msg}` : msg;
      }
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
  }

  switch (status) {
    case 400:
      return 'La solicitud contiene datos inválidos.';
    case 401:
      return 'Tu sesión ha expirado. Iniciá sesión nuevamente.';
    case 403:
      return 'No tenés permisos para realizar esta acción.';
    case 404:
      return 'El recurso solicitado no fue encontrado.';
    case 409:
      return 'Conflicto con el estado actual de los datos.';
    case 422:
      return 'Error de validación en los campos enviados.';
    default:
      return `Error HTTP ${status}`;
  }
}

export function buildAuthHeaders({
  gimnasioId = undefined,
  sucursalId = undefined,
  activeRole = undefined,
  extraHeaders = {}
} = {}) {
  const token = getStoredToken();
  const rolRaw = activeRole !== undefined ? activeRole : localStorage.getItem('rol');
  const rolHeader = normalizeRoleForHeader(rolRaw);
  const activeGymId = gimnasioId !== undefined ? gimnasioId : getStoredActiveGymId();

  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (activeGymId && Number(activeGymId) > 0) {
    headers['X-Gimnasio-Id'] = String(activeGymId);
  }
  if (sucursalId && Number(sucursalId) > 0) {
    headers['X-Sucursal-Id'] = String(sucursalId);
  }
  if (rolHeader) {
    headers['X-Active-Role'] = rolHeader;
  }

  return headers;
}

let refreshPromise = null;

async function tryRefreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        if (data?.token) {
          localStorage.setItem('token', data.token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          return data.token;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function notifySessionExpired() {
  clearSessionStorage();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gymtrack:session-expired'));
  }
}

/**
 * Ejecuta una petición REST autenticada contra el backend FastAPI de GymTrack.
 */
export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body = undefined,
    gimnasioId = undefined,
    sucursalId = undefined,
    activeRole = undefined,
    headers: extraHeaders = {},
    signal = undefined,
    skipAuthRefresh = false
  } = options;

  const url = path.startsWith('http')
    ? path
    : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const isIdempotentGet = method.toUpperCase() === 'GET';
  const doFetch = async () =>
    fetch(url, {
      method,
      headers: buildAuthHeaders({ gimnasioId, sucursalId, activeRole, extraHeaders }),
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {})
    });

  let response;
  try {
    response = await doFetch();
  } catch (networkErr) {
    if (networkErr?.name === 'AbortError' || signal?.aborted || !isIdempotentGet) {
      throw networkErr;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (signal?.aborted) throw networkErr;
    response = await doFetch();
  }

  if (isIdempotentGet && !signal?.aborted && (response.status === 502 || response.status === 503 || response.status === 504)) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!signal?.aborted) {
      response = await doFetch();
    }
  }

  // Reintento único tras refrescar token si expiró
  if (response.status === 401 && !skipAuthRefresh && getStoredToken()) {
    const refreshed = getStoredRefreshToken() ? await tryRefreshAccessToken() : null;
    if (refreshed) {
      response = await doFetch();
    }
    if (response.status === 401) {
      notifySessionExpired();
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(extractApiErrorMessage(data, response.status));
    err.status = response.status;
    err.code = data?.code || null;
    err.payload = data;
    throw err;
  }

  return data;
}
