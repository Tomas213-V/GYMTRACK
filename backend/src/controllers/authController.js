// ==============================================================================
// CONTROLADOR DE AUTENTICACIÓN — SUPABASE AUTH (DUEÑO / EMPLEADO / SOCIO)
// ==============================================================================
// - Las contraseñas se gestionan exclusivamente en Supabase Auth (auth.users).
// - Ninguna tabla de perfiles almacena contraseñas.
// - Los perfiles (dueno, socio, empleado) se vinculan mediante auth_user_id.
// ==============================================================================

const {
  supabaseAnon,
  supabaseAdmin,
  createSupabaseClientForToken
} = require('../config/supabase');
const { resolverContextoUsuario } = require('../middlewares/authMiddleware');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register
 * Registra un nuevo dueño en Supabase Auth + tabla public.dueno (y opcionalmente gimnasio + sucursal).
 */
const registerOwner = async (req, res) => {
  try {
    const {
      nombreGimnasio,
      direccion,
      telefono,
      emailGimnasio,
      nombre,
      apellido,
      email,
      contrasena,
      password
    } = req.body;

    const passInput = contrasena || password;
    if (!nombre || !apellido || !email || !passInput) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato del email ingresado no es válido.' });
    }

    if (String(passInput).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    let authUser = null;
    let session = null;

    if (supabaseAdmin) {
      // Crear usuario confirmado desde backend seguro (service_role nunca sale del servidor)
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: passInput,
        email_confirm: true,
        user_metadata: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          tipo_inicial: 'dueno'
        }
      });

      if (createErr) {
        const msg = createErr.message?.toLowerCase().includes('already')
          ? 'El email ingresado ya está registrado.'
          : 'Error al crear la cuenta en Supabase Auth: ' + createErr.message;
        return res.status(400).json({ error: msg });
      }
      authUser = created.user;

      const { data: loginData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
        email: cleanEmail,
        password: passInput
      });
      if (!signInErr && loginData?.session) {
        session = loginData.session;
      }
    } else {
      // Sin service_role: usar signUp estándar de Supabase Auth
      const { data: signUpData, error: signUpErr } = await supabaseAnon.auth.signUp({
        email: cleanEmail,
        password: passInput,
        options: {
          data: {
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            tipo_inicial: 'dueno'
          }
        }
      });

      if (signUpErr) {
        return res.status(400).json({ error: 'Error al registrar cuenta: ' + signUpErr.message });
      }

      authUser = signUpData.user;
      session = signUpData.session;
    }

    if (!authUser) {
      return res.status(500).json({ error: 'No se pudo inicializar el usuario en Supabase Auth.' });
    }

    // Cliente para insertar perfil (con JWT del usuario si hay sesión, o admin si requiere confirmación)
    const dbClient = session?.access_token
      ? createSupabaseClientForToken(session.access_token)
      : supabaseAdmin;

    if (!dbClient) {
      return res.status(202).json({
        requiere_confirmacion_email: true,
        mensaje:
          'Cuenta creada en Supabase Auth. Confirmá tu correo electrónico antes de iniciar sesión (o configurá SUPABASE_SERVICE_ROLE_KEY en el backend).'
      });
    }

    const { data: nuevoDueno, error: errDueno } = await dbClient
      .from('dueno')
      .insert([
        {
          auth_user_id: authUser.id,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: cleanEmail
        }
      ])
      .select('id_dueno, auth_user_id, nombre, apellido, email, fecha_creacion')
      .single();

    if (errDueno) {
      // Rollback del usuario Auth si falló crear el perfil
      if (supabaseAdmin) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
      }
      return res.status(500).json({ error: 'Error al crear perfil de dueño: ' + errDueno.message });
    }

    let nuevoGimnasio = null;
    let nuevaSucursal = null;

    if (nombreGimnasio && nombreGimnasio.trim()) {
      const { data: gymData, error: errGym } = await dbClient
        .from('gimnasio')
        .insert([
          {
            nombre: nombreGimnasio.trim(),
            telefono: telefono ? telefono.trim() : null,
            email: emailGimnasio ? emailGimnasio.trim().toLowerCase() : cleanEmail,
            estado: true,
            id_dueno: nuevoDueno.id_dueno
          }
        ])
        .select('*')
        .single();

      if (errGym) {
        return res.status(500).json({ error: 'Error al registrar el gimnasio: ' + errGym.message });
      }
      nuevoGimnasio = gymData;

      // Si se proporcionó dirección, crear la primera sucursal del gimnasio
      if (direccion && direccion.trim()) {
        const { data: sucData } = await dbClient
          .from('sucursal')
          .insert([
            {
              direccion: direccion.trim(),
              telefono: telefono ? telefono.trim() : null,
              descripcion: 'Sucursal principal',
              estado: true,
              id_gimnasio: nuevoGimnasio.id_gimnasio
            }
          ])
          .select('*')
          .single();
        nuevaSucursal = sucData || null;
      }
    }

    return res.status(201).json({
      mensaje: nuevoGimnasio
        ? 'Dueño y Gimnasio registrados exitosamente.'
        : 'Cuenta de dueño registrada exitosamente.',
      token: session?.access_token || null,
      refresh_token: session?.refresh_token || null,
      usuario: {
        ...nuevoDueno,
        rol: 'dueño',
        gimnasio: nuevoGimnasio,
        gimnasios: nuevoGimnasio ? [nuevoGimnasio] : []
      },
      gimnasio: nuevoGimnasio,
      sucursal: nuevaSucursal
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * POST /api/auth/register-socio
 * Permite el auto-registro de una cuenta única de socio en GymTrack (multigimnasio).
 */
const registerSocio = async (req, res) => {
  try {
    const { nombre, apellido, email, dni, telefono, contrasena, password } = req.body;
    const passInput = contrasena || password;

    if (!nombre || !apellido || !email || !passInput) {
      return res.status(400).json({ error: 'Nombre, apellido, email y contraseña son obligatorios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato del email ingresado no es válido.' });
    }

    if (String(passInput).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    let authUser = null;
    let session = null;

    if (supabaseAdmin) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: passInput,
        email_confirm: true,
        user_metadata: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          tipo_inicial: 'socio'
        }
      });

      if (createErr) {
        return res.status(400).json({ error: 'Error al registrar socio en Auth: ' + createErr.message });
      }
      authUser = created.user;

      const { data: loginData } = await supabaseAnon.auth.signInWithPassword({
        email: cleanEmail,
        password: passInput
      });
      session = loginData?.session || null;
    } else {
      const { data: signUpData, error: signUpErr } = await supabaseAnon.auth.signUp({
        email: cleanEmail,
        password: passInput
      });
      if (signUpErr) {
        return res.status(400).json({ error: 'Error al registrar socio: ' + signUpErr.message });
      }
      authUser = signUpData.user;
      session = signUpData.session;
    }

    const dbClient = session?.access_token
      ? createSupabaseClientForToken(session.access_token)
      : supabaseAdmin;

    if (!dbClient) {
      return res.status(202).json({
        requiere_confirmacion_email: true,
        mensaje: 'Cuenta creada. Confirmá tu email antes de iniciar sesión.'
      });
    }

    const { data: nuevoSocio, error: errSocio } = await dbClient
      .from('socio')
      .insert([
        {
          auth_user_id: authUser.id,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: cleanEmail,
          dni: dni ? String(dni).trim() : null,
          telefono: telefono ? String(telefono).trim() : null,
          estado: true
        }
      ])
      .select('id_socio, auth_user_id, nombre, apellido, email, dni, telefono, fecha_alta, estado')
      .single();

    if (errSocio) {
      if (supabaseAdmin) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
      }
      return res.status(400).json({ error: 'No se pudo crear el perfil de socio: ' + errSocio.message });
    }

    return res.status(201).json({
      mensaje: 'Cuenta de socio registrada exitosamente.',
      token: session?.access_token || null,
      refresh_token: session?.refresh_token || null,
      socio: { ...nuevoSocio, rol: 'socio', gimnasios: [] },
      usuario: { ...nuevoSocio, rol: 'socio', gimnasios: [] },
      gimnasios: []
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al registrar socio: ' + error.message });
  }
};

