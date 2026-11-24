// ==============================================================================
// CONTROLADOR DE EJERCICIOS — PROPIETARIO EXCLUSIVO (GIMNASIO O SOCIO)
// Tabla: public.ejercicio
//   CHECK ck_propietario_ejercicio:
//     (id_gimnasio IS NOT NULL AND id_socio IS NULL) OR
//     (id_gimnasio IS NULL AND id_socio IS NOT NULL)
// - Ejercicios del gimnasio: id_gimnasio = X, id_socio = NULL
// - Ejercicios personales del socio: id_gimnasio = NULL, id_socio = Y
// ==============================================================================

function enriquecerEjercicio(ej, currentSocioId = null) {
  const esPropio = Boolean(ej.id_socio !== null && ej.id_socio !== undefined);
  const perteneceAlSocio = Boolean(esPropio && currentSocioId && Number(ej.id_socio) === Number(currentSocioId));
  return {
    ...ej,
    origen: esPropio ? 'Mi ejercicio' : 'Gimnasio',
    tipo_origen: esPropio ? 'propio' : 'gimnasio',
    es_propio: esPropio,
    es_gimnasio: !esPropio,
    pertenece_al_socio: perteneceAlSocio,
    puede_editar: perteneceAlSocio,
    puede_eliminar: perteneceAlSocio
  };
}

/**
 * 1. GET /api/ejercicios/disponibles
 * Devuelve ejercicios del gimnasio seleccionado + ejercicios personales del socio (sin duplicados).
 */
const getEjerciciosDisponiblesSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { origen = 'todos', grupo_muscular, search, limit = 100, page = 1 } = req.query;

    if (u.requested_gym_id && !u.requested_gym_autorizado) {
      return res.status(403).json({ error: 'No tienes acceso al gimnasio solicitado.' });
    }

    const idSocio = u.rol === 'socio' ? u.id_socio : (req.query.id_socio ? Number(req.query.id_socio) : null);
    const idGimnasio = u.id_gimnasio || null;

    let query = db.from('ejercicio').select('*');

    if (origen === 'gimnasio') {
      if (!idGimnasio) return res.status(200).json([]);
      query = query.eq('id_gimnasio', idGimnasio).is('id_socio', null);
    } else if (origen === 'propio') {
      if (!idSocio) return res.status(200).json([]);
      query = query.eq('id_socio', idSocio).is('id_gimnasio', null);
    } else {
      if (idSocio && idGimnasio) {
        query = query.or(`and(id_gimnasio.eq.${idGimnasio},id_socio.is.null),and(id_socio.eq.${idSocio},id_gimnasio.is.null)`);
      } else if (idSocio) {
        query = query.eq('id_socio', idSocio).is('id_gimnasio', null);
      } else if (idGimnasio) {
        query = query.eq('id_gimnasio', idGimnasio).is('id_socio', null);
      } else {
        return res.status(200).json([]);
      }
    }

    if (grupo_muscular && grupo_muscular !== 'todos') {
      query = query.ilike('grupo_muscular', `%${String(grupo_muscular).trim()}%`);
    }

    if (search && String(search).trim()) {
      query = query.ilike('nombre', `%${String(search).trim()}%`);
    }

    query = query.order('nombre', { ascending: true });

    if (limit && limit !== 'all') {
      const numLimit = Number(limit);
      const offset = (Number(page) - 1) * numLimit;
      query = query.range(offset, offset + numLimit - 1);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Error al consultar ejercicios: ' + error.message });
    }

    // Garantizar sin duplicados por id_ejercicio
    const uniqueMap = new Map();
    (data || []).forEach((ej) => {
      if (!uniqueMap.has(ej.id_ejercicio)) {
        uniqueMap.set(ej.id_ejercicio, enriquecerEjercicio(ej, idSocio));
      }
    });

    return res.status(200).json(Array.from(uniqueMap.values()));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 2. GET /api/ejercicios
 * Para socios: devuelve ejercicios del gimnasio activo + personales.
 * Para dueño/staff: devuelve exclusivamente los ejercicios del gimnasio activo (id_gimnasio = X, id_socio IS NULL).
 */
