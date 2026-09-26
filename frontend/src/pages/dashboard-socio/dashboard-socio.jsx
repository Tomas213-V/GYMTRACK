import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaUserCircle, FaDumbbell, FaSignOutAlt, FaCalendarCheck } from 'react-icons/fa'
import './dashboard-socio.css'

function DashboardSocio() {
  const navigate = useNavigate()
  const socio = (() => {
    try {
      return JSON.parse(localStorage.getItem('socio') || localStorage.getItem('usuario') || '{}')
    } catch {
      return {}
    }
  })()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    localStorage.removeItem('socio')
    localStorage.removeItem('rol')
    navigate('/login-socio')
  }

  return (
    <div className="socio-dash-page">
      <div className="socio-dash-card">
        <div className="socio-dash-header">
          <FaUserCircle className="socio-dash-avatar" />
          <h1>¡Bienvenido, {socio.nombre || 'Socio'}!</h1>
          <p className="socio-dash-sub">
            Has iniciado sesión correctamente en el <strong>Portal de Socios</strong> de {socio.gimnasio?.nombre || 'GymTrack'}.
          </p>
        </div>

        <div className="socio-dash-info-box">
          <div className="socio-dash-info-item">
            <span className="info-label">DNI</span>
            <span className="info-val">{socio.dni || 'S/D'}</span>
          </div>
          <div className="socio-dash-info-item">
            <span className="info-label">Email</span>
            <span className="info-val">{socio.email || 'S/D'}</span>
          </div>
          <div className="socio-dash-info-item">
            <span className="info-label">Estado</span>
            <span className="info-val badge-activo">{socio.estado || 'Activo'}</span>
          </div>
        </div>

        <div className="socio-dash-proximamente">
          <FaDumbbell className="proximamente-icon" />
          <h3>Panel de Rutinas y Seguimiento</h3>
          <p>
            El dashboard completo para socios con tus rutinas, asistencias, pagos y métricas de progreso se encuentra en desarrollo y estará disponible próximamente.
          </p>
        </div>

        <button onClick={handleLogout} className="socio-dash-logout-btn">
          <FaSignOutAlt />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  )
}

export default DashboardSocio
