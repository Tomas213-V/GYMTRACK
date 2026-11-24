// ==============================================================================
// CONTROLADOR DE ASISTENCIAS — MODELO SIMPLIFICADO public.asistencia_socio
// - Relación directa únicamente con socio (id_socio) y sucursal (id_sucursal).
// - El gimnasio se deriva por: asistencia_socio -> sucursal -> gimnasio.
// - La membresía se valida dinámicamente en backend/RPC al momento del ingreso
//   y NO se almacena en asistencia_socio.
// - Validaciones transaccionales en DB vía rpc_registrar_ingreso_asistencia
//   y rpc_registrar_salida_asistencia.
// - Estados válidos por CHECK: 'presente' | 'finalizada' | 'anulada'.
// ==============================================================================

const { canAccessSucursal } = require('../middlewares/authMiddleware');

const normalizarTimestampUTC = (valor) => {
  if (!valor || typeof valor !== 'string') return valor;
  const trimmed = valor.trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) return trimmed;
  const iso = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed;
  return `${iso}Z`;
};

const normalizarAsistencia = (asistencia) => {
  if (!asistencia) return asistencia;
  const gimnasio = asistencia.gimnasio || asistencia.sucursal?.gimnasio || null;
  const idGimnasio =
    asistencia.id_gimnasio ?? asistencia.sucursal?.id_gimnasio ?? gimnasio?.id_gimnasio ?? null;
  return {
    ...asistencia,
    id_asistencia: asistencia.id_asistencia_socio,
    id_gimnasio: idGimnasio,
    gimnasio,
    hora_ingreso: normalizarTimestampUTC(asistencia.hora_ingreso),
    hora_salida: normalizarTimestampUTC(asistencia.hora_salida)
  };
};

function getTodayISODate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * 1. GET /api/asistencias
 * Consulta asistencias del gimnasio activo con filtros por sucursal, socio, fecha y búsqueda.
 * - Si el usuario es empleado, RLS y el filtro garantizan acceso solo a sus sucursales asignadas.
 * - Si el usuario es socio, solo consulta sus propias asistencias del gimnasio activo.
 */
const getAsistencias = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { page = 1, limit = 10, search, desde, hasta, id_socio, id_sucursal, estado } = req.query;

    if (u.requested_gym_id && !u.requested_gym_autorizado) {
      return res.status(403).json({ error: 'No tienes acceso al gimnasio solicitado.' });
    }

    const gymId = u.id_gimnasio;
    if (!gymId) {
      return res.status(200).json({ total: 0, page: 1, totalPages: 1, limit: Number(limit), asistencias: [] });
    }

    if (id_sucursal && id_sucursal !== 'todas' && u.rol === 'empleado') {
      if (!canAccessSucursal(u, id_sucursal)) {
        return res.status(403).json({ error: 'No tienes permiso para ver asistencias de esa sucursal.' });
      }
    }

    const offset = (Number(page) - 1) * Number(limit);

    let query = db
      .from('asistencia_socio')
      .select(
        `
        id_asistencia_socio,
        id_socio,
        id_sucursal,
        hora_ingreso,
        hora_salida,
        estado,
        socio!inner (
          id_socio,
          nombre,
          apellido,
          dni,
          email,
          telefono,
          estado
        ),
        sucursal!inner (
          id_sucursal,
          direccion,
          telefono,
          descripcion,
          estado,
          id_gimnasio,
          gimnasio:id_gimnasio (
            id_gimnasio,
            nombre
          )
        )
      `,
        { count: 'exact' }
      )
      .eq('sucursal.id_gimnasio', gymId);

    if (u.rol === 'socio') {
      query = query.eq('id_socio', u.id_socio);
    } else if (id_socio && id_socio !== 'todos') {
      query = query.eq('id_socio', Number(id_socio));
    }

    if (id_sucursal && id_sucursal !== 'todas') {
      query = query.eq('id_sucursal', Number(id_sucursal));
    }

    if (estado && estado !== 'todos') {
      query = query.eq('estado', String(estado).toLowerCase());
    }

    if (desde) {
      const fechaDesde = desde.includes('T') ? desde : `${desde}T00:00:00.000Z`;
      query = query.gte('hora_ingreso', fechaDesde);
    }
    if (hasta) {
      const fechaHasta = hasta.includes('T') ? hasta : `${hasta}T23:59:59.999Z`;
      query = query.lte('hora_ingreso', fechaHasta);
    }

    if (search && String(search).trim()) {
      const s = String(search).trim();
      query = query.or(`nombre.ilike.%${s}%,apellido.ilike.%${s}%,dni.ilike.%${s}%`, { foreignTable: 'socio' });
    }

    query = query.order('hora_ingreso', { ascending: false }).range(offset, offset + Number(limit) - 1);

    const { data: asistencias, error, count } = await query;
    if (error) {
      return res.status(500).json({ error: 'Error al consultar asistencias: ' + error.message });
    }

    return res.status(200).json({
      total: count || 0,
      page: Number(page),
      totalPages: Math.max(1, Math.ceil((count || 0) / Number(limit))),
      limit: Number(limit),
      asistencias: (asistencias || []).map(normalizarAsistencia)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al consultar asistencias: ' + error.message });
  }
};

