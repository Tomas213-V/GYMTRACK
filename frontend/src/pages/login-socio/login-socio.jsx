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
import { Link, useNavigate } from 'react-router-dom'
import { loginSocio } from '../../services/authService.js'
import logoImg from '../../assets/logo_verde.jpg'
import PasswordInput from '../../components/PasswordInput/PasswordInput'
import '../login/login.css'

function LoginSocio() {
  const navigate = useNavigate()

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

      // Limpiamos datos previos de usuario dueño para evitar interferencia
      localStorage.removeItem('usuario')

      // Guardamos la sesión
      localStorage.setItem('token', data.token)
      if (data.usuario) {
        localStorage.setItem('usuario', JSON.stringify(data.usuario))
      }
      localStorage.setItem('socio', JSON.stringify(data.socio))
      localStorage.setItem('rol', 'socio')

      // Redireccionar al dashboard de socios
      navigate('/dashboard-socio')

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

          {/* ENLACES */}
          <div className="login-links">
            <Link to="/login-dueño">
              ¿Eres dueño? Iniciar como dueño
            </Link>

            <a
              href="#"
              onClick={(event) => {
                event.preventDefault()
                alert('Para recuperar tu contraseña, comunicate con la recepción o administración de tu gimnasio.')
              }}
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

          {/* BOTÓN INICIAR SESIÓN */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Ingresar como Socio'}
          </button>

          {/* BOTÓN REGRESAR AL LOGIN DE DUEÑO */}
          <Link
            to="/login-dueño"
            className="register-button-login"
          >
            Acceso para Administradores
          </Link>
        </form>
      </div>
    </main>
  )
}

export default LoginSocio
