/**
 * =========================================================================================
 * ARCHIVO: perfil.jsx
 * RUTA: frontend/src/pages/perfil-socio/perfil.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Módulo Integral de Perfil de Usuario, Credenciales, Datos Personales y Seguridad.
 * =========================================================================================
 * 
 * GUÍA DE ARQUITECTURA PARA EL DESARROLLADOR:
 * 1. CONTEXTO DUAL DE OPERACIÓN (Socio vs Dueño/Administrador):
 *    - Vista de Alumno (`esSocio = true`): Permite al socio auto-gestionar su información de contacto,
 *      consultar la vigencia y días restantes de su membresía actual, cambiar su contraseña y
 *      revisar su historial completo de pagos y asistencias registradas.
 *    - Vista de Administrador (`?id=...`): Permite al dueño o profesor inspeccionar la ficha
 *      médica y administrativa de un alumno en particular, o seleccionar a otro socio del selector superior.
 * 2. ESTRUCTURA DE PESTAÑAS (Tabs de Navegación):
 *    - 'info': Datos personales básicos (Nombre, Apellido, DNI, Teléfono, Email, Fecha de Alta).
 *    - 'membresia': Ficha del plan activo, fecha de inicio, vencimiento, días restantes y estado.
 *    - 'seguridad': Cambio de contraseña con validación de contraseña actual y requisitos mínimos.
 *    - 'historial': Registro cronológico de cobros/pagos y asistencias al gimnasio.
 * 3. SEGURIDAD Y SINCRONIZACIÓN:
 *    - Al guardar cambios, el servicio `updatePerfilSocio()` valida autorizaciones y encripta
 *      contraseñas mediante bcrypt en el servidor.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  FaUser,
  FaIdCard,
  FaPhone,
  FaEnvelope,
  FaCalendarAlt,
  FaLock,
  FaBuilding,
  FaCheckCircle,
  FaExclamationCircle,
  FaEye,
  FaEyeSlash,
  FaSave,
  FaArrowLeft,
  FaShieldAlt,
  FaMapMarkerAlt,
  FaSignOutAlt
} from 'react-icons/fa';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import { useGymContext } from '../../context/GymContext';
import { getPerfilSocio, updatePerfilSocio, updateSocio } from '../../services/socioService';
import { cambiarContrasena, recuperarContrasena } from '../../services/authService';
import { formatFechaArgentina } from '../../utils/dateUtils';
import './perfil.css';

const estadoTexto = (est) => {
  if (est === true || est === 'activo') return 'activo';
  if (est === false || est === 'inactivo') return 'inactivo';
  return String(est || 'activo').toLowerCase();
};

function Perfil() {
  const location = useLocation();
  const navigate = useNavigate();
  const { rol, gimnasioActivo, gimnasioActivoId, gimnasios, contextVersion, logout, refreshProfile } = useGymContext();

  // Obtener parámetro de query ?id=... si un admin está viendo un socio en específico
  const queryParams = new URLSearchParams(location.search);
  const socioIdParam = queryParams.get('id');

  const rolActual = rol || localStorage.getItem('rol') || 'dueño';
  const esSocio = rolActual === 'socio';

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false);
  const [alerta, setAlerta] = useState(null);

  const [pestañaActiva, setPestañaActiva] = useState('info');

  const [perfilData, setPerfilData] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    fecha_alta: '',
    estado: 'activo'
  });

  const [passwordData, setPasswordData] = useState({
    contrasena_actual: '',
    nueva_contrasena: '',
    confirmar_contrasena: ''
  });

  const [mostrarPassActual, setMostrarPassActual] = useState(false);
  const [mostrarPassNueva, setMostrarPassNueva] = useState(false);
  const [mostrarPassConfirm, setMostrarPassConfirm] = useState(false);

  const cargarPerfil = useCallback(async () => {
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
          estado: estadoTexto(res.socio.estado)
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
          estado: estadoTexto(u.estado)
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
  }, [socioIdParam]);

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil, gimnasioActivoId, contextVersion]);

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
        nombre: formData.nombre,
        apellido: formData.apellido,
        telefono: formData.telefono,
        email: formData.email,
        dni: formData.dni
      };

      const res = !esSocio && socioIdParam
        ? await updateSocio(socioIdParam, payload, gimnasioActivoId)
        : await updatePerfilSocio(payload);

      if (esSocio && res.socio) {
        await refreshProfile();
      }

      setAlerta({
        tipo: 'exito',
        mensaje: !esSocio && socioIdParam
          ? 'Los datos del socio fueron actualizados exitosamente.'
          : 'Tus datos de perfil fueron actualizados exitosamente.'
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

  // Actualizar contraseña (solo el propio usuario autenticado en su portal)
  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    setAlerta(null);

    if (!esSocio) {
      setAlerta({
        tipo: 'error',
        mensaje: 'Por seguridad, el dueño no puede sobrescribir la contraseña personal del socio. Podés enviarle un enlace de restablecimiento a su correo.'
      });
      return;
    }

    if (!passwordData.contrasena_actual) {
      setAlerta({ tipo: 'error', mensaje: 'Ingresa tu contraseña actual.' });
      return;
    }

    const nuevaPassLimpia = passwordData.nueva_contrasena.trim();
    if (!nuevaPassLimpia || nuevaPassLimpia.length < 6) {
      setAlerta({
        tipo: 'error',
        mensaje: 'La nueva contraseña debe contener al menos 6 caracteres.'
      });
      return;
    }

    if (nuevaPassLimpia === passwordData.contrasena_actual) {
      setAlerta({
        tipo: 'error',
        mensaje: 'La nueva contraseña debe ser diferente a la actual.'
      });
      return;
    }

    if (nuevaPassLimpia !== passwordData.confirmar_contrasena.trim()) {
      setAlerta({
        tipo: 'error',
        mensaje: 'La confirmación de la contraseña no coincide con la nueva contraseña.'
      });
      return;
    }

    try {
      setGuardandoPassword(true);
      const resPass = await cambiarContrasena({
        contrasena_actual: passwordData.contrasena_actual,
        nueva_contrasena: passwordData.nueva_contrasena,
        confirmar_contrasena: passwordData.confirmar_contrasena
      });

      if (resPass?.token) {
        localStorage.setItem('token', resPass.token);
      }
      if (resPass?.refresh_token) {
        localStorage.setItem('refresh_token', resPass.refresh_token);
      }

      setPasswordData({
        contrasena_actual: '',
        nueva_contrasena: '',
        confirmar_contrasena: ''
      });

      setAlerta({
        tipo: 'exito',
        mensaje: resPass?.mensaje || 'Contraseña actualizada correctamente.'
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

  // Enviar enlace de recuperación por Supabase Auth desde la Ficha del Socio
  const handleEnviarRecuperacionPassword = async () => {
    setAlerta(null);
    const emailTarget = String(socio?.email || formData.email || '').trim().toLowerCase();
    if (!emailTarget || emailTarget.includes('@gymtrack.local')) {
      setAlerta({
        tipo: 'error',
        mensaje: 'El socio necesita tener un correo electrónico real configurado en "Datos Personales" para recibir el enlace de restablecimiento.'
      });
      return;
    }

    try {
      setEnviandoRecuperacion(true);
      const res = await recuperarContrasena(emailTarget);
      setAlerta({
        tipo: 'exito',
        mensaje:
          res?.mensaje ||
          `Se envió un enlace de restablecimiento de contraseña a ${emailTarget}.`
      });
    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'No se pudo enviar el enlace de recuperación.'
      });
    } finally {
      setEnviandoRecuperacion(false);
    }
  };

  // Cerrar sesión
  const handleLogout = async () => {
    await logout();
    navigate(esSocio ? '/login-socio' : '/login-dueño');
  };

  // Obtener iniciales para avatar
  const obtenerIniciales = () => {
    const n = formData.nombre ? formData.nombre.trim()[0] : '';
    const a = formData.apellido ? formData.apellido.trim()[0] : '';
    return (n + a).toUpperCase() || 'GT';
  };

  // Formatear fechas YYYY-MM-DD o timestamps UTC a formato amigable (horario Argentina)
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return 'No registrado';
    try {
      return formatFechaArgentina(fechaStr, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return fechaStr;
    }
  };

  const socio = perfilData?.socio || perfilData?.perfil || {};
  const gimnasio = perfilData?.gimnasio || gimnasioActivo || socio?.gimnasio || null;

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
                    ? 'Gestiona tus datos personales y tu contraseña de acceso.'
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
                  className={`perfil-tab-btn ${pestañaActiva === 'seguridad' ? 'activo' : ''}`}
                  onClick={() => setPestañaActiva('seguridad')}
                >
                  <FaShieldAlt /> Seguridad & Contraseña
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
                              <span>Gimnasios Vinculados</span>
                              <strong>
                                {esSocio && gimnasios?.length > 0
                                  ? gimnasios.map((g) => g.nombre).join(' • ')
                                  : gimnasio.nombre}
                              </strong>
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

              {/* Contenido de la pestaña: Seguridad & Contraseña */}
              {pestañaActiva === 'seguridad' && (
                <div className="perfil-tab-content">
                  <div className="perfil-grid-2col">
                    {esSocio ? (
                      <div className="perfil-card">
                        <div className="perfil-card-header">
                          <div className="perfil-card-header-titles">
                            <div className="perfil-card-header-icon">
                              <FaLock />
                            </div>
                            <div>
                              <h3>Cambiar Contraseña</h3>
                              <p>Ingresa tu contraseña actual y define una nueva clave para tu cuenta</p>
                            </div>
                          </div>
                        </div>

                        <form onSubmit={handleCambiarPassword} className="perfil-form">
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
                    ) : (
                      <div className="perfil-card">
                        <div className="perfil-card-header">
                          <div className="perfil-card-header-titles">
                            <div className="perfil-card-header-icon">
                              <FaLock />
                            </div>
                            <div>
                              <h3>Acceso al Portal y Contraseña</h3>
                              <p>Gestión segura de credenciales mediante Supabase Auth</p>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            marginBottom: '18px',
                            fontSize: '13.5px',
                            lineHeight: 1.5,
                            color: '#cbd5e1'
                          }}
                        >
                          <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '6px' }}>
                            El dueño no puede cambiar directamente la contraseña del socio
                          </strong>
                          <span>
                            La cuenta del socio es única y personal en todo GymTrack. Por seguridad, solo el propio socio
                            puede modificar su contraseña desde su portal o restablecerla por correo electrónico.
                          </span>
                        </div>

                        <div className="perfil-gym-info-list" style={{ marginBottom: '18px' }}>
                          <div className="perfil-gym-info-item">
                            <div className="perfil-gym-info-icon">
                              <FaShieldAlt />
                            </div>
                            <div className="perfil-gym-info-text">
                              <span>Estado de Credenciales</span>
                              <strong style={{ color: (socio?.auth_user_id || socio?.tiene_contrasena) ? '#9EF01A' : '#f59e0b' }}>
                                {(socio?.auth_user_id || socio?.tiene_contrasena)
                                  ? 'Cuenta de portal configurada'
                                  : 'Sin contraseña de portal asignada'}
                              </strong>
                            </div>
                          </div>

                          <div className="perfil-gym-info-item">
                            <div className="perfil-gym-info-icon">
                              <FaEnvelope />
                            </div>
                            <div className="perfil-gym-info-text">
                              <span>Correo de Acceso y Recuperación</span>
                              <strong>
                                {formData.email && !formData.email.includes('@gymtrack.local')
                                  ? formData.email
                                  : 'Sin correo electrónico válido'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="perfil-form-actions" style={{ justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            className="perfil-btn-primary"
                            onClick={handleEnviarRecuperacionPassword}
                            disabled={
                              enviandoRecuperacion ||
                              !formData.email ||
                              formData.email.includes('@gymtrack.local')
                            }
                          >
                            <FaEnvelope />
                            {enviandoRecuperacion
                              ? 'Enviando enlace...'
                              : 'Enviar enlace para restablecer contraseña'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Recomendaciones de Seguridad */}
                    <div className="perfil-card">
                      <div className="perfil-card-header">
                        <div className="perfil-card-header-titles">
                          <div className="perfil-card-header-icon">
                            <FaShieldAlt />
                          </div>
                          <div>
                            <h3>{esSocio ? 'Recomendaciones de Seguridad' : 'Política de Seguridad de Cuentas'}</h3>
                            <p>
                              {esSocio
                                ? 'Protege el acceso a tu cuenta en GymTrack'
                                : 'Cómo administra GymTrack las credenciales de los socios'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="perfil-gym-info-list">
                        {esSocio ? (
                          <>
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
                          </>
                        ) : (
                          <>
                            <div className="perfil-gym-info-item">
                              <div className="perfil-gym-info-icon">
                                <FaCheckCircle />
                              </div>
                              <div className="perfil-gym-info-text">
                                <span>Identidad Única Multi-Gimnasio</span>
                                <strong>El socio inicia sesión con la misma contraseña en todos sus gimnasios vinculados.</strong>
                              </div>
                            </div>

                            <div className="perfil-gym-info-item">
                              <div className="perfil-gym-info-icon">
                                <FaCheckCircle />
                              </div>
                              <div className="perfil-gym-info-text">
                                <span>Cambio Autogestionado</span>
                                <strong>Si recuerda su clave actual, puede cambiarla desde Mi Perfil → Seguridad & Contraseña.</strong>
                              </div>
                            </div>

                            <div className="perfil-gym-info-item">
                              <div className="perfil-gym-info-icon">
                                <FaCheckCircle />
                              </div>
                              <div className="perfil-gym-info-text">
                                <span>Restablecimiento por Correo</span>
                                <strong>Si la olvidó, usá el botón para enviarle el enlace oficial de recuperación por email.</strong>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
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