/**
 * 2. POST /api/asistencias
 * Registra ingreso de asistencia validando autorización, sucursal activa,
 * membresía activa y vigente en el gimnasio de la sucursal (sin guardarla en asistencia_socio)
 * y ausencia de ingreso abierto mediante rpc_registrar_ingreso_asistencia.
 */
const registrarAsistencia = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id_socio, dni, id_sucursal } = req.body;

    if (u.requested_gym_id && !u.requested_gym_autorizado) {
      return res.status(403).json({ error: 'No tienes autorización sobre el gimnasio seleccionado.' });
    }

    if (!id_sucursal) {
      return res.status(400).json({ error: 'Debes seleccionar una sucursal para registrar la asistencia.' });
    }

    // 1. Validar permisos por rol y resolver socio objetivo (sin confiar libremente en el frontend)
    let targetSocioId = null;

    if (u.rol === 'socio') {
      if (id_socio && Number(id_socio) !== Number(u.id_socio)) {
        return res.status(403).json({ error: 'Solo puedes registrar asistencias para tu propia cuenta.' });
      }
      targetSocioId = u.id_socio;
    } else if (u.rol === 'dueño' || u.rol === 'empleado') {
      if (u.rol === 'empleado' && !canAccessSucursal(u, id_sucursal, ['administrador', 'recepcionista'])) {
        return res.status(403).json({
          error: 'No tienes permiso para registrar asistencias en esta sucursal.'
        });
      }

      if (id_socio) {
        targetSocioId = Number(id_socio);
      } else if (dni && String(dni).trim()) {
        const cleanDni = String(dni).trim();
        const dniSinPuntos = cleanDni.replace(/[\.\s-]/g, '');
        const { data: socioByDni, error: dniErr } = await db
          .from('socio')
          .select('id_socio')
          .in('dni', [cleanDni, dniSinPuntos])
          .maybeSingle();

        if (dniErr || !socioByDni) {
          return res.status(404).json({ error: 'No se encontró ningún socio vinculado a tu gimnasio con ese DNI.' });
        }
        targetSocioId = socioByDni.id_socio;
      } else {
        return res.status(400).json({ error: 'Debes proporcionar el socio (id_socio o DNI).' });
      }
    } else {
      return res.status(403).json({ error: 'Rol no autorizado para registrar asistencias.' });
    }

    // 2. Validar que la sucursal exista, esté activa y pertenezca al gimnasio activo (si aplica)
    const { data: sucCheck, error: sucErr } = await db
      .from('sucursal')
      .select('id_sucursal, id_gimnasio, estado, direccion')
      .eq('id_sucursal', Number(id_sucursal))
      .maybeSingle();

    if (sucErr || !sucCheck) {
      return res.status(404).json({ error: 'La sucursal seleccionada no existe o no es accesible.' });
    }
    if (!sucCheck.estado) {
      return res.status(400).json({ error: 'La sucursal seleccionada se encuentra inactiva.' });
    }
    if (u.id_gimnasio && Number(sucCheck.id_gimnasio) !== Number(u.id_gimnasio)) {
      return res.status(403).json({
        error: 'La sucursal seleccionada pertenece a otro gimnasio distinto al seleccionado actualmente.'
      });
    }

    // 3. Validar dinámicamente que el socio tenga membresía activa y vigente en el gimnasio de la sucursal
    const hoyISO = getTodayISODate();
    const { data: membresiaVigente, error: membErr } = await db
      .from('membresia_socio')
      .select('id_membresia_socio, estado, fecha_inicio, fecha_vencimiento')
      .eq('id_socio', targetSocioId)
      .eq('id_gimnasio', sucCheck.id_gimnasio)
      .eq('estado', 'activa')
      .lte('fecha_inicio', hoyISO)
      .gte('fecha_vencimiento', hoyISO)
      .order('fecha_vencimiento', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membErr) {
      return res.status(500).json({ error: 'Error al validar membresía del socio: ' + membErr.message });
    }
    if (!membresiaVigente) {
      return res.status(403).json({
        error: 'El socio no posee una membresía activa y vigente para ingresar al gimnasio de esta sucursal.'
      });
    }

    // 4. Ejecutar RPC transaccional en PostgreSQL (bloquea concurrencia y valida nuevamente en DB)
    const { data: asistenciaCreada, error: rpcError } = await db.rpc('rpc_registrar_ingreso_asistencia', {
      p_id_sucursal: Number(id_sucursal),
      p_id_socio: targetSocioId
    });

    if (rpcError) {
      return res.status(400).json({ error: rpcError.message });
    }

    // 5. Enriquecer respuesta con socio, sucursal y gimnasio (vía sucursal -> gimnasio)
    const { data: completa } = await db
      .from('asistencia_socio')
      .select(`
        id_asistencia_socio,
        id_socio,
        id_sucursal,
        hora_ingreso,
        hora_salida,
        estado,
        socio (id_socio, nombre, apellido, dni, email, telefono, estado),
        sucursal:id_sucursal (
          id_sucursal,
          direccion,
          telefono,
          id_gimnasio,
          gimnasio:id_gimnasio (id_gimnasio, nombre)
        )
      `)
      .eq('id_asistencia_socio', asistenciaCreada.id_asistencia_socio)
      .single();

    const socioNombre = completa?.socio
      ? `${completa.socio.nombre} ${completa.socio.apellido}`.trim()
      : 'el socio';

    return res.status(201).json({
      mensaje: `Ingreso registrado con éxito para ${socioNombre} en ${completa?.sucursal?.direccion || sucCheck.direccion || 'la sucursal'}.`,
      asistencia: normalizarAsistencia(completa || asistenciaCreada)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al registrar la asistencia: ' + error.message });
  }
};

