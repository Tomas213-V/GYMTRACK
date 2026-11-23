const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const { verifyToken, requireRoles, requireGimnasioAccess } = require('../middlewares/authMiddleware');

const {
  getPagos,
  getPagoById,
  registrarPago,
  actualizarEstadoPago,
  eliminarPago,
  getResumenPagos,
  getMembresias,
  getPlanes
} = pagoController;

// Todas las rutas de pagos requieren autenticación y rol autorizado
router.use(verifyToken);
router.use(requireRoles('dueño', 'empleado:administrador', 'empleado:recepcionista'));
router.use(requireGimnasioAccess);

router.get('/', getPagos);
router.get('/resumen', getResumenPagos);
router.get('/membresias', getMembresias);
router.get('/planes', getPlanes);
router.get('/:id', getPagoById);
router.post('/', registrarPago);
router.patch('/:id/estado', actualizarEstadoPago);
router.delete('/:id', eliminarPago);

module.exports = router;
