// ==============================================================================
// CONTEXTO GLOBAL DE AUTENTICACIÓN, ROLES Y GIMNASIO ACTIVO (MULTIGIMNASIO)
// ==============================================================================
// Roles soportados según FastAPI (`app/core/dependencies.py`):
//   - 'dueño'          : propietario de uno o más gimnasios (`public.dueno`)
//   - 'administrador'  : administrador organizacional (`public.administrador` + `administrador_gimnasio`)
//   - 'empleado'       : personal operativo por sucursal (`public.empleado` + `empleado_sucursal`:
//                        sub-roles 'administrador' [sucursal], 'recepcionista', 'entrenador')
//   - 'socio'          : cliente/alumno multi-gimnasio (`public.socio` + `socio_gimnasio`)
// ==============================================================================

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  apiRequest,
  getStoredToken,
  getStoredActiveGymId,
  setStoredActiveGymId,
  getStoredActiveSucursalId,
  setStoredActiveSucursalId,
  getStoredContextConfirmed,
  setStoredContextConfirmed,
  getStoredContextosDisponibles,
  setStoredContextosDisponibles,
  clearSessionStorage,
  normalizeRoleInternal
} from '../services/apiClient';
import {
  vincularPerfil as vincularPerfilApi,
  logoutBackend as logoutBackendApi
} from '../services/authService';

const GymContext = createContext(null);

function leerObjetoLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function resolverGymValido(gimnasiosLista, preferidoId = null) {
  if (!Array.isArray(gimnasiosLista) || gimnasiosLista.length === 0) {
    return null;
  }

  const candidatos = [preferidoId, getStoredActiveGymId()].filter(Boolean).map(Number);
  for (const cid of candidatos) {
    const found = gimnasiosLista.find((g) => Number(g.id_gimnasio) === cid);
    if (found) return found;
  }

  return gimnasiosLista.find((g) => g.estado !== false) || gimnasiosLista[0];
}