/**
 * 3. PATCH /api/asistencias/:id/checkout
 * Registra la salida de una asistencia abierta (estado -> 'finalizada').
 */
const checkoutAsistencia = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id } = req.params;

    const paramsRpc =
      id === 'abierta'
        ? { p_id_asistencia_socio: null, p_id_socio: u.id_socio }
        : { p_id_asistencia_socio: Number(id), p_id_socio: null };

    const { data: actualizada, error: rpcError } = await db.rpc('rpc_registrar_salida_asistencia', paramsRpc);

    if (rpcError) {
      return res.status(400).json({ error: rpcError.message });
    }

    return res.status(200).json({
      mensaje: 'Salida registrada correctamente.',
      asistencia: normalizarAsistencia(actualizada)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al registrar salida: ' + error.message });
  }
};

/**
 * 4. GET /api/asistencias/estadisticas
 */
const getEstadisticas = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.usuario?.id_gimnasio;
    const { id_sucursal } = req.query;

    if (!gymId) {
      return res.status(200).json({
        totalMesActual: 0,
        totalMesAnterior: 0,
        porcentajeCambio: 0,
        tendencia: 'neutral',
        nombreMes: ''
      });
    }

    const ahora = new Date();
    const yearActual = ahora.getFullYear();
    const mesActual = ahora.getMonth();

    const inicioMesActual = new Date(yearActual, mesActual, 1).toISOString();
    const finMesActual = new Date(yearActual, mesActual + 1, 0, 23, 59, 59, 999).toISOString();
    const inicioMesAnterior = new Date(yearActual, mesActual - 1, 1).toISOString();
    const finMesAnterior = new Date(yearActual, mesActual, 0, 23, 59, 59, 999).toISOString();

    let qActual = db
      .from('asistencia_socio')
      .select('id_asistencia_socio, sucursal!inner(id_gimnasio)', { count: 'exact', head: true })
      .eq('sucursal.id_gimnasio', gymId)
      .neq('estado', 'anulada')
      .gte('hora_ingreso', inicioMesActual)
      .lte('hora_ingreso', finMesActual);

    let qAnterior = db
      .from('asistencia_socio')
      .select('id_asistencia_socio, sucursal!inner(id_gimnasio)', { count: 'exact', head: true })
      .eq('sucursal.id_gimnasio', gymId)
      .neq('estado', 'anulada')
      .gte('hora_ingreso', inicioMesAnterior)
      .lte('hora_ingreso', finMesAnterior);

    if (id_sucursal && id_sucursal !== 'todas') {
      qActual = qActual.eq('id_sucursal', Number(id_sucursal));
      qAnterior = qAnterior.eq('id_sucursal', Number(id_sucursal));
    }

    const [resActual, resAnterior] = await Promise.all([qActual, qAnterior]);
    const totalMesActual = resActual.count || 0;
    const totalMesAnterior = resAnterior.count || 0;

    let porcentajeCambio = 0;
    let tendencia = 'neutral';
    if (totalMesAnterior > 0) {
      porcentajeCambio = Math.round(((totalMesActual - totalMesAnterior) / totalMesAnterior) * 100);
      tendencia = porcentajeCambio >= 0 ? 'up' : 'down';
    } else if (totalMesActual > 0) {
      porcentajeCambio = 100;
      tendencia = 'up';
    }

    const mesesNombres = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    return res.status(200).json({
      totalMesActual,
      totalMesAnterior,
      porcentajeCambio: Math.abs(porcentajeCambio),
      tendencia,
      nombreMes: mesesNombres[mesActual]
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al calcular estadísticas: ' + error.message });
  }
};

