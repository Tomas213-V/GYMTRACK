// backend/src/controllers/rutinaController.js
const supabase = require('../config/supabase');

// 1. Obtener todas las rutinas
exports.getAllRutinas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rutina')
      .select('*')
      .order('id_rutina', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Obtener rutina por ID junto a sus ejercicios
exports.getRutinaById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('rutina')
      .select(`
        *,
        rutina_ejercicio (
          id_rutina_ejercicio,
          serie,
          repeticiones,
          peso,
          descanso,
          orden,
          ejercicio (
            id_ejercicio,
            nombre,
            grupo_muscular,
            dificultad
          )
        )
      `)
      .eq('id_rutina', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: `Rutina con ID ${id} no encontrada.` });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. Crear una nueva rutina
exports.createRutina = async (req, res) => {
  try {
    const { nombre, descripcion, id_gimnasio, id_socio } = req.body;

    const { data, error } = await supabase
      .from('rutina')
      .insert([{ nombre, descripcion, id_gimnasio, id_socio }])
      .select();

    if (error) throw error;
    return res.status(201).json(data[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. Actualizar rutina existente
exports.updateRutina = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;

    const { data, error } = await supabase
      .from('rutina')
      .update({ nombre, descripcion })
      .eq('id_rutina', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: `No se encontró la rutina ${id} para actualizar.` });
    }

    return res.status(200).json(data[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 5. Eliminar rutina y limpiar dependencias
exports.deleteRutina = async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminamos primero relaciones intermedias por seguridad referencial
    await supabase.from('rutina_ejercicio').delete().eq('id_rutina', id);

    const { data, error } = await supabase
      .from('rutina')
      .delete()
      .eq('id_rutina', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: `La rutina ${id} no existe.` });
    }

    return res.status(200).json({ message: `Rutina ${id} eliminada correctamente.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 6. Consultar sólo los ejercicios de una rutina
exports.getEjerciciosByRutina = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('rutina_ejercicio')
      .select(`
        id_rutina_ejercicio,
        serie,
        repeticiones,
        peso,
        descanso,
        orden,
        ejercicio (
          id_ejercicio,
          nombre,
          grupo_muscular,
          dificultad
        )
      `)
      .eq('id_rutina', id)
      .order('orden', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 7. Asociar un ejercicio a la rutina
exports.addEjercicioToRutina = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_ejercicio, serie, repeticiones, peso, descanso, orden } = req.body;

    const { data, error } = await supabase
      .from('rutina_ejercicio')
      .insert([{
        id_rutina: id,
        id_ejercicio,
        serie: serie || 3,
        repeticiones: repeticiones || 10,
        peso: peso || 0,
        descanso: descanso || 60,
        orden: orden || 1
      }])
      .select();

    if (error) {
      // 23503 es el código PostgreSQL para Foreign Key violada
      if (error.code === '23503') {
        return res.status(400).json({ error: 'El ejercicio especificado o la rutina no existen.' });
      }
      throw error;
    }

    return res.status(201).json(data[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 8. Desvincular ejercicio de la rutina
exports.removeEjercicioFromRutina = async (req, res) => {
  try {
    const { id, ejercicioId } = req.params;

    const { data, error } = await supabase
      .from('rutina_ejercicio')
      .delete()
      .eq('id_rutina', id)
      .eq('id_ejercicio', ejercicioId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'El ejercicio no estaba asociado a esta rutina.' });
    }

    return res.status(200).json({ message: 'Ejercicio desvinculado con éxito.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};