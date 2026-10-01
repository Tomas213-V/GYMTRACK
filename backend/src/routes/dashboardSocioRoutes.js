const express = require('express');
const router = express.Router();
const { getDashboardSocio } = require('../controllers/dashboardSocioController');
const {
  getMiMembresia,
  getPlanesDisponibles,
  solicitarActualizacion,
  iniciarPago,
  confirmarPago,
  verificarPagoMercadoPago,
  webhookPago
} = require('../controllers/socioMembresiaController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Endpoint público para webhooks de pasarelas de pago (Mercado Pago / Ualá)
router.post('/pagos/webhook', webhookPago);

// Rutas que requieren autenticación JWT obligatoria del socio
router.use(verifyToken);

// Dashboard general del socio
router.get('/dashboard', getDashboardSocio);

// Módulo de Mi Membresía del socio
router.get('/membresia', getMiMembresia);
router.get('/planes-disponibles', getPlanesDisponibles);
router.post('/membresia/actualizar', solicitarActualizacion);

// Integración y registro de pagos con Mercado Pago y Ualá
router.post('/pagos/iniciar', iniciarPago);
router.post('/pagos/confirmar', confirmarPago);
router.get('/pagos/verificar-mp', verificarPagoMercadoPago);

module.exports = router;