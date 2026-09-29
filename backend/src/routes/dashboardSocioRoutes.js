const express = require('express');
const router = express.Router();
const { getDashboardSocio } = require('../controllers/dashboardSocioController');
const { getPerfilSocio, updatePerfilSocio } = require('../controllers/perfilSocioController');
const { verifyToken } = require('../middlewares/authMiddleware');

// La ruta requiere autenticación obligatoria
router.use(verifyToken);

router.get('/dashboard', getDashboardSocio);

// Perfil del socio autenticado
router.get('/perfil', getPerfilSocio);
router.put('/perfil', updatePerfilSocio);

module.exports = router;