// ==============================================================================
// CONTROLADOR DE MEMBRESÍAS Y PAGOS DEL SOCIO — MODELO MULTIGIMNASIO
// Tablas: public.membresia_gimnasio, public.membresia_socio, public.pago
// - Soporta múltiples gimnasios con una única cuenta de socio.
// - Aísla estrictamente los datos al gimnasio seleccionado (req.usuario.id_gimnasio).
// - Conserva condiciones históricas del plan en membresia_socio al contratar.
// - Estados de pago según CHECK: 'pendiente' | 'aprobado' | 'rechazado' | 'anulado'.
// ==============================================================================

const { supabaseAdmin } = require('../config/supabase');
const {
  crearPreferenciaMercadoPago,
  crearOrdenUala
} = require('../services/paymentGatewayService');

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatearFechaEspanol(fechaStr) {
  if (!fechaStr) return 'Sin fecha';
  try {
    const raw = String(fechaStr).split('T')[0];
    const parts = raw.split('-');
    if (parts.length === 3) {
      const anio = parts[0];
      const mesIndex = parseInt(parts[1], 10) - 1;
      const dia = parseInt(parts[2], 10);
      return `${dia} ${MESES_ES[mesIndex] || parts[1]} ${anio}`;
    }
  } catch {
    // noop
  }
  return fechaStr;
}

function formatearPrecioARS(monto) {
  if (monto === null || monto === undefined || isNaN(monto)) return '$0';
  return `$${Number(monto).toLocaleString('es-AR')}`;
}

