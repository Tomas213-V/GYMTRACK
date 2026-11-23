const express = require('express');
const router = express.Router();
const {
  getAsistencias,
  registrarAsistencia,
  getEstadisticas,
  getAsistenciasPorSocio,
  eliminarAsistencia,
  checkoutAsistencia
} = require('../controllers/asistenciaController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Todas las rutas de asistencias requieren autenticación obligatoria
router.use(verifyToken);

router.get('/', getAsistencias);
router.post('/', registrarAsistencia);
router.get('/estadisticas', getEstadisticas);
router.get('/socio/:id_socio', getAsistenciasPorSocio);
router.patch('/:id/checkout', checkoutAsistencia);
router.patch('/:id/anular', eliminarAsistencia);
router.delete('/:id', eliminarAsistencia);

module.exports = router;
