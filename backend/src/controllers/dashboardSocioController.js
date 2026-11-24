// ==============================================================================
// CONTROLADOR DE DASHBOARD DEL SOCIO — MULTIGIMNASIO + ASISTENCIAS POR SUCURSAL
// - Todos los datos dependientes de gimnasio filtrados al gimnasio seleccionado.
// - Rutinas personales y progreso corporal independientes del gimnasio.
// - Check-in / Check-out validados transaccionalmente vía RPCs.
// ==============================================================================

/**
 * GET /api/socio/dashboard
 */
const getDashboardSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso reservado para socios autenticados.' });
    }

    if (u.requested_gym_id && !u.requested_gym_autorizado) {
      return res.status(403).json({ error: 'No tienes una membresía válida en el gimnasio solicitado.' });
    }

    const idSocio = u.id_socio;
    const gymId = u.id_gimnasio;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Consultas paralelas acotadas al gimnasio seleccionado (y personales del socio)
    const [
      membresiasRes,
      sucursalesRes,
      asistenciaAbiertaRes,
      asistenciasGymRes,
      rutinaRes,
      progresoRes
    ] = await Promise.all([
      gymId
        ? db
            .from('membresia_socio')
            .select(`
              *,
              membresia_gimnasio (id_membresia_gimnasio, nombre, descripcion, precio, duracion_dias, estado)
            `)
            .eq('id_socio', idSocio)
            .eq('id_gimnasio', gymId)
            .order('fecha_vencimiento', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      gymId
        ? db
            .from('sucursal')
            .select('id_sucursal, direccion, telefono, descripcion, estado, id_gimnasio')
            .eq('id_gimnasio', gymId)
            .eq('estado', true)
            .order('id_sucursal', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      db
        .from('asistencia_socio')
        .select(`
          id_asistencia_socio,
          id_sucursal,
          hora_ingreso,
          estado,
          sucursal:id_sucursal (
            id_sucursal,
            direccion,
            id_gimnasio,
            gimnasio:id_gimnasio (id_gimnasio, nombre)
          )
        `)
        .eq('id_socio', idSocio)
        .eq('estado', 'presente')
        .is('hora_salida', null)
        .maybeSingle(),
      gymId
        ? db
            .from('asistencia_socio')
            .select(`
              id_asistencia_socio,
              id_sucursal,
              hora_ingreso,
              hora_salida,
              estado,
              sucursal!inner (
                id_sucursal,
                direccion,
                id_gimnasio,
                gimnasio:id_gimnasio (id_gimnasio, nombre)
              )
            `)
            .eq('id_socio', idSocio)
            .eq('sucursal.id_gimnasio', gymId)
            .neq('estado', 'anulada')
            .order('hora_ingreso', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      db
        .from('rutina')
        .select(`
          id_rutina,
          nombre,
          descripcion,
          estado,
          fecha_inicio,
          rutina_ejercicio (
            id_rutina_ejercicio,
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
              id_gimnasio,
              id_socio
            )
          )
        `)
        .eq('id_socio', idSocio)
        .eq('estado', true)
        .order('id_rutina', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('progreso')
        .select('id_progreso, peso, fecha, observaciones')
        .eq('id_socio', idSocio)
        .order('fecha', { ascending: false })
        .limit(6)
    ]);

    const membresiasGym = membresiasRes.data || [];
    const membresia =
      membresiasGym.find((m) => m.estado === 'activa') ||
      membresiasGym.find((m) => m.estado !== 'cancelada') ||
      null;

    // Último pago correspondiente al gimnasio seleccionado
    let ultimoPago = null;
    const idsContratosGym = membresiasGym.map((m) => m.id_membresia_socio);
    if (idsContratosGym.length > 0) {
      const { data: pagoData } = await db
        .from('pago')
        .select('id_pago, monto, fecha_pago, metodo_pago, estado, comprobante, id_membresia_socio')
        .in('id_membresia_socio', idsContratosGym)
        .order('fecha_pago', { ascending: false })
        .limit(1)
        .maybeSingle();
      ultimoPago = pagoData || null;
    }

    const asistenciasGym = (asistenciasGymRes.data || []).map((a) => ({
      ...a,
      id_asistencia: a.id_asistencia_socio,
      id_gimnasio: a.sucursal?.id_gimnasio || gymId || null,
      gimnasio: a.sucursal?.gimnasio || u.gimnasio || null
    }));
    const asistenciaAbierta = asistenciaAbiertaRes.data
      ? {
          ...asistenciaAbiertaRes.data,
          id_asistencia: asistenciaAbiertaRes.data.id_asistencia_socio,
          id_gimnasio: asistenciaAbiertaRes.data.sucursal?.id_gimnasio || null,
          gimnasio: asistenciaAbiertaRes.data.sucursal?.gimnasio || null
        }
      : null;
    const totalAsistencias = asistenciasGym.length;
    const asistenciasMes = asistenciasGym.filter(
      (a) => a.hora_ingreso && new Date(a.hora_ingreso) >= inicioMes
    ).length;

    const historialProgreso = progresoRes.error ? [] : (progresoRes.data || []);
    const ultimoProgreso = historialProgreso[0] || null;
    let variacionPeso = null;
    if (historialProgreso.length >= 2) {
      const diff = Number(historialProgreso[0].peso) - Number(historialProgreso[1].peso);
      if (!isNaN(diff)) variacionPeso = Number(diff.toFixed(1));
    }

    // Métricas de membresía
    let diasRestantes = null;
    let porcentajeTranscurrido = 0;
    let membresiaExpirada = true;

    if (membresia?.fecha_vencimiento) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fin = new Date(`${String(membresia.fecha_vencimiento).split('T')[0]}T00:00:00`);
      diasRestantes = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      membresiaExpirada = diasRestantes < 0 || membresia.estado !== 'activa';

      if (membresia.fecha_inicio) {
        const inicio = new Date(`${String(membresia.fecha_inicio).split('T')[0]}T00:00:00`);
        const totalDias = Math.max(1, Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)));
        const usados = Math.max(0, Math.ceil((hoy - inicio) / (1000 * 60 * 60 * 24)));
        porcentajeTranscurrido = Math.min(100, Math.max(0, Math.round((usados / totalDias) * 100)));
      }
    }

    const rutinaActiva = rutinaRes.data || null;
    const ejerciciosOrdenados = Array.isArray(rutinaActiva?.rutina_ejercicio)
      ? [...rutinaActiva.rutina_ejercicio].sort((a, b) => (a.orden || 0) - (b.orden || 0))
      : [];

    return res.status(200).json({
      socio: {
        ...u.socio,
        estado_bool: u.socio.estado,
        estado: u.socio.estado ? 'activo' : 'inactivo'
      },
      gimnasio: u.gimnasio || null,
      gimnasios: u.gimnasios || [],
      sucursales_activas: sucursalesRes.data || [],
      asistencia_abierta: asistenciaAbierta,
      membresia: membresia
        ? {
            id_membresia: membresia.id_membresia_socio,
            id_membresia_socio: membresia.id_membresia_socio,
            plan: membresia.membresia_gimnasio?.nombre || 'Plan Contratado',
            descripcion_plan: membresia.membresia_gimnasio?.descripcion || '',
            estado: membresia.estado,
            fecha_inicio: membresia.fecha_inicio,
            fecha_vencimiento: membresia.fecha_vencimiento,
            precio: Number(membresia.precio || 0),
            duracion_dias: membresia.duracion_dias_contratados,
            dias_restantes: diasRestantes,
            porcentaje_transcurrido: porcentajeTranscurrido,
            expirada: membresiaExpirada
          }
        : {
            id_membresia: null,
            id_membresia_socio: null,
            estado: 'sin_membresia',
            plan: 'Sin Membresía Activa',
            dias_restantes: 0,
            porcentaje_transcurrido: 0,
            expirada: true
          },
      ultimo_pago: ultimoPago,
      progreso: {
        peso_actual: ultimoProgreso?.peso ?? null,
        observaciones: ultimoProgreso?.observaciones ?? null,
        fecha_ultimo_registro: ultimoProgreso?.fecha ?? null,
        variacion_mes: variacionPeso,
        historial: historialProgreso
      },
      entrenamientos: {
        total_asistencias: totalAsistencias,
        asistencias_mes: asistenciasMes,
        recientes: asistenciasGym.slice(0, 14)
      },
      rutina_activa: rutinaActiva
        ? {
            id_rutina: rutinaActiva.id_rutina,
            nombre: rutinaActiva.nombre,
            descripcion: rutinaActiva.descripcion,
            ejercicios: ejerciciosOrdenados
          }
        : null
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al cargar el dashboard del socio: ' + error.message });
  }
};

/**
 * POST /api/socio/checkin
 * Registra ingreso en una sucursal específica del gimnasio seleccionado mediante RPC.
 */
const registrarCheckinSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso reservado para socios autenticados.' });
    }

    const { id_sucursal } = req.body;
    if (!id_sucursal) {
      return res.status(400).json({ error: 'Debes seleccionar la sucursal donde estás entrenando.' });
    }

    // Validar que la sucursal existe, está activa y corresponde al gimnasio seleccionado
    const { data: suc } = await db
      .from('sucursal')
      .select('id_sucursal, id_gimnasio, estado, direccion')
      .eq('id_sucursal', Number(id_sucursal))
      .maybeSingle();

    if (!suc) {
      return res.status(404).json({ error: 'Sucursal no encontrada o sin permisos.' });
    }
    if (!suc.estado) {
      return res.status(400).json({ error: 'La sucursal seleccionada se encuentra inactiva.' });
    }
    if (u.id_gimnasio && Number(suc.id_gimnasio) !== Number(u.id_gimnasio)) {
      return res.status(403).json({
        error: 'La sucursal seleccionada no pertenece al gimnasio actualmente elegido.'
      });
    }

    // Validar membresía activa y vigente en el gimnasio de esa sucursal (sin almacenarla en asistencia_socio)
    const hoyISO = new Date().toISOString().split('T')[0];
    const { data: membVigente } = await db
      .from('membresia_socio')
      .select('id_membresia_socio')
      .eq('id_socio', u.id_socio)
      .eq('id_gimnasio', suc.id_gimnasio)
      .eq('estado', 'activa')
      .lte('fecha_inicio', hoyISO)
      .gte('fecha_vencimiento', hoyISO)
      .limit(1)
      .maybeSingle();

    if (!membVigente) {
      return res.status(403).json({
        error: 'No posees una membresía activa y vigente para ingresar al gimnasio de esta sucursal.'
      });
    }

    const { data, error } = await db.rpc('rpc_registrar_ingreso_asistencia', {
      p_id_sucursal: Number(id_sucursal),
      p_id_socio: u.id_socio
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      mensaje: '¡Ingreso registrado con éxito! Recordá marcar tu salida al terminar.',
      asistencia: { ...data, id_asistencia: data.id_asistencia_socio }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al registrar check-in: ' + error.message });
  }
};

