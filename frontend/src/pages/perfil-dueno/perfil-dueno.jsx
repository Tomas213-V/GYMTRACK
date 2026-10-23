/**
 * =========================================================================================
 * ARCHIVO: perfil-dueno.jsx
 * RUTA: frontend/src/pages/perfil-dueno/perfil-dueno.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Vista oficial de Perfil del Dueño y Datos del Gimnasio.
 * =========================================================================================
 * 
 * GUÍA DE ARQUITECTURA:
 * 1. Muestra y permite gestionar exclusivamente los datos del Dueño/Administrador (nombre,
 *    apellido, email, contraseña) y los datos institucionales de su Gimnasio (nombre comercial,
 *    dirección, teléfono, email de contacto).
 * 2. Si se accede con parámetro de query `?id=...`, delega la vista a la Ficha de Socio
 *    para permitir inspeccionar socios individuales desde enlaces directos o modales.
 * 3. Mantiene el diseño moderno de GYMTRACK con modo oscuro de alta fidelidad, micro-animaciones
 *    y navegación lateral consistente.
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  FaUser,
  FaEnvelope,
  FaBuilding,
  FaPhone,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaLock,
  FaShieldAlt,
  FaSave,
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationCircle,
  FaEye,
  FaEyeSlash,
  FaDumbbell,
  FaUsers,
  FaCheck
} from 'react-icons/fa';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar/sidebar';
import Perfil from '../perfil/perfil';
import { getPerfilOwner, updatePerfilOwner } from '../../services/authService';
import { actualizarMiGimnasio } from '../../services/gimnasioService';
import './perfil-dueno.css';

function PerfilDueno() {
  const location = useLocation();
  const navigate = useNavigate();

  // Si viene con ?id=..., estamos inspeccionando un socio específico -> renderizar ficha de socio
  const queryParams = new URLSearchParams(location.search);
  const socioIdParam = queryParams.get('id');
  if (socioIdParam) {
    return <Perfil />;
  }

  // Estados de carga y alertas
  const [cargando, setCargando] = useState(true);
  const [guardandoOwner, setGuardandoOwner] = useState(false);
  const [guardandoGym, setGuardandoGym] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [alerta, setAlerta] = useState(null); // { tipo: 'exito' | 'error', mensaje: string }

  // Pestañas: 'dueno' | 'gimnasio' | 'seguridad'
  const [pestanaActiva, setPestanaActiva] = useState('dueno');

  // Datos completos de usuario y gimnasio
  const [perfil, setPerfil] = useState(null);

  // Formulario Dueño
  const [ownerForm, setOwnerForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    rol: 'dueño',
    estado: 'activo',
    fecha_creacion: ''
  });

  // Formulario Gimnasio
  const [gymForm, setGymForm] = useState({
    id_gimnasio: null,
    nombre: '',
    direccion: '',
    telefono: '',
    email: '',
    fecha_registro: '',
    estado: 'activo'
  });

  // Formulario Contraseña
  const [passForm, setPassForm] = useState({
    contrasena_actual: '',
    nueva_contrasena: '',
    confirmar_contrasena: ''
  });

  const [verPassActual, setVerPassActual] = useState(false);
  const [verPassNueva, setVerPassNueva] = useState(false);
  const [verPassConfirm, setVerPassConfirm] = useState(false);

  // Cargar perfil completo del Dueño y Gimnasio
  const cargarDatos = async () => {
    try {
      setCargando(true);
      setAlerta(null);
      const res = await getPerfilOwner();
      const u = res?.usuario || {};
      setPerfil(u);

      setOwnerForm({
        nombre: u.nombre || '',
        apellido: u.apellido || '',
        email: u.email || '',
        rol: u.rol || 'dueño',
        estado: u.estado || 'activo',
        fecha_creacion: u.fecha_creacion ? u.fecha_creacion.split('T')[0] : ''
      });

      if (u.gimnasio) {
        setGymForm({
          id_gimnasio: u.gimnasio.id_gimnasio || null,
          nombre: u.gimnasio.nombre || '',
          direccion: u.gimnasio.direccion || '',
          telefono: u.gimnasio.telefono || '',
          email: u.gimnasio.email || '',
          fecha_registro: u.gimnasio.fecha_registro ? u.gimnasio.fecha_registro.split('T')[0] : '',
          estado: u.gimnasio.estado || 'activo'
        });
      }
    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'Error al cargar la información del perfil.'
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Formatear fechas
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return 'No registrada';
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

  // Iniciales para avatar
  const obtenerIniciales = () => {
    const n = ownerForm.nombre ? ownerForm.nombre.trim()[0] : '';
    const a = ownerForm.apellido ? ownerForm.apellido.trim()[0] : '';
    return (n + a).toUpperCase() || 'GT';
  };

  // Guardar datos personales del dueño
  const handleGuardarOwner = async (e) => {
    e.preventDefault();
    setAlerta(null);

    if (!ownerForm.nombre.trim()) {
      setAlerta({ tipo: 'error', mensaje: 'El nombre es obligatorio.' });
      return;
    }

    try {
      setGuardandoOwner(true);
      const res = await updatePerfilOwner({
        nombre: ownerForm.nombre,
        apellido: ownerForm.apellido,
        email: ownerForm.email
      });

      // Actualizar localStorage y token si cambió
      if (res.token) {
        localStorage.setItem('token', res.token);
      }
      if (res.usuario) {
        const guardado = JSON.parse(localStorage.getItem('usuario') || '{}');
        localStorage.setItem('usuario', JSON.stringify({ ...guardado, ...res.usuario }));
      }

      setAlerta({
        tipo: 'exito',
        mensaje: 'Tus datos personales fueron actualizados exitosamente.'
      });
      await cargarDatos();
    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'Error al actualizar los datos personales.'
      });
    } finally {
      setGuardandoOwner(false);
    }
  };

  // Guardar datos del gimnasio
  const handleGuardarGym = async (e) => {
    e.preventDefault();
    setAlerta(null);

    if (!gymForm.nombre.trim()) {
      setAlerta({ tipo: 'error', mensaje: 'El nombre del gimnasio es obligatorio.' });
      return;
    }

    try {
      setGuardandoGym(true);
      const res = await actualizarMiGimnasio({
        nombre: gymForm.nombre,
        direccion: gymForm.direccion,
        telefono: gymForm.telefono,
        email: gymForm.email
      });

      if (res.gimnasio) {
        const guardado = JSON.parse(localStorage.getItem('usuario') || '{}');
        guardado.gimnasio = res.gimnasio;
        localStorage.setItem('usuario', JSON.stringify(guardado));
      }

      setAlerta({
        tipo: 'exito',
        mensaje: 'Los datos de tu gimnasio fueron actualizados con éxito.'
      });
      await cargarDatos();
    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'Error al actualizar los datos del gimnasio.'
      });
    } finally {
      setGuardandoGym(false);
    }
  };

  // Guardar cambio de contraseña
  const handleGuardarPassword = async (e) => {
    e.preventDefault();
    setAlerta(null);

    if (!passForm.contrasena_actual) {
      setAlerta({ tipo: 'error', mensaje: 'Ingresa tu contraseña actual para confirmar el cambio.' });
      return;
    }

    if (!passForm.nueva_contrasena || passForm.nueva_contrasena.length < 6) {
      setAlerta({ tipo: 'error', mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    if (passForm.nueva_contrasena !== passForm.confirmar_contrasena) {
      setAlerta({ tipo: 'error', mensaje: 'La confirmación no coincide con la nueva contraseña.' });
      return;
    }

    try {
      setGuardandoPassword(true);
      await updatePerfilOwner({
        contrasena_actual: passForm.contrasena_actual,
        nueva_contrasena: passForm.nueva_contrasena
      });

      setPassForm({
        contrasena_actual: '',
        nueva_contrasena: '',
        confirmar_contrasena: ''
      });

      setAlerta({
        tipo: 'exito',
        mensaje: 'Tu contraseña de administrador fue actualizada correctamente.'
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

  const gym = perfil?.gimnasio || null;
  const stats = perfil?.estadisticas || {};

  return (
    <div className="perfil-dueno-layout">
      <NavGlobal />

      <div className="perfil-dueno-main-wrapper">
        <Sidebar />

        <main className="perfil-dueno-content">
          {/* Topbar con navegación de retorno */}
          <div className="perfil-dueno-topbar">
            <div className="perfil-dueno-topbar-left">
              <button
                onClick={() => navigate('/dashboard-dueño')}
                className="perfil-dueno-btn-volver"
              >
                <FaArrowLeft /> Panel Principal
              </button>
              <div>
                <h1>Mi Perfil & Mi Gimnasio</h1>
                <p>Gestiona tus credenciales de dueño, la información institucional de tu gimnasio y la seguridad de tu cuenta.</p>
              </div>
            </div>

            <div className="perfil-dueno-badge-rol">
              <FaShieldAlt className="perfil-dueno-badge-icon" />
              <span>Dueño / Administrador</span>
            </div>
          </div>

          {/* Feedback Alertas */}
          {alerta && (
            <div className={`perfil-dueno-alert ${alerta.tipo}`}>
              <div className="perfil-dueno-alert-content">
                {alerta.tipo === 'exito' ? (
                  <FaCheckCircle size={18} />
                ) : (
                  <FaExclamationCircle size={18} />
                )}
                <span>{alerta.mensaje}</span>
              </div>
              <button
                className="perfil-dueno-alert-close"
                onClick={() => setAlerta(null)}
              >
                &times;
              </button>
            </div>
          )}

          {cargando ? (
            <div className="perfil-dueno-loading">
              <div className="perfil-dueno-spinner"></div>
              <p>Cargando información del perfil del dueño...</p>
            </div>
          ) : (
            <>
              {/* Hero Banner del Dueño y su Gimnasio */}
              <div className="perfil-dueno-hero-card">
                <div className="perfil-dueno-hero-main">
                  <div className="perfil-dueno-avatar-wrapper">
                    <div className="perfil-dueno-avatar">
                      {obtenerIniciales()}
                    </div>
                    <span
                      className="perfil-dueno-status-dot activo"
                      title="Cuenta Activa"
                    ></span>
                  </div>

                  <div className="perfil-dueno-hero-info">
                    <h2>
                      {ownerForm.nombre} {ownerForm.apellido || ''}
                    </h2>
                    <div className="perfil-dueno-tags">
                      <span className="perfil-dueno-tag tag-rol">
                        <FaShieldAlt /> Rol: Dueño
                      </span>
                      {gym && (
                        <span className="perfil-dueno-tag tag-gym">
                          <FaBuilding /> {gym.nombre || 'Mi Gimnasio'}
                        </span>
                      )}
                      <span className="perfil-dueno-tag tag-estado">
                        <FaCheck /> {ownerForm.estado?.toUpperCase() || 'ACTIVO'}
                      </span>
                    </div>

                    <div className="perfil-dueno-hero-meta">
                      <span>
                        <FaEnvelope /> {ownerForm.email || 'Sin correo registrado'}
                      </span>
                      {gym?.telefono && (
                        <span>
                          <FaPhone /> {gym.telefono}
                        </span>
                      )}
                      {gym?.direccion && (
                        <span>
                          <FaMapMarkerAlt /> {gym.direccion}
                        </span>
                      )}
                      <span>
                        <FaCalendarAlt /> Miembro desde: {formatearFecha(ownerForm.fecha_creacion)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Métricas rápidas del Gimnasio */}
                <div className="perfil-dueno-quick-stats">
                  <div className="perfil-dueno-stat-box">
                    <div className="perfil-dueno-stat-icon-wrapper">
                      <FaUsers />
                    </div>
                    <div>
                      <span className="perfil-dueno-stat-val accent">
                        {stats.totalSocios ?? 0}
                      </span>
                      <span className="perfil-dueno-stat-label">Socios Totales</span>
                    </div>
                  </div>

                  <div className="perfil-dueno-stat-box">
                    <div className="perfil-dueno-stat-icon-wrapper">
                      <FaDumbbell />
                    </div>
                    <div>
                      <span className="perfil-dueno-stat-val">
                        {stats.sociosActivos ?? 0}
                      </span>
                      <span className="perfil-dueno-stat-label">Socios Activos</span>
                    </div>
                  </div>

                  <div className="perfil-dueno-stat-box">
                    <div className="perfil-dueno-stat-icon-wrapper">
                      <FaBuilding />
                    </div>
                    <div>
                      <span className="perfil-dueno-stat-val">
                        {gym ? 'Activo' : 'Pendiente'}
                      </span>
                      <span className="perfil-dueno-stat-label">Estado Gym</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pestañas de Navegación */}
              <div className="perfil-dueno-tabs-bar">
                <button
                  className={`perfil-dueno-tab-btn ${pestanaActiva === 'dueno' ? 'activo' : ''}`}
                  onClick={() => setPestanaActiva('dueno')}
                >
                  <FaUser /> Datos del Dueño
                </button>

                <button
                  className={`perfil-dueno-tab-btn ${pestanaActiva === 'gimnasio' ? 'activo' : ''}`}
                  onClick={() => setPestanaActiva('gimnasio')}
                >
                  <FaBuilding /> Datos del Gimnasio
                </button>

                <button
                  className={`perfil-dueno-tab-btn ${pestanaActiva === 'seguridad' ? 'activo' : ''}`}
                  onClick={() => setPestanaActiva('seguridad')}
                >
                  <FaShieldAlt /> Seguridad & Contraseña
                </button>
              </div>

              {/* CONTENIDO PESTAÑA 1: DATOS DEL DUEÑO */}
              {pestanaActiva === 'dueno' && (
                <div className="perfil-dueno-tab-content">
                  <div className="perfil-dueno-grid">
                    <div className="perfil-dueno-card">
                      <div className="perfil-dueno-card-header">
                        <div className="perfil-dueno-card-icon">
                          <FaUser />
                        </div>
                        <div>
                          <h3>Información Personal del Dueño</h3>
                          <p>Modifica tu nombre, apellido y dirección de correo de acceso a GymTrack</p>
                        </div>
                      </div>

                      <form onSubmit={handleGuardarOwner} className="perfil-dueno-form">
                        <div className="perfil-dueno-form-row">
                          <div className="perfil-dueno-form-group">
                            <label htmlFor="owner-nombre">
                              Nombre <span className="req">*</span>
                            </label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaUser className="perfil-dueno-input-icon" />
                              <input
                                id="owner-nombre"
                                type="text"
                                className="perfil-dueno-input"
                                value={ownerForm.nombre}
                                onChange={(e) => setOwnerForm({ ...ownerForm, nombre: e.target.value })}
                                placeholder="Ej: Tomás"
                                required
                              />
                            </div>
                          </div>

                          <div className="perfil-dueno-form-group">
                            <label htmlFor="owner-apellido">Apellido</label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaUser className="perfil-dueno-input-icon" />
                              <input
                                id="owner-apellido"
                                type="text"
                                className="perfil-dueno-input"
                                value={ownerForm.apellido}
                                onChange={(e) => setOwnerForm({ ...ownerForm, apellido: e.target.value })}
                                placeholder="Ej: Rodríguez"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="perfil-dueno-form-group">
                          <label htmlFor="owner-email">
                            Correo Electrónico de Acceso <span className="req">*</span>
                          </label>
                          <div className="perfil-dueno-input-wrapper">
                            <FaEnvelope className="perfil-dueno-input-icon" />
                            <input
                              id="owner-email"
                              type="email"
                              className="perfil-dueno-input"
                              value={ownerForm.email}
                              onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                              placeholder="admin@tu-gimnasio.com"
                              required
                            />
                          </div>
                          <span className="perfil-dueno-input-help">
                            Este email es utilizado para iniciar sesión en GymTrack como administrador.
                          </span>
                        </div>

                        <div className="perfil-dueno-form-row">
                          <div className="perfil-dueno-form-group">
                            <label>Rol de Usuario</label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaShieldAlt className="perfil-dueno-input-icon" />
                              <input
                                type="text"
                                className="perfil-dueno-input read-only"
                                value="Dueño / Propietario del Gimnasio"
                                disabled
                              />
                            </div>
                          </div>

                          <div className="perfil-dueno-form-group">
                            <label>Fecha de Registro</label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaCalendarAlt className="perfil-dueno-input-icon" />
                              <input
                                type="text"
                                className="perfil-dueno-input read-only"
                                value={formatearFecha(ownerForm.fecha_creacion)}
                                disabled
                              />
                            </div>
                          </div>
                        </div>

                        <div className="perfil-dueno-form-actions">
                          <button
                            type="submit"
                            className="perfil-dueno-btn-submit"
                            disabled={guardandoOwner}
                          >
                            <FaSave />
                            {guardandoOwner ? 'Guardando cambios...' : 'Guardar Datos Personales'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Tarjeta lateral Informativa */}
                    <div className="perfil-dueno-side-card">
                      <div className="perfil-dueno-side-card-badge">
                        <FaShieldAlt /> Administrador Principal
                      </div>
                      <h4>Control Total del Gimnasio</h4>
                      <p>
                        Como titular de la cuenta tienes acceso completo para gestionar socios,
                        tarifas y planes de membresía, control de caja y registro de rutinas.
                      </p>

                      <div className="perfil-dueno-checklist">
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>Alta y gestión de socios ilimitada</span>
                        </div>
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>Control financiero y cobros</span>
                        </div>
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>Configuración de planes y rutinas</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO PESTAÑA 2: DATOS DEL GIMNASIO */}
              {pestanaActiva === 'gimnasio' && (
                <div className="perfil-dueno-tab-content">
                  <div className="perfil-dueno-grid">
                    <div className="perfil-dueno-card">
                      <div className="perfil-dueno-card-header">
                        <div className="perfil-dueno-card-icon">
                          <FaBuilding />
                        </div>
                        <div>
                          <h3>Información Institucional del Gimnasio</h3>
                          <p>Administra los datos comerciales visibles para tus socios y en los comprobantes</p>
                        </div>
                      </div>

                      <form onSubmit={handleGuardarGym} className="perfil-dueno-form">
                        <div className="perfil-dueno-form-group">
                          <label htmlFor="gym-nombre">
                            Nombre del Gimnasio <span className="req">*</span>
                          </label>
                          <div className="perfil-dueno-input-wrapper">
                            <FaBuilding className="perfil-dueno-input-icon" />
                            <input
                              id="gym-nombre"
                              type="text"
                              className="perfil-dueno-input"
                              value={gymForm.nombre}
                              onChange={(e) => setGymForm({ ...gymForm, nombre: e.target.value })}
                              placeholder="Ej: Power Fit Gym"
                              required
                            />
                          </div>
                        </div>

                        <div className="perfil-dueno-form-group">
                          <label htmlFor="gym-direccion">Dirección / Ubicación</label>
                          <div className="perfil-dueno-input-wrapper">
                            <FaMapMarkerAlt className="perfil-dueno-input-icon" />
                            <input
                              id="gym-direccion"
                              type="text"
                              className="perfil-dueno-input"
                              value={gymForm.direccion}
                              onChange={(e) => setGymForm({ ...gymForm, direccion: e.target.value })}
                              placeholder="Ej: Av. San Martín 1420, Buenos Aires"
                            />
                          </div>
                        </div>

                        <div className="perfil-dueno-form-row">
                          <div className="perfil-dueno-form-group">
                            <label htmlFor="gym-telefono">Teléfono / WhatsApp de Contacto</label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaPhone className="perfil-dueno-input-icon" />
                              <input
                                id="gym-telefono"
                                type="tel"
                                className="perfil-dueno-input"
                                value={gymForm.telefono}
                                onChange={(e) => setGymForm({ ...gymForm, telefono: e.target.value })}
                                placeholder="Ej: +54 9 11 4567-8901"
                              />
                            </div>
                          </div>

                          <div className="perfil-dueno-form-group">
                            <label htmlFor="gym-email">Email Comercial</label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaEnvelope className="perfil-dueno-input-icon" />
                              <input
                                id="gym-email"
                                type="email"
                                className="perfil-dueno-input"
                                value={gymForm.email}
                                onChange={(e) => setGymForm({ ...gymForm, email: e.target.value })}
                                placeholder="contacto@tu-gimnasio.com"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="perfil-dueno-form-row">
                          <div className="perfil-dueno-form-group">
                            <label>Fecha de Registro del Gimnasio</label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaCalendarAlt className="perfil-dueno-input-icon" />
                              <input
                                type="text"
                                className="perfil-dueno-input read-only"
                                value={formatearFecha(gymForm.fecha_registro)}
                                disabled
                              />
                            </div>
                          </div>

                          <div className="perfil-dueno-form-group">
                            <label>Estado del Establecimiento</label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaCheck className="perfil-dueno-input-icon" />
                              <input
                                type="text"
                                className="perfil-dueno-input read-only"
                                value={gymForm.estado ? gymForm.estado.toUpperCase() : 'ACTIVO'}
                                disabled
                              />
                            </div>
                          </div>
                        </div>

                        <div className="perfil-dueno-form-actions">
                          <button
                            type="submit"
                            className="perfil-dueno-btn-submit"
                            disabled={guardandoGym}
                          >
                            <FaSave />
                            {guardandoGym ? 'Guardando datos...' : 'Guardar Datos del Gimnasio'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Tarjeta lateral Gimnasio */}
                    <div className="perfil-dueno-side-card">
                      <div className="perfil-dueno-side-card-badge">
                        <FaBuilding /> Marca Comercial
                      </div>
                      <h4>Identidad de tu Gimnasio</h4>
                      <p>
                        Esta información aparece en las fichas y credenciales de los socios,
                        así como en los comprobantes de pago generados por el sistema.
                      </p>

                      <div className="perfil-dueno-checklist">
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>Visible para tus socios en su portal</span>
                        </div>
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>Encabezado de recibos y facturas</span>
                        </div>
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>Canales oficiales de soporte y contacto</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO PESTAÑA 3: SEGURIDAD & CONTRASEÑA */}
              {pestanaActiva === 'seguridad' && (
                <div className="perfil-dueno-tab-content">
                  <div className="perfil-dueno-grid">
                    <div className="perfil-dueno-card">
                      <div className="perfil-dueno-card-header">
                        <div className="perfil-dueno-card-icon">
                          <FaShieldAlt />
                        </div>
                        <div>
                          <h3>Seguridad & Contraseña</h3>
                          <p>Actualiza la clave de acceso de tu cuenta de dueño/administrador</p>
                        </div>
                      </div>

                      <form onSubmit={handleGuardarPassword} className="perfil-dueno-form">
                        <div className="perfil-dueno-form-group">
                          <label htmlFor="pass-actual">
                            Contraseña Actual <span className="req">*</span>
                          </label>
                          <div className="perfil-dueno-input-wrapper">
                            <FaLock className="perfil-dueno-input-icon" />
                            <input
                              id="pass-actual"
                              type={verPassActual ? 'text' : 'password'}
                              className="perfil-dueno-input"
                              value={passForm.contrasena_actual}
                              onChange={(e) => setPassForm({ ...passForm, contrasena_actual: e.target.value })}
                              placeholder="Ingresa tu contraseña actual"
                              required
                            />
                            <button
                              type="button"
                              className="perfil-dueno-input-btn-ver"
                              onClick={() => setVerPassActual(!verPassActual)}
                            >
                              {verPassActual ? <FaEyeSlash /> : <FaEye />}
                            </button>
                          </div>
                        </div>

                        <div className="perfil-dueno-form-row">
                          <div className="perfil-dueno-form-group">
                            <label htmlFor="pass-nueva">
                              Nueva Contraseña <span className="req">*</span>
                            </label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaLock className="perfil-dueno-input-icon" />
                              <input
                                id="pass-nueva"
                                type={verPassNueva ? 'text' : 'password'}
                                className="perfil-dueno-input"
                                value={passForm.nueva_contrasena}
                                onChange={(e) => setPassForm({ ...passForm, nueva_contrasena: e.target.value })}
                                placeholder="Mínimo 6 caracteres"
                                required
                              />
                              <button
                                type="button"
                                className="perfil-dueno-input-btn-ver"
                                onClick={() => setVerPassNueva(!verPassNueva)}
                              >
                                {verPassNueva ? <FaEyeSlash /> : <FaEye />}
                              </button>
                            </div>
                          </div>

                          <div className="perfil-dueno-form-group">
                            <label htmlFor="pass-confirmar">
                              Confirmar Nueva Contraseña <span className="req">*</span>
                            </label>
                            <div className="perfil-dueno-input-wrapper">
                              <FaLock className="perfil-dueno-input-icon" />
                              <input
                                id="pass-confirmar"
                                type={verPassConfirm ? 'text' : 'password'}
                                className="perfil-dueno-input"
                                value={passForm.confirmar_contrasena}
                                onChange={(e) => setPassForm({ ...passForm, confirmar_contrasena: e.target.value })}
                                placeholder="Repite la nueva contraseña"
                                required
                              />
                              <button
                                type="button"
                                className="perfil-dueno-input-btn-ver"
                                onClick={() => setVerPassConfirm(!verPassConfirm)}
                              >
                                {verPassConfirm ? <FaEyeSlash /> : <FaEye />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="perfil-dueno-form-actions">
                          <button
                            type="submit"
                            className="perfil-dueno-btn-submit"
                            disabled={guardandoPassword}
                          >
                            <FaSave />
                            {guardandoPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Tarjeta lateral Seguridad */}
                    <div className="perfil-dueno-side-card">
                      <div className="perfil-dueno-side-card-badge">
                        <FaLock /> Recomendaciones
                      </div>
                      <h4>Buenas Prácticas de Acceso</h4>
                      <p>
                        Tu cuenta de dueño administra los datos de todos los socios y la caja del gimnasio.
                      </p>

                      <div className="perfil-dueno-checklist">
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>Usa al menos 8 caracteres combinando números y letras</span>
                        </div>
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>No compartas tu contraseña con socios ni personal</span>
                        </div>
                        <div className="perfil-dueno-checklist-item">
                          <FaCheck className="chk-icon" />
                          <span>Cierra tu sesión cuando uses computadoras compartidas</span>
                        </div>
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

export default PerfilDueno;
