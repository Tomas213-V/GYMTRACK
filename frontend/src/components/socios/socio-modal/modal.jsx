import React, { useState, useEffect } from 'react'
import { FaUserPlus, FaTimes, FaSave } from 'react-icons/fa'
import { createSocio } from '../../../services/socioService'
import { getPlanes } from '../../../services/pagoService'
import './modal.css'

function SocioModal({ onClose, onSuccess, gymId }) {
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    contrasena: '',
    id_plan_membresia: '',
    plan: 'Plan Premium',
    precio: 22000,
    estado: 'activo'
  })

  useEffect(() => {
    const idGym = gymId || (() => {
      try {
        const u = JSON.parse(localStorage.getItem('usuario') || '{}')
        const user = Array.isArray(u) ? u[0] : u
        return user?.id_gimnasio || user?.gimnasio_id || null
      } catch {
        return null
      }
    })()

    getPlanes({ id_gimnasio: idGym })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPlanes(data)
          setFormData((prev) => ({
            ...prev,
            id_plan_membresia: data[0].id_plan_membresia,
            plan: data[0].nombre,
            precio: data[0].precio || 0
          }))
        }
      })
      .catch(() => {})
  }, [gymId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await createSocio(formData)
      onSuccess()
    } catch (err) {
      setError(err.message || 'Error al registrar el socio.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="socio-modal-overlay" onClick={onClose}>
      <div className="socio-modal-contenedor" onClick={(e) => e.stopPropagation()}>
        <div className="socio-modal-header">
          <div className="socio-modal-titulo-grupo">
            <div className="socio-modal-icono-verde">
              <FaUserPlus />
            </div>
            <div>
              <h2>Registrar Nuevo Socio</h2>
              <p>Ingresa los datos personales y su membresía inicial</p>
            </div>
          </div>
          <button className="socio-modal-btn-cerrar" onClick={onClose} title="Cerrar">
            <FaTimes />
          </button>
        </div>

        {error && <div className="socio-modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="socio-modal-form">
          <div className="socio-modal-fila">
            <div className="socio-modal-grupo">
              <label>Nombre</label>
              <input
                type="text"
                placeholder="Ej: Juan"
                required
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>

            <div className="socio-modal-grupo">
              <label>Apellido</label>
              <input
                type="text"
                placeholder="Ej: Pérez"
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
              />
            </div>
          </div>

          <div className="socio-modal-fila">
            <div className="socio-modal-grupo">
              <label>DNI</label>
              <input
                type="text"
                placeholder="Ej: 39123456"
                required
                value={formData.dni}
                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
              />
            </div>

            <div className="socio-modal-grupo">
              <label>Teléfono</label>
              <input
                type="text"
                placeholder="Ej: 11 2345 6789"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>
          </div>

          <div className="socio-modal-fila">
            <div className="socio-modal-grupo">
              <label>Correo Electrónico</label>
              <input
                type="email"
                placeholder="Ej: juan@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="socio-modal-grupo">
              <label>Contraseña de Acceso</label>
              <input
                type="password"
                placeholder="Clave para el socio"
                value={formData.contrasena}
                onChange={(e) => setFormData({ ...formData, contrasena: e.target.value })}
              />
            </div>
          </div>

          <div className="socio-modal-fila">
            <div className="socio-modal-grupo">
              <label>Plan Inicial</label>
              <select
                value={formData.id_plan_membresia || formData.plan}
                onChange={(e) => {
                  const selected = planes.find(
                    (p) =>
                      String(p.id_plan_membresia) === e.target.value ||
                      p.nombre === e.target.value
                  )
                  if (selected) {
                    setFormData({
                      ...formData,
                      id_plan_membresia: selected.id_plan_membresia,
                      plan: selected.nombre,
                      precio: selected.precio || 0
                    })
                  } else {
                    setFormData({
                      ...formData,
                      plan: e.target.value
                    })
                  }
                }}
              >
                {planes.length > 0 ? (
                  planes.map((p) => (
                    <option key={p.id_plan_membresia} value={p.id_plan_membresia}>
                      {p.nombre} {p.precio ? `($${p.precio})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Plan Básico">Plan Básico</option>
                    <option value="Plan Premium">Plan Premium</option>
                    <option value="Pase Libre">Pase Libre</option>
                  </>
                )}
              </select>
            </div>

            <div className="socio-modal-grupo">
              <label>Estado</label>
              <select
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="socio-modal-acciones">
            <button type="button" className="socio-btn-cancelar" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="socio-btn-guardar" disabled={cargando}>
              <FaSave />
              <span>{cargando ? 'Guardando...' : 'Guardar Socio'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SocioModal