// ==============================================================================
// CONTROLADOR DE CONTRATACIONES DE MEMBRESÍAS (PANEL DUEÑO / STAFF)
// Tabla: public.membresia_socio -> public.membresia_gimnasio
// - Conserva condiciones históricas del plan (precio, duración, límites) vía RPC.
// - Estados válidos por CHECK: 'pendiente' | 'activa' | 'vencida' | 'cancelada'.
// ==============================================================================

const ESTADOS_VALIDOS = ['pendiente', 'activa', 'vencida', 'cancelada'];

function normalizarEstado(valor, fallback = 'activa') {
  if (!valor) return fallback;
  const s = String(valor).trim().toLowerCase();
  if (s === 'activo' || s === 'activa') return 'activa';
  if (s === 'pendiente') return 'pendiente';
  if (s === 'vencido' || s === 'vencida') return 'vencida';
  if (s === 'cancelado' || s === 'cancelada' || s === 'pausada' || s === 'inactiva') return 'cancelada';
  return ESTADOS_VALIDOS.includes(s) ? s : null;
}

function normalizarMembresiaRespuesta(m) {
  if (!m) return null;
  return {
    ...m,
    id_membresia: m.id_membresia_socio,
    id_plan_membresia: m.id_membresia_gimnasio,
    plan_membresia: m.membresia_gimnasio
      ? {
          ...m.membresia_gimnasio,
          id_plan_membresia: m.membresia_gimnasio.id_membresia_gimnasio
        }
      : null
  };
}

/**
 * GET /api/membresias?estado=activa&id_socio=1
 */
