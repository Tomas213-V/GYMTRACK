const express = require('express');
const router = express.Router();
const { getDashboardAdmin } = require('../controllers/dashboardController');
const { verifyToken, requireRoles, requireGimnasioAccess } = require('../middlewares/authMiddleware');

router.get(
  '/admin',
  verifyToken,
  requireRoles('dueño', 'empleado'),
  requireGimnasioAccess,
  getDashboardAdmin
);

module.exports = router;
