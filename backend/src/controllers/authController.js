
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// Expresión regular para validar formato de correo electrónico
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * TAREA: REGISTRO DE GIMNASIO Y DUEÑO
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
      contrasena 
    } = req.body;

    // 1. Criterio de Aceptación: Validar datos obligatorios
    if (!nombreGimnasio || !nombre || !apellido || !email || !contrasena) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato del email ingresado no es válido.' });
    }

    // 2. Criterio de Aceptación: No permitir registrar usuarios con un email que ya exista
    const { data: usuarioExistente } = await supabase
      .from('usuario')
      .select('id_usuario')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (usuarioExistente) {
      return res.status(400).json({ error: 'El email ingresado ya está registrado.' });
    }

    // 3. Crear el Gimnasio en la base de datos
    const { data: nuevoGimnasio, error: errorGym } = await supabase
      .from('gimnasio')
      .insert([
        {
          nombre: nombreGimnasio.trim(),
          direccion: direccion ? direccion.trim() : null,
          telefono: telefono ? telefono.trim() : null,
          email: emailGimnasio ? emailGimnasio.trim().toLowerCase() : cleanEmail,
          fecha_registro: new Date().toISOString(),
          estado: 'activo'
        }
      ])
      .select()
      .single();

    if (errorGym) {
      return res.status(500).json({ error: 'Error al registrar el gimnasio: ' + errorGym.message });
    }

    // 4. Criterio de Aceptación: Encriptación / Hash de contraseña con bcrypt
    const saltRounds = 10;
    const contrasenaHash = await bcrypt.hash(contrasena, saltRounds);

    // 5. Crea usuario asociado al gimnasio
    const { data: nuevoUsuario, error: errorUser } = await supabase
      .from('usuario')
      .insert([
        {
          id_gimnasio: nuevoGimnasio.id_gimnasio,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: cleanEmail,
          contrasena: contrasenaHash,
          rol: 'dueño',
          estado: 'activo',
          fecha_creacion: new Date().toISOString()
        }
      ])
      .select('id_usuario, id_gimnasio, nombre, apellido, email, rol, estado, fecha_creacion')
      .single();

    if (errorUser) {
      return res.status(500).json({ error: 'Error al registrar el dueño: ' + errorUser.message });
    }

    // 6. Generar Token JWT para iniciar sesión automáticamente tras el registro
    const jwtSecret = process.env.JWT_SECRET || 'gymtrack_jwt_secret_key_2026';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const token = jwt.sign(
      {
        id_usuario: nuevoUsuario.id_usuario,
        id_gimnasio: nuevoUsuario.id_gimnasio,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol
      },
      jwtSecret,
      { expiresIn }
    );

    // 7. Respuesta exitosa para el frontend (sin exponer el hash)
    return res.status(201).json({
      mensaje: 'Dueño y Gimnasio registrados exitosamente.',
      token,
      gimnasio: nuevoGimnasio,
      usuario: nuevoUsuario
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * TAREA: INICIO DE SESIÓN (LOGIN)
 * Valida credenciales, comprueba contraseña con bcrypt y genera token JWT
 */
const login = async (req, res) => {
  try {
    const { email, contrasena, password } = req.body;
    const passwordInput = contrasena || password;

    // 1. Criterio de Aceptación: Validar campos obligatorios
    if (!email || !passwordInput) {
      return res.status(400).json({ 
        error: 'Por favor, proporciona tanto el email como la contraseña.' 
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ 
        error: 'El formato del email ingresado no es válido.' 
      });
    }

    // 2. Buscar al usuario en la base de datos por email junto con los datos de su gimnasio
    let usuario = null;

    // Intento 1: Consulta directa con relacionamiento a gimnasio
    const { data: usuarioConGimnasio, error: errorUsuario } = await supabase
      .from('usuario')
      .select(`
        id_usuario,
        id_gimnasio,
        nombre,
        apellido,
        email,
        contrasena,
        rol,
        estado,
        fecha_creacion,
        gimnasio (
          id_gimnasio,
          nombre,
          direccion,
          telefono,
          estado
        )
      `)
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (errorUsuario) {
      // Fallback: Si el join falla por nombre de relación o FK, consultar usuario por separado
      const { data: usuarioSimple, error: errorSimple } = await supabase
        .from('usuario')
        .select(`
          id_usuario,
          id_gimnasio,
          nombre,
          apellido,
          email,
          contrasena,
          rol,
          estado,
          fecha_creacion
        `)
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (errorSimple) {
        return res.status(500).json({ 
          error: 'Error al consultar la base de datos: ' + errorSimple.message 
        });
      }

      if (usuarioSimple) {
        usuario = usuarioSimple;
        if (usuario.id_gimnasio) {
          const { data: gym } = await supabase
            .from('gimnasio')
            .select('id_gimnasio, nombre, direccion, telefono, estado')
            .eq('id_gimnasio', usuario.id_gimnasio)
            .maybeSingle();
          usuario.gimnasio = gym || null;
        }
      }
    } else {
      usuario = usuarioConGimnasio;
    }

    // 3. Criterio de Aceptación: Si el usuario no existe, rechazar con mensaje seguro
    if (!usuario) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas. Verifica tu email y contraseña.' 
      });
    }

    // 4. Criterio de Aceptación: Verificar estado de la cuenta
    if (usuario.estado !== 'activo') {
      return res.status(403).json({ 
        error: 'Tu cuenta se encuentra inactiva o suspendida. Por favor, contacta al administrador.' 
      });
    }

    // 5. Criterio de Aceptación: Comparar contraseña con el hash almacenado usando bcrypt
    const passwordValida = await bcrypt.compare(passwordInput, usuario.contrasena);

    if (!passwordValida) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas. Verifica tu email y contraseña.' 
      });
    }

    // 6. Criterio de Aceptación: Generar token de autenticación JWT
    const jwtSecret = process.env.JWT_SECRET || 'gymtrack_jwt_secret_key_2026';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const tokenPayload = {
      id_usuario: usuario.id_usuario,
      id_gimnasio: usuario.id_gimnasio,
      email: usuario.email,
      rol: usuario.rol
    };

    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn });

    // 7. Respuesta exitosa con información del usuario (sin exponer contraseña) y token
    const usuarioSeguro = {
      id_usuario: usuario.id_usuario,
      id_gimnasio: usuario.id_gimnasio,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      rol: usuario.rol,
      estado: usuario.estado,
      fecha_creacion: usuario.fecha_creacion,
      gimnasio: usuario.gimnasio || null
    };

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: usuarioSeguro
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Error interno del servidor al procesar el inicio de sesión: ' + error.message 
    });
  }
};