/**
 * POST /api/socio/checkout
 * Registra salida de una asistencia abierta del socio mediante RPC.
 */
const registrarCheckoutSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso reservado para socios autenticados.' });
    }

    const asistenciaId = req.body.id_asistencia_socio || req.body.id_asistencia || null;

    const { data, error } = await db.rpc('rpc_registrar_salida_asistencia', {
      p_id_asistencia_socio: asistenciaId ? Number(asistenciaId) : null,
      p_id_socio: u.id_socio
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      mensaje: '¡Salida registrada con éxito!',
      asistencia: { ...data, id_asistencia: data.id_asistencia_socio }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al registrar salida: ' + error.message });
  }
};

/**
 * POST /api/socio/progreso
 */
const registrarProgresoSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;

    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso reservado para socios autenticados.' });
    }

    const { peso, observaciones, fecha } = req.body;
    if (!peso || isNaN(peso) || Number(peso) <= 0) {
      return res.status(400).json({ error: 'Debes ingresar un valor de peso válido en kg.' });
    }

    const { data, error } = await db
      .from('progreso')
      .insert([
        {
          id_socio: u.id_socio,
          peso: Number(peso),
          fecha: fecha || new Date().toISOString().split('T')[0],
          observaciones: observaciones ? String(observaciones).trim() : null
        }
      ])
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Error al registrar el progreso: ' + error.message });
    }

    return res.status(201).json({
      mensaje: '¡Peso registrado exitosamente!',
      progreso: data
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al registrar progreso: ' + error.message });
  }
};

module.exports = {
  getDashboardSocio,
  registrarCheckinSocio,
  registrarCheckoutSocio,
  registrarProgresoSocio
};
