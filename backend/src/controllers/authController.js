
const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');

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

    // 2. Criterio de Aceptación: No permitir registrar usuarios con un email que ya exista
    const { data: usuarioExistente } = await supabase
      .from('usuario')
      .select('id_usuario')
      .eq('email', email)
      .maybeSingle();

    if (usuarioExistente) {
      return res.status(400).json({ error: 'El email ingresado ya está registrado.' });
    }

    // 3. Crear el Gimnasio en la base de datos
    const { data: nuevoGimnasio, error: errorGym } = await supabase
      .from('gimnasio')
      .insert([
        {
          nombre: nombreGimnasio,
          direccion: direccion || null,
          telefono: telefono || null,
          email: emailGimnasio || email,
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

    // 5. Crea usuario asoc
    const { data: nuevoUsuario, error: errorUser } = await supabase
      .from('usuario')
      .insert([
        {
          id_gimnasio: nuevoGimnasio.id_gimnasio,
          nombre,
          apellido,
          email,
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

    // 6. Respuesta exitosa para el frontend (sin exponer el hash)
    return res.status(201).json({
      mensaje: 'Dueño y Gimnasio registrados exitosamente.',
      gimnasio: nuevoGimnasio,
      usuario: nuevoUsuario
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * PLACEHOLDER PARA LOGIN (Le corresponde a tu compañero)
 */
const login = async (req, res) => {
  return res.status(501).json({ mensaje: 'Endpoint de login en desarrollo por el compañero.' });
};

module.exports = {
  registerOwner,
  login
};