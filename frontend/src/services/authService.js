/**
 * =========================================================================================
 * ARCHIVO: authService.js
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Servicio cliente para comunicación con la API de autenticación y sesiones.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * 1. Base URL: Utiliza la variable de entorno `VITE_API_URL` si está definida, o hace fallback
 *    al puerto local por defecto (`http://localhost:3000/api`).
 * 2. Formato de comunicación: Emplea peticiones HTTP con `Content-Type: application/json`.
 * 3. Manejo de Errores: Analiza `response.ok`; si el backend responde con código 4xx o 5xx,
 *    extrae el mensaje de error personalizado devuelto por el servidor y lanza una excepción.
 * 4. Métodos expuestos:
 *    - `register()`: Registro de un nuevo usuario dueño.
 *    - `login()`: Inicio de sesión de dueño de gimnasio.
 *    - `loginSocio()`: Inicio de sesión de socio / alumno.
 *    - `isAuthenticated()`: Verificación sincrónica del token JWT en localStorage.
 */

// URL base de la API backend (configurable por .env)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// =========================================================================================
// 1. REGISTRO DE DUEÑO DE GIMNASIO
// =========================================================================================
/**
 * Registra un nuevo dueño en la base de datos a través del endpoint /auth/register.
 * 
 * @param {Object} userData - Datos de la cuenta
 * @param {string} userData.nombre - Nombre del dueño
 * @param {string} userData.apellido - Apellido del dueño
 * @param {string} userData.email - Correo electrónico único
 * @param {string} userData.contrasena - Contraseña en texto plano (el backend la hashea con bcrypt)
 * @returns {Promise<Object>} Respuesta JSON del servidor con el usuario creado
 * @throws {Error} Mensaje descriptivo si el email ya existe o los datos son inválidos
 */
export async function register(userData) {
  // PASO A: Enviar solicitud POST con el cuerpo serializado en JSON
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  })

  // PASO B: Procesar la respuesta JSON del servidor
  const data = await response.json()

  // PASO C: Si el código de estado no es 2xx, lanzar el error para que la UI lo capture
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo completar el registro.')
  }

  return data
}

// =========================================================================================
// 2. INICIO DE SESIÓN DE DUEÑO
// =========================================================================================
/**
 * Autentica a un dueño de gimnasio validando email y contraseña.
 * 
 * @param {Object} userData
 * @param {string} userData.email
 * @param {string} userData.contrasena
 * @returns {Promise<{token: string, usuario: Object}>} Token JWT y datos del usuario con su gimnasio
 */
export async function login(userData) {
  // PASO A: Enviar credenciales al endpoint de login de dueño
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  })

  // PASO B: Leer la respuesta del backend
  const data = await response.json()

  // PASO C: Validar si las credenciales fueron correctas
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo iniciar sesión.')
  }

  // Retorna el objeto con token JWT y perfil del usuario
  return data
}

// =========================================================================================
// 3. INICIO DE SESIÓN DE SOCIO / ALUMNO
// =========================================================================================
/**
 * Autentica a un socio del gimnasio.
 * 
 * @param {Object} userData
 * @param {string} userData.identificador - Email o DNI del socio
 * @param {string} userData.contrasena - Clave de acceso
 * @returns {Promise<{token: string, socio: Object, usuario: Object}>} Datos del socio y token de sesión
 */
export async function loginSocio(userData) {
  // PASO A: Enviar credenciales al endpoint especializado para socios
  const response = await fetch(`${API_URL}/auth/login-socio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  })

  // PASO B: Procesar respuesta
  const data = await response.json()

  // PASO C: Validar resultado
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo iniciar sesión como socio.')
  }

  return data
}

// =========================================================================================
// 4. VERIFICACIÓN DE SESIÓN ACTIVA
// =========================================================================================
/**
 * Comprueba de manera síncrona si existe un token en el almacenamiento local del navegador.
 * Es utilizado por guardas de rutas y componentes para renderizado condicional.
 * 
 * @returns {boolean} True si hay un token persistido, False en caso contrario.
 */
export function isAuthenticated() {
  return localStorage.getItem('token') !== null
}

// =========================================================================================
// 5. PERFIL DE USUARIO / DUEÑO
// =========================================================================================
/**
 * Obtiene los datos del usuario autenticado (dueño y su gimnasio asociado)
 * @returns {Promise<Object>} Objeto con datos del usuario y su gimnasio
 */
export async function getPerfilOwner() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener datos del perfil de administrador.');
  }

  return data;
}

/**
 * Actualiza los datos personales o contraseña del dueño
 * @param {Object} datos - { nombre, apellido, email, contrasena_actual, nueva_contrasena }
 * @returns {Promise<Object>} Objeto con usuario actualizado y nuevo token si corresponde
 */
export async function updatePerfilOwner(datos) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/auth/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(datos)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error al actualizar el perfil.');
  }

  return data;
}