/**
 * 5. GET /api/asistencias/socio/:id_socio
 * Historial de asistencias de un socio (aislado por gimnasio seleccionado cuando corresponde).
 */
const getAsistenciasPorSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id_socio } = req.params;
    const { todos_gimnasios } = req.query;

    if (u.rol === 'socio' && Number(u.id_socio) !== Number(id_socio)) {
      return res.status(403).json({ error: 'No tienes permisos para consultar asistencias de otro socio.' });
    }

    let query = db
      .from('asistencia_socio')
      .select(`
        id_asistencia_socio,
        id_socio,
        id_sucursal,
        hora_ingreso,
        hora_salida,
        estado,
        sucursal!inner (
          id_sucursal,
          direccion,
          telefono,
          descripcion,
          id_gimnasio,
          gimnasio:id_gimnasio (id_gimnasio, nombre)
        )
      `)
      .eq('id_socio', Number(id_socio))
      .order('hora_ingreso', { ascending: false });

    // Filtrar por el gimnasio activo seleccionado vía sucursal salvo historial global explícito
    if (u.id_gimnasio && todos_gimnasios !== 'true') {
      query = query.eq('sucursal.id_gimnasio', u.id_gimnasio);
    }

    const { data: asistencias, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Error al obtener historial del socio: ' + error.message });
    }

    // Verificar si el socio tiene una asistencia abierta actualmente (en cualquier sucursal/gimnasio)
    const { data: abierta } = await db
      .from('asistencia_socio')
      .select(`
        id_asistencia_socio,
        id_socio,
        id_sucursal,
        hora_ingreso,
        estado,
        sucursal:id_sucursal (
          id_sucursal,
          direccion,
          id_gimnasio,
          gimnasio:id_gimnasio (id_gimnasio, nombre)
        )
      `)
      .eq('id_socio', Number(id_socio))
      .eq('estado', 'presente')
      .is('hora_salida', null)
      .maybeSingle();

    const listaNormalizada = (asistencias || []).map(normalizarAsistencia);

    return res.status(200).json({
      id_socio: Number(id_socio),
      id_gimnasio: u.id_gimnasio,
      total: listaNormalizada.length,
      asistencia_abierta: abierta ? normalizarAsistencia(abierta) : null,
      asistencias: listaNormalizada
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al obtener historial: ' + error.message });
  }
};

/**
 * 6. DELETE /api/asistencias/:id | PATCH /api/asistencias/:id/anular
 * Anula una asistencia (estado = 'anulada') en lugar de destruir el registro histórico.
 */
const eliminarAsistencia = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id } = req.params;

    if (u.rol === 'socio') {
      return res.status(403).json({ error: 'Los socios no pueden anular registros de asistencia.' });
    }

    const { data: existente, error: findErr } = await db
      .from('asistencia_socio')
      .select('id_asistencia_socio, id_sucursal, sucursal!inner(id_gimnasio)')
      .eq('id_asistencia_socio', Number(id))
      .eq('sucursal.id_gimnasio', u.id_gimnasio)
      .maybeSingle();

    if (findErr) {
      return res.status(500).json({ error: 'Error al verificar la asistencia: ' + findErr.message });
    }
    if (!existente) {
      return res.status(404).json({ error: 'La asistencia no existe o no pertenece a tu gimnasio.' });
    }

    if (u.rol === 'empleado' && !canAccessSucursal(u, existente.id_sucursal, ['administrador', 'recepcionista'])) {
      return res.status(403).json({ error: 'No tienes permiso para anular asistencias de esta sucursal.' });
    }

    const { data, error } = await db.rpc('rpc_anular_asistencia', {
      p_id_asistencia_socio: Number(id)
    });

    if (error) {
      return res.status(400).json({ error: 'Error al anular la asistencia: ' + error.message });
    }

    return res.status(200).json({
      mensaje: 'Asistencia anulada correctamente.',
      asistencia: normalizarAsistencia(data)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al anular asistencia: ' + error.message });
  }
};

module.exports = {
  createAsistencia: registrarAsistencia,
  registrarAsistencia,
  getAsistencias,
  getAsistenciasBySocio: getAsistenciasPorSocio,
  getAsistenciasPorSocio,
  checkoutAsistencia,
  getEstadisticas,
  eliminarAsistencia
};
