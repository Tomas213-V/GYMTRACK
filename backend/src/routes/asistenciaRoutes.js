const express = require('express');
const router = express.Router();
const {
  getAsistencias,
  registrarAsistencia,
  getEstadisticas,
  getAsistenciasPorSocio,
  eliminarAsistencia
} = require('../controllers/asistenciaController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Middleware opcional para desarrollo / pruebas que no rechaza si no hay token pero lo decodifica si viene
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyToken(req, res, next);
  }
  // Si no hay token, continúa (el controlador verificará req.usuario o req.query/req.body)
  next();
};

// Endpoints de asistencias
router.get('/', optionalAuth, getAsistencias);
router.post('/', optionalAuth, registrarAsistencia);
router.get('/estadisticas', optionalAuth, getEstadisticas);
router.get('/socio/:id_socio', optionalAuth, getAsistenciasPorSocio);
router.delete('/:id', optionalAuth, eliminarAsistencia);

module.exports = router;