/**
 * CONTROLADOR: OBTENER PERFIL DEL USUARIO AUTENTICADO
 * Permite al frontend validar el token y recuperar los datos del usuario actual
 */
const getMe = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id_usuario;

    if (!idUsuario) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    let usuario = null;

    const { data: usuarioConGimnasio, error: errorConGimnasio } = await supabase
      .from('usuario')
      .select(`
        id_usuario,
        id_gimnasio,
        nombre,
        apellido,
        email,
        rol,
        estado,
        fecha_creacion,
        gimnasio (
          id_gimnasio,
          nombre,
          direccion,
          telefono,
          estado
        )
      `)
      .eq('id_usuario', idUsuario)
      .maybeSingle();

    if (errorConGimnasio) {
      const { data: usuarioSimple, error: errorSimple } = await supabase
        .from('usuario')
        .select(`
          id_usuario,
          id_gimnasio,
          nombre,
          apellido,
          email,
          rol,
          estado,
          fecha_creacion
        `)
        .eq('id_usuario', idUsuario)
        .maybeSingle();

      if (errorSimple || !usuarioSimple) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      usuario = usuarioSimple;

      if (usuario.id_gimnasio) {
        const { data: gym } = await supabase
          .from('gimnasio')
          .select('id_gimnasio, nombre, direccion, telefono, estado')
          .eq('id_gimnasio', usuario.id_gimnasio)
          .maybeSingle();
        usuario.gimnasio = gym || null;
      }
    } else {
      usuario = usuarioConGimnasio;
    }

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    return res.status(200).json({
      usuario
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener datos del perfil: ' + error.message });
  }
};

module.exports = {
  registerOwner,
  login,
  getMe
};