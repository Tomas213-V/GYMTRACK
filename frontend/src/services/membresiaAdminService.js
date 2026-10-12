const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Obtener headers comunes con token JWT
 */
const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ==============================================================================
// 1. GESTIÓN DE PLANES DE MEMBRESÍA (CATÁLOGO)
// ==============================================================================

/**
 * Obtener todos los planes de membresía del gimnasio
 * @param {string} estado - 'activo', 'inactivo', 'todos'
 */
export async function getPlanesMembresia(estado = 'todos') {
  try {
    const query = estado ? `?estado=${encodeURIComponent(estado)}` : '';
    const res = await fetch(`${API_URL}/planes-membresia${query}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener los planes de membresía.');
    return data.planes || [];
  } catch (error) {
    console.error('Error en getPlanesMembresia:', error);
    throw error;
  }
}

/**
 * Obtener un plan específico por ID
 */
export async function getPlanMembresiaById(id) {
  try {
    const res = await fetch(`${API_URL}/planes-membresia/${id}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener el plan.');
    return data.plan;
  } catch (error) {
    console.error('Error en getPlanMembresiaById:', error);
    throw error;
  }
}

/**
 * Crear un nuevo plan de membresía
 * @param {Object} planData - { nombre, precio, duracion_dias, estado }
 */
export async function createPlanMembresia(planData) {
  try {
    const res = await fetch(`${API_URL}/planes-membresia`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(planData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear el plan de membresía.');
    return data;
  } catch (error) {
    console.error('Error en createPlanMembresia:', error);
    throw error;
  }
}

/**
 * Actualizar un plan de membresía existente
 * @param {number|string} id
 * @param {Object} planData - { nombre, precio, duracion_dias, estado }
 */
export async function updatePlanMembresia(id, planData) {
  try {
    const res = await fetch(`${API_URL}/planes-membresia/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(planData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar el plan.');
    return data;
  } catch (error) {
    console.error('Error en updatePlanMembresia:', error);
    throw error;
  }
}

/**
 * Desactivar un plan de membresía (baja lógica)
 */
export async function deshabilitarPlanMembresia(id) {
  try {
    const res = await fetch(`${API_URL}/planes-membresia/${id}/desactivar`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al desactivar el plan.');
    return data;
  } catch (error) {
    console.error('Error en deshabilitarPlanMembresia:', error);
    throw error;
  }
}

/**
 * Eliminar un plan de membresía
 */
export async function deletePlanMembresia(id) {
  try {
    const res = await fetch(`${API_URL}/planes-membresia/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar el plan.');
    return data;
  } catch (error) {
    console.error('Error en deletePlanMembresia:', error);
    throw error;
  }
}

// ==============================================================================
// 2. GESTIÓN DE MEMBRESÍAS ASIGNADAS A SOCIOS
// ==============================================================================

/**
 * Obtener listado de membresías asignadas a socios con filtros opcionales
 * @param {Object} params - { estado, id_socio }
 */
export async function getMembresiasSocios({ estado = 'todos', id_socio = '' } = {}) {
  try {
    const params = new URLSearchParams();
    if (estado && estado !== 'todos') params.append('estado', estado);
    if (id_socio) params.append('id_socio', id_socio);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/membresias${query}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al consultar membresías.');
    return data.membresias || [];
  } catch (error) {
    console.error('Error en getMembresiasSocios:', error);
    throw error;
  }
}

/**
 * Obtener una membresía de socio por ID
 */
export async function getMembresiaSocioById(id) {
  try {
    const res = await fetch(`${API_URL}/membresias/${id}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener la membresía.');
    return data.membresia;
  } catch (error) {
    console.error('Error en getMembresiaSocioById:', error);
    throw error;
  }
}

/**
 * Asignar / Registrar una nueva membresía a un socio
 * @param {Object} membData - { id_socio, id_plan_membresia, fecha_inicio, dias_adicionales, estado, precio }
 */
export async function createMembresiaSocio(membData) {
  try {
    const res = await fetch(`${API_URL}/membresias`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(membData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al asignar la membresía.');
    return data;
  } catch (error) {
    console.error('Error en createMembresiaSocio:', error);
    throw error;
  }
}

/**
 * Actualizar una membresía de socio (fechas, plan, precio, estado)
 * @param {number|string} id
 * @param {Object} updateData - { estado, fecha_inicio, fecha_vencimiento, dias_extension, precio, id_plan_membresia }
 */
export async function updateMembresiaSocio(id, updateData) {
  try {
    const res = await fetch(`${API_URL}/membresias/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updateData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar la membresía.');
    return data;
  } catch (error) {
    console.error('Error en updateMembresiaSocio:', error);
    throw error;
  }
}

/**
 * Cancelar una membresía de socio
 */
export async function cancelarMembresiaSocio(id) {
  return updateMembresiaSocio(id, { estado: 'cancelada' });
}

/**
 * Eliminar una membresía de socio
 */
export async function deleteMembresiaSocio(id) {
  try {
    const res = await fetch(`${API_URL}/membresias/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar la membresía.');
    return data;
  } catch (error) {
    console.error('Error en deleteMembresiaSocio:', error);
    throw error;
  }
}

/**
 * Obtener socios simples para dropdown de asignación de membresías
 */
export async function getSociosDropdown() {
  try {
    const res = await fetch(`${API_URL}/socios?limit=all`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar socios.');
    return data.socios || [];
  } catch (error) {
    console.error('Error en getSociosDropdown:', error);
    return [];
  }
}
