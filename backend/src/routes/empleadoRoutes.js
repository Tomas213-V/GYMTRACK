const express = require('express');
const router = express.Router();
const {
  getEmpleados,
  getEmpleadoById,
  createEmpleado,
  updateEmpleado,
  cambiarEstadoEmpleado
} = require('../controllers/empleadoController');
const { verifyToken, requireRoles, requireGimnasioAccess } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(requireGimnasioAccess);

// Lectura: dueño y empleados con rol administrador
router.get('/', requireRoles('dueño', 'empleado:administrador'), getEmpleados);
router.get('/:id', requireRoles('dueño', 'empleado:administrador'), getEmpleadoById);

// Gestión completa: exclusivamente dueño
router.post('/', requireRoles('dueño'), createEmpleado);
router.put('/:id', requireRoles('dueño'), updateEmpleado);
router.patch('/:id/estado', requireRoles('dueño'), cambiarEstadoEmpleado);

module.exports = router;
