const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');

// LOG DE DIAGNÓSTICO: Nos muestra en la consola qué funciones se importaron
console.log("Funciones importadas del controlador:", pagoController);

const {
  getPagos,
  getPagoById,
  registrarPago,
  actualizarEstadoPago,
  getResumenPagos
} = pagoController;

// Definición de Endpoints
router.get('/', getPagos);
router.get('/resumen', getResumenPagos); // encima de id para evitar conflictos con la ruta de obtener pago por ID
router.get('/:id', getPagoById);
router.post('/', registrarPago);
router.patch('/:id/estado', actualizarEstadoPago);

module.exports = router;