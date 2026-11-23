// ==============================================================================
// CONTROLADOR DE GIMNASIOS — MULTIGIMNASIO POR DUEÑO (NUEVO ESQUEMA SUPABASE)
// Tabla: public.gimnasio (id_gimnasio, nombre, telefono, email, fecha_registro,
//        estado boolean, id_dueno)
// ==============================================================================

/**
 * GET /api/gimnasios
 * Lista los gimnasios autorizados del usuario autenticado (dueño: sus gimnasios;
 * empleado: su gimnasio asignado; socio: gimnasios donde tiene contratación).
 */
const listarMisGimnasios = async (req, res) => {
  try {
    const u = req.usuario;
    const db = req.supabase;

    if (u.rol === 'dueño' && u.id_dueno) {
      const { data: gimnasios, error } = await db
        .from('gimnasio')
        .select(`
          id_gimnasio,
          nombre,
          telefono,
          email,
          fecha_registro,
          estado,
          id_dueno,
          sucursal (
            id_sucursal,
            direccion,
            telefono,
            descripcion,
            estado
          )
        `)
        .eq('id_dueno', u.id_dueno)
        .order('id_gimnasio', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Error al consultar gimnasios: ' + error.message });
      }

      return res.status(200).json({
        gimnasios: gimnasios || [],
        id_gimnasio_activo: u.id_gimnasio
      });
    }

    return res.status(200).json({
      gimnasios: u.gimnasios || [],
      id_gimnasio_activo: u.id_gimnasio
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al listar gimnasios: ' + error.message });
  }
};

/**
 * GET /api/gimnasios/catalogo
 * Permite a un socio autenticado explorar gimnasios activos para contratar nuevas membresías.
 */
const listarCatalogoGimnasios = async (req, res) => {
  try {
    const db = req.supabase;
    const { search } = req.query;

    let gymsQuery = db
      .from('vw_catalogo_gimnasios')
      .select('id_gimnasio, nombre, telefono, estado')
      .eq('estado', true)
      .order('nombre', { ascending: true });

    if (search && String(search).trim()) {
      gymsQuery = gymsQuery.ilike('nombre', `%${String(search).trim()}%`);
    }

    const [gymsRes, planesRes] = await Promise.all([
      gymsQuery,
      db
        .from('vw_catalogo_planes')
        .select('id_membresia_gimnasio, id_gimnasio, nombre, descripcion, precio, duracion_dias, limite_asistencias_semanales, limite_asistencias_totales, estado')
        .eq('estado', true)
    ]);

    if (gymsRes.error) {
      return res.status(500).json({ error: 'Error al consultar catálogo de gimnasios: ' + gymsRes.error.message });
    }
    if (planesRes.error) {
      return res.status(500).json({ error: 'Error al consultar planes del catálogo: ' + planesRes.error.message });
    }

    const planesPorGym = new Map();
    (planesRes.data || []).forEach((p) => {
      if (!planesPorGym.has(p.id_gimnasio)) planesPorGym.set(p.id_gimnasio, []);
      planesPorGym.get(p.id_gimnasio).push(p);
    });

    const gimnasios = (gymsRes.data || []).map((g) => {
      const planes = planesPorGym.get(g.id_gimnasio) || [];
      return {
        ...g,
        membresia_gimnasio: planes,
        planes_activos: planes
      };
    });

    return res.status(200).json({ gimnasios });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al consultar catálogo: ' + error.message });
  }
};

/**
 * POST /api/gimnasios
 * Crea un nuevo gimnasio para el dueño autenticado (un dueño puede administrar múltiples gimnasios).
 * Si se envía `direccion`, crea automáticamente su primera sucursal.
 */
const crearGimnasio = async (req, res) => {
  try {
    const u = req.usuario;
    const db = req.supabase;

    if (u.rol !== 'dueño' || !u.id_dueno) {
      return res.status(403).json({ error: 'Solo los dueños pueden registrar nuevos gimnasios.' });
    }

    const { nombre, telefono, email, direccion, descripcion_sucursal } = req.body;

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del gimnasio es obligatorio.' });
    }

    const { data: nuevoGimnasio, error: errGym } = await db
      .from('gimnasio')
      .insert([
        {
          nombre: String(nombre).trim(),
          telefono: telefono ? String(telefono).trim() : null,
          email: email ? String(email).trim().toLowerCase() : null,
          estado: true,
          id_dueno: u.id_dueno
        }
      ])
      .select('*')
      .single();

    if (errGym) {
      return res.status(500).json({ error: 'Error al registrar el gimnasio: ' + errGym.message });
    }

    // Si se proporcionó dirección inicial, crear la primera sucursal
    let primeraSucursal = null;
    if (direccion && String(direccion).trim()) {
      const { data: sucData, error: errSuc } = await db
        .from('sucursal')
        .insert([
          {
            direccion: String(direccion).trim(),
            telefono: telefono ? String(telefono).trim() : null,
            descripcion: descripcion_sucursal ? String(descripcion_sucursal).trim() : 'Sucursal principal',
            estado: true,
            id_gimnasio: nuevoGimnasio.id_gimnasio
          }
        ])
        .select('*')
        .single();

      if (!errSuc) {
        primeraSucursal = sucData;
      }
    }

    return res.status(201).json({
      mensaje: 'Gimnasio registrado exitosamente.',
      gimnasio: nuevoGimnasio,
      sucursal: primeraSucursal
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * GET /api/gimnasios/mi-gimnasio
 * Devuelve el gimnasio activo del usuario autenticado junto a sus sucursales y la lista completa de gimnasios.
 */
const obtenerMiGimnasio = async (req, res) => {
  try {
    const u = req.usuario;
    const db = req.supabase;

    if (!u.id_gimnasio) {
      return res.status(200).json({
        tieneGimnasio: false,
        gimnasio: null,
        gimnasios: u.gimnasios || []
      });
    }

    const { data: gimnasio, error } = await db
      .from('gimnasio')
      .select(`
        id_gimnasio,
        nombre,
        telefono,
        email,
        fecha_registro,
        estado,
        id_dueno,
        sucursal (
          id_sucursal,
          direccion,
          telefono,
          descripcion,
          fecha_registro,
          estado,
          id_gimnasio
        )
      `)
      .eq('id_gimnasio', u.id_gimnasio)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Error al consultar el gimnasio: ' + error.message });
    }

    return res.status(200).json({
      tieneGimnasio: Boolean(gimnasio),
      gimnasio: gimnasio || null,
      gimnasios: u.gimnasios || []
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

/**
 * PUT /api/gimnasios/mi-gimnasio | PUT /api/gimnasios/:id
 * Actualiza datos del gimnasio (solo dueño propietario).
 */
const actualizarMiGimnasio = async (req, res) => {
  try {
    const u = req.usuario;
    const db = req.supabase;

    if (u.rol !== 'dueño' || !u.id_dueno) {
      return res.status(403).json({ error: 'Solo el dueño puede modificar los datos del gimnasio.' });
    }

    const targetId = req.params.id ? Number(req.params.id) : u.id_gimnasio;
    if (!targetId) {
      return res.status(400).json({ error: 'No se especificó el gimnasio a actualizar.' });
    }

    const { nombre, telefono, email, estado } = req.body;
    const updateFields = {};

    if (nombre !== undefined) {
      if (!String(nombre).trim()) {
        return res.status(400).json({ error: 'El nombre del gimnasio no puede estar vacío.' });
      }
      updateFields.nombre = String(nombre).trim();
    }
    if (telefono !== undefined) updateFields.telefono = telefono ? String(telefono).trim() : null;
    if (email !== undefined) updateFields.email = email ? String(email).trim().toLowerCase() : null;
    if (estado !== undefined) {
      updateFields.estado = typeof estado === 'boolean' ? estado : String(estado).toLowerCase() === 'activo' || estado === 'true';
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para actualizar.' });
    }

    const { data: gymActualizado, error: errUpdate } = await db
      .from('gimnasio')
      .update(updateFields)
      .eq('id_gimnasio', targetId)
      .eq('id_dueno', u.id_dueno)
      .select('*')
      .maybeSingle();

    if (errUpdate) {
      return res.status(500).json({ error: 'Error al actualizar el gimnasio: ' + errUpdate.message });
    }

    if (!gymActualizado) {
      return res.status(404).json({ error: 'Gimnasio no encontrado o no pertenece a tu cuenta.' });
    }

    return res.status(200).json({
      mensaje: 'Datos del gimnasio actualizados exitosamente.',
      gimnasio: gymActualizado
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

module.exports = {
  listarMisGimnasios,
  listarCatalogoGimnasios,
  crearGimnasio,
  obtenerMiGimnasio,
  actualizarMiGimnasio
};
