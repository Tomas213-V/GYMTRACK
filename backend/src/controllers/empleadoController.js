// ==============================================================================
// CONTROLADOR DE EMPLEADOS Y ASIGNACIÓN A SUCURSALES (N:M)
// Tablas: public.empleado (con auth_user_id, estado, id_gimnasio de migración 01)
//         public.empleado_sucursal (rol, id_empleado, id_sucursal, estado)
//
// Seguridad:
// - Las cuentas de acceso se crean en Supabase Auth mediante supabaseAdmin
//   (invitación por email o alta controlada en backend), NUNCA guardando
//   contraseñas en public.empleado.
// - Solo el dueño del gimnasio puede crear, editar, asignar o desactivar empleados.
// ==============================================================================

const { supabaseAdmin } = require('../config/supabase');

const ROLES_EMPLEADO_VALIDOS = ['administrador', 'recepcionista', 'entrenador'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarAsignaciones(asignaciones) {
  if (!Array.isArray(asignaciones)) return [];
  const mapa = new Map();
  asignaciones.forEach((a) => {
    const idSuc = Number(a?.id_sucursal);
    const rol = String(a?.rol || '').trim().toLowerCase();
    if (Number.isInteger(idSuc) && idSuc > 0 && ROLES_EMPLEADO_VALIDOS.includes(rol)) {
      mapa.set(idSuc, { id_sucursal: idSuc, rol, estado: true });
    }
  });
  return Array.from(mapa.values());
}

/**
 * GET /api/empleados
 * Lista los empleados del gimnasio activo junto a sus sucursales asignadas.
 */
const getEmpleados = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { estado, search, id_sucursal } = req.query;

    let query = db
      .from('empleado')
      .select(`
        id_empleado,
        auth_user_id,
        id_gimnasio,
        nombre,
        apellido,
        dni,
        email,
        telefono,
        estado,
        fecha_creacion,
        empleado_sucursal (
          id_empleado_sucursal,
          rol,
          estado,
          id_sucursal,
          sucursal (
            id_sucursal,
            direccion,
            estado,
            id_gimnasio
          )
        )
      `)
      .eq('id_gimnasio', gymId)
      .order('id_empleado', { ascending: false });

    if (estado !== undefined && estado !== '' && estado !== 'todos') {
      const boolEst = estado === 'true' || estado === 'activo';
      query = query.eq('estado', boolEst);
    }

    if (search && String(search).trim()) {
      const s = String(search).trim();
      query = query.or(`nombre.ilike.%${s}%,apellido.ilike.%${s}%,dni.ilike.%${s}%,email.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Error al consultar empleados: ' + error.message });
    }

    let lista = (data || []).map((emp) => ({
      ...emp,
      asignaciones: (emp.empleado_sucursal || []).filter((es) => es.estado !== false)
    }));

    if (id_sucursal && id_sucursal !== 'todas') {
      const targetSuc = Number(id_sucursal);
      lista = lista.filter((emp) =>
        emp.asignaciones.some((a) => Number(a.id_sucursal) === targetSuc)
      );
    }

    return res.status(200).json({
      id_gimnasio: gymId,
      empleados: lista
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al consultar empleados: ' + error.message });
  }
};

/**
 * GET /api/empleados/:id
 */
const getEmpleadoById = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;

    const { data, error } = await db
      .from('empleado')
      .select(`
        id_empleado,
        auth_user_id,
        id_gimnasio,
        nombre,
        apellido,
        dni,
        email,
        telefono,
        estado,
        fecha_creacion,
        empleado_sucursal (
          id_empleado_sucursal,
          rol,
          estado,
          id_sucursal,
          sucursal (id_sucursal, direccion, estado)
        )
      `)
      .eq('id_empleado', id)
      .eq('id_gimnasio', gymId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al consultar empleado: ' + error.message });
    }
    if (!data) {
      return res.status(404).json({ error: 'Empleado no encontrado en el gimnasio activo.' });
    }

    return res.status(200).json({ empleado: data });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al consultar empleado: ' + error.message });
  }
};

/**
 * POST /api/empleados
 * Crea un empleado, provisiona su acceso en Supabase Auth (invitación o contraseña
 * temporal en Auth, nunca en tabla empleado) y registra sus asignaciones en empleado_sucursal.
 */
const createEmpleado = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const {
      nombre,
      apellido,
      dni,
      email,
      telefono,
      contrasena,
      password,
      enviar_invitacion = false,
      asignaciones = []
    } = req.body;

    if (!nombre || !String(nombre).trim() || !apellido || !String(apellido).trim()) {
      return res.status(400).json({ error: 'Nombre y apellido del empleado son obligatorios.' });
    }

    if (!email || !EMAIL_REGEX.test(String(email).trim().toLowerCase())) {
      return res.status(400).json({ error: 'Debes ingresar un correo electrónico válido para el empleado.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const asignacionesLimpias = normalizarAsignaciones(asignaciones);

    if (asignacionesLimpias.length === 0) {
      return res.status(400).json({
        error: `Debes asignar al menos una sucursal con un rol válido (${ROLES_EMPLEADO_VALIDOS.join(', ')}).`
      });
    }

    // Validar que todas las sucursales pertenezcan al gimnasio activo
    const sucursalIds = asignacionesLimpias.map((a) => a.id_sucursal);
    const { data: sucursalesValidas, error: errSuc } = await db
      .from('sucursal')
      .select('id_sucursal')
      .eq('id_gimnasio', gymId)
      .in('id_sucursal', sucursalIds);

    if (errSuc) {
      return res.status(500).json({ error: 'Error al validar sucursales: ' + errSuc.message });
    }

    if (!sucursalesValidas || sucursalesValidas.length !== sucursalIds.length) {
      return res.status(400).json({
        error: 'Una o más sucursales seleccionadas no existen o no pertenecen a este gimnasio.'
      });
    }

    // Provisionar cuenta en Supabase Auth (exclusivamente desde backend seguro con service_role)
    let authUserId = null;
    const passInput = (contrasena || password || '').trim();

    if (!supabaseAdmin) {
      return res.status(503).json({
        error:
          'El backend no tiene configurado SUPABASE_SERVICE_ROLE_KEY para crear o invitar cuentas de empleados en Supabase Auth.'
      });
    }

    if (enviar_invitacion || !passInput) {
      const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        cleanEmail,
        {
          data: {
            nombre: String(nombre).trim(),
            apellido: String(apellido).trim(),
            tipo_inicial: 'empleado',
            id_gimnasio: gymId
          }
        }
      );

      if (inviteErr) {
        return res.status(400).json({
          error: 'No se pudo enviar la invitación de Supabase Auth al empleado: ' + inviteErr.message
        });
      }
      authUserId = invited.user.id;
    } else {
      if (passInput.length < 6) {
        return res.status(400).json({ error: 'La contraseña inicial debe tener al menos 6 caracteres.' });
      }

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: passInput,
        email_confirm: true,
        user_metadata: {
          nombre: String(nombre).trim(),
          apellido: String(apellido).trim(),
          tipo_inicial: 'empleado',
          id_gimnasio: gymId
        }
      });

      if (createErr) {
        return res.status(400).json({
          error: 'No se pudo crear la cuenta del empleado en Supabase Auth: ' + createErr.message
        });
      }
      authUserId = created.user.id;
    }

    // Insertar empleado en public.empleado (respetando RLS del dueño)
    const { data: nuevoEmpleado, error: errEmp } = await db
      .from('empleado')
      .insert([
        {
          auth_user_id: authUserId,
          id_gimnasio: gymId,
          nombre: String(nombre).trim(),
          apellido: String(apellido).trim(),
          dni: dni ? String(dni).trim() : null,
          email: cleanEmail,
          telefono: telefono ? String(telefono).trim() : null,
          estado: true
        }
      ])
      .select('*')
      .single();

    if (errEmp) {
      // Rollback del usuario recién creado en Auth
      if (authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      }
      return res.status(400).json({ error: 'Error al registrar el empleado: ' + errEmp.message });
    }

    // Insertar asignaciones en empleado_sucursal
    const rowsAsignacion = asignacionesLimpias.map((a) => ({
      id_empleado: nuevoEmpleado.id_empleado,
      id_sucursal: a.id_sucursal,
      rol: a.rol,
      estado: true
    }));

    const { data: asignacionesCreadas, error: errAsig } = await db
      .from('empleado_sucursal')
      .insert(rowsAsignacion)
      .select(`
        id_empleado_sucursal,
        rol,
        estado,
        id_sucursal,
        sucursal (id_sucursal, direccion, estado)
      `);

    if (errAsig) {
      return res.status(500).json({
        error: 'Empleado creado, pero ocurrió un error al asignar sucursales: ' + errAsig.message
      });
    }

    return res.status(201).json({
      mensaje: enviar_invitacion || !passInput
        ? 'Empleado registrado e invitación enviada por correo electrónico.'
        : 'Empleado registrado exitosamente.',
      empleado: {
        ...nuevoEmpleado,
        empleado_sucursal: asignacionesCreadas || [],
        asignaciones: asignacionesCreadas || []
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al crear empleado: ' + error.message });
  }
};

/**
 * PUT /api/empleados/:id
 * Actualiza datos personales, estado y opcionalmente asignaciones a sucursales.
 */
const updateEmpleado = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;
    const { nombre, apellido, dni, email, telefono, estado, asignaciones } = req.body;

    const { data: empActual, error: fetchErr } = await db
      .from('empleado')
      .select('id_empleado, auth_user_id, email, id_gimnasio')
      .eq('id_empleado', id)
      .eq('id_gimnasio', gymId)
      .maybeSingle();

    if (fetchErr || !empActual) {
      return res.status(404).json({ error: 'Empleado no encontrado en el gimnasio activo.' });
    }

    const updateFields = {};
    if (nombre !== undefined && String(nombre).trim()) updateFields.nombre = String(nombre).trim();
    if (apellido !== undefined && String(apellido).trim()) updateFields.apellido = String(apellido).trim();
    if (dni !== undefined) updateFields.dni = dni ? String(dni).trim() : null;
    if (telefono !== undefined) updateFields.telefono = telefono ? String(telefono).trim() : null;
    if (estado !== undefined) {
      updateFields.estado = typeof estado === 'boolean' ? estado : String(estado).toLowerCase() === 'activo' || estado === 'true';
    }
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ error: 'El formato del email no es válido.' });
      }
      updateFields.email = cleanEmail;
      if (cleanEmail !== String(empActual.email || '').toLowerCase() && empActual.auth_user_id && supabaseAdmin) {
        const { error: authUpdErr } = await supabaseAdmin.auth.admin.updateUserById(empActual.auth_user_id, {
          email: cleanEmail,
          email_confirm: true
        });
        if (authUpdErr) {
          return res.status(400).json({ error: 'No se pudo actualizar el email en Supabase Auth: ' + authUpdErr.message });
        }
      }
    }

    if (Object.keys(updateFields).length > 0) {
      const { error: updErr } = await db
        .from('empleado')
        .update(updateFields)
        .eq('id_empleado', id)
        .eq('id_gimnasio', gymId);

      if (updErr) {
        return res.status(400).json({ error: 'Error al actualizar datos del empleado: ' + updErr.message });
      }
    }

    // Sincronizar asignaciones si se enviaron en el payload
    if (Array.isArray(asignaciones)) {
      const asignacionesLimpias = normalizarAsignaciones(asignaciones);
      if (asignacionesLimpias.length === 0) {
        return res.status(400).json({
          error: 'Debes mantener al menos una sucursal asignada con rol válido.'
        });
      }

      const sucursalIds = asignacionesLimpias.map((a) => a.id_sucursal);
      const { data: sucsValidas } = await db
        .from('sucursal')
        .select('id_sucursal')
        .eq('id_gimnasio', gymId)
        .in('id_sucursal', sucursalIds);

      if (!sucsValidas || sucsValidas.length !== sucursalIds.length) {
        return res.status(400).json({ error: 'Una o más sucursales no pertenecen a este gimnasio.' });
      }

      // Eliminar asignaciones anteriores y registrar las nuevas
      const { error: delAsigErr } = await db
        .from('empleado_sucursal')
        .delete()
        .eq('id_empleado', id);

      if (delAsigErr) {
        return res.status(500).json({ error: 'Error al actualizar asignaciones: ' + delAsigErr.message });
      }

      const { error: insAsigErr } = await db
        .from('empleado_sucursal')
        .insert(
          asignacionesLimpias.map((a) => ({
            id_empleado: Number(id),
            id_sucursal: a.id_sucursal,
            rol: a.rol,
            estado: true
          }))
        );

      if (insAsigErr) {
        return res.status(500).json({ error: 'Error al guardar nuevas asignaciones: ' + insAsigErr.message });
      }
    }

    // Devolver empleado actualizado completo
    const { data: completo } = await db
      .from('empleado')
      .select(`
        id_empleado,
        auth_user_id,
        id_gimnasio,
        nombre,
        apellido,
        dni,
        email,
        telefono,
        estado,
        fecha_creacion,
        empleado_sucursal (
          id_empleado_sucursal,
          rol,
          estado,
          id_sucursal,
          sucursal (id_sucursal, direccion, estado)
        )
      `)
      .eq('id_empleado', id)
      .single();

    return res.status(200).json({
      mensaje: 'Empleado actualizado correctamente.',
      empleado: {
        ...completo,
        asignaciones: (completo?.empleado_sucursal || []).filter((es) => es.estado !== false)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al actualizar empleado: ' + error.message });
  }
};

/**
 * PATCH /api/empleados/:id/estado
 * Activa o desactiva un empleado (baja lógica que bloquea su acceso y políticas RLS).
 */
const cambiarEstadoEmpleado = async (req, res) => {
  try {
    const db = req.supabase;
    const gymId = req.gimnasioId;
    const { id } = req.params;
    const { estado } = req.body;

    if (estado === undefined) {
      return res.status(400).json({ error: 'Debes especificar el estado (true/false).' });
    }

    const nuevoEstado = typeof estado === 'boolean' ? estado : String(estado).toLowerCase() === 'activo' || estado === 'true';

    const { data, error } = await db
      .from('empleado')
      .update({ estado: nuevoEstado })
      .eq('id_empleado', id)
      .eq('id_gimnasio', gymId)
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al cambiar el estado del empleado: ' + error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Empleado no encontrado en el gimnasio activo.' });
    }

    return res.status(200).json({
      mensaje: `Empleado ${nuevoEstado ? 'activado' : 'desactivado'} correctamente.`,
      empleado: data
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al cambiar estado del empleado: ' + error.message });
  }
};

module.exports = {
  getEmpleados,
  getEmpleadoById,
  createEmpleado,
  updateEmpleado,
  cambiarEstadoEmpleado,
  ROLES_EMPLEADO_VALIDOS
};