/**
 * POST /api/auth/login
 * Inicio de sesión con Supabase Auth para Dueño o Empleado.
 */
const login = async (req, res) => {
  try {
    const { email, contrasena, password } = req.body;
    const passwordInput = contrasena || password;

    if (!email || !passwordInput) {
      return res.status(400).json({
        error: 'Por favor, proporciona tanto el email como la contraseña.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato del email ingresado no es válido.' });
    }

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: cleanEmail,
      password: passwordInput
    });

    if (authError || !authData?.session || !authData?.user) {
      return res.status(401).json({
        error: 'Credenciales inválidas. Verificá tu email y contraseña.'
      });
    }

    const userClient = createSupabaseClientForToken(authData.session.access_token);
    const contexto = await resolverContextoUsuario(userClient, authData.user);

    if (!contexto.dueno && !contexto.empleado) {
      if (contexto.socio) {
        return res.status(403).json({
          error: 'Esta cuenta corresponde a un Socio. Ingresá desde el Portal del Socio.'
        });
      }
      return res.status(403).json({
        error: 'No se encontró un perfil de Dueño o Empleado asociado a esta cuenta.'
      });
    }

    if (contexto.rol === 'empleado' && contexto.empleado?.estado === false) {
      return res.status(403).json({
        error: 'Tu cuenta de empleado se encuentra desactivada. Contactá al dueño del gimnasio.'
      });
    }

    const perfilBase = contexto.rol === 'dueño' ? contexto.dueno : contexto.empleado;

    const usuarioSeguro = {
      ...perfilBase,
      auth_user_id: authData.user.id,
      rol: contexto.rol,
      roles_empleado: contexto.roles_empleado,
      permisos: contexto.permisos,
      sucursales_asignadas: contexto.sucursales_asignadas,
      gimnasio: contexto.gimnasio,
      gimnasios: contexto.gimnasios,
      id_gimnasio: contexto.id_gimnasio
    };

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at: authData.session.expires_at,
      usuario: usuarioSeguro,
      gimnasios: contexto.gimnasios,
      sucursales_asignadas: contexto.sucursales_asignadas
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error interno al procesar el inicio de sesión: ' + error.message
    });
  }
};

