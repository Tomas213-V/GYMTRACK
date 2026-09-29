const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');

/**
 * Obtener el socio desde el token JWT (id_socio directo o mediante id_usuario)
 */
const getSocioAuth = async (req) => {
  let idSocio = req.usuario?.id_socio;

  if (!idSocio && req.usuario?.id_usuario) {
    const { data: socioData } = await supabase
      .from('socio')
      .select('id_socio')
      .eq('id_usuario', req.usuario.id_usuario)
      .maybeSingle();

    if (socioData) {
      idSocio = socioData.id_socio;
    }
  }

  return idSocio;
};

/**
 * GET /api/socio/perfil
 * Obtener la información del perfil del socio autenticado
 */
const getPerfilSocio = async (req, res) => {
  try {
    const idSocio = await getSocioAuth(req);

    if (!idSocio) {
      return res.status(401).json({ error: 'Usuario no autenticado como socio.' });
    }

    const { data: socio, error } = await supabase
      .from('socio')
      .select(`
        id_socio,
        id_gimnasio,
        nombre,
        apellido,
        dni,
        telefono,
        email,
        fecha_alta,
        estado,
        gimnasio (
          nombre,
          direccion,
          telefono
        )
      `)
      .eq('id_socio', idSocio)
      .single();

    if (error || !socio) {
      return res.status(404).json({ error: 'No se encontró el perfil del socio.' });
    }

    return res.status(200).json({ perfil: socio });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * PUT /api/socio/perfil
 * Actualizar los datos del perfil del socio autenticado
 */
const updatePerfilSocio = async (req, res) => {
  try {
    const idSocio = await getSocioAuth(req);

    if (!idSocio) {
      return res.status(401).json({ error: 'Usuario no autenticado como socio.' });
    }

    const { nombre, apellido, telefono, email, contrasena, password } = req.body;

    // 1. Validaciones básicas de entrada
    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
    }

    if (email !== undefined && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
      }
    }

    // 2. Armar el objeto con los campos permitidos
    const camposActualizar = {};

    if (nombre !== undefined) camposActualizar.nombre = nombre.trim();
    if (apellido !== undefined) camposActualizar.apellido = apellido ? apellido.trim() : '';
    if (telefono !== undefined) camposActualizar.telefono = telefono ? telefono.trim() : null;
    if (email !== undefined) camposActualizar.email = email ? email.trim().toLowerCase() : null;

    // Encriptar la contraseña si se solicita cambio
    const rawPass = (contrasena || password)?.toString().trim();
    if (rawPass) {
      if (rawPass.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      camposActualizar.contrasena = await bcrypt.hash(rawPass, 10);
    }

    if (Object.keys(camposActualizar).length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos válidos para actualizar.' });
    }

    // 3. Guardar cambios usando explícitamente el id_socio del token autenticado
    const { data: perfilActualizado, error } = await supabase
      .from('socio')
      .update(camposActualizar)
      .eq('id_socio', idSocio)
      .select('id_socio, id_gimnasio, nombre, apellido, dni, telefono, email, fecha_alta, estado')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Error al actualizar el perfil: ' + error.message });
    }

    return res.status(200).json({
      mensaje: 'Perfil actualizado correctamente.',
      perfil: perfilActualizado
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

module.exports = {
  getPerfilSocio,
  updatePerfilSocio
};