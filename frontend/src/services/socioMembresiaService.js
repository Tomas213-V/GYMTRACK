/**
 * =========================================================================================
 * ARCHIVO: socioMembresiaService.js
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Servicio para que el socio consulte su suscripción y renueve membresías.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * 1. Consulta de Membresía Actual: `getMiMembresia()` devuelve el estado de la suscripción,
 *    días restantes de vigencia, porcentaje transcurrido y el historial de pagos realizados.
 * 2. Renovación y Planes: `getPlanesDisponibles()` lista los planes que su gimnasio ofrece,
 *    permitiendo al alumno seleccionar y adquirir un plan nuevo mediante la pasarela de pagos.
 * 3. Integración con Mercado Pago:
 *    - `iniciarPagoMembresia()`: Solicita al backend la creación de la preferencia en Mercado Pago
 *      obteniendo la URL de Checkout Pro (`init_point`), el código QR y la `external_reference`.
 *    - `verificarPagoMercadoPago()`: Efectúa polling reactivo mientras el checkout esté en curso
 *      o valida el retorno desde `back_urls` (`?pago_status=approved`) para acreditar la membresía.
 *    - `confirmarPagoMembresia()`: Asienta la transacción contable y renueva la membresía en la base de datos.
 */

import { formatFechaArgentina } from '../utils/dateUtils';

const API_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/socio` 
  : 'http://localhost:3000/api/socio';

const METODO_PAGO_ETIQUETAS = [
  { match: (m) => m.includes('mercadopago') || m === 'mp' || m.includes('mercado pago'), label: 'Mercado Pago' },
  { match: (m) => m.includes('uala') || m.includes('ualá'), label: 'Ualá' },
  { match: (m) => m.includes('efectivo') || m.includes('cash'), label: 'Efectivo' },
  { match: (m) => m.includes('transferencia'), label: 'Transferencia' },
  { match: (m) => m.includes('debito') || m.includes('débito'), label: 'Tarjeta de Débito' },
  { match: (m) => m.includes('credito') || m.includes('crédito') || m.includes('tarjeta'), label: 'Tarjeta de Crédito' }
];

const ESTADOS_PAGO_PAGADOS = ['pagado', 'aprobado', 'completado', 'accredited'];

function formatearPrecioARS(monto) {
  if (monto === null || monto === undefined || monto === '' || Number.isNaN(Number(monto))) {
    return '$0';
  }
  return `$${Number(monto).toLocaleString('es-AR')}`;
}

function obtenerEtiquetaMetodoPago(metodoPago) {
  const mNorm = String(metodoPago || '').toLowerCase().trim();
  if (!mNorm) return 'No especificado';

  const found = METODO_PAGO_ETIQUETAS.find((item) => item.match(mNorm));
  return found ? found.label : String(metodoPago).trim();
}

function obtenerEtiquetaEstadoPago(estado) {
  const eNorm = String(estado || 'pagado').toLowerCase().trim();
  if (ESTADOS_PAGO_PAGADOS.includes(eNorm)) return 'Pagado';
  if (eNorm === 'vencido' || eNorm === 'rechazado' || eNorm === 'cancelado') {
    return eNorm.charAt(0).toUpperCase() + eNorm.slice(1);
  }
  return 'Pendiente';
}

function resolverNombrePlanPago(pago, data) {
  const directo =
    pago?.plan_nombre ||
    pago?.membresia?.plan_membresia?.nombre ||
    pago?.membresia?.plan?.nombre ||
    pago?.plan?.nombre;
  if (directo) return directo;

  const planes = Array.isArray(data?.planes_disponibles) ? data.planes_disponibles : [];
  const idPlanPago = pago?.id_plan_membresia || pago?.membresia?.id_plan_membresia;
  if (idPlanPago) {
    const planPorId = planes.find((p) => String(p.id_plan_membresia) === String(idPlanPago));
    if (planPorId?.nombre) return planPorId.nombre;
  }

  const membresiaActual = data?.membresia;
  const mismoPlanQueMembresia =
    membresiaActual?.nombre_plan &&
    membresiaActual.nombre_plan !== 'Sin Membresía Activa' &&
    (!pago?.id_membresia || !membresiaActual?.id_membresia || String(pago.id_membresia) === String(membresiaActual.id_membresia));

  if (pago?.monto !== null && pago?.monto !== undefined) {
    const montoNum = Number(pago.monto);
    const planPorMonto = planes.find((p) => Number(p.precio) === montoNum);
    if (planPorMonto?.nombre) return planPorMonto.nombre;
  }

  if (mismoPlanQueMembresia) return membresiaActual.nombre_plan;

  return 'Plan de Membresía';
}

/**
 * Normaliza un registro de pago asegurando campos formateados compatibles
 * con respuestas de backend Node y backend Python.
 */
export function normalizarPagoHistorial(pago, data = {}) {
  const estadoNorm = String(pago?.estado || 'pagado').toLowerCase().trim();
  const esPagado = ESTADOS_PAGO_PAGADOS.includes(estadoNorm);

  return {
    ...pago,
    monto_formateado: pago?.monto_formateado || formatearPrecioARS(pago?.monto),
    fecha_formateada: pago?.fecha_formateada || (pago?.fecha_pago ? formatFechaArgentina(pago.fecha_pago) : 'Sin fecha'),
    metodo_pago_etiqueta: pago?.metodo_pago_etiqueta || obtenerEtiquetaMetodoPago(pago?.metodo_pago),
    plan_nombre: resolverNombrePlanPago(pago, data),
    categoria: pago?.categoria || 'Membresía',
    estado: esPagado ? 'pagado' : 'pendiente',
    estado_etiqueta: pago?.estado_etiqueta || obtenerEtiquetaEstadoPago(estadoNorm)
  };
}

/**
 * Obtener headers comunes con token JWT.
 * Incluye la cabecera `Authorization: Bearer <token>` para autenticar las peticiones del socio.
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

    const rawPagos = Array.isArray(data.historial_pagos)
      ? data.historial_pagos
      : (Array.isArray(data.pagos) ? data.pagos : []);

    const historialPagosNormalizado = rawPagos.map((pago) => normalizarPagoHistorial(pago, data));

    const socioNormalizado = data.socio
      ? {
          ...data.socio,
          nombre_completo:
            data.socio.nombre_completo ||
            `${data.socio.nombre || ''} ${data.socio.apellido || ''}`.trim()
        }
      : data.socio;

    return {
      ...data,
      socio: socioNormalizado,
      historial_pagos: historialPagosNormalizado
    };
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


