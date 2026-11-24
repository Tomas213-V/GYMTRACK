const express = require('express');
const router = express.Router();
const {
  getSocios,
  getPerfilSocio,
  updatePerfilSocio,
  getSocioById,
  createSocio,
  updateSocio,
  changeEstadoSocio,
  deleteSocio,
  verificarDniSocio
} = require('../controllers/socioController');
const { verifyToken, requireRoles, requireGimnasioAccess } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Perfil del socio (accesible por el propio socio o staff autorizado)
router.get('/perfil', getPerfilSocio);
router.put('/perfil', updatePerfilSocio);

// Verificación de DNI/email y gestión de socios por gimnasio (Dueño / Staff)
router.get(
  '/verificar-dni',
  requireRoles('dueño', 'empleado:administrador', 'empleado:recepcionista'),
  requireGimnasioAccess,
  verificarDniSocio
);

router.get(
  '/',
  requireRoles('dueño', 'empleado:administrador', 'empleado:recepcionista', 'empleado:entrenador'),
  requireGimnasioAccess,
  getSocios
);

router.get('/:id', getSocioById);

router.post(
  '/',
  requireRoles('dueño', 'empleado:administrador', 'empleado:recepcionista'),
  requireGimnasioAccess,
  createSocio
);

router.put(
  '/:id',
  requireRoles('dueño', 'empleado:administrador', 'empleado:recepcionista'),
  requireGimnasioAccess,
  updateSocio
);

router.patch(
  '/:id/estado',
  requireRoles('dueño', 'empleado:administrador', 'empleado:recepcionista'),
  requireGimnasioAccess,
  changeEstadoSocio
);

router.delete(
  '/:id',
  requireRoles('dueño', 'empleado:administrador'),
  requireGimnasioAccess,
  deleteSocio
);

module.exports = router;
