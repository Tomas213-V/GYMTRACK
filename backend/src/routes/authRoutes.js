const express = require('express');
const router = express.Router();

// Importamos únicamente el controlador que ya creaste
const { registerOwner } = require('../controllers/authController');

// Ruta POST para el registro de dueño
router.post('/register', registerOwner);

module.exports = router;