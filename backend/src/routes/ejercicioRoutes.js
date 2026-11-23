const express = require('express');
const router = express.Router();
const {
  getEjercicios,
  getEjerciciosDisponiblesSocio,
  getEjercicioById,
  crearEjercicio,
  crearEjercicioPersonalizado,
  actualizarEjercicio,
  eliminarEjercicio
} = require('../controllers/ejercicioController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Todas las rutas de ejercicios requieren autenticación Supabase Auth
router.use(verifyToken);

router.get('/disponibles', getEjerciciosDisponiblesSocio);
router.post('/personalizado', crearEjercicioPersonalizado);
router.get('/', getEjercicios);
router.get('/:id', getEjercicioById);
router.post('/', crearEjercicio);
router.put('/:id', actualizarEjercicio);
router.delete('/:id', eliminarEjercicio);

module.exports = router;