function calcularMetricasMembresia(membresia) {
  if (!membresia || !membresia.fecha_vencimiento || membresia.estado === 'cancelada') {
    return {
      tiene_membresia: false,
      estado_clave: 'sin_membresia',
      estado_etiqueta: 'Sin Membresía',
      dias_restantes: 0,
      tiempo_restante_texto: '0 días',
      porcentaje_transcurrido: 0,
      esta_vencida: true,
      fecha_inicio_formateada: '-',
      fecha_vencimiento_formateada: '-'
    };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fVenc = new Date(String(membresia.fecha_vencimiento).split('T')[0] + 'T00:00:00');
  const fIni = membresia.fecha_inicio
    ? new Date(String(membresia.fecha_inicio).split('T')[0] + 'T00:00:00')
    : new Date(fVenc.getTime() - (membresia.duracion_dias_contratados || 30) * 24 * 60 * 60 * 1000);

  const diffMs = fVenc.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const duracionTotalMs = Math.max(1, fVenc.getTime() - fIni.getTime());
  const transcurridoMs = Math.max(0, hoy.getTime() - fIni.getTime());
  let porcentajeTranscurrido = Math.min(100, Math.max(0, Math.round((transcurridoMs / duracionTotalMs) * 100)));

  const estaVencida = diasRestantes < 0 || membresia.estado === 'vencida';
  let tiempoRestanteTexto = `${diasRestantes} días`;
  if (diasRestantes === 0) {
    tiempoRestanteTexto = 'Vence hoy';
  } else if (diasRestantes < 0) {
    tiempoRestanteTexto = `Vencida hace ${Math.abs(diasRestantes)} días`;
    porcentajeTranscurrido = 100;
  }

  let estadoClave = membresia.estado;
  let estadoEtiqueta = 'Activa';
  if (estaVencida) {
    estadoClave = 'vencida';
    estadoEtiqueta = 'Vencida';
  } else if (membresia.estado === 'pendiente') {
    estadoEtiqueta = 'Pendiente de Pago';
  }

  return {
    tiene_membresia: true,
    estado_clave: estadoClave,
    estado_etiqueta: estadoEtiqueta,
    dias_restantes: Math.max(0, diasRestantes),
    dias_reales: diasRestantes,
    tiempo_restante_texto: tiempoRestanteTexto,
    porcentaje_transcurrido: porcentajeTranscurrido,
    esta_vencida: estaVencida,
    fecha_inicio_formateada: formatearFechaEspanol(membresia.fecha_inicio),
    fecha_vencimiento_formateada: formatearFechaEspanol(membresia.fecha_vencimiento)
  };
}

function formatearPagoParaVista(pago) {
  const mNorm = String(pago.metodo_pago || '').toLowerCase();
  let metodoEtiqueta = pago.metodo_pago || 'Otro';
  if (mNorm.includes('mercadopago') || mNorm === 'mp') metodoEtiqueta = 'Mercado Pago';
  else if (mNorm.includes('uala')) metodoEtiqueta = 'Ualá';
  else if (mNorm.includes('efectivo')) metodoEtiqueta = 'Efectivo';
  else if (mNorm.includes('transferencia')) metodoEtiqueta = 'Transferencia';
  else if (mNorm.includes('debito')) metodoEtiqueta = 'Tarjeta de Débito';
  else if (mNorm.includes('credito') || mNorm.includes('tarjeta')) metodoEtiqueta = 'Tarjeta de Crédito';

  const estadoMap = {
    aprobado: 'Aprobado',
    pendiente: 'Pendiente',
    rechazado: 'Rechazado',
    anulado: 'Anulado'
  };

  return {
    id_pago: pago.id_pago,
    id_membresia_socio: pago.id_membresia_socio,
    id_membresia: pago.id_membresia_socio,
    monto: Number(pago.monto),
    monto_formateado: formatearPrecioARS(pago.monto),
    fecha_pago: pago.fecha_pago,
    fecha_formateada: formatearFechaEspanol(pago.fecha_pago),
    metodo_pago: pago.metodo_pago,
    metodo_pago_etiqueta: metodoEtiqueta,
    plan_nombre: pago.membresia_socio?.membresia_gimnasio?.nombre || 'Plan de Membresía',
    gimnasio_nombre: pago.membresia_socio?.gimnasio?.nombre || null,
    categoria: 'Membresía',
    estado: pago.estado,
    estado_etiqueta: estadoMap[pago.estado] || pago.estado,
    comprobante: pago.comprobante
  };
}

/**
 * 1. GET /api/socio/membresia
 * Devuelve membresía activa, contrataciones e historial de pagos del socio
 * estrictamente filtrados al gimnasio seleccionado (más la lista de gimnasios disponibles).
 */
const getMiMembresia = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso reservado para socios autenticados.' });
    }

    if (u.requested_gym_id && !u.requested_gym_autorizado) {
      return res.status(403).json({ error: 'No tienes una relación válida con el gimnasio solicitado.' });
    }

    const gymId = u.id_gimnasio;

    // Todas las contrataciones del socio en todos sus gimnasios (para resumen multigimnasio)
    const { data: todasContrataciones, error: membErr } = await db
      .from('membresia_socio')
      .select(`
        *,
        gimnasio:id_gimnasio (id_gimnasio, nombre, telefono, email, estado),
        membresia_gimnasio (id_membresia_gimnasio, nombre, descripcion, precio, duracion_dias, estado)
      `)
      .eq('id_socio', u.id_socio)
      .order('fecha_vencimiento', { ascending: false });

    if (membErr) {
      return res.status(500).json({ error: 'Error al consultar tus membresías: ' + membErr.message });
    }

    const contratacionesGym = gymId
      ? (todasContrataciones || []).filter((m) => Number(m.id_gimnasio) === Number(gymId))
      : [];

    const membresiaActual =
      contratacionesGym.find((m) => m.estado === 'activa') ||
      contratacionesGym.find((m) => m.estado !== 'cancelada') ||
      null;

    // Historial de pagos estrictamente del gimnasio seleccionado
    let historialPagos = [];
    const idsContratosGym = contratacionesGym.map((c) => c.id_membresia_socio);
    if (idsContratosGym.length > 0) {
      const { data: pagosData, error: pagosErr } = await db
        .from('pago')
        .select(`
          id_pago,
          id_membresia_socio,
          monto,
          fecha_pago,
          metodo_pago,
          estado,
          comprobante,
          membresia_socio (
            id_membresia_socio,
            id_gimnasio,
            gimnasio:id_gimnasio (id_gimnasio, nombre),
            membresia_gimnasio (nombre)
          )
        `)
        .in('id_membresia_socio', idsContratosGym)
        .order('fecha_pago', { ascending: false });

      if (pagosErr) {
        return res.status(500).json({ error: 'Error al consultar historial de pagos: ' + pagosErr.message });
      }

      historialPagos = (pagosData || []).map(formatearPagoParaVista);
    }

    const metricas = calcularMetricasMembresia(membresiaActual);
    const plan = membresiaActual?.membresia_gimnasio || null;

    return res.status(200).json({
      socio: {
        ...u.socio,
        nombre_completo: `${u.socio.nombre} ${u.socio.apellido}`.trim()
      },
      gimnasio: u.gimnasio || null,
      gimnasios: u.gimnasios || [],
      membresia:
        membresiaActual && metricas.tiene_membresia
          ? {
              tiene_membresia: true,
              id_membresia: membresiaActual.id_membresia_socio,
              id_membresia_socio: membresiaActual.id_membresia_socio,
              id_membresia_gimnasio: membresiaActual.id_membresia_gimnasio,
              id_plan_membresia: membresiaActual.id_membresia_gimnasio,
              id_gimnasio: membresiaActual.id_gimnasio,
              nombre_plan: plan?.nombre || 'Plan Contratado',
              descripcion_plan: plan?.descripcion || '',
              precio: Number(membresiaActual.precio),
              precio_formateado: formatearPrecioARS(membresiaActual.precio),
              duracion_dias: membresiaActual.duracion_dias_contratados,
              limite_asistencias_semanales: membresiaActual.limite_asistencias_semanales,
              limite_asistencias_totales: membresiaActual.limite_asistencias_totales,
              fecha_inicio: membresiaActual.fecha_inicio,
              fecha_vencimiento: membresiaActual.fecha_vencimiento,
              fecha_inicio_formateada: metricas.fecha_inicio_formateada,
              fecha_vencimiento_formateada: metricas.fecha_vencimiento_formateada,
              dias_restantes: metricas.dias_restantes,
              tiempo_restante_texto: metricas.tiempo_restante_texto,
              porcentaje_transcurrido: metricas.porcentaje_transcurrido,
              estado: metricas.estado_clave,
              estado_etiqueta: metricas.estado_etiqueta,
              esta_vencida: metricas.esta_vencida
            }
          : {
              tiene_membresia: false,
              id_membresia: null,
              id_membresia_socio: null,
              id_plan_membresia: null,
              nombre_plan: 'Sin Membresía Activa',
              precio: 0,
              precio_formateado: '$0',
              duracion_dias: 0,
              fecha_inicio: null,
              fecha_vencimiento: null,
              fecha_inicio_formateada: '-',
              fecha_vencimiento_formateada: '-',
              dias_restantes: 0,
              tiempo_restante_texto: '0 días',
              porcentaje_transcurrido: 0,
              estado: 'sin_membresia',
              estado_etiqueta: 'Sin Membresía',
              esta_vencida: true
            },
      contrataciones_gimnasio: contratacionesGym,
      todas_membresias: todasContrataciones || [],
      historial_pagos: historialPagos
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al consultar membresía: ' + error.message });
  }
};

