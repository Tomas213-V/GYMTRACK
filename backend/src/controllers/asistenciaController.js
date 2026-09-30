const supabase = require('../config/supabase');

// 1. Registrar Ingreso
const registrarIngreso = async (req, res) => {
  try {
    const id_socio = req.usuario.id_socio;

    if (!id_socio) {
      return res.status(400).json({ error: 'El usuario autenticado no tiene un perfil de socio vinculado.' });
    }

    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const { data: asistenciaExistente, error: checkError } = await supabase
      .from('asistencia')
      .select('*')
      .eq('id_socio', id_socio)
      .gte('hora_ingreso', hoyInicio.toISOString())
      .lte('hora_ingreso', hoyFin.toISOString())
      .maybeSingle();

    if (checkError) throw checkError;

    if (asistenciaExistente) {
      return res.status(400).json({
        error: 'Ya has registrado tu asistencia en el día de hoy.'
      });
    }

    const { data, error } = await supabase
      .from('asistencia')
      .insert([
        {
          id_socio: id_socio,
          hora_ingreso: new Date().toISOString(),
          hora_salida: null,
          estado: 'registrada'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      mensaje: 'Ingreso registrado correctamente.',
      asistencia: data
    });
  } catch (error) {
    console.error('Error al registrar ingreso:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// 2. Registrar Salida
const registrarSalida = async (req, res) => {
  try {
    const id_socio = req.usuario.id_socio;

    if (!id_socio) {
      return res.status(400).json({ error: 'El usuario autenticado no tiene un perfil de socio vinculado.' });
    }

    const { data: asistenciaActiva, error: findError } = await supabase
      .from('asistencia')
      .select('*')
      .eq('id_socio', id_socio)
      .is('hora_salida', null)
      .order('hora_ingreso', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    if (!asistenciaActiva) {
      return res.status(400).json({
        error: 'No se encontró un registro de ingreso activo para marcar salida.'
      });
    }

    const { data, error } = await supabase
      .from('asistencia')
      .update({
        hora_salida: new Date().toISOString(),
        estado: 'completado'
      })
      .eq('id_asistencia', asistenciaActiva.id_asistencia)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      mensaje: 'Salida registrada correctamente.',
      asistencia: data
    });
  } catch (error) {
    console.error('Error al registrar salida:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// 3. Consultar Historial
const obtenerHistorial = async (req, res) => {
  try {
    const id_socio = req.usuario.id_socio;

    const { data, error } = await supabase
      .from('asistencia')
      .select('*')
      .eq('id_socio', id_socio)
      .order('hora_ingreso', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      historial: data
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// 4. Estado del Día
const obtenerEstadoHoy = async (req, res) => {
  try {
    const id_socio = req.usuario.id_socio;

    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('asistencia')
      .select('*')
      .eq('id_socio', id_socio)
      .gte('hora_ingreso', hoyInicio.toISOString())
      .lte('hora_ingreso', hoyFin.toISOString())
      .maybeSingle();

    if (error) throw error;

    return res.status(200).json({
      registroHoy: data || null,
      ingresadoHoy: !!data
    });
  } catch (error) {
    console.error('Error al obtener estado del día:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  registrarIngreso,
  registrarSalida,
  obtenerHistorial,
  obtenerEstadoHoy
};