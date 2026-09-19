const supabase = require('../config/supabase');

// 1. Registrar una asistencia
const createAsistencia = async (req, res) => {
  try {
    const idGimnasio = req.usuario?.id_gimnasio;
    const { id_socio, hora_ingreso, estado } = req.body;

    // Validación de campos obligatorios
    if (!id_socio) {
      return res.status(400).json({ error: 'El campo id_socio es obligatorio.' });
    }

    // Validar que el socio existe y pertenece al gimnasio del dueño autenticado
    const { data: socio, error: socioError } = await supabase
      .from('socio')
      .select('id_socio, estado')
      .eq('id_socio', id_socio)
      .eq('id_gimnasio', idGimnasio)
      .single();

    if (socioError || !socio) {
      return res.status(404).json({ error: 'El socio especificado no existe o no pertenece a este gimnasio.' });
    }

    // Insertar la asistencia
    const { data: nuevaAsistencia, error: insertError } = await supabase
      .from('asistencia')
      .insert([
        {
          id_socio,
          hora_ingreso: hora_ingreso || new Date().toISOString(),
          estado: estado || 'presente'
        }
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: 'Error al registrar la asistencia: ' + insertError.message });
    }

    return res.status(201).json({
      mensaje: 'Asistencia registrada correctamente.',
      asistencia: nuevaAsistencia
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

// 2. Consultar asistencias generales (con filtro por fecha opcional)
const getAsistencias = async (req, res) => {
  try {
    const idGimnasio = req.usuario?.id_gimnasio;
    const { fecha, page, limit } = req.query;

    let query = supabase
      .from('asistencia')
      .select(`
        *,
        socio!inner (
          id_socio,
          dni,
          id_gimnasio,
          usuario (
            nombre,
            apellido
          )
        )
      `, { count: 'exact' })
      .eq('socio.id_gimnasio', idGimnasio)
      .order('hora_ingreso', { ascending: false });

    // Filtrar por fecha exacta (YYYY-MM-DD)
    if (fecha) {
      const inicioDia = `${fecha}T00:00:00.000Z`;
      const finDia = `${fecha}T23:59:59.999Z`;
      query = query.gte('hora_ingreso', inicioDia).lte('hora_ingreso', finDia);
    }

    // Paginación
    const isAll = limit === 'all' || limit === '0';
    let parsedLimit = parseInt(limit) || 10;
    let parsedPage = parseInt(page) || 1;

    if (!isAll) {
      const offset = (parsedPage - 1) * parsedLimit;
      query = query.range(offset, offset + parsedLimit - 1);
    }

    const { data: asistencias, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Error al consultar asistencias: ' + error.message });
    }

    return res.status(200).json({
      total: count || 0,
      page: isAll ? 1 : parsedPage,
      totalPages: isAll ? 1 : Math.ceil((count || 0) / parsedLimit),
      asistencias: asistencias || []
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

// 3. Consultar el historial de asistencias de un socio específico
const getAsistenciasBySocio = async (req, res) => {
  try {
    const idGimnasio = req.usuario?.id_gimnasio;
    const { id_socio } = req.params;

    // Verificar que el socio pertenezca al gimnasio
    const { data: socio, error: socioError } = await supabase
      .from('socio')
      .select('id_socio')
      .eq('id_socio', id_socio)
      .eq('id_gimnasio', idGimnasio)
      .single();

    if (socioError || !socio) {
      return res.status(404).json({ error: 'Socio no encontrado en este gimnasio.' });
    }

    const { data: historial, error } = await supabase
      .from('asistencia')
      .select('*')
      .eq('id_socio', id_socio)
      .order('hora_ingreso', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Error al obtener historial: ' + error.message });
    }

    return res.status(200).json({
      id_socio: parseInt(id_socio),
      total_asistencias: historial.length,
      historial: historial || []
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};
// 4. Marcar la salida de un socio (Checkout)
const checkoutAsistencia = async (req, res) => {
  try {
    const idGimnasio = req.usuario?.id_gimnasio;
    const { id } = req.params; // id_asistencia
    const { estado, hora_salida } = req.body;

    // 1. Buscar la asistencia e inspeccionar que pertenezca al gimnasio del dueño
    const { data: asistencia, error: findError } = await supabase
      .from('asistencia')
      .select(`
        *,
        socio!inner (
          id_gimnasio
        )
      `)
      .eq('id_asistencia', id)
      .eq('socio.id_gimnasio', idGimnasio)
      .single();

    if (findError || !asistencia) {
      return res.status(404).json({ error: 'La asistencia no existe o no pertenece a este gimnasio.' });
    }

    // 2. Validar que la asistencia esté en estado "presente"
    if (asistencia.estado !== 'presente') {
      return res.status(400).json({ 
        error: `No se puede registrar la salida. El estado actual de la asistencia es '${asistencia.estado}'.` 
      });
    }

    // 3. Actualizar el estado y la hora de salida
    const nuevoEstado = estado || 'completado';
    const nuevaHoraSalida = hora_salida || new Date().toISOString();

    const { data: asistenciaActualizada, error: updateError } = await supabase
      .from('asistencia')
      .update({
        estado: nuevoEstado,
        hora_salida: nuevaHoraSalida
      })
      .eq('id_asistencia', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Error al registrar la salida: ' + updateError.message });
    }

    return res.status(200).json({
      mensaje: 'Salida registrada correctamente.',
      asistencia: asistenciaActualizada
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

module.exports = {
  createAsistencia,
  getAsistencias,
  getAsistenciasBySocio,
  checkoutAsistencia // 👈 Asegúrate de agregarlo aquí
};