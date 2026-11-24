import { useState, useEffect, useRef } from 'react'
import { FaUserPlus, FaTimes, FaSave, FaInfoCircle, FaSpinner } from 'react-icons/fa'
import { createSocio, verificarDniSocio } from '../../../services/socioService'
import { createMembresiaSocio } from '../../../services/membresiaAdminService'
import { getPlanes } from '../../../services/pagoService'
import './modal.css'

const getPlanId = (p) => p?.id_membresia_gimnasio ?? ''

function SocioModal({ onClose, onSuccess, gymId }) {
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // Información de socio existente en GymTrack (multigimnasio: se vincula sin bloquear)
  const [infoSocioExistente, setInfoSocioExistente] = useState(null)
  const [verificandoDni, setVerificandoDni] = useState(false)
  const timeoutDniRef = useRef(null)

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    id_membresia_gimnasio: '',
    contratar_plan: false
  })

  useEffect(() => {
    getPlanes({ id_gimnasio: gymId })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const activos = data.filter((p) => p.estado !== false)
          const lista = activos.length > 0 ? activos : data
          setPlanes(lista)
          setFormData((prev) => ({
            ...prev,
            id_membresia_gimnasio: getPlanId(lista[0])
          }))
        }
      })
      .catch(() => {})
  }, [gymId])

  // Verificación informativa de DNI (soporte multigimnasio)
  const verificarDni = async (dniValor) => {
    const cleanDni = (dniValor || '').toString().trim()
    if (!cleanDni || cleanDni.length < 5) {
      setInfoSocioExistente(null)
      return null
    }

    try {
      setVerificandoDni(true)
      const res = await verificarDniSocio(cleanDni)
      if (res?.existeEnEsteGimnasio) {
        setError('Este socio ya tiene una membresía activa en este gimnasio.')
        setInfoSocioExistente(null)
        return { existeEnEsteGimnasio: true }
      } else if (res?.cuentaExistente || res?.vinculadoOtroGimnasio || res?.socio) {
        const socioFound = res.socio || {}
        const info = {
          socioNombre: `${socioFound.nombre || ''} ${socioFound.apellido || ''}`.trim(),
          dni: socioFound.dni || cleanDni,
          email: socioFound.email || ''
        }
        setInfoSocioExistente(info)
        setFormData((prev) => ({
          ...prev,
          nombre: prev.nombre || socioFound.nombre || '',
          apellido: prev.apellido || socioFound.apellido || '',
          email: prev.email || socioFound.email || '',
          telefono: prev.telefono || socioFound.telefono || ''
        }))
        setError('')
        return { cuentaExistente: true }
      } else {
        setInfoSocioExistente(null)
        if (error.includes('DNI') || error.includes('membresía activa')) setError('')
        return { libre: true }
      }
    } catch {
      return null
    } finally {
      setVerificandoDni(false)
    }
  }

  const handleDniChange = (e) => {
    const val = e.target.value
    setFormData((prev) => ({ ...prev, dni: val }))
    if (error.includes('DNI') || error.includes('membresía')) setError('')

    if (timeoutDniRef.current) {
      clearTimeout(timeoutDniRef.current)
    }

    timeoutDniRef.current = setTimeout(() => {
      verificarDni(val)
    }, 500)
  }

  const ejecutarGuardado = async () => {
    setError('')
    setCargando(true)
    try {
      const resSocio = await createSocio({
        id_gimnasio: gymId || undefined,
        nombre: formData.nombre,
        apellido: formData.apellido,
        dni: formData.dni,
        telefono: formData.telefono,
        email: formData.email
      })

      const idSocioCreado = resSocio?.socio?.id_socio
      if (formData.contratar_plan && formData.id_membresia_gimnasio && idSocioCreado) {
        await createMembresiaSocio({
          id_socio: idSocioCreado,
          id_membresia_gimnasio: Number(formData.id_membresia_gimnasio),
          estado: 'pendiente',
          registrar_pago: false
        })
      }

      onSuccess()
    } catch (err) {
      setError(err.message || 'Error al registrar o vincular el socio.')
    } finally {
      setCargando(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cheq = await verificarDni(formData.dni)
    if (cheq?.existeEnEsteGimnasio) {
      setError('Este socio ya posee una membresía activa en este gimnasio.')
      return
    }

    ejecutarGuardado()
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
              <h2>Registrar o Vincular Socio</h2>
              <p>Crea una cuenta nueva o vincula a un socio existente de GymTrack con un plan</p>
            </div>
          </div>
          <button className="socio-modal-btn-cerrar" onClick={onClose} title="Cerrar">
            <FaTimes />
          </button>
        </div>

        {error && <div className="socio-modal-error">{error}</div>}

        {infoSocioExistente && (
          <div
            className="socio-modal-alerta-vinculado"
            style={{
              background: 'rgba(158, 240, 26, 0.08)',
              border: '1px solid rgba(158, 240, 26, 0.35)',
              color: '#d9f99d'
            }}
          >
            <div className="socio-modal-alerta-icono" style={{ color: '#9EF01A' }}>
              <FaInfoCircle />
            </div>
            <div className="socio-modal-alerta-cuerpo">
              <div className="socio-modal-alerta-titulo" style={{ color: '#bef264' }}>
                Socio existente en GymTrack (Sistema Multigimnasio)
              </div>
              <p className="socio-modal-alerta-texto">
                El socio con DNI <strong>{infoSocioExistente.dni}</strong>{' '}
                {infoSocioExistente.socioNombre ? `(${infoSocioExistente.socioNombre})` : ''} ya cuenta con usuario en GymTrack. Se vinculará a tu gimnasio creando su nueva membresía sin duplicar cuentas.
              </p>
            </div>
          </div>
        )}

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
              <div className="socio-modal-label-row">
                <label>DNI</label>
                {verificandoDni && (
                  <span className="socio-modal-verificando">
                    <FaSpinner className="socio-spinner" /> Verificando...
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Ej: 39123456"
                required
                value={formData.dni}
                onChange={handleDniChange}
                onBlur={() => verificarDni(formData.dni)}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.contratar_plan}
                  onChange={(e) => setFormData({ ...formData, contratar_plan: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                <span>Contratar plan inicial (pendiente de pago)</span>
              </label>
              {formData.contratar_plan && (
                <select
                  value={formData.id_membresia_gimnasio}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      id_membresia_gimnasio: e.target.value
                    })
                  }
                >
                  {planes.length > 0 ? (
                    planes.map((p) => {
                      const pid = getPlanId(p)
                      return (
                        <option key={pid} value={pid}>
                          {p.nombre} {p.precio != null ? `($${Number(p.precio).toLocaleString('es-AR')})` : ''}
                        </option>
                      )
                    })
                  ) : (
                    <option value="">Sin planes creados aún</option>
                  )}
                </select>
              )}
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 8px 0' }}>
            El acceso del socio se gestiona vía Supabase Auth: el socio podrá vincular su ficha al iniciar sesión con su correo verificado.
          </p>

          <div className="socio-modal-acciones">
            <button type="button" className="socio-btn-cancelar" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="socio-btn-guardar"
              disabled={cargando}
              title="Guardar Socio"
            >
              <FaSave />
              <span>{cargando ? 'Guardando...' : infoSocioExistente ? 'Vincular Socio' : 'Guardar Socio'}</span>
            </button>
          </div>
        </form>

        {/*
          [PRESERVADO PARA EL FUTURO - MODAL DE CONFIRMACIÓN / BAJA AUTOMÁTICA]
          En caso de requerir confirmación manual o reactivar la baja automática entre gimnasios:
          
          mostrarConfirmacion && (
            <div className="socio-modal-confirm-overlay">
              <div className="socio-modal-confirm-card">
                ...
              </div>
            </div>
          )
        */}
      </div>
    </div>
  )
}

export default SocioModal