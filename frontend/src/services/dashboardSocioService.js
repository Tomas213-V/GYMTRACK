/**
 * =========================================================================================
 * ARCHIVO: dashboardSocioService.js
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Servicio para el panel personal del socio (KPIs personales, check-in y peso).
 * =========================================================================================
 */

import { getFechaArgentinaISO } from '../utils/dateUtils';

const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_URL = `${BASE_API_URL}/socio`;

function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getLocalSocioId() {
  try {
    const rawSocio = localStorage.getItem('socio');
    const rawUser = localStorage.getItem('usuario');
    const obj = rawSocio ? JSON.parse(rawSocio) : (rawUser ? JSON.parse(rawUser) : null);
    const parsed = Array.isArray(obj) ? obj[0] : obj;
    return parsed?.id_socio || parsed?.id || null;
  } catch {
    return null;
  }
}

async function fetchDashboardFallback() {
  const localId = getLocalSocioId();
  const perfilUrl = localId
    ? `${BASE_API_URL}/socios/perfil?id=${localId}`
    : `${BASE_API_URL}/socios/perfil`;

  const perfilRes = await fetch(perfilUrl, { headers: getHeaders() });
  const perfil = await perfilRes.json().catch(() => ({}));
  if (!perfilRes.ok || !perfil?.socio) {
    throw new Error(perfil.error || perfil.detail || 'No se pudo obtener el perfil del socio.');
  }

  const socio = perfil.socio;
  const idSocio = socio.id_socio || localId;

  const [asistData, rutinasData] = await Promise.all([
    idSocio
      ? fetch(`${BASE_API_URL}/asistencias/socio/${idSocio}`, { headers: getHeaders() })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
    idSocio
      ? fetch(`${BASE_API_URL}/rutinas?id_socio=${idSocio}`, { headers: getHeaders() })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null)
  ]);

  // Procesar membresía real del socio
  const estadosExcluidos = [
    'inactivo', 'inactiva', 'pausa', 'pausado', 'pausada',
    'cancelado', 'cancelada', 'eliminado', 'eliminada', 'sin_membresia'
  ];
  const listaMembresias = Array.isArray(perfil.historialMembresias)
    ? perfil.historialMembresias
    : (perfil.membresia ? [perfil.membresia] : []);

  const membActiva = listaMembresias.find((m) => {
    const estM = (m?.estado || '').toLowerCase().trim();
    const estP = (m?.plan_membresia?.estado || '').toLowerCase().trim();
    return estM && !estadosExcluidos.includes(estM) && (!m?.plan_membresia || !estadosExcluidos.includes(estP));
  }) || null;

  let membresiaNormalizada = {
    id_membresia: null,
    estado: 'sin_membresia',
    plan: 'Sin Membresía Activa',
    dias_restantes: 0,
    porcentaje_transcurrido: 0,
    expirada: true
  };

  if (membActiva) {
    let diasRestantes = perfil.estadisticas?.diasRestantes ?? null;
    let porcentajeTranscurrido = 0;
    let expirada = false;

    if (membActiva.fecha_vencimiento) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fin = new Date(`${String(membActiva.fecha_vencimiento).split('T')[0]}T00:00:00`);
      diasRestantes = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      expirada = diasRestantes < 0;

      if (membActiva.fecha_inicio) {
        const inicio = new Date(`${String(membActiva.fecha_inicio).split('T')[0]}T00:00:00`);
        const totalDias = Math.max(1, Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)));
        const usados = Math.max(0, Math.ceil((hoy - inicio) / (1000 * 60 * 60 * 24)));
        porcentajeTranscurrido = Math.min(100, Math.max(0, Math.round((usados / totalDias) * 100)));
      }
    }

    membresiaNormalizada = {
      id_membresia: membActiva.id_membresia,
      plan: membActiva.plan_membresia?.nombre || 'Plan Personalizado',
      estado: membActiva.estado,
      fecha_inicio: membActiva.fecha_inicio,
      fecha_vencimiento: membActiva.fecha_vencimiento,
      precio: membActiva.precio ?? membActiva.plan_membresia?.precio ?? 0,
      dias_restantes: diasRestantes,
      porcentaje_transcurrido: porcentajeTranscurrido,
      expirada
    };
  }

  // Procesar asistencias reales en zona horaria Argentina
  const listaAsist = asistData?.asistencias || perfil.ultimasAsistencias || [];
  const mesActualPrefix = getFechaArgentinaISO(new Date()).slice(0, 7);
  const asistenciasMes = listaAsist.filter(
    (a) => a.hora_ingreso && getFechaArgentinaISO(a.hora_ingreso).startsWith(mesActualPrefix)
  ).length;

  // Procesar rutina activa real del socio
  const listaRutinas = Array.isArray(rutinasData)
    ? rutinasData
    : (rutinasData?.rutinas || rutinasData?.datos || []);

  let rutinaElegida =
    listaRutinas.find((r) => (r.estado || '').toLowerCase() === 'activa') ||
    listaRutinas[0] ||
    null;

  if (rutinaElegida && !Array.isArray(rutinaElegida.rutina_ejercicio) && !Array.isArray(rutinaElegida.ejercicios)) {
    const detalle = await fetch(`${BASE_API_URL}/rutinas/${rutinaElegida.id_rutina}`, { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (detalle) {
      rutinaElegida = detalle.rutina || detalle;
    }
  }

  const ejerciciosRaw = rutinaElegida?.rutina_ejercicio || rutinaElegida?.ejercicios || [];
  const ejerciciosOrdenados = [...ejerciciosRaw].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  return {
    socio: {
      id_socio: socio.id_socio,
      nombre: socio.nombre,
      apellido: socio.apellido,
      dni: socio.dni,
      email: socio.email,
      telefono: socio.telefono
    },
    gimnasio: perfil.gimnasio || null,
    membresia: membresiaNormalizada,
    ultimo_pago: perfil.ultimosPagos?.[0] || null,
    progreso: {
      peso_actual: null,
      observaciones: null,
      fecha_ultimo_registro: null,
      variacion_mes: null,
      historial: []
    },
    entrenamientos: {
      total_asistencias: asistData?.total ?? perfil.estadisticas?.totalAsistencias ?? listaAsist.length,
      asistencias_mes: asistenciasMes,
      recientes: listaAsist.slice(0, 5)
    },
    rutina_activa: rutinaElegida
      ? {
          id_rutina: rutinaElegida.id_rutina,
          nombre: rutinaElegida.nombre,
          descripcion: rutinaElegida.descripcion,
          ejercicios: ejerciciosOrdenados
        }
      : null
  };
}

/**
 * Obtener toda la información consolidada del Dashboard de Socio
 */
export async function fetchDashboardSocio() {
  try {
    const res = await fetch(`${API_URL}/dashboard`, {
      headers: getHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.socio) {
      return data;
    }
    console.warn('Endpoint /api/socio/dashboard falló, usando fallback de perfil real:', data?.detail || data?.error || res.status);
  } catch (error) {
    console.warn('Error de red en /api/socio/dashboard, usando fallback:', error.message);
  }

  return fetchDashboardFallback();
}

/**
 * Registrar asistencia / check-in rápido del socio
 */
export async function realizarCheckinSocio() {
  try {
    const res = await fetch(`${API_URL}/checkin`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.detail || 'Error al registrar la asistencia.');
    }
    return data;
  } catch (error) {
    console.error('Fallo realizarCheckinSocio:', error);
    throw error;
  }
}

/**
 * Registrar nuevo progreso de peso del socio
 * @param {Object} param0 - { peso, observaciones, fecha }
 */
export async function registrarProgresoSocio({ peso, observaciones, fecha }) {
  try {
    const res = await fetch(`${API_URL}/progreso`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ peso, observaciones, fecha })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.detail || 'Error al registrar el progreso.');
    }
    return data;
  } catch (error) {
    console.error('Fallo registrarProgresoSocio:', error);
    throw error;
  }
}