/**
 * 2. GET /api/socio/planes-disponibles?id_gimnasio=X
 * Devuelve los planes activos (membresia_gimnasio) del gimnasio seleccionado o del
 * gimnasio indicado por query (para contratar en un gimnasio adicional).
 * NO siembra planes ficticios.
 */
const getPlanesDisponibles = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso reservado para socios.' });
    }

    const targetGymId = req.query.id_gimnasio ? Number(req.query.id_gimnasio) : u.id_gimnasio;
    if (!targetGymId) {
      return res.status(200).json({
        gimnasio_id: null,
        plan_actual_id: null,
        total_planes: 0,
        planes: []
      });
    }

    const [membRes, planesRes] = await Promise.all([
      db
        .from('membresia_socio')
        .select('id_membresia_socio, id_membresia_gimnasio, precio, estado')
        .eq('id_socio', u.id_socio)
        .eq('id_gimnasio', targetGymId)
        .eq('estado', 'activa')
        .order('fecha_vencimiento', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('vw_catalogo_planes')
        .select('*')
        .eq('id_gimnasio', targetGymId)
        .eq('estado', true)
        .order('precio', { ascending: true })
    ]);

    if (planesRes.error) {
      return res.status(500).json({ error: 'Error al consultar planes disponibles: ' + planesRes.error.message });
    }

    const membActual = membRes.data || null;
    const planActualId = membActual?.id_membresia_gimnasio || null;
    const precioActual = Number(membActual?.precio || 0);

    const planesFormateados = (planesRes.data || []).map((plan) => {
      const precioNum = Number(plan.precio);
      const esPlanActual = plan.id_membresia_gimnasio === planActualId;
      const esSuperior = !esPlanActual && precioActual > 0 && precioNum > precioActual;
      const diferencia = precioNum - precioActual;

      return {
        id_membresia_gimnasio: plan.id_membresia_gimnasio,
        id_plan_membresia: plan.id_membresia_gimnasio,
        id_gimnasio: plan.id_gimnasio,
        nombre: plan.nombre,
        descripcion: plan.descripcion || '',
        precio: precioNum,
        precio_formateado: formatearPrecioARS(precioNum),
        duracion_dias: plan.duracion_dias,
        duracion_texto: `${plan.duracion_dias} días`,
        limite_asistencias_semanales: plan.limite_asistencias_semanales,
        limite_asistencias_totales: plan.limite_asistencias_totales,
        estado: plan.estado,
        es_plan_actual: esPlanActual,
        es_superior: esSuperior,
        diferencia_precio: diferencia > 0 ? diferencia : 0,
        diferencia_precio_formateada: diferencia > 0 ? formatearPrecioARS(diferencia) : null,
        beneficios: plan.descripcion
          ? plan.descripcion.split('\n').filter((l) => l.trim())
          : [
              `Acceso a todas las sucursales activas del gimnasio`,
              `Vigencia de ${plan.duracion_dias} días`
            ]
      };
    });

    return res.status(200).json({
      gimnasio_id: targetGymId,
      plan_actual_id: planActualId,
      total_planes: planesFormateados.length,
      planes: planesFormateados
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al obtener planes: ' + error.message });
  }
};

/**
 * Helper interno: crea una contratación histórica en membresia_socio + registro en pago
 * (usando supabaseAdmin tras confirmación de pago o verificación de pasarela).
 */
async function registrarContratacionYPago({
  socio,
  plan,
  montoFinal,
  metodoPago,
  comprobante
}) {
  if (!supabaseAdmin) {
    throw new Error('Se requiere SUPABASE_SERVICE_ROLE_KEY en el backend para acreditar contrataciones y pagos.');
  }

  // Verificar si ya tiene membresía activa vigente en este gimnasio para encadenar fecha_inicio
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];

  const { data: membVigente } = await supabaseAdmin
    .from('membresia_socio')
    .select('fecha_vencimiento')
    .eq('id_socio', socio.id_socio)
    .eq('id_gimnasio', plan.id_gimnasio)
    .eq('estado', 'activa')
    .gte('fecha_vencimiento', hoyStr)
    .order('fecha_vencimiento', { ascending: false })
    .limit(1)
    .maybeSingle();

  let fechaInicio = hoyStr;
  if (membVigente?.fecha_vencimiento) {
    const sigDia = new Date(membVigente.fecha_vencimiento + 'T00:00:00');
    sigDia.setDate(sigDia.getDate() + 1);
    fechaInicio = sigDia.toISOString().split('T')[0];
  }

  const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('rpc_contratar_membresia', {
    p_id_socio: socio.id_socio,
    p_id_membresia_gimnasio: plan.id_membresia_gimnasio,
    p_fecha_inicio: fechaInicio,
    p_estado: 'activa',
    p_registrar_pago: true,
    p_metodo_pago: (metodoPago || 'mercadopago').toLowerCase(),
    p_estado_pago: 'aprobado',
    p_comprobante: comprobante || `COMP-${Date.now()}`,
    p_monto_override: montoFinal
  });

  if (rpcErr) {
    throw new Error('Error al registrar contratación y pago: ' + rpcErr.message);
  }

  return rpcRes;
}

