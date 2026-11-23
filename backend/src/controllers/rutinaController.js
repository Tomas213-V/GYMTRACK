// ==============================================================================
// CONTROLADOR DE RUTINAS PERSONALES DEL SOCIO (NUEVO ESQUEMA SUPABASE)
// Tablas: public.rutina (id_rutina, nombre, descripcion, fecha_inicio, fecha_fin,
//                        estado boolean, id_socio NOT NULL)
//         public.rutina_ejercicio (series, repeticiones, peso, descanso, orden,
//                                  id_rutina, id_ejercicio)
// - La rutina pertenece directamente al socio (sin id_gimnasio ni id_sucursal).
// - Permanece disponible al cambiar de gimnasio.
// - Reordenamiento atómico vía rpc_reordenar_rutina_ejercicios.
// - Compatibilidad de ejercicios validada en backend + trigger PostgreSQL.
// ==============================================================================

function parseBooleanEstado(valor, defaultVal = true) {
  if (valor === undefined || valor === null) return defaultVal;
  if (typeof valor === 'boolean') return valor;
  const s = String(valor).trim().toLowerCase();
  if (['true', '1', 'activa', 'activo', 'asignada'].includes(s)) return true;
  if (['false', '0', 'inactiva', 'inactivo', 'pausada', 'archivada'].includes(s)) return false;
  return defaultVal;
}

function enriquecerEjerciciosRutina(rutinaEjercicios = []) {
  if (!Array.isArray(rutinaEjercicios)) return [];
  return [...rutinaEjercicios]
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .map((re) => {
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
}

function formatearRutina(r) {
  if (!r) return null;
  return {
    ...r,
    estado_bool: r.estado,
    estado: r.estado ? 'activa' : 'inactiva',
    rutina_ejercicio: enriquecerEjerciciosRutina(r.rutina_ejercicio)
  };
}

const RUTINA_SELECT = `
  id_rutina,
  nombre,
  descripcion,
  fecha_inicio,
  fecha_fin,
  estado,
  id_socio,
  socio (
    id_socio,
    nombre,
    apellido,
    dni
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
`;

/**
 * 1. GET /api/rutinas
 * - Socio: obtiene TODAS sus rutinas personales (independiente del gimnasio seleccionado).
 * - Dueño/Entrenador: obtiene rutinas de socios vinculados a su gimnasio activo.
 */
exports.getAllRutinas = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    let { search, id_socio, estado } = req.query;

    let query = db
      .from('rutina')
      .select(RUTINA_SELECT)
      .order('estado', { ascending: false })
      .order('id_rutina', { ascending: false });

    if (u.rol === 'socio') {
      query = query.eq('id_socio', u.id_socio);
    } else {
      // Staff: limitar a socios vinculados al gimnasio activo
      if (u.id_gimnasio) {
        const { data: membs } = await db
          .from('membresia_socio')
          .select('id_socio')
          .eq('id_gimnasio', u.id_gimnasio);

        const sociosGymIds = Array.from(new Set((membs || []).map((m) => m.id_socio)));
        if (sociosGymIds.length === 0) {
          return res.status(200).json([]);
        }
        if (id_socio && id_socio !== 'todos') {
          if (!sociosGymIds.includes(Number(id_socio))) {
            return res.status(403).json({ error: 'El socio no pertenece al gimnasio activo.' });
          }
          query = query.eq('id_socio', Number(id_socio));
        } else {
          query = query.in('id_socio', sociosGymIds);
        }
      }
    }

    if (estado !== undefined && estado !== '' && estado !== 'todos') {
      query = query.eq('estado', parseBooleanEstado(estado, true));
    }

    if (search && String(search).trim()) {
      query = query.ilike('nombre', `%${String(search).trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json((data || []).map(formatearRutina));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 2. GET /api/rutinas/:id
 */
exports.getRutinaById = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;

    const { data, error } = await db
      .from('rutina')
      .select(RUTINA_SELECT)
      .eq('id_rutina', id)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: `Rutina #${id} no encontrada o sin permisos.` });
    }

    return res.status(200).json(formatearRutina(data));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 3. POST /api/rutinas
 * Crea una rutina personal del socio (sin depender de sucursal ni gimnasio).
 */
exports.createRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { nombre, descripcion, id_socio, fecha_inicio, fecha_fin, estado } = req.body;

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre de la rutina es obligatorio.' });
    }

    let socioAsignado = null;
    if (u.rol === 'socio') {
      socioAsignado = u.id_socio;
    } else {
      socioAsignado = id_socio ? Number(id_socio) : null;
      if (!socioAsignado) {
        return res.status(400).json({ error: 'Debes seleccionar el socio propietario de la rutina.' });
      }
    }

    const { data, error } = await db
      .from('rutina')
      .insert([
        {
          nombre: String(nombre).trim(),
          descripcion: descripcion
            ? typeof descripcion === 'string'
              ? descripcion.trim()
              : JSON.stringify(descripcion)
            : null,
          id_socio: socioAsignado,
          fecha_inicio: fecha_inicio || new Date().toISOString().split('T')[0],
          fecha_fin: fecha_fin || null,
          estado: parseBooleanEstado(estado, true)
        }
      ])
      .select(RUTINA_SELECT)
      .single();

    if (error) {
      return res.status(400).json({ error: 'Error al crear la rutina: ' + error.message });
    }

    return res.status(201).json(formatearRutina(data));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 4. PUT /api/rutinas/:id
 */
exports.updateRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const { nombre, descripcion, fecha_inicio, fecha_fin, estado } = req.body;

    const updateFields = {};
    if (nombre !== undefined && String(nombre).trim()) updateFields.nombre = String(nombre).trim();
    if (descripcion !== undefined) {
      updateFields.descripcion =
        descripcion === null
          ? null
          : typeof descripcion === 'string'
          ? descripcion.trim()
          : JSON.stringify(descripcion);
    }
    if (fecha_inicio !== undefined) updateFields.fecha_inicio = fecha_inicio || null;
    if (fecha_fin !== undefined) updateFields.fecha_fin = fecha_fin || null;
    if (estado !== undefined) updateFields.estado = parseBooleanEstado(estado, true);

    const { data, error } = await db
      .from('rutina')
      .update(updateFields)
      .eq('id_rutina', id)
      .select(RUTINA_SELECT)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: 'Error al actualizar la rutina: ' + error.message });
    }
    if (!data) {
      return res.status(404).json({ error: `Rutina #${id} no encontrada o sin permisos.` });
    }

    return res.status(200).json(formatearRutina(data));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 5. DELETE /api/rutinas/:id
 */