const getEjercicios = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { page = 1, limit = 50, grupo_muscular, search, origen } = req.query;

    if (u.rol === 'socio' || origen) {
      return getEjerciciosDisponiblesSocio(req, res);
    }

    if (u.requested_gym_id && !u.requested_gym_autorizado) {
      return res.status(403).json({ error: 'No tienes acceso al gimnasio solicitado.' });
    }

    const gymId = u.id_gimnasio;
    if (!gymId) {
      return res.status(200).json({ total: 0, pagina: 1, limite: Number(limit) || 50, datos: [] });
    }

    let query = db
      .from('ejercicio')
      .select('*', { count: 'exact' })
      .eq('id_gimnasio', gymId)
      .is('id_socio', null);

    if (grupo_muscular && grupo_muscular !== 'todos') {
      query = query.ilike('grupo_muscular', `%${String(grupo_muscular).trim()}%`);
    }

    if (search && String(search).trim()) {
      query = query.ilike('nombre', `%${String(search).trim()}%`);
    }

    query = query.order('id_ejercicio', { ascending: false });

    if (limit !== 'all') {
      const offset = (Number(page) - 1) * Number(limit);
      query = query.range(offset, offset + Number(limit) - 1);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const datosEnriquecidos = (data || []).map((ej) => enriquecerEjercicio(ej, null));

    return res.status(200).json({
      total: count || 0,
      pagina: Number(page),
      limite: limit === 'all' ? (count || 0) : Number(limit),
      datos: datosEnriquecidos
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 3. GET /api/ejercicios/:id
 */
const getEjercicioById = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id } = req.params;

    const { data, error } = await db
      .from('ejercicio')
      .select('*')
      .eq('id_ejercicio', id)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Ejercicio no encontrado o sin permisos.' });
    }

    return res.status(200).json(enriquecerEjercicio(data, u.id_socio));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 4. POST /api/ejercicios/personalizado
 * Crea un ejercicio personal del socio (id_socio = X, id_gimnasio = NULL).
 */
const crearEjercicioPersonalizado = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { nombre, grupo_muscular, descripcion, dificultad } = req.body;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Solo los socios pueden crear ejercicios personales.' });
    }

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del ejercicio es obligatorio.' });
    }

    // Propietario exclusivo: id_socio NOT NULL, id_gimnasio NULL
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
      mensaje: 'Ejercicio personal creado con éxito.',
      ejercicio: enriquecerEjercicio(data, u.id_socio)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 5. POST /api/ejercicios
 * Dueño/Entrenador/Admin: crea un ejercicio del gimnasio activo (id_gimnasio = X, id_socio = NULL).
 * Socio: delega a crearEjercicioPersonalizado.
 */
