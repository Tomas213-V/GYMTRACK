import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import NavGlobal from '../../components/nav-global/nav-global';
import SidebarSocio from '../../components/sidebar-socio/sidebar-socio';
import { 
  fetchHistorialPorSocio, 
  registrarAsistencia 
} from '../../services/asistenciaService';
import { fetchDashboardSocio } from '../../services/dashboardSocioService';

import {
  FaCalendarCheck,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaFire,
  FaDumbbell,
  FaSyncAlt,
  FaDownload,
  FaSearch,
  FaFilter,
  FaTimes,
  FaReceipt,
  FaPrint,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCheck,
  FaArrowRight,
  FaBolt
} from 'react-icons/fa';

import './asistencia-socio.css';

// Helper para obtener fecha local en formato YYYY-MM-DD
const getFechaLocalISO = (fecha = new Date()) => {
  const d = new Date(fecha);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Formato de DNI con separador de miles
const formatDni = (dni) => {
  if (!dni) return '-';
  return dni.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export default function AsistenciaSocio() {
  const navigate = useNavigate();

  // --------------------------------------------------------------------------
  // Estados de Usuario & Perfil
  // --------------------------------------------------------------------------
  const [socio, setSocio] = useState(null);
  const [gimnasio, setGimnasio] = useState({
    nombre: 'GymTrack Fitness Center',
    direccion: 'Sede Central'
  });

  // --------------------------------------------------------------------------
  // Estados de Asistencias & Control de UI
  // --------------------------------------------------------------------------
  const [asistencias, setAsistencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [alerta, setAlerta] = useState(null);

  // Reloj digital en vivo
  const [horaActual, setHoraActual] = useState(new Date());

  // Filtros del historial individual
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes_actual');
  const [busqueda, setBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const porPagina = 8;

  // Modales
  const [modalConfirmacion, setModalConfirmacion] = useState(null); // datos de asistencia confirmada
  const [modalComprobante, setModalComprobante] = useState(null); // comprobante seleccionado

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --------------------------------------------------------------------------
  // Carga inicial de datos
  // --------------------------------------------------------------------------
  const cargarDatos = async (mostrarSpinner = true) => {
    if (mostrarSpinner) setCargando(true);
    else setRefrescando(true);

    try {
      // 1. Obtener socio autenticado desde localStorage
      const socioStorage = localStorage.getItem('socio');
      const usuarioStorage = localStorage.getItem('usuario');
      let socioObj = null;

      if (socioStorage) {
        socioObj = JSON.parse(socioStorage);
      } else if (usuarioStorage) {
        socioObj = JSON.parse(usuarioStorage);
      }

      const idSocio = socioObj?.id_socio || socioObj?.id;

      if (!idSocio) {
        setAlerta({
          tipo: 'error',
          mensaje: 'No se encontraron las credenciales de socio. Por favor, iniciá sesión nuevamente.'
        });
        setCargando(false);
        setRefrescando(false);
        return;
      }

      setSocio(socioObj);

      // 2. Obtener historial individual de asistencias
      const dataHistorial = await fetchHistorialPorSocio(idSocio);
      const lista = dataHistorial.asistencias || [];
      setAsistencias(lista);

      // 3. Obtener información complementaria del dashboard de socio (opcional)
      try {
        const dataDash = await fetchDashboardSocio();
        if (dataDash?.gimnasio) {
          setGimnasio(dataDash.gimnasio);
        }
        if (dataDash?.socio) {
          setSocio((prev) => ({ ...prev, ...dataDash.socio }));
        }
      } catch (errDash) {
        // Fallback no crítico
        console.warn('Dashboard socio info no disponible en segundo plano:', errDash.message);
      }

    } catch (err) {
      console.error('Error al cargar asistencias del socio:', err);
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'No se pudo conectar con el servidor para cargar tus asistencias.'
      });
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useEffect(() => {
    cargarDatos(true);
  }, []);

  // --------------------------------------------------------------------------
  // Cálculos de Métricas & Estado de Hoy
  // --------------------------------------------------------------------------
  const {
    yaRegistradoHoy,
    ultimaAsistenciaHoy,
    asistenciasMesActual,
    totalAsistencias,
    rachaDias,
    diasSemana,
    ultimaAsistenciaGeneral
  } = useMemo(() => {
    const hoyISO = getFechaLocalISO(new Date());

    // 1. Verificar si ya registró hoy
    const ingresoHoy = asistencias.find((a) => {
      if (!a.hora_ingreso) return false;
      return getFechaLocalISO(a.hora_ingreso) === hoyISO;
    });

    // 2. Contar asistencias del mes actual
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    const asistenciasMes = asistencias.filter((a) => {
      if (!a.hora_ingreso) return false;
      const d = new Date(a.hora_ingreso);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    }).length;

    // 3. Racha de días consecutivos
    const fechasUnicas = Array.from(
      new Set(
        asistencias
          .map((a) => (a.hora_ingreso ? getFechaLocalISO(a.hora_ingreso) : null))
          .filter(Boolean)
      )
    ).sort().reverse();

    let racha = 0;
    if (fechasUnicas.length > 0) {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      const ayerISO = getFechaLocalISO(ayer);

      if (fechasUnicas[0] === hoyISO || fechasUnicas[0] === ayerISO) {
        racha = 1;
        let fechaCursor = new Date(fechasUnicas[0] + 'T00:00:00');

        for (let i = 1; i < fechasUnicas.length; i++) {
          const fechaAnt = new Date(fechaCursor);
          fechaAnt.setDate(fechaAnt.getDate() - 1);
          const fechaAntISO = getFechaLocalISO(fechaAnt);

          if (fechasUnicas[i] === fechaAntISO) {
            racha++;
            fechaCursor = fechaAnt;
          } else {
            break;
          }
        }
      }
    }

    // 4. Tracker de los 7 días de la semana actual (Lun - Dom)
    const diaHoyIdx = ahora.getDay(); // 0 es Domingo
    const diffAlLunes = diaHoyIdx === 0 ? -6 : 1 - diaHoyIdx;
    const lunes = new Date(ahora);
    lunes.setDate(ahora.getDate() + diffAlLunes);
    lunes.setHours(0, 0, 0, 0);

    const nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const fechasAsistidasSet = new Set(fechasUnicas);

    const semana = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      const dISO = getFechaLocalISO(d);
      const esHoy = dISO === hoyISO;
      const esFuturo = d > ahora && !esHoy;
      const asistio = fechasAsistidasSet.has(dISO);

      semana.push({
        nombre: nombresDias[i],
        numero: d.getDate(),
        fechaISO: dISO,
        esHoy,
        esFuturo,
        asistio
      });
    }

    return {
      yaRegistradoHoy: Boolean(ingresoHoy),
      ultimaAsistenciaHoy: ingresoHoy || null,
      asistenciasMesActual: asistenciasMes,
      totalAsistencias: asistencias.length,
      rachaDias: racha,
      diasSemana: semana,
      ultimaAsistenciaGeneral: asistencias.length > 0 ? asistencias[0] : null
    };
  }, [asistencias]);

  // --------------------------------------------------------------------------
  // Filtrado y Paginación del Historial
  // --------------------------------------------------------------------------
  const asistenciasFiltradas = useMemo(() => {
    let lista = [...asistencias];
    const ahora = new Date();

    // Filtro por período
    if (filtroPeriodo === 'mes_actual') {
      const mesActual = ahora.getMonth();
      const anioActual = ahora.getFullYear();
      lista = lista.filter((a) => {
        if (!a.hora_ingreso) return false;
        const d = new Date(a.hora_ingreso);
        return d.getMonth() === mesActual && d.getFullYear() === anioActual;
      });
    } else if (filtroPeriodo === 'ultimos_30') {
      const limite = new Date();
      limite.setDate(limite.getDate() - 30);
      lista = lista.filter((a) => a.hora_ingreso && new Date(a.hora_ingreso) >= limite);
    } else if (filtroPeriodo === 'ultimos_90') {
      const limite = new Date();
      limite.setDate(limite.getDate() - 90);
      lista = lista.filter((a) => a.hora_ingreso && new Date(a.hora_ingreso) >= limite);
    } else if (filtroPeriodo === 'anio_actual') {
      const anioActual = ahora.getFullYear();
      lista = lista.filter((a) => {
        if (!a.hora_ingreso) return false;
        return new Date(a.hora_ingreso).getFullYear() === anioActual;
      });
    }

    // Buscador
    if (busqueda.trim()) {
      const query = busqueda.toLowerCase().trim();
      lista = lista.filter((a) => {
        if (!a.hora_ingreso) return false;
        const d = new Date(a.hora_ingreso);
        const fechaStr = d.toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }).toLowerCase();
        const horaStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
        const estadoStr = (a.estado || '').toLowerCase();

        return fechaStr.includes(query) || horaStr.includes(query) || estadoStr.includes(query);
      });
    }

    return lista;
  }, [asistencias, filtroPeriodo, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(asistenciasFiltradas.length / porPagina));
  const asistenciasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return asistenciasFiltradas.slice(inicio, inicio + porPagina);
  }, [asistenciasFiltradas, paginaActual]);

  // --------------------------------------------------------------------------
  // Registrar Asistencia / Check-In del Socio
  // --------------------------------------------------------------------------
  const handleRegistrarAsistencia = async () => {
    if (yaRegistradoHoy) return;
    if (!socio) return;

    try {
      setRegistrando(true);
      setAlerta(null);

      const idSocio = socio.id_socio || socio.id;
      const dni = socio.dni;

      const data = await registrarAsistencia({ id_socio: idSocio, dni });

      // Modal con confirmación visual
      const horaIngresoDate = data.asistencia?.hora_ingreso
        ? new Date(data.asistencia.hora_ingreso)
        : new Date();

      setModalConfirmacion({
        mensaje: data.mensaje || '¡Tu asistencia se registró exitosamente!',
        fecha: horaIngresoDate.toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        hora: horaIngresoDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        id_asistencia: data.asistencia?.id_asistencia || Math.floor(1000 + Math.random() * 9000)
      });

      // Refrescar asistencias desde el servidor
      await cargarDatos(false);

    } catch (err) {
      console.error('Error al registrar asistencia:', err);
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'No se pudo completar el registro de asistencia. Intentá nuevamente.'
      });
    } finally {
      setRegistrando(false);
    }
  };

  // --------------------------------------------------------------------------
  // Exportar Asistencias a CSV
  // --------------------------------------------------------------------------
  const handleExportarCSV = () => {
    if (!asistencias || asistencias.length === 0) {
      alert('Aún no tienes registros de asistencia para exportar.');
      return;
    }

    const headers = ['ID Asistencia', 'Fecha', 'Hora de Ingreso', 'Día', 'Estado', 'Socio', 'DNI'];
    const rows = asistencias.map((a) => {
      const d = a.hora_ingreso ? new Date(a.hora_ingreso) : new Date();
      const fecha = d.toLocaleDateString('es-AR');
      const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const dia = d.toLocaleDateString('es-AR', { weekday: 'long' });
      const nombreCompleto = socio ? `${socio.nombre || ''} ${socio.apellido || ''}`.trim() : 'Socio';
      const dni = socio?.dni || '-';
      const estado = a.estado || 'Presente';
      return [a.id_asistencia || '-', fecha, hora, `"${dia}"`, estado, `"${nombreCompleto}"`, dni];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `asistencias_gymtrack_${socio?.nombre || 'socio'}_${getFechaLocalISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Iniciales del socio
  const iniciales = useMemo(() => {
    if (!socio) return 'GT';
    const n = socio.nombre ? socio.nombre[0].toUpperCase() : '';
    const a = socio.apellido ? socio.apellido[0].toUpperCase() : '';
    return (n + a) || 'SC';
  }, [socio]);

  return (
    <div className="asistencia-socio-layout">
      {/* 1. Header Global de Navegación */}
      <NavGlobal />

      <div className="asistencia-socio-body">
        {/* 2. Barra Lateral */}
        <SidebarSocio />

        {/* 3. Contenido Principal */}
        <main className="asistencia-socio-main">
          {/* Header Superior con Información Personal */}
          <section className="asist-socio-header">
            <div className="asist-socio-title-box">
              <div className="asist-socio-icon-badge">
                <FaCalendarCheck />
              </div>
              <div>
                <h1>Mi Asistencia</h1>
                <p>Gestioná tus accesos, seguí tu racha y consultá tu historial de entrenamientos.</p>
              </div>
            </div>

            <div className="asist-socio-header-actions">
              <div className="asist-socio-user-pill">
                <div className="asist-socio-avatar">{iniciales}</div>
                <div className="asist-socio-user-info">
                  <span className="asist-socio-user-name">
                    {socio ? `${socio.nombre} ${socio.apellido}` : 'Mi Perfil'}
                  </span>
                  <span className="asist-socio-badge-active">Socio Activo</span>
                </div>
              </div>

              <button
                type="button"
                className="asist-socio-btn-icon"
                onClick={() => cargarDatos(false)}
                disabled={refrescando}
                title="Actualizar datos"
              >
                <FaSyncAlt className={refrescando ? 'asist-spin' : ''} />
              </button>

              <button
                type="button"
                className="asist-socio-btn-secondary"
                onClick={handleExportarCSV}
                title="Exportar mis asistencias a CSV"
              >
                <FaDownload />
                <span>Exportar</span>
              </button>
            </div>
          </section>

          {/* Alertas */}
          {alerta && (
            <div className={`asist-socio-alert ${alerta.tipo}`}>
              <FaExclamationTriangle />
              <span>{alerta.mensaje}</span>
              <button 
                className="asist-socio-alert-close"
                onClick={() => setAlerta(null)}
              >
                <FaTimes />
              </button>
            </div>
          )}

          {/* 4. Tarjetas de Métricas Personales (KPIs) */}
          <section className="asist-socio-kpis-grid">
            {/* KPI 1: Asistencias Este Mes */}
            <div className="asist-socio-kpi-card">
              <div className="asist-socio-kpi-top">
                <span className="asist-socio-kpi-label">Asistencias Este Mes</span>
                <div className="asist-socio-kpi-icon green">
                  <FaCalendarAlt />
                </div>
              </div>
              <div className="asist-socio-kpi-value-row">
                <span className="asist-socio-kpi-number">{asistenciasMesActual}</span>
                <span className="asist-socio-kpi-unit">días</span>
              </div>
              <div className="asist-socio-kpi-progress-bar">
                <div 
                  className="asist-socio-kpi-progress-fill" 
                  style={{ width: `${Math.min(100, Math.round((asistenciasMesActual / 16) * 100))}%` }}
                ></div>
              </div>
              <span className="asist-socio-kpi-footnote">
                Meta mensual recomendada: 16 sesiones
              </span>
            </div>

            {/* KPI 2: Racha Actual */}
            <div className="asist-socio-kpi-card">
              <div className="asist-socio-kpi-top">
                <span className="asist-socio-kpi-label">Racha Activa</span>
                <div className="asist-socio-kpi-icon orange">
                  <FaFire />
                </div>
              </div>
              <div className="asist-socio-kpi-value-row">
                <span className="asist-socio-kpi-number">{rachaDias}</span>
                <span className="asist-socio-kpi-unit">{rachaDias === 1 ? 'día' : 'días'}</span>
              </div>
              <div className="asist-socio-racha-tag">
                {rachaDias > 0 ? (
                  <>🔥 ¡Excelente constancia! Seguí sumando</>
                ) : (
                  <>¡Entrená hoy para encender tu racha!</>
                )}
              </div>
              <span className="asist-socio-kpi-footnote">
                Días consecutivos asistidos
              </span>
            </div>

            {/* KPI 3: Total Acumulado */}
            <div className="asist-socio-kpi-card">
              <div className="asist-socio-kpi-top">
                <span className="asist-socio-kpi-label">Total Histórico</span>
                <div className="asist-socio-kpi-icon purple">
                  <FaDumbbell />
                </div>
              </div>
              <div className="asist-socio-kpi-value-row">
                <span className="asist-socio-kpi-number">{totalAsistencias}</span>
                <span className="asist-socio-kpi-unit">ingresos</span>
              </div>
              <div className="asist-socio-kpi-tag-sub">
                Registrados desde tu inicio
              </div>
              <span className="asist-socio-kpi-footnote">
                100% verificado en sistema
              </span>
            </div>

            {/* KPI 4: Último Registro */}
            <div className="asist-socio-kpi-card">
              <div className="asist-socio-kpi-top">
                <span className="asist-socio-kpi-label">Último Ingreso</span>
                <div className="asist-socio-kpi-icon blue">
                  <FaClock />
                </div>
              </div>
              <div className="asist-socio-kpi-value-row">
                <span className="asist-socio-kpi-subnumber">
                  {ultimaAsistenciaGeneral?.hora_ingreso
                    ? new Date(ultimaAsistenciaGeneral.hora_ingreso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs'
                    : 'Sin registros'}
                </span>
              </div>
              <div className="asist-socio-kpi-tag-sub">
                {ultimaAsistenciaGeneral?.hora_ingreso
                  ? new Date(ultimaAsistenciaGeneral.hora_ingreso).toLocaleDateString('es-AR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })
                  : 'Empieza hoy'}
              </div>
              <span className="asist-socio-kpi-footnote">
                Estado: Presente en sala
              </span>
            </div>
          </section>

          {/* 5. Fila Central: Check-in del Día + Monitor Semanal */}
          <section className="asist-socio-middle-grid">
            {/* Tarjeta de Check-In del Día */}
            <div className="asist-socio-checkin-card">
              <div className="asist-socio-card-badge-header">
                <span className="asist-socio-badge-pill">Check-in Diario</span>
                <span className="asist-socio-clock-live">
                  <FaClock />
                  {horaActual.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <h2 className="asist-socio-checkin-title">Registro de Acceso al Gimnasio</h2>
              <p className="asist-socio-checkin-subtitle">
                {horaActual.toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>

              {/* Estado de Asistencia de Hoy */}
              {cargando ? (
                <div className="asist-socio-loader-box">
                  <div className="asist-socio-spinner"></div>
                  <p>Verificando estado de ingreso...</p>
                </div>
              ) : yaRegistradoHoy ? (
                <div className="asist-socio-today-registered">
                  <div className="asist-socio-check-glow">
                    <FaCheckCircle />
                  </div>
                  <div className="asist-socio-today-info">
                    <h3>¡Asistencia de Hoy Ya Registrada!</h3>
                    <p>
                      Marcaste tu ingreso hoy a las{' '}
                      <strong>
                        {ultimaAsistenciaHoy?.hora_ingreso
                          ? new Date(ultimaAsistenciaHoy.hora_ingreso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                          : 'horario confirmado'} hs
                      </strong>
                    </p>
                    <span className="asist-socio-today-note">
                      El sistema habilita un (1) registro por día por socio. ¡Que tengas un excelente entrenamiento!
                    </span>
                  </div>
                </div>
              ) : (
                <div className="asist-socio-today-pending">
                  <div className="asist-socio-pending-message">
                    <div className="asist-socio-pulse-dot"></div>
                    <span>Listo para marcar tu ingreso a la sala de entrenamiento</span>
                  </div>

                  <button
                    type="button"
                    className="asist-socio-btn-checkin"
                    disabled={registrando}
                    onClick={handleRegistrarAsistencia}
                  >
                    <FaBolt className="asist-socio-btn-icon-bolt" />
                    <span>{registrando ? 'Registrando ingreso...' : 'Marcar Mi Asistencia Ahora'}</span>
                  </button>

                  <p className="asist-socio-security-text">
                    <FaInfoCircle /> Tu DNI ({formatDni(socio?.dni)}) se utilizará para registrar la hora oficial en el sistema.
                  </p>
                </div>
              )}

              {/* Información de sede y socio */}
              <div className="asist-socio-checkin-footer">
                <div className="asist-socio-footer-item">
                  <span className="label">Gimnasio</span>
                  <span className="val">{gimnasio.nombre}</span>
                </div>
                <div className="asist-socio-footer-item">
                  <span className="label">Socio ID</span>
                  <span className="val">#{socio?.id_socio || socio?.id || '1'}</span>
                </div>
                <div className="asist-socio-footer-item">
                  <span className="label">DNI Registrado</span>
                  <span className="val">{formatDni(socio?.dni)}</span>
                </div>
              </div>
            </div>

            {/* Tarjeta de Monitor Semanal */}
            <div className="asist-socio-week-card">
              <div className="asist-socio-card-badge-header">
                <span className="asist-socio-badge-pill">Frecuencia Semanal</span>
                <span className="asist-socio-week-summary">
                  {diasSemana.filter((d) => d.asistio).length} de 7 días
                </span>
              </div>

              <h2 className="asist-socio-checkin-title">Semana Actual</h2>
              <p className="asist-socio-checkin-subtitle">
                Monitoreá tu asistencia y constancia en los últimos 7 días
              </p>

              {/* Días Lun - Dom */}
              <div className="asist-socio-week-days-row">
                {diasSemana.map((dia, idx) => (
                  <div
                    key={idx}
                    className={`asist-socio-day-col ${dia.esHoy ? 'is-today' : ''} ${
                      dia.asistio ? 'attended' : dia.esFuturo ? 'future' : 'missed'
                    }`}
                  >
                    <span className="asist-day-name">{dia.nombre}</span>
                    <div className="asist-day-circle">
                      {dia.asistio ? (
                        <FaCheck />
                      ) : (
                        <span>{dia.numero}</span>
                      )}
                    </div>
                    <span className="asist-day-label">
                      {dia.esHoy ? 'Hoy' : dia.asistio ? 'Asistió' : dia.esFuturo ? '-' : 'Descanso'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mensaje motivacional */}
              <div className="asist-socio-week-motivation">
                <div className="asist-socio-motivation-icon">
                  <FaFire />
                </div>
                <div>
                  <h4>
                    {diasSemana.filter((d) => d.asistio).length >= 4
                      ? '¡Semana imparable! Vas a paso firme.'
                      : diasSemana.filter((d) => d.asistio).length >= 1
                      ? '¡Excelente comienzo! Seguí con la rutina.'
                      : '¡Aún tienes días para sumar esta semana!'}
                  </h4>
                  <p>
                    Mantener una regularidad de 3 a 5 días semanales es la clave para ver transformaciones reales.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 6. Historial Completo de Asistencias (Tabla & Filtros Personales) */}
          <section className="asist-socio-history-card">
            <div className="asist-socio-history-header">
              <div>
                <h2>Mi Historial de Asistencias</h2>
                <p>Registro cronológico de todos tus ingresos al gimnasio</p>
              </div>

              <div className="asist-socio-history-controls">
                {/* Buscador de fecha */}
                <div className="asist-socio-search-box">
                  <FaSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por fecha, mes, día..."
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      setPaginaActual(1);
                    }}
                  />
                  {busqueda && (
                    <button
                      type="button"
                      className="clear-search"
                      onClick={() => setBusqueda('')}
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>

                {/* Filtro por Período */}
                <div className="asist-socio-filter-group">
                  <FaFilter className="filter-icon" />
                  <select
                    value={filtroPeriodo}
                    onChange={(e) => {
                      setFiltroPeriodo(e.target.value);
                      setPaginaActual(1);
                    }}
                    className="asist-socio-select"
                  >
                    <option value="mes_actual">Mes Actual</option>
                    <option value="ultimos_30">Últimos 30 días</option>
                    <option value="ultimos_90">Últimos 3 meses</option>
                    <option value="anio_actual">Este Año</option>
                    <option value="todos">Todo el Historial</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabla de Asistencias */}
            <div className="asist-socio-table-wrapper">
              <table className="asist-socio-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora de Ingreso</th>
                    <th>Día</th>
                    <th>Estado</th>
                    <th>Sede / Gimnasio</th>
                    <th style={{ textAlign: 'right' }}>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr>
                      <td colSpan="6" className="asist-socio-empty-td">
                        <div className="asist-socio-spinner small"></div>
                        <p>Cargando tu historial de ingresos...</p>
                      </td>
                    </tr>
                  ) : asistenciasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="asist-socio-empty-td">
                        <div className="asist-socio-empty-box">
                          <FaCalendarAlt size={36} />
                          <h4>No se encontraron asistencias en este período</h4>
                          <p>
                            {busqueda
                              ? 'Intentá cambiar el término de búsqueda.'
                              : 'Tus registros de ingreso aparecerán aquí a medida que asistas al gimnasio.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    asistenciasPaginadas.map((item, index) => {
                      const dateObj = item.hora_ingreso ? new Date(item.hora_ingreso) : new Date();
                      const fechaFormateada = dateObj.toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      });
                      const horaFormateada = dateObj.toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const diaSemanaNombre = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });

                      return (
                        <tr key={item.id_asistencia || index}>
                          <td>
                            <div className="asist-socio-date-cell">
                              <span className="date-main">{fechaFormateada}</span>
                            </div>
                          </td>
                          <td>
                            <div className="asist-socio-time-cell">
                              <FaClock className="icon" />
                              <span>{horaFormateada} hs</span>
                            </div>
                          </td>
                          <td>
                            <span className="asist-socio-day-badge">
                              {diaSemanaNombre.charAt(0).toUpperCase() + diaSemanaNombre.slice(1)}
                            </span>
                          </td>
                          <td>
                            <span className="asist-socio-status-badge present">
                              <FaCheck /> {item.estado || 'Presente'}
                            </span>
                          </td>
                          <td>
                            <span className="asist-socio-gym-name">{gimnasio.nombre}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="asist-socio-btn-receipt"
                              onClick={() =>
                                setModalComprobante({
                                  ...item,
                                  fechaFormateada,
                                  horaFormateada,
                                  diaSemanaNombre
                                })
                              }
                              title="Ver comprobante de acceso"
                            >
                              <FaReceipt /> Ver Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {asistenciasFiltradas.length > porPagina && (
              <div className="asist-socio-pagination">
                <span className="asist-socio-pagination-text">
                  Mostrando {(paginaActual - 1) * porPagina + 1} -{' '}
                  {Math.min(paginaActual * porPagina, asistenciasFiltradas.length)} de{' '}
                  {asistenciasFiltradas.length} asistencias
                </span>

                <div className="asist-socio-pagination-buttons">
                  <button
                    type="button"
                    className="asist-page-btn"
                    disabled={paginaActual <= 1}
                    onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                  >
                    &lt; Anterior
                  </button>

                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pg) => {
                    if (
                      pg === 1 ||
                      pg === totalPaginas ||
                      (pg >= paginaActual - 1 && pg <= paginaActual + 1)
                    ) {
                      return (
                        <button
                          key={pg}
                          type="button"
                          className={`asist-page-btn ${paginaActual === pg ? 'active' : ''}`}
                          onClick={() => setPaginaActual(pg)}
                        >
                          {pg}
                        </button>
                      );
                    }
                    if (pg === paginaActual - 2 || pg === paginaActual + 2) {
                      return (
                        <span key={pg} className="asist-page-ellipsis">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}

                  <button
                    type="button"
                    className="asist-page-btn"
                    disabled={paginaActual >= totalPaginas}
                    onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                  >
                    Siguiente &gt;
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* 7. Modal de Confirmación de Asistencia Exitosa */}
      {modalConfirmacion && (
        <div className="asist-socio-modal-overlay" onClick={() => setModalConfirmacion(null)}>
          <div className="asist-socio-modal-card success" onClick={(e) => e.stopPropagation()}>
            <div className="asist-socio-modal-icon-circle">
              <FaCheckCircle />
            </div>

            <h2>¡Asistencia Confirmada!</h2>
            <p className="asist-socio-modal-desc">{modalConfirmacion.mensaje}</p>

            <div className="asist-socio-receipt-box">
              <div className="receipt-row">
                <span className="lbl">Fecha</span>
                <span className="val">{modalConfirmacion.fecha}</span>
              </div>
              <div className="receipt-row">
                <span className="lbl">Hora de Ingreso</span>
                <span className="val highlight">{modalConfirmacion.hora} hs</span>
              </div>
              <div className="receipt-row">
                <span className="lbl">Socio</span>
                <span className="val">{socio?.nombre} {socio?.apellido}</span>
              </div>
              <div className="receipt-row">
                <span className="lbl">DNI</span>
                <span className="val">{formatDni(socio?.dni)}</span>
              </div>
              <div className="receipt-row">
                <span className="lbl">Sede</span>
                <span className="val">{gimnasio.nombre}</span>
              </div>
            </div>

            <button
              type="button"
              className="asist-socio-btn-modal-close"
              onClick={() => setModalConfirmacion(null)}
            >
              ¡Entendido, a entrenar!
            </button>
          </div>
        </div>
      )}

      {/* 8. Modal de Comprobante / Ticket de Acceso */}
      {modalComprobante && (
        <div className="asist-socio-modal-overlay" onClick={() => setModalComprobante(null)}>
          <div className="asist-socio-modal-card ticket" onClick={(e) => e.stopPropagation()}>
            <div className="asist-ticket-header">
              <div>
                <span className="asist-ticket-brand">GYM<span>TRACK</span></span>
                <p>Comprobante Oficial de Asistencia</p>
              </div>
              <button
                type="button"
                className="asist-ticket-close"
                onClick={() => setModalComprobante(null)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="asist-ticket-body">
              <div className="asist-ticket-badge-state">
                <FaCheck /> {modalComprobante.estado || 'Presente'}
              </div>

              <div className="asist-ticket-details-grid">
                <div>
                  <span className="lbl">Código de Acceso</span>
                  <span className="val code">#ASIST-{modalComprobante.id_asistencia || '001'}</span>
                </div>
                <div>
                  <span className="lbl">Fecha</span>
                  <span className="val">{modalComprobante.fechaFormateada}</span>
                </div>
                <div>
                  <span className="lbl">Hora de Ingreso</span>
                  <span className="val">{modalComprobante.horaFormateada} hs</span>
                </div>
                <div>
                  <span className="lbl">Día</span>
                  <span className="val" style={{ textTransform: 'capitalize' }}>
                    {modalComprobante.diaSemanaNombre}
                  </span>
                </div>
                <div>
                  <span className="lbl">Socio</span>
                  <span className="val">{socio?.nombre} {socio?.apellido}</span>
                </div>
                <div>
                  <span className="lbl">DNI</span>
                  <span className="val">{formatDni(socio?.dni)}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span className="lbl">Gimnasio</span>
                  <span className="val">{gimnasio.nombre}</span>
                </div>
              </div>
            </div>

            <div className="asist-ticket-footer">
              <button
                type="button"
                className="asist-ticket-btn-print"
                onClick={() => window.print()}
              >
                <FaPrint /> Imprimir Ticket
              </button>
              <button
                type="button"
                className="asist-ticket-btn-close"
                onClick={() => setModalComprobante(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}