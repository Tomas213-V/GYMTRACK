const express = require('express');
const router = express.Router();
const {
  getMembresias,
  getMembresiaById,
  createMembresia,
  updateMembresia,
  deleteMembresia
} = require('../controllers/membresiaController');
const { verifyToken, requireRoles, requireGimnasioAccess } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(requireRoles('dueño', 'empleado:administrador', 'empleado:recepcionista'));
router.use(requireGimnasioAccess);

router.get('/', getMembresias);
router.get('/:id', getMembresiaById);
router.post('/', createMembresia);
router.patch('/:id', updateMembresia);
router.delete('/:id', requireRoles('dueño', 'empleado:administrador'), deleteMembresia);

module.exports = router;