const crearEjercicio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { nombre, grupo_muscular, descripcion, dificultad } = req.body;

    if (u.rol === 'socio') {
      return crearEjercicioPersonalizado(req, res);
    }

    if (
      u.rol === 'empleado' &&
      !(u.roles_empleado || []).some((r) => ['administrador', 'entrenador'].includes(r))
    ) {
      return res.status(403).json({ error: 'No tienes permiso para crear ejercicios del gimnasio.' });
    }

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del ejercicio es obligatorio.' });
    }

    const gymId = u.id_gimnasio;
    if (!gymId) {
      return res.status(400).json({ error: 'No se pudo identificar el gimnasio activo.' });
    }

    // Propietario exclusivo: id_gimnasio NOT NULL, id_socio NULL
    const { data, error } = await db
      .from('ejercicio')
      .insert([
        {
          nombre: String(nombre).trim(),
          grupo_muscular: grupo_muscular ? String(grupo_muscular).trim() : 'General',
          descripcion: descripcion ? String(descripcion).trim() : null,
          dificultad: dificultad || 'Intermedia',
          id_gimnasio: gymId,
          id_socio: null
        }
      ])
      .select('*')
      .single();

    if (error) throw error;

    return res.status(201).json({
      mensaje: 'Ejercicio del gimnasio creado con éxito.',
      ejercicio: enriquecerEjercicio(data, null)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 6. PUT /api/ejercicios/:id
 * Valida estrictamente la titularidad:
 * - Socio solo puede editar sus ejercicios personales (nunca ejercicios del gimnasio).
 * - Dueño/Staff autorizado solo puede editar ejercicios de su gimnasio activo.
 */
const actualizarEjercicio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id } = req.params;
    const { nombre, grupo_muscular, descripcion, dificultad } = req.body;

    const { data: existente, error: findErr } = await db
      .from('ejercicio')
      .select('*')
      .eq('id_ejercicio', id)
      .maybeSingle();

    if (findErr || !existente) {
      return res.status(404).json({ error: 'Ejercicio no encontrado o sin permisos.' });
    }

    if (u.rol === 'socio') {
      if (!existente.id_socio || Number(existente.id_socio) !== Number(u.id_socio)) {
        return res.status(403).json({
          error: 'No tienes permiso para modificar ejercicios del gimnasio ni de otros socios.'
        });
      }
    } else {
      if (existente.id_socio !== null || Number(existente.id_gimnasio) !== Number(u.id_gimnasio)) {
        return res.status(403).json({
          error: 'Solo puedes modificar ejercicios pertenecientes al catálogo de tu gimnasio.'
        });
      }
    }

    const updateFields = {};
    if (nombre !== undefined && String(nombre).trim()) updateFields.nombre = String(nombre).trim();
    if (grupo_muscular !== undefined) updateFields.grupo_muscular = String(grupo_muscular).trim();
    if (descripcion !== undefined) updateFields.descripcion = descripcion ? String(descripcion).trim() : null;
    if (dificultad !== undefined) updateFields.dificultad = dificultad;

    const { data, error } = await db
      .from('ejercicio')
      .update(updateFields)
      .eq('id_ejercicio', id)
      .select('*')
      .single();

    if (error || !data) {
      return res.status(400).json({ error: 'No se pudo actualizar el ejercicio: ' + (error?.message || '') });
    }

    return res.status(200).json({
      mensaje: 'Ejercicio actualizado con éxito.',
      ejercicio: enriquecerEjercicio(data, u.id_socio)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 7. DELETE /api/ejercicios/:id
 * Valida estrictamente la titularidad y que no esté en uso en rutinas (ON DELETE RESTRICT).
 */
const eliminarEjercicio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const { id } = req.params;

    const { data: existente, error: findErr } = await db
      .from('ejercicio')
      .select('*')
      .eq('id_ejercicio', id)
      .maybeSingle();

    if (findErr || !existente) {
      return res.status(404).json({ error: 'Ejercicio no encontrado o sin permisos.' });
    }

    if (u.rol === 'socio') {
      if (!existente.id_socio || Number(existente.id_socio) !== Number(u.id_socio)) {
        return res.status(403).json({
          error: 'No tienes permiso para eliminar ejercicios oficiales del gimnasio ni de otros socios.'
        });
      }
    } else {
      if (existente.id_socio !== null || Number(existente.id_gimnasio) !== Number(u.id_gimnasio)) {
        return res.status(403).json({
          error: 'Solo puedes eliminar ejercicios del catálogo de tu gimnasio.'
        });
      }
    }

    const { error } = await db
      .from('ejercicio')
      .delete()
      .eq('id_ejercicio', id);

    if (error) {
      if (error.code === '23503') {
        return res.status(400).json({
          error: 'No se puede eliminar este ejercicio porque está asignado a una o más rutinas.'
        });
      }
      return res.status(500).json({ error: 'Error al eliminar ejercicio: ' + error.message });
    }

    return res.status(200).json({ mensaje: 'Ejercicio eliminado con éxito.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getEjercicios,
  getEjerciciosDisponiblesSocio,
  getEjercicioById,
  crearEjercicio,
  crearEjercicioPersonalizado,
  actualizarEjercicio,
  eliminarEjercicio
};
