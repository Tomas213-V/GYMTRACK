// ==============================================================================
// CONTROLADOR DE PLANES DE MEMBRESÍA DEL GIMNASIO
// Tabla: public.membresia_gimnasio
//   (id_membresia_gimnasio, nombre, descripcion, precio, duracion_dias,
//    limite_asistencias_semanales, limite_asistencias_totales, estado boolean, id_gimnasio)
// ==============================================================================

function parseBooleanEstado(valor, defaultVal = true) {
  if (valor === undefined || valor === null) return defaultVal;
  if (typeof valor === 'boolean') return valor;
  const s = String(valor).trim().toLowerCase();
  if (['true', '1', 'activo', 'activa'].includes(s)) return true;
  if (['false', '0', 'inactivo', 'inactiva'].includes(s)) return false;
  return defaultVal;
}

function parseOptionalPositiveInt(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = parseInt(valor, 10);
  if (isNaN(n) || n <= 0) return NaN;
  return n;
}

function normalizarPlan(plan) {
  if (!plan) return null;
  return {
    ...plan,
    // Alias de compatibilidad controlada para UI existente mientras migra
    id_plan_membresia: plan.id_membresia_gimnasio,
    estado_texto: plan.estado ? 'activo' : 'inactivo'
  };
}

/**
 * GET /api/planes-membresia?estado=activo|inactivo|todos
 */
const getPlanesMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const idGimnasio = req.gimnasioId;
    const { estado } = req.query;

    let query = db
      .from('membresia_gimnasio')
      .select('*')
      .eq('id_gimnasio', idGimnasio)
      .order('id_membresia_gimnasio', { ascending: true });

    if (estado !== undefined && estado !== '' && String(estado).toLowerCase() !== 'todos') {
      query = query.eq('estado', parseBooleanEstado(estado, true));
    }

    const { data: planes, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Error al consultar los planes de membresía: ' + error.message });
    }

    return res.status(200).json({
      planes: (planes || []).map(normalizarPlan)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * GET /api/planes-membresia/:id
 */
const getPlanMembresiaById = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const idGimnasio = req.gimnasioId;

    const { data: plan, error } = await db
      .from('membresia_gimnasio')
      .select('*')
      .eq('id_membresia_gimnasio', id)
      .eq('id_gimnasio', idGimnasio)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al obtener el plan de membresía: ' + error.message });
    }

    if (!plan) {
      return res.status(404).json({ error: 'El plan de membresía no existe o no pertenece a tu gimnasio.' });
    }

    return res.status(200).json({ plan: normalizarPlan(plan) });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * POST /api/planes-membresia
 */
const createPlanMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const idGimnasio = req.gimnasioId;
    const {
      nombre,
      descripcion,
      precio,
      duracion_dias,
      limite_asistencias_semanales,
      limite_asistencias_totales,
      estado
    } = req.body;

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del plan es obligatorio.' });
    }

    if (precio === undefined || precio === '' || isNaN(precio) || parseFloat(precio) < 0) {
      return res.status(400).json({ error: 'El precio debe ser un número válido igual o mayor a 0.' });
    }

    if (!duracion_dias || isNaN(duracion_dias) || parseInt(duracion_dias, 10) <= 0) {
      return res.status(400).json({ error: 'La duración en días debe ser un número entero mayor a 0.' });
    }

    const limSemanal = parseOptionalPositiveInt(limite_asistencias_semanales);
    if (Number.isNaN(limSemanal)) {
      return res.status(400).json({ error: 'El límite semanal debe estar vacío o ser un entero mayor a 0.' });
    }

    const limTotal = parseOptionalPositiveInt(limite_asistencias_totales);
    if (Number.isNaN(limTotal)) {
      return res.status(400).json({ error: 'El límite total debe estar vacío o ser un entero mayor a 0.' });
    }

    const nuevoPlanData = {
      id_gimnasio: idGimnasio,
      nombre: String(nombre).trim(),
      descripcion: descripcion ? String(descripcion).trim() : null,
      precio: parseFloat(precio),
      duracion_dias: parseInt(duracion_dias, 10),
      limite_asistencias_semanales: limSemanal,
      limite_asistencias_totales: limTotal,
      estado: parseBooleanEstado(estado, true)
    };

    const { data: nuevoPlan, error } = await db
      .from('membresia_gimnasio')
      .insert([nuevoPlanData])
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Ya existe un plan con ese nombre en este gimnasio.' });
      }
      return res.status(500).json({ error: 'Error al crear el plan de membresía: ' + error.message });
    }

    return res.status(201).json({
      mensaje: 'Plan de membresía creado correctamente.',
      plan: normalizarPlan(nuevoPlan)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * PUT /api/planes-membresia/:id
 */
const updatePlanMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const idGimnasio = req.gimnasioId;
    const {
      nombre,
      descripcion,
      precio,
      duracion_dias,
      limite_asistencias_semanales,
      limite_asistencias_totales,
      estado
    } = req.body;

    if (precio !== undefined && (precio === '' || isNaN(precio) || parseFloat(precio) < 0)) {
      return res.status(400).json({ error: 'El precio debe ser un número válido igual o mayor a 0.' });
    }

    if (duracion_dias !== undefined && (isNaN(duracion_dias) || parseInt(duracion_dias, 10) <= 0)) {
      return res.status(400).json({ error: 'La duración en días debe ser un número entero mayor a 0.' });
    }

    const updateData = {};
    if (nombre !== undefined && String(nombre).trim()) updateData.nombre = String(nombre).trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion ? String(descripcion).trim() : null;
    if (precio !== undefined) updateData.precio = parseFloat(precio);
    if (duracion_dias !== undefined) updateData.duracion_dias = parseInt(duracion_dias, 10);

    if (limite_asistencias_semanales !== undefined) {
      const limSem = parseOptionalPositiveInt(limite_asistencias_semanales);
      if (Number.isNaN(limSem)) {
        return res.status(400).json({ error: 'El límite semanal debe estar vacío o ser mayor a 0.' });
      }
      updateData.limite_asistencias_semanales = limSem;
    }

    if (limite_asistencias_totales !== undefined) {
      const limTot = parseOptionalPositiveInt(limite_asistencias_totales);
      if (Number.isNaN(limTot)) {
        return res.status(400).json({ error: 'El límite total debe estar vacío o ser mayor a 0.' });
      }
      updateData.limite_asistencias_totales = limTot;
    }

    if (estado !== undefined) {
      updateData.estado = parseBooleanEstado(estado, true);
    }

    const { data: planActualizado, error } = await db
      .from('membresia_gimnasio')
      .update(updateData)
      .eq('id_membresia_gimnasio', id)
      .eq('id_gimnasio', idGimnasio)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Ya existe otro plan con ese nombre en este gimnasio.' });
      }
      return res.status(500).json({ error: 'Error al actualizar el plan de membresía: ' + error.message });
    }

    if (!planActualizado) {
      return res.status(404).json({ error: 'Plan de membresía no encontrado o no pertenece a tu gimnasio.' });
    }

    return res.status(200).json({
      mensaje: 'Plan de membresía actualizado exitosamente. Las contrataciones previas conservan sus condiciones históricas.',
      plan: normalizarPlan(planActualizado)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * PATCH /api/planes-membresia/:id/desactivar
 */
const deshabilitarPlanMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const idGimnasio = req.gimnasioId;

    const { data: planDesactivado, error } = await db
      .from('membresia_gimnasio')
      .update({ estado: false })
      .eq('id_membresia_gimnasio', id)
      .eq('id_gimnasio', idGimnasio)
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al desactivar el plan: ' + error.message });
    }

    if (!planDesactivado) {
      return res.status(404).json({ error: 'Plan de membresía no encontrado o no pertenece a tu gimnasio.' });
    }

    return res.status(200).json({
      mensaje: 'Plan de membresía desactivado exitosamente.',
      plan: normalizarPlan(planDesactivado)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * DELETE /api/planes-membresia/:id
 */
const deletePlanMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const idGimnasio = req.gimnasioId;

    const { data: plan, error: planErr } = await db
      .from('membresia_gimnasio')
      .select('id_membresia_gimnasio')
      .eq('id_membresia_gimnasio', id)
      .eq('id_gimnasio', idGimnasio)
      .maybeSingle();

    if (planErr || !plan) {
      return res.status(404).json({ error: 'Plan de membresía no encontrado o no pertenece a tu gimnasio.' });
    }

    const { error: delErr } = await db
      .from('membresia_gimnasio')
      .delete()
      .eq('id_membresia_gimnasio', id)
      .eq('id_gimnasio', idGimnasio);

    if (delErr) {
      if (delErr.code === '23503' || delErr.message?.includes('foreign key')) {
        await db
          .from('membresia_gimnasio')
          .update({ estado: false })
          .eq('id_membresia_gimnasio', id)
          .eq('id_gimnasio', idGimnasio);

        return res.status(200).json({
          mensaje: 'El plan posee contrataciones históricas. Se marcó como inactivo para conservar la integridad.',
          inactivo: true
        });
      }
      return res.status(500).json({ error: 'Error al eliminar el plan: ' + delErr.message });
    }

    return res.status(200).json({ mensaje: 'Plan de membresía eliminado exitosamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

module.exports = {
  getPlanesMembresia,
  getPlanMembresiaById,
  createPlanMembresia,
  updatePlanMembresia,
  deshabilitarPlanMembresia,
  deletePlanMembresia
};