/**
 * POST /api/auth/login-socio
 * Inicio de sesión con Supabase Auth para Socios (cuenta única multigimnasio).
 */
const loginSocio = async (req, res) => {
  try {
    const { email, dni, contrasena, password } = req.body;
    const passwordInput = contrasena || password;

    if (!email || !passwordInput) {
      return res.status(400).json({
        error: 'El correo electrónico y la contraseña son obligatorios.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato del email ingresado no es válido.' });
    }

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: cleanEmail,
      password: passwordInput
    });

    if (authError || !authData?.session || !authData?.user) {
      return res.status(401).json({
        error: 'Credenciales inválidas. Verificá tu correo electrónico y contraseña.'
      });
    }

    const userClient = createSupabaseClientForToken(authData.session.access_token);
    const contexto = await resolverContextoUsuario(userClient, authData.user, null, 'socio');

    if (!contexto.socio) {
      return res.status(403).json({
        error: 'No se encontró un perfil de socio vinculado a esta cuenta.'
      });
    }

    if (contexto.socio.estado === false) {
      return res.status(403).json({
        error: 'Tu cuenta de socio se encuentra inactiva. Comunicate con la administración.'
      });
    }

    // Validación opcional de DNI si el formulario lo envió
    if (dni && String(dni).trim()) {
      const dniClean = String(dni).replace(/[\.\s-]/g, '').trim();
      const dniSocioClean = String(contexto.socio.dni || '').replace(/[\.\s-]/g, '').trim();
      if (dniSocioClean && dniClean !== dniSocioClean) {
        return res.status(401).json({
          error: 'El DNI ingresado no coincide con el registrado en tu cuenta.'
        });
      }
    }

    const socioSeguro = {
      ...contexto.socio,
      auth_user_id: authData.user.id,
      rol: 'socio',
      gimnasio: contexto.gimnasio,
      gimnasios: contexto.gimnasios,
      id_gimnasio: contexto.id_gimnasio
    };

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at: authData.session.expires_at,
      usuario: socioSeguro,
      socio: socioSeguro,
      gimnasios: contexto.gimnasios
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error interno al procesar el inicio de sesión del socio: ' + error.message
    });
  }
};

