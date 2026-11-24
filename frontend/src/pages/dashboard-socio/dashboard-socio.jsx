/**
 * =========================================================================================
 * ARCHIVO: dashboard-socio.jsx
 * RUTA: frontend/src/pages/dashboard-socio/dashboard-socio.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Portal y Dashboard principal del Socio / Alumno del gimnasio.
 *              Adaptado al modelo definitivo de Supabase (sin tabla `progreso`).
 * =========================================================================================
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NavGlobal from '../../components/nav-global/nav-global';
import SidebarSocio from '../../components/sidebar-socio/sidebar-socio';
import { useGymContext } from '../../context/GymContext';
import {
  fetchDashboardSocio,
  realizarCheckinSocio,
  realizarCheckoutSocio
} from '../../services/dashboardSocioService';
import { getSucursales } from '../../services/sucursalService';
import { fetchMisAsistencias } from '../../services/asistenciaService';
import { formatFechaArgentina, formatHoraArgentina } from '../../utils/dateUtils';

import {
  FaCrown,
  FaDumbbell,
  FaCalendarAlt,
  FaCheck,
  FaTimes,
  FaClock,
  FaBolt,
  FaFire,
  FaReceipt,
  FaSyncAlt,
  FaChevronRight,
  FaRunning
} from 'react-icons/fa';

import './dashboard-socio.css';

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
  const { usuario, gimnasioActivo, gimnasioActivoId, contextVersion } = useGymContext();

  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [notificacion, setNotificacion] = useState('');
  const [ejerciciosCompletados, setEjerciciosCompletados] = useState({});
  const [sucursalesActivas, setSucursalesActivas] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [asistenciaAbierta, setAsistenciaAbierta] = useState(null);

  // Modales
  const [modalCheckinAbierto, setModalCheckinAbierto] = useState(false);
  const [modalReciboAbierto, setModalReciboAbierto] = useState(false);
  const [guardandoCheckin, setGuardandoCheckin] = useState(false);

  const [dashboardData, setDashboardData] = useState({
    socio: {
      id_socio: usuario?.id_socio || null,
      nombre: usuario?.nombre || '',
      apellido: usuario?.apellido || '',
      dni: usuario?.dni || '',
      email: usuario?.email || '',
      telefono: usuario?.telefono || '',
      estado: usuario?.estado ?? true
    },
    gimnasio_activo: gimnasioActivo || null,
    gimnasios_asociados: [],
    membresia: {
      id_membresia_socio: null,
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
    entrenamientos: {
      total_asistencias: 0,
      asistencias_mes: 0,
      recientes: []
    },
    rutinas_personales: [],
    rutinas_asignadas: []
  });

  const cargarDatos = useCallback(async (signal) => {
    try {
      setLoading(true);
      setErrorCarga('');

      const [data, sucs, abiertasRes] = await Promise.all([
        fetchDashboardSocio({ id_gimnasio: gimnasioActivoId || null, signal }),
        gimnasioActivoId
          ? getSucursales({ id_gimnasio: gimnasioActivoId, estado: 'true', signal })
          : Promise.resolve([]),
        fetchMisAsistencias({ id_gimnasio: gimnasioActivoId || null, estado: 'presente', signal })
      ]);
      if (signal?.aborted) return;

      const sucsList = Array.isArray(sucs) ? sucs : [];
      setSucursalesActivas(sucsList);
      setSucursalSeleccionada((prev) =>
        sucsList.some((s) => String(s.id_sucursal) === String(prev))
          ? prev
          : (sucsList[0]?.id_sucursal ? String(sucsList[0].id_sucursal) : '')
      );

      const abiertas = Array.isArray(abiertasRes?.asistencias) ? abiertasRes.asistencias : [];
      const openItem = abiertas.find((a) => a.estado === 'presente' && !a.hora_salida) || null;
      setAsistenciaAbierta(openItem);

      if (data) {
        setDashboardData({
          socio: data.socio || {
            id_socio: usuario?.id_socio || null,
            nombre: usuario?.nombre || '',
            apellido: usuario?.apellido || '',
            dni: usuario?.dni || '',
            email: usuario?.email || '',
            telefono: usuario?.telefono || '',
            estado: usuario?.estado ?? true
          },
          gimnasio_activo: data.gimnasio_activo || gimnasioActivo || null,
          gimnasios_asociados: Array.isArray(data.gimnasios_asociados) ? data.gimnasios_asociados : [],
          membresia: data.membresia || {
            id_membresia_socio: null,
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
          entrenamientos: {
            total_asistencias: data.entrenamientos?.total_asistencias ?? 0,
            asistencias_mes: data.entrenamientos?.asistencias_mes ?? 0,
            recientes: Array.isArray(data.entrenamientos?.recientes) ? data.entrenamientos.recientes : []
          },
          rutinas_personales: Array.isArray(data.rutinas_personales) ? data.rutinas_personales : [],
          rutinas_asignadas: Array.isArray(data.rutinas_asignadas) ? data.rutinas_asignadas : []
        });
      }
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) return;
      console.error('Error cargando dashboard del socio:', err);
      setErrorCarga(err.message || 'No se pudieron obtener tus datos actualizados.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [gimnasioActivoId, gimnasioActivo, usuario]);

  useEffect(() => {
    const controller = new AbortController();
    cargarDatos(controller.signal);
    return () => controller.abort();
  }, [cargarDatos, contextVersion]);

  const toggleEjercicio = (id) => {
    setEjerciciosCompletados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCheckin = async () => {
    if (!sucursalSeleccionada) {
      setErrorCarga('Debés seleccionar una sucursal activa para registrar tu ingreso.');
      return;
    }
    try {
      setGuardandoCheckin(true);
      setErrorCarga('');
      const res = await realizarCheckinSocio({ id_sucursal: Number(sucursalSeleccionada) });
      setNotificacion(res?.mensaje || '¡Check-in realizado! Asistencia registrada.');
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

  const handleCheckout = async () => {
    if (!asistenciaAbierta) return;
    try {
      setGuardandoCheckin(true);
      setErrorCarga('');
      const res = await realizarCheckoutSocio({
        id_asistencia_socio: asistenciaAbierta.id_asistencia_socio
      });
      setNotificacion(res?.mensaje || '¡Salida registrada correctamente!');
      await cargarDatos();
      setTimeout(() => setNotificacion(''), 6000);
    } catch (err) {
      setErrorCarga(err.message || 'No se pudo registrar la salida.');
    } finally {
      setGuardandoCheckin(false);
    }
  };

  const saludoHora = useMemo(() => {
    const hora = new Date().getHours();
    if (hora < 12) return '¡Buen día';
    if (hora < 20) return '¡Buenas tardes';
    return '¡Buenas noches';
  }, []);

  const socio = dashboardData.socio;
  const gimnasio = dashboardData.gimnasio_activo;
  const membresia = dashboardData.membresia;
  const ultimoPago = dashboardData.ultimo_pago;
  const entrenamientos = dashboardData.entrenamientos;
  const rutinasPersonales = dashboardData.rutinas_personales;
  const rutinasAsignadas = dashboardData.rutinas_asignadas;

  // Normalizar la rutina principal destacada (prioridad: asignada activa del gimnasio, sino personal activa)
  const rutinaDestacada = useMemo(() => {
    const asig = rutinasAsignadas[0];
    if (asig && asig.rutina_gimnasio) {
      const rg = asig.rutina_gimnasio;
      return {
        origen: 'Asignada por gimnasio',
        nombre: rg.nombre || 'Rutina del Gimnasio',
        descripcion: asig.observaciones || rg.descripcion || '',
        ejercicios: (rg.rutina_ejercicio_gimnasio || []).map((it, idx) => ({
          key: `g-${it.id_rutina_ejercicio_gimnasio || idx}`,
          nombre: it.ejercicio_gimnasio?.nombre || 'Ejercicio del gimnasio',
          grupo_muscular: it.ejercicio_gimnasio?.grupo_muscular || 'General',
          series: it.series || 4,
          repeticiones: it.repeticiones || 10,
          peso: it.peso || 0,
          descanso: it.descanso ?? 60
        }))
      };
    }

    const pers = rutinasPersonales[0];
    if (pers) {
      return {
        origen: 'Mi rutina personal',
        nombre: pers.nombre || 'Mi Rutina',
        descripcion: pers.descripcion || '',
        ejercicios: (pers.rutina_ejercicio_socio || []).map((it, idx) => ({
          key: `p-${it.id_rutina_ejercicio_socio || idx}`,
          nombre: it.ejercicio_socio?.nombre || 'Ejercicio personal',
          grupo_muscular: it.ejercicio_socio?.grupo_muscular || 'General',
          series: it.series || 4,
          repeticiones: it.repeticiones || 10,
          peso: it.peso || 0,
          descanso: it.descanso ?? 60
        }))
      };
    }

    return null;
  }, [rutinasAsignadas, rutinasPersonales]);

  const asistenciasMes = entrenamientos.asistencias_mes ?? 0;
  const objetivoMensual = 20;
  const porcentajeObjetivo = Math.min(100, Math.round((asistenciasMes / objetivoMensual) * 100));

  const tieneMembresiaActiva = Boolean(
    membresia &&
    (membresia.id_membresia_socio || membresia.id_membresia) &&
    !['sin_membresia', 'inactivo', 'inactiva', 'pausa', 'pausado', 'pausada', 'cancelado', 'cancelada'].includes(
      String(membresia.estado || '').toLowerCase().trim()
    )
  );

  const estadoSocioTexto =
    typeof socio.estado === 'boolean'
      ? (socio.estado ? 'Activo' : 'Inactivo')
      : (socio.estado ? String(socio.estado).charAt(0).toUpperCase() + String(socio.estado).slice(1) : 'Activo');

  const totalRutinasActivas = rutinasAsignadas.length + rutinasPersonales.length;

  return (
    <div className="socio-pc-page">
      <NavGlobal />

      <div className="socio-pc-body">
        <SidebarSocio />

        <main className="socio-pc-main">
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

          {/* 1. Hero Header */}
          <section className="socio-pc-hero">
            <div className="socio-pc-hero-left">
              <div className="socio-pc-avatar">
                {socio.nombre ? socio.nombre[0].toUpperCase() : 'S'}
              </div>
              <div className="socio-pc-hero-text">
                <h1>{saludoHora}, {socio.nombre || 'Socio'}! 👋</h1>
                <p>
                  Bienvenido a tu panel de socio{gimnasio?.nombre ? <> en <strong>{gimnasio.nombre}</strong></> : ''}
                  <span className="socio-pc-gym-badge">
                    <FaCheck style={{ fontSize: '10px' }} /> Socio {estadoSocioTexto}
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

              {asistenciaAbierta ? (
                <button
                  className="socio-pc-btn-checkin"
                  style={{ background: '#f59e0b', color: '#0b0f12' }}
                  onClick={handleCheckout}
                  disabled={guardandoCheckin}
                  title="Registrar tu salida del gimnasio"
                >
                  <FaClock />
                  <span>{guardandoCheckin ? 'Registrando salida...' : 'Registrar Salida'}</span>
                </button>
              ) : (
                <button
                  className="socio-pc-btn-checkin"
                  onClick={() => setModalCheckinAbierto(true)}
                  title="Marcar asistencia en una sucursal"
                >
                  <FaBolt />
                  <span>Marcar Asistencia</span>
                </button>
              )}

              <button
                className="socio-pc-btn-outline"
                onClick={() => cargarDatos()}
                title="Actualizar datos"
                disabled={loading}
              >
                <FaSyncAlt />
              </button>
            </div>
          </section>

          {/* 2. Grid Superior de Métricas (4 KPIs) */}
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
                    ● {tieneMembresiaActiva ? (membresia.estado === 'activa' ? 'Activa' : membresia.estado) : 'Sin Membresía'}
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
                    Consultá los planes activos para habilitar tu acceso.
                  </div>
                )}
              </div>

              <button onClick={() => navigate('/membresia-socio')} className="socio-pc-kpi-footer-link">
                <span>{tieneMembresiaActiva ? 'Gestionar suscripción' : 'Ver membresías disponibles'}</span>
                <FaChevronRight style={{ fontSize: '11px' }} />
              </button>
            </div>

            {/* KPI 2: Último Pago */}
            <div className="socio-pc-kpi-card">
              <div>
                <div className="socio-pc-kpi-top">
                  <div className="socio-pc-kpi-icon-wrap icon-blue"><FaReceipt /></div>
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
                      <span>Estado: {ultimoPago.estado || 'aprobado'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="socio-pc-kpi-val" style={{ fontSize: '20px' }}>Sin registros</div>
                    <p className="socio-pc-kpi-detail">Aún no tienes pagos registrados</p>
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
                  <div className="socio-pc-kpi-icon-wrap icon-amber"><FaFire /></div>
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
                  Asistencias válidas{gimnasio?.nombre ? <> en <strong>{gimnasio.nombre}</strong></> : ''}
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

            {/* KPI 4: Rutinas Activas (reemplaza el antiguo bloque de progreso eliminado) */}
            <div className="socio-pc-kpi-card">
              <div>
                <div className="socio-pc-kpi-top">
                  <div className="socio-pc-kpi-icon-wrap icon-purple"><FaDumbbell /></div>
                  <span className="socio-pc-kpi-badge badge-pill-neutral">
                    {rutinasAsignadas.length} asignadas
                  </span>
                </div>
                <h3 className="socio-pc-kpi-title">Mis Rutinas</h3>
                <div className="socio-pc-kpi-val">
                  {totalRutinasActivas}
                  <span className="unit">activas</span>
                </div>
                <p className="socio-pc-kpi-detail">
                  <strong>{rutinasPersonales.length}</strong> personales · <strong>{rutinasAsignadas.length}</strong> del gimnasio
                </p>
              </div>

              <button
                onClick={() => navigate('/rutinas-socio')}
                className="socio-pc-kpi-footer-link"
                style={{ color: '#c084fc' }}
              >
                <span>Administrar mis rutinas</span>
                <FaChevronRight style={{ fontSize: '11px' }} />
              </button>
            </div>
          </section>

          {/* 3. Sección Principal: Mi Rutina Activa */}
          <div className="socio-pc-main-grid socio-pc-main-grid-single">
            <div className="socio-pc-card">
              <div className="socio-pc-card-header">
                <div className="socio-pc-card-title-group">
                  <span className="socio-pc-card-header-icon"><FaDumbbell /></span>
                  <div>
                    <h2 className="socio-pc-card-title">Mi Rutina Activa</h2>
                    <p className="socio-pc-card-subtitle">Plan de entrenamiento disponible para hoy</p>
                  </div>
                </div>

                <Link to="/rutinas-socio" className="socio-pc-card-action">
                  <span>Ver todas mis rutinas</span>
                  <FaChevronRight style={{ fontSize: '11px' }} />
                </Link>
              </div>

              {rutinaDestacada ? (
                <>
                  <div className="socio-pc-routine-banner">
                    <div>
                      <h3 className="socio-pc-routine-name">{rutinaDestacada.nombre}</h3>
                      {parsearDescripcionRutina(rutinaDestacada.descripcion) && (
                        <p className="socio-pc-routine-desc">
                          {parsearDescripcionRutina(rutinaDestacada.descripcion)}
                        </p>
                      )}
                    </div>
                    <span className="socio-pc-routine-badge">{rutinaDestacada.origen}</span>
                  </div>

                  {rutinaDestacada.ejercicios.length > 0 ? (
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
                        {rutinaDestacada.ejercicios.map((item) => {
                          const isChecked = Boolean(ejerciciosCompletados[item.key]);
                          return (
                            <tr key={item.key} style={{ opacity: isChecked ? 0.6 : 1 }}>
                              <td>
                                <button
                                  onClick={() => toggleEjercicio(item.key)}
                                  className={`socio-pc-exercise-check-btn ${isChecked ? 'checked' : ''}`}
                                  title={isChecked ? 'Marcar como pendiente' : 'Marcar como completado'}
                                >
                                  <FaCheck />
                                </button>
                              </td>
                              <td>
                                <div className="socio-pc-exercise-row-name">
                                  <span style={{ textDecoration: isChecked ? 'line-through' : 'none' }}>
                                    {item.nombre}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className="socio-pc-exercise-muscle-tag">{item.grupo_muscular}</span>
                              </td>
                              <td style={{ fontWeight: '700', color: '#ffffff' }}>
                                {item.series} × {item.repeticiones}
                              </td>
                              <td>{item.peso > 0 ? `${item.peso} kg` : 'Corporal'}</td>
                              <td style={{ color: '#94a3b8' }}>
                                <FaClock style={{ fontSize: '11px', marginRight: '5px' }} />
                                {item.descanso}s
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
                    {loading ? 'Cargando tu rutina...' : 'Todavía no tienes una rutina activa asignada o personal.'}
                  </p>
                  {!loading && (
                    <div className="socio-pc-routine-footer-btns" style={{ justifyContent: 'center' }}>
                      <button
                        onClick={() => navigate('/rutinas-socio')}
                        className="socio-pc-btn-primary"
                        style={{ flex: '0 0 auto', padding: '10px 20px', fontSize: '13.5px' }}
                      >
                        <FaDumbbell />
                        <span>Ir a Mis Rutinas</span>
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

      {/* MODAL: Marcar Asistencia / Check-in */}
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
              Confirmá tu ingreso en una sucursal activa. Recordá que podés registrar hasta 3 asistencias por día en este gimnasio (1 abierta a la vez).
            </p>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Socio:</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                {socio.nombre} {socio.apellido} {socio.dni ? `(DNI: ${socio.dni})` : ''}
              </div>
              <div style={{ fontSize: '13px', color: '#22c55e', marginTop: '6px' }}>
                📍 {gimnasio?.nombre || 'Sin gimnasio seleccionado'} • {formatHoraArgentina(new Date())} hs
              </div>
            </div>

            <div className="socio-pc-form-group" style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13.5px' }}>
                Seleccioná la sucursal donde estás entrenando *
              </label>
              {sucursalesActivas.length > 0 ? (
                <select
                  className="socio-pc-form-input"
                  value={sucursalSeleccionada}
                  onChange={(e) => setSucursalSeleccionada(e.target.value)}
                >
                  {sucursalesActivas.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>
                      {s.direccion}{s.descripcion ? ` — ${s.descripcion}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>
                  Este gimnasio no tiene sucursales activas registradas todavía.
                </p>
              )}
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
                disabled={guardandoCheckin || !sucursalSeleccionada}
              >
                {guardandoCheckin ? 'Registrando...' : 'Confirmar Ingreso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ver Comprobante de Pago Rápido */}
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
                  ● {ultimoPago.estado || 'aprobado'}
                </span>
              </div>
            </div>

            <div className="socio-pc-modal-actions">
              <button className="socio-pc-btn-secondary" onClick={() => setModalReciboAbierto(false)}>
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
