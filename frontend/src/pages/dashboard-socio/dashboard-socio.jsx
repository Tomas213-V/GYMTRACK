/**
 * =========================================================================================
 * ARCHIVO: dashboard-socio.jsx
 * RUTA: frontend/src/pages/dashboard-socio/dashboard-socio.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Portal y Dashboard principal del Socio / Alumno del gimnasio.
 * =========================================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NavGlobal from '../../components/nav-global/nav-global';
import SidebarSocio from '../../components/sidebar-socio/sidebar-socio';
import {
  fetchDashboardSocio,
  realizarCheckinSocio,
  registrarProgresoSocio
} from '../../services/dashboardSocioService';
import { registrarAsistencia } from '../../services/asistenciaService';
import { formatFechaArgentina, formatHoraArgentina } from '../../utils/dateUtils';

import {
  FaCrown,
  FaDumbbell,
  FaHeartbeat,
  FaCalendarAlt,
  FaCheck,
  FaTimes,
  FaClock,
  FaArrowDown,
  FaArrowUp,
  FaBolt,
  FaFire,
  FaReceipt,
  FaSyncAlt,
  FaChevronRight,
  FaRunning
} from 'react-icons/fa';

import './dashboard-socio.css';

function leerSocioLocal() {
  try {
    const raw = localStorage.getItem('socio') || localStorage.getItem('usuario');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed[0] || {}) : (parsed || {});
  } catch {
    return {};
  }
}

function parsearDescripcionRutina(desc) {
  if (!desc) return '';
  const trimmed = String(desc).trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const meta = JSON.parse(trimmed);
    const partes = [meta.tipo, meta.dificultad, meta.duracion, meta.dias].filter(Boolean);
    return meta.objetivo || meta.notas || partes.join(' · ') || '';
  } catch {
    return trimmed;
  }
}

export default function DashboardSocio() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [notificacion, setNotificacion] = useState('');
  const [ejerciciosCompletados, setEjerciciosCompletados] = useState({});

  // Modales
  const [modalCheckinAbierto, setModalCheckinAbierto] = useState(false);
  const [modalProgresoAbierto, setModalProgresoAbierto] = useState(false);
  const [modalReciboAbierto, setModalReciboAbierto] = useState(false);
  const [guardandoProgreso, setGuardandoProgreso] = useState(false);
  const [guardandoCheckin, setGuardandoCheckin] = useState(false);

  // Formulario de progreso
  const [nuevoPeso, setNuevoPeso] = useState('');
  const [notasProgreso, setNotasProgreso] = useState('');

  const socioInicial = useMemo(() => leerSocioLocal(), []);

  const [dashboardData, setDashboardData] = useState({
    socio: {
      id_socio: socioInicial.id_socio || socioInicial.id || null,
      nombre: socioInicial.nombre || '',
      apellido: socioInicial.apellido || '',
      dni: socioInicial.dni || '',
      email: socioInicial.email || '',
      telefono: socioInicial.telefono || '',
      estado: socioInicial.estado || 'activo'
    },
    gimnasio: {
      nombre: socioInicial.gimnasio?.nombre || ''
    },
    membresia: {
      id_membresia: null,
      plan: 'Sin Membresía Activa',
      estado: 'sin_membresia',
      fecha_inicio: null,
      fecha_vencimiento: null,
      precio: 0,
      dias_restantes: 0,
      porcentaje_transcurrido: 0,
      expirada: true
    },
    ultimo_pago: null,
    progreso: {
      peso_actual: null,
      variacion_mes: null,
      fecha_ultimo_registro: null,
      observaciones: null,
      historial: []
    },
    entrenamientos: {
      total_asistencias: 0,
      asistencias_mes: 0,
      recientes: []
    },
    rutina_activa: null
  });

  // --------------------------------------------------------------------------
  // Cargar Información Consolidada desde Backend (sin datos falsos)
  // --------------------------------------------------------------------------
  const cargarDatos = async () => {
    try {
      setLoading(true);
      setErrorCarga('');
      const socioLocal = leerSocioLocal();
      const data = await fetchDashboardSocio();

      if (data) {
        const pesoActual = data.progreso?.peso_actual ?? null;
        if (pesoActual != null) {
          setNuevoPeso(String(pesoActual));
        }

        setDashboardData({
          socio: data.socio || {
            id_socio: socioLocal.id_socio || socioLocal.id || null,
            nombre: socioLocal.nombre || '',
            apellido: socioLocal.apellido || '',
            dni: socioLocal.dni || '',
            email: socioLocal.email || '',
            telefono: socioLocal.telefono || '',
            estado: socioLocal.estado || 'activo'
          },
          gimnasio: data.gimnasio || { nombre: '' },
          membresia: data.membresia || {
            id_membresia: null,
            plan: 'Sin Membresía Activa',
            estado: 'sin_membresia',
            fecha_inicio: null,
            fecha_vencimiento: null,
            precio: 0,
            dias_restantes: 0,
            porcentaje_transcurrido: 0,
            expirada: true
          },
          ultimo_pago: data.ultimo_pago || null,
          progreso: {
            peso_actual: pesoActual,
            variacion_mes: data.progreso?.variacion_mes ?? null,
            fecha_ultimo_registro: data.progreso?.fecha_ultimo_registro || null,
            observaciones: data.progreso?.observaciones || null,
            historial: Array.isArray(data.progreso?.historial) ? data.progreso.historial : []
          },
          entrenamientos: {
            total_asistencias: data.entrenamientos?.total_asistencias ?? 0,
            asistencias_mes: data.entrenamientos?.asistencias_mes ?? 0,
            recientes: Array.isArray(data.entrenamientos?.recientes) ? data.entrenamientos.recientes : []
          },
          rutina_activa: data.rutina_activa || null
        });
      }
    } catch (err) {
      console.error('Error cargando dashboard del socio:', err);
      setErrorCarga(err.message || 'No se pudieron obtener tus datos actualizados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // --------------------------------------------------------------------------
  // Manejador para Completar Ejercicios de Hoy
  // --------------------------------------------------------------------------
  const toggleEjercicio = (id) => {
    setEjerciciosCompletados((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // --------------------------------------------------------------------------
  // Manejador de Check-in Rápido
  // --------------------------------------------------------------------------
  const handleCheckin = async () => {
    try {
      setGuardandoCheckin(true);
      let res;
      try {
        res = await realizarCheckinSocio();
      } catch {
        const idSocio = dashboardData.socio?.id_socio;
        const dni = dashboardData.socio?.dni;
        if (!idSocio && !dni) throw new Error('No se pudo identificar tu perfil de socio.');
        res = await registrarAsistencia({ id_socio: idSocio, dni });
      }

      setNotificacion(res?.mensaje || '¡Check-in realizado! Asistencia registrada para hoy.');
      setModalCheckinAbierto(false);
      await cargarDatos();
      setTimeout(() => setNotificacion(''), 6000);
    } catch (err) {
      setErrorCarga(err.message || 'No se pudo registrar la asistencia.');
      setModalCheckinAbierto(false);
    } finally {
      setGuardandoCheckin(false);
    }
  };

  // --------------------------------------------------------------------------
  // Manejador de Registro de Nuevo Peso
  // --------------------------------------------------------------------------
  const handleGuardarProgreso = async (e) => {
    e.preventDefault();
    if (!nuevoPeso || isNaN(nuevoPeso)) return;

    try {
      setGuardandoProgreso(true);
      const pesoNum = Number(nuevoPeso);
      await registrarProgresoSocio({
        peso: pesoNum,
        observaciones: notasProgreso
      });

      setNotificacion('¡Nuevo registro de peso guardado correctamente!');
      setModalProgresoAbierto(false);
      setNotasProgreso('');
      await cargarDatos();
      setTimeout(() => setNotificacion(''), 5000);
    } catch (err) {
      setErrorCarga(err.message || 'No se pudo guardar el registro de peso.');
    } finally {
      setGuardandoProgreso(false);
    }
  };

  // Saludo dinámico según horario
  const saludoHora = useMemo(() => {
    const hora = new Date().getHours();
    if (hora < 12) return '¡Buen día';
    if (hora < 20) return '¡Buenas tardes';
    return '¡Buenas noches';
  }, []);

  const { socio, gimnasio, membresia, ultimoPago, progreso, entrenamientos, rutinaActiva } = {
    socio: dashboardData.socio,
    gimnasio: dashboardData.gimnasio,
    membresia: dashboardData.membresia,
    ultimoPago: dashboardData.ultimo_pago,
    progreso: dashboardData.progreso,
    entrenamientos: dashboardData.entrenamientos,
    rutinaActiva: dashboardData.rutina_activa
  };

  const asistenciasMes = entrenamientos.asistencias_mes ?? 0;
  const objetivoMensual = 20;
  const porcentajeObjetivo = Math.min(100, Math.round((asistenciasMes / objetivoMensual) * 100));

  const tieneMembresiaActiva = Boolean(
    membresia &&
    membresia.id_membresia &&
    !['sin_membresia', 'inactivo', 'inactiva', 'pausa', 'pausado', 'pausada', 'cancelado', 'cancelada'].includes(
      (membresia.estado || '').toLowerCase().trim()
    )
  );

  return (
    <div className="socio-pc-page">
      <NavGlobal />

      <div className="socio-pc-body">
        <SidebarSocio />

        <main className="socio-pc-main">
          {/* Banner de Feedback si hay notificación */}
          {notificacion && (
            <div className="socio-pc-alert-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaCheck />
                <span>{notificacion}</span>
              </div>
              <button
                onClick={() => setNotificacion('')}
                style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: '16px' }}
              >
                <FaTimes />
              </button>
            </div>
          )}

          {/* Banner de error si falló la carga */}
          {errorCarga && (
            <div
              className="socio-pc-alert-banner"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                borderColor: 'rgba(239, 68, 68, 0.35)',
                color: '#fca5a5'
              }}
            >
              <span>{errorCarga}</span>
              <button
                onClick={() => setErrorCarga('')}
                style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '16px' }}
              >
                <FaTimes />
              </button>
            </div>
          )}

          {/* ================================================================
              1. Hero Header
              ================================================================ */}
          <section className="socio-pc-hero">
            <div className="socio-pc-hero-left">
              <div className="socio-pc-avatar">
                {socio.nombre ? socio.nombre[0].toUpperCase() : 'S'}
              </div>
              <div className="socio-pc-hero-text">
                <h1>
                  {saludoHora}, {socio.nombre || 'Socio'}! 👋
                </h1>
                <p>
                  Bienvenido a tu panel de socio{gimnasio?.nombre ? <> en <strong>{gimnasio.nombre}</strong></> : ''}
                  <span className="socio-pc-gym-badge">
                    <FaCheck style={{ fontSize: '10px' }} /> Socio {socio.estado ? socio.estado.charAt(0).toUpperCase() + socio.estado.slice(1) : 'Activo'}
                  </span>
                </p>
              </div>
            </div>

            <div className="socio-pc-hero-right">
              <div className="socio-pc-date-chip">
                <FaCalendarAlt style={{ color: '#22c55e' }} />
                <span>
                  {formatFechaArgentina(new Date(), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>

              <button
                className="socio-pc-btn-checkin"
                onClick={() => setModalCheckinAbierto(true)}
                title="Marcar asistencia al gimnasio hoy"
              >
                <FaBolt />
                <span>Marcar Asistencia</span>
              </button>

              <button
                className="socio-pc-btn-outline"
                onClick={cargarDatos}
                title="Actualizar datos"
                disabled={loading}
              >
                <FaSyncAlt />
              </button>
            </div>
          </section>

          {/* ================================================================
              2. Grid Superior de Métricas (4 KPIs en Fila Desktop)
              ================================================================ */}
          <section className="socio-pc-kpi-grid">
            {/* KPI 1: Membresía */}
            <div className="socio-pc-kpi-card">
              <div>
                <div className="socio-pc-kpi-top">
                  <div
                    className={`socio-pc-kpi-icon-wrap ${tieneMembresiaActiva ? 'icon-green' : 'icon-neutral'}`}
                    style={!tieneMembresiaActiva ? { background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' } : {}}
                  >
                    <FaCrown />
                  </div>
                  <span className={`socio-pc-kpi-badge ${tieneMembresiaActiva ? 'badge-active-green' : 'badge-pill-neutral'}`}>
                    ● {tieneMembresiaActiva ? (membresia.estado === 'activa' || membresia.estado === 'activo' ? 'Activa' : membresia.estado) : 'Sin Membresía'}
                  </span>
                </div>
                <h3 className="socio-pc-kpi-title">Membresía</h3>
                <div className="socio-pc-kpi-val" style={{ fontSize: '20px' }}>
                  {tieneMembresiaActiva ? membresia.plan : 'Sin Membresía Activa'}
                </div>
                <p className="socio-pc-kpi-detail">
                  {tieneMembresiaActiva && membresia.fecha_vencimiento
                    ? <>Vence el <strong>{formatFechaArgentina(membresia.fecha_vencimiento)}</strong></>
                    : <span>No posees un pase activo actualmente</span>}
                </p>

                {tieneMembresiaActiva ? (
                  <div className="socio-pc-kpi-progress">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', marginBottom: '5px' }}>
                      <span>Vigencia</span>
                      <span>
                        {membresia.dias_restantes != null
                          ? (membresia.dias_restantes >= 0 ? `${membresia.dias_restantes} días restantes` : 'Vencida')
                          : 'Al día'}
                      </span>
                    </div>
                    <div className="socio-pc-progress-bar-bg">
                      <div
                        className="socio-pc-progress-bar-fill"
                        style={{ width: `${Math.max(0, Math.min(100, 100 - (membresia.porcentaje_transcurrido || 0)))}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '14px', fontSize: '12px', color: '#94a3b8' }}>
                    Consulta las opciones activas disponibles para activar tu acceso.
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate('/membresia-socio')}
                className="socio-pc-kpi-footer-link"
              >
                <span>{tieneMembresiaActiva ? 'Gestionar suscripción' : 'Ver membresías disponibles'}</span>
                <FaChevronRight style={{ fontSize: '11px' }} />
              </button>
            </div>

            {/* KPI 2: Último Pago */}
            <div className="socio-pc-kpi-card">
              <div>
                <div className="socio-pc-kpi-top">
                  <div className="socio-pc-kpi-icon-wrap icon-blue">
                    <FaReceipt />
                  </div>
                  <span className="socio-pc-kpi-badge badge-pill-neutral">
                    {ultimoPago?.metodo_pago ? ultimoPago.metodo_pago : 'Sin pagos'}
                  </span>
                </div>
                <h3 className="socio-pc-kpi-title">Último Pago</h3>
                {ultimoPago ? (
                  <>
                    <div className="socio-pc-kpi-val">
                      ${Number(ultimoPago.monto || 0).toLocaleString('es-AR')}
                      <span className="unit">ARS</span>
                    </div>
                    <p className="socio-pc-kpi-detail">
                      Abonado el <strong>{ultimoPago.fecha_pago ? formatFechaArgentina(ultimoPago.fecha_pago) : '—'}</strong>
                    </p>
                    <div style={{ marginTop: '14px', fontSize: '12.5px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FaCheck style={{ fontSize: '11px' }} />
                      <span>Estado: {ultimoPago.estado || 'pagado'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="socio-pc-kpi-val" style={{ fontSize: '20px' }}>
                      Sin registros
                    </div>
                    <p className="socio-pc-kpi-detail">
                      Aún no tienes pagos registrados
                    </p>
                  </>
                )}
              </div>

              {ultimoPago ? (
                <button
                  onClick={() => setModalReciboAbierto(true)}
                  className="socio-pc-kpi-footer-link"
                  style={{ color: '#38bdf8' }}
                >
                  <span>Ver comprobante</span>
                  <FaChevronRight style={{ fontSize: '11px' }} />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/membresia-socio')}
                  className="socio-pc-kpi-footer-link"
                  style={{ color: '#38bdf8' }}
                >
                  <span>Ir a mis pagos</span>
                  <FaChevronRight style={{ fontSize: '11px' }} />
                </button>
              )}
            </div>

            {/* KPI 3: Entrenamientos / Asistencias */}
            <div className="socio-pc-kpi-card">
              <div>
                <div className="socio-pc-kpi-top">
                  <div className="socio-pc-kpi-icon-wrap icon-amber">
                    <FaFire />
                  </div>
                  <span className="socio-pc-kpi-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                    {asistenciasMes >= objetivoMensual ? '🔥 Meta superada' : `${entrenamientos.total_asistencias ?? 0} totales`}
                  </span>
                </div>
                <h3 className="socio-pc-kpi-title">Entrenamientos</h3>
                <div className="socio-pc-kpi-val">
                  {asistenciasMes}
                  <span className="unit">este mes</span>
                </div>
                <p className="socio-pc-kpi-detail">
                  Asistencias registradas{gimnasio?.nombre ? <> en <strong>{gimnasio.nombre}</strong></> : ''}
                </p>

                <div className="socio-pc-kpi-progress">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', marginBottom: '5px' }}>
                    <span>Objetivo mensual ({objetivoMensual})</span>
                    <span style={{ color: '#fbbf24', fontWeight: '700' }}>{porcentajeObjetivo}%</span>
                  </div>
                  <div className="socio-pc-progress-bar-bg">
                    <div
                      className="socio-pc-progress-bar-fill"
                      style={{ width: `${porcentajeObjetivo}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/asistencia-socio')}
                className="socio-pc-kpi-footer-link"
                style={{ color: '#fbbf24' }}
              >
                <span>Ver historial de visitas</span>
                <FaChevronRight style={{ fontSize: '11px' }} />
              </button>
            </div>

            {/* KPI 4: Peso Actual */}
            <div className="socio-pc-kpi-card">
              <div>
                <div className="socio-pc-kpi-top">
                  <div className="socio-pc-kpi-icon-wrap icon-purple">
                    <FaHeartbeat />
                  </div>
                  {progreso.variacion_mes != null ? (
                    <span className="socio-pc-kpi-badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                      {progreso.variacion_mes <= 0 ? <FaArrowDown style={{ fontSize: '9px' }} /> : <FaArrowUp style={{ fontSize: '9px' }} />}{' '}
                      {progreso.variacion_mes > 0 ? `+${progreso.variacion_mes}` : progreso.variacion_mes} kg
                    </span>
                  ) : (
                    <span className="socio-pc-kpi-badge badge-pill-neutral">Seguimiento</span>
                  )}
                </div>
                <h3 className="socio-pc-kpi-title">Peso Actual</h3>
                {progreso.peso_actual != null ? (
                  <>
                    <div className="socio-pc-kpi-val">
                      {progreso.peso_actual}
                      <span className="unit">kg</span>
                    </div>
                    <p className="socio-pc-kpi-detail">
                      Último pesaje: <strong>{progreso.fecha_ultimo_registro ? formatFechaArgentina(progreso.fecha_ultimo_registro) : 'Reciente'}</strong>
                    </p>
                  </>
                ) : (
                  <>
                    <div className="socio-pc-kpi-val" style={{ fontSize: '20px' }}>
                      Sin registro
                    </div>
                    <p className="socio-pc-kpi-detail">
                      Aún no cargaste tu peso corporal
                    </p>
                  </>
                )}
              </div>

              <button
                onClick={() => setModalProgresoAbierto(true)}
                className="socio-pc-kpi-footer-link"
                style={{ color: '#c084fc' }}
              >
                <span>+ Registrar nuevo peso</span>
                <FaChevronRight style={{ fontSize: '11px' }} />
              </button>
            </div>
          </section>

          {/* ================================================================
              3. Sección Principal: Mi Rutina Activa (Ancho completo)
              ================================================================ */}
          <div className="socio-pc-main-grid socio-pc-main-grid-single">
            <div className="socio-pc-card">
              <div className="socio-pc-card-header">
                <div className="socio-pc-card-title-group">
                  <span className="socio-pc-card-header-icon">
                    <FaDumbbell />
                  </span>
                  <div>
                    <h2 className="socio-pc-card-title">Mi Rutina Activa</h2>
                    <p className="socio-pc-card-subtitle">
                      Plan de entrenamiento asignado para hoy
                    </p>
                  </div>
                </div>

                <Link to="/rutinas-socio" className="socio-pc-card-action">
                  <span>Ver todas mis rutinas</span>
                  <FaChevronRight style={{ fontSize: '11px' }} />
                </Link>
              </div>

              {rutinaActiva ? (
                <>
                  <div className="socio-pc-routine-banner">
                    <div>
                      <h3 className="socio-pc-routine-name">{rutinaActiva.nombre}</h3>
                      {parsearDescripcionRutina(rutinaActiva.descripcion) && (
                        <p className="socio-pc-routine-desc">
                          {parsearDescripcionRutina(rutinaActiva.descripcion)}
                        </p>
                      )}
                    </div>
                    <span className="socio-pc-routine-badge">Rutina en curso</span>
                  </div>

                  {rutinaActiva.ejercicios && rutinaActiva.ejercicios.length > 0 ? (
                    <table className="socio-pc-exercises-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>Hecho</th>
                          <th>Ejercicio</th>
                          <th>Músculo</th>
                          <th>Series × Reps</th>
                          <th>Carga</th>
                          <th>Descanso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rutinaActiva.ejercicios.map((item, idx) => {
                          const isChecked = Boolean(ejerciciosCompletados[item.id_rutina_ejercicio || idx]);
                          const ej = item.ejercicio || {};

                          return (
                            <tr key={item.id_rutina_ejercicio || idx} style={{ opacity: isChecked ? 0.6 : 1 }}>
                              <td>
                                <button
                                  onClick={() => toggleEjercicio(item.id_rutina_ejercicio || idx)}
                                  className={`socio-pc-exercise-check-btn ${isChecked ? 'checked' : ''}`}
                                  title={isChecked ? 'Marcar como pendiente' : 'Marcar como completado'}
                                >
                                  <FaCheck />
                                </button>
                              </td>
                              <td>
                                <div className="socio-pc-exercise-row-name">
                                  <span style={{ textDecoration: isChecked ? 'line-through' : 'none' }}>
                                    {ej.nombre || 'Ejercicio personalizado'}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className="socio-pc-exercise-muscle-tag">
                                  {ej.grupo_muscular || 'Musculación'}
                                </span>
                              </td>
                              <td style={{ fontWeight: '700', color: '#ffffff' }}>
                                {item.series || 4} × {item.repeticiones || 10}
                              </td>
                              <td>{item.peso && item.peso > 0 ? `${item.peso} kg` : 'Corporal'}</td>
                              <td style={{ color: '#94a3b8' }}>
                                <FaClock style={{ fontSize: '11px', marginRight: '5px' }} />
                                {item.descanso || 60}s
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: '12px 0' }}>
                      Esta rutina todavía no tiene ejercicios cargados.
                    </p>
                  )}

                  <div className="socio-pc-routine-footer-btns">
                    <button
                      onClick={() => navigate('/rutinas-socio')}
                      className="socio-pc-btn-primary"
                      style={{ flex: '0 0 auto', padding: '10px 20px', fontSize: '13.5px' }}
                    >
                      <FaRunning />
                      <span>Abrir Modo Entrenamiento</span>
                    </button>

                    <button
                      onClick={() => navigate('/ejercicios-socio')}
                      className="socio-pc-btn-secondary"
                      style={{ flex: '0 0 auto', padding: '10px 18px', fontSize: '13.5px' }}
                    >
                      <span>Explorar Catálogo de Ejercicios</span>
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '15px' }}>
                    {loading ? 'Cargando tu rutina...' : 'Todavía no tienes una rutina activa asignada.'}
                  </p>
                  {!loading && (
                    <div className="socio-pc-routine-footer-btns" style={{ justifyContent: 'center' }}>
                      <button
                        onClick={() => navigate('/rutinas-socio')}
                        className="socio-pc-btn-primary"
                        style={{ flex: '0 0 auto', padding: '10px 20px', fontSize: '13.5px' }}
                      >
                        <FaDumbbell />
                        <span>Explorar Rutinas</span>
                      </button>
                      <button
                        onClick={() => navigate('/ejercicios-socio')}
                        className="socio-pc-btn-secondary"
                        style={{ flex: '0 0 auto', padding: '10px 18px', fontSize: '13.5px' }}
                      >
                        <span>Catálogo de Ejercicios</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ================================================================
          MODAL: Marcar Asistencia / Check-in
          ================================================================ */}
      {modalCheckinAbierto && (
        <div className="socio-pc-modal-backdrop" onClick={() => setModalCheckinAbierto(false)}>
          <div className="socio-pc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="socio-pc-modal-header">
              <h3 className="socio-pc-modal-title">
                <FaBolt style={{ color: '#22c55e' }} />
                <span>Marcar Asistencia</span>
              </h3>
              <button className="socio-pc-modal-close-btn" onClick={() => setModalCheckinAbierto(false)}>
                <FaTimes />
              </button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '14.5px', margin: '0 0 18px 0', lineHeight: '1.5' }}>
              ¿Estás en el gimnasio y listo para comenzar tu sesión? Confirmá tu ingreso para registrar la asistencia de hoy.
            </p>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Socio:</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                {socio.nombre} {socio.apellido} {socio.dni ? `(DNI: ${socio.dni})` : ''}
              </div>
              <div style={{ fontSize: '13px', color: '#22c55e', marginTop: '6px' }}>
                📍 {gimnasio?.nombre || 'GymTrack'} • {formatHoraArgentina(new Date())} hs
              </div>
            </div>

            <div className="socio-pc-modal-actions">
              <button
                className="socio-pc-btn-secondary"
                onClick={() => setModalCheckinAbierto(false)}
                disabled={guardandoCheckin}
              >
                Cancelar
              </button>
              <button
                className="socio-pc-btn-primary"
                onClick={handleCheckin}
                disabled={guardandoCheckin}
              >
                {guardandoCheckin ? 'Registrando...' : 'Confirmar Ingreso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: Registrar Peso / Progreso
          ================================================================ */}
      {modalProgresoAbierto && (
        <div className="socio-pc-modal-backdrop" onClick={() => setModalProgresoAbierto(false)}>
          <div className="socio-pc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="socio-pc-modal-header">
              <h3 className="socio-pc-modal-title">
                <FaHeartbeat style={{ color: '#c084fc' }} />
                <span>Registrar Peso Corporal</span>
              </h3>
              <button className="socio-pc-modal-close-btn" onClick={() => setModalProgresoAbierto(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleGuardarProgreso}>
              <div className="socio-pc-form-group">
                <label>Peso Actual (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={nuevoPeso}
                  onChange={(e) => setNuevoPeso(e.target.value)}
                  className="socio-pc-form-input"
                  placeholder="Ej: 78.5"
                  required
                  autoFocus
                />
              </div>

              <div className="socio-pc-form-group">
                <label>Notas u Observaciones (opcional):</label>
                <textarea
                  value={notasProgreso}
                  onChange={(e) => setNotasProgreso(e.target.value)}
                  className="socio-pc-form-textarea"
                  placeholder="Ej: Sentí buena fuerza, mejor definición en abdomen..."
                  rows={3}
                />
              </div>

              <div className="socio-pc-modal-actions">
                <button
                  type="button"
                  className="socio-pc-btn-secondary"
                  onClick={() => setModalProgresoAbierto(false)}
                  disabled={guardandoProgreso}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="socio-pc-btn-primary"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: '#ffffff' }}
                  disabled={guardandoProgreso}
                >
                  {guardandoProgreso ? 'Guardando...' : 'Guardar Pesaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: Ver Comprobante de Pago Rápido
          ================================================================ */}
      {modalReciboAbierto && ultimoPago && (
        <div className="socio-pc-modal-backdrop" onClick={() => setModalReciboAbierto(false)}>
          <div className="socio-pc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="socio-pc-modal-header">
              <h3 className="socio-pc-modal-title">
                <FaReceipt style={{ color: '#38bdf8' }} />
                <span>Comprobante de Pago</span>
              </h3>
              <button className="socio-pc-modal-close-btn" onClick={() => setModalReciboAbierto(false)}>
                <FaTimes />
              </button>
            </div>

            <div style={{ background: '#0b0f12', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '10px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Plan Abonado</span>
                <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '14px' }}>{membresia.plan}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Monto Pagado</span>
                <span style={{ color: '#22c55e', fontWeight: '800', fontSize: '16px' }}>
                  ${Number(ultimoPago.monto || 0).toLocaleString('es-AR')} ARS
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Fecha de Operación</span>
                <span style={{ color: '#ffffff', fontSize: '13.5px' }}>
                  {ultimoPago.fecha_pago ? formatFechaArgentina(ultimoPago.fecha_pago) : '—'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Método de Pago</span>
                <span style={{ color: '#ffffff', fontSize: '13.5px' }}>{ultimoPago.metodo_pago || '—'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Estado</span>
                <span style={{ color: '#22c55e', fontWeight: '700', fontSize: '13.5px' }}>
                  ● {ultimoPago.estado || 'Acreditado'}
                </span>
              </div>
            </div>

            <div className="socio-pc-modal-actions">
              <button
                className="socio-pc-btn-secondary"
                onClick={() => setModalReciboAbierto(false)}
              >
                Cerrar
              </button>
              <button
                className="socio-pc-btn-primary"
                onClick={() => {
                  setModalReciboAbierto(false);
                  navigate('/membresia-socio');
                }}
              >
                <span>Ir a Mis Pagos y Facturas</span>
                <FaChevronRight style={{ fontSize: '11px' }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
