// ==============================================================================
// MIDDLEWARE DE AUTENTICACIÓN (SUPABASE AUTH) Y AUTORIZACIÓN POR ROL / TENANT
// ==============================================================================

const { supabaseAnon, createSupabaseClientForToken } = require('../config/supabase');

const PERMISOS_POR_ROL_EMPLEADO = {
  administrador: [
    'ver_dashboard',
    'gestionar_socios',
    'gestionar_membresias',
    'gestionar_pagos',
    'gestionar_asistencias',
    'gestionar_ejercicios',
    'ver_empleados',
    'ver_sucursales'
  ],
  recepcionista: [
    'ver_dashboard',
    'gestionar_socios',
    'gestionar_membresias',
    'gestionar_pagos',
    'gestionar_asistencias',
    'ver_sucursales'
  ],
  entrenador: [
    'ver_dashboard',
    'ver_socios',
    'ver_asistencias',
    'gestionar_ejercicios',
    'gestionar_rutinas',
    'ver_sucursales'
  ]
};

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Resuelve todos los perfiles vinculados al auth_user_id usando el cliente RLS del usuario.
 */
async function resolverContextoUsuario(userClient, authUser, requestedGymId = null, requestedRole = null) {
  const uid = authUser.id;

  const [duenoRes, socioRes, empleadoRes] = await Promise.all([
    userClient
      .from('dueno')
      .select('id_dueno, auth_user_id, nombre, apellido, email, fecha_creacion')
      .eq('auth_user_id', uid)
      .maybeSingle(),
    userClient
      .from('socio')
      .select('id_socio, auth_user_id, dni, telefono, fecha_alta, estado, nombre, apellido, email')
      .eq('auth_user_id', uid)
      .maybeSingle(),
    userClient
      .from('empleado')
      .select(`
        id_empleado,
        auth_user_id,
        id_gimnasio,
        nombre,
        apellido,
        dni,
        email,
        telefono,
        estado,
        fecha_creacion,
        empleado_sucursal (
          id_empleado_sucursal,
          rol,
          estado,
          id_sucursal,
          sucursal (
            id_sucursal,
            direccion,
            telefono,
            descripcion,
            estado,
            id_gimnasio,
            gimnasio (
              id_gimnasio,
              nombre,
              telefono,
              email,
              estado
            )
          )
        )
      `)
      .eq('auth_user_id', uid)
      .maybeSingle()
  ]);

  const dueno = duenoRes.data || null;
  const socio = socioRes.data || null;
  const empleado = empleadoRes.data || null;

  const perfilesDisponibles = [];
  if (dueno) perfilesDisponibles.push('dueño');
  if (empleado && empleado.estado !== false) perfilesDisponibles.push('empleado');
  if (socio) perfilesDisponibles.push('socio');

  // Determinar rol activo (respeta header X-Active-Role si el usuario posee ese perfil)
  let rol = null;
  const roleHint = requestedRole ? String(requestedRole).trim().toLowerCase() : null;
  if (roleHint && perfilesDisponibles.includes(roleHint)) {
    rol = roleHint;
  } else if (roleHint === 'dueno' && perfilesDisponibles.includes('dueño')) {
    rol = 'dueño';
  } else if (dueno) {
    rol = 'dueño';
  } else if (empleado && empleado.estado !== false) {
    rol = 'empleado';
  } else if (socio) {
    rol = 'socio';
  }

  let gimnasios = [];
  let sucursalesAsignadas = [];
  let rolesEmpleado = [];
  let permisos = [];

  if (rol === 'dueño' && dueno) {
    const { data: gyms } = await userClient
      .from('gimnasio')
      .select('id_gimnasio, nombre, telefono, email, fecha_registro, estado, id_dueno')
      .eq('id_dueno', dueno.id_dueno)
      .order('id_gimnasio', { ascending: true });
    gimnasios = gyms || [];
    permisos = ['*'];
  } else if (rol === 'empleado' && empleado) {
    const asignacionesActivas = (empleado.empleado_sucursal || []).filter((es) => es.estado !== false && es.sucursal);
    sucursalesAsignadas = asignacionesActivas.map((es) => ({
      id_empleado_sucursal: es.id_empleado_sucursal,
      id_sucursal: es.id_sucursal,
      rol: String(es.rol || '').toLowerCase(),
      direccion: es.sucursal?.direccion || '',
      estado: es.sucursal?.estado ?? true,
      id_gimnasio: es.sucursal?.id_gimnasio || empleado.id_gimnasio
    }));

    rolesEmpleado = Array.from(new Set(sucursalesAsignadas.map((s) => s.rol).filter(Boolean)));
    const permisosSet = new Set();
    rolesEmpleado.forEach((r) => {
      (PERMISOS_POR_ROL_EMPLEADO[r] || []).forEach((p) => permisosSet.add(p));
    });
    permisos = Array.from(permisosSet);

    // Gimnasio del empleado (desde sucursales asignadas o id_gimnasio)
    const gymMap = new Map();
    asignacionesActivas.forEach((es) => {
      const g = es.sucursal?.gimnasio;
      if (g && g.id_gimnasio) {
        gymMap.set(g.id_gimnasio, g);
      }
    });
    if (gymMap.size === 0 && empleado.id_gimnasio) {
      const { data: gEmp } = await userClient
        .from('gimnasio')
        .select('id_gimnasio, nombre, telefono, email, estado')
        .eq('id_gimnasio', empleado.id_gimnasio)
        .maybeSingle();
      if (gEmp) gymMap.set(gEmp.id_gimnasio, gEmp);
    }
    gimnasios = Array.from(gymMap.values());
  } else if (rol === 'socio' && socio) {
    const { data: contrataciones } = await userClient
      .from('membresia_socio')
      .select(`
        id_membresia_socio,
        id_gimnasio,
        estado,
        fecha_inicio,
        fecha_vencimiento,
        gimnasio:id_gimnasio (
          id_gimnasio,
          nombre,
          telefono,
          email,
          estado
        )
      `)
      .eq('id_socio', socio.id_socio)
      .order('fecha_vencimiento', { ascending: false });

    const gymMap = new Map();
    (contrataciones || []).forEach((c) => {
      const g = c.gimnasio;
      if (g && g.id_gimnasio && !gymMap.has(g.id_gimnasio)) {
        gymMap.set(g.id_gimnasio, {
          ...g,
          estado_membresia: c.estado,
          fecha_vencimiento: c.fecha_vencimiento
        });
      }
    });
    gimnasios = Array.from(gymMap.values());
    permisos = ['socio_self'];
  }

  // Resolver gimnasio activo validándolo estrictamente contra los gimnasios autorizados
  let idGimnasioActivo = null;
  let gimnasioActivo = null;
  const allowedGymIds = new Set(gimnasios.map((g) => Number(g.id_gimnasio)));

  if (requestedGymId && allowedGymIds.has(Number(requestedGymId))) {
    idGimnasioActivo = Number(requestedGymId);
    gimnasioActivo = gimnasios.find((g) => Number(g.id_gimnasio) === idGimnasioActivo) || null;
  } else if (gimnasios.length > 0) {
    const primeroActivo = gimnasios.find((g) => g.estado !== false) || gimnasios[0];
    idGimnasioActivo = Number(primeroActivo.id_gimnasio);
    gimnasioActivo = primeroActivo;
  }

  return {
    auth_user_id: uid,
    email: authUser.email,
    rol,
    perfiles_disponibles: perfilesDisponibles,
    dueno,
    socio,
    empleado,
    id_dueno: dueno?.id_dueno || null,
    id_socio: socio?.id_socio || null,
    id_empleado: empleado?.id_empleado || null,
    // Compatibilidad controlada con código existente que lea req.usuario.id_gimnasio
    id_gimnasio: idGimnasioActivo,
    gimnasio: gimnasioActivo,
    gimnasios,
    sucursales_asignadas: sucursalesAsignadas,
    roles_empleado: rolesEmpleado,
    permisos,
    requested_gym_id: requestedGymId,
    requested_gym_autorizado: requestedGymId ? allowedGymIds.has(Number(requestedGymId)) : true
  };
}

