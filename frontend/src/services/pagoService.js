/**
 * =========================================================================================
 * ARCHIVO: pagoService.js
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Capa de servicios para la administración financiera, cobros y métricas de caja.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * 1. Propósito: Conectar los componentes de tesorería y facturación con la API REST del backend.
 * 2. Autenticación y Autorización: Utiliza tokens Bearer inyectados en los headers HTTP.
 * 3. Filtrado por Gimnasio: Cada dueño gestiona estrictamente los pagos de su gimnasio (`id_gimnasio`).
 * 4. Métodos disponibles:
 *    - `getPagos()`: Listado paginado con rangos de fechas (desde/hasta) y filtro por estado.
 *    - `getResumenPagos()`: Métricas numéricas (total recaudado, completados, pendientes, vencidos).
 *    - `getMembresias()` y `getPlanes()`: Catálogos para el modal de nuevo cobro.
 *    - `registrarPago()`: Alta de cobro con método (efectivo, MP, transferencia, etc.).
 *    - `actualizarEstadoPago()`: Transición de estado (pagado, pendiente, vencido).
 *    - `getPagoById()` y `eliminarPago()`: Consulta detallada y baja.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Función auxiliar para inyectar token JWT y cabeceras JSON en cada petición.
 */
function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}


/**
 * Obtener listado de pagos con paginación y filtros opcionales
 * @param {Object} params - { page, limit, estado, desde, hasta, id_gimnasio }
 */
export async function getPagos({ page = 1, limit = 10, estado = '', desde = '', hasta = '', id_gimnasio = '' } = {}) {
  try {
    const query = new URLSearchParams();
    if (page) query.append('page', page);
    if (limit) query.append('limit', limit);
    if (estado && estado !== 'todos') query.append('estado', estado);
    if (desde) query.append('desde', desde);
    if (hasta) query.append('hasta', hasta);
    if (id_gimnasio) query.append('id_gimnasio', id_gimnasio);

    const res = await fetch(`${API_URL}/pagos?${query.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al obtener pagos');
    }
    return await res.json();
  } catch (error) {
    console.error('Error en getPagos:', error);
    throw error;
  }
}

/**
 * Obtener métricas resumidas de pagos
 * @param {Object} params - { desde, hasta, id_gimnasio }
 */
export async function getResumenPagos({ desde = '', hasta = '', id_gimnasio = '' } = {}) {
  try {
    const query = new URLSearchParams();
    if (desde) query.append('desde', desde);
    if (hasta) query.append('hasta', hasta);
    if (id_gimnasio) query.append('id_gimnasio', id_gimnasio);

    const res = await fetch(`${API_URL}/pagos/resumen?${query.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al obtener resumen de pagos');
    }
    return await res.json();
  } catch (error) {
    console.error('Error en getResumenPagos:', error);
    throw error;
  }
}

/**
 * Obtener membresías y socios disponibles
 * @param {Object} params - { id_gimnasio }
 */
export async function getMembresias({ id_gimnasio = '' } = {}) {
  try {
    const query = new URLSearchParams();
    if (id_gimnasio) query.append('id_gimnasio', id_gimnasio);

    const res = await fetch(`${API_URL}/pagos/membresias?${query.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al obtener membresías');
    }
    return await res.json();
  } catch (error) {
    console.error('Error en getMembresias:', error);
    throw error;
  }
}

/**
 * Obtener lista de planes de membresía disponibles
 * @param {Object} params - { id_gimnasio }
 */
export async function getPlanes({ id_gimnasio = '' } = {}) {
  try {
    const query = new URLSearchParams();
    if (id_gimnasio) query.append('id_gimnasio', id_gimnasio);

    const res = await fetch(`${API_URL}/pagos/planes?${query.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error en getPlanes:', error);
    return [];
  }
}

/**
 * Registrar un nuevo pago
 * @param {Object} datos - { id_membresia, monto, fecha_pago, metodo_pago, estado, comprobante, nombreSocio, dniSocio, plan, id_gimnasio }
 */
export async function registrarPago(datos) {
  try {
    const res = await fetch(`${API_URL}/pagos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al registrar el pago');
    }
    return data;
  } catch (error) {
    console.error('Error en registrarPago:', error);
    throw error;
  }
}

/**
 * Actualizar el estado de un pago
 * @param {number|string} id - ID del pago
 * @param {string} estado - 'pagado' | 'pendiente' | 'vencido'
 */
export async function actualizarEstadoPago(id, estado) {
  try {
    const res = await fetch(`${API_URL}/pagos/${id}/estado`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ estado }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al actualizar el estado del pago');
    }
    return data;
  } catch (error) {
    console.error('Error en actualizarEstadoPago:', error);
    throw error;
  }
}

/**
 * Obtener detalle completo de un pago
 * @param {number|string} id - ID del pago
 */
export async function getPagoById(id) {
  try {
    const res = await fetch(`${API_URL}/pagos/${id}`, {
      headers: getHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener detalle del pago');
    }
    return data;
  } catch (error) {
    console.error('Error en getPagoById:', error);
    throw error;
  }
}

/**
 * Eliminar un pago de la base de datos
 * @param {number|string} id - ID del pago
 */
export async function eliminarPago(id) {
  try {
    const res = await fetch(`${API_URL}/pagos/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al eliminar el pago');
    }
    return data;
  } catch (error) {
    console.error('Error en eliminarPago:', error);
    throw error;
  }
}
