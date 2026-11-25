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

import { useState, useEffect, useCallback } from 'react';
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
  FaCheck,
  FaIdCard,
  FaCreditCard,
  FaExternalLinkAlt,
  FaUnlink,
  FaSyncAlt
} from 'react-icons/fa';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import Perfil from '../perfil-socio/perfil';
import { MercadoPagoLogo } from '../../components/membresia-socio/PaymentLogos';
import { useGymContext } from '../../context/GymContext';
import { getPerfilOwner, updatePerfilOwner, cambiarContrasena } from '../../services/authService';
import { actualizarMiGimnasio } from '../../services/gimnasioService';
import {
  getEstadoIntegracionMP,
  iniciarConexionMP,
  desconectarMP,
  completarConexionSimuladaMP
} from '../../services/integracionPagoService';
import './perfil-dueno.css';

function PerfilDueno() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    rol,
    usuario: usuarioContexto,
    esDueno,
    esAdministrador,
    esEmpleado,
    gimnasioActivo,
    gimnasioActivoId,
    sucursalActiva,
    contextVersion,
    refreshProfile
  } = useGymContext();

  const puedeAdministrarIntegraciones = esDueno || esAdministrador;

  const queryParams = new URLSearchParams(location.search);
  const socioIdParam = queryParams.get('id');
  const tabParam = queryParams.get('tab');
  const mpStatusParam = queryParams.get('mp_status');
  const mpReasonParam = queryParams.get('mp_reason');

  const [cargando, setCargando] = useState(true);
  const [guardandoOwner, setGuardandoOwner] = useState(false);
  const [guardandoGym, setGuardandoGym] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [alerta, setAlerta] = useState(null);

  const [pestanaActiva, setPestanaActiva] = useState(() =>
    tabParam === 'integracion-pagos' ? 'integracion-pagos' : 'dueno'
  );
  const [perfil, setPerfil] = useState(null);

  // Estado de Integración de Pagos (Mercado Pago OAuth / Simulación de cuenta de prueba)
  const [mpIntegracion, setMpIntegracion] = useState(null);
  const [cargandoMp, setCargandoMp] = useState(false);
  const [accionMpEnCurso, setAccionMpEnCurso] = useState(false);
  const [confirmandoDesconexionMp, setConfirmandoDesconexionMp] = useState(false);
  const [mpErrorCallback, setMpErrorCallback] = useState(false);
  const [modalOAuthSimulado, setModalOAuthSimulado] = useState(null); // { state, cuenta_prueba }

  const [ownerForm, setOwnerForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    dni: '',
    rol: 'dueño',
    estado: 'activo',
    fecha_creacion: ''
  });

  const [gymForm, setGymForm] = useState({
    id_gimnasio: null,
    nombre: '',
    telefono: '',
    email: '',
    fecha_registro: '',
    estado: 'activo'
  });

  const [passForm, setPassForm] = useState({
    contrasena_actual: '',
    nueva_contrasena: '',
    confirmar_contrasena: ''
  });

  const [verPassActual, setVerPassActual] = useState(false);
  const [verPassNueva, setVerPassNueva] = useState(false);
  const [verPassConfirm, setVerPassConfirm] = useState(false);

  const cargarDatos = useCallback(async () => {
    if (socioIdParam) return;
    try {
      setCargando(true);
      setAlerta(null);
      const res = await getPerfilOwner();
      const u = res?.usuario || {};
      setPerfil(u);

      // Si el contexto global quedó desfasado respecto al token autenticado real (ej. cambio en otra pestaña), resincronizar
      const authCtx = usuarioContexto?.auth_user_id || usuarioContexto?.email;
      const authResp = u?.auth_user_id || u?.email;
      if (authCtx && authResp && String(authCtx).toLowerCase() !== String(authResp).toLowerCase()) {
        refreshProfile();
      }

      const estadoUser = u.estado === false ? 'inactivo' : 'activo';
      setOwnerForm({
        nombre: u.nombre || '',
        apellido: u.apellido || '',
        email: u.email || '',
        telefono: u.telefono || '',
        dni: u.dni || '',
        rol: u.rol || rol || 'dueño',
        estado: estadoUser,
        fecha_creacion: u.fecha_creacion ? u.fecha_creacion.split('T')[0] : ''
      });

      const gymTarget =
        (res?.gimnasios || []).find((g) => String(g.id_gimnasio) === String(gimnasioActivoId)) ||
        u.gimnasio ||
        gimnasioActivo;

      if (gymTarget) {
        setGymForm({
          id_gimnasio: gymTarget.id_gimnasio || null,
          nombre: gymTarget.nombre || '',
          telefono: gymTarget.telefono || '',
          email: gymTarget.email || '',
          fecha_registro: gymTarget.fecha_registro ? gymTarget.fecha_registro.split('T')[0] : '',
          estado: gymTarget.estado === false ? 'inactivo' : 'activo'
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
  }, [socioIdParam, rol, gimnasioActivoId, gimnasioActivo, usuarioContexto, refreshProfile]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, contextVersion]);

  const cargarIntegracionMP = useCallback(
    async (signal) => {
      if (socioIdParam || !puedeAdministrarIntegraciones || !gimnasioActivoId) {
        setMpIntegracion(null);
        setCargandoMp(false);
        return;
      }
      try {
        setCargandoMp(true);
        const data = await getEstadoIntegracionMP(gimnasioActivoId, { signal });
        if (signal?.aborted) return;
        setMpIntegracion(data || null);
      } catch (err) {
        if (err.name === 'AbortError' || signal?.aborted) return;
        setMpIntegracion({
          estado: 'error',
          conectado: false,
          oauth_configurado: false,
          error_mensaje: err.message || 'No se pudo consultar el estado de Mercado Pago.'
        });
      } finally {
        if (!signal?.aborted) setCargandoMp(false);
      }
    },
    [socioIdParam, puedeAdministrarIntegraciones, gimnasioActivoId]
  );

  useEffect(() => {
    const controller = new AbortController();
    cargarIntegracionMP(controller.signal);
    return () => controller.abort();
  }, [cargarIntegracionMP, contextVersion]);

  // Procesar resultado de retorno OAuth de Mercado Pago (?tab=integracion-pagos&mp_status=...)
  useEffect(() => {
    if (!mpStatusParam) return;
    if (puedeAdministrarIntegraciones) {
      setPestanaActiva('integracion-pagos');
    }

    if (mpStatusParam === 'connected') {
      setMpErrorCallback(false);
      setAlerta({
        tipo: 'exito',
        mensaje: 'Cuenta de Mercado Pago conectada correctamente a tu gimnasio.'
      });
      cargarIntegracionMP();
    } else if (mpStatusParam === 'error') {
      setMpErrorCallback(true);
      const reasonMessages = {
        access_denied: 'Cancelaste la autorización en Mercado Pago. Tu cuenta no fue vinculada.',
        missing_code: 'Mercado Pago no envió el código de autorización. Intentá nuevamente.',
        token_exchange_failed: 'No fue posible completar la autorización con Mercado Pago. Intentá nuevamente.',
        already_connected: 'Este gimnasio ya tiene una cuenta de Mercado Pago conectada.',
        storage_error: 'No se pudo guardar la vinculación en el servidor. Intentá nuevamente.'
      };
      setAlerta({
        tipo: 'error',
        mensaje:
          reasonMessages[mpReasonParam] ||
          'Ocurrió un error al vincular tu cuenta de Mercado Pago. Intentá nuevamente.'
      });
    }

    navigate('/perfil-dueño', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpStatusParam, mpReasonParam]);

  if (socioIdParam) {
    return <Perfil />;
  }

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

  // Guardar datos personales (dueño / administrador / empleado)
  const handleGuardarOwner = async (e) => {
    e.preventDefault();
    setAlerta(null);

    if (!ownerForm.nombre.trim()) {
      setAlerta({ tipo: 'error', mensaje: 'El nombre es obligatorio.' });
      return;
    }

    try {
      setGuardandoOwner(true);
      const payload = {
        nombre: ownerForm.nombre,
        apellido: ownerForm.apellido,
        email: ownerForm.email,
        ...(esEmpleado || esAdministrador ? { telefono: ownerForm.telefono } : {})
      };
      const resUpd = await updatePerfilOwner(payload);

      if (resUpd?.token) {
        localStorage.setItem('token', resUpd.token);
      }
      if (resUpd?.refresh_token) {
        localStorage.setItem('refresh_token', resUpd.refresh_token);
      }

      await refreshProfile();

      setAlerta({
        tipo: 'exito',
        mensaje: resUpd?.mensaje || 'Tus datos personales fueron actualizados exitosamente.'
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
      await actualizarMiGimnasio(
        {
          nombre: gymForm.nombre,
          telefono: gymForm.telefono,
          email: gymForm.email
        },
        gymForm.id_gimnasio
      );

      await refreshProfile();

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
      const resPass = await cambiarContrasena({
        contrasena_actual: passForm.contrasena_actual,
        nueva_contrasena: passForm.nueva_contrasena,
        confirmar_contrasena: passForm.confirmar_contrasena
      });

      if (resPass?.token) {
        localStorage.setItem('token', resPass.token);
      }
      if (resPass?.refresh_token) {
        localStorage.setItem('refresh_token', resPass.refresh_token);
      }

      setPassForm({
        contrasena_actual: '',
        nueva_contrasena: '',
        confirmar_contrasena: ''
      });

      setAlerta({
        tipo: 'exito',
        mensaje: resPass?.mensaje || 'Tu contraseña fue actualizada correctamente.'
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

  // Iniciar flujo OAuth oficial de Mercado Pago (o pantalla simulada en modo presentación)
  const handleConectarMP = async (reconectar = false) => {
    setAlerta(null);
    setMpErrorCallback(false);
    try {
      setAccionMpEnCurso(true);
      const res = await iniciarConexionMP({
        id_gimnasio: gimnasioActivoId,
        reconectar
      });
      if (res?.modo === 'simulacion_prueba' && res?.state) {
        setModalOAuthSimulado({
          state: res.state,
          cuenta_prueba: res.cuenta_prueba || mpIntegracion?.cuenta_prueba || null
        });
        setAccionMpEnCurso(false);
        return;
      }
      if (!res?.authorization_url) {
        throw new Error('El servidor no devolvió una URL de autorización de Mercado Pago.');
      }
      window.location.assign(res.authorization_url);
    } catch (err) {
      setMpErrorCallback(true);
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'No se pudo iniciar la conexión con Mercado Pago.'
      });
      setAccionMpEnCurso(false);
    }
  };

  // Completar o cancelar la vinculación simulada con la cuenta de prueba de Mercado Pago
  const handleConfirmarOAuthSimulado = async (autorizado) => {
    if (!modalOAuthSimulado?.state) return;
    setAlerta(null);
    try {
      setAccionMpEnCurso(true);
      const res = await completarConexionSimuladaMP({
        state: modalOAuthSimulado.state,
        autorizado,
        id_gimnasio: gimnasioActivoId
      });
      setModalOAuthSimulado(null);
      setMpIntegracion(res);
      if (autorizado && res?.conectado) {
        setMpErrorCallback(false);
        setAlerta({
          tipo: 'exito',
          mensaje: res.mensaje || 'Cuenta de prueba de Mercado Pago conectada correctamente.'
        });
      } else {
        setMpErrorCallback(true);
        setAlerta({
          tipo: 'error',
          mensaje: res?.mensaje || 'Cancelaste la autorización en Mercado Pago.'
        });
      }
    } catch (err) {
      setModalOAuthSimulado(null);
      setMpErrorCallback(true);
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'No fue posible completar la vinculación con Mercado Pago.'
      });
    } finally {
      setAccionMpEnCurso(false);
    }
  };

  // Desconectar cuenta de Mercado Pago (conservando el historial de pagos)
  const handleDesconectarMP = async () => {
    setAlerta(null);
    try {
      setAccionMpEnCurso(true);
      const res = await desconectarMP(gimnasioActivoId);
      setConfirmandoDesconexionMp(false);
      setMpErrorCallback(false);
      setMpIntegracion(res);
      setAlerta({
        tipo: 'exito',
        mensaje:
          res?.mensaje ||
          'Cuenta de Mercado Pago desconectada correctamente. El historial de pagos se conserva intacto.'
      });
    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'No se pudo desconectar la cuenta de Mercado Pago.'
      });
    } finally {
      setAccionMpEnCurso(false);
    }
  };

  const gym = perfil?.gimnasio || gimnasioActivo || null;
  const stats = perfil?.estadisticas || {};
  const pestanaEfectiva = esEmpleado && pestanaActiva === 'gimnasio' ? 'dueno' : pestanaActiva;
  const etiquetaRolPerfil = esEmpleado
    ? 'Empleado'
    : esAdministrador
    ? 'Administrador'
    : 'Dueño / Administrador';
  const etiquetaSubrolEmpleado =
    esEmpleado && Array.isArray(perfil?.roles_empleado) && perfil.roles_empleado.length > 0
      ? perfil.roles_empleado
          .map((r) => (r === 'administrador' ? 'Admin. Sucursal' : r.charAt(0).toUpperCase() + r.slice(1)))
          .join(', ')
      : 'Empleado operativo';

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
                onClick={() => navigate(esEmpleado ? '/socios-dueño' : '/dashboard-dueño')}
                className="perfil-dueno-btn-volver"
              >
                <FaArrowLeft /> {esEmpleado ? 'Volver a Socios' : 'Panel Principal'}
              </button>
              <div>
                <h1>{esEmpleado ? 'Mi Perfil de Empleado' : 'Mi Perfil & Mi Gimnasio'}</h1>
                <p>
                  {esEmpleado
                    ? 'Visualiza y actualiza tus datos personales, teléfono, correo electrónico y contraseña de acceso.'
                    : 'Gestiona tus credenciales de dueño, la información institucional de tu gimnasio y la seguridad de tu cuenta.'}
                </p>
              </div>
            </div>

            <div className="perfil-dueno-badge-rol">
              <FaShieldAlt className="perfil-dueno-badge-icon" />
              <span>{etiquetaRolPerfil}</span>
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
              <p>Cargando información del perfil...</p>
            </div>
          ) : (
            <>
              {/* Hero Banner */}
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
                        <FaShieldAlt /> Rol: {esEmpleado ? etiquetaSubrolEmpleado : esAdministrador ? 'Administrador' : 'Dueño'}
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
                      {(esEmpleado ? ownerForm.telefono : gym?.telefono) && (
                        <span>
                          <FaPhone /> {esEmpleado ? ownerForm.telefono : gym?.telefono}
                        </span>
                      )}
                      {esEmpleado && sucursalActiva?.direccion && (
                        <span>
                          <FaMapMarkerAlt /> {sucursalActiva.direccion}
                        </span>
                      )}
                      {!esEmpleado && gym?.direccion && (
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

                {/* Métricas rápidas del Gimnasio (solo dueño/admin) */}
                {!esEmpleado && (
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
                )}
              </div>

              {/* Pestañas de Navegación */}
              <div className="perfil-dueno-tabs-bar">
                <button
                  className={`perfil-dueno-tab-btn ${pestanaEfectiva === 'dueno' ? 'activo' : ''}`}
                  onClick={() => setPestanaActiva('dueno')}
                >
                  <FaUser /> {esEmpleado ? 'Datos Personales' : 'Datos del Dueño'}
                </button>

                {!esEmpleado && (
                  <button
                    className={`perfil-dueno-tab-btn ${pestanaEfectiva === 'gimnasio' ? 'activo' : ''}`}
                    onClick={() => setPestanaActiva('gimnasio')}
                  >
                    <FaBuilding /> Datos del Gimnasio
                  </button>
                )}

                {puedeAdministrarIntegraciones && (
                  <button
                    className={`perfil-dueno-tab-btn ${pestanaActiva === 'integracion-pagos' ? 'activo' : ''}`}
                    onClick={() => setPestanaActiva('integracion-pagos')}
                  >
                    <FaCreditCard /> Integración de pagos
                  </button>
                )}

                <button
                  className={`perfil-dueno-tab-btn ${pestanaEfectiva === 'seguridad' ? 'activo' : ''}`}
                  onClick={() => setPestanaActiva('seguridad')}
                >
                  <FaShieldAlt /> Seguridad & Contraseña
                </button>
              </div>

              {/* CONTENIDO PESTAÑA 1: DATOS PERSONALES */}
              {pestanaEfectiva === 'dueno' && (
                <div className="perfil-dueno-tab-content">
                  <div className="perfil-dueno-grid">
                    <div className="perfil-dueno-card">
                      <div className="perfil-dueno-card-header">
                        <div className="perfil-dueno-card-icon">
                          <FaUser />
                        </div>
                        <div>
                          <h3>{esEmpleado ? 'Información Personal del Empleado' : 'Información Personal del Dueño'}</h3>
                          <p>
                            {esEmpleado
                              ? 'Modifica tu nombre, apellido, teléfono y correo electrónico de acceso a GymTrack'
                              : 'Modifica tu nombre, apellido y dirección de correo de acceso a GymTrack'}
                          </p>
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

                        {(esEmpleado || esAdministrador) && (
                          <div className="perfil-dueno-form-row">
                            <div className="perfil-dueno-form-group">
                              <label htmlFor="owner-telefono">Teléfono</label>
                              <div className="perfil-dueno-input-wrapper">
                                <FaPhone className="perfil-dueno-input-icon" />
                                <input
                                  id="owner-telefono"
                                  type="tel"
                                  className="perfil-dueno-input"
                                  value={ownerForm.telefono}
                                  onChange={(e) => setOwnerForm({ ...ownerForm, telefono: e.target.value })}
                                  placeholder="Ej: +54 9 11 4567-8901"
                                />
                              </div>
                            </div>

                            <div className="perfil-dueno-form-group">
                              <label>DNI</label>
                              <div className="perfil-dueno-input-wrapper">
                                <FaIdCard className="perfil-dueno-input-icon" />
                                <input
                                  type="text"
                                  className="perfil-dueno-input read-only"
                                  value={ownerForm.dni || 'No registrado'}
                                  disabled
                                />
                              </div>
                            </div>
                          </div>
                        )}

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
                              placeholder={esEmpleado ? 'empleado@tu-gimnasio.com' : 'admin@tu-gimnasio.com'}
                              required
                            />
                          </div>
                          <span className="perfil-dueno-input-help">
                            {esEmpleado
                              ? 'Este email es utilizado para iniciar sesión en GymTrack con tu cuenta de empleado.'
                              : 'Este email es utilizado para iniciar sesión en GymTrack como administrador.'}
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
                                value={
                                  esEmpleado
                                    ? `Empleado (${etiquetaSubrolEmpleado})`
                                    : esAdministrador
                                    ? 'Administrador de Gimnasio'
                                    : 'Dueño / Propietario del Gimnasio'
                                }
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
                        <FaShieldAlt /> {esEmpleado ? 'Cuenta de Empleado' : esDueno ? 'Administrador Principal' : 'Administrador'}
                      </div>
                      <h4>{esEmpleado ? 'Operación del Gimnasio' : 'Control Total del Gimnasio'}</h4>
                      <p>
                        {esEmpleado
                          ? `Operás dentro de ${gym?.nombre || 'tu gimnasio asignado'} con acceso a las herramientas operativas diarias.`
                          : 'Como titular de la cuenta tienes acceso completo para gestionar socios, tarifas y planes de membresía, control de caja y registro de rutinas.'}
                      </p>

                      <div className="perfil-dueno-checklist">
                        {esEmpleado ? (
                          <>
                            <div className="perfil-dueno-checklist-item">
                              <FaCheck className="chk-icon" />
                              <span>Gestión de socios, cuotas y cobros</span>
                            </div>
                            <div className="perfil-dueno-checklist-item">
                              <FaCheck className="chk-icon" />
                              <span>Control de entrada y salida de asistencias</span>
                            </div>
                            <div className="perfil-dueno-checklist-item">
                              <FaCheck className="chk-icon" />
                              <span>Catálogo de ejercicios, rutinas y asignaciones</span>
                            </div>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO PESTAÑA 2: DATOS DEL GIMNASIO (solo dueño/admin) */}
              {!esEmpleado && pestanaEfectiva === 'gimnasio' && (
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
                          <label>Sucursales / Direcciones</label>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(158, 240, 26, 0.06)', border: '1px solid rgba(158, 240, 26, 0.2)' }}>
                            <span style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FaMapMarkerAlt style={{ color: '#9EF01A' }} />
                              Las direcciones físicas se administran por sucursal.
                            </span>
                            <Link to="/sucursales-dueño" style={{ color: '#9EF01A', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
                              Gestionar Sucursales →
                            </Link>
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

              {/* CONTENIDO PESTAÑA: INTEGRACIÓN DE PAGOS (MERCADO PAGO OAUTH) */}
              {pestanaActiva === 'integracion-pagos' && puedeAdministrarIntegraciones && (() => {
                const estadoActual = mpIntegracion?.conectado
                  ? 'conectado'
                  : mpIntegracion?.estado === 'error' || mpErrorCallback
                  ? 'error'
                  : 'no_conectado';
                const cuentaMp = mpIntegracion?.cuenta || null;
                const esSimulacion = mpIntegracion?.modo === 'simulacion_prueba' || Boolean(mpIntegracion?.simulacion_disponible);
                const oauthConfigurado = mpIntegracion?.oauth_configurado === true || esSimulacion;

                return (
                  <div className="perfil-dueno-tab-content">
                    <div className="perfil-dueno-grid">
                      <div className="perfil-dueno-card">
                        <div className="perfil-dueno-card-header mp-integration-header">
                          <div className="mp-brand-block">
                            <MercadoPagoLogo height={30} />
                            <div>
                              <h3>Integración de pagos — Mercado Pago</h3>
                              <p>
                                Conectá tu cuenta de Mercado Pago para recibir los pagos de las membresías de tu gimnasio.
                              </p>
                            </div>
                          </div>

                          <span className={`mp-status-pill ${estadoActual}`}>
                            {estadoActual === 'conectado'
                              ? 'Conectado'
                              : estadoActual === 'error'
                              ? 'Error'
                              : 'No conectado'}
                          </span>
                        </div>

                        {cargandoMp ? (
                          <div className="mp-loading-box">
                            <div className="perfil-dueno-spinner" />
                            <span>Consultando estado de conexión con Mercado Pago...</span>
                          </div>
                        ) : (
                          <div className="mp-integration-body">
                            {esSimulacion && (
                              <div className="mp-info-demo-box">
                                <FaCheckCircle />
                                <span>
                                  <strong>Modo presentación (cuenta de prueba):</strong> la vinculación simula el paso
                                  de autorización OAuth y mantiene los cobros online dirigidos a tu cuenta de prueba de Mercado Pago.
                                </span>
                              </div>
                            )}

                            {!oauthConfigurado && (
                              <div className="mp-warning-box">
                                <FaExclamationCircle />
                                <span>
                                  El servidor todavía no tiene configuradas las credenciales OAuth privadas de Mercado Pago
                                  (<code>MERCADOPAGO_CLIENT_ID</code>, <code>MERCADOPAGO_CLIENT_SECRET</code>,{' '}
                                  <code>MERCADOPAGO_REDIRECT_URI</code> y <code>MERCADOPAGO_TOKEN_ENCRYPTION_KEY</code>).
                                </span>
                              </div>
                            )}

                            {mpIntegracion?.error_mensaje && (
                              <div className="mp-warning-box error">
                                <FaExclamationCircle />
                                <span>{mpIntegracion.error_mensaje}</span>
                              </div>
                            )}

                            {estadoActual === 'conectado' && cuentaMp ? (
                              <>
                                <div className="mp-account-details">
                                  <div className="mp-detail-item">
                                    <span className="mp-detail-label">Proveedor</span>
                                    <span className="mp-detail-value">
                                      {esSimulacion ? 'Mercado Pago (Cuenta de prueba)' : 'Mercado Pago (OAuth oficial)'}
                                    </span>
                                  </div>
                                  <div className="mp-detail-item">
                                    <span className="mp-detail-label">ID de cuenta vinculada</span>
                                    <span className="mp-detail-value">
                                      {cuentaMp.external_user_id || 'Vinculada'}
                                      {cuentaMp.alias ? ` (${cuentaMp.alias})` : ''}
                                    </span>
                                  </div>
                                  <div className="mp-detail-item">
                                    <span className="mp-detail-label">Gimnasio vinculado</span>
                                    <span className="mp-detail-value">
                                      {gymForm.nombre || gimnasioActivo?.nombre || 'Gimnasio activo'}
                                    </span>
                                  </div>
                                  <div className="mp-detail-item">
                                    <span className="mp-detail-label">Fecha de conexión</span>
                                    <span className="mp-detail-value">
                                      {formatearFecha(cuentaMp.fecha_conexion)}
                                    </span>
                                  </div>
                                </div>

                                <div className="mp-actions-row">
                                  <button
                                    type="button"
                                    className="mp-btn-reconnect"
                                    disabled={accionMpEnCurso || !oauthConfigurado}
                                    onClick={() => handleConectarMP(true)}
                                  >
                                    <FaSyncAlt />
                                    {accionMpEnCurso ? 'Redirigiendo...' : 'Volver a vincular'}
                                  </button>

                                  {!confirmandoDesconexionMp ? (
                                    <button
                                      type="button"
                                      className="mp-btn-disconnect"
                                      disabled={accionMpEnCurso}
                                      onClick={() => setConfirmandoDesconexionMp(true)}
                                    >
                                      <FaUnlink /> Desconectar cuenta
                                    </button>
                                  ) : (
                                    <div className="mp-confirm-disconnect">
                                      <span>¿Confirmás desconectar? No se borrará tu historial de pagos.</span>
                                      <button
                                        type="button"
                                        className="mp-btn-disconnect confirm"
                                        disabled={accionMpEnCurso}
                                        onClick={handleDesconectarMP}
                                      >
                                        {accionMpEnCurso ? 'Desconectando...' : 'Sí, desconectar'}
                                      </button>
                                      <button
                                        type="button"
                                        className="mp-btn-cancel"
                                        disabled={accionMpEnCurso}
                                        onClick={() => setConfirmandoDesconexionMp(false)}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="mp-connect-cta-box">
                                <p>
                                  Al hacer clic en el botón serás redirigido al sitio oficial de Mercado Pago para
                                  autorizar de forma segura tu cuenta comercial para{' '}
                                  <strong>{gymForm.nombre || gimnasioActivo?.nombre || 'tu gimnasio'}</strong>.
                                </p>

                                <div className="mp-actions-row">
                                  <button
                                    type="button"
                                    className="mp-btn-connect"
                                    disabled={accionMpEnCurso || !gimnasioActivoId}
                                    onClick={() => handleConectarMP(false)}
                                  >
                                    <FaCreditCard />
                                    <span>
                                      {accionMpEnCurso
                                        ? 'Iniciando autorización...'
                                        : 'Conectar cuenta de Mercado Pago'}
                                    </span>
                                    <FaExternalLinkAlt style={{ fontSize: '12px' }} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tarjeta lateral Seguridad OAuth */}
                      <div className="perfil-dueno-side-card">
                        <div className="perfil-dueno-side-card-badge">
                          <FaShieldAlt /> Conexión OAuth Segura
                        </div>
                        <h4>Cómo funciona la vinculación</h4>
                        <p>
                          Cada gimnasio vincula su propia cuenta de Mercado Pago mediante autorización oficial OAuth.
                          GymTrack nunca te pedirá tu contraseña de Mercado Pago.
                        </p>

                        <div className="perfil-dueno-checklist">
                          <div className="perfil-dueno-checklist-item">
                            <FaCheck className="chk-icon" />
                            <span>Tokens cifrados en servidor y nunca expuestos al navegador</span>
                          </div>
                          <div className="perfil-dueno-checklist-item">
                            <FaCheck className="chk-icon" />
                            <span>Una cuenta de Mercado Pago vinculada por gimnasio</span>
                          </div>
                          <div className="perfil-dueno-checklist-item">
                            <FaCheck className="chk-icon" />
                            <span>Desconectar no elimina el historial de pagos registrados</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CONTENIDO PESTAÑA 3: SEGURIDAD & CONTRASEÑA */}
              {pestanaEfectiva === 'seguridad' && (
                <div className="perfil-dueno-tab-content">
                  <div className="perfil-dueno-grid">
                    <div className="perfil-dueno-card">
                      <div className="perfil-dueno-card-header">
                        <div className="perfil-dueno-card-icon">
                          <FaShieldAlt />
                        </div>
                        <div>
                          <h3>Seguridad & Contraseña</h3>
                          <p>
                            {esEmpleado
                              ? 'Actualiza la clave de acceso de tu cuenta de empleado'
                              : 'Actualiza la clave de acceso de tu cuenta de dueño/administrador'}
                          </p>
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
                        {esEmpleado
                          ? 'Tu cuenta de empleado opera con los datos de los socios, rutinas, asistencias y pagos del gimnasio.'
                          : 'Tu cuenta de dueño administra los datos de todos los socios y la caja del gimnasio.'}
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

      {/* Modal de autorización OAuth simulada (para presentación con cuenta de prueba) */}
      {modalOAuthSimulado && (
        <div
          className="mp-oauth-modal-overlay"
          onClick={() => !accionMpEnCurso && handleConfirmarOAuthSimulado(false)}
        >
          <div className="mp-oauth-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="mp-oauth-modal-top">
              <MercadoPagoLogo height={30} />
              <span className="mp-oauth-demo-chip">Autorización OAuth — Cuenta de prueba</span>
            </div>

            <h3>¿Autorizás a GymTrack a vincular tu cuenta?</h3>
            <p className="mp-oauth-modal-desc">
              Se vinculará la cuenta de prueba de Mercado Pago a{' '}
              <strong>{gymForm.nombre || gimnasioActivo?.nombre || 'tu gimnasio'}</strong> para recibir pagos de membresías.
            </p>

            <div className="mp-oauth-modal-info">
              <div>
                <span>Cuenta vendedor de prueba:</span>
                <strong>{modalOAuthSimulado.cuenta_prueba?.alias || 'Cuenta de prueba Mercado Pago'}</strong>
              </div>
              <div>
                <span>ID de cuenta:</span>
                <strong>{modalOAuthSimulado.cuenta_prueba?.external_user_id || 'TEST-MP'}</strong>
              </div>
            </div>

            <ul className="mp-oauth-modal-perms">
              <li><FaCheck /> Recibir pagos de membresías contratadas por socios</li>
              <li><FaCheck /> Consultar estado de acreditación en la cuenta de prueba</li>
              <li><FaCheck /> Almacenar credenciales cifradas exclusivamente en el servidor</li>
            </ul>

            <div className="mp-oauth-modal-actions">
              <button
                type="button"
                className="mp-btn-connect"
                disabled={accionMpEnCurso}
                onClick={() => handleConfirmarOAuthSimulado(true)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <FaCheckCircle />
                <span>{accionMpEnCurso ? 'Vinculando cuenta...' : 'Autorizar y conectar cuenta'}</span>
              </button>
              <button
                type="button"
                className="mp-btn-cancel"
                disabled={accionMpEnCurso}
                onClick={() => handleConfirmarOAuthSimulado(false)}
                style={{ width: '100%' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PerfilDueno;
