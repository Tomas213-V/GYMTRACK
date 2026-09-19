const express = require('express');
const router = express.Router();
const {
  createAsistencia,
  getAsistencias,
  getAsistenciasBySocio,
  checkoutAsistencia
} = require('../controllers/asistenciaController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.post('/', createAsistencia);
router.get('/', getAsistencias);
router.get('/socio/:id_socio', getAsistenciasBySocio);
router.patch('/:id/checkout', checkoutAsistencia);

module.exports = router;