exports.deleteRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;

    const { data, error } = await db
      .from('rutina')
      .delete()
      .eq('id_rutina', id)
      .select('id_rutina');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: `La rutina #${id} no existe o no tienes permisos.` });
    }

    return res.status(200).json({ mensaje: `Rutina #${id} eliminada correctamente.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 6. PUT /api/rutinas/:id/activar
 * Marca esta rutina como activa (estado = true) y desactiva las demás del mismo socio.
 */
exports.activarRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;

    const { data: rutina, error: findErr } = await db
      .from('rutina')
      .select('id_rutina, id_socio')
      .eq('id_rutina', id)
      .maybeSingle();

    if (findErr || !rutina) {
      return res.status(404).json({ error: 'Rutina no encontrada o sin permisos.' });
    }

    await db
      .from('rutina')
      .update({ estado: false })
      .eq('id_socio', rutina.id_socio)
      .neq('id_rutina', id);

    const { data: activada, error: updErr } = await db
      .from('rutina')
      .update({ estado: true })
      .eq('id_rutina', id)
      .select(RUTINA_SELECT)
      .single();

    if (updErr) throw updErr;

    return res.status(200).json({
      mensaje: 'Rutina activada correctamente.',
      rutina: formatearRutina(activada)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 7. GET /api/rutinas/:id/ejercicios
 */
exports.getEjerciciosByRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;

    const { data, error } = await db
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

    return res.status(200).json(enriquecerEjerciciosRutina(data || []));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 8. POST /api/rutinas/:id/ejercicios
 * Asocia un ejercicio (propio del socio o de un gimnasio autorizado) respetando uq_orden_en_rutina.
 */
exports.addEjercicioToRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const { id_ejercicio, series, serie, repeticiones, peso, descanso, orden } = req.body;

    if (!id_ejercicio) {
      return res.status(400).json({ error: 'El id_ejercicio es obligatorio.' });
    }

    const { data: rutina, error: rutinaError } = await db
      .from('rutina')
      .select('id_rutina, id_socio')
      .eq('id_rutina', id)
      .maybeSingle();

    if (rutinaError || !rutina) {
      return res.status(404).json({ error: `La rutina #${id} no existe o no tienes permisos.` });
    }

    const { data: ejercicio, error: ejError } = await db
      .from('ejercicio')
      .select('id_ejercicio, id_gimnasio, id_socio')
      .eq('id_ejercicio', id_ejercicio)
      .maybeSingle();

    if (ejError || !ejercicio) {
      return res.status(404).json({
        error: 'El ejercicio seleccionado no existe o no está autorizado para tu cuenta.'
      });
    }

    // Validación explícita de compatibilidad (además del trigger PostgreSQL)
    if (ejercicio.id_socio && Number(ejercicio.id_socio) !== Number(rutina.id_socio)) {
      return res.status(403).json({
        error: 'No puedes incorporar un ejercicio personal perteneciente a otro socio.'
      });
    }

    // Calcular orden automáticamente si no se especificó o si ya existe en la rutina
    const { data: existentes } = await db
      .from('rutina_ejercicio')
      .select('orden, id_ejercicio')
      .eq('id_rutina', id);

    if ((existentes || []).some((e) => Number(e.id_ejercicio) === Number(id_ejercicio))) {
      return res.status(400).json({ error: 'Este ejercicio ya se encuentra agregado en la rutina.' });
    }

    const maxOrden = (existentes || []).reduce((max, item) => Math.max(max, Number(item.orden || 0)), 0);
    const ordenSolicitado = orden ? Number(orden) : maxOrden + 1;
    const ordenOcupado = (existentes || []).some((e) => Number(e.orden) === ordenSolicitado);
    const ordenFinal = ordenOcupado ? maxOrden + 1 : Math.max(1, ordenSolicitado);

    const numSeries = Math.max(1, Number(series || serie || 4));
    const numReps = Math.max(1, parseInt(repeticiones, 10) || 12);
    const numPeso = peso !== undefined && peso !== null && peso !== '' ? Number(peso) : null;
    const numDescanso = descanso !== undefined && descanso !== null && descanso !== '' ? Number(descanso) : null;

    const { data, error } = await db
      .from('rutina_ejercicio')
      .insert([
        {
          id_rutina: Number(id),
          id_ejercicio: Number(id_ejercicio),
          series: numSeries,
          repeticiones: numReps,
          peso: numPeso,
          descanso: numDescanso,
          orden: ordenFinal
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
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json(enriquecerEjerciciosRutina([data])[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 9. PUT /api/rutinas/:id/ejercicios/:ejercicioId
 */
exports.updateEjercicioEnRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const { id, ejercicioId } = req.params;
    const { series, serie, repeticiones, peso, descanso, orden, id_ejercicio } = req.body;

    const updateFields = {};
    if (series !== undefined || serie !== undefined) updateFields.series = Math.max(1, Number(series || serie));
    if (repeticiones !== undefined) updateFields.repeticiones = Math.max(1, parseInt(repeticiones, 10) || 12);
    if (peso !== undefined) updateFields.peso = peso === '' || peso === null ? null : Number(peso);
    if (descanso !== undefined) updateFields.descanso = descanso === '' || descanso === null ? null : Number(descanso);
    if (orden !== undefined) updateFields.orden = Math.max(1, Number(orden));
    if (id_ejercicio !== undefined) updateFields.id_ejercicio = Number(id_ejercicio);

    const { data, error } = await db
      .from('rutina_ejercicio')
      .update(updateFields)
      .eq('id_rutina', id)
      .or(`id_rutina_ejercicio.eq.${ejercicioId},id_ejercicio.eq.${ejercicioId}`)
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

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const resultado = data && data.length > 0 ? data[0] : null;
    if (!resultado) {
      return res.status(404).json({ error: 'El ejercicio no fue encontrado en la rutina.' });
    }

    return res.status(200).json(enriquecerEjerciciosRutina([resultado])[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 10. PUT /api/rutinas/:id/ejercicios/reordenar
 * Reordena atómicamente los ejercicios de una rutina vía rpc_reordenar_rutina_ejercicios.
 * Body: { orden_ids: [id_rutina_ejercicio_1, id_rutina_ejercicio_2, ...] }
 */
exports.reordenarEjerciciosRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const { orden_ids } = req.body;

    if (!Array.isArray(orden_ids) || orden_ids.length === 0) {
      return res.status(400).json({ error: 'Debes enviar el arreglo orden_ids con los id_rutina_ejercicio ordenados.' });
    }

    const { error: rpcErr } = await db.rpc('rpc_reordenar_rutina_ejercicios', {
      p_id_rutina: Number(id),
      p_ids_ordenados: orden_ids.map(Number)
    });

    if (rpcErr) {
      return res.status(400).json({ error: rpcErr.message });
    }

    const { data: actualizados } = await db
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

    return res.status(200).json({
      mensaje: 'Orden de ejercicios actualizado correctamente.',
      ejercicios: enriquecerEjerciciosRutina(actualizados || [])
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 11. DELETE /api/rutinas/:id/ejercicios/:ejercicioId
 */
exports.removeEjercicioFromRutina = async (req, res) => {
  try {
    const db = req.supabase;
    const { id, ejercicioId } = req.params;

    const { data, error } = await db
      .from('rutina_ejercicio')
      .delete()
      .eq('id_rutina', id)
      .or(`id_rutina_ejercicio.eq.${ejercicioId},id_ejercicio.eq.${ejercicioId}`)
      .select('id_rutina_ejercicio');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'El ejercicio no estaba asociado a esta rutina.' });
    }

    return res.status(200).json({ mensaje: 'Ejercicio quitado de la rutina con éxito.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
