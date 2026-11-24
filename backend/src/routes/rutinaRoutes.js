const express = require('express');
const router = express.Router();
const rutinaController = require('../controllers/rutinaController');
const { validateRutina, validateEjercicioAsociacion } = require('../middlewares/rutinaValidator');
const { verifyToken, requireRoles } = require('../middlewares/authMiddleware');

// Todas las rutas de rutinas requieren autenticación Supabase Auth y rol autorizado (excluye recepcionista)
router.use(verifyToken);
router.use(requireRoles('socio', 'dueño', 'empleado:administrador', 'empleado:entrenador'));

// Endpoints de Rutinas
router.put('/:id/activar', rutinaController.activarRutina);
router.put('/:id/ejercicios/reordenar', rutinaController.reordenarEjerciciosRutina);

router.get('/', rutinaController.getAllRutinas);
router.get('/:id', rutinaController.getRutinaById);
router.post('/', validateRutina, rutinaController.createRutina);
router.put('/:id', validateRutina, rutinaController.updateRutina);
router.delete('/:id', rutinaController.deleteRutina);

// Endpoints de relación N:M con Ejercicios
router.get('/:id/ejercicios', rutinaController.getEjerciciosByRutina);
router.post('/:id/ejercicios', validateEjercicioAsociacion, rutinaController.addEjercicioToRutina);
router.put('/:id/ejercicios/:ejercicioId', rutinaController.updateEjercicioEnRutina);
router.delete('/:id/ejercicios/:ejercicioId', rutinaController.removeEjercicioFromRutina);

module.exports = router;
