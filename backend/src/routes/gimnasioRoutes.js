const express = require('express');
const router = express.Router();
const {
  listarMisGimnasios,
  listarCatalogoGimnasios,
  crearGimnasio,
  obtenerMiGimnasio,
  actualizarMiGimnasio
} = require('../controllers/gimnasioController');
const { verifyToken, requireRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/', listarMisGimnasios);
router.get('/catalogo', listarCatalogoGimnasios);
router.get('/mi-gimnasio', obtenerMiGimnasio);
router.post('/', requireRoles('dueño'), crearGimnasio);
router.put('/mi-gimnasio', requireRoles('dueño'), actualizarMiGimnasio);
router.put('/:id', requireRoles('dueño'), actualizarMiGimnasio);

module.exports = router;
