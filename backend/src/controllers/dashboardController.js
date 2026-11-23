// ==============================================================================
// CONTROLADOR DE DASHBOARD GERENCIAL (DUEÑO / STAFF) — 100% DATOS REALES SUPABASE
// Tablas: gimnasio, sucursal, empleado, membresia_socio, pago, asistencia_socio
// ==============================================================================

const getDashboardAdmin = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id_sucursal } = req.query;

    const ahora = new Date();
    const yearActual = ahora.getFullYear();
    const mesActual = ahora.getMonth();

    const inicioMesActual = new Date(yearActual, mesActual, 1).toISOString();
    const finMesActual = new Date(yearActual, mesActual + 1, 0, 23, 59, 59, 999).toISOString();
    const inicioMesAnterior = new Date(yearActual, mesActual - 1, 1).toISOString();
    const finMesAnterior = new Date(yearActual, mesActual, 0, 23, 59, 59, 999).toISOString();
    const inicioHoy = new Date(yearActual, mesActual, ahora.getDate(), 0, 0, 0, 0).toISOString();
    const finHoy = new Date(yearActual, mesActual, ahora.getDate(), 23, 59, 59, 999).toISOString();

    let asistQuery = db
      .from('asistencia_socio')
      .select(`
        id_asistencia_socio,
        id_sucursal,
        hora_ingreso,
        hora_salida,
        estado,
        socio (id_socio, nombre, apellido, dni),
        sucursal!inner (id_sucursal, direccion, id_gimnasio)
      `)
      .eq('sucursal.id_gimnasio', gymId)
      .neq('estado', 'anulada')
      .order('hora_ingreso', { ascending: false });

    if (id_sucursal && id_sucursal !== 'todas') {
      asistQuery = asistQuery.eq('id_sucursal', Number(id_sucursal));
    }

    const [gymRes, sucursalesRes, membresiasRes, pagosRes, asistenciasRes] = await Promise.all([
      db.from('gimnasio').select('*').eq('id_gimnasio', gymId).maybeSingle(),
      db.from('sucursal').select('*').eq('id_gimnasio', gymId).order('id_sucursal', { ascending: true }),
      db
        .from('membresia_socio')
        .select(`
          id_membresia_socio,
          id_socio,
          fecha_inicio,
          fecha_vencimiento,
          estado,
          creado_en,
          membresia_gimnasio (nombre),
          socio (id_socio, nombre, apellido, dni, estado, fecha_alta)
        `)
        .eq('id_gimnasio', gymId),
      db
        .from('pago')
        .select(`
          id_pago,
          monto,
          fecha_pago,
          metodo_pago,
          estado,
          membresia_socio!inner (
            id_membresia_socio,
            id_gimnasio,
            membresia_gimnasio (nombre),
            socio (id_socio, nombre, apellido, dni)
          )
        `)
        .eq('membresia_socio.id_gimnasio', gymId)
        .order('id_pago', { ascending: false }),
      asistQuery
    ]);

    const gimnasio = gymRes.data;
    const sucursales = sucursalesRes.data || [];
    const membresiasList = membresiasRes.data || [];
    const pagosList = pagosRes.data || [];
    const asistenciasList = asistenciasRes.data || [];

    // 1. KPI Socios (distintos vinculados al gimnasio por membresia_socio)
    const sociosMap = new Map();
    membresiasList.forEach((m) => {
      if (!m.socio) return;
      const existing = sociosMap.get(m.id_socio);
      if (!existing || m.estado === 'activa') {
        sociosMap.set(m.id_socio, { ...m.socio, estado_contrato: m.estado, creado_en: m.creado_en });
      }
    });

    const sociosUnicos = Array.from(sociosMap.values());
    const totalSocios = sociosUnicos.length;
    const sociosActivos = sociosUnicos.filter((s) => s.estado && s.estado_contrato === 'activa').length;
    const sociosPendientes = sociosUnicos.filter((s) => s.estado_contrato === 'pendiente').length;
    const sociosInactivos = Math.max(0, totalSocios - sociosActivos - sociosPendientes);
    const nuevosSociosMes = sociosUnicos.filter((s) => {
      const f = s.creado_en || s.fecha_alta;
      return f && f >= inicioMesActual && f <= finMesActual;
    }).length;

    // 2. KPI Pagos e Ingresos (estado = 'aprobado')
    let recaudacionMesActual = 0;
    let recaudacionMesAnterior = 0;
    let pagosRealizados = 0;
    let pagosPendientes = 0;
    let pagosRechazados = 0;

    pagosList.forEach((p) => {
      const monto = Number(p.monto) || 0;
      const fPago = p.fecha_pago ? new Date(p.fecha_pago).toISOString() : '';

      if (fPago >= inicioMesActual && fPago <= finMesActual && p.estado === 'aprobado') {
        recaudacionMesActual += monto;
        pagosRealizados += 1;
      }
      if (fPago >= inicioMesAnterior && fPago <= finMesAnterior && p.estado === 'aprobado') {
        recaudacionMesAnterior += monto;
      }
      if (p.estado === 'pendiente') pagosPendientes += 1;
      if (p.estado === 'rechazado') pagosRechazados += 1;
    });

    let variacionIngresos = 0;
    if (recaudacionMesAnterior > 0) {
      variacionIngresos = Math.round(((recaudacionMesActual - recaudacionMesAnterior) / recaudacionMesAnterior) * 100);
    } else if (recaudacionMesActual > 0) {
      variacionIngresos = 100;
    }

    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ingresosUltimos6Meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(yearActual, mesActual - i, 1);
      const mIdx = d.getMonth();
      const yIdx = d.getFullYear();
      const mInicio = new Date(yIdx, mIdx, 1).toISOString();
      const mFin = new Date(yIdx, mIdx + 1, 0, 23, 59, 59, 999).toISOString();

      const totalMes = pagosList.reduce((acc, p) => {
        const f = p.fecha_pago ? new Date(p.fecha_pago).toISOString() : '';
        if (f >= mInicio && f <= mFin && p.estado === 'aprobado') {
          return acc + (Number(p.monto) || 0);
        }
        return acc;
      }, 0);

      ingresosUltimos6Meses.push({
        mes: `${mesesNombres[mIdx]}${yIdx !== yearActual ? ` '${String(yIdx).slice(2)}` : ''}`,
        recaudacion: totalMes
      });
    }

    // 3. KPI Asistencias y desglose por sucursal
    const asistenciasHoy = asistenciasList.filter((a) => {
      const h = a.hora_ingreso ? new Date(a.hora_ingreso).toISOString() : '';
      return h >= inicioHoy && h <= finHoy;
    }).length;

    const asistenciasMesActual = asistenciasList.filter((a) => {
      const h = a.hora_ingreso ? new Date(a.hora_ingreso).toISOString() : '';
      return h >= inicioMesActual && h <= finMesActual;
    }).length;

    const asistenciasMesAnterior = asistenciasList.filter((a) => {
      const h = a.hora_ingreso ? new Date(a.hora_ingreso).toISOString() : '';
      return h >= inicioMesAnterior && h <= finMesAnterior;
    }).length;

    let variacionAsistencias = 0;
    if (asistenciasMesAnterior > 0) {
      variacionAsistencias = Math.round(((asistenciasMesActual - asistenciasMesAnterior) / asistenciasMesAnterior) * 100);
    } else if (asistenciasMesActual > 0) {
      variacionAsistencias = 100;
    }

    const diasSemanaMap = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
    const ordenDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const conteoDias = { Lun: 0, Mar: 0, Mié: 0, Jue: 0, Vie: 0, Sáb: 0, Dom: 0 };

    const conteoPorSucursal = {};
    asistenciasList.forEach((a) => {
      if (a.hora_ingreso) {
        const nombreDia = diasSemanaMap[new Date(a.hora_ingreso).getDay()];
        if (conteoDias[nombreDia] !== undefined) conteoDias[nombreDia] += 1;
      }
      const sucLabel = a.sucursal?.direccion || `Sucursal #${a.id_sucursal}`;
      conteoPorSucursal[sucLabel] = (conteoPorSucursal[sucLabel] || 0) + 1;
    });

    const asistenciasPorDia = ordenDias.map((dia) => ({ dia, asistencias: conteoDias[dia] }));
    const asistenciasPorSucursal = Object.entries(conteoPorSucursal).map(([sucursal, total]) => ({
      sucursal,
      total
    }));

    // 4. Distribución de planes y próximos vencimientos
    const planesConteo = {};
    const hoyDate = new Date();
    hoyDate.setHours(0, 0, 0, 0);

    let totalMembresiasVencidas = 0;
    let totalMembresiasPorVencer = 0;
    const proximosVencimientos = [];

    membresiasList.forEach((m) => {
      const planNombre = m.membresia_gimnasio?.nombre || 'Plan';
      planesConteo[planNombre] = (planesConteo[planNombre] || 0) + 1;

      if (m.estado === 'cancelada') return;

      let esVencida = m.estado === 'vencida';
      let esPorVencer = false;

      if (m.fecha_vencimiento) {
        const [y, mes, d] = String(m.fecha_vencimiento).split('T')[0].split('-').map(Number);
        const fVenc = new Date(y, mes - 1, d, 23, 59, 59, 999);
        const diasRest = Math.ceil((fVenc.getTime() - hoyDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diasRest <= 0) esVencida = true;
        else if (diasRest <= 7) esPorVencer = true;
      }

      if (esVencida) {
        totalMembresiasVencidas += 1;
      } else if (esPorVencer) {
        totalMembresiasPorVencer += 1;
        proximosVencimientos.push({
          id_membresia_socio: m.id_membresia_socio,
          socio: {
            id_socio: m.socio?.id_socio,
            nombre: `${m.socio?.nombre || ''} ${m.socio?.apellido || ''}`.trim(),
            dni: m.socio?.dni
          },
          plan: planNombre,
          fecha_vencimiento: m.fecha_vencimiento
        });
      }
    });

    const distribucionPlanes = Object.entries(planesConteo).map(([name, value]) => ({ name, value }));

    const ultimasAsistencias = asistenciasList.slice(0, 6).map((a) => ({
      id: a.id_asistencia_socio,
      socio: `${a.socio?.nombre || ''} ${a.socio?.apellido || ''}`.trim(),
      dni: a.socio?.dni || 'S/D',
      sucursal: a.sucursal?.direccion || '-',
      hora: a.hora_ingreso,
      hora_salida: a.hora_salida,
      estado: a.estado
    }));

    const ultimosPagos = pagosList.slice(0, 6).map((p) => ({
      id: p.id_pago,
      socio: `${p.membresia_socio?.socio?.nombre || ''} ${p.membresia_socio?.socio?.apellido || ''}`.trim(),
      plan: p.membresia_socio?.membresia_gimnasio?.nombre || 'Membresía',
      monto: Number(p.monto) || 0,
      metodo: p.metodo_pago,
      estado: p.estado,
      fecha: p.fecha_pago
    }));

    return res.status(200).json({
      gimnasio: gimnasio || { id_gimnasio: gymId, nombre: 'Gimnasio' },
      sucursales,
      kpis: {
        socios: {
          total: totalSocios,
          activos: sociosActivos,
          inactivos: sociosInactivos,
          pendientes: sociosPendientes,
          nuevosMes: nuevosSociosMes
        },
        sucursales: {
          total: sucursales.length,
          activas: sucursales.filter((s) => s.estado).length
        },
        ingresos: {
          mesActual: recaudacionMesActual,
          mesAnterior: recaudacionMesAnterior,
          variacionPorcentaje: variacionIngresos,
          pagosRealizados,
          pagosPendientes,
          pagosVencidos: pagosRechazados,
          pagosRechazados
        },
        asistencias: {
          hoy: asistenciasHoy,
          mesActual: asistenciasMesActual,
          mesAnterior: asistenciasMesAnterior,
          variacionPorcentaje: variacionAsistencias
        },
        membresiasPorVencer: totalMembresiasPorVencer,
        membresiasVencidas: totalMembresiasVencidas
      },
      graficos: {
        ingresosMensuales: ingresosUltimos6Meses,
        asistenciasPorDia,
        asistenciasPorSucursal,
        distribucionPlanes
      },
      actividadReciente: {
        asistencias: ultimasAsistencias,
        pagos: ultimosPagos
      },
      proximosVencimientos
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al compilar métricas del dashboard: ' + error.message });
  }
};

module.exports = {
  getDashboardAdmin
};
