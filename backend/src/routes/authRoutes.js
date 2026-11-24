const express = require('express');
const router = express.Router();

const {
  registerOwner,
  registerSocio,
  login,
  loginSocio,
  refreshSession,
  getMe,
  updateOwnerProfile
} = require('../controllers/authController');

const { verifyToken } = require('../middlewares/authMiddleware');

// Registro y autenticación con Supabase Auth
router.post('/register', registerOwner);
router.post('/register-socio', registerSocio);
router.post('/login', login);
router.post('/login-socio', loginSocio);
router.post('/refresh', refreshSession);

// Perfil autenticado
router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateOwnerProfile);
router.put('/perfil', verifyToken, updateOwnerProfile);

module.exports = router;
