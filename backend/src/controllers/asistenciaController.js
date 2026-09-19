const supabase = require('../config/supabase');

/**
 * 1. OBTENER ASISTENCIAS
 * Soporta paginación, búsqueda por nombre/apellido/DNI, rango de fechas y filtro por socio
 * GET /api/asistencias?page=1&limit=10&search=Juan&desde=2026-04-01&hasta=2026-04-30&id_socio=2
 */
const getAsistencias = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, desde, hasta, id_socio, id_gimnasio } = req.query;
    const gymId = id_gimnasio || req.usuario?.id_gimnasio;

    const offset = (Number(page) - 1) * Number(limit);

    // Consulta base con JOIN a la tabla 'socio'
    let query = supabase
      .from('asistencia')
      .select(`
        id_asistencia,
        id_socio,
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
          estado,
          id_gimnasio
        )
      `, { count: 'exact' });

    // Filtrar por gimnasio si está disponible
    if (gymId) {
      query = query.eq('socio.id_gimnasio', gymId);
    }

    // Filtrar por socio específico
    if (id_socio && id_socio !== 'todos') {
      query = query.eq('id_socio', id_socio);
    }

    // Rango de fechas (hora_ingreso)
    if (desde) {
      // Inicio del día en formato ISO
      const fechaDesde = desde.includes('T') ? desde : `${desde}T00:00:00.000Z`;
      query = query.gte('hora_ingreso', fechaDesde);
    }
    if (hasta) {
      // Fin del día en formato ISO
      const fechaHasta = hasta.includes('T') ? hasta : `${hasta}T23:59:59.999Z`;
      query = query.lte('hora_ingreso', fechaHasta);
    }

    // Búsqueda por texto (nombre, apellido, dni)
    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`nombre.ilike.%${s}%,apellido.ilike.%${s}%,dni.ilike.%${s}%`, { foreignTable: 'socio' });
    }

    // Ordenar de más reciente a más antiguo
    query = query
      .order('hora_ingreso', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    const { data: asistencias, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Error al consultar asistencias: ' + error.message });
    }

    const total = count || 0;
    const parsedLimit = Number(limit);
    const parsedPage = Number(page);

    return res.status(200).json({
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit) || 1,
      limit: parsedLimit,
      asistencias: asistencias || []
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * 2. REGISTRAR ASISTENCIA
 * Permite registrar asistencia buscando al socio por id_socio o por dni
 * POST /api/asistencias
 * Body: { id_socio } o { dni }
 */
const registrarAsistencia = async (req, res) => {
  try {
    const { id_socio, dni } = req.body;
    const gymId = req.usuario?.id_gimnasio || req.body.id_gimnasio;

    if (!id_socio && !dni) {
      return res.status(400).json({ error: 'Debes proporcionar el ID o el DNI del socio.' });
    }

    // 1. Buscar al socio para confirmar existencia y obtener datos completos
    let socioQuery = supabase
      .from('socio')
      .select(`
        id_socio,
        nombre,
        apellido,
        dni,
        email,
        telefono,
        estado,
        id_gimnasio,
        membresia (
          id_membresia,
          estado,
          fecha_inicio,
          fecha_vencimiento,
          precio
        )
      `);


    if (id_socio) {
      socioQuery = socioQuery.eq('id_socio', id_socio);
    } else {
      socioQuery = socioQuery.eq('dni', dni.toString().trim());
    }

    if (gymId) {
      socioQuery = socioQuery.eq('id_gimnasio', gymId);
    }

    const { data: socio, error: socioError } = await socioQuery.maybeSingle();

    if (socioError) {
      return res.status(500).json({ error: 'Error al verificar el socio: ' + socioError.message });
    }

    if (!socio) {
      return res.status(404).json({ error: 'No se encontró ningún socio con el identificador ingresado.' });
    }

    // 2. Registrar la asistencia
    const horaIngreso = new Date().toISOString();
    const { data: nuevaAsistencia, error: insertError } = await supabase
      .from('asistencia')
      .insert([
        {
          id_socio: socio.id_socio,
          hora_ingreso: horaIngreso,
          estado: 'registrada'
        }
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: 'Error al registrar la asistencia: ' + insertError.message });
    }

    // Estructurar respuesta con la información completa del socio
    const asistenciaCompleta = {
      ...nuevaAsistencia,
      socio: {
        id_socio: socio.id_socio,
        nombre: socio.nombre,
        apellido: socio.apellido,
        dni: socio.dni,
        email: socio.email,
        telefono: socio.telefono,
        estado: socio.estado,
        membresia: socio.membresia
      }
    };

    return res.status(201).json({
      mensaje: `Asistencia registrada con éxito para ${socio.nombre} ${socio.apellido}.`,
      asistencia: asistenciaCompleta
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno al registrar la asistencia: ' + error.message });
  }
};

/**
 * 3. OBTENER ESTADÍSTICAS DE ASISTENCIAS
 * Calcula total del mes actual, mes anterior y tendencia porcentual
 * GET /api/asistencias/estadisticas
 */
const getEstadisticas = async (req, res) => {
  try {
    const gymId = req.query.id_gimnasio || req.usuario?.id_gimnasio;

    const ahora = new Date();
    const yearActual = ahora.getFullYear();
    const mesActual = ahora.getMonth(); // 0-indexed

    // Fechas mes actual
    const inicioMesActual = new Date(yearActual, mesActual, 1).toISOString();
    const finMesActual = new Date(yearActual, mesActual + 1, 0, 23, 59, 59, 999).toISOString();

    // Fechas mes anterior
    const inicioMesAnterior = new Date(yearActual, mesActual - 1, 1).toISOString();
    const finMesAnterior = new Date(yearActual, mesActual, 0, 23, 59, 59, 999).toISOString();

    // Consulta mes actual
    let qActual = supabase
      .from('asistencia')
      .select('id_asistencia, socio!inner(id_gimnasio)', { count: 'exact', head: true })
      .gte('hora_ingreso', inicioMesActual)
      .lte('hora_ingreso', finMesActual);

    // Consulta mes anterior
    let qAnterior = supabase
      .from('asistencia')
      .select('id_asistencia, socio!inner(id_gimnasio)', { count: 'exact', head: true })
      .gte('hora_ingreso', inicioMesAnterior)
      .lte('hora_ingreso', finMesAnterior);

    if (gymId) {
      qActual = qActual.eq('socio.id_gimnasio', gymId);
      qAnterior = qAnterior.eq('socio.id_gimnasio', gymId);
    }

    const [resActual, resAnterior] = await Promise.all([qActual, qAnterior]);

    const totalMesActual = resActual.count || 0;
    const totalMesAnterior = resAnterior.count || 0;

    // Calcular cambio porcentual
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
 * 4. OBTENER HISTORIAL DE ASISTENCIAS DE UN SOCIO
 * GET /api/asistencias/socio/:id_socio
 */
const getAsistenciasPorSocio = async (req, res) => {
  try {
    const { id_socio } = req.params;

    const { data: asistencias, error } = await supabase
      .from('asistencia')
      .select('*')
      .eq('id_socio', id_socio)
      .order('hora_ingreso', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Error al obtener historial del socio: ' + error.message });
    }

    return res.status(200).json({
      id_socio: Number(id_socio),
      total: asistencias ? asistencias.length : 0,
      asistencias: asistencias || []
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * 5. ELIMINAR ASISTENCIA
 * DELETE /api/asistencias/:id
 */
const eliminarAsistencia = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('asistencia')
      .delete()
      .eq('id_asistencia', id)
      .select();

    if (error) {
      return res.status(500).json({ error: 'Error al eliminar la asistencia: ' + error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'La asistencia no existe o ya fue eliminada.' });
    }

    return res.status(200).json({ mensaje: 'Asistencia eliminada correctamente.' });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

module.exports = {
  getAsistencias,
  registrarAsistencia,
  getEstadisticas,
  getAsistenciasPorSocio,
  eliminarAsistencia
};