const getMembresias = async (req, res) => {
  try {
    const db = req.supabase;
    const idGimnasio = req.gimnasioId;
    const { id_socio, estado } = req.query;

    let query = db
      .from('membresia_socio')
      .select(`
        *,
        socio (
          id_socio,
          nombre,
          apellido,
          dni,
          email,
          telefono,
          estado
        ),
        membresia_gimnasio (
          id_membresia_gimnasio,
          nombre,
          descripcion,
          precio,
          duracion_dias,
          limite_asistencias_semanales,
          limite_asistencias_totales,
          estado
        )
      `)
      .eq('id_gimnasio', idGimnasio)
      .order('fecha_vencimiento', { ascending: false });

    if (id_socio) {
      query = query.eq('id_socio', id_socio);
    }

    if (estado && String(estado).toLowerCase() !== 'todos') {
      const est = normalizarEstado(estado, null);
      if (est) query = query.eq('estado', est);
    }

    const { data: membresias, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Error al consultar las membresías: ' + error.message });
    }

    return res.status(200).json({
      membresias: (membresias || []).map(normalizarMembresiaRespuesta)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * GET /api/membresias/:id
 */
const getMembresiaById = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const idGimnasio = req.gimnasioId;

    const { data: membresia, error } = await db
      .from('membresia_socio')
      .select(`
        *,
        socio (id_socio, nombre, apellido, dni, email),
        membresia_gimnasio (*)
      `)
      .eq('id_membresia_socio', id)
      .eq('id_gimnasio', idGimnasio)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al obtener la membresía: ' + error.message });
    }

    if (!membresia) {
      return res.status(404).json({ error: 'Membresía no encontrada o no pertenece al gimnasio activo.' });
    }

    return res.status(200).json({ membresia: normalizarMembresiaRespuesta(membresia) });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * POST /api/membresias
 * Crea una nueva contratación copiando las condiciones vigentes del plan mediante
 * la función transaccional rpc_contratar_membresia.
 */
const createMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const idGimnasio = req.gimnasioId;
    const {
      id_socio,
      id_membresia_gimnasio,
      id_plan_membresia,
      fecha_inicio,
      estado,
      precio,
      registrar_pago = false,
      metodo_pago = 'efectivo',
      estado_pago = 'aprobado',
      comprobante = null
    } = req.body;

    const planId = id_membresia_gimnasio || id_plan_membresia;

    if (!id_socio) {
      return res.status(400).json({ error: 'El id_socio es obligatorio.' });
    }
    if (!planId) {
      return res.status(400).json({ error: 'Debes indicar el plan (id_membresia_gimnasio).' });
    }

    // Verificar que el plan pertenece al gimnasio activo
    const { data: plan, error: planErr } = await db
      .from('membresia_gimnasio')
      .select('id_membresia_gimnasio, id_gimnasio, estado')
      .eq('id_membresia_gimnasio', planId)
      .eq('id_gimnasio', idGimnasio)
      .maybeSingle();

    if (planErr || !plan) {
      return res.status(404).json({ error: 'El plan especificado no existe o no pertenece al gimnasio activo.' });
    }

    const estadoFinal = normalizarEstado(estado, 'activa');
    if (!estadoFinal) {
      return res.status(400).json({
        error: `Estado de membresía inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}.`
      });
    }

    const { data: rpcRes, error: rpcErr } = await db.rpc('rpc_contratar_membresia', {
      p_id_socio: Number(id_socio),
      p_id_membresia_gimnasio: Number(planId),
      p_fecha_inicio: fecha_inicio || new Date().toISOString().split('T')[0],
      p_estado: estadoFinal,
      p_registrar_pago: Boolean(registrar_pago),
      p_metodo_pago: metodo_pago || 'efectivo',
      p_estado_pago: estado_pago || 'aprobado',
      p_comprobante: comprobante || null,
      p_monto_override: precio !== undefined && precio !== '' ? Number(precio) : null
    });

    if (rpcErr) {
      return res.status(400).json({ error: rpcErr.message });
    }

    // Recuperar detalle completo con joins
    const contratoId = rpcRes?.membresia_socio?.id_membresia_socio;
    const { data: completa } = await db
      .from('membresia_socio')
      .select('*, socio(id_socio, nombre, apellido, dni), membresia_gimnasio(*)')
      .eq('id_membresia_socio', contratoId)
      .single();

    return res.status(201).json({
      mensaje: 'Membresía contratada exitosamente conservando las condiciones vigentes del plan.',
      membresia: normalizarMembresiaRespuesta(completa || rpcRes?.membresia_socio),
      pago: rpcRes?.pago || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * PATCH /api/membresias/:id
 * Permite ajustar vigencia o estado ('pendiente'|'activa'|'vencida'|'cancelada').
 */
const updateMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const idGimnasio = req.gimnasioId;
    const { id } = req.params;
    const { estado, fecha_inicio, fecha_vencimiento, dias_extension } = req.body;

    const { data: membActual, error: membErr } = await db
      .from('membresia_socio')
      .select('*')
      .eq('id_membresia_socio', id)
      .eq('id_gimnasio', idGimnasio)
      .maybeSingle();

    if (membErr || !membActual) {
      return res.status(404).json({ error: 'Membresía no encontrada o no pertenece al gimnasio activo.' });
    }

    const updateData = {};

    if (fecha_inicio) {
      updateData.fecha_inicio = fecha_inicio;
    }

    if (fecha_vencimiento) {
      updateData.fecha_vencimiento = fecha_vencimiento;
    } else if (dias_extension && !isNaN(dias_extension)) {
      const baseDate = new Date(membActual.fecha_vencimiento + 'T00:00:00');
      baseDate.setDate(baseDate.getDate() + parseInt(dias_extension, 10));
      updateData.fecha_vencimiento = baseDate.toISOString().split('T')[0];
    }

    if (estado !== undefined) {
      const estNorm = normalizarEstado(estado, null);
      if (!estNorm) {
        return res.status(400).json({
          error: `Estado no válido. Permitidos: ${ESTADOS_VALIDOS.join(', ')}.`
        });
      }
      updateData.estado = estNorm;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No se enviaron cambios para actualizar.' });
    }

    const { data: membActualizada, error: updateErr } = await db
      .from('membresia_socio')
      .update(updateData)
      .eq('id_membresia_socio', id)
      .eq('id_gimnasio', idGimnasio)
      .select('*, socio(id_socio, nombre, apellido, dni), membresia_gimnasio(*)')
      .single();

    if (updateErr) {
      return res.status(400).json({ error: 'Error al actualizar la membresía: ' + updateErr.message });
    }

    return res.status(200).json({
      mensaje: 'Membresía actualizada exitosamente.',
      membresia: normalizarMembresiaRespuesta(membActualizada)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * DELETE /api/membresias/:id
 * Cancela si posee pagos/asistencias asociadas para preservar historial.
 */
const deleteMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const idGimnasio = req.gimnasioId;
    const { id } = req.params;

    const { data: membActual, error: membErr } = await db
      .from('membresia_socio')
      .select('id_membresia_socio')
      .eq('id_membresia_socio', id)
      .eq('id_gimnasio', idGimnasio)
      .maybeSingle();

    if (membErr || !membActual) {
      return res.status(404).json({ error: 'Membresía no encontrada o no pertenece al gimnasio activo.' });
    }

    const { error: delErr } = await db
      .from('membresia_socio')
      .delete()
      .eq('id_membresia_socio', id)
      .eq('id_gimnasio', idGimnasio);

    if (delErr) {
      if (delErr.code === '23503' || delErr.message?.includes('foreign key')) {
        await db
          .from('membresia_socio')
          .update({ estado: 'cancelada' })
          .eq('id_membresia_socio', id)
          .eq('id_gimnasio', idGimnasio);

        return res.status(200).json({
          mensaje: 'La membresía posee pagos o asistencias asociadas. Se marcó como cancelada para preservar el historial.',
          cancelada: true
        });
      }
      return res.status(500).json({ error: 'Error al eliminar la membresía: ' + delErr.message });
    }

    return res.status(200).json({ mensaje: 'Membresía eliminada exitosamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

module.exports = {
  getMembresias,
  getMembresiaById,
  createMembresia,
  updateMembresia,
  deleteMembresia
};
