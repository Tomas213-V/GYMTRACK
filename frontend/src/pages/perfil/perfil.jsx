import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  FaUser,
  FaIdCard,
  FaPhone,
  FaEnvelope,
  FaCalendarAlt,
  FaLock,
  FaBuilding,
  FaDumbbell,
  FaCreditCard,
  FaCheckCircle,
  FaExclamationCircle,
  FaEye,
  FaEyeSlash,
  FaSave,
  FaArrowLeft,
  FaClock,
  FaShieldAlt,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaReceipt
} from 'react-icons/fa';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar/sidebar';
import { getPerfilSocio, updatePerfilSocio } from '../../services/socioService';
import './perfil.css';

function Perfil() {
  const location = useLocation();
  const navigate = useNavigate();

  // Obtener parámetro de query ?id=... si un admin está viendo un socio en específico
  const queryParams = new URLSearchParams(location.search);
  const socioIdParam = queryParams.get('id');

  const rolActual = localStorage.getItem('rol') || 'dueño';
  const esSocio = rolActual === 'socio';

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [alerta, setAlerta] = useState(null); // { tipo: 'exito' | 'error', mensaje: '' }

  const [pestañaActiva, setPestañaActiva] = useState('info'); // 'info' | 'membresia' | 'seguridad' | 'historial'

  // Datos completos retornados por el backend
  const [perfilData, setPerfilData] = useState(null);

  // Formulario de datos personales
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    fecha_alta: '',
    estado: 'activo'
  });

  // Formulario de cambio de contraseña
  const [passwordData, setPasswordData] = useState({
    contrasena_actual: '',
    nueva_contrasena: '',
    confirmar_contrasena: ''
  });

  const [mostrarPassActual, setMostrarPassActual] = useState(false);
  const [mostrarPassNueva, setMostrarPassNueva] = useState(false);
  const [mostrarPassConfirm, setMostrarPassConfirm] = useState(false);

  // Cargar datos del perfil
  const cargarPerfil = async () => {
    try {
      setCargando(true);
      setAlerta(null);
      const res = await getPerfilSocio(socioIdParam);
      setPerfilData(res);

      if (res.socio) {
        setFormData({
          id_socio: res.socio.id_socio || '',
          nombre: res.socio.nombre || '',
          apellido: res.socio.apellido || '',
          dni: res.socio.dni || '',
          telefono: res.socio.telefono || '',
          email: res.socio.email || '',
          fecha_alta: res.socio.fecha_alta || '',
          estado: res.socio.estado || 'activo'
        });
      } else if (res.perfil || res.usuario) {
        const u = res.perfil || res.usuario;
        setFormData({
          id_socio: '',
          nombre: u.nombre || '',
          apellido: u.apellido || '',
          dni: u.dni || '',
          telefono: u.telefono || '',
          email: u.email || '',
          fecha_alta: u.fecha_creacion ? u.fecha_creacion.split('T')[0] : '',
          estado: u.estado || 'activo'
        });
      }
    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'Error al cargar los datos del perfil.'
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPerfil();
  }, [socioIdParam]);

  // Manejador de cambios de datos personales
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Manejador de cambios de contraseñas
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Guardar datos personales
  const handleGuardarDatos = async (e) => {
    e.preventDefault();
    setAlerta(null);

    if (!formData.nombre.trim()) {
      setAlerta({ tipo: 'error', mensaje: 'El nombre es obligatorio.' });
      return;
    }

    try {
      setGuardando(true);
      const payload = {
        id_socio: perfilData?.socio?.id_socio,
        nombre: formData.nombre,
        apellido: formData.apellido,
        telefono: formData.telefono,
        email: formData.email,
        dni: formData.dni
      };

      const res = await updatePerfilSocio(payload);

      // Actualizar localStorage si es el socio autenticado
      if (esSocio && res.socio) {
        const socioGuardado = JSON.parse(localStorage.getItem('socio') || '{}');
        localStorage.setItem(
          'socio',
          JSON.stringify({ ...socioGuardado, ...res.socio })
        );
      }

      setAlerta({
        tipo: 'exito',
        mensaje: 'Tus datos de perfil fueron actualizados exitosamente.'
      });
      await cargarPerfil();
    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'Error al actualizar los datos.'
      });
    } finally {
      setGuardando(false);
    }
  };

  // Actualizar contraseña
  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    setAlerta(null);

    if (esSocio && !passwordData.contrasena_actual) {
      setAlerta({ tipo: 'error', mensaje: 'Ingresa tu contraseña actual.' });
      return;
    }

    if (!passwordData.nueva_contrasena || passwordData.nueva_contrasena.length < 6) {
      setAlerta({
        tipo: 'error',
        mensaje: 'La nueva contraseña debe contener al menos 6 caracteres.'
      });
      return;
    }

    if (passwordData.nueva_contrasena !== passwordData.confirmar_contrasena) {
      setAlerta({
        tipo: 'error',
        mensaje: 'La confirmación de la contraseña no coincide con la nueva contraseña.'
      });
      return;
    }

    try {
      setGuardandoPassword(true);
      const payload = {
        id_socio: perfilData?.socio?.id_socio,
        contrasena_actual: passwordData.contrasena_actual,
        nueva_contrasena: passwordData.nueva_contrasena
      };

      await updatePerfilSocio(payload);

      setPasswordData({
        contrasena_actual: '',
        nueva_contrasena: '',
        confirmar_contrasena: ''
      });

      setAlerta({
        tipo: 'exito',
        mensaje: 'Contraseña actualizada correctamente.'
      });
    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'Error al modificar la contraseña.'
      });
    } finally {
      setGuardandoPassword(false);
    }
  };

  // Cerrar sesión
  const handleLogout = () => {
    localStorage.clear();
    navigate(esSocio ? '/login-socio' : '/login-dueño');
  };

  // Obtener iniciales para avatar
  const obtenerIniciales = () => {
    const n = formData.nombre ? formData.nombre.trim()[0] : '';
    const a = formData.apellido ? formData.apellido.trim()[0] : '';
    return (n + a).toUpperCase() || 'GT';
  };

  // Formatear fechas YYYY-MM-DD a formato amigable
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return 'No registrado';
    try {
      const f = new Date(fechaStr.split('T')[0] + 'T00:00:00');
      return f.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return fechaStr;
    }
  };

  // Formatear hora de asistencia HH:MM
  const formatearHora = (fechaHoraStr) => {
    if (!fechaHoraStr) return 'Presente';
    try {
      const f = new Date(fechaHoraStr);
      if (isNaN(f.getTime())) return fechaHoraStr;
      return f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Presente';
    }
  };

  const socio = perfilData?.socio || perfilData?.perfil || {};
  const gimnasio = perfilData?.gimnasio || socio?.gimnasio || null;
  const membresia = perfilData?.membresia || null;
  const estadisticas = perfilData?.estadisticas || {};
  const ultimosPagos = perfilData?.ultimosPagos || [];
  const ultimasAsistencias = perfilData?.ultimasAsistencias || [];

  return (
    <div className="perfil-page-layout">
      {/* Navegación según el rol: Si es socio mostramos barra adaptada, si es admin usamos NavGlobal */}
      {esSocio ? (
        <header className="perfil-socio-nav">
          <Link to="/dashboard-socio" className="perfil-socio-marca">
            GYM<span>TRACK</span>
          </Link>
          <div className="perfil-socio-nav-actions">
            <Link to="/dashboard-socio" className="perfil-nav-btn perfil-nav-btn-secondary">
              <FaArrowLeft /> Panel de Socio
            </Link>
            <button onClick={handleLogout} className="perfil-nav-btn perfil-nav-btn-logout">
              <FaSignOutAlt /> Salir
            </button>
          </div>
        </header>
      ) : (
        <NavGlobal />
      )}

      <div className="perfil-main-wrapper">
        {/* Sidebar solo visible para administradores / dueños */}
        {!esSocio && <Sidebar />}

        <main className="perfil-content-area">
          {/* Topbar con breadcrumbs y selector de socio */}
          <div className="perfil-topbar">
            <div className="perfil-topbar-left">
              <button
                onClick={() => navigate(esSocio ? '/dashboard-socio' : '/socios-dueño')}
                className="perfil-btn-volver"
              >
                <FaArrowLeft /> Volver
              </button>
              <div>
                <h1>{socioIdParam ? 'Ficha de Socio' : (esSocio ? 'Mi Perfil' : 'Perfil del Socio')}</h1>
                <p>
                  {esSocio
                    ? 'Gestiona tus datos personales, contraseña y estado de membresía en tu gimnasio.'
                    : 'Administra la información de la cuenta, suscripción y credenciales de acceso.'}
                </p>
              </div>
            </div>

            {/* Selector rápido de socio para administradores */}
            {!esSocio && perfilData?.sociosDisponibles && perfilData.sociosDisponibles.length > 0 && (
              <div className="perfil-topbar-selector">
                <span className="perfil-selector-label">Socio activo:</span>
                <select
                  value={socio.id_socio || socioIdParam || ''}
                  onChange={(e) => navigate(`/perfil-dueño?id=${e.target.value}`)}
                  className="perfil-selector-select"
                >
                  {perfilData.sociosDisponibles.map((s) => (
                    <option key={s.id_socio} value={s.id_socio}>
                      {s.nombre} {s.apellido} (DNI: {s.dni})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Alertas globales de feedback */}
          {alerta && (
            <div className={`perfil-feedback-alert ${alerta.tipo}`}>
              <div className="perfil-feedback-content">
                {alerta.tipo === 'exito' ? (
                  <FaCheckCircle size={18} />
                ) : (
                  <FaExclamationCircle size={18} />
                )}
                <span>{alerta.mensaje}</span>
              </div>
              <button
                className="perfil-feedback-close"
                onClick={() => setAlerta(null)}
              >
                &times;
              </button>
            </div>
          )}

          {cargando ? (
            <div className="perfil-loading-container">
              <div className="perfil-spinner"></div>
              <p>Cargando información del perfil...</p>
            </div>
          ) : (
            <>
              {/* Tarjeta Hero / Resumen del Perfil */}
              <div className="perfil-hero-card">
                <div className="perfil-hero-main">
                  <div className="perfil-hero-avatar-wrapper">
                    <div className="perfil-hero-avatar">
                      {obtenerIniciales()}
                    </div>
                    <span
                      className={`perfil-hero-status-dot ${formData.estado?.toLowerCase()}`}
                      title={`Estado: ${formData.estado}`}
                    ></span>
                  </div>

                  <div className="perfil-hero-info">
                    <h2>
                      {formData.nombre} {formData.apellido}
                    </h2>
                    <div className="perfil-hero-tags">
                      <span className="perfil-tag">
                        <FaIdCard /> DNI: {formData.dni || 'Sin DNI'}
                      </span>
                      {socio.id_socio && (
                        <span className="perfil-tag">
                          ID: #{socio.id_socio}
                        </span>
                      )}
                      {gimnasio && (
                        <span className="perfil-tag perfil-tag-gym">
                          <FaBuilding /> {gimnasio.nombre}
                        </span>
                      )}
                      <span
                        className={`perfil-tag perfil-tag-estado-${formData.estado?.toLowerCase()}`}
                      >
                        {formData.estado?.toUpperCase()}
                      </span>
                    </div>

                    <div className="perfil-hero-meta">
                      <span>
                        <FaEnvelope /> {formData.email || 'Sin correo registrado'}
                      </span>
                      <span>
                        <FaPhone /> {formData.telefono || 'Sin teléfono'}
                      </span>
                      <span>
                        <FaCalendarAlt /> Alta: {formatearFecha(formData.fecha_alta)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Métricas rápidas */}
                <div className="perfil-hero-quick-stats">
                  <div className="perfil-quick-stat-box">
                    <span className="perfil-quick-stat-val accent">
                      {estadisticas.totalAsistencias ?? 0}
                    </span>
                    <span className="perfil-quick-stat-label">Asistencias</span>
                  </div>

                  <div className="perfil-quick-stat-box">
                    <span className="perfil-quick-stat-val">
                      {estadisticas.diasRestantes != null
                        ? estadisticas.diasRestantes > 0
                          ? `${estadisticas.diasRestantes}d`
                          : 'Venc.'
                        : 'N/A'}
                    </span>
                    <span className="perfil-quick-stat-label">Días Membr.</span>
                  </div>

                  <div className="perfil-quick-stat-box">
                    <span className="perfil-quick-stat-val">
                      {ultimosPagos.length}
                    </span>
                    <span className="perfil-quick-stat-label">Pagos Reg.</span>
                  </div>
                </div>
              </div>

              {/* Pestañas de Navegación del Perfil */}
              <div className="perfil-tabs-bar">
                <button
                  className={`perfil-tab-btn ${pestañaActiva === 'info' ? 'activo' : ''}`}
                  onClick={() => setPestañaActiva('info')}
                >
                  <FaUser /> Datos Personales
                </button>
                <button
                  className={`perfil-tab-btn ${pestañaActiva === 'membresia' ? 'activo' : ''}`}
                  onClick={() => setPestañaActiva('membresia')}
                >
                  <FaDumbbell /> Membresía & Gimnasio
                </button>
                <button
                  className={`perfil-tab-btn ${pestañaActiva === 'seguridad' ? 'activo' : ''}`}
                  onClick={() => setPestañaActiva('seguridad')}
                >
                  <FaShieldAlt /> Seguridad & Contraseña
                </button>
                <button
                  className={`perfil-tab-btn ${pestañaActiva === 'historial' ? 'activo' : ''}`}
                  onClick={() => setPestañaActiva('historial')}
                >
                  <FaReceipt /> Asistencias & Pagos
                </button>
              </div>

              {/* Contenido de la pestaña 1: Datos Personales */}
              {pestañaActiva === 'info' && (
                <div className="perfil-tab-content">
                  <div className="perfil-grid-2col">
                    {/* Tarjeta Formulario de Datos */}
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaUser />
                          </div>
                          <div>
                            <h3>Información del Socio</h3>
                            <p>Actualiza la información de contacto y ficha de registro</p>
                          </div>
                        </div>
                      </div>

                      <form onSubmit={handleGuardarDatos} className="perfil-form">
                        <div className="perfil-form-row">
                          <div className="perfil-form-group">
                            <label htmlFor="nombre">
                              Nombre <span style={{ color: 'var(--perfil-green)' }}>*</span>
                            </label>
                            <div className="perfil-input-wrapper">
                              <FaUser className="perfil-input-icon" />
                              <input
                                id="nombre"
                                name="nombre"
                                type="text"
                                className="perfil-input"
                                value={formData.nombre}
                                onChange={handleInputChange}
                                placeholder="Ej: Juan"
                                required
                              />
                            </div>
                          </div>

                          <div className="perfil-form-group">
                            <label htmlFor="apellido">Apellido</label>
                            <div className="perfil-input-wrapper">
                              <FaUser className="perfil-input-icon" />
                              <input
                                id="apellido"
                                name="apellido"
                                type="text"
                                className="perfil-input"
                                value={formData.apellido}
                                onChange={handleInputChange}
                                placeholder="Ej: Pérez"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="perfil-form-row">
                          <div className="perfil-form-group">
                            <label htmlFor="dni">
                              Documento (DNI) <span style={{ color: 'var(--perfil-green)' }}>*</span>
                            </label>
                            <div className="perfil-input-wrapper">
                              <FaIdCard className="perfil-input-icon" />
                              <input
                                id="dni"
                                name="dni"
                                type="text"
                                className="perfil-input"
                                value={formData.dni}
                                onChange={handleInputChange}
                                placeholder="Ej: 39123456"
                                required
                              />
                            </div>
                          </div>

                          <div className="perfil-form-group">
                            <label htmlFor="telefono">Teléfono / WhatsApp</label>
                            <div className="perfil-input-wrapper">
                              <FaPhone className="perfil-input-icon" />
                              <input
                                id="telefono"
                                name="telefono"
                                type="tel"
                                className="perfil-input"
                                value={formData.telefono}
                                onChange={handleInputChange}
                                placeholder="Ej: +54 9 11 2345-6789"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="perfil-form-group">
                          <label htmlFor="email">Correo Electrónico</label>
                          <div className="perfil-input-wrapper">
                            <FaEnvelope className="perfil-input-icon" />
                            <input
                              id="email"
                              name="email"
                              type="email"
                              className="perfil-input"
                              value={formData.email}
                              onChange={handleInputChange}
                              placeholder="socio@correo.com"
                            />
                          </div>
                          <span className="perfil-input-helper">
                            Se utiliza para notificaciones del gimnasio e inicio de sesión.
                          </span>
                        </div>

                        <div className="perfil-form-row">
                          <div className="perfil-form-group">
                            <label htmlFor="fecha_alta">Fecha de Alta</label>
                            <div className="perfil-input-wrapper">
                              <FaCalendarAlt className="perfil-input-icon" />
                              <input
                                id="fecha_alta"
                                name="fecha_alta"
                                type="text"
                                className="perfil-input"
                                value={formatearFecha(formData.fecha_alta)}
                                disabled
                              />
                            </div>
                          </div>

                          <div className="perfil-form-group">
                            <label htmlFor="estado">Estado del Socio</label>
                            <div className="perfil-input-wrapper">
                              <input
                                id="estado"
                                name="estado"
                                type="text"
                                className="perfil-input"
                                value={formData.estado?.toUpperCase()}
                                disabled
                              />
                            </div>
                          </div>
                        </div>

                        <div className="perfil-form-actions">
                          <button
                            type="button"
                            className="perfil-btn-secondary"
                            onClick={() => cargarPerfil()}
                          >
                            Restablecer
                          </button>
                          <button
                            type="submit"
                            className="perfil-btn-primary"
                            disabled={guardando}
                          >
                            <FaSave />
                            {guardando ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Tarjeta de Gimnasio Asignado & Resumen */}
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaBuilding />
                          </div>
                          <div>
                            <h3>Gimnasio Perteneciente</h3>
                            <p>Sede donde está registrado este socio</p>
                          </div>
                        </div>
                      </div>

                      {gimnasio ? (
                        <div className="perfil-gym-info-list">
                          <div className="perfil-gym-info-item">
                            <div className="perfil-gym-info-icon">
                              <FaBuilding />
                            </div>
                            <div className="perfil-gym-info-text">
                              <span>Nombre del Gimnasio</span>
                              <strong>{gimnasio.nombre}</strong>
                            </div>
                          </div>

                          <div className="perfil-gym-info-item">
                            <div className="perfil-gym-info-icon">
                              <FaMapMarkerAlt />
                            </div>
                            <div className="perfil-gym-info-text">
                              <span>Dirección</span>
                              <strong>{gimnasio.direccion || 'Sin dirección registrada'}</strong>
                            </div>
                          </div>

                          <div className="perfil-gym-info-item">
                            <div className="perfil-gym-info-icon">
                              <FaPhone />
                            </div>
                            <div className="perfil-gym-info-text">
                              <span>Teléfono de Atención</span>
                              <strong>{gimnasio.telefono || 'Sin teléfono informado'}</strong>
                            </div>
                          </div>

                          <div className="perfil-gym-info-item">
                            <div className="perfil-gym-info-icon">
                              <FaEnvelope />
                            </div>
                            <div className="perfil-gym-info-text">
                              <span>Email de Contacto</span>
                              <strong>{gimnasio.email || 'contacto@gimnasio.com'}</strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="perfil-empty-msg">
                          No se encontraron datos del gimnasio asignado.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Contenido de la pestaña 2: Membresía & Gimnasio */}
              {pestañaActiva === 'membresia' && (
                <div className="perfil-tab-content">
                  <div className="perfil-grid-2col">
                    {/* Tarjeta de Membresía Actual */}
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaDumbbell />
                          </div>
                          <div>
                            <h3>Membresía Actual</h3>
                            <p>Estado del plan suscrito y vigencia</p>
                          </div>
                        </div>
                      </div>

                      {membresia ? (
                        <div className="perfil-membresia-hero">
                          <span className="perfil-membresia-badge-plan">
                            {membresia.estado || 'Activo'}
                          </span>
                          <h4 className="perfil-membresia-nombre-plan">
                            {membresia.plan_membresia?.nombre || 'Plan Personalizado'}
                          </h4>
                          <div className="perfil-membresia-precio">
                            ${membresia.precio || membresia.plan_membresia?.precio || 0}
                            <span> / período</span>
                          </div>

                          <div className="perfil-membresia-fechas-grid">
                            <div className="perfil-fecha-item">
                              <span>Fecha de Inicio</span>
                              <strong>{formatearFecha(membresia.fecha_inicio)}</strong>
                            </div>
                            <div className="perfil-fecha-item">
                              <span>Fecha de Vencimiento</span>
                              <strong>{formatearFecha(membresia.fecha_vencimiento)}</strong>
                            </div>
                          </div>

                          {estadisticas.diasRestantes != null && (
                            <div className="perfil-progress-bar-container">
                              <div className="perfil-progress-bar-labels">
                                <span>Vigencia</span>
                                <strong>
                                  {estadisticas.diasRestantes > 0
                                    ? `${estadisticas.diasRestantes} días restantes`
                                    : 'Membresía Vencida'}
                                </strong>
                              </div>
                              <div className="perfil-progress-bar-track">
                                <div
                                  className="perfil-progress-bar-fill"
                                  style={{
                                    width: `${Math.max(
                                      0,
                                      Math.min(100, (estadisticas.diasRestantes / 30) * 100)
                                    )}%`,
                                    background:
                                      estadisticas.diasRestantes <= 0
                                        ? 'var(--perfil-danger)'
                                        : 'linear-gradient(90deg, #84cc16, #a3e635)'
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="perfil-empty-msg">
                          El socio no tiene actualmente una membresía activa asignada.
                        </div>
                      )}
                    </div>

                    {/* Historial de Planes / Membresías */}
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaClock />
                          </div>
                          <div>
                            <h3>Historial de Membresías</h3>
                            <p>Planes contratados anteriormente</p>
                          </div>
                        </div>
                      </div>

                      {perfilData?.historialMembresias &&
                      perfilData.historialMembresias.length > 0 ? (
                        <div className="perfil-table-container">
                          <table className="perfil-table">
                            <thead>
                              <tr>
                                <th>Plan</th>
                                <th>Inicio</th>
                                <th>Vence</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {perfilData.historialMembresias.map((m, idx) => (
                                <tr key={m.id_membresia || idx}>
                                  <td>
                                    <strong>
                                      {m.plan_membresia?.nombre || 'Plan Estándar'}
                                    </strong>
                                  </td>
                                  <td>{formatearFecha(m.fecha_inicio)}</td>
                                  <td>{formatearFecha(m.fecha_vencimiento)}</td>
                                  <td>
                                    <span
                                      className={`perfil-tag perfil-tag-estado-${m.estado?.toLowerCase()}`}
                                    >
                                      {m.estado}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="perfil-empty-msg">
                          No hay historial de membresías previas.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Contenido de la pestaña 3: Seguridad & Contraseña */}
              {pestañaActiva === 'seguridad' && (
                <div className="perfil-tab-content">
                  <div className="perfil-grid-2col">
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaLock />
                          </div>
                          <div>
                            <h3>Cambiar Contraseña</h3>
                            <p>
                              {esSocio
                                ? 'Ingresa tu contraseña actual y define una nueva clave'
                                : 'Establece una nueva contraseña de acceso para este socio'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <form onSubmit={handleCambiarPassword} className="perfil-form">
                        {esSocio && (
                          <div className="perfil-form-group">
                            <label htmlFor="contrasena_actual">Contraseña Actual</label>
                            <div className="perfil-input-wrapper">
                              <FaLock className="perfil-input-icon" />
                              <input
                                id="contrasena_actual"
                                name="contrasena_actual"
                                type={mostrarPassActual ? 'text' : 'password'}
                                className="perfil-input"
                                value={passwordData.contrasena_actual}
                                onChange={handlePasswordChange}
                                placeholder="Ingresa tu contraseña actual"
                                required
                              />
                              <button
                                type="button"
                                className="perfil-input-toggle-pass"
                                onClick={() => setMostrarPassActual(!mostrarPassActual)}
                              >
                                {mostrarPassActual ? <FaEyeSlash /> : <FaEye />}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="perfil-form-group">
                          <label htmlFor="nueva_contrasena">Nueva Contraseña</label>
                          <div className="perfil-input-wrapper">
                            <FaLock className="perfil-input-icon" />
                            <input
                              id="nueva_contrasena"
                              name="nueva_contrasena"
                              type={mostrarPassNueva ? 'text' : 'password'}
                              className="perfil-input"
                              value={passwordData.nueva_contrasena}
                              onChange={handlePasswordChange}
                              placeholder="Mínimo 6 caracteres"
                              required
                            />
                            <button
                              type="button"
                              className="perfil-input-toggle-pass"
                              onClick={() => setMostrarPassNueva(!mostrarPassNueva)}
                            >
                              {mostrarPassNueva ? <FaEyeSlash /> : <FaEye />}
                            </button>
                          </div>
                        </div>

                        <div className="perfil-form-group">
                          <label htmlFor="confirmar_contrasena">Confirmar Nueva Contraseña</label>
                          <div className="perfil-input-wrapper">
                            <FaLock className="perfil-input-icon" />
                            <input
                              id="confirmar_contrasena"
                              name="confirmar_contrasena"
                              type={mostrarPassConfirm ? 'text' : 'password'}
                              className="perfil-input"
                              value={passwordData.confirmar_contrasena}
                              onChange={handlePasswordChange}
                              placeholder="Repite la nueva contraseña"
                              required
                            />
                            <button
                              type="button"
                              className="perfil-input-toggle-pass"
                              onClick={() => setMostrarPassConfirm(!mostrarPassConfirm)}
                            >
                              {mostrarPassConfirm ? <FaEyeSlash /> : <FaEye />}
                            </button>
                          </div>
                        </div>

                        <div className="perfil-form-actions">
                          <button
                            type="submit"
                            className="perfil-btn-primary"
                            disabled={guardandoPassword}
                          >
                            <FaShieldAlt />
                            {guardandoPassword
                              ? 'Actualizando...'
                              : 'Actualizar Contraseña'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Recomendaciones de Seguridad */}
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaShieldAlt />
                          </div>
                          <div>
                            <h3>Recomendaciones de Seguridad</h3>
                            <p>Protege el acceso a tu cuenta en GymTrack</p>
                          </div>
                        </div>
                      </div>

                      <div className="perfil-gym-info-list">
                        <div className="perfil-gym-info-item">
                          <div className="perfil-gym-info-icon">
                            <FaCheckCircle />
                          </div>
                          <div className="perfil-gym-info-text">
                            <span>Longitud Recomendada</span>
                            <strong>Utiliza al menos 8 caracteres combinando números y letras.</strong>
                          </div>
                        </div>

                        <div className="perfil-gym-info-item">
                          <div className="perfil-gym-info-icon">
                            <FaCheckCircle />
                          </div>
                          <div className="perfil-gym-info-text">
                            <span>Confidencialidad</span>
                            <strong>No compartas tu contraseña ni tu DNI con terceros.</strong>
                          </div>
                        </div>

                        <div className="perfil-gym-info-item">
                          <div className="perfil-gym-info-icon">
                            <FaCheckCircle />
                          </div>
                          <div className="perfil-gym-info-text">
                            <span>Acceso a Gimnasio</span>
                            <strong>Tu DNI registrado es la clave para marcar tus asistencias.</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contenido de la pestaña 4: Asistencias & Pagos */}
              {pestañaActiva === 'historial' && (
                <div className="perfil-tab-content">
                  <div className="perfil-grid-2col">
                    {/* Tabla de Asistencias Recientes */}
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaCalendarAlt />
                          </div>
                          <div>
                            <h3>Últimas Asistencias</h3>
                            <p>Registro de visitas recientes a entrenar</p>
                          </div>
                        </div>
                        {esSocio && (
                          <button
                            className="perfil-btn-primary"
                            style={{ height: '36px', fontSize: '12px', padding: '0 14px' }}
                            onClick={() => navigate('/asistencia-socio')}
                          >
                            <FaCalendarAlt /> Marcar Asistencia
                          </button>
                        )}
                      </div>

                      {ultimasAsistencias.length > 0 ? (
                        <div className="perfil-table-container">
                          <table className="perfil-table">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Hora</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ultimasAsistencias.map((a, idx) => (
                                <tr key={a.id_asistencia || idx}>
                                  <td>{formatearFecha(a.hora_ingreso || a.fecha)}</td>
                                  <td>{formatearHora(a.hora_ingreso || a.hora)}</td>
                                  <td>
                                    <span className="perfil-tag perfil-tag-estado-activo">
                                      {a.estado || 'Registrada'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="perfil-empty-msg">
                          No se han registrado asistencias aún.
                        </div>
                      )}
                    </div>

                    {/* Tabla de Pagos Recientes */}
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaCreditCard />
                          </div>
                          <div>
                            <h3>Últimos Pagos</h3>
                            <p>Recibos y comprobantes de abono</p>
                          </div>
                        </div>
                      </div>

                      {ultimosPagos.length > 0 ? (
                        <div className="perfil-table-container">
                          <table className="perfil-table">
                            <thead>
                              <tr>
                                <th>Monto</th>
                                <th>Fecha</th>
                                <th>Método</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ultimosPagos.map((p, idx) => (
                                <tr key={p.id_pago || idx}>
                                  <td>
                                    <strong style={{ color: 'var(--perfil-green)' }}>
                                      ${p.monto}
                                    </strong>
                                  </td>
                                  <td>{formatearFecha(p.fecha_pago)}</td>
                                  <td>{p.metodo_pago || 'Efectivo'}</td>
                                  <td>
                                    <span
                                      className={`perfil-tag perfil-tag-estado-${
                                        p.estado === 'completado' || p.estado === 'aprobado'
                                          ? 'activo'
                                          : 'pendiente'
                                      }`}
                                    >
                                      {p.estado || 'Aprobado'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="perfil-empty-msg">
                          No se encontraron pagos registrados para este socio.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Perfil;
