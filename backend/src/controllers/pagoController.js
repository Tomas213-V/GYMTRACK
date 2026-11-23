// ==============================================================================
// CONTROLADOR DE PAGOS — NUEVO ESQUEMA pago -> membresia_socio
// - Aislamiento estricto por gimnasio activo (req.gimnasioId + RLS).
// - Estados válidos por CHECK: 'pendiente' | 'aprobado' | 'rechazado' | 'anulado'.
// - Conserva historial financiero: anula pagos en lugar de borrarlos físicamente.
// ==============================================================================

const ESTADOS_PAGO_VALIDOS = ['pendiente', 'aprobado', 'rechazado', 'anulado'];

function normalizarEstadoPago(estado) {
  if (!estado) return null;
  const s = String(estado).trim().toLowerCase();
  if (s === 'pagado' || s === 'aprobado') return 'aprobado';
  if (s === 'pendiente') return 'pendiente';
  if (s === 'rechazado' || s === 'vencido') return 'rechazado';
  if (s === 'anulado' || s === 'cancelado') return 'anulado';
  return ESTADOS_PAGO_VALIDOS.includes(s) ? s : null;
}

function normalizarPagoRespuesta(p) {
  if (!p) return null;
  const ms = p.membresia_socio || null;
  return {
    ...p,
    id_membresia: p.id_membresia_socio,
    membresia: ms
      ? {
          ...ms,
          id_membresia: ms.id_membresia_socio,
          id_plan_membresia: ms.id_membresia_gimnasio,
          plan_membresia: ms.membresia_gimnasio
            ? {
                ...ms.membresia_gimnasio,
                id_plan_membresia: ms.membresia_gimnasio.id_membresia_gimnasio
              }
            : null
        }
      : null
  };
}

/**
 * 1. GET /api/pagos
 */
