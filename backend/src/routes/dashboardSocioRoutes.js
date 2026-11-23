const express = require('express');
const router = express.Router();
const {
  getDashboardSocio,
  registrarCheckinSocio,
  registrarCheckoutSocio,
  registrarProgresoSocio
} = require('../controllers/dashboardSocioController');
const {
  getMiMembresia,
  getPlanesDisponibles,
  solicitarActualizacion,
  iniciarPago,
  confirmarPago,
  verificarPagoMercadoPago,
  webhookPago
} = require('../controllers/socioMembresiaController');
const {
  getEjerciciosSocio,
  crearEjercicioSocio,
  actualizarEjercicioSocio,
  eliminarEjercicioSocio
} = require('../controllers/socioEjercicioController');
const { verifyToken, requireRoles } = require('../middlewares/authMiddleware');

// Webhook público de pasarelas de pago
router.post('/pagos/webhook', webhookPago);

// Rutas protegidas para socios autenticados
router.use(verifyToken);
router.use(requireRoles('socio'));

// Dashboard, check-in/out y progreso del socio
router.get('/dashboard', getDashboardSocio);
router.post('/checkin', registrarCheckinSocio);
router.post('/checkout', registrarCheckoutSocio);
router.post('/progreso', registrarProgresoSocio);

// Membresías y pagos multigimnasio del socio
router.get('/membresia', getMiMembresia);
router.get('/planes-disponibles', getPlanesDisponibles);
router.post('/membresia/actualizar', solicitarActualizacion);
router.post('/pagos/iniciar', iniciarPago);
router.post('/pagos/confirmar', confirmarPago);
router.get('/pagos/verificar-mp', verificarPagoMercadoPago);

// Ejercicios del gimnasio seleccionado + personales
router.get('/ejercicios', getEjerciciosSocio);
router.post('/ejercicios', crearEjercicioSocio);
router.put('/ejercicios/:id', actualizarEjercicioSocio);
router.delete('/ejercicios/:id', eliminarEjercicioSocio);

module.exports = router;
