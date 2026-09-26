const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');

/**
 * 1. OBTENER SOCIOS (Con paginación, filtros y búsqueda por Nombre, Apellido, DNI o Teléfono)
 * GET /api/socios?page=1&limit=6&estado=activo&search=Juan
 */
const getSocios = async (req, res) => {
  try {
    const idGimnasio = req.usuario?.id_gimnasio;

    if (!idGimnasio) {
      return res.status(400).json({ error: 'No se identificó el gimnasio autenticado.' });
    }

    const { estado, search, limit, page } = req.query;

    let query = supabase
      .from('socio')
      .select(`
        *,
        membresia (
          *,
          plan_membresia (*)
        )
      `, { count: 'exact' })
      .eq('id_gimnasio', idGimnasio);

    // Filtro por estado
    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado);
    }

    // Búsqueda por Nombre, Apellido, DNI o Teléfono
    if (search) {
      const cleanSearch = search.trim();
      query = query.or(`nombre.ilike.%${cleanSearch}%,apellido.ilike.%${cleanSearch}%,dni.ilike.%${cleanSearch}%,telefono.ilike.%${cleanSearch}%`);
    }

    // Paginación condicional: solo paginar si limit NO es 'all' o '0'
    const isAll = limit === 'all' || limit === '0';
    let parsedLimit = parseInt(limit) || 6;
    let parsedPage = parseInt(page) || 1;

    if (!isAll) {
      const offset = (parsedPage - 1) * parsedLimit;
      query = query.range(offset, offset + parsedLimit - 1);
    }

    const { data: socios, error, count } = await query.order('id_socio', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Error al consultar los socios: ' + error.message });
    }

    return res.status(200).json({
      total: count || 0,
      page: isAll ? 1 : parsedPage,
      totalPages: isAll ? 1 : Math.ceil((count || 0) / parsedLimit),
      limit: isAll ? count : parsedLimit,
      socios: socios || []
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * 2. OBTENER SOCIO POR ID
 * GET /api/socios/:id
 */
const getSocioById = async (req, res) => {
  try {
    const { id } = req.params;
    const idGimnasio = req.usuario?.id_gimnasio;

    const { data: socio, error } = await supabase
      .from('socio')
      .select(`
        *,
        membresia (
          *,
          plan_membresia (*)
        ),
        asistencia (*),
        progreso (*)
      `)
      .eq('id_socio', id)
      .eq('id_gimnasio', idGimnasio)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al obtener el socio: ' + error.message });
    }

    if (!socio) {
      return res.status(404).json({ error: 'Socio no encontrado o no pertenece a tu gimnasio.' });
    }

    return res.status(200).json({ socio });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * 3. CREAR SOCIO
 * POST /api/socios
 */
const createSocio = async (req, res) => {
  try {
    const idGimnasio = req.usuario?.id_gimnasio;
    const { 
      nombre, 
      apellido, 
      dni, 
      telefono, 
      email,
      contrasena,
      password,
      plan, 
      precio, 
      estado, 
      fecha_vencimiento,
      id_plan_membresia
    } = req.body;

    // Validaciones de datos obligatorios
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    if (!dni || !dni.toString().trim()) {
      return res.status(400).json({ error: 'El DNI es obligatorio.' });
    }

    if (!idGimnasio) {
      return res.status(400).json({ error: 'No se asoció un gimnasio al usuario.' });
    }

    // Hash de contraseña si se proporcionó
    const rawPass = (contrasena || password)?.toString().trim();
    let contrasenaHash = null;
    if (rawPass) {
      contrasenaHash = await bcrypt.hash(rawPass, 10);
    }

    // Verificar DNI duplicado en el mismo gimnasio
    const { data: socioExistente } = await supabase
      .from('socio')
      .select('id_socio')
      .eq('dni', dni.toString().trim())
      .eq('id_gimnasio', idGimnasio)
      .maybeSingle();

    if (socioExistente) {
      return res.status(400).json({ error: 'Ya existe un socio registrado con este DNI.' });
    }

    // Crear la ficha de socio directamente
    const { data: nuevoSocio, error: errorSocio } = await supabase
      .from('socio')
      .insert([
        {
          id_gimnasio: idGimnasio,
          nombre: nombre.trim(),
          apellido: apellido ? apellido.trim() : '',
          dni: dni.toString().trim(),
          telefono: telefono ? telefono.trim() : null,
          email: email ? email.trim().toLowerCase() : null,
          contrasena: contrasenaHash,
          fecha_alta: new Date().toISOString().split('T')[0],
          estado: estado || 'activo'
        }
      ])
      .select()
      .single();

    if (errorSocio) {
      return res.status(500).json({ error: 'Error al crear el socio: ' + errorSocio.message });
    }

    // Registrar membresía (Plan y Fecha de Vencimiento) si se especificó
    let membresia = null;
    if (plan || id_plan_membresia || fecha_vencimiento) {
      let planId = id_plan_membresia;
      let planDuracion = 30;
      let planPrecio = precio;

      if (!planId && plan) {
        const { data: pData } = await supabase
          .from('plan_membresia')
          .select('id_plan_membresia, duracion_dias, precio')
          .ilike('nombre', `%${plan}%`)
          .eq('id_gimnasio', idGimnasio)
          .limit(1)
          .maybeSingle();
        if (pData) {
          planId = pData.id_plan_membresia;
          planDuracion = pData.duracion_dias || 30;
          if (!planPrecio && pData.precio) planPrecio = pData.precio;
        }
      }

      if (!planId) {
        const { data: pDef } = await supabase
          .from('plan_membresia')
          .select('id_plan_membresia, duracion_dias, precio')
          .eq('id_gimnasio', idGimnasio)
          .limit(1)
          .maybeSingle();
        if (pDef) {
          planId = pDef.id_plan_membresia;
          planDuracion = pDef.duracion_dias || 30;
          if (!planPrecio && pDef.precio) planPrecio = pDef.precio;
        }
      }

      const membData = {
        id_socio: nuevoSocio.id_socio,
        precio: planPrecio || 0,
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_vencimiento: fecha_vencimiento || new Date(Date.now() + planDuracion * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estado: estado || 'activo'
      };
      if (planId) {
        membData.id_plan_membresia = planId;
      }

      const { data: nuevaMembresia, error: errorMembresia } = await supabase
        .from('membresia')
        .insert([membData])
        .select('*, plan_membresia(*)')
        .single();

      if (!errorMembresia) {
        membresia = nuevaMembresia;
      }
    }

    return res.status(201).json({
      mensaje: 'Socio registrado exitosamente.',
      socio: {
        ...nuevoSocio,
        membresia
      }
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * 4. ACTUALIZAR SOCIO COMPLETO
 * PUT /api/socios/:id
 */
const updateSocio = async (req, res) => {
  try {
    const { id } = req.params;
    const idGimnasio = req.usuario?.id_gimnasio;
    const { nombre, apellido, dni, telefono, email, estado, id_plan_membresia, plan, contrasena, password } = req.body;

    // Verificar pertenencia al gimnasio
    let query = supabase
      .from('socio')
      .select('id_socio, id_gimnasio')
      .eq('id_socio', id);

    if (idGimnasio) {
      query = query.eq('id_gimnasio', idGimnasio);
    }

    const { data: socioActual } = await query.maybeSingle();

    if (!socioActual) {
      return res.status(404).json({ error: 'Socio no encontrado o sin permisos.' });
    }

    // Hash de nueva contraseña si se envió
    const rawPass = (contrasena || password)?.toString().trim();
    let contrasenaHash = undefined;
    if (rawPass) {
      contrasenaHash = await bcrypt.hash(rawPass, 10);
    }

    // Actualizar datos de la tabla socio directamente
    const updateCampos = {
      ...(nombre && { nombre: nombre.trim() }),
      ...(apellido !== undefined && { apellido: apellido ? apellido.trim() : '' }),
      ...(dni && { dni: dni.toString().trim() }),
      ...(telefono !== undefined && { telefono: telefono ? telefono.trim() : null }),
      ...(email !== undefined && { email: email ? email.trim().toLowerCase() : null }),
      ...(estado && { estado: estado.toLowerCase() }),
      ...(contrasenaHash !== undefined && { contrasena: contrasenaHash })
    };

    const { data: socioActualizado, error: errorUpdate } = await supabase
      .from('socio')
      .update(updateCampos)
      .eq('id_socio', id)
      .select()
      .single();

    if (errorUpdate) {
      return res.status(500).json({ error: 'Error al actualizar socio: ' + errorUpdate.message });
    }

    // Actualizar o crear membresía si se especificó plan
    if (id_plan_membresia || plan) {
      let planId = id_plan_membresia;
      let duracionDias = 30;
      let planPrecio = null;

      if (planId) {
        const { data: pObj } = await supabase
          .from('plan_membresia')
          .select('id_plan_membresia, duracion_dias, precio')
          .eq('id_plan_membresia', planId)
          .maybeSingle();
        if (pObj) {
          duracionDias = pObj.duracion_dias || 30;
          planPrecio = pObj.precio;
        }
      } else if (plan) {
        let pQuery = supabase
          .from('plan_membresia')
          .select('id_plan_membresia, duracion_dias, precio')
          .ilike('nombre', `%${plan}%`);
        if (idGimnasio) pQuery = pQuery.eq('id_gimnasio', idGimnasio);
        const { data: pFound } = await pQuery.limit(1).maybeSingle();
        if (pFound) {
          planId = pFound.id_plan_membresia;
          duracionDias = pFound.duracion_dias || 30;
          planPrecio = pFound.precio;
        }
      }

      // Buscar membresía activa del socio
      const { data: membExistente } = await supabase
        .from('membresia')
        .select('id_membresia')
        .eq('id_socio', id)
        .eq('estado', 'activo')
        .maybeSingle();

      if (membExistente) {
        await supabase
          .from('membresia')
          .update({
            ...(planId && { id_plan_membresia: planId }),
            ...(planPrecio != null && { precio: planPrecio })
          })
          .eq('id_membresia', membExistente.id_membresia);
      } else if (planId) {
        await supabase
          .from('membresia')
          .insert([{
            id_socio: id,
            id_plan_membresia: planId,
            precio: planPrecio || 0,
            fecha_inicio: new Date().toISOString().split('T')[0],
            fecha_vencimiento: new Date(Date.now() + duracionDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            estado: 'activo'
          }]);
      }
    }

    return res.status(200).json({
      mensaje: 'Socio actualizado correctamente.',
      socio: socioActualizado
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * 5. CAMBIAR ESTADO DEL SOCIO
 * PATCH /api/socios/:id/estado
 */
const changeEstadoSocio = async (req, res) => {
  try {
    const { id } = req.params;
    const idGimnasio = req.usuario?.id_gimnasio;
    const { estado } = req.body;

    const estadosPermitidos = ['activo', 'pendiente', 'inactivo'];
    if (!estado || !estadosPermitidos.includes(estado.toLowerCase())) {
      return res.status(400).json({ 
        error: 'El estado enviado no es válido. Debe ser: activo, pendiente o inactivo.' 
      });
    }

    const estadoLimpio = estado.toLowerCase();

    let query = supabase
      .from('socio')
      .update({ estado: estadoLimpio })
      .eq('id_socio', id);

    if (idGimnasio) {
      query = query.eq('id_gimnasio', idGimnasio);
    }

    const { data: socioActualizado, error } = await query
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al cambiar estado: ' + error.message });
    }

    if (!socioActualizado) {
      return res.status(404).json({ error: 'Socio no encontrado o no pertenece a tu gimnasio.' });
    }

    return res.status(200).json({
      mensaje: `Estado del socio modificado a '${estadoLimpio}' exitosamente.`,
      socio: socioActualizado
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * 6. ELIMINAR SOCIO
 * DELETE /api/socios/:id
 */
const deleteSocio = async (req, res) => {
  try {
    const { id } = req.params;
    const idGimnasio = req.usuario?.id_gimnasio;

    let query = supabase
      .from('socio')
      .select('id_socio, id_gimnasio')
      .eq('id_socio', id);

    if (idGimnasio) {
      query = query.eq('id_gimnasio', idGimnasio);
    }

    const { data: socioActual, error: errSocio } = await query.maybeSingle();

    if (errSocio || !socioActual) {
      return res.status(404).json({ error: 'Socio no encontrado o sin permisos.' });
    }

    // 1. Eliminar pagos vinculados a las membresías del socio
    const { data: membresias } = await supabase
      .from('membresia')
      .select('id_membresia')
      .eq('id_socio', id);

    if (membresias && membresias.length > 0) {
      const membIds = membresias.map((m) => m.id_membresia);
      await supabase
        .from('pago')
        .delete()
        .in('id_membresia', membIds);

      await supabase
        .from('membresia')
        .delete()
        .eq('id_socio', id);
    }

    // 2. Eliminar asistencias y progresos si existieran
    await supabase.from('asistencia').delete().eq('id_socio', id);
    await supabase.from('progreso').delete().eq('id_socio', id);

    // 3. Eliminar registro del socio
    const { error: errDelSocio } = await supabase
      .from('socio')
      .delete()
      .eq('id_socio', id);

    if (errDelSocio) throw errDelSocio;

    return res.status(200).json({ mensaje: 'Socio eliminado exitosamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar socio: ' + error.message });
  }
};

module.exports = {
  getSocios,
  getSocioById,
  createSocio,
  updateSocio,
  changeEstadoSocio,
  deleteSocio
};