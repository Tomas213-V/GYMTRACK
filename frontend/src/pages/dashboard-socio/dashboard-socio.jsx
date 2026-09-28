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

        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '18px' }}>
          <button
            onClick={() => navigate('/perfil')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #a3e635, #84cc16)',
              color: '#0d0d0d',
              border: 'none',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(132, 204, 22, 0.25)'
            }}
          >
            <FaUserCircle />
            <span>Ver Mi Perfil Completo</span>
          </button>
          <button onClick={handleLogout} className="socio-dash-logout-btn" style={{ margin: 0 }}>
            <FaSignOutAlt />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default DashboardSocio
