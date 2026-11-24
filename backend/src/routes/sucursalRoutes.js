const express = require('express');
const router = express.Router();
const {
  getSucursales,
  getSucursalById,
  createSucursal,
  updateSucursal,
  cambiarEstadoSucursal,
  deleteSucursal
} = require('../controllers/sucursalController');
const { verifyToken, requireRoles, requireGimnasioAccess } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(requireGimnasioAccess);

// Lectura: dueño, empleado (sus sucursales) y socio (sucursales activas del gym)
router.get('/', getSucursales);
router.get('/:id', getSucursalById);

// Escritura: exclusivamente Dueño
router.post('/', requireRoles('dueño'), createSucursal);
router.put('/:id', requireRoles('dueño'), updateSucursal);
router.patch('/:id/estado', requireRoles('dueño'), cambiarEstadoSucursal);
router.delete('/:id', requireRoles('dueño'), deleteSucursal);

module.exports = router;
