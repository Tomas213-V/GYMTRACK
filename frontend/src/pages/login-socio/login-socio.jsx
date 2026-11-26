/**
 * =========================================================================================
 * ARCHIVO: login-socio.jsx
 * RUTA: frontend/src/pages/login-socio/login-socio.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Pantalla de inicio de sesión exclusiva para Socios y Alumnos del Gimnasio.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 1. PASO 1 (Campos Requeridos): A diferencia del dueño, el socio valida su identidad mediante
 *    una combinación de Email, Documento de Identidad (DNI) y Contraseña.
 * 2. PASO 2 (Validación Local): Comprueba la estructura sintáctica de los campos obligatorios.
 * 3. PASO 3 (Aislamiento de Sesión):
 *    - Limpia rastros de sesiones de dueño (`localStorage.removeItem('usuario')`).
 *    - Persiste el token JWT y el objeto específico del socio (`localStorage.setItem('socio')`).
 *    - Fija el rol en `'socio'` para que `ProtectedRoute` le permita acceder a su portal.
 * 4. PASO 4 (Redirección): Al autenticarse con éxito, navega automáticamente a `/dashboard-socio`.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginSocio, recuperarContrasena } from '../../services/authService.js'
import { useGymContext } from '../../context/GymContext.jsx'
import logoImg from '../../assets/logo_verde.jpg'
import PasswordInput from '../../components/PasswordInput/PasswordInput'
import LoginRoleTabs from '../../components/LoginRoleTabs/LoginRoleTabs'
import '../login-dueno/login.css'

function LoginSocio() {
  const navigate = useNavigate()
  const { setSession } = useGymContext()

  // ---------------------------------------------------------------------------------------
  // PASO 1: ESTADO LOCAL DEL FORMULARIO DE ACCESO DEL SOCIO
  // ---------------------------------------------------------------------------------------
  const [formData, setFormData] = useState({
    email: '',
    dni: '',
    contrasena: '',
  })


  const [errors, setErrors] = useState({})
  const [backendError, setBackendError] = useState('')
  const [recoveryMsg, setRecoveryMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Ingresá un email válido.'
    }

    if (!formData.dni.trim()) {
      newErrors.dni = 'El DNI es obligatorio.'
    }

    if (!formData.contrasena) {
      newErrors.contrasena = 'La contraseña es obligatoria.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBackendError('')
    setRecoveryMsg('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const data = await loginSocio({
        email: formData.email.trim(),
        dni: formData.dni.trim(),
        contrasena: formData.contrasena,
      })

      setSession({
        token: data.token,
        refresh_token: data.refresh_token,
        usuario: data.usuario,
        socio: data.socio,
        gimnasios: data.gimnasios,
        contextos_disponibles: data.contextos_disponibles,
        requiere_seleccion_gimnasio: data.requiere_seleccion_gimnasio,
      })

      if (data.requiere_seleccion_gimnasio) {
        navigate('/seleccionar-gimnasio', { replace: true })
      } else {
        navigate('/dashboard-socio', { replace: true })
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
      setBackendError('Ingresá tu correo electrónico arriba para recibir el enlace de recuperación.')
      return
    }
    try {
      const res = await recuperarContrasena(formData.email.trim())
      setRecoveryMsg(res?.mensaje || 'Si la cuenta existe, enviamos un correo de recuperación.')
    } catch (err) {
      setBackendError(err.message || 'No se pudo solicitar la recuperación de contraseña.')
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <LoginRoleTabs activeRole="socio" />
        <div className="login-card">
          {/* LOGO */}
          <img
            src={logoImg}
            alt="GymTrack Logo"
            className="login-logo"
          />

          {/* TÍTULO */}
          <h1>Portal del Socio</h1>

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
                placeholder="socio@email.com"
                autoComplete="email"
              />
              {errors.email && (
                <span className="login-error">
                  {errors.email}
                </span>
              )}
            </div>

            {/* DNI */}
            <div className="login-form-group">
              <label htmlFor="dni">
                DNI
              </label>
              <input
                id="dni"
                name="dni"
                type="text"
                value={formData.dni}
                onChange={handleChange}
                placeholder="Ej: 39123456"
                autoComplete="off"
                required
              />
              {errors.dni && (
                <span className="login-error">
                  {errors.dni}
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
                disabled={loading}
              >
                ¿Olvidaste tu contraseña?
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

            {/* BOTÓN INICIAR SESIÓN */}
            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Ingresar como Socio'}
            </button>

            {/* BOTÓN ACTIVAR CUENTA / CREAR CONTRASEÑA DE SOCIO */}
            
          </form>
        </div>
      </div>
    </main>
  )
}

export default LoginSocio
