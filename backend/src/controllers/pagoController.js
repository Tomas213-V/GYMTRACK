const supabase = require('../config/supabase');

// 1. GET /api/pagos (Listado, Paginación y Filtros)
const getPagos = async (req, res) => {
  try {
    const { page = 1, limit = 10, estado, desde, hasta } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('pago')
      .select('*, membresia!inner(*, socio!inner(*, usuario!inner(nombre, apellido)))', { count: 'exact' })
      .range(offset, offset + Number(limit) - 1);

    if (estado) query = query.eq('estado', estado);
    if (desde) query = query.gte('fecha_pago', desde);
    if (hasta) query = query.lte('fecha_pago', hasta);

    const { data, count, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      total: count,
      pagina: Number(page),
      limite: Number(limit),
      datos: data
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. GET /api/pagos/resumen (Tarjetas de métricas)
const getResumenPagos = async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    let query = supabase
      .from('pago')
      .select('monto, estado');

    if (desde) query = query.gte('fecha_pago', desde);
    if (hasta) query = query.lte('fecha_pago', hasta);

    const { data, error } = await query;
    if (error) throw error;

    const resumen = data.reduce((acc, pago) => {
      if (pago.estado === 'pagado') {
        acc.total_recaudado += Number(pago.monto);
        acc.pagos_realizados += 1;
      } else if (pago.estado === 'pendiente') {
        acc.pagos_pendientes += 1;
      } else if (pago.estado === 'vencido') {
        acc.pagos_vencidos += 1;
      }
      return acc;
    }, { total_recaudado: 0, pagos_realizados: 0, pagos_pendientes: 0, pagos_vencidos: 0 });

    return res.status(200).json(resumen);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. GET /api/pagos/:id (Detalle)
const getPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('pago')
      .select('*, membresia(*, socio(*, usuario(nombre, apellido, email))))')
      .eq('id_pago', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Pago no encontrado.' });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. POST /api/pagos (Registrar pago)
const registrarPago = async (req, res) => {
  try {
    const { id_membresia, monto, fecha_pago, metodo_pago, estado, comprobante } = req.body;
    const estadosPermitidos = ['pagado', 'pendiente', 'vencido'];

    // Validaciones
    if (!id_membresia || !monto || !fecha_pago || !metodo_pago || !estado) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }
    if (isNaN(monto) || Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto ingresado no es válido.' });
    }
    if (isNaN(Date.parse(fecha_pago))) {
      return res.status(400).json({ error: 'La fecha no es válida.' });
    }
    if (!estadosPermitidos.includes(estado.toLowerCase())) {
      return res.status(400).json({ error: 'El estado no es un valor permitido.' });
    }

    // Verificar existencia de la membresía
    const { data: membresia, error: membError } = await supabase
      .from('membresia')
      .select('id_membresia')
      .eq('id_membresia', id_membresia)
      .single();

    if (membError || !membresia) {
      return res.status(404).json({ error: 'La membresía especificada no existe.' });
    }

    // Inserción en tabla pago
    const { data, error } = await supabase
      .from('pago')
      .insert([{ 
        id_membresia, 
        monto, 
        fecha_pago, 
        metodo_pago, 
        estado: estado.toLowerCase(),
        comprobante: comprobante || null
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ mensaje: 'Pago registrado con éxito.', pago: data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 5. PATCH /api/pagos/:id/estado (Actualizar estado)
const actualizarEstadoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const estadosPermitidos = ['pagado', 'pendiente', 'vencido'];

    if (!estado || !estadosPermitidos.includes(estado.toLowerCase())) {
      return res.status(400).json({ error: 'Estado no válido o no proporcionado.' });
    }

    const { data, error } = await supabase
      .from('pago')
      .update({ estado: estado.toLowerCase() })
      .eq('id_pago', id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Pago no encontrado para actualizar.' });

    return res.status(200).json({ mensaje: 'Estado actualizado correctamente.', pago: data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getPagos,
  getPagoById,
  registrarPago,
  actualizarEstadoPago,
  getResumenPagos
};