// ==============================================================================
// CONTROLADOR DE SOCIOS — MODELO MULTIGIMNASIO + SUPABASE AUTH
// Tabla: public.socio (id_socio, auth_user_id, dni, telefono, fecha_alta,
//        estado boolean, nombre, apellido, email)
// Relación con gimnasios: N:M mediante public.membresia_socio
// ==============================================================================

const { supabaseAnon, supabaseAdmin } = require('../config/supabase');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBooleanEstado(val, fallback = true) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'activo', 'activa'].includes(s)) return true;
  if (['false', '0', 'inactivo', 'inactiva'].includes(s)) return false;
  return fallback;
}

function normalizarEstadoMembresia(est) {
  const s = String(est || 'activa').trim().toLowerCase();
  if (s === 'activo' || s === 'activa') return 'activa';
  if (s === 'pendiente') return 'pendiente';
  if (s === 'vencido' || s === 'vencida') return 'vencida';
  if (s === 'cancelado' || s === 'cancelada' || s === 'inactivo' || s === 'inactiva') return 'cancelada';
  return 'activa';
}

function formatearSocioConMembresias(socio, membresiasDelGym = []) {
  const ordenadas = [...membresiasDelGym].sort(
    (a, b) => new Date(b.fecha_vencimiento || 0) - new Date(a.fecha_vencimiento || 0)
  );
  const membActiva = ordenadas.find((m) => m.estado === 'activa') || ordenadas[0] || null;
  const estadoOperativo = !socio.estado
    ? 'inactivo'
    : membActiva?.estado === 'activa'
    ? 'activo'
    : membActiva?.estado === 'pendiente'
    ? 'pendiente'
    : 'inactivo';

  return {
    ...socio,
    estado_bool: socio.estado,
    estado: estadoOperativo,
    membresia_activa: membActiva,
    membresia: ordenadas.map((m) => ({
      ...m,
      id_membresia: m.id_membresia_socio,
      id_plan_membresia: m.id_membresia_gimnasio,
      plan_membresia: m.membresia_gimnasio
        ? {
            ...m.membresia_gimnasio,
            id_plan_membresia: m.membresia_gimnasio.id_membresia_gimnasio
          }
        : null
    }))
  };
}

/**
 * 1. GET /api/socios
 * Lista los socios vinculados al gimnasio activo (vía membresia_socio).
 */
