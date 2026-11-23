const express = require('express');
const router = express.Router();
const {
  getPlanesMembresia,
  getPlanMembresiaById,
  createPlanMembresia,
  updatePlanMembresia,
  deshabilitarPlanMembresia,
  deletePlanMembresia
} = require('../controllers/planMembresiaController');
const { verifyToken, requireRoles, requireGimnasioAccess } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(requireGimnasioAccess);

// Lectura: dueño, empleados y socios del gimnasio
router.get('/', getPlanesMembresia);
router.get('/:id', getPlanMembresiaById);

// Escritura: dueño y empleado administrador
router.post('/', requireRoles('dueño', 'empleado:administrador'), createPlanMembresia);
router.put('/:id', requireRoles('dueño', 'empleado:administrador'), updatePlanMembresia);
router.patch('/:id/desactivar', requireRoles('dueño', 'empleado:administrador'), deshabilitarPlanMembresia);
router.delete('/:id', requireRoles('dueño', 'empleado:administrador'), deletePlanMembresia);

module.exports = router;