const getPagos = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { page = 1, limit = 10, estado, desde, hasta } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db
      .from('pago')
      .select(
        `
        *,
        membresia_socio!inner (
          id_membresia_socio,
          id_socio,
          id_gimnasio,
          id_membresia_gimnasio,
          precio,
          fecha_inicio,
          fecha_vencimiento,
          estado,
          membresia_gimnasio (id_membresia_gimnasio, nombre, duracion_dias),
          socio (id_socio, nombre, apellido, dni, email)
        )
      `,
        { count: 'exact' }
      )
      .eq('membresia_socio.id_gimnasio', gymId)
      .order('id_pago', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (estado && estado !== 'todos') {
      const estNorm = normalizarEstadoPago(estado);
      if (estNorm) query = query.eq('estado', estNorm);
    }
    if (desde) {
      const d = desde.includes('T') ? desde : `${desde}T00:00:00.000Z`;
      query = query.gte('fecha_pago', d);
    }
    if (hasta) {
      const h = hasta.includes('T') ? hasta : `${hasta}T23:59:59.999Z`;
      query = query.lte('fecha_pago', h);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      total: count || 0,
      pagina: Number(page),
      limite: Number(limit),
      datos: (data || []).map(normalizarPagoRespuesta)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 2. GET /api/pagos/resumen
 */
const getResumenPagos = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { desde, hasta } = req.query;

    let query = db
      .from('pago')
      .select('monto, estado, fecha_pago, membresia_socio!inner(id_gimnasio)')
      .eq('membresia_socio.id_gimnasio', gymId);

    if (desde) query = query.gte('fecha_pago', desde.includes('T') ? desde : `${desde}T00:00:00.000Z`);
    if (hasta) query = query.lte('fecha_pago', hasta.includes('T') ? hasta : `${hasta}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw error;

    const resumen = (data || []).reduce(
      (acc, p) => {
        if (p.estado === 'aprobado') {
          acc.total_recaudado += Number(p.monto || 0);
          acc.pagos_realizados += 1;
          acc.pagos_aprobados += 1;
        } else if (p.estado === 'pendiente') {
          acc.pagos_pendientes += 1;
        } else if (p.estado === 'rechazado') {
          acc.pagos_rechazados += 1;
          acc.pagos_vencidos += 1;
        } else if (p.estado === 'anulado') {
          acc.pagos_anulados += 1;
        }
        return acc;
      },
      {
        total_recaudado: 0,
        pagos_realizados: 0,
        pagos_aprobados: 0,
        pagos_pendientes: 0,
        pagos_rechazados: 0,
        pagos_vencidos: 0,
        pagos_anulados: 0
      }
    );

    return res.status(200).json(resumen);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 3. GET /api/pagos/membresias
 * Lista socios y contrataciones del gimnasio activo para registrar un nuevo pago.
 */
const getMembresias = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;

    const { data: contrataciones, error } = await db
      .from('membresia_socio')
      .select(`
        id_membresia_socio,
        id_socio,
        id_gimnasio,
        id_membresia_gimnasio,
        precio,
        fecha_inicio,
        fecha_vencimiento,
        estado,
        membresia_gimnasio (id_membresia_gimnasio, nombre, precio, duracion_dias),
        socio!inner (id_socio, dni, telefono, nombre, apellido, email, estado)
      `)
      .eq('id_gimnasio', gymId)
      .order('id_membresia_socio', { ascending: false });

    if (error) throw error;

    const resultado = (contrataciones || []).map((c) => ({
      id_socio: c.socio.id_socio,
      dni: c.socio.dni,
      telefono: c.socio.telefono,
      nombre: c.socio.nombre,
      apellido: c.socio.apellido,
      email: c.socio.email,
      estado_socio: c.socio.estado,
      id_gimnasio: c.id_gimnasio,
      socio: c.socio,
      id_membresia_socio: c.id_membresia_socio,
      id_membresia: c.id_membresia_socio,
      precio: c.precio,
      fecha_inicio: c.fecha_inicio,
      fecha_vencimiento: c.fecha_vencimiento,
      estado: c.estado,
      id_membresia_gimnasio: c.id_membresia_gimnasio,
      id_plan_membresia: c.id_membresia_gimnasio,
      plan_membresia: c.membresia_gimnasio
        ? { ...c.membresia_gimnasio, id_plan_membresia: c.membresia_gimnasio.id_membresia_gimnasio }
        : null
    }));

    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 4. GET /api/pagos/planes
 * Lista planes activos del gimnasio activo (sin seeding automático).
 */
const getPlanes = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;

    const { data, error } = await db
      .from('membresia_gimnasio')
      .select('*')
      .eq('id_gimnasio', gymId)
      .eq('estado', true)
      .order('id_membresia_gimnasio', { ascending: true });

    if (error) throw error;

    return res.status(200).json(
      (data || []).map((p) => ({
        ...p,
        id_plan_membresia: p.id_membresia_gimnasio
      }))
    );
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 5. GET /api/pagos/:id
 */
const getPagoById = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;

    const { data, error } = await db
      .from('pago')
      .select(`
        *,
        membresia_socio!inner (
          *,
          membresia_gimnasio (*),
          socio (*)
        )
      `)
      .eq('id_pago', id)
      .eq('membresia_socio.id_gimnasio', gymId)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Pago no encontrado en el gimnasio activo.' });
    }

    return res.status(200).json(normalizarPagoRespuesta(data));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 6. POST /api/pagos
 * Registra un pago asociado a una contratación concreta (membresia_socio) del gimnasio activo.
 * Si no se pasa id_membresia_socio pero sí id_socio + id_membresia_gimnasio, contrata y paga atómicamente vía RPC.
 */
const registrarPago = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    let {
      id_socio,
      id_membresia_socio,
      id_membresia,
      id_membresia_gimnasio,
      id_plan_membresia,
      monto,
      fecha_pago,
      metodo_pago,
      estado,
      comprobante
    } = req.body;

    const contratoId = id_membresia_socio || id_membresia || null;
    const planId = id_membresia_gimnasio || id_plan_membresia || null;
    const estadoNormalizado = normalizarEstadoPago(estado || 'aprobado');

    if (monto === undefined || isNaN(monto) || Number(monto) < 0) {
      return res.status(400).json({ error: 'El monto debe ser un número mayor o igual a 0.' });
    }
    if (!metodo_pago || !String(metodo_pago).trim()) {
      return res.status(400).json({ error: 'El método de pago es obligatorio.' });
    }
    if (!estadoNormalizado) {
      return res.status(400).json({
        error: `Estado de pago inválido. Permitidos: ${ESTADOS_PAGO_VALIDOS.join(', ')}.`
      });
    }

    // Caso A: Se crea contratación + pago atómicamente si no vino contratoId pero sí id_socio + planId
    if (!contratoId && id_socio && planId) {
      const { data: rpcRes, error: rpcErr } = await db.rpc('rpc_contratar_membresia', {
        p_id_socio: Number(id_socio),
        p_id_membresia_gimnasio: Number(planId),
        p_fecha_inicio: fecha_pago ? String(fecha_pago).split('T')[0] : new Date().toISOString().split('T')[0],
        p_estado: estadoNormalizado === 'aprobado' ? 'activa' : 'pendiente',
        p_registrar_pago: true,
        p_metodo_pago: String(metodo_pago).trim().toLowerCase(),
        p_estado_pago: estadoNormalizado,
        p_comprobante: comprobante || null,
        p_monto_override: Number(monto)
      });

      if (rpcErr) {
        return res.status(400).json({ error: rpcErr.message });
      }

      const { data: pagoDetalle } = await db
        .from('pago')
        .select('*, membresia_socio(*, membresia_gimnasio(*), socio(*))')
        .eq('id_pago', rpcRes.pago.id_pago)
        .single();

      return res.status(201).json({
        mensaje: 'Contratación y pago registrados con éxito.',
        pago: normalizarPagoRespuesta(pagoDetalle || rpcRes.pago)
      });
    }

    // Caso B: Pago sobre una membresia_socio existente del gimnasio activo
    let targetContratoId = contratoId ? Number(contratoId) : null;

    if (!targetContratoId && id_socio) {
      const { data: ultContrato } = await db
        .from('membresia_socio')
        .select('id_membresia_socio')
        .eq('id_socio', Number(id_socio))
        .eq('id_gimnasio', gymId)
        .order('fecha_vencimiento', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultContrato) {
        targetContratoId = ultContrato.id_membresia_socio;
      }
    }

    if (!targetContratoId) {
      return res.status(400).json({
        error: 'Debes seleccionar una contratación (id_membresia_socio) o indicar socio y plan para registrar el pago.'
      });
    }

    // Validar que la contratación pertenece al gimnasio activo
    const { data: contratoCheck, error: checkErr } = await db
      .from('membresia_socio')
      .select('id_membresia_socio, id_gimnasio')
      .eq('id_membresia_socio', targetContratoId)
      .eq('id_gimnasio', gymId)
      .maybeSingle();

    if (checkErr || !contratoCheck) {
      return res.status(404).json({ error: 'La contratación de membresía no pertenece al gimnasio activo.' });
    }

    const { data: rpcPago, error: errRpcPago } = await db.rpc('rpc_registrar_pago', {
      p_id_membresia_socio: targetContratoId,
      p_monto: Number(monto),
      p_metodo_pago: String(metodo_pago).trim().toLowerCase(),
      p_estado: estadoNormalizado,
      p_comprobante: comprobante ? String(comprobante).trim() : null,
      p_fecha_pago: fecha_pago ? new Date(fecha_pago).toISOString() : new Date().toISOString()
    });

    if (errRpcPago) {
      return res.status(400).json({ error: errRpcPago.message });
    }

    const { data: pagoCreado } = await db
      .from('pago')
      .select('*, membresia_socio(*, membresia_gimnasio(*), socio(*))')
      .eq('id_pago', rpcPago.id_pago)
      .single();

    return res.status(201).json({
      mensaje: 'Pago registrado con éxito.',
      pago: normalizarPagoRespuesta(pagoCreado || rpcPago)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 7. PATCH /api/pagos/:id/estado
 */
const actualizarEstadoPago = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;
    const { estado } = req.body;

    const nuevoEstado = normalizarEstadoPago(estado);
    if (!nuevoEstado) {
      return res.status(400).json({
        error: `Estado de pago inválido. Valores permitidos: ${ESTADOS_PAGO_VALIDOS.join(', ')}.`
      });
    }

    // Validar pertenencia al gimnasio activo
    const { data: existente } = await db
      .from('pago')
      .select('id_pago, id_membresia_socio, membresia_socio!inner(id_gimnasio)')
      .eq('id_pago', id)
      .eq('membresia_socio.id_gimnasio', gymId)
      .maybeSingle();

    if (!existente) {
      return res.status(404).json({ error: 'Pago no encontrado en el gimnasio activo.' });
    }

    const { data: rpcUpdated, error } = await db.rpc('rpc_actualizar_estado_pago', {
      p_id_pago: Number(id),
      p_estado: nuevoEstado
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { data: pagoActualizado } = await db
      .from('pago')
      .select('*, membresia_socio(*, membresia_gimnasio(*), socio(*))')
      .eq('id_pago', id)
      .single();

    return res.status(200).json({
      mensaje: 'Estado del pago actualizado correctamente.',
      pago: normalizarPagoRespuesta(pagoActualizado || rpcUpdated)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 8. DELETE /api/pagos/:id
 * Conserva historial financiero: marca el pago como 'anulado' en lugar de eliminarlo físicamente.
 */
const eliminarPago = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;

    const { data: existente } = await db
      .from('pago')
      .select('id_pago, membresia_socio!inner(id_gimnasio)')
      .eq('id_pago', id)
      .eq('membresia_socio.id_gimnasio', gymId)
      .maybeSingle();

    if (!existente) {
      return res.status(404).json({ error: 'Pago no encontrado en el gimnasio activo.' });
    }

    const { data: rpcAnulado, error } = await db.rpc('rpc_actualizar_estado_pago', {
      p_id_pago: Number(id),
      p_estado: 'anulado'
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { data: anulado } = await db
      .from('pago')
      .select('*, membresia_socio(*, membresia_gimnasio(*), socio(*))')
      .eq('id_pago', id)
      .single();

    return res.status(200).json({
      mensaje: 'Pago anulado correctamente (el registro se conserva en el historial financiero).',
      anulado: true,
      pago: normalizarPagoRespuesta(anulado || rpcAnulado)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getPagos,
  getPagoById,
  registrarPago,
  actualizarEstadoPago,
  eliminarPago,
  getResumenPagos,
  getMembresias,
  getPlanes
};
