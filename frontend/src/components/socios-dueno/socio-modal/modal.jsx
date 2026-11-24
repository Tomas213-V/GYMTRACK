import { useState, useEffect, useRef } from 'react'
import { FaUserPlus, FaTimes, FaSave, FaInfoCircle, FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa'
import { createSocio } from '../../../services/socioService'
import { verificarIdentidad } from '../../../services/authService'
import { createMembresiaSocio } from '../../../services/membresiaAdminService'
import { getPlanes } from '../../../services/pagoService'
import './modal.css'

const getPlanId = (p) => p?.id_membresia_gimnasio ?? ''

function SocioModal({ onClose, onSuccess, gymId }) {
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mostrarPass, setMostrarPass] = useState(false)

  // Resultado seguro de detección de identidad en GymTrack (sin exponer datos privados ajenos)
  const [deteccion, setDeteccion] = useState(null)
  const [confirmarIncorporacion, setConfirmarIncorporacion] = useState(false)
  const [verificandoIdentidad, setVerificandoIdentidad] = useState(false)
  const timeoutRef = useRef(null)

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    contrasena_inicial: '',
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

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const consultarIdentidad = async (dniValor, emailValor) => {
    const cleanDni = String(dniValor || '').trim()
    const cleanEmail = String(emailValor || '').trim().toLowerCase()
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)

    if (cleanDni.length < 5 && !emailValido) {
      setDeteccion(null)
      setConfirmarIncorporacion(false)
      return null
    }

    try {
      setVerificandoIdentidad(true)
      const res = await verificarIdentidad({
        tipo_perfil: 'socio',
        dni: cleanDni.length >= 5 ? cleanDni : null,
        email: emailValido ? cleanEmail : null,
        id_gimnasio: gymId || null
      })
      setDeteccion(res)
      if (res?.asociacion_activa_en_este_gimnasio) {
        setError(res.mensaje || 'Esta persona ya está asociada a tu gimnasio.')
        setConfirmarIncorporacion(false)
      } else if (res?.conflicto_identidad) {
        setError(res.mensaje || 'El DNI y el correo corresponden a personas distintas.')
        setConfirmarIncorporacion(false)
      } else if (res?.existe_en_gymtrack) {
        setError('')
        setFormData((prev) => ({ ...prev, contrasena_inicial: '' }))
      } else {
        setError('')
        setConfirmarIncorporacion(false)
      }
      return res
    } catch {
      return null
    } finally {
      setVerificandoIdentidad(false)
    }
  }

  const programarVerificacion = (nextDni, nextEmail) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      consultarIdentidad(nextDni, nextEmail)
    }, 450)
  }

  const handleDniChange = (e) => {
    const val = e.target.value
    setFormData((prev) => ({ ...prev, dni: val }))
    setError('')
    setConfirmarIncorporacion(false)
    programarVerificacion(val, formData.email)
  }

  const handleEmailChange = (e) => {
    const val = e.target.value
    setFormData((prev) => ({ ...prev, email: val }))
    setError('')
    setConfirmarIncorporacion(false)
    programarVerificacion(formData.dni, val)
  }

  const personaExistente = Boolean(
    deteccion?.existe_en_gymtrack &&
    !deteccion?.asociacion_activa_en_este_gimnasio &&
    !deteccion?.conflicto_identidad
  )
  const mostrarCampoPassword = !deteccion?.tiene_cuenta_auth && !personaExistente

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cheq = await consultarIdentidad(formData.dni, formData.email)
    if (cheq?.asociacion_activa_en_este_gimnasio) {
      setError(cheq.mensaje || 'Esta persona ya está asociada a tu gimnasio.')
      return
    }
    if (cheq?.conflicto_identidad) {
      setError(cheq.mensaje || 'El DNI y el correo electrónico corresponden a personas distintas.')
      return
    }
    if (cheq?.existe_en_gymtrack && !confirmarIncorporacion) {
      setError('Confirmá que querés incorporar a esta persona existente a tu gimnasio para continuar.')
      return
    }

    const pwd = formData.contrasena_inicial.trim()
    if (!cheq?.existe_en_gymtrack && pwd) {
      if (!formData.email.trim()) {
        setError('Para definir una contraseña inicial, el correo electrónico es obligatorio.')
        return
      }
      if (pwd.length < 6) {
        setError('La contraseña inicial debe tener al menos 6 caracteres.')
        return
      }
    }

    setCargando(true)
    try {
      const resSocio = await createSocio({
        id_gimnasio: gymId || undefined,
        nombre: formData.nombre,
        apellido: formData.apellido,
        dni: formData.dni,
        telefono: formData.telefono,
        email: formData.email,
        ...(mostrarCampoPassword && pwd ? { contrasena_inicial: pwd } : {}),
        ...(cheq?.existe_en_gymtrack ? { confirmar_incorporacion: true } : {})
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
      setError(err.message || 'No fue posible completar la asociación. Volvé a intentarlo.')
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
              <h2>Registrar o Incorporar Socio</h2>
              <p>Creá una cuenta global nueva con contraseña inicial o incorporá a una persona ya registrada</p>
            </div>
          </div>
          <button className="socio-modal-btn-cerrar" onClick={onClose} title="Cerrar">
            <FaTimes />
          </button>
        </div>

        {error && <div className="socio-modal-error">{error}</div>}

        {personaExistente && (
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
                Identidad existente detectada en GymTrack
              </div>
              <p className="socio-modal-alerta-texto">
                {deteccion?.mensaje || 'Esta persona ya tiene un registro en GymTrack. ¿Querés incorporarla a tu gimnasio?'}
                {' '}Se reutilizará su cuenta global sin duplicarla ni modificar su contraseña.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer', fontSize: '13px', color: '#ecfccb' }}>
                <input
                  type="checkbox"
                  checked={confirmarIncorporacion}
                  onChange={(e) => setConfirmarIncorporacion(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <span>Sí, confirmo incorporar esta persona a mi gimnasio</span>
              </label>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="socio-modal-form">
          <div className="socio-modal-fila">
            <div className="socio-modal-grupo">
              <div className="socio-modal-label-row">
                <label>DNI *</label>
                {verificandoIdentidad && (
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
                onBlur={() => consultarIdentidad(formData.dni, formData.email)}
              />
            </div>

            <div className="socio-modal-grupo">
              <label>Correo Electrónico {!personaExistente ? '*' : ''}</label>
              <input
                type="email"
                placeholder="Ej: juan@email.com"
                required={!personaExistente && Boolean(formData.contrasena_inicial.trim())}
                value={formData.email}
                onChange={handleEmailChange}
                onBlur={() => consultarIdentidad(formData.dni, formData.email)}
              />
            </div>
          </div>

          <div className="socio-modal-fila">
            <div className="socio-modal-grupo">
              <label>Nombre {!personaExistente ? '*' : ''}</label>
              <input
                type="text"
                placeholder="Ej: Juan"
                required={!personaExistente}
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>

            <div className="socio-modal-grupo">
              <label>Apellido {!personaExistente ? '*' : ''}</label>
              <input
                type="text"
                placeholder="Ej: Pérez"
                required={!personaExistente}
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
              />
            </div>
          </div>

          <div className="socio-modal-fila">
            <div className="socio-modal-grupo">
              <label>Teléfono</label>
              <input
                type="text"
                placeholder="Ej: 11 2345 6789"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>

            {mostrarCampoPassword && (
              <div className="socio-modal-grupo">
                <label>Contraseña inicial (para cuenta nueva)</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={mostrarPass ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={formData.contrasena_inicial}
                    onChange={(e) => setFormData({ ...formData, contrasena_inicial: e.target.value })}
                    autoComplete="new-password"
                    style={{ width: '100%', paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPass((v) => !v)}
                    aria-label="Mostrar u ocultar contraseña"
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    {mostrarPass ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            )}
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

          <div
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.28)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#cbd5e1',
              marginBottom: '8px',
              lineHeight: 1.45
            }}
          >
            {personaExistente ? (
              <span>
                Esta persona ya cuenta con identidad global en GymTrack. Ingresará con su correo y contraseña habituales sin crear otra cuenta.
              </span>
            ) : (
              <span>
                <strong style={{ color: '#7dd3fc' }}>Cuenta global única:</strong> Si definís una contraseña inicial, se aprovisionará la cuenta en Supabase Auth (respetando la confirmación de correo configurada). El socio podrá cambiarla cuando quiera desde su perfil.
              </span>
            )}
          </div>

          <div className="socio-modal-acciones">
            <button type="button" className="socio-btn-cancelar" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="socio-btn-guardar"
              disabled={cargando || Boolean(deteccion?.asociacion_activa_en_este_gimnasio)}
              title="Guardar Socio"
            >
              <FaSave />
              <span>{cargando ? 'Guardando...' : personaExistente ? 'Incorporar Socio' : 'Guardar Socio'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SocioModal
