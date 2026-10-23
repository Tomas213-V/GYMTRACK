import { useState, useEffect, useRef } from 'react'
import { FaUserPlus, FaTimes, FaSave, FaExclamationTriangle, FaCheckCircle, FaSpinner } from 'react-icons/fa'
import { createSocio, verificarDniSocio } from '../../../services/socioService'
import { getPlanes } from '../../../services/pagoService'
import './modal.css'

function SocioModal({ onClose, onSuccess, gymId }) {
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // Estado para la alerta de socio vinculado a otro gimnasio
  const [alertaVinculacion, setAlertaVinculacion] = useState(null)
  const [verificandoDni, setVerificandoDni] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const timeoutDniRef = useRef(null)

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

  // Verificación preventiva de DNI (si ya existe en este gym o está activo en otro)
  const verificarDni = async (dniValor) => {
    const cleanDni = (dniValor || '').toString().trim()
    if (!cleanDni || cleanDni.length < 5) {
      setAlertaVinculacion(null)
      return null
    }

    try {
      setVerificandoDni(true)
      const res = await verificarDniSocio(cleanDni)
      if (res?.existeEnEsteGimnasio) {
        setError('Ya existe un socio registrado con este DNI en tu gimnasio.')
        setAlertaVinculacion(null)
        return { existeEnEsteGimnasio: true }
      } else if (res?.vinculadoOtroGimnasio) {
        const infoAlerta = {
          vinculado: true,
          gimnasioNombre: res.gimnasio?.nombre || 'Otro gimnasio',
          socioNombre: `${res.socio?.nombre || ''} ${res.socio?.apellido || ''}`.trim(),
          dni: res.socio?.dni || cleanDni,
          telefonoGimnasio: res.gimnasio?.telefono || null
        }
        setAlertaVinculacion(infoAlerta)
        setError('')
        return infoAlerta
      } else {
        setAlertaVinculacion(null)
        if (error.includes('DNI')) setError('')
        return { libre: true }
      }
    } catch {
      // Ignorar errores menores de verificación
      return null
    } finally {
      setVerificandoDni(false)
    }
  }

  // Manejo de cambio en campo DNI con debounce
  const handleDniChange = (e) => {
    const val = e.target.value
    setFormData((prev) => ({ ...prev, dni: val }))
    if (error.includes('DNI')) setError('')

    if (timeoutDniRef.current) {
      clearTimeout(timeoutDniRef.current)
    }

    timeoutDniRef.current = setTimeout(() => {
      verificarDni(val)
    }, 500)
  }

  // Ejecución de guardado (con o sin confirmación de vinculación inter-gimnasio)
  const ejecutarGuardado = async (confirmarVinculacion = false) => {
    setError('')
    setCargando(true)
    try {
      await createSocio({
        ...formData,
        confirmarVinculacion
      })
      setMostrarConfirmacion(false)
      onSuccess()
    } catch (err) {
      if (err.alertaVinculacion) {
        setAlertaVinculacion({
          vinculado: true,
          gimnasioNombre: err.gimnasioNombre || 'Otro gimnasio',
          socioNombre: err.socioNombre || formData.nombre,
          dni: err.dni || formData.dni
        })
        setMostrarConfirmacion(true)
      } else {
        setError(err.message || 'Error al registrar el socio.')
      }
    } finally {
      setCargando(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Si ya detectamos alerta de vinculación y no se confirmó, requerir confirmación
    if (alertaVinculacion?.vinculado) {
      setMostrarConfirmacion(true)
      return
    }

    // Si aún no se verificó el DNI, comprobar antes de registrar
    const cheq = await verificarDni(formData.dni)
    if (cheq?.existeEnEsteGimnasio) {
      return
    }
    if (cheq?.vinculado) {
      setMostrarConfirmacion(true)
      return
    }

    ejecutarGuardado(false)
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

        {alertaVinculacion?.vinculado && (
          <div className="socio-modal-alerta-vinculado">
            <div className="socio-modal-alerta-icono">
              <FaExclamationTriangle />
            </div>
            <div className="socio-modal-alerta-cuerpo">
              <div className="socio-modal-alerta-titulo">
                ⚠️ Socio vinculado a otro gimnasio
              </div>
              <p className="socio-modal-alerta-texto">
                Este socio (<strong>{alertaVinculacion.socioNombre || 'DNI ' + alertaVinculacion.dni}</strong>) 
                figura actualmente registrado y <strong>ACTIVO</strong> en el gimnasio <strong>"{alertaVinculacion.gimnasioNombre}"</strong> sin haberse dado de baja.
              </p>
              {alertaVinculacion.telefonoGimnasio && (
                <p className="socio-modal-alerta-contacto">
                  Teléfono gimnasio origen: <span>{alertaVinculacion.telefonoGimnasio}</span>
                </p>
              )}
              <span className="socio-modal-alerta-aviso">
                Coordiná el pase o baja correspondiente antes de inscribirlo. Al guardar, se te solicitará confirmación.
              </span>
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
                className={alertaVinculacion?.vinculado ? 'input-aviso-vinculado' : ''}
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

        {/* Modal de confirmación si el socio está vinculado a otro gimnasio */}
        {mostrarConfirmacion && (
          <div className="socio-modal-confirm-overlay">
            <div className="socio-modal-confirm-card">
              <div className="socio-modal-confirm-icono">
                <FaExclamationTriangle />
              </div>
              <h3>¿Confirmar Registro de Socio?</h3>
              <p className="socio-modal-confirm-desc">
                El socio con DNI <strong>{formData.dni}</strong> ({alertaVinculacion?.socioNombre || formData.nombre}) 
                figura actualmente registrado y <strong>ACTIVO</strong> en el gimnasio <strong>"{alertaVinculacion?.gimnasioNombre}"</strong> sin haberse dado de baja.
              </p>
              <p className="socio-modal-confirm-pregunta">
                ¿Deseas inscribirlo en tu gimnasio de todas maneras?
              </p>
              <div className="socio-modal-confirm-acciones">
                <button
                  type="button"
                  className="socio-btn-cancelar"
                  onClick={() => setMostrarConfirmacion(false)}
                  disabled={cargando}
                >
                  Revisar Datos
                </button>
                <button
                  type="button"
                  className="socio-btn-confirmar-vinculacion"
                  disabled={cargando}
                  onClick={() => ejecutarGuardado(true)}
                >
                  <FaCheckCircle />
                  <span>{cargando ? 'Inscribiendo...' : 'Sí, Registrar de Todos Modos'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SocioModal