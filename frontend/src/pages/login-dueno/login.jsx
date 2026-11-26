/**
 * =========================================================================================
 * ARCHIVO: login.jsx
 * RUTA: frontend/src/pages/login-dueno/login.jsx
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
import { loginDueno, recuperarContrasena } from '../../services/authService.js'
import { useGymContext } from '../../context/GymContext.jsx'
import logoImg from '../../assets/logo_verde.jpg'
import PasswordInput from '../../components/PasswordInput/PasswordInput'
import LoginRoleTabs from '../../components/LoginRoleTabs/LoginRoleTabs'
import './login.css'

function Login() {
  // Hook de enrutamiento programático
  const navigate = useNavigate()
  const { setSession } = useGymContext()

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
  const [recoveryMsg, setRecoveryMsg] = useState('')

  // Indicador de solicitud en curso para deshabilitar botones
  const [loading, setLoading] = useState(false)
  const [recuperando, setRecuperando] = useState(false)


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
    setRecoveryMsg('')

    // Primero validamos.
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {

      // Autenticación estricta para Dueño (Supabase Auth).
      const data = await loginDueno({
        email: formData.email.trim(),
        contrasena: formData.contrasena,
      })

      setSession({
        token: data.token,
        refresh_token: data.refresh_token,
        usuario: data.usuario,
        gimnasios: data.gimnasios,
        sucursales: data.sucursales,
        sucursales_asignadas: data.sucursales_asignadas,
        contextos_disponibles: data.contextos_disponibles,
        requiere_seleccion_gimnasio: data.requiere_seleccion_gimnasio,
      })

      if (data.requiere_seleccion_gimnasio) {
        navigate('/seleccionar-gimnasio', { replace: true })
        return
      }

      const tieneGym = Boolean(
        data.usuario?.gimnasio?.id_gimnasio ||
        (Array.isArray(data.gimnasios) && data.gimnasios.length > 0)
      )

      if (tieneGym) {
        navigate('/dashboard-dueño', { replace: true })
      } else {
        navigate('/crear-gimnasio-dueño', { replace: true })
      }

    } catch (error) {

      setBackendError(error.message)

    } finally {

      setLoading(false)

    }
  }

  const handleRecuperar = async (event) => {
    event.preventDefault()
    setBackendError('')
    setRecoveryMsg('')
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setBackendError('Ingresá tu correo electrónico arriba para enviarte el enlace de recuperación.')
      document.getElementById('email')?.focus()
      return
    }
    try {
      setRecuperando(true)
      const res = await recuperarContrasena(formData.email.trim())
      setRecoveryMsg(res?.mensaje || 'Si la cuenta existe, enviamos un correo de recuperación.')
    } catch (err) {
      setBackendError(err.message || 'No se pudo solicitar la recuperación de contraseña.')
    } finally {
      setRecuperando(false)
    }
  }

  return (

    <main className="login-page">

      <div className="login-shell">

        <LoginRoleTabs activeRole="dueño" />

        <div className="login-card">

        {/* LOGO */}

        <img
          src={logoImg}
          alt="GymTrack Logo"
          className="login-logo"
        />

        {/* TÍTULO */}

        <h1>Portal del Dueño</h1>

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

          <div className="login-recovery-row">
            <button
              type="button"
              className="login-forgot-btn"
              onClick={handleRecuperar}
              disabled={loading || recuperando}
            >
              {recuperando ? 'Enviando enlace...' : '¿Olvidaste tu contraseña?'}
            </button>
          </div>

          {recoveryMsg && (
            <div
              style={{
                background: 'rgba(158, 240, 26, 0.1)',
                border: '1px solid rgba(158, 240, 26, 0.35)',
                color: '#d9f99d',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.85rem',
                marginBottom: '10px'
              }}
            >
              {recoveryMsg}
            </div>
          )}

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

          {/* <div className="google-section">

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

          </div> */}

        </form>

      </div>

      </div>

    </main>
  )
}

export default Login