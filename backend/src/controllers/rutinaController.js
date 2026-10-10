// backend/src/controllers/rutinaController.js
const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

/**
 * Helper para resolver el usuario autenticado desde el token JWT
 */
const resolverUsuario = (req) => {
  if (req.usuario) return req.usuario;
  const authHeader = req.headers?.['authorization'] || req.headers?.['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'gymtrack_jwt_secret_key_2026';
      req.usuario = jwt.verify(token, secret);
      return req.usuario;
    } catch {
      // Ignorar si el token no es válido o ha expirado
    }
  }
  return null;
};

/**
 * Enriquecer listado de ejercicios asociados con origen ('Gimnasio' vs 'Mi ejercicio')
 */
const enriquecerEjerciciosRutina = (rutinaEjercicios = []) => {
  if (!Array.isArray(rutinaEjercicios)) return [];
  return rutinaEjercicios.map((re) => {
    const ej = re.ejercicio || {};
    const esPropio = Boolean(ej.id_socio);
    return {
      ...re,
      origen: esPropio ? 'Mi ejercicio' : 'Gimnasio',
      tipo_origen: esPropio ? 'propio' : 'gimnasio',
      es_propio: esPropio,
      es_gimnasio: !esPropio
    };
  });
};

// 1. Obtener todas las rutinas con socio y ejercicios asociados
exports.getAllRutinas = async (req, res) => {
  try {
    const usuario = resolverUsuario(req);
    let { search, id_socio, estado } = req.query;

    // Si el usuario autenticado es socio, por defecto sólo ve sus propias rutinas
    if (!id_socio && usuario?.rol === 'socio' && usuario.id_socio) {
      id_socio = usuario.id_socio;
    }

    let query = supabase
      .from('rutina')
      .select(`
        id_rutina,
        nombre,
        descripcion,
        fecha_inicio,
        fecha_fin,
        estado,
        id_socio,
        id_gimnasio,
        socio (
          id_socio,
          nombre,
          apellido,
          dni,
          id_gimnasio
        ),
        rutina_ejercicio (
          id_rutina_ejercicio,
          id_ejercicio,
          series,
          repeticiones,
          peso,
          descanso,
          orden,
          ejercicio (
            id_ejercicio,
            nombre,
            grupo_muscular,
            dificultad,
            descripcion,
            id_gimnasio,
            id_socio
          )
        )
      `)
      .order('id_rutina', { ascending: false });

    // Filtrar por socio si se proporciona
    if (id_socio && id_socio !== 'todos') {
      query = query.eq('id_socio', Number(id_socio));
    }

    // Filtrar por estado si se proporciona
    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado);
    }

    // Filtrar por nombre de rutina
    if (search && search.trim()) {
      const clean = search.trim();
      query = query.ilike('nombre', `%${clean}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Formatear y enriquecer ejercicios de cada rutina
    const rutinasFormateadas = (data || []).map((r) => {
      const ejercicios = enriquecerEjerciciosRutina(r.rutina_ejercicio);
      ejercicios.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      return {
        ...r,
        rutina_ejercicio: ejercicios
      };
    });

    return res.status(200).json(rutinasFormateadas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Obtener rutina por ID junto a sus ejercicios completos
exports.getRutinaById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('rutina')
      .select(`
        id_rutina,
        nombre,
        descripcion,
        fecha_inicio,
        fecha_fin,
        estado,
        id_socio,
        id_gimnasio,
        socio (
          id_socio,
          nombre,
          apellido,
          dni,
          id_gimnasio
        ),
        rutina_ejercicio (
          id_rutina_ejercicio,
          id_ejercicio,
          series,
          repeticiones,
          peso,
          descanso,
          orden,
          ejercicio (
            id_ejercicio,
            nombre,
            grupo_muscular,
            dificultad,
            descripcion,
            id_gimnasio,
            id_socio
          )
        )
      `)
      .eq('id_rutina', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: `Rutina con ID ${id} no encontrada.` });
    }

    // Enriquecer y ordenar ejercicios
    const ejercicios = enriquecerEjerciciosRutina(data.rutina_ejercicio);
    ejercicios.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    data.rutina_ejercicio = ejercicios;

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. Crear una nueva rutina
exports.createRutina = async (req, res) => {
  try {
    const usuario = resolverUsuario(req);
    const { nombre, descripcion, id_socio, fecha_inicio, fecha_fin, estado } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre de la rutina es obligatorio.' });
    }

    let socioAsignado = id_socio ? Number(id_socio) : null;
    if (!socioAsignado && usuario?.rol === 'socio' && usuario.id_socio) {
      socioAsignado = usuario.id_socio;
    }

    // Si tenemos el socio, obtener su gimnasio
    let gymId = usuario?.id_gimnasio || null;
    if (socioAsignado && !gymId) {
      const { data: socioData } = await supabase
        .from('socio')
        .select('id_gimnasio')
        .eq('id_socio', socioAsignado)
        .maybeSingle();
      if (socioData) gymId = socioData.id_gimnasio;
    }

    const { data, error } = await supabase
      .from('rutina')
      .insert([
        {
          nombre: nombre.trim(),
          descripcion: descripcion ? (typeof descripcion === 'string' ? descripcion.trim() : JSON.stringify(descripcion)) : null,
          id_socio: socioAsignado,
          id_gimnasio: gymId,
          fecha_inicio: fecha_inicio || new Date().toISOString().split('T')[0],
          fecha_fin: fecha_fin || null,
          estado: estado || 'asignada'
        }
      ])
      .select(`
        id_rutina,
        nombre,
        descripcion,
        fecha_inicio,
        fecha_fin,
        estado,
        id_socio,
        id_gimnasio,
        socio (
          id_socio,
          nombre,
          apellido,
          dni
        )
      `)
      .single();

    if (error) throw error;
    return res.status(201).json({
      ...data,
      rutina_ejercicio: []
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. Actualizar rutina existente
exports.updateRutina = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, id_socio, fecha_inicio, fecha_fin, estado } = req.body;

    const updateFields = {};
    if (nombre !== undefined) updateFields.nombre = nombre.trim();
    if (descripcion !== undefined) {
      updateFields.descripcion = typeof descripcion === 'string' ? descripcion : JSON.stringify(descripcion);
    }
    if (id_socio !== undefined) updateFields.id_socio = id_socio ? Number(id_socio) : null;
    if (fecha_inicio !== undefined) updateFields.fecha_inicio = fecha_inicio;
    if (fecha_fin !== undefined) updateFields.fecha_fin = fecha_fin;
    if (estado !== undefined) updateFields.estado = estado;

    const { data, error } = await supabase
      .from('rutina')
      .update(updateFields)
      .eq('id_rutina', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: `No se encontró la rutina ${id} para actualizar.` });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 5. Eliminar rutina y limpiar dependencias
exports.deleteRutina = async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminamos primero relaciones de ejercicios asociados
    await supabase.from('rutina_ejercicio').delete().eq('id_rutina', id);

    const { data, error } = await supabase
      .from('rutina')
      .delete()
      .eq('id_rutina', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: `La rutina ${id} no existe.` });
    }

    return res.status(200).json({ message: `Rutina ${id} eliminada correctamente.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 6. Consultar sólo los ejercicios de una rutina
exports.getEjerciciosByRutina = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('rutina_ejercicio')
      .select(`
        id_rutina_ejercicio,
        id_ejercicio,
        series,
        repeticiones,
        peso,
        descanso,
        orden,
        ejercicio (
          id_ejercicio,
          nombre,
          grupo_muscular,
          dificultad,
          descripcion,
          id_gimnasio,
          id_socio
        )
      `)
      .eq('id_rutina', id)
      .order('orden', { ascending: true });

    if (error) throw error;

    const enriquecidos = enriquecerEjerciciosRutina(data || []);
    return res.status(200).json(enriquecidos);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 7. Asociar un ejercicio a la rutina con validación de permisos
exports.addEjercicioToRutina = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_ejercicio, series, serie, repeticiones, peso, descanso, orden } = req.body;

    if (!id_ejercicio) {
      return res.status(400).json({ error: 'El id_ejercicio es obligatorio.' });
    }

    // A. Consultar la rutina para conocer su socio y gimnasio
    const { data: rutina, error: rutinaError } = await supabase
      .from('rutina')
      .select('id_rutina, id_socio, id_gimnasio')
      .eq('id_rutina', id)
      .maybeSingle();

    if (rutinaError || !rutina) {
      return res.status(404).json({ error: `La rutina con ID ${id} no existe.` });
    }

    // B. Consultar el ejercicio para verificar su disponibilidad
    const { data: ejercicio, error: ejError } = await supabase
      .from('ejercicio')
      .select('id_ejercicio, nombre, grupo_muscular, dificultad, descripcion, id_gimnasio, id_socio')
      .eq('id_ejercicio', id_ejercicio)
      .maybeSingle();

    if (ejError || !ejercicio) {
      return res.status(404).json({ error: `El ejercicio con ID ${id_ejercicio} no existe en el sistema.` });
    }

    // C. VALIDACIÓN: El socio sólo puede utilizar ejercicios disponibles para él
    // C.1. Si es un ejercicio propio (id_socio no nulo), DEBE pertenecer al socio de la rutina
    if (ejercicio.id_socio && rutina.id_socio && Number(ejercicio.id_socio) !== Number(rutina.id_socio)) {
      return res.status(403).json({
        error: 'Acceso denegado: No podés utilizar un ejercicio personalizado creado por otro socio.'
      });
    }

    // C.2. Si es un ejercicio del gimnasio (id_socio es nulo y tiene id_gimnasio), DEBE pertenecer al gimnasio del socio
    if (!ejercicio.id_socio && ejercicio.id_gimnasio) {
      let gymSocio = rutina.id_gimnasio;
      if (!gymSocio && rutina.id_socio) {
        const { data: socioData } = await supabase
          .from('socio')
          .select('id_gimnasio')
          .eq('id_socio', rutina.id_socio)
          .maybeSingle();
        if (socioData) gymSocio = socioData.id_gimnasio;
      }

      if (gymSocio && Number(ejercicio.id_gimnasio) !== Number(gymSocio)) {
        return res.status(403).json({
          error: 'Acceso denegado: El ejercicio pertenece a otro gimnasio y no está disponible para este socio.'
        });
      }
    }

    const numSeries = Number(series || serie || 4);
    let numReps = parseInt(repeticiones, 10);
    if (isNaN(numReps) || numReps <= 0) numReps = 12;

    const numPeso = Number(peso || 0);
    const numDescanso = Number(descanso || 60);
    const numOrden = Number(orden || 1);

    const { data, error } = await supabase
      .from('rutina_ejercicio')
      .insert([
        {
          id_rutina: Number(id),
          id_ejercicio: Number(id_ejercicio),
          series: numSeries,
          repeticiones: numReps,
          peso: numPeso,
          descanso: numDescanso,
          orden: numOrden
        }
      ])
      .select(`
        id_rutina_ejercicio,
        id_ejercicio,
        series,
        repeticiones,
        peso,
        descanso,
        orden,
        ejercicio (
          id_ejercicio,
          nombre,
          grupo_muscular,
          dificultad,
          descripcion,
          id_gimnasio,
          id_socio
        )
      `)
      .single();

    if (error) {
      if (error.code === '23503') {
        return res.status(400).json({ error: 'El ejercicio especificado o la rutina no existen.' });
      }
      throw error;
    }

    const esPropio = Boolean(data.ejercicio?.id_socio);
    const enriquecido = {
      ...data,
      origen: esPropio ? 'Mi ejercicio' : 'Gimnasio',
      tipo_origen: esPropio ? 'propio' : 'gimnasio',
      es_propio: esPropio,
      es_gimnasio: !esPropio
    };

    return res.status(201).json(enriquecido);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 8. Actualizar parámetros de un ejercicio en la rutina
exports.updateEjercicioEnRutina = async (req, res) => {
  try {
    const { id, ejercicioId } = req.params;
    const { series, serie, repeticiones, peso, descanso, orden, id_ejercicio } = req.body;

    // Si se modifica el id_ejercicio, validar disponibilidad
    if (id_ejercicio) {
      const { data: rutina } = await supabase
        .from('rutina')
        .select('id_rutina, id_socio, id_gimnasio')
        .eq('id_rutina', id)
        .maybeSingle();

      const { data: nuevoEj } = await supabase
        .from('ejercicio')
        .select('id_ejercicio, id_socio, id_gimnasio')
        .eq('id_ejercicio', id_ejercicio)
        .maybeSingle();

      if (nuevoEj?.id_socio && rutina?.id_socio && Number(nuevoEj.id_socio) !== Number(rutina.id_socio)) {
        return res.status(403).json({
          error: 'No podés asignar un ejercicio propio perteneciente a otro socio.'
        });
      }
    }

    const updateFields = {};
    if (series !== undefined || serie !== undefined) updateFields.series = Number(series || serie);
    if (repeticiones !== undefined) {
      const parsedReps = parseInt(repeticiones, 10);
      updateFields.repeticiones = isNaN(parsedReps) ? 12 : parsedReps;
    }
    if (peso !== undefined) updateFields.peso = Number(peso);
    if (descanso !== undefined) updateFields.descanso = Number(descanso);
    if (orden !== undefined) updateFields.orden = Number(orden);
    if (id_ejercicio !== undefined) updateFields.id_ejercicio = Number(id_ejercicio);

    let query = supabase
      .from('rutina_ejercicio')
      .update(updateFields)
      .eq('id_rutina', id);

    // Permitir identificar por id_rutina_ejercicio o id_ejercicio
    if (ejercicioId) {
      query = query.or(`id_rutina_ejercicio.eq.${ejercicioId},id_ejercicio.eq.${ejercicioId}`);
    }

    const { data, error } = await query
      .select(`
        id_rutina_ejercicio,
        id_ejercicio,
        series,
        repeticiones,
        peso,
        descanso,
        orden,
        ejercicio (
          id_ejercicio,
          nombre,
          grupo_muscular,
          dificultad,
          descripcion,
          id_gimnasio,
          id_socio
        )
      `);

    if (error) throw error;

    const resultado = data && data.length > 0 ? data[0] : null;
    if (!resultado) {
      return res.status(404).json({ error: 'El ejercicio a actualizar no fue encontrado en la rutina.' });
    }

    const esPropio = Boolean(resultado.ejercicio?.id_socio);
    return res.status(200).json({
      ...resultado,
      origen: esPropio ? 'Mi ejercicio' : 'Gimnasio',
      tipo_origen: esPropio ? 'propio' : 'gimnasio',
      es_propio: esPropio,
      es_gimnasio: !esPropio
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 9. Desvincular ejercicio de la rutina
exports.removeEjercicioFromRutina = async (req, res) => {
  try {
    const { id, ejercicioId } = req.params;

    // Intentar eliminar por id_rutina_ejercicio o id_ejercicio
    const { data, error } = await supabase
      .from('rutina_ejercicio')
      .delete()
      .eq('id_rutina', id)
      .or(`id_rutina_ejercicio.eq.${ejercicioId},id_ejercicio.eq.${ejercicioId}`)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'El ejercicio no estaba asociado a esta rutina.' });
    }

    return res.status(200).json({ message: 'Ejercicio desvinculado con éxito de la rutina.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};