const getSocios = async (req, res) => {
  try {
    const db = req.supabase;
    const idGimnasio = req.gimnasioId;
    const { estado, search, limit, page } = req.query;

    // Consultar contrataciones del gimnasio activo junto con datos del socio y plan
    const { data: contrataciones, error } = await db
      .from('membresia_socio')
      .select(`
        id_membresia_socio,
        id_socio,
        id_membresia_gimnasio,
        id_gimnasio,
        precio,
        duracion_dias_contratados,
        limite_asistencias_semanales,
        limite_asistencias_totales,
        fecha_inicio,
        fecha_vencimiento,
        estado,
        creado_en,
        membresia_gimnasio (
          id_membresia_gimnasio,
          nombre,
          descripcion,
          precio,
          duracion_dias,
          estado
        ),
        socio!inner (
          id_socio,
          auth_user_id,
          dni,
          telefono,
          fecha_alta,
          estado,
          nombre,
          apellido,
          email
        )
      `)
      .eq('id_gimnasio', idGimnasio)
      .order('id_membresia_socio', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Error al consultar los socios: ' + error.message });
    }

    // Agrupar por id_socio
    const sociosMap = new Map();
    (contrataciones || []).forEach((c) => {
      if (!c.socio) return;
      const sid = c.socio.id_socio;
      if (!sociosMap.has(sid)) {
        sociosMap.set(sid, { socio: c.socio, membresias: [] });
      }
      const { socio: _s, ...soloMemb } = c;
      sociosMap.get(sid).membresias.push(soloMemb);
    });

    let lista = Array.from(sociosMap.values())
      .map(({ socio, membresias }) => formatearSocioConMembresias(socio, membresias))
      .sort((a, b) => b.id_socio - a.id_socio);

    // Filtro por estado operativo ('activo' | 'pendiente' | 'inactivo')
    if (estado && estado !== 'todos') {
      const estNorm = String(estado).toLowerCase();
      lista = lista.filter((s) => s.estado === estNorm);
    }

    // Búsqueda por nombre, apellido, DNI, teléfono o email
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      lista = lista.filter((s) => {
        const hay = `${s.nombre || ''} ${s.apellido || ''} ${s.dni || ''} ${s.telefono || ''} ${s.email || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const total = lista.length;
    const isAll = limit === 'all' || limit === '0';
    const parsedLimit = parseInt(limit, 10) || 6;
    const parsedPage = parseInt(page, 10) || 1;

    const paginados = isAll
      ? lista
      : lista.slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit);

    return res.status(200).json({
      total,
      page: isAll ? 1 : parsedPage,
      totalPages: isAll ? 1 : Math.max(1, Math.ceil(total / parsedLimit)),
      limit: isAll ? total : parsedLimit,
      socios: paginados
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al consultar socios: ' + error.message });
  }
};

/**
 * 2. GET /api/socios/:id
 */
const getSocioById = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const u = req.usuario;
    const idGimnasio = req.gimnasioId;

    if (u.rol === 'socio' && Number(u.id_socio) !== Number(id)) {
      return res.status(403).json({ error: 'No tienes permisos para ver el perfil de otro socio.' });
    }

    const { data: socio, error } = await db
      .from('socio')
      .select('id_socio, auth_user_id, dni, telefono, fecha_alta, estado, nombre, apellido, email')
      .eq('id_socio', id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al obtener el socio: ' + error.message });
    }
    if (!socio) {
      return res.status(404).json({ error: 'Socio no encontrado o sin permisos.' });
    }

    let membQuery = db
      .from('membresia_socio')
      .select('*, membresia_gimnasio(*), gimnasio:id_gimnasio(id_gimnasio, nombre)')
      .eq('id_socio', id)
      .order('fecha_vencimiento', { ascending: false });

    let asistQuery = db
      .from('asistencia_socio')
      .select(`
        id_asistencia_socio,
        id_socio,
        id_sucursal,
        hora_ingreso,
        hora_salida,
        estado,
        sucursal!inner(id_sucursal, direccion, id_gimnasio, gimnasio:id_gimnasio(id_gimnasio, nombre))
      `)
      .eq('id_socio', id)
      .order('hora_ingreso', { ascending: false })
      .limit(20);

    if (idGimnasio) {
      membQuery = membQuery.eq('id_gimnasio', idGimnasio);
      asistQuery = asistQuery.eq('sucursal.id_gimnasio', idGimnasio);
    }

    const [membRes, asistRes] = await Promise.all([membQuery, asistQuery]);

    const socioFormateado = formatearSocioConMembresias(socio, membRes.data || []);
    socioFormateado.asistencia = (asistRes.data || []).map((a) => ({
      ...a,
      id_asistencia: a.id_asistencia_socio,
      id_gimnasio: a.sucursal?.id_gimnasio || null,
      gimnasio: a.sucursal?.gimnasio || null
    }));

    return res.status(200).json({ socio: socioFormateado });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al obtener socio: ' + error.message });
  }
};

/**
 * 3. GET /api/socios/verificar-dni?dni=39123456
 * En el modelo multigimnasio, un socio existente en otro gimnasio NO es bloqueado:
 * se informa si ya existe en GymTrack para vincularlo a este gimnasio con su misma cuenta.
 */
const verificarDniSocio = async (req, res) => {
  try {
    const idGimnasio = req.gimnasioId;
    const { dni, email } = req.query;

    if (!dni && !email) {
      return res.status(400).json({ error: 'Debes proporcionar DNI o email para verificar.' });
    }

    const clientLookup = supabaseAdmin || req.supabase;
    let socioExistente = null;

    if (dni && String(dni).trim()) {
      const cleanDni = String(dni).trim();
      const dniSinPuntos = cleanDni.replace(/[\.\s-]/g, '');
      const { data } = await clientLookup
        .from('socio')
        .select('id_socio, nombre, apellido, dni, email, telefono, estado')
        .in('dni', [cleanDni, dniSinPuntos])
        .maybeSingle();
      socioExistente = data || null;
    }

    if (!socioExistente && email && String(email).trim()) {
      const { data } = await clientLookup
        .from('socio')
        .select('id_socio, nombre, apellido, dni, email, telefono, estado')
        .ilike('email', String(email).trim().toLowerCase())
        .maybeSingle();
      socioExistente = data || null;
    }

    if (!socioExistente) {
      return res.status(200).json({
        existeEnEsteGimnasio: false,
        existeEnGymTrack: false,
        vinculadoOtroGimnasio: false
      });
    }

    // Verificar si ya tiene membresía en el gimnasio actual
    const { data: membEnEsteGym } = await clientLookup
      .from('membresia_socio')
      .select('id_membresia_socio, estado, fecha_vencimiento')
      .eq('id_socio', socioExistente.id_socio)
      .eq('id_gimnasio', idGimnasio)
      .order('fecha_vencimiento', { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.status(200).json({
      existeEnEsteGimnasio: Boolean(membEnEsteGym),
      existeEnGymTrack: true,
      vinculadoOtroGimnasio: !membEnEsteGym,
      bloqueado: false,
      socio: {
        id_socio: socioExistente.id_socio,
        nombre: socioExistente.nombre,
        apellido: socioExistente.apellido,
        dni: socioExistente.dni,
        email: socioExistente.email,
        telefono: socioExistente.telefono,
        estado: socioExistente.estado
      },
      mensaje: membEnEsteGym
        ? 'Este socio ya tiene una membresía registrada en tu gimnasio.'
        : 'Este socio ya posee una cuenta en GymTrack. Al registrarlo, se vinculará su cuenta existente a tu gimnasio sin duplicar su usuario.'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar DNI del socio: ' + error.message });
  }
};

/**
 * 4. POST /api/socios
 * Registra un nuevo socio (creando cuenta en Supabase Auth sin guardar contraseña en tabla socio)
 * O vincula un socio ya existente en GymTrack a este gimnasio creando su membresia_socio.
 */
const createSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const idGimnasio = req.gimnasioId;
    const {
      nombre,
      apellido,
      dni,
      telefono,
      email,
      contrasena,
      password,
      enviar_invitacion = false,
      id_membresia_gimnasio,
      id_plan_membresia,
      plan,
      precio,
      estado,
      fecha_inicio,
      registrar_pago = false,
      metodo_pago = 'efectivo'
    } = req.body;

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (!dni || !String(dni).trim()) {
      return res.status(400).json({ error: 'El DNI es obligatorio.' });
    }

    const cleanDni = String(dni).trim();
    const dniSinPuntos = cleanDni.replace(/[\.\s-]/g, '');
    const cleanEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;

    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
    }

    // 1. Resolver el plan del gimnasio (obligatorio para vincular socio al gimnasio en membresia_socio)
    let planId = id_membresia_gimnasio || id_plan_membresia || null;
    if (!planId && plan) {
      const { data: pByName } = await db
        .from('membresia_gimnasio')
        .select('id_membresia_gimnasio')
        .eq('id_gimnasio', idGimnasio)
        .eq('estado', true)
        .ilike('nombre', `%${String(plan).trim()}%`)
        .limit(1)
        .maybeSingle();
      if (pByName) planId = pByName.id_membresia_gimnasio;
    }
    if (!planId) {
      const { data: pDefault } = await db
        .from('membresia_gimnasio')
        .select('id_membresia_gimnasio')
        .eq('id_gimnasio', idGimnasio)
        .eq('estado', true)
        .order('id_membresia_gimnasio', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (pDefault) planId = pDefault.id_membresia_gimnasio;
    }

    if (!planId) {
      return res.status(400).json({
        error: 'Debes crear al menos un plan activo en tu gimnasio antes de inscribir socios.'
      });
    }

    // 2. Comprobar si el socio ya existe globalmente en GymTrack (multigimnasio)
    const lookupClient = supabaseAdmin || db;
    let socioExistente = null;

    const { data: byDni } = await lookupClient
      .from('socio')
      .select('*')
      .in('dni', [cleanDni, dniSinPuntos])
      .maybeSingle();
    socioExistente = byDni || null;

    if (!socioExistente && cleanEmail) {
      const { data: byEmail } = await lookupClient
        .from('socio')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();
      socioExistente = byEmail || null;
    }

    let socioFinal = socioExistente;
    let creadoNuevo = false;

    if (!socioFinal) {
      // Nuevo socio en GymTrack: provisionar cuenta en Supabase Auth si tiene email
      let authUserId = null;
      const rawPass = (contrasena || password || '').toString().trim();

      if (cleanEmail) {
        if (!supabaseAdmin) {
          return res.status(503).json({
            error:
              'El backend requiere SUPABASE_SERVICE_ROLE_KEY para crear cuentas de acceso de socios en Supabase Auth.'
          });
        }

        if (enviar_invitacion || !rawPass) {
          const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            cleanEmail,
            {
              data: {
                nombre: String(nombre).trim(),
                apellido: apellido ? String(apellido).trim() : '',
                tipo_inicial: 'socio'
              }
            }
          );
          if (invErr) {
            return res.status(400).json({ error: 'Error al invitar al socio en Supabase Auth: ' + invErr.message });
          }
          authUserId = invited.user.id;
        } else {
          if (rawPass.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
          }
          const { data: created, error: crErr } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: rawPass,
            email_confirm: true,
            user_metadata: {
              nombre: String(nombre).trim(),
              apellido: apellido ? String(apellido).trim() : '',
              tipo_inicial: 'socio'
            }
          });
          if (crErr) {
            return res.status(400).json({ error: 'Error al crear cuenta del socio en Supabase Auth: ' + crErr.message });
          }
          authUserId = created.user.id;
        }
      }

      if (!supabaseAdmin) {
        // Alta presencial sin Auth: usa RPC transaccional que crea socio + membresía validando el gimnasio
        const estadoContratoWalkIn = normalizarEstadoMembresia(estado || 'activa');
        const { data: rpcSocRes, error: errSocRpc } = await db.rpc('rpc_registrar_socio_gimnasio', {
          p_id_gimnasio: idGimnasio,
          p_id_membresia_gimnasio: Number(planId),
          p_nombre: String(nombre).trim(),
          p_apellido: apellido ? String(apellido).trim() : '',
          p_dni: cleanDni,
          p_email: cleanEmail,
          p_telefono: telefono ? String(telefono).trim() : null,
          p_fecha_inicio: fecha_inicio || new Date().toISOString().split('T')[0],
          p_estado_membresia: estadoContratoWalkIn,
          p_registrar_pago: Boolean(registrar_pago),
          p_metodo_pago: metodo_pago || 'efectivo',
          p_monto_override: precio !== undefined && precio !== '' ? Number(precio) : null
        });

        if (errSocRpc) {
          return res.status(400).json({ error: 'Error al registrar socio en el gimnasio: ' + errSocRpc.message });
        }

        const socioCreadoRpc = rpcSocRes?.socio || null;
        const membCreadaRpc = rpcSocRes?.membresia_socio || null;
        return res.status(201).json({
          mensaje: rpcSocRes?.creado
            ? 'Socio registrado y vinculado a tu gimnasio exitosamente.'
            : 'Socio existente en GymTrack vinculado a tu gimnasio con nueva membresía.',
          reutilizo_cuenta_existente: !rpcSocRes?.creado,
          socio: formatearSocioConMembresias(socioCreadoRpc, membCreadaRpc ? [membCreadaRpc] : []),
          membresia: membCreadaRpc,
          pago: rpcSocRes?.pago || null
        });
      }

      const { data: nuevoSocio, error: errSocio } = await lookupClient
        .from('socio')
        .insert([
          {
            auth_user_id: authUserId,
            nombre: String(nombre).trim(),
            apellido: apellido ? String(apellido).trim() : '',
            dni: cleanDni,
            telefono: telefono ? String(telefono).trim() : null,
            email: cleanEmail,
            estado: true
          }
        ])
        .select('*')
        .single();

      if (errSocio) {
        if (authUserId && supabaseAdmin) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
        }
        return res.status(400).json({ error: 'Error al crear el socio: ' + errSocio.message });
      }

      socioFinal = nuevoSocio;
      creadoNuevo = true;
    }

    // 3. Crear la contratación en membresia_socio copiando condiciones históricas del plan vía RPC
    const estadoContrato = normalizarEstadoMembresia(estado || 'activa');
    const rpcClient = creadoNuevo && supabaseAdmin ? supabaseAdmin : db;

    const { data: rpcResult, error: errRpc } = await rpcClient.rpc('rpc_contratar_membresia', {
      p_id_socio: socioFinal.id_socio,
      p_id_membresia_gimnasio: Number(planId),
      p_fecha_inicio: fecha_inicio || new Date().toISOString().split('T')[0],
      p_estado: estadoContrato,
      p_registrar_pago: Boolean(registrar_pago),
      p_metodo_pago: metodo_pago || 'efectivo',
      p_estado_pago: 'aprobado',
      p_comprobante: null,
      p_monto_override: precio !== undefined && precio !== '' ? Number(precio) : null
    });

    if (errRpc) {
      return res.status(400).json({ error: 'Error al registrar la membresía del socio: ' + errRpc.message });
    }

    return res.status(201).json({
      mensaje: creadoNuevo
        ? 'Socio registrado y vinculado a tu gimnasio exitosamente.'
        : 'Socio existente en GymTrack vinculado a tu gimnasio con nueva membresía.',
      reutilizo_cuenta_existente: !creadoNuevo,
      socio: formatearSocioConMembresias(socioFinal, rpcResult?.membresia_socio ? [rpcResult.membresia_socio] : []),
      membresia: rpcResult?.membresia_socio || null,
      pago: rpcResult?.pago || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al registrar socio: ' + error.message });
  }
};

/**
 * 5. PUT /api/socios/:id
 * Actualiza datos personales del socio (y opcionalmente su estado/membresía en este gimnasio).
 */
const updateSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const idGimnasio = req.gimnasioId;
    const { nombre, apellido, dni, telefono, email, estado, contrasena, password } = req.body;

    const { data: socioActual, error: errFetch } = await db
      .from('socio')
      .select('id_socio, auth_user_id, email')
      .eq('id_socio', id)
      .maybeSingle();

    if (errFetch || !socioActual) {
      return res.status(404).json({ error: 'Socio no encontrado o sin permisos.' });
    }

    const updateCampos = {};
    if (nombre !== undefined && String(nombre).trim()) updateCampos.nombre = String(nombre).trim();
    if (apellido !== undefined) updateCampos.apellido = String(apellido).trim();
    if (dni !== undefined && String(dni).trim()) updateCampos.dni = String(dni).trim();
    if (telefono !== undefined) updateCampos.telefono = telefono ? String(telefono).trim() : null;
    if (email !== undefined) {
      const cleanEmail = email ? String(email).trim().toLowerCase() : null;
      if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ error: 'El email ingresado no es válido.' });
      }
      updateCampos.email = cleanEmail;
    }
    if (estado !== undefined) {
      const u = req.usuario;
      const esDuenoOAdmin =
        !u ||
        u.rol === 'dueño' ||
        (u.rol === 'empleado' && (u.roles_empleado || []).includes('administrador'));
      if (!esDuenoOAdmin) {
        return res.status(403).json({
          error: 'Solo el dueño o administrador autorizado puede modificar el estado administrativo del socio.'
        });
      }
      updateCampos.estado = parseBooleanEstado(estado, true);
    }

    // Si se solicita restablecer contraseña del socio, hacerlo exclusivamente en Supabase Auth
    const rawPass = (contrasena || password || '').toString().trim();
    if (rawPass) {
      if (rawPass.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      }
      if (!supabaseAdmin || !socioActual.auth_user_id) {
        return res.status(400).json({
          error: 'No se puede cambiar la contraseña sin una cuenta vinculada en Supabase Auth y SUPABASE_SERVICE_ROLE_KEY.'
        });
      }
      const { error: passErr } = await supabaseAdmin.auth.admin.updateUserById(socioActual.auth_user_id, {
        password: rawPass
      });
      if (passErr) {
        return res.status(400).json({ error: 'Error al actualizar contraseña en Auth: ' + passErr.message });
      }
    }

    const { data: socioActualizado, error: errorUpdate } = await db
      .from('socio')
      .update(updateCampos)
      .eq('id_socio', id)
      .select('*')
      .single();

    if (errorUpdate) {
      return res.status(400).json({ error: 'Error al actualizar socio: ' + errorUpdate.message });
    }

    // Refrescar membresías del gimnasio activo
    const { data: membs } = await db
      .from('membresia_socio')
      .select('*, membresia_gimnasio(*)')
      .eq('id_socio', id)
      .eq('id_gimnasio', idGimnasio);

    return res.status(200).json({
      mensaje: 'Socio actualizado correctamente.',
      socio: formatearSocioConMembresias(socioActualizado, membs || [])
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al actualizar socio: ' + error.message });
  }
};

/**
 * 6. PATCH /api/socios/:id/estado
 * En contexto multigimnasio, cambiar el estado desde un gimnasio actualiza la membresía
 * de ese socio en ESTE gimnasio sin destruir su cuenta en otros gimnasios.
 */
const changeEstadoSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const idGimnasio = req.gimnasioId;
    const { estado } = req.body;

    const nuevoEstadoContrato = normalizarEstadoMembresia(estado);

    const { data: ultimaMemb, error: findErr } = await db
      .from('membresia_socio')
      .select('id_membresia_socio')
      .eq('id_socio', id)
      .eq('id_gimnasio', idGimnasio)
      .order('fecha_vencimiento', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr || !ultimaMemb) {
      return res.status(404).json({ error: 'No se encontró una membresía de este socio en tu gimnasio.' });
    }

    const { data: membActualizada, error: updErr } = await db
      .from('membresia_socio')
      .update({ estado: nuevoEstadoContrato })
      .eq('id_membresia_socio', ultimaMemb.id_membresia_socio)
      .eq('id_gimnasio', idGimnasio)
      .select('*')
      .single();

    if (updErr) {
      return res.status(500).json({ error: 'Error al cambiar estado de la membresía: ' + updErr.message });
    }

    return res.status(200).json({
      mensaje: `Estado del socio en este gimnasio actualizado a '${nuevoEstadoContrato}'.`,
      membresia: membActualizada
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al cambiar estado: ' + error.message });
  }
};

/**
 * 7. DELETE /api/socios/:id
 * Desvincula al socio del gimnasio activo cancelando sus membresías vigentes en este gimnasio.
 * Conserva pagos, asistencias y sus membresías en otros gimnasios (integridad contable y multigimnasio).
 */
const deleteSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const { id } = req.params;
    const idGimnasio = req.gimnasioId;

    const { data: actualizadas, error } = await db
      .from('membresia_socio')
      .update({ estado: 'cancelada' })
      .eq('id_socio', id)
      .eq('id_gimnasio', idGimnasio)
      .in('estado', ['activa', 'pendiente'])
      .select('id_membresia_socio');

    if (error) {
      return res.status(500).json({ error: 'Error al desvincular socio del gimnasio: ' + error.message });
    }

    return res.status(200).json({
      mensaje:
        'Las membresías activas/pendientes del socio en este gimnasio fueron canceladas preservando el historial financiero y sus suscripciones en otros gimnasios.',
      membresias_canceladas: (actualizadas || []).length
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al desvincular socio: ' + error.message });
  }
};

/**
 * 8. GET /api/socios/perfil
 * Consulta perfil integral del socio (aislado por gimnasio activo si corresponde).
 */
const getPerfilSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    let targetId = req.query.id || req.params.id;

    if (u.rol === 'socio') {
      if (targetId && Number(targetId) !== Number(u.id_socio)) {
        return res.status(403).json({ error: 'No tienes permisos para ver el perfil de otro socio.' });
      }
      targetId = u.id_socio;
    }

    if (!targetId) {
      return res.status(400).json({ error: 'No se especificó el ID del socio a consultar.' });
    }

    const { data: socio, error } = await db
      .from('socio')
      .select('id_socio, auth_user_id, dni, telefono, fecha_alta, estado, nombre, apellido, email')
      .eq('id_socio', targetId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al consultar perfil: ' + error.message });
    }
    if (!socio) {
      return res.status(404).json({ error: 'Perfil de socio no encontrado o sin permisos.' });
    }

    const gymId = u.id_gimnasio || null;

    let membQuery = db
      .from('membresia_socio')
      .select(`
        *,
        gimnasio:id_gimnasio (id_gimnasio, nombre, telefono, email),
        membresia_gimnasio (id_membresia_gimnasio, nombre, descripcion, precio, duracion_dias)
      `)
      .eq('id_socio', targetId)
      .order('fecha_vencimiento', { ascending: false });

    let asistQuery = db
      .from('asistencia_socio')
      .select(`
        id_asistencia_socio,
        id_socio,
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
      .eq('id_socio', targetId)
      .order('hora_ingreso', { ascending: false })
      .limit(10);

    if (gymId) {
      membQuery = membQuery.eq('id_gimnasio', gymId);
      asistQuery = asistQuery.eq('sucursal.id_gimnasio', gymId);
    }

    const [membRes, asistRes] = await Promise.all([membQuery, asistQuery]);
    const membresiasLista = (membRes.data || []).map((m) => ({
      ...m,
      id_membresia: m.id_membresia_socio,
      id_plan_membresia: m.id_membresia_gimnasio,
      plan_membresia: m.membresia_gimnasio
        ? { ...m.membresia_gimnasio, id_plan_membresia: m.membresia_gimnasio.id_membresia_gimnasio }
        : null
    }));

    let ultimosPagos = [];
    const membIds = membresiasLista.map((m) => m.id_membresia_socio);
    if (membIds.length > 0) {
      const { data: pagosData } = await db
        .from('pago')
        .select('id_pago, monto, fecha_pago, metodo_pago, estado, comprobante, id_membresia_socio')
        .in('id_membresia_socio', membIds)
        .order('fecha_pago', { ascending: false })
        .limit(10);
      ultimosPagos = pagosData || [];
    }

    const membresiaActiva = membresiasLista.find((m) => m.estado === 'activa') || membresiasLista[0] || null;
    let diasRestantes = null;
    if (membresiaActiva?.fecha_vencimiento) {
      const diff = new Date(membresiaActiva.fecha_vencimiento + 'T00:00:00') - new Date();
      diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return res.status(200).json({
      tipo: 'socio',
      socio: {
        ...socio,
        estado_bool: socio.estado,
        estado: socio.estado ? 'activo' : 'inactivo'
      },
      gimnasio: u.gimnasio || membresiaActiva?.gimnasio || null,
      gimnasios: u.gimnasios || [],
      membresia: membresiaActiva,
      historialMembresias: membresiasLista,
      ultimosPagos,
      ultimasAsistencias: (asistRes.data || []).map((a) => ({
        ...a,
        id_asistencia: a.id_asistencia_socio,
        id_gimnasio: a.sucursal?.id_gimnasio || null,
        gimnasio: a.sucursal?.gimnasio || null
      })),
      estadisticas: {
        totalAsistencias: (asistRes.data || []).length,
        totalPagos: ultimosPagos.length,
        estadoMembresia: membresiaActiva ? membresiaActiva.estado : 'sin_membresia',
        diasRestantes
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al consultar perfil: ' + error.message });
  }
};

/**
 * 9. PUT /api/socios/perfil
 * Actualiza datos personales del socio y contraseña exclusivamente vía Supabase Auth.
 */
const updatePerfilSocio = async (req, res) => {
  try {
    const db = req.supabase;
    const u = req.usuario;
    let targetId = req.body.id_socio || req.query.id;

    if (u.rol === 'socio') {
      if (targetId && Number(targetId) !== Number(u.id_socio)) {
        return res.status(403).json({ error: 'No tienes autorización para modificar otro perfil.' });
      }
      targetId = u.id_socio;
    }

    if (!targetId) {
      return res.status(400).json({ error: 'No se especificó el ID del socio a actualizar.' });
    }

    const {
      nombre,
      apellido,
      telefono,
      email,
      dni,
      contrasena_actual,
      nueva_contrasena,
      contrasena,
      password
    } = req.body;

    const { data: socioActual, error: errFetch } = await db
      .from('socio')
      .select('*')
      .eq('id_socio', targetId)
      .maybeSingle();

    if (errFetch || !socioActual) {
      return res.status(404).json({ error: 'Socio no encontrado o sin permisos.' });
    }

    // Cambio de contraseña vía Supabase Auth
    const newPass = (nueva_contrasena || contrasena || password || '').toString().trim();
    if (newPass) {
      if (newPass.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      }

      if (u.rol === 'socio') {
        if (!contrasena_actual) {
          return res.status(400).json({ error: 'Debes ingresar tu contraseña actual para confirmar el cambio.' });
        }
        const { error: verifyErr } = await supabaseAnon.auth.signInWithPassword({
          email: u.email,
          password: contrasena_actual
        });
        if (verifyErr) {
          return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
        }
      }

      if (supabaseAdmin && socioActual.auth_user_id) {
        const { error: updPassErr } = await supabaseAdmin.auth.admin.updateUserById(socioActual.auth_user_id, {
          password: newPass
        });
        if (updPassErr) {
          return res.status(500).json({ error: 'Error al actualizar contraseña: ' + updPassErr.message });
        }
      } else {
        const { error: updPassErr } = await db.auth.updateUser({ password: newPass });
        if (updPassErr) {
          return res.status(500).json({ error: 'Error al actualizar contraseña: ' + updPassErr.message });
        }
      }
    }

    const updateCampos = {};
    if (nombre !== undefined && String(nombre).trim()) updateCampos.nombre = String(nombre).trim();
    if (apellido !== undefined) updateCampos.apellido = String(apellido).trim();
    if (telefono !== undefined) updateCampos.telefono = telefono ? String(telefono).trim() : null;
    if (dni !== undefined && String(dni).trim()) updateCampos.dni = String(dni).trim();
    if (email !== undefined) {
      const cleanEmail = email ? String(email).trim().toLowerCase() : null;
      if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ error: 'El email ingresado no es válido.' });
      }
      updateCampos.email = cleanEmail;
      if (cleanEmail && cleanEmail !== String(socioActual.email || '').toLowerCase() && socioActual.auth_user_id && supabaseAdmin) {
        await supabaseAdmin.auth.admin.updateUserById(socioActual.auth_user_id, {
          email: cleanEmail,
          email_confirm: true
        });
      }
    }

    let socioActualizado = socioActual;
    if (Object.keys(updateCampos).length > 0) {
      const { data, error: errUpdate } = await db
        .from('socio')
        .update(updateCampos)
        .eq('id_socio', targetId)
        .select('id_socio, auth_user_id, dni, telefono, fecha_alta, estado, nombre, apellido, email')
        .single();

      if (errUpdate) {
        return res.status(400).json({ error: 'Error al actualizar el perfil: ' + errUpdate.message });
      }
      socioActualizado = data;
    }

    return res.status(200).json({
      mensaje: 'Perfil actualizado exitosamente.',
      socio: {
        ...socioActualizado,
        estado_bool: socioActualizado.estado,
        estado: socioActualizado.estado ? 'activo' : 'inactivo'
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al actualizar perfil: ' + error.message });
  }
};

module.exports = {
  getSocios,
  getSocioById,
  createSocio,
  updateSocio,
  changeEstadoSocio,
  deleteSocio,
  getPerfilSocio,
  updatePerfilSocio,
  verificarDniSocio
};