/**
 * 3. POST /api/socio/membresia/actualizar
 */
const solicitarActualizacion = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    const planId = req.body.id_membresia_gimnasio || req.body.id_plan_membresia;
    if (!planId) {
      return res.status(400).json({ error: 'Debes indicar el plan seleccionado.' });
    }

    const { data: plan, error: planErr } = await db
      .from('vw_catalogo_planes')
      .select('*')
      .eq('id_membresia_gimnasio', planId)
      .eq('estado', true)
      .maybeSingle();

    if (planErr || !plan) {
      return res.status(404).json({ error: 'El plan seleccionado no existe o está inactivo.' });
    }

    const { data: gymCat } = await db
      .from('vw_catalogo_gimnasios')
      .select('id_gimnasio, nombre')
      .eq('id_gimnasio', plan.id_gimnasio)
      .maybeSingle();
    plan.gimnasio = gymCat || { id_gimnasio: plan.id_gimnasio, nombre: 'Gimnasio' };

    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const venc = new Date(hoy.getTime() + plan.duracion_dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return res.status(200).json({
      mensaje: 'Plan preparado para contratación.',
      plan_seleccionado: {
        id_membresia_gimnasio: plan.id_membresia_gimnasio,
        id_plan_membresia: plan.id_membresia_gimnasio,
        id_gimnasio: plan.id_gimnasio,
        nombre: plan.nombre,
        precio: Number(plan.precio),
        precio_formateado: formatearPrecioARS(plan.precio),
        duracion_dias: plan.duracion_dias
      },
      vigencia_estimada: {
        fecha_inicio: hoyStr,
        fecha_vencimiento: venc,
        fecha_inicio_formateada: formatearFechaEspanol(hoyStr),
        fecha_vencimiento_formateada: formatearFechaEspanol(venc)
      },
      medios_pago_disponibles: ['mercadopago', 'uala', 'transferencia', 'efectivo']
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno: ' + error.message });
  }
};

/**
 * 4. POST /api/socio/pagos/iniciar
 */
const iniciarPago = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    const planId = req.body.id_membresia_gimnasio || req.body.id_plan_membresia;
    const { metodo_pago = 'mercadopago', tipo_operacion = 'contratacion' } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Debes indicar el plan para iniciar el pago.' });
    }

    const { data: plan, error: planErr } = await db
      .from('vw_catalogo_planes')
      .select('*')
      .eq('id_membresia_gimnasio', planId)
      .eq('estado', true)
      .maybeSingle();

    if (planErr || !plan) {
      return res.status(404).json({ error: 'El plan seleccionado no existe o está inactivo.' });
    }

    const { data: gymCat } = await db
      .from('vw_catalogo_gimnasios')
      .select('id_gimnasio, nombre')
      .eq('id_gimnasio', plan.id_gimnasio)
      .maybeSingle();
    plan.gimnasio = gymCat || { id_gimnasio: plan.id_gimnasio, nombre: 'Gimnasio' };

    const timestamp = Date.now();
    const externalReference = `GYM-${plan.id_gimnasio}-SOC-${u.id_socio}-PL-${plan.id_membresia_gimnasio}-${timestamp}`;
    const monto = Number(plan.precio);
    const metodoNorm = String(metodo_pago || 'mercadopago').toLowerCase();

    const pasarelaResultado =
      metodoNorm === 'uala'
        ? await crearOrdenUala({
            titulo: plan.nombre,
            monto,
            externalReference,
            socio: u.socio,
            gimnasio: plan.gimnasio
          })
        : await crearPreferenciaMercadoPago({
            titulo: plan.nombre,
            monto,
            externalReference,
            socio: u.socio,
            gimnasio: plan.gimnasio
          });

    return res.status(200).json({
      exito: true,
      mensaje: `Sesión de pago iniciada con ${metodoNorm === 'uala' ? 'Ualá' : 'Mercado Pago'}.`,
      checkout: {
        ...pasarelaResultado,
        plan: {
          id_membresia_gimnasio: plan.id_membresia_gimnasio,
          id_plan_membresia: plan.id_membresia_gimnasio,
          nombre: plan.nombre,
          precio: monto,
          precio_formateado: formatearPrecioARS(monto),
          duracion_dias: plan.duracion_dias
        },
        socio: {
          id_socio: u.id_socio,
          nombre_completo: `${u.socio.nombre} ${u.socio.apellido}`.trim(),
          dni: u.socio.dni
        },
        gimnasio: plan.gimnasio || { id_gimnasio: plan.id_gimnasio, nombre: 'Gimnasio' },
        tipo_operacion
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al iniciar el pago: ' + error.message });
  }
};

/**
 * 5. POST /api/socio/pagos/confirmar
 * Contrata el plan (puede ser del gimnasio activo o de un gimnasio adicional)
 * copiando condiciones históricas y registrando el pago aprobado.
 */
const confirmarPago = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    const planId = req.body.id_membresia_gimnasio || req.body.id_plan_membresia;
    const { monto, metodo_pago = 'mercadopago', comprobante } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'El plan es obligatorio para confirmar la contratación.' });
    }

    const { data: plan, error: planErr } = await db
      .from('vw_catalogo_planes')
      .select('*')
      .eq('id_membresia_gimnasio', planId)
      .eq('estado', true)
      .maybeSingle();

    if (planErr || !plan) {
      return res.status(404).json({ error: 'El plan seleccionado no existe o está inactivo.' });
    }

    const { data: gymCat } = await db
      .from('vw_catalogo_gimnasios')
      .select('id_gimnasio, nombre')
      .eq('id_gimnasio', plan.id_gimnasio)
      .maybeSingle();
    plan.gimnasio = gymCat || { id_gimnasio: plan.id_gimnasio, nombre: 'Gimnasio' };

    const montoFinal = monto !== undefined && monto !== null ? Number(monto) : Number(plan.precio);
    const rpcRes = await registrarContratacionYPago({
      socio: u.socio,
      plan,
      montoFinal,
      metodoPago: metodo_pago,
      comprobante
    });

    const contrato = rpcRes.membresia_socio;
    const pago = rpcRes.pago;
    const metricas = calcularMetricasMembresia(contrato);

    return res.status(201).json({
      exito: true,
      mensaje: `¡Contratación de "${plan.nombre}" en ${plan.gimnasio?.nombre || 'el gimnasio'} procesada con éxito!`,
      pago: pago ? formatearPagoParaVista(pago) : null,
      membresia: {
        ...contrato,
        id_membresia: contrato.id_membresia_socio,
        id_plan_membresia: contrato.id_membresia_gimnasio,
        nombre_plan: plan.nombre,
        precio_formateado: formatearPrecioARS(contrato.precio),
        fecha_inicio_formateada: metricas.fecha_inicio_formateada,
        fecha_vencimiento_formateada: metricas.fecha_vencimiento_formateada,
        dias_restantes: metricas.dias_restantes,
        tiempo_restante_texto: metricas.tiempo_restante_texto,
        porcentaje_transcurrido: metricas.porcentaje_transcurrido,
        estado_etiqueta: metricas.estado_etiqueta
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al confirmar el pago: ' + error.message });
  }
};

/**
 * 6. POST /api/socio/pagos/webhook
 */
const webhookPago = async (req, res) => {
  try {
    const { proveedor } = req.query;
    console.log(`🔔 Webhook recibido [${proveedor || 'mercadopago'}]:`, req.body);
    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(200).json({ error: error.message });
  }
};

/**
 * 7. GET /api/socio/pagos/verificar-mp
 */
const verificarPagoMercadoPago = async (req, res) => {
  try {
    const u = req.usuario;
    if (u.rol !== 'socio' || !u.id_socio) {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    const { external_reference, payment_id } = req.query;
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.Token_Mer || process.env.Api_MER;

    if (!mpToken) {
      return res.status(400).json({ error: 'No hay token de Mercado Pago configurado en el servidor.' });
    }

    let urlSearch = '';
    if (external_reference) {
      urlSearch = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(external_reference)}`;
    } else if (payment_id) {
      urlSearch = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(payment_id)}`;
    } else {
      urlSearch = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=10`;
    }

    const mpRes = await fetch(urlSearch, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });

    if (!mpRes.ok) {
      return res.status(200).json({ aprobado: false, mensaje: 'No se encontró el pago en Mercado Pago.' });
    }

    const mpData = await mpRes.json();
    let pagoEncontrado = null;

    if (Array.isArray(mpData.results)) {
      pagoEncontrado = external_reference
        ? mpData.results.find((p) => p.external_reference === external_reference && p.status === 'approved')
        : mpData.results.find(
            (p) => p.status === 'approved' && p.external_reference?.includes(`-SOC-${u.id_socio}-`)
          );
    } else if (mpData.id && mpData.status === 'approved') {
      pagoEncontrado = mpData;
    }

    if (!pagoEncontrado || pagoEncontrado.status !== 'approved') {
      return res.status(200).json({
        aprobado: false,
        estado_mp: pagoEncontrado?.status || 'no_encontrado',
        mensaje: 'Aún no se detecta la aprobación de Mercado Pago.'
      });
    }

    const comprobanteStr = `MP-${pagoEncontrado.id}`;
    const checkClient = supabaseAdmin || req.supabase;

    const { data: pagoExistente } = await checkClient
      .from('pago')
      .select('id_pago, id_membresia_socio')
      .or(`comprobante.eq.${comprobanteStr},comprobante.eq.${pagoEncontrado.id}`)
      .maybeSingle();

    if (pagoExistente) {
      return res.status(200).json({
        aprobado: true,
        ya_registrado: true,
        mensaje: 'El pago ya se encuentra registrado y acreditado.',
        pago_id: pagoExistente.id_pago
      });
    }

    let planId = null;
    if (pagoEncontrado.external_reference) {
      const match = pagoEncontrado.external_reference.match(/-PL-(\d+)-/);
      if (match) planId = parseInt(match[1], 10);
    }

    if (!planId) {
      return res.status(400).json({ error: 'No se pudo identificar el plan asociado a la referencia externa.' });
    }

    const { data: plan } = await checkClient
      .from('membresia_gimnasio')
      .select('*, gimnasio:id_gimnasio(id_gimnasio, nombre)')
      .eq('id_membresia_gimnasio', planId)
      .maybeSingle();

    if (!plan) {
      return res.status(404).json({ error: 'El plan asociado al pago ya no existe.' });
    }

    const montoFinal = Number(pagoEncontrado.transaction_amount || plan.precio);
    const rpcRes = await registrarContratacionYPago({
      socio: u.socio,
      plan,
      montoFinal,
      metodoPago: 'mercadopago',
      comprobante: comprobanteStr
    });

    const contrato = rpcRes.membresia_socio;
    const metricas = calcularMetricasMembresia(contrato);

    return res.status(200).json({
      aprobado: true,
      mensaje: `¡Pago de ${formatearPrecioARS(montoFinal)} acreditado exitosamente!`,
      pago: rpcRes.pago ? formatearPagoParaVista(rpcRes.pago) : null,
      membresia: {
        ...contrato,
        id_membresia: contrato.id_membresia_socio,
        nombre_plan: plan.nombre,
        precio_formateado: formatearPrecioARS(contrato.precio),
        fecha_inicio_formateada: metricas.fecha_inicio_formateada,
        fecha_vencimiento_formateada: metricas.fecha_vencimiento_formateada,
        dias_restantes: metricas.dias_restantes,
        tiempo_restante_texto: metricas.tiempo_restante_texto,
        porcentaje_transcurrido: metricas.porcentaje_transcurrido,
        estado_etiqueta: metricas.estado_etiqueta
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar pago de Mercado Pago: ' + error.message });
  }
};

module.exports = {
  getMiMembresia,
  getPlanesDisponibles,
  solicitarActualizacion,
  iniciarPago,
  confirmarPago,
  verificarPagoMercadoPago,
  webhookPago
};
