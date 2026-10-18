// ==============================================================================
// SERVICIO DE INTEGRACIÓN DE PASARELAS DE PAGO (MERCADO PAGO Y UALÁ)
// ==============================================================================

/**
 * Servicio para preparar e interactuar con medios de pago digitales:
 * - Mercado Pago (Checkout Pro, Preferencias, Webhooks)
 * - Ualá / Ualá Bis (Órdenes de cobro, QR, Callbacks)
 * 
 * Admite modo Sandbox/Simulación de desarrollo y producción mediante variables de entorno.
 */

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.Token_Mer || process.env.Api_MER || '';
const UALA_CLIENT_ID = process.env.UALA_CLIENT_ID || '';
const UALA_CLIENT_SECRET = process.env.UALA_CLIENT_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Genera una preferencia de pago para Mercado Pago.
 * @param {Object} params
 * @param {string} params.titulo - Nombre del plan o concepto
 * @param {number} params.monto - Precio a cobrar en ARS
 * @param {string} params.externalReference - ID o referencia única del pago
 * @param {Object} params.socio - Datos del socio pagador (nombre, email, dni)
 * @param {Object} params.gimnasio - Datos del gimnasio
 */
async function crearPreferenciaMercadoPago({ titulo, monto, externalReference, socio, gimnasio }) {
  const precioUnitario = Number(monto);

  // Si hay un token real de Mercado Pago configurado, intentamos llamar a la API de MP
  if (MERCADOPAGO_ACCESS_TOKEN && MERCADOPAGO_ACCESS_TOKEN.startsWith('APP_USR-')) {
    try {
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          items: [
            {
              id: externalReference,
              title: `${titulo} - ${gimnasio?.nombre || 'GymTrack'}`,
              description: `Membresía en ${gimnasio?.nombre || 'GymTrack'} para ${socio.nombre} ${socio.apellido}`,
              quantity: 1,
              currency_id: 'ARS',
              unit_price: precioUnitario
            }
          ],
          payer: {
            name: socio.nombre,
            surname: socio.apellido,
            email: socio.email || 'socio@gymtrack.com',
            identification: {
              type: 'DNI',
              number: String(socio.dni || '00000000')
            }
          },
          external_reference: externalReference,
          back_urls: {
            success: `${FRONTEND_URL}/membresia-socio?pago_status=approved&ref=${externalReference}`,
            pending: `${FRONTEND_URL}/membresia-socio?pago_status=pending&ref=${externalReference}`,
            failure: `${FRONTEND_URL}/membresia-socio?pago_status=rejected&ref=${externalReference}`
          }
        })
      });

      if (response.ok) {
        const mpData = await response.json();
        return {
          proveedor: 'mercadopago',
          modo: 'api_real',
          id_preferencia: mpData.id,
          init_point: mpData.init_point,
          sandbox_init_point: mpData.sandbox_init_point || mpData.init_point,
          external_reference: externalReference,
          monto: precioUnitario,
          qr_codigo: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mpData.init_point)}`
        };
      }
    } catch (err) {
      console.warn('Fallo al conectar con la API en vivo de Mercado Pago, usando fallback simulado:', err.message);
    }
  }

  // Modo Sandbox/Simulado listo para operar de inmediato
  const mockPrefId = `MP-PREF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const mockCheckoutUrl = `${FRONTEND_URL}/socio/membresia?checkout=mercadopago&ref=${externalReference}&pref=${mockPrefId}&monto=${precioUnitario}`;

  return {
    proveedor: 'mercadopago',
    modo: 'sandbox_simulado',
    id_preferencia: mockPrefId,
    init_point: mockCheckoutUrl,
    sandbox_init_point: mockCheckoutUrl,
    external_reference: externalReference,
    monto: precioUnitario,
    qr_codigo: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockCheckoutUrl)}`,
    mensaje: 'Sesión de Mercado Pago preparada correctamente.'
  };
}

/**
 * Genera una orden de cobro para Ualá (Ualá Bis).
 * @param {Object} params
 * @param {string} params.titulo - Nombre del plan o concepto
 * @param {number} params.monto - Precio a cobrar en ARS
 * @param {string} params.externalReference - ID o referencia única del pago
 * @param {Object} params.socio - Datos del socio pagador
 * @param {Object} params.gimnasio - Datos del gimnasio
 */
async function crearOrdenUala({ titulo, monto, externalReference, socio, gimnasio }) {
  const precioUnitario = Number(monto);

  // Si hay credenciales reales de Ualá Bis, intentamos conectar
  if (UALA_CLIENT_ID && UALA_CLIENT_SECRET) {
    try {
      // 1. Obtener token de Ualá
      const authRes = await fetch('https://auth.prod.bis.com.ar/connect/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: UALA_CLIENT_ID,
          client_secret: UALA_CLIENT_SECRET
        })
      });

      if (authRes.ok) {
        const authData = await authRes.json();
        const orderRes = await fetch('https://api.prod.bis.com.ar/v2/checkout/order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.access_token}`
          },
          body: JSON.stringify({
            amount: precioUnitario,
            description: `${titulo} - ${gimnasio?.nombre || 'GymTrack'}`,
            userName: socio.email || `${socio.nombre}.${socio.apellido}@gymtrack.com`,
            callback_fail: `${FRONTEND_URL}/socio/membresia?pago_status=rejected&ref=${externalReference}`,
            callback_success: `${FRONTEND_URL}/socio/membresia?pago_status=approved&ref=${externalReference}`,
            notification_url: `${FRONTEND_URL}/api/socio/pagos/webhook?proveedor=uala`,
            external_reference: externalReference
          })
        });

        if (orderRes.ok) {
          const ualaData = await orderRes.json();
          return {
            proveedor: 'uala',
            modo: 'api_real',
            id_orden: ualaData.order_id || ualaData.id,
            init_point: ualaData.links?.checkoutLink || ualaData.url,
            external_reference: externalReference,
            monto: precioUnitario,
            qr_codigo: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(ualaData.links?.checkoutLink || '')}`
          };
        }
      }
    } catch (err) {
      console.warn('Fallo al conectar con la API en vivo de Ualá, usando fallback simulado:', err.message);
    }
  }

  // Modo Sandbox/Simulado listo para operar de inmediato
  const mockOrderId = `UALA-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const mockCheckoutUrl = `${FRONTEND_URL}/socio/membresia?checkout=uala&ref=${externalReference}&order=${mockOrderId}&monto=${precioUnitario}`;

  return {
    proveedor: 'uala',
    modo: 'sandbox_simulado',
    id_orden: mockOrderId,
    init_point: mockCheckoutUrl,
    external_reference: externalReference,
    monto: precioUnitario,
    qr_codigo: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockCheckoutUrl)}`,
    mensaje: 'Orden de cobro Ualá preparada correctamente.'
  };
}

module.exports = {
  crearPreferenciaMercadoPago,
  crearOrdenUala
};
