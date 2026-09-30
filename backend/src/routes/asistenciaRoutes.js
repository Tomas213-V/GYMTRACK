const express = require('express');
const router = express.Router();
const { 
  registrarIngreso, 
  registrarSalida, 
  obtenerHistorial, 
  obtenerEstadoHoy 
} = require('../controllers/asistenciaController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.post('/ingreso', verifyToken, registrarIngreso);
router.post('/salida', verifyToken, registrarSalida);
router.get('/historial', verifyToken, obtenerHistorial);
router.get('/estado-hoy', verifyToken, obtenerEstadoHoy);

module.exports = router;