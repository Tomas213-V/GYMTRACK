const API_URL = 'http://localhost:3000/api/socio';

/**
 * Obtener headers comunes con token JWT
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
 * 1. Obtener la membresía actual, métricas temporales e historial de pagos del socio
 */
export async function getMiMembresia() {
  try {
    const res = await fetch(`${API_URL}/membresia`, {
      headers: getHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener la membresía del socio.');
    }
    return data;
  } catch (error) {
    console.error('Error en getMiMembresia:', error);
    throw error;
  }
}

/**
 * 2. Obtener planes disponibles exclusivamente en el gimnasio del socio
 */
export async function getPlanesDisponibles() {
  try {
    const res = await fetch(`${API_URL}/planes-disponibles`, {
      headers: getHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener los planes disponibles.');
    }
    return data;
  } catch (error) {
    console.error('Error en getPlanesDisponibles:', error);
    throw error;
  }
}

/**
 * 3. Solicitar actualización o cambio de membresía
 * @param {number|string} idPlanMembresia
 */
export async function solicitarActualizacion(idPlanMembresia) {
  try {
    const res = await fetch(`${API_URL}/membresia/actualizar`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ id_plan_membresia: idPlanMembresia })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al preparar la actualización.');
    }
    return data;
  } catch (error) {
    console.error('Error en solicitarActualizacion:', error);
    throw error;
  }
}

/**
 * 4. Iniciar pago con Mercado Pago o Ualá
 * @param {Object} params - { id_plan_membresia, metodo_pago, tipo_operacion }
 */
export async function iniciarPagoMembresia({ id_plan_membresia, metodo_pago = 'mercadopago', tipo_operacion = 'renovacion' }) {
  try {
    const res = await fetch(`${API_URL}/pagos/iniciar`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ id_plan_membresia, metodo_pago, tipo_operacion })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al iniciar la sesión de pago.');
    }
    return data;
  } catch (error) {
    console.error('Error en iniciarPagoMembresia:', error);
    throw error;
  }
}

/**
 * 5. Confirmar pago de membresía y registrar transacción
 * @param {Object} params - { id_plan_membresia, monto, metodo_pago, referencia_pago, comprobante }
 */
export async function confirmarPagoMembresia({ id_plan_membresia, monto, metodo_pago, referencia_pago, comprobante }) {
  try {
    const res = await fetch(`${API_URL}/pagos/confirmar`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        id_plan_membresia,
        monto,
        metodo_pago,
        referencia_pago,
        comprobante
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al confirmar el pago de la membresía.');
    }
    return data;
  } catch (error) {
    console.error('Error en confirmarPagoMembresia:', error);
    throw error;
  }
}

/**
 * 6. Verificar y acreditar automáticamente el pago consultando la API de Mercado Pago
 * @param {Object} params - { external_reference, payment_id }
 */
export async function verificarPagoMercadoPago({ external_reference = '', payment_id = '' } = {}) {
  try {
    const query = new URLSearchParams();
    if (external_reference) query.append('external_reference', external_reference);
    if (payment_id) query.append('payment_id', payment_id);

    const res = await fetch(`${API_URL}/pagos/verificar-mp?${query.toString()}`, {
      headers: getHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al verificar el pago en Mercado Pago.');
    }
    return data;
  } catch (error) {
    console.error('Error en verificarPagoMercadoPago:', error);
    throw error;
  }
}


