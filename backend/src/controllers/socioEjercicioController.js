// ==============================================================================
// CONTROLADOR DE EJERCICIOS DEL SOCIO (GIMNASIO SELECCIONADO + PERSONALES)
// - Propietario exclusivo garantizado: ejercicios propios tienen id_gimnasio = NULL.
// - Ejercicios personales siempre visibles sin importar el gimnasio seleccionado.
// - Ejercicios del gimnasio filtrados al gimnasio activo, solo lectura para socio.
// ==============================================================================

/**
 * 1. GET /api/socio/ejercicios
 */
const getEjerciciosSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso reservado para socios autenticados.' });
    }

    if (u.requested_gym_id && !u.requested_gym_autorizado) {
      return res.status(403).json({ error: 'No tienes acceso al gimnasio solicitado.' });
    }

    const idSocio = u.id_socio;
    const idGimnasio = u.id_gimnasio;
    const { origen = 'todos', grupo_muscular, search } = req.query;

    let query = db.from('ejercicio').select('*');

    if (origen === 'gimnasio') {
      if (!idGimnasio) return res.status(200).json([]);
      query = query.eq('id_gimnasio', idGimnasio).is('id_socio', null);
    } else if (origen === 'propio') {
      query = query.eq('id_socio', idSocio).is('id_gimnasio', null);
    } else {
      if (idGimnasio) {
        query = query.or(
          `and(id_gimnasio.eq.${idGimnasio},id_socio.is.null),and(id_socio.eq.${idSocio},id_gimnasio.is.null)`
        );
      } else {
        query = query.eq('id_socio', idSocio).is('id_gimnasio', null);
      }
    }

    if (grupo_muscular && grupo_muscular !== 'todos') {
      query = query.ilike('grupo_muscular', `%${String(grupo_muscular).trim()}%`);
    }

    if (search && String(search).trim()) {
      query = query.ilike('nombre', `%${String(search).trim()}%`);
    }

    query = query.order('nombre', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // Sin duplicados por id_ejercicio
    const mapa = new Map();
    (data || []).forEach((ej) => {
      if (mapa.has(ej.id_ejercicio)) return;
      const esPropio = Boolean(ej.id_socio && Number(ej.id_socio) === Number(idSocio));
      mapa.set(ej.id_ejercicio, {
        id_ejercicio: ej.id_ejercicio,
        nombre: ej.nombre,
        descripcion: ej.descripcion || 'Sin descripción técnica disponible',
        grupo_muscular: ej.grupo_muscular || 'General',
        dificultad: ej.dificultad || 'Intermedia',
        id_gimnasio: ej.id_gimnasio,
        id_socio: ej.id_socio,
        origen: esPropio ? 'Mi ejercicio' : 'Gimnasio',
        tipo_origen: esPropio ? 'propio' : 'gimnasio',
        es_propio: esPropio,
        es_gimnasio: !esPropio,
        puede_editar: esPropio,
        puede_eliminar: esPropio
      });
    });

    return res.status(200).json(Array.from(mapa.values()));
  } catch (error) {
    return res.status(500).json({ error: 'Error al consultar ejercicios del socio: ' + error.message });
  }
};

/**
 * 2. POST /api/socio/ejercicios
 * Crea un ejercicio personal del socio (id_socio = X, id_gimnasio = NULL).
 */
const crearEjercicioSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso reservado para socios autenticados.' });
    }

    const { nombre, grupo_muscular, descripcion, dificultad } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del ejercicio es obligatorio.' });
    }

    const { data, error } = await db
      .from('ejercicio')
      .insert([
        {
          nombre: String(nombre).trim(),
          grupo_muscular: grupo_muscular ? String(grupo_muscular).trim() : 'General',
          descripcion: descripcion ? String(descripcion).trim() : null,
          dificultad: dificultad || 'Intermedia',
          id_socio: u.id_socio,
          id_gimnasio: null
        }
      ])
      .select('*')
      .single();

    if (error) throw error;

    return res.status(201).json({
      mensaje: '¡Ejercicio personal creado exitosamente!',
      ejercicio: {
        ...data,
        origen: 'Mi ejercicio',
        tipo_origen: 'propio',
        es_propio: true,
        es_gimnasio: false,
        puede_editar: true,
        puede_eliminar: true
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al crear el ejercicio personal: ' + error.message });
  }
};

/**
 * 3. PUT /api/socio/ejercicios/:id
 */
const actualizarEjercicioSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id } = req.params;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    const { data: existente, error: getErr } = await db
      .from('ejercicio')
      .select('id_ejercicio, id_socio, id_gimnasio, nombre')
      .eq('id_ejercicio', id)
      .maybeSingle();

    if (getErr || !existente) {
      return res.status(404).json({ error: 'El ejercicio solicitado no fue encontrado.' });
    }

    if (!existente.id_socio || Number(existente.id_socio) !== Number(u.id_socio)) {
      return res.status(403).json({
        error: 'Permiso denegado: no puedes modificar ejercicios del gimnasio ni de otros socios.'
      });
    }

    const { nombre, grupo_muscular, descripcion, dificultad } = req.body;
    const updateFields = {};
    if (nombre !== undefined && String(nombre).trim()) updateFields.nombre = String(nombre).trim();
    if (grupo_muscular !== undefined) updateFields.grupo_muscular = String(grupo_muscular).trim();
    if (descripcion !== undefined) updateFields.descripcion = descripcion ? String(descripcion).trim() : null;
    if (dificultad !== undefined) updateFields.dificultad = dificultad;

    const { data, error } = await db
      .from('ejercicio')
      .update(updateFields)
      .eq('id_ejercicio', id)
      .eq('id_socio', u.id_socio)
      .select('*')
      .single();

    if (error) throw error;

    return res.status(200).json({
      mensaje: 'Ejercicio personal actualizado con éxito.',
      ejercicio: {
        ...data,
        origen: 'Mi ejercicio',
        tipo_origen: 'propio',
        es_propio: true,
        es_gimnasio: false,
        puede_editar: true,
        puede_eliminar: true
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al actualizar el ejercicio: ' + error.message });
  }
};

/**
 * 4. DELETE /api/socio/ejercicios/:id
 */
const eliminarEjercicioSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id } = req.params;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    const { data: existente, error: getErr } = await db
      .from('ejercicio')
      .select('id_ejercicio, id_socio, id_gimnasio, nombre')
      .eq('id_ejercicio', id)
      .maybeSingle();

    if (getErr || !existente) {
      return res.status(404).json({ error: 'El ejercicio solicitado no fue encontrado.' });
    }

    if (!existente.id_socio || Number(existente.id_socio) !== Number(u.id_socio)) {
      return res.status(403).json({
        error: 'Permiso denegado: no puedes eliminar ejercicios oficiales del gimnasio ni de otros socios.'
      });
    }

    // Quitar referencias de sus propias rutinas si existen antes de eliminar
    await db
      .from('rutina_ejercicio')
      .delete()
      .eq('id_ejercicio', id);

    const { error } = await db
      .from('ejercicio')
      .delete()
      .eq('id_ejercicio', id)
      .eq('id_socio', u.id_socio);

    if (error) throw error;

    return res.status(200).json({
      mensaje: `El ejercicio personal "${existente.nombre}" fue eliminado exitosamente.`
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar el ejercicio personal: ' + error.message });
  }
};

module.exports = {
  getEjerciciosSocio,
  crearEjercicioSocio,
  actualizarEjercicioSocio,
  eliminarEjercicioSocio
};