export function GymProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [rol, setRol] = useState(() => normalizeRoleInternal(localStorage.getItem('rol')) || null);
  const [usuario, setUsuario] = useState(() => leerObjetoLocal('socio') || leerObjetoLocal('usuario'));
  const [gimnasios, setGimnasios] = useState(() => {
    const u = leerObjetoLocal('socio') || leerObjetoLocal('usuario');
    if (Array.isArray(u?.gimnasios)) return u.gimnasios;
    if (u?.gimnasio?.id_gimnasio) return [u.gimnasio];
    return [];
  });
  const [gimnasioActivo, setGimnasioActivo] = useState(() => {
    const u = leerObjetoLocal('socio') || leerObjetoLocal('usuario');
    const lista = Array.isArray(u?.gimnasios) ? u.gimnasios : (u?.gimnasio ? [u.gimnasio] : []);
    return resolverGymValido(lista);
  });
  const [sucursales, setSucursales] = useState(() => {
    const u = leerObjetoLocal('usuario');
    return Array.isArray(u?.sucursales) ? u.sucursales : [];
  });
  const [sucursalesAsignadas, setSucursalesAsignadas] = useState(() => {
    const u = leerObjetoLocal('usuario');
    return Array.isArray(u?.sucursales_asignadas) ? u.sucursales_asignadas : [];
  });
  const [sucursalActivaId, setSucursalActivaId] = useState(() => getStoredActiveSucursalId());
  const [contextosDisponibles, setContextosDisponibles] = useState(() => getStoredContextosDisponibles());
  const [contextoConfirmado, setContextoConfirmado] = useState(() => getStoredContextConfirmed());
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextVersion, setContextVersion] = useState(0);
  const activeAbortRef = useRef(null);
  const rolRef = useRef(rol);
  const gymIdRef = useRef(gimnasioActivo?.id_gimnasio ?? null);
  const gymsKeyRef = useRef('');
  const sucsKeyRef = useRef('');

  useEffect(() => {
    rolRef.current = rol;
  }, [rol]);

  useEffect(() => {
    gymIdRef.current = gimnasioActivo?.id_gimnasio ?? null;
  }, [gimnasioActivo]);

  useEffect(() => {
    gymsKeyRef.current = JSON.stringify((gimnasios || []).map((g) => `${g.id_gimnasio}:${g.estado !== false}`));
  }, [gimnasios]);

  useEffect(() => {
    sucsKeyRef.current = JSON.stringify((sucursales || []).map((s) => `${s.id_sucursal}:${s.estado !== false}`));
  }, [sucursales]);

  const resetLocalState = useCallback(() => {
    setToken(null);
    setRol(null);
    setUsuario(null);
    setGimnasios([]);
    setGimnasioActivo(null);
    setSucursales([]);
    setSucursalesAsignadas([]);
    setSucursalActivaId(null);
    setContextosDisponibles([]);
    setContextoConfirmado(true);
    setContextVersion((v) => v + 1);
  }, []);

  const sincronizarUsuarioLocal = useCallback((userData, roleValue, gymSelected, gymsList, sucsList = [], sucsAsigList = []) => {
    const normalizedRole = normalizeRoleInternal(roleValue) || 'dueño';
    const enriched = {
      ...(userData || {}),
      rol: normalizedRole,
      gimnasio: gymSelected || null,
      gimnasios: gymsList || [],
      sucursales: sucsList || userData?.sucursales || [],
      sucursales_asignadas: sucsAsigList || userData?.sucursales_asignadas || [],
      id_gimnasio: gymSelected?.id_gimnasio || null
    };

    if (normalizedRole === 'socio') {
      localStorage.setItem('socio', JSON.stringify(enriched));
      localStorage.setItem('usuario', JSON.stringify(enriched));
    } else {
      localStorage.removeItem('socio');
      localStorage.setItem('usuario', JSON.stringify(enriched));
    }
    localStorage.setItem('rol', normalizedRole);
    setUsuario(enriched);
  }, []);

  /**
   * Establece la sesión tras login o registro exitoso.
   * Limpia primero cualquier rastro de sesiones previas (token, refresh_token, gimnasio/sucursal activa)
   * para evitar cualquier cruce de cuentas o gimnasios entre usuarios en el mismo navegador.
   */
  const setSession = useCallback(
    ({
      token: newToken,
      refresh_token: newRefreshToken,
      usuario: userObj,
      socio: socioObj,
      gimnasios: gymsParam,
      sucursales: sucsParam,
      sucursales_asignadas: sucsAsigParam,
      contextos_disponibles: contextosParam,
      requiere_seleccion_gimnasio: reqSelParam
    }) => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      activeAbortRef.current = new AbortController();

      // Limpieza total previa para que jamás sobreviva un refresh_token o id_gimnasio de otra cuenta
      clearSessionStorage();

      const targetUser = socioObj || userObj || null;
      const roleValue = normalizeRoleInternal(targetUser?.rol || (socioObj ? 'socio' : 'dueño'));
      const gymsList = Array.isArray(gymsParam)
        ? gymsParam
        : Array.isArray(targetUser?.gimnasios)
        ? targetUser.gimnasios
        : targetUser?.gimnasio
        ? [targetUser.gimnasio]
        : [];
      const sucsList = Array.isArray(sucsParam) ? sucsParam : targetUser?.sucursales || [];
      const sucsAsigList = Array.isArray(sucsAsigParam)
        ? sucsAsigParam
        : targetUser?.sucursales_asignadas || [];
      const contextosList = Array.isArray(contextosParam) ? contextosParam : [];
      const necesitaSelector = Boolean(reqSelParam || contextosList.length > 1);

      if (newToken) {
        localStorage.setItem('token', newToken);
        setToken(newToken);
      } else {
        setToken(null);
      }
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken);
      }

      setStoredContextosDisponibles(contextosList);
      setContextosDisponibles(contextosList);

      let gymValido = null;
      let sucIdValida = null;

      if (necesitaSelector) {
        setStoredActiveGymId(null);
        setStoredActiveSucursalId(null);
        setStoredContextConfirmed(false);
        setContextoConfirmado(false);
      } else {
        const unicoCtx = contextosList.length === 1 ? contextosList[0] : null;
        gymValido = resolverGymValido(gymsList, unicoCtx?.id_gimnasio || targetUser?.id_gimnasio);
        sucIdValida =
          roleValue === 'empleado'
            ? (unicoCtx?.id_sucursal || targetUser?.id_sucursal || null)
            : null;
        setStoredActiveGymId(gymValido?.id_gimnasio || null);
        setStoredActiveSucursalId(sucIdValida);
        setStoredContextConfirmed(true);
        setContextoConfirmado(true);
      }

      setRol(roleValue);
      setGimnasios(gymsList);
      setGimnasioActivo(gymValido);
      setSucursales(sucsList);
      setSucursalesAsignadas(sucsAsigList);
      setSucursalActivaId(sucIdValida);
      sincronizarUsuarioLocal(targetUser, roleValue, gymValido, gymsList, sucsList, sucsAsigList);
      setContextVersion((v) => v + 1);
    },
    [sincronizarUsuarioLocal]
  );

  /**
   * Revalida sesión, rol, permisos y gimnasios autorizados contra /api/auth/me.
   */
  const refreshProfile = useCallback(
    async (preferidoGymId = null, roleOverride = undefined, preferidoSucursalId = null) => {
      const currentToken = getStoredToken();
      if (!currentToken) return null;

      try {
        setLoadingContext(true);
        const data = await apiRequest('/auth/me', {
          ...(roleOverride !== undefined ? { activeRole: roleOverride } : {}),
          ...(preferidoGymId ? { gimnasioId: preferidoGymId } : {}),
          ...(preferidoSucursalId ? { sucursalId: preferidoSucursalId } : {})
        });
        const u = data?.usuario;
        if (!u) return null;

        const roleValue = normalizeRoleInternal(u.rol || roleOverride || rolRef.current || 'dueño');
        const gymsList = Array.isArray(data.gimnasios)
          ? data.gimnasios
          : Array.isArray(u.gimnasios)
          ? u.gimnasios
          : [];
        const sucsList = Array.isArray(data.sucursales) ? data.sucursales : u.sucursales || [];
        const sucsAsigList = Array.isArray(data.sucursales_asignadas)
          ? data.sucursales_asignadas
          : u.sucursales_asignadas || [];
        const contextosList = Array.isArray(data.contextos_disponibles)
          ? data.contextos_disponibles
          : getStoredContextosDisponibles();

        setStoredContextosDisponibles(contextosList);
        setContextosDisponibles(contextosList);

        const confirmedNow = getStoredContextConfirmed();
        const gymValido =
          !confirmedNow && contextosList.length > 1 && !preferidoGymId
            ? null
            : resolverGymValido(gymsList, preferidoGymId || u.id_gimnasio);
        const sucIdValida =
          roleValue === 'empleado'
            ? (preferidoSucursalId || getStoredActiveSucursalId() || u.id_sucursal || null)
            : null;

        setStoredActiveGymId(gymValido?.id_gimnasio || null);
        if (roleValue === 'empleado') {
          setStoredActiveSucursalId(sucIdValida);
        } else {
          setStoredActiveSucursalId(null);
        }

        const nextGymsKey = JSON.stringify(gymsList.map((g) => `${g.id_gimnasio}:${g.estado !== false}`));
        const nextSucsKey = JSON.stringify(sucsList.map((s) => `${s.id_sucursal}:${s.estado !== false}`));
        const changed =
          roleValue !== rolRef.current ||
          Number(gymValido?.id_gimnasio || 0) !== Number(gymIdRef.current || 0) ||
          nextGymsKey !== gymsKeyRef.current ||
          nextSucsKey !== sucsKeyRef.current ||
          preferidoGymId !== null ||
          preferidoSucursalId !== null ||
          roleOverride !== undefined;

        setToken(getStoredToken());
        setRol(roleValue);
        setGimnasios(gymsList);
        setGimnasioActivo(gymValido);
        setSucursales(sucsList);
        setSucursalesAsignadas(sucsAsigList);
        setSucursalActivaId(sucIdValida);
        sincronizarUsuarioLocal(u, roleValue, gymValido, gymsList, sucsList, sucsAsigList);
        if (changed) {
          setContextVersion((v) => v + 1);
        }
        return { usuario: u, gimnasios: gymsList, gimnasioActivo: gymValido, rol: roleValue, contextos_disponibles: contextosList };
      } catch (err) {
        if (err.status === 401) {
          clearSessionStorage();
          resetLocalState();
        }
        return null;
      } finally {
        setLoadingContext(false);
      }
    },
    [sincronizarUsuarioLocal, resetLocalState]
  );

  // Escuchar expiración de sesión disparada desde apiClient
  useEffect(() => {
    const handleExpired = () => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      resetLocalState();
    };
    window.addEventListener('gymtrack:session-expired', handleExpired);
    return () => window.removeEventListener('gymtrack:session-expired', handleExpired);
  }, [resetLocalState]);

  // Sincronizar automáticamente si otra pestaña inicia o cierra sesión en el mismo navegador
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key !== 'token' && event.key !== null) return;
      const latestToken = getStoredToken();
      if (!latestToken) {
        if (activeAbortRef.current) {
          activeAbortRef.current.abort();
        }
        resetLocalState();
      } else {
        setToken(latestToken);
        refreshProfile();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [resetLocalState, refreshProfile]);

  useEffect(() => {
    if (getStoredToken()) {
      refreshProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Cambia el gimnasio activo en memoria y localStorage sin cerrar sesión.
   */
  const seleccionarGimnasio = useCallback(
    (idGimnasio) => {
      const targetId = Number(idGimnasio);
      const encontrado = gimnasios.find((g) => Number(g.id_gimnasio) === targetId);
      if (!encontrado) return false;

      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      activeAbortRef.current = new AbortController();

      setStoredActiveGymId(encontrado.id_gimnasio);
      setGimnasioActivo(encontrado);

      if (usuario && rol) {
        sincronizarUsuarioLocal(usuario, rol, encontrado, gimnasios, sucursales, sucursalesAsignadas);
      }

      setContextVersion((v) => v + 1);
      window.dispatchEvent(
        new CustomEvent('gymtrack:gym-changed', {
          detail: { id_gimnasio: encontrado.id_gimnasio, gimnasio: encontrado }
        })
      );
      return true;
    },
    [gimnasios, usuario, rol, sucursales, sucursalesAsignadas, sincronizarUsuarioLocal]
  );

  /**
   * Cambia de perfil activo para cuentas multi-perfil (revalida en backend).
   */
  const cambiarRolActivo = useCallback(
    async (nuevoRol) => {
      const normalized = normalizeRoleInternal(nuevoRol);
      if (!normalized) return null;
      const result = await refreshProfile(null, normalized);
      if (result) {
        setContextVersion((v) => v + 1);
      }
      return result;
    },
    [refreshProfile]
  );

  /**
   * Vincula un perfil preexistente (socio, administrador, empleado o dueno) vía RPC.
   */
  const vincularPerfilCuenta = useCallback(
    async (perfilTipo) => {
      const res = await vincularPerfilApi(perfilTipo);
      await refreshProfile();
      setContextVersion((v) => v + 1);
      return res;
    },
    [refreshProfile]
  );

  /**
   * Confirma el gimnasio (y sucursal para empleados) elegido en la pantalla de selector post-login.
   */
  const confirmarContexto = useCallback(
    async (contextoElegido) => {
      if (!contextoElegido || !contextoElegido.id_gimnasio) return false;
      const targetGymId = Number(contextoElegido.id_gimnasio);
      const targetSucId = contextoElegido.id_sucursal ? Number(contextoElegido.id_sucursal) : null;
      const targetRol = normalizeRoleInternal(contextoElegido.rol || rolRef.current);

      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      activeAbortRef.current = new AbortController();

      setStoredActiveGymId(targetGymId);
      setStoredActiveSucursalId(targetSucId);
      setStoredContextConfirmed(true);
      setContextoConfirmado(true);
      setSucursalActivaId(targetSucId);

      const refreshed = await refreshProfile(targetGymId, targetRol, targetSucId);
      if (!refreshed) {
        setStoredContextConfirmed(false);
        setContextoConfirmado(false);
        return false;
      }
      setContextVersion((v) => v + 1);
      return true;
    },
    [refreshProfile]
  );

  const logout = useCallback(() => {
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }
    if (getStoredToken()) {
      logoutBackendApi().catch(() => {});
    }
    clearSessionStorage();
    resetLocalState();
  }, [resetLocalState]);

  const hasPermission = useCallback(
    (permiso) => {
      if (rol === 'dueño') return true;
      if (rol === 'empleado') {
        const permisosEmpleado = [
          'ver_socios',
          'gestionar_socios',
          'gestionar_membresias',
          'gestionar_pagos',
          'ver_asistencias',
          'gestionar_asistencias',
          'gestionar_ejercicios',
          'gestionar_rutinas'
        ];
        return permisosEmpleado.includes(permiso);
      }
      const perms = usuario?.permisos || [];
      return perms.includes('*') || perms.includes(permiso);
    },
    [rol, usuario]
  );

  const esDueno = rol === 'dueño';
  const esAdministrador = rol === 'administrador';
  const esEmpleado = rol === 'empleado';
  const esAdminSucursal =
    esEmpleado &&
    Array.isArray(usuario?.roles_empleado) &&
    usuario.roles_empleado.includes('administrador');
  const esStaff = esDueno || esAdministrador || esEmpleado;
  const esSocio = rol === 'socio';
  const requiereSeleccionContexto = Boolean(
    token && !contextoConfirmado && contextosDisponibles.length > 1
  );
  const sucursalActiva = useMemo(() => {
    if (!sucursalActivaId) return null;
    const pool = [...(sucursalesAsignadas || []), ...(sucursales || [])];
    return pool.find((s) => Number(s.id_sucursal) === Number(sucursalActivaId)) || null;
  }, [sucursalActivaId, sucursalesAsignadas, sucursales]);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      rol,
      esDueno,
      esAdministrador,
      esEmpleado,
      esAdminSucursal,
      esStaff,
      esSocio,
      perfilesDisponibles: Array.isArray(usuario?.perfiles_disponibles)
        ? usuario.perfiles_disponibles
        : rol
        ? [rol]
        : [],
      usuario,
      gimnasios,
      gimnasioActivo,
      gimnasioActivoId: gimnasioActivo?.id_gimnasio || null,
      sucursalActiva,
      sucursalActivaId,
      sucursales,
      sucursalesAsignadas,
      contextosDisponibles,
      contextoConfirmado,
      requiereSeleccionContexto,
      loadingContext,
      contextVersion,
      setSession,
      seleccionarGimnasio,
      confirmarContexto,
      cambiarRolActivo,
      vincularPerfilCuenta,
      refreshProfile,
      logout,
      hasPermission
    }),
    [
      token,
      rol,
      esDueno,
      esAdministrador,
      esEmpleado,
      esAdminSucursal,
      esStaff,
      esSocio,
      usuario,
      gimnasios,
      gimnasioActivo,
      sucursalActiva,
      sucursalActivaId,
      sucursales,
      sucursalesAsignadas,
      contextosDisponibles,
      contextoConfirmado,
      requiereSeleccionContexto,
      loadingContext,
      contextVersion,
      setSession,
      seleccionarGimnasio,
      confirmarContexto,
      cambiarRolActivo,
      vincularPerfilCuenta,
      refreshProfile,
      logout,
      hasPermission
    ]
  );

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGymContext() {
  const ctx = useContext(GymContext);
  if (!ctx) {
    throw new Error('useGymContext debe utilizarse dentro de un GymProvider.');
  }
  return ctx;
}
