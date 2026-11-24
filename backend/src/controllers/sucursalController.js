// ==============================================================================
// CONTROLADOR DE SUCURSALES (CRUD COMPLETO POR GIMNASIO)
// Tabla: public.sucursal (id_sucursal, direccion, telefono, descripcion,
//        fecha_registro, estado boolean, id_gimnasio)
// ==============================================================================

function parseBooleanEstado(valor, defaultVal = true) {
  if (valor === undefined || valor === null) return defaultVal;
  if (typeof valor === 'boolean') return valor;
  const s = String(valor).trim().toLowerCase();
  if (['true', '1', 'activo', 'activa'].includes(s)) return true;
  if (['false', '0', 'inactivo', 'inactiva'].includes(s)) return false;
  return defaultVal;
}

/**
 * GET /api/sucursales
 * Lista sucursales del gimnasio activo (aisladas estrictamente por id_gimnasio).
 * - Dueño: todas las sucursales del gimnasio seleccionado.
 * - Empleado: solo sus sucursales asignadas (reforzado por RLS).
 * - Socio: solo sucursales activas del gimnasio seleccionado.
 */
const getSucursales = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    const gymId = req.gimnasioId;
    const { estado } = req.query;

    let query = db
      .from('sucursal')
      .select('id_sucursal, direccion, telefono, descripcion, fecha_registro, estado, id_gimnasio')
      .eq('id_gimnasio', gymId)
      .order('id_sucursal', { ascending: true });

    if (u.rol === 'socio') {
      query = query.eq('estado', true);
    } else if (estado !== undefined && estado !== '' && estado !== 'todos') {
      query = query.eq('estado', parseBooleanEstado(estado, true));
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Error al consultar sucursales: ' + error.message });
    }

    return res.status(200).json({
      id_gimnasio: gymId,
      sucursales: data || []
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al consultar sucursales: ' + error.message });
  }
};

/**
 * GET /api/sucursales/:id
 */
const getSucursalById = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;

    const { data, error } = await db
      .from('sucursal')
      .select('id_sucursal, direccion, telefono, descripcion, fecha_registro, estado, id_gimnasio')
      .eq('id_sucursal', id)
      .eq('id_gimnasio', gymId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al consultar sucursal: ' + error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Sucursal no encontrada o no pertenece al gimnasio activo.' });
    }

    return res.status(200).json({ sucursal: data });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al obtener sucursal: ' + error.message });
  }
};

/**
 * POST /api/sucursales
 * Solo Dueño. Crea una sucursal asociada al gimnasio activo.
 */
const createSucursal = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { direccion, telefono, descripcion, estado } = req.body;

    if (!direccion || !String(direccion).trim()) {
      return res.status(400).json({ error: 'La dirección de la sucursal es obligatoria.' });
    }

    const { data, error } = await db
      .from('sucursal')
      .insert([
        {
          direccion: String(direccion).trim(),
          telefono: telefono ? String(telefono).trim() : null,
          descripcion: descripcion ? String(descripcion).trim() : null,
          estado: parseBooleanEstado(estado, true),
          id_gimnasio: gymId
        }
      ])
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Error al crear la sucursal: ' + error.message });
    }

    return res.status(201).json({
      mensaje: 'Sucursal creada exitosamente.',
      sucursal: data
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al crear sucursal: ' + error.message });
  }
};

/**
 * PUT /api/sucursales/:id
 * Solo Dueño. Actualiza dirección, teléfono, descripción y estado.
 */
const updateSucursal = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;
    const { direccion, telefono, descripcion, estado } = req.body;

    const updateFields = {};
    if (direccion !== undefined) {
      if (!String(direccion).trim()) {
        return res.status(400).json({ error: 'La dirección no puede estar vacía.' });
      }
      updateFields.direccion = String(direccion).trim();
    }
    if (telefono !== undefined) updateFields.telefono = telefono ? String(telefono).trim() : null;
    if (descripcion !== undefined) updateFields.descripcion = descripcion ? String(descripcion).trim() : null;
    if (estado !== undefined) updateFields.estado = parseBooleanEstado(estado, true);

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
    }

    const { data, error } = await db
      .from('sucursal')
      .update(updateFields)
      .eq('id_sucursal', id)
      .eq('id_gimnasio', gymId)
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al actualizar la sucursal: ' + error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Sucursal no encontrada o no pertenece al gimnasio activo.' });
    }

    return res.status(200).json({
      mensaje: 'Sucursal actualizada correctamente.',
      sucursal: data
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al actualizar sucursal: ' + error.message });
  }
};

/**
 * PATCH /api/sucursales/:id/estado
 * Solo Dueño. Activa o desactiva una sucursal.
 */
const cambiarEstadoSucursal = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;
    const { estado } = req.body;

    if (estado === undefined) {
      return res.status(400).json({ error: 'Debes indicar el nuevo estado (true/false).' });
    }

    const nuevoEstado = parseBooleanEstado(estado, true);

    const { data, error } = await db
      .from('sucursal')
      .update({ estado: nuevoEstado })
      .eq('id_sucursal', id)
      .eq('id_gimnasio', gymId)
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al cambiar el estado de la sucursal: ' + error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Sucursal no encontrada o no pertenece al gimnasio activo.' });
    }

    return res.status(200).json({
      mensaje: `Sucursal ${nuevoEstado ? 'activada' : 'desactivada'} correctamente.`,
      sucursal: data
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al cambiar estado de sucursal: ' + error.message });
  }
};

/**
 * DELETE /api/sucursales/:id
 * Solo Dueño. Elimina si no tiene historial, o desactiva si tiene asistencias/empleados.
 */
const deleteSucursal = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;

    const { error } = await db
      .from('sucursal')
      .delete()
      .eq('id_sucursal', id)
      .eq('id_gimnasio', gymId);

    if (error) {
      if (error.code === '23503') {
        const { data: desactivada } = await db
          .from('sucursal')
          .update({ estado: false })
          .eq('id_sucursal', id)
          .eq('id_gimnasio', gymId)
          .select('*')
          .maybeSingle();

        return res.status(200).json({
          mensaje: 'La sucursal posee asistencias o empleados vinculados. Se desactivó para preservar el historial.',
          desactivada: true,
          sucursal: desactivada
        });
      }
      return res.status(500).json({ error: 'Error al eliminar sucursal: ' + error.message });
    }

    return res.status(200).json({ mensaje: 'Sucursal eliminada exitosamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al eliminar sucursal: ' + error.message });
  }
};

module.exports = {
  getSucursales,
  getSucursalById,
  createSucursal,
  updateSucursal,
  cambiarEstadoSucursal,
  deleteSucursal
};
