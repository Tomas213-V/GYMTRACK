/**
 * =========================================================================================
 * ARCHIVO: login.jsx
 * RUTA: frontend/src/pages/login/login.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Pantalla de inicio de sesión para el rol Dueño / Administrador de Gimnasio.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 
 * 1. PASO 1 (Manejo de Estado): Se declaran los estados reactivos para email, contraseña,
 *    errores de validación de campos, errores de autenticación de red/backend, y estado `loading`.
 * 
 * 2. PASO 2 (Validación Previa): Se comprueba que el email posea estructura sintáctica válida
 *    y que el campo de contraseña no se encuentre vacío.
 * 
 * 3. PASO 3 (Autenticación y Persistencia):
 *    - Se despacha la petición `login()` a la API backend.
 *    - Se borran sesiones previas de rol socio (`localStorage.removeItem('socio')`) para evitar colisiones.
 *    - Se persiste el token JWT (`token`), el rol (`dueño`) y el objeto serializado del usuario (`usuario`).
 * 
 * 4. PASO 4 (Enrutamiento Condicional):
 *    - Si el usuario YA tiene un gimnasio creado (`data.usuario.gimnasio.id_gimnasio`), se lo envía a `/dashboard-dueño`.
 *    - Si es un usuario recién registrado sin gimnasio, se lo redirige inmediatamente a `/crear-gimnasio-dueño`.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../services/authService.js'
import logoImg from '../../assets/logo_verde.jpg'
import PasswordInput from '../../components/PasswordInput/PasswordInput'
import './login.css'

function Login() {
  // Hook de enrutamiento programático
  const navigate = useNavigate()

  // ---------------------------------------------------------------------------------------
  // PASO 1: DEFINICIÓN DE ESTADOS REACTIVOS
  // ---------------------------------------------------------------------------------------

  // Estado con las credenciales ingresadas por el dueño
  const [formData, setFormData] = useState({
    email: '',
    contrasena: '',
  })

  // Errores de validación por campo individual
  const [errors, setErrors] = useState({})

  // Mensaje de error devuelto por la API (ej: "Credenciales incorrectas")
  const [backendError, setBackendError] = useState('')

  // Indicador de solicitud en curso para deshabilitar botones
  const [loading, setLoading] = useState(false)


  // Actualiza los campos del formulario.
  const handleChange = (event) => {

    const { name, value } = event.target

    setFormData({
      ...formData,
      [name]: value,
    })

  }

  // Validaciones antes de enviar.
  const validateForm = () => {

    const newErrors = {}

    if (!formData.email.trim()) {

      newErrors.email = 'El email es obligatorio.'

    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    ) {

      newErrors.email = 'Ingresá un email válido.'

    }

    if (!formData.contrasena) {

      newErrors.contrasena = 'La contraseña es obligatoria.'

    }

    setErrors(newErrors)

    return Object.keys(newErrors).length === 0
  }

  // Envío del formulario.
  const handleSubmit = async (event) => {

    event.preventDefault()

    setBackendError('')

    // Primero validamos.
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {

      // Mandamos los datos al backend.
      const data = await login({
        email: formData.email,
        contrasena: formData.contrasena,
      })

      console.log('Login exitoso:', data)

      // Limpiar sesión de socio para evitar colisiones entre roles
      localStorage.removeItem('socio')

      // Guardamos el token JWT.
      localStorage.setItem('token', data.token)

      // Guardamos el rol explícitamente como dueño.
      localStorage.setItem('rol', 'dueño')

      // Guardamos también los datos del usuario.
      localStorage.setItem(
        'usuario',
        JSON.stringify(data.usuario)
      )

      // Comprobamos si el usuario tiene un gimnasio asociado.
      if (data.usuario?.gimnasio?.id_gimnasio) {
        navigate('/dashboard-dueño')
      } else {
        navigate('/crear-gimnasio-dueño')
      }

    } catch (error) {

      setBackendError(error.message)

    } finally {

      setLoading(false)

    }
  }

  return (

    <main className="login-page">

      <div className="login-card">

        {/* LOGO */}

        <img
          src={logoImg}
          alt="GymTrack Logo"
          className="login-logo"
        />

        {/* TÍTULO */}

        <h1>Iniciar sesión</h1>

        {/* FORMULARIO */}

        <form onSubmit={handleSubmit}>

          {/* EMAIL */}

          <div className="login-form-group">

            <label htmlFor="email">
              Correo electrónico
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tucorreo@gmail.com"
              autoComplete="email"
            />

            {errors.email && (
              <span className="login-error">
                {errors.email}
              </span>
            )}

          </div>

          {/* CONTRASEÑA */}

          <PasswordInput
            id="contrasena"
            name="contrasena"
            value={formData.contrasena}
            onChange={handleChange}
            placeholder="************"
            label="Contraseña"
            error={errors.contrasena}
            />

          {/* LINKS */}

          <div className="login-links">

            <Link to="/login-socio">
              ¿Eres socio?
            </Link>

            <a
              href="#"
              onClick={(event) => event.preventDefault()}
            >
              ¿Olvidaste tu contraseña?
            </a>

          </div>

          {/* ERROR DEL BACKEND */}

          {backendError && (

            <div className="login-backend-error">
              {backendError}
            </div>

          )}

          {/* BOTÓN LOGIN */}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >

            {loading
              ? 'Iniciando sesión...'
              : 'Iniciar sesión'}

          </button>

          {/* BOTÓN REGISTRARSE */}

          <Link
            to="/register-dueño"
            className="register-button-login"
          >
            Registrarse
          </Link>


          {/* GOOGLE */}

          <div className="google-section">

            <span>Continuar con</span>

            <button
              type="button"
              className="google-button"
              onClick={() => {
                alert('Inicio de sesión con Google próximamente.')
              }}
            >
              <span className="google-letter">
                G
              </span>

            </button>

          </div>

        </form>

      </div>

    </main>
  )
}

export default Login