/**
 * Middleware principal: verifica token de Supabase Auth y resuelve el perfil + RLS client.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Acceso denegado. No se proporcionó un token de autenticación válido (Bearer token).'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: 'Token no encontrado en la cabecera de autorización.'
      });
    }

    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Sesión inválida o expirada. Por favor, iniciá sesión nuevamente.'
      });
    }

    const userClient = createSupabaseClientForToken(token);
    const requestedGymId =
      parsePositiveInt(req.headers['x-gimnasio-id']) ||
      parsePositiveInt(req.query?.id_gimnasio) ||
      parsePositiveInt(req.body?.id_gimnasio);
    const requestedRole = req.headers['x-active-role'] || null;

    const contexto = await resolverContextoUsuario(userClient, data.user, requestedGymId, requestedRole);

    if (!contexto.rol) {
      return res.status(403).json({
        error: 'Tu cuenta de usuario no tiene un perfil activo asociado (dueño, socio o empleado).'
      });
    }

    if (contexto.rol === 'socio' && contexto.socio?.estado === false) {
      return res.status(403).json({
        error: 'Tu cuenta de socio se encuentra inactiva.'
      });
    }

    if (contexto.rol === 'empleado' && contexto.empleado?.estado === false) {
      return res.status(403).json({
        error: 'Tu cuenta de empleado se encuentra desactivada.'
      });
    }

    req.authUser = data.user;
    req.accessToken = token;
    req.supabase = userClient;
    req.usuario = contexto;
    req.gimnasioId = contexto.id_gimnasio;

    return next();
  } catch (err) {
    return res.status(500).json({
      error: 'Error al validar la autenticación: ' + err.message
    });
  }
};

/**
 * Valida que el usuario tenga uno de los roles permitidos ('dueño', 'socio', 'empleado').
 * También acepta sub-roles de empleado con formato 'empleado:administrador', etc.
 */
const requireRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    const u = req.usuario;
    if (!u) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    const permitido = rolesPermitidos.some((r) => {
      if (r === u.rol) return true;
      if (r === 'dueno' && u.rol === 'dueño') return true;
      if (r.startsWith('empleado:') && u.rol === 'empleado') {
        const subRol = r.split(':')[1].toLowerCase();
        return (u.roles_empleado || []).includes(subRol);
      }
      return false;
    });

    if (!permitido) {
      return res.status(403).json({
        error: 'No tienes los permisos necesarios para realizar esta acción.'
      });
    }

    return next();
  };
};

/**
 * Valida que el usuario posea un permiso específico (dueño tiene '*').
 */
const requirePermission = (permiso) => {
  return (req, res, next) => {
    const u = req.usuario;
    if (!u) return res.status(401).json({ error: 'Usuario no autenticado.' });
    if (u.rol === 'dueño' || (u.permisos || []).includes('*') || (u.permisos || []).includes(permiso)) {
      return next();
    }
    return res.status(403).json({
      error: `Permiso denegado: se requiere '${permiso}'.`
    });
  };
};

/**
 * Valida que la petición tenga un gimnasio activo autorizado y rechaza intentos de
 * manipular el id_gimnasio hacia un gimnasio ajeno.
 */
const requireGimnasioAccess = (req, res, next) => {
  const u = req.usuario;
  if (!u) return res.status(401).json({ error: 'Usuario no autenticado.' });

  if (u.requested_gym_id && !u.requested_gym_autorizado) {
    return res.status(403).json({
      error: 'No tienes permisos para acceder a la información del gimnasio solicitado.'
    });
  }

  if (!u.id_gimnasio) {
    return res.status(400).json({
      error: 'No hay un gimnasio activo seleccionado o disponible para tu cuenta.'
    });
  }

  req.gimnasioId = u.id_gimnasio;
  return next();
};

/**
 * Helper reutilizable para comprobar si un usuario (dueño o empleado) puede operar sobre una sucursal.
 */
function canAccessSucursal(usuario, idSucursal, rolesEmpleadoPermitidos = null) {
  if (!usuario) return false;
  if (usuario.rol === 'dueño') return true;
  if (usuario.rol !== 'empleado') return false;

  const targetId = Number(idSucursal);
  return (usuario.sucursales_asignadas || []).some((s) => {
    if (Number(s.id_sucursal) !== targetId) return false;
    if (!rolesEmpleadoPermitidos || rolesEmpleadoPermitidos.length === 0) return true;
    return rolesEmpleadoPermitidos.includes(String(s.rol).toLowerCase());
  });
}

module.exports = {
  verifyToken,
  requireRoles,
  requirePermission,
  requireGimnasioAccess,
  canAccessSucursal,
  resolverContextoUsuario,
  PERMISOS_POR_ROL_EMPLEADO
};
