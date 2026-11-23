/**
 * =========================================================================================
 * ARCHIVO: asistencias.jsx
 * RUTA: frontend/src/pages/asistencias-dueno/asistencias.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Panel de Control de Asistencias, Entradas en Vivo y Métricas de Concurrencia.
 * =========================================================================================
 * 
 * GUÍA DE ARQUITECTURA OPERATIVA PARA EL DESARROLLADOR:
 * 1. CHECK-IN EN VIVO EN MOSTRADOR / RECEPCIÓN:
 *    - Permite al recepcionista o dueño ingresar el DNI del socio o buscarlo por nombre en el
 *      selector predictivo para registrar su entrada instantáneamente (`registrarAsistencia()`).
 *    - Feedback visual inmediato con tarjeta de confirmación del socio ingresado.
 * 2. TELEMETRÍA Y MÉTRICAS DE CONCURRENCIA:
 *    - `stats`: Compara el total de asistencias del mes actual contra el mes precedente.
 *    - Calcula automáticamente el porcentaje de variación y tendencia (crecimiento / caída)
 *      para medir el nivel de actividad y retención de alumnos en el gimnasio.
 * 3. HISTORIAL, FILTRADO Y AUDITORÍA:
 *    - Grilla paginada con filtrado dinámico por socio, texto libre o rangos temporales
 *      ('Hoy', 'Esta semana', 'Mes actual', 'Histórico').
 *    - Modal de Ficha Individual (`fetchHistorialPorSocio`) para ver días entrenados de un alumno.
 *    - Eliminación supervisada de marcaciones duplicadas o accidentales (`deleteAsistencia`).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import { useGymContext } from '../../context/GymContext';
import {
  fetchAsistencias,
  registrarAsistencia,
  checkoutAsistencia,
  fetchEstadisticasAsistencias,
  fetchHistorialPorSocio,
  anularAsistencia
} from '../../services/asistenciaService';
import { getSucursales } from '../../services/sucursalService';
import { fetchSocios } from '../../services/socioService';
import {
  formatFechaArgentina,
  formatHoraArgentina,
  getFechaArgentinaISO
} from '../../utils/dateUtils';

import {
  FaCalendarAlt,
  FaSearch,
  FaUser,
  FaChevronDown,
  FaUsers,
  FaDownload,
  FaEllipsisV,
  FaCheck,
  FaTimes,
  FaHistory,
  FaTrashAlt,
  FaArrowUp,
  FaArrowDown,
  FaMapMarkerAlt,
  FaSignOutAlt
} from 'react-icons/fa';

import './asistencias.css';

export default function Asistencias() {
  const { rol, esDueno, esAdministrador, esAdminSucursal, hasPermission, gimnasioActivoId, contextVersion } = useGymContext();
  const esSocio = rol === 'socio';
  const puedeGestionarAsistencia = esDueno || esAdministrador || esAdminSucursal || hasPermission('gestionar_asistencias');

  // Estados para datos
  const [asistencias, setAsistencias] = useState([]);
  const [totalAsistencias, setTotalAsistencias] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const limitPerPage = 10;

  // Sucursales del gimnasio activo
  const [sucursales, setSucursales] = useState([]);
  const [filtroSucursalId, setFiltroSucursalId] = useState('');
  const [sucursalCheckinId, setSucursalCheckinId] = useState('');

  // Estados de Estadísticas
  const [stats, setStats] = useState({
    totalMesActual: 0,
    totalMesAnterior: 0,
    porcentajeCambio: 0,
    tendencia: 'neutral',
    nombreMes: 'mes actual'
  });

  // Filtros superiores
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroSocioId, setFiltroSocioId] = useState('');
  const [fechaRangoLabel, setFechaRangoLabel] = useState('Mes actual');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Dropdowns superiores
  const [showFechaDropdown, setShowFechaDropdown] = useState(false);
  const [showSocioDropdown, setShowSocioDropdown] = useState(false);

  // Registro de asistencia
  const [searchSocioInput, setSearchSocioInput] = useState('');
  const [sociosList, setSociosList] = useState([]);
  const [filteredSociosSuggestions, setFilteredSociosSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Menú contextual en tabla
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Modal de Historial
  const [modalSocio, setModalSocio] = useState(null);
  const [historialSocio, setHistorialSocio] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const fechaRef = useRef(null);
  const socioFilterRef = useRef(null);
  const registerInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fechaRef.current && !fechaRef.current.contains(event.target)) {
        setShowFechaDropdown(false);
      }
      if (socioFilterRef.current && !socioFilterRef.current.contains(event.target)) {
        setShowSocioDropdown(false);
      }
      if (registerInputRef.current && !registerInputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar socios y sucursales del gimnasio activo
  useEffect(() => {
    if (!gimnasioActivoId) return;
    const loadCatalogs = async () => {
      try {
        const [resSocios, resSuc] = await Promise.all([
          fetchSocios({ limit: 200 }).catch(() => ({ socios: [] })),
          getSucursales({ estado: 'true' }).catch(() => [])
        ]);
        setSociosList(resSocios?.socios || []);
        setSucursales(resSuc || []);
        setFiltroSucursalId('');
        setSucursalCheckinId(resSuc?.[0]?.id_sucursal ? String(resSuc[0].id_sucursal) : '');
      } catch (err) {
        console.error('Error cargando socios/sucursales:', err);
      }
    };
    loadCatalogs();
  }, [gimnasioActivoId, contextVersion]);

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    if (!gimnasioActivoId) return;
    try {
      const data = await fetchEstadisticasAsistencias({ id_sucursal: filtroSucursalId });
      setStats(data);
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  }, [gimnasioActivoId, filtroSucursalId]);

  useEffect(() => {
    loadStats();
  }, [loadStats, contextVersion]);

  // Cargar tabla de asistencias según filtros y página
  const loadAsistencias = useCallback(async () => {
    if (!gimnasioActivoId) return;
    setLoading(true);
    try {
      const data = await fetchAsistencias({
        page: currentPage,
        limit: limitPerPage,
        search: searchTerm,
        desde: fechaDesde,
        hasta: fechaHasta,
        id_socio: filtroSocioId,
        id_sucursal: filtroSucursalId
      });

      setAsistencias(data.asistencias || []);
      setTotalAsistencias(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Error al cargar asistencias:', err);
    } finally {
      setLoading(false);
    }
  }, [gimnasioActivoId, currentPage, searchTerm, fechaDesde, fechaHasta, filtroSocioId, filtroSucursalId]);

  useEffect(() => {
    loadAsistencias();
  }, [loadAsistencias, contextVersion]);

  // Manejar sugerencias del input de búsqueda en el formulario de registro
  const handleSearchSocioChange = (e) => {
    const val = e.target.value;
    setSearchSocioInput(val);
    if (!val.trim()) {
      setFilteredSociosSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const clean = val.toLowerCase().trim();
    const matches = sociosList.filter((s) => {
      const nomCompleto = `${s.nombre || ''} ${s.apellido || ''}`.toLowerCase();
      const dni = (s.dni || '').toString();
      const id = (s.id_socio || '').toString();
      return nomCompleto.includes(clean) || dni.includes(clean) || id === clean;
    });
    setFilteredSociosSuggestions(matches.slice(0, 6));
    setShowSuggestions(true);
  };

  const handleSelectSocio = (socio) => {
    setSelectedSocio(socio);
    setSearchSocioInput(`${socio.nombre} ${socio.apellido}`);
    setShowSuggestions(false);
    setFeedbackMessage(null);
  };

  const handleClearSelectedSocio = () => {
    setSelectedSocio(null);
    setSearchSocioInput('');
    setFeedbackMessage(null);
  };

  // Registrar Asistencia
  const handleRegistrarAsistencia = async () => {
    setFeedbackMessage(null);
    if (!selectedSocio && !searchSocioInput.trim()) {
      setFeedbackMessage({
        type: 'error',
        text: 'Por favor, ingresá el ID, DNI o seleccioná un socio.'
      });
      return;
    }
    if (!sucursalCheckinId) {
      setFeedbackMessage({
        type: 'error',
        text: 'Seleccioná una sucursal activa para registrar el ingreso.'
      });
      return;
    }

    setRegisterLoading(true);
    try {
      const payload = selectedSocio
        ? { id_socio: selectedSocio.id_socio, id_sucursal: Number(sucursalCheckinId) }
        : { dni: searchSocioInput.trim(), id_sucursal: Number(sucursalCheckinId) };

      const res = await registrarAsistencia(payload);

      setFeedbackMessage({
        type: 'success',
        text: res.mensaje || '¡Asistencia registrada correctamente!'
      });

      setSelectedSocio(null);
      setSearchSocioInput('');
      loadAsistencias();
      loadStats();
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'No se pudo registrar la asistencia.'
      });
    } finally {
      setRegisterLoading(false);
    }
  };

  // Registrar salida (Check-out)
  const handleCheckoutAsistencia = async (idAsistencia) => {
    setActiveMenuId(null);
    try {
      await checkoutAsistencia(idAsistencia);
      loadAsistencias();
      loadStats();
    } catch (err) {
      alert(err.message || 'Error al registrar la salida.');
    }
  };

  // Rango de fechas predefinidos (en horario de Argentina GMT-3)
  const aplicarRangoFecha = (tipo) => {
    const hoyArgStr = getFechaArgentinaISO(new Date());
    const [anioStr, mesStr] = hoyArgStr.split('-');
    const anio = Number(anioStr);
    const mes = Number(mesStr); // 1-12
    let desde;
    let hasta;
    let label;

    if (tipo === 'mes_actual') {
      const ultimoDiaNum = new Date(anio, mes, 0).getDate();
      const primerDiaStr = `${anioStr}-${mesStr}-01`;
      const ultimoDiaStr = `${anioStr}-${mesStr}-${String(ultimoDiaNum).padStart(2, '0')}`;
      desde = new Date(`${primerDiaStr}T00:00:00-03:00`).toISOString();
      hasta = new Date(`${ultimoDiaStr}T23:59:59.999-03:00`).toISOString();
      label = `01/${mesStr}/${anioStr} - ${String(ultimoDiaNum).padStart(2, '0')}/${mesStr}/${anioStr}`;
    } else if (tipo === 'hoy') {
      desde = new Date(`${hoyArgStr}T00:00:00-03:00`).toISOString();
      hasta = new Date(`${hoyArgStr}T23:59:59.999-03:00`).toISOString();
      label = 'Hoy';
    } else if (tipo === '7_dias') {
      const hace7Dias = new Date(`${hoyArgStr}T00:00:00-03:00`);
      hace7Dias.setDate(hace7Dias.getDate() - 7);
      desde = hace7Dias.toISOString();
      hasta = new Date(`${hoyArgStr}T23:59:59.999-03:00`).toISOString();
      label = 'Últimos 7 días';
    } else {
      desde = '';
      hasta = '';
      label = 'Todas las fechas';
    }

    setFechaDesde(desde);
    setFechaHasta(hasta);
    setFechaRangoLabel(label);
    setShowFechaDropdown(false);
    setCurrentPage(1);
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    if (!asistencias || asistencias.length === 0) {
      alert('No hay asistencias para exportar en este momento.');
      return;
    }

    const headers = ['ID Asistencia', 'Fecha', 'Ingreso', 'Salida', 'Sucursal', 'Socio', 'DNI', 'Estado'];
    const rows = asistencias.map((a) => {
      const fecha = formatFechaArgentina(a.hora_ingreso);
      const hora = formatHoraArgentina(a.hora_ingreso);
      const salida = a.hora_salida ? formatHoraArgentina(a.hora_salida) : '-';
      const sucursal = a.sucursal?.direccion || '-';
      const socioNombre = a.socio ? `${a.socio.nombre || ''} ${a.socio.apellido || ''}`.trim() : 'N/A';
      const dni = a.socio?.dni || 'N/A';
      const estado = a.estado || 'presente';
      return [a.id_asistencia_socio || a.id_asistencia, fecha, hora, salida, `"${sucursal}"`, `"${socioNombre}"`, dni, estado];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `asistencias_gymtrack_${getFechaArgentinaISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ver Historial de un Socio
  const handleVerHistorial = async (socio) => {
    setActiveMenuId(null);
    setModalSocio(socio);
    setLoadingHistorial(true);
    try {
      const res = await fetchHistorialPorSocio(socio.id_socio);
      setHistorialSocio(res.asistencias || []);
    } catch (err) {
      console.error('Error al obtener historial:', err);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Anular Asistencia lógicamente (RPC rpc_anular_asistencia)
  const handleAnularAsistencia = async (idAsistencia) => {
    setActiveMenuId(null);
    const motivo = window.prompt('Indicá el motivo de anulación de esta asistencia (opcional):', '');
    if (motivo === null) return;

    try {
      await anularAsistencia(idAsistencia, motivo);
      loadAsistencias();
      loadStats();
    } catch (err) {
      alert(err.message || 'Error al anular asistencia');
    }
  };

  // Formato DNI con puntos (ej: 32.456.789)
  const formatDni = (dni) => {
    if (!dni) return '-';
    return dni.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Rango de elementos mostrados
  const primerItem = totalAsistencias === 0 ? 0 : (currentPage - 1) * limitPerPage + 1;
  const ultimoItem = Math.min(currentPage * limitPerPage, totalAsistencias);

  if (esSocio) {
    return <Navigate to="/asistencia-socio" replace />;
  }

  return (
    <div className="asistencias-layout">
      <NavGlobal />

      <div className="asistencias-body">
        <Sidebar />

        <main className="asistencias-main-content">
          {/* 1. SECCIÓN SUPERIOR: HEADER & FILTROS */}
          <section className="asist-header-section">
            <div className="asist-title-container">
              <div className="asist-title-icon-badge">
                <FaCalendarAlt />
              </div>
              <div className="asist-title-texts">
                <h1>Asistencias</h1>
                <p>Controlá y registrá las asistencias de tus socios</p>
              </div>
            </div>

            {/* Barra de Filtros */}
            <div className="asist-filters-bar">
              {/* Buscador de socio */}
              <div className="asist-filter-box">
                <FaSearch className="asist-filter-icon" />
                <input
                  type="text"
                  className="asist-filter-input"
                  placeholder="Buscar socio por nombre, DNI o email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Selector de Rango de Fechas */}
              <div className="asist-filter-box" ref={fechaRef}>
                <button
                  type="button"
                  className="asist-filter-dropdown-btn"
                  onClick={() => setShowFechaDropdown(!showFechaDropdown)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaCalendarAlt className="asist-filter-icon" />
                    {fechaRangoLabel}
                  </span>
                  <FaChevronDown className="asist-chevron" />
                </button>

                {showFechaDropdown && (
                  <div className="asist-dropdown-menu">
                    <div
                      className={`asist-dropdown-item ${fechaRangoLabel === 'Mes actual' ? 'active' : ''}`}
                      onClick={() => aplicarRangoFecha('mes_actual')}
                    >
                      Mes actual
                    </div>
                    <div
                      className={`asist-dropdown-item ${fechaRangoLabel === 'Hoy' ? 'active' : ''}`}
                      onClick={() => aplicarRangoFecha('hoy')}
                    >
                      Hoy
                    </div>
                    <div
                      className={`asist-dropdown-item ${fechaRangoLabel === 'Últimos 7 días' ? 'active' : ''}`}
                      onClick={() => aplicarRangoFecha('7_dias')}
                    >
                      Últimos 7 días
                    </div>
                    <div
                      className={`asist-dropdown-item ${fechaRangoLabel === 'Todas las fechas' ? 'active' : ''}`}
                      onClick={() => aplicarRangoFecha('todas')}
                    >
                      Todas las fechas
                    </div>
                  </div>
                )}
              </div>

              {/* Selector de Socio */}
              <div className="asist-filter-box" ref={socioFilterRef}>
                <button
                  type="button"
                  className="asist-filter-dropdown-btn"
                  onClick={() => setShowSocioDropdown(!showSocioDropdown)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaUser className="asist-filter-icon" />
                    {filtroSocioId
                      ? sociosList.find((s) => s.id_socio === Number(filtroSocioId))?.nombre || 'Socio seleccionado'
                      : 'Todos los socios'}
                  </span>
                  <FaChevronDown className="asist-chevron" />
                </button>

                {showSocioDropdown && (
                  <div className="asist-dropdown-menu" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <div
                      className={`asist-dropdown-item ${!filtroSocioId ? 'active' : ''}`}
                      onClick={() => {
                        setFiltroSocioId('');
                        setShowSocioDropdown(false);
                        setCurrentPage(1);
                      }}
                    >
                      Todos los socios
                    </div>
                    {sociosList.map((s) => (
                      <div
                        key={s.id_socio}
                        className={`asist-dropdown-item ${filtroSocioId === s.id_socio.toString() ? 'active' : ''}`}
                        onClick={() => {
                          setFiltroSocioId(s.id_socio.toString());
                          setShowSocioDropdown(false);
                          setCurrentPage(1);
                        }}
                      >
                        {s.nombre} {s.apellido} ({s.dni})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Filtro por Sucursal */}
              <div className="asist-filter-box">
                <FaMapMarkerAlt className="asist-filter-icon" />
                <select
                  className="asist-filter-input"
                  value={filtroSucursalId}
                  onChange={(e) => {
                    setFiltroSucursalId(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}
                >
                  <option value="" style={{ background: '#151b23' }}>Todas las sucursales</option>
                  {sucursales.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal} style={{ background: '#151b23' }}>
                      {s.direccion}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 2. GRID PRINCIPAL */}
          <div className="asist-content-grid">
            {/* COLUMNA IZQUIERDA: Formulario + Stats */}
            <div className="asist-left-column">
              {/* Card 1: Registrar Asistencia */}
              <div className="asist-card-register">
                <div className="asist-register-header">
                  <div className="asist-user-badge-icon">
                    <FaUser />
                  </div>
                  <div className="asist-register-titles">
                    <h2>Registrar asistencia</h2>
                    <p>Seleccioná sucursal y socio para marcar su ingreso</p>
                  </div>
                </div>

                <div className="asist-form-group">
                  <label>Sucursal *</label>
                  <select
                    value={sucursalCheckinId}
                    onChange={(e) => setSucursalCheckinId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#11161d',
                      color: '#f8fafc',
                      border: '1px solid rgba(255,255,255,0.12)'
                    }}
                  >
                    {sucursales.length === 0 ? (
                      <option value="">No hay sucursales activas (creá una en Sucursales)</option>
                    ) : (
                      sucursales.map((s) => (
                        <option key={s.id_sucursal} value={s.id_sucursal}>
                          {s.direccion}{s.descripcion ? ` — ${s.descripcion}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="asist-form-group" ref={registerInputRef}>
                  <label>Socio</label>
                  <div className="asist-input-selector-wrapper">
                    <input
                      type="text"
                      placeholder="Buscar socio por nombre, DNI o ID..."
                      value={searchSocioInput}
                      onChange={handleSearchSocioChange}
                      onFocus={() => {
                        if (searchSocioInput.trim()) setShowSuggestions(true);
                      }}
                    />
                    <FaChevronDown className="asist-chevron" />
                  </div>

                  {/* Dropdown de Sugerencias */}
                  {showSuggestions && filteredSociosSuggestions.length > 0 && (
                    <div className="asist-socios-suggestions-dropdown">
                      {filteredSociosSuggestions.map((socio) => (
                        <div
                          key={socio.id_socio}
                          className="asist-socio-suggestion-item"
                          onClick={() => handleSelectSocio(socio)}
                        >
                          <div className="asist-suggestion-info">
                            <span className="asist-suggestion-name">
                              {socio.nombre} {socio.apellido}
                            </span>
                            <span className="asist-suggestion-dni">
                              DNI: {formatDni(socio.dni)} • ID: {socio.id_socio}
                            </span>
                          </div>
                          <span
                            className="asist-badge-status"
                            style={{
                              backgroundColor: socio.estado === 'activo' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                              color: socio.estado === 'activo' ? '#4ade80' : '#f87171'
                            }}
                          >
                            {socio.estado || 'Activo'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Previsualización del Socio Seleccionado */}
                {selectedSocio && (
                  <div className="asist-selected-socio-preview">
                    <div className="asist-selected-socio-details">
                      <div className="asist-selected-avatar">
                        {selectedSocio.nombre?.charAt(0)}
                        {selectedSocio.apellido?.charAt(0)}
                      </div>
                      <div className="asist-selected-text">
                        <h4>
                          {selectedSocio.nombre} {selectedSocio.apellido}
                        </h4>
                        <p>
                          DNI: {formatDni(selectedSocio.dni)} • Estado:{' '}
                          <b style={{ color: selectedSocio.estado === 'activo' ? '#a3e635' : '#f87171' }}>
                            {selectedSocio.estado || 'Activo'}
                          </b>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="asist-clear-btn"
                      onClick={handleClearSelectedSocio}
                      title="Quitar socio"
                    >
                      <FaTimes />
                    </button>
                  </div>
                )}

                {/* Botón de Registro */}
                <button
                  type="button"
                  className="asist-btn-submit"
                  disabled={registerLoading}
                  onClick={handleRegistrarAsistencia}
                >
                  <FaCheck /> {registerLoading ? 'Registrando...' : 'Registrar asistencia'}
                </button>

                {/* Mensaje de Feedback */}
                {feedbackMessage && (
                  <div
                    className={`asist-alert-message ${
                      feedbackMessage.type === 'success' ? 'asist-alert-success' : 'asist-alert-error'
                    }`}
                  >
                    {feedbackMessage.type === 'success' ? <FaCheck /> : <FaTimes />}
                    <span>{feedbackMessage.text}</span>
                  </div>
                )}
              </div>

              {/* Card 2: Tarjeta de Métricas */}
              <div className="asist-card-stats">
                <div className="asist-stats-icon-badge">
                  <FaUsers />
                </div>
                <div className="asist-stats-info">
                  <h3>{stats.totalMesActual}</h3>
                  <p>Asistencias en {stats.nombreMes}</p>
                  <div className={`asist-stats-indicator ${stats.tendencia}`}>
                    {stats.tendencia === 'up' && <FaArrowUp />}
                    {stats.tendencia === 'down' && <FaArrowDown />}
                    <span>
                      {stats.tendencia === 'up' ? `↑ ${stats.porcentajeCambio}%` : ''}
                      {stats.tendencia === 'down' ? `↓ ${stats.porcentajeCambio}%` : ''}
                      {stats.tendencia === 'neutral' ? '0%' : ''} vs. mes anterior
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: Listado de Asistencias (Tabla) */}
            <div className="asist-card-table">
              <div className="asist-table-topbar">
                <h2>Listado de asistencias</h2>
                <button type="button" className="asist-btn-export" onClick={handleExportCSV}>
                  <FaDownload /> Exportar
                </button>
              </div>

              <div className="asist-table-responsive" ref={menuRef}>
                <table className="asist-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Ingreso / Salida</th>
                      <th>Sucursal</th>
                      <th>Socio</th>
                      <th>DNI</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="asist-empty-state">
                          Cargando asistencias...
                        </td>
                      </tr>
                    ) : asistencias.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="asist-empty-state">
                          No se encontraron asistencias registradas con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      asistencias.map((item) => {
                        const rowId = item.id_asistencia_socio || item.id_asistencia;
                        const fechaStr = formatFechaArgentina(item.hora_ingreso);
                        const horaStr = formatHoraArgentina(item.hora_ingreso);
                        const salidaStr = item.hora_salida ? formatHoraArgentina(item.hora_salida) : null;
                        const abierta = item.estado === 'presente' && !item.hora_salida;

                        return (
                          <tr key={rowId}>
                            <td>{fechaStr}</td>
                            <td>
                              <div>{horaStr} hs</div>
                              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                {salidaStr ? `Salida: ${salidaStr} hs` : 'En curso'}
                              </div>
                            </td>
                            <td>{item.sucursal?.direccion || '-'}</td>
                            <td className="asist-table-socio-name">
                              {item.socio ? `${item.socio.nombre || ''} ${item.socio.apellido || ''}`.trim() : 'Socio'}
                            </td>
                            <td className="asist-table-dni">
                              {formatDni(item.socio?.dni)}
                            </td>
                            <td>
                              <span className="asist-badge-status">
                                {item.estado ? item.estado.charAt(0).toUpperCase() + item.estado.slice(1) : 'Presente'}
                              </span>
                            </td>
                            <td className="asist-actions-cell">
                              <button
                                type="button"
                                className="asist-btn-actions"
                                onClick={() =>
                                  setActiveMenuId(activeMenuId === rowId ? null : rowId)
                                }
                                title="Acciones"
                              >
                                <FaEllipsisV />
                              </button>

                              {activeMenuId === rowId && (
                                <div className="asist-action-menu">
                                  {abierta && puedeGestionarAsistencia && (
                                    <div
                                      className="asist-action-menu-item"
                                      onClick={() => handleCheckoutAsistencia(rowId)}
                                    >
                                      <FaSignOutAlt /> Registrar salida
                                    </div>
                                  )}
                                  {item.socio && (
                                    <div
                                      className="asist-action-menu-item"
                                      onClick={() => handleVerHistorial(item.socio)}
                                    >
                                      <FaHistory /> Ver historial del socio
                                    </div>
                                  )}
                                  {puedeGestionarAsistencia && item.estado !== 'anulada' && (
                                    <div
                                      className="asist-action-menu-item delete"
                                      onClick={() => handleAnularAsistencia(rowId)}
                                    >
                                      <FaTrashAlt /> Anular asistencia
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="asist-table-footer">
                <span>
                  Mostrando {primerItem} - {ultimoItem} de {totalAsistencias} asistencias
                </span>

                <div className="asist-pagination-controls">
                  <button
                    type="button"
                    className="asist-page-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  >
                    &lt;
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                    // Mostrar máximo 5 botones alrededor de la página actual
                    if (
                      pg === 1 ||
                      pg === totalPages ||
                      (pg >= currentPage - 2 && pg <= currentPage + 2)
                    ) {
                      return (
                        <button
                          key={pg}
                          type="button"
                          className={`asist-page-btn ${currentPage === pg ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pg)}
                        >
                          {pg}
                        </button>
                      );
                    }
                    if (pg === currentPage - 3 || pg === currentPage + 3) {
                      return (
                        <span key={pg} style={{ color: '#64748b', padding: '0 2px' }}>
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}

                  <button
                    type="button"
                    className="asist-page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 3. MODAL: HISTORIAL DE ASISTENCIAS DEL SOCIO */}
      {modalSocio && (
        <div className="asist-modal-overlay" onClick={() => setModalSocio(null)}>
          <div className="asist-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="asist-modal-header">
              <h3>Historial de Asistencias</h3>
              <button
                type="button"
                className="asist-modal-close-btn"
                onClick={() => setModalSocio(null)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="asist-modal-body">
              <div className="asist-socio-badge-header">
                <div className="asist-selected-avatar">
                  {modalSocio.nombre?.charAt(0)}
                  {modalSocio.apellido?.charAt(0)}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', color: '#fff', fontSize: '15px' }}>
                    {modalSocio.nombre} {modalSocio.apellido}
                  </h4>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                    DNI: {formatDni(modalSocio.dni)} • Total de asistencias registradas: {historialSocio.length}
                  </p>
                </div>
              </div>

              {loadingHistorial ? (
                <p className="asist-empty-state">Cargando historial...</p>
              ) : historialSocio.length === 0 ? (
                <p className="asist-empty-state">Este socio aún no registra asistencias.</p>
              ) : (
                <div className="asist-modal-timeline">
                  {historialSocio.map((h, idx) => {
                    return (
                      <div key={h.id_asistencia_socio || h.id_asistencia || idx} className="asist-timeline-item">
                        <span className="asist-timeline-date">
                          {formatFechaArgentina(h.hora_ingreso, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="asist-timeline-time">
                          {formatHoraArgentina(h.hora_ingreso)} hs
                          {h.hora_salida ? ` → ${formatHoraArgentina(h.hora_salida)} hs` : ' (en curso)'}
                          {h.sucursal?.direccion ? ` • ${h.sucursal.direccion}` : ''}
                        </span>
                        <span className="asist-badge-status">
                          {h.estado ? h.estado.charAt(0).toUpperCase() + h.estado.slice(1) : 'Presente'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
