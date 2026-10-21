/**
 * =========================================================================================
 * ARCHIVO: register.jsx
 * RUTA: frontend/src/pages/register/register.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Página de registro para nuevos dueños/administradores de gimnasio.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 
 * Este componente gestiona el alta de una nueva cuenta de tipo "Dueño".
 * El flujo funcional se desarrolla en los siguientes pasos:
 * 
 * - PASO 1 (Estados Locales): Se almacenan los valores de los inputs (`formData`),
 *   los errores de validación por campo (`errors`), los errores del backend (`backendError`),
 *   el estado de carga (`loading`) y la retroalimentación de éxito (`success`).
 * 
 * - PASO 2 (Captura de Inputs): `handleChange` sincroniza cada pulsación de teclado
 *   con la propiedad correspondiente en el objeto de estado.
 * 
 * - PASO 3 (Validación en el Frontend): `validateForm` comprueba antes del envío:
 *   a) Campos no vacíos (nombre, apellido).
 *   b) Expresión regular para validar formato de correo electrónico.
 *   c) Longitud mínima de la contraseña (mínimo 8 caracteres).
 *   d) Coincidencia idéntica entre "contraseña" y "confirmar contraseña".
 * 
 * - PASO 4 (Envío Asíncrono): `handleSubmit` invoca a `register()` en `authService.js`.
 *   Si la respuesta es exitosa, muestra mensaje verde y programa una redirección
 *   automática a `/login-dueño` en 1.5 segundos. Si falla, despliega el error devuelto por la API.
 * 
 * - PASO 5 (Renderizado JSX): Formulario accesible con labels, inputs con bordes de error dinámicos,
 *   componentes especializados `<PasswordInput />` para alternar visibilidad de contraseña, y enlace al login.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/authService.js';
import logoImg from '../../assets/logo_verde.jpg';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import './register.css';

function Register() {
  // Hook de navegación para redirigir al usuario tras completar el registro
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------------------
  // PASO 1: DEFINICIÓN DE ESTADOS LOCALES (STATE HOOKS)
  // ---------------------------------------------------------------------------------------
  
  // Estado que agrupa los campos del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    contrasena: '',
    confirmarContrasena: '',
  });

  // Objeto con mensajes de error por campo (ej: errors.email = "Ingresá un email válido")
  const [errors, setErrors] = useState({});

  // Mensaje de error general proveniente del servidor (ej: "El correo ya está registrado")
  const [backendError, setBackendError] = useState('');

  // Booleano para deshabilitar botones y mostrar feedback visual mientras el servidor responde
  const [loading, setLoading] = useState(false);

  // Mensaje de éxito tras crear la cuenta satisfactoriamente
  const [success, setSuccess] = useState('');

  // ---------------------------------------------------------------------------------------
  // PASO 2: CONTROLADOR DE CAMBIOS EN LOS CAMPOS (HANDLE CHANGE)
  // ---------------------------------------------------------------------------------------
  const handleChange = (event) => {
    const { name, value } = event.target;
    // Mantiene los valores previos e interactúa dinámicamente con la clave modificada
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ---------------------------------------------------------------------------------------
  // PASO 3: VALIDACIONES PREVIAS AL ENVÍO (FRONTEND VALIDATION)
  // ---------------------------------------------------------------------------------------
  const validateForm = () => {
    const newErrors = {};

    // 1. Validar Nombre
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio.';
    }

    // 2. Validar Apellido
    if (!formData.apellido.trim()) {
      newErrors.apellido = 'El apellido es obligatorio.';
    }

    // 3. Validar Email con Expresión Regular estándar
    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ingresá un email válido.';
    }

    // 4. Validar Longitud de la Contraseña
    if (!formData.contrasena) {
      newErrors.contrasena = 'La contraseña es obligatoria.';
    } else if (formData.contrasena.length < 8) {
      newErrors.contrasena = 'La contraseña debe tener al menos 8 caracteres.';
    }

    // 5. Validar Confirmación de Contraseña y Coincidencia
    if (!formData.confirmarContrasena) {
      newErrors.confirmarContrasena = 'Debés confirmar la contraseña.';
    } else if (formData.contrasena !== formData.confirmarContrasena) {
      newErrors.confirmarContrasena = 'Las contraseñas no coinciden.';
    }

    // Guardar los errores detectados en el estado
    setErrors(newErrors);

    // Retorna true solo si no se registró ningún error
    return Object.keys(newErrors).length === 0;
  };

  // ---------------------------------------------------------------------------------------
  // PASO 4: PROCESAMIENTO Y ENVÍO DEL FORMULARIO (HANDLE SUBMIT)
  // ---------------------------------------------------------------------------------------
  const handleSubmit = async (event) => {
    // Evita la recarga nativa de la página por defecto del evento submit
    event.preventDefault();
    setBackendError('');
    setSuccess('');

    // Si la validación local falla, detenemos el flujo de ejecución
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Llamada al servicio HTTP para registrar al usuario en Supabase/PostgreSQL
      await register({
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        email: formData.email.trim(),
        contrasena: formData.contrasena,
      });

      // Notificación de éxito al usuario
      setSuccess('¡Cuenta creada correctamente! Redirigiendo para iniciar sesión...');

      // Redirigir suavemente tras 1.5 segundos a la pantalla de login de dueño
      setTimeout(() => {
        navigate('/login-dueño');
      }, 1500);
    } catch (error) {
      // Capturar y exhibir mensaje devuelto por el servidor
      setBackendError(error.message);
    } finally {
      // Finalizar estado de carga
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------------------
  // PASO 5: ESTRUCTURA VISUAL Y RENDERIZADO DEL FORMULARIO (JSX)
  // ---------------------------------------------------------------------------------------


  return (
    <main className="register-page">
      <div className="register-card">
        <img src={logoImg} alt="GymTrack Logo" className="register-logo" />

        <div className="register-header">
          <h1>Crear cuenta</h1>
          <p>Registrate como dueño para comenzar a gestionar tu gimnasio</p>
        </div>

        {backendError && (
          <div className="register-alerta register-alerta-error">
            {backendError}
          </div>
        )}

        {success && (
          <div className="register-alerta register-alerta-exito">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="register-form-row">
            <div className="register-form-group">
              <label htmlFor="nombre">Nombre</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Tu nombre"
                className={errors.nombre ? 'register-input-error' : ''}
              />
              {errors.nombre && (
                <span className="register-error-msg">{errors.nombre}</span>
              )}
            </div>

            <div className="register-form-group">
              <label htmlFor="apellido">Apellido</label>
              <input
                id="apellido"
                name="apellido"
                type="text"
                value={formData.apellido}
                onChange={handleChange}
                placeholder="Tu apellido"
                className={errors.apellido ? 'register-input-error' : ''}
              />
              {errors.apellido && (
                <span className="register-error-msg">{errors.apellido}</span>
              )}
            </div>
          </div>

          <div className="register-form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              className={errors.email ? 'register-input-error' : ''}
            />
            {errors.email && (
              <span className="register-error-msg">{errors.email}</span>
            )}
          </div>

          <PasswordInput
            id="contrasena"
            name="contrasena"
            value={formData.contrasena}
            onChange={handleChange}
            placeholder="Mínimo 8 caracteres"
            label="Contraseña"
            error={errors.contrasena}
          />

          <PasswordInput
            id="confirmarContrasena"
            name="confirmarContrasena"
            value={formData.confirmarContrasena}
            onChange={handleChange}
            placeholder="Repetí tu contraseña"
            label="Confirmar contraseña"
            error={errors.confirmarContrasena}
          />

          <button
            type="submit"
            className="register-btn-submit"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="register-footer-text">
          ¿Ya tenés una cuenta?{' '}
          <Link to="/login-dueño">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}

export default Register;