/**
 * POST /api/auth/refresh
 * Refresca el access_token utilizando el refresh_token de Supabase Auth.
 */
const refreshSession = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'Se requiere refresh_token.' });
    }

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token });
    if (error || !data?.session) {
      return res.status(401).json({ error: 'No se pudo renovar la sesión. Iniciá sesión nuevamente.' });
    }

    return res.status(200).json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al refrescar sesión: ' + error.message });
  }
};

/**
 * GET /api/auth/me
 * Devuelve el perfil completo, rol, gimnasios disponibles y sucursales del usuario autenticado.
 */
const getMe = async (req, res) => {
  try {
    const u = req.usuario;
    const db = req.supabase;

    if (u.rol === 'socio' && u.socio) {
      const { data: membresias } = await db
        .from('membresia_socio')
        .select(`
          id_membresia_socio,
          id_gimnasio,
          id_membresia_gimnasio,
          precio,
          duracion_dias_contratados,
          limite_asistencias_semanales,
          limite_asistencias_totales,
          fecha_inicio,
          fecha_vencimiento,
          estado,
          gimnasio:id_gimnasio (id_gimnasio, nombre, telefono, email, estado),
          membresia_gimnasio (id_membresia_gimnasio, nombre, descripcion)
        `)
        .eq('id_socio', u.id_socio)
        .order('fecha_vencimiento', { ascending: false });

      return res.status(200).json({
        usuario: {
          ...u.socio,
          rol: 'socio',
          gimnasio: u.gimnasio,
          gimnasios: u.gimnasios,
          id_gimnasio: u.id_gimnasio
        },
        gimnasios: u.gimnasios,
        membresias: membresias || []
      });
    }

    if (u.rol === 'empleado' && u.empleado) {
      return res.status(200).json({
        usuario: {
          ...u.empleado,
          rol: 'empleado',
          roles_empleado: u.roles_empleado,
          permisos: u.permisos,
          sucursales_asignadas: u.sucursales_asignadas,
          gimnasio: u.gimnasio,
          gimnasios: u.gimnasios,
          id_gimnasio: u.id_gimnasio
        },
        gimnasios: u.gimnasios,
        sucursales_asignadas: u.sucursales_asignadas
      });
    }

    // Dueño
    let estadisticas = null;
    if (u.id_gimnasio) {
      const [membRes, sucRes] = await Promise.all([
        db
          .from('membresia_socio')
          .select('id_socio, estado')
          .eq('id_gimnasio', u.id_gimnasio),
        db
          .from('sucursal')
          .select('id_sucursal, estado')
          .eq('id_gimnasio', u.id_gimnasio)
      ]);

      const sociosUnicos = new Set((membRes.data || []).map((m) => m.id_socio));
      const sociosActivos = new Set(
        (membRes.data || []).filter((m) => m.estado === 'activa').map((m) => m.id_socio)
      );

      estadisticas = {
        totalSocios: sociosUnicos.size,
        sociosActivos: sociosActivos.size,
        totalSucursales: (sucRes.data || []).length,
        sucursalesActivas: (sucRes.data || []).filter((s) => s.estado).length
      };
    }

    return res.status(200).json({
      usuario: {
        ...u.dueno,
        rol: 'dueño',
        permisos: u.permisos,
        gimnasio: u.gimnasio,
        gimnasios: u.gimnasios,
        id_gimnasio: u.id_gimnasio,
        estadisticas
      },
      gimnasios: u.gimnasios
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener datos del perfil: ' + error.message });
  }
};

/**
 * PUT /api/auth/me | PUT /api/auth/perfil
 * Actualiza datos personales del dueño en public.dueno y credenciales en Supabase Auth.
 */
const updateOwnerProfile = async (req, res) => {
  try {
    const u = req.usuario;
    const db = req.supabase;

    if (u.rol !== 'dueño' || !u.id_dueno) {
      return res.status(403).json({ error: 'Solo el dueño puede actualizar este perfil.' });
    }

    const { nombre, apellido, email, contrasena_actual, nueva_contrasena } = req.body;
    const updateFields = {};

    if (nombre !== undefined) {
      if (!String(nombre).trim()) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
      }
      updateFields.nombre = String(nombre).trim();
    }

    if (apellido !== undefined) {
      if (!String(apellido).trim()) {
        return res.status(400).json({ error: 'El apellido es obligatorio.' });
      }
      updateFields.apellido = String(apellido).trim();
    }

    let emailCambio = null;
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ error: 'El formato del email no es válido.' });
      }
      if (cleanEmail !== String(u.dueno.email || '').toLowerCase()) {
        emailCambio = cleanEmail;
        updateFields.email = cleanEmail;
      }
    }

    // Cambio de contraseña mediante Supabase Auth (validando contraseña actual)
    let nuevoToken = null;
    let nuevoRefreshToken = null;

    if (nueva_contrasena && String(nueva_contrasena).trim()) {
      const passLimpia = String(nueva_contrasena).trim();
      if (passLimpia.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      }
      if (!contrasena_actual) {
        return res.status(400).json({ error: 'Debes ingresar tu contraseña actual para confirmar el cambio.' });
      }

      const { error: checkErr } = await supabaseAnon.auth.signInWithPassword({
        email: u.email,
        password: contrasena_actual
      });

      if (checkErr) {
        return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
      }

      if (supabaseAdmin) {
        const { error: updPassErr } = await supabaseAdmin.auth.admin.updateUserById(u.auth_user_id, {
          password: passLimpia
        });
        if (updPassErr) {
          return res.status(500).json({ error: 'Error al actualizar contraseña en Auth: ' + updPassErr.message });
        }
      } else {
        const { error: updPassErr } = await db.auth.updateUser({ password: passLimpia });
        if (updPassErr) {
          return res.status(500).json({ error: 'Error al actualizar contraseña en Auth: ' + updPassErr.message });
        }
      }

      // Renovar sesión con nueva contraseña
      const { data: reAuth } = await supabaseAnon.auth.signInWithPassword({
        email: emailCambio || u.email,
        password: passLimpia
      });
      if (reAuth?.session) {
        nuevoToken = reAuth.session.access_token;
        nuevoRefreshToken = reAuth.session.refresh_token;
      }
    }

    if (emailCambio) {
      if (supabaseAdmin) {
        const { error: updEmailErr } = await supabaseAdmin.auth.admin.updateUserById(u.auth_user_id, {
          email: emailCambio,
          email_confirm: true
        });
        if (updEmailErr) {
          return res.status(400).json({ error: 'No se pudo actualizar el email en Auth: ' + updEmailErr.message });
        }
      } else {
        const { error: updEmailErr } = await db.auth.updateUser({ email: emailCambio });
        if (updEmailErr) {
          return res.status(400).json({ error: 'No se pudo actualizar el email: ' + updEmailErr.message });
        }
      }
    }

    let updatedDueno = u.dueno;
    if (Object.keys(updateFields).length > 0) {
      const { data, error: errUpdate } = await db
        .from('dueno')
        .update(updateFields)
        .eq('id_dueno', u.id_dueno)
        .select('id_dueno, auth_user_id, nombre, apellido, email, fecha_creacion')
        .single();

      if (errUpdate) {
        return res.status(500).json({ error: 'Error al actualizar perfil: ' + errUpdate.message });
      }
      updatedDueno = data;
    }

    return res.status(200).json({
      mensaje: 'Perfil actualizado exitosamente.',
      usuario: {
        ...updatedDueno,
        rol: 'dueño',
        gimnasio: u.gimnasio,
        gimnasios: u.gimnasios,
        id_gimnasio: u.id_gimnasio
      },
      ...(nuevoToken ? { token: nuevoToken, refresh_token: nuevoRefreshToken } : {})
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

module.exports = {
  registerOwner,
  registerSocio,
  login,
  loginSocio,
  refreshSession,
  getMe,
  updateOwnerProfile
};
