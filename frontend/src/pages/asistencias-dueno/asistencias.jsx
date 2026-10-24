/**
 * =========================================================================================
 * ARCHIVO: asistencias.jsx
 * RUTA: frontend/src/pages/asistencias-dueno/asistencias.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Panel de Control de Asistencias, Entradas en Vivo y Métricas de Concurrencia.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 1. PASO 1 (Métricas de Concurrencia): Calcula el total de ingresos del mes actual comparado
 *    con el mes previo para identificar crecimiento o deserción en el gimnasio.
 * 2. PASO 2 (Registro Rápido en Recepción): Permite marcar el ingreso de un socio usando su
 *    DNI o seleccionándolo de una lista desplegable con auto-completado.
 * 3. PASO 3 (Historial y Búsqueda): Tabla interactiva con paginación, filtros por fecha y
 *    posibilidad de consultar el historial individual de cada socio (`fetchHistorialPorSocio`).
 * 4. PASO 4 (Exportación): Generación de reportes y opción de supresión de registros erróneos.
 */

import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import {
  fetchAsistencias,
  registrarAsistencia,
  fetchEstadisticasAsistencias,
  fetchHistorialPorSocio,
  deleteAsistencia
} from '../../services/asistenciaService';
import { fetchSocios } from '../../services/socioService';

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
  FaArrowDown
} from 'react-icons/fa';

import './asistencias.css';

export default function Asistencias() {
  const rol = localStorage.getItem('rol');
  const esSocio = rol === 'socio' || Boolean(localStorage.getItem('socio'));


  // Estados para datos
  const [asistencias, setAsistencias] = useState([]);
  const [totalAsistencias, setTotalAsistencias] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const limitPerPage = 10;

  // Estados de Estadísticas
  const [stats, setStats] = useState({
    totalMesActual: 0,
    totalMesAnterior: 0,
    porcentajeCambio: 0,
    tendencia: 'neutral',
    nombreMes: 'abril'
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
  const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Menú contextual en tabla
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Modal de Historial
  const [modalSocio, setModalSocio] = useState(null);
  const [historialSocio, setHistorialSocio] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Referencias para cerrar dropdowns al hacer clic afuera
  const fechaRef = useRef(null);
  const socioFilterRef = useRef(null);
  const registerInputRef = useRef(null);
  const menuRef = useRef(null);

  // Cerrar menús al hacer clic fuera
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

  // Cargar lista general de socios para autocomplete y filtros
  useEffect(() => {
    const loadSocios = async () => {
      try {
        const res = await fetchSocios({ limit: 'all' });
        if (res && res.socios) {
          setSociosList(res.socios);
        }
      } catch (err) {
        console.error('Error cargando socios:', err);
      }
    };
    loadSocios();
  }, []);

  // Cargar estadísticas
  const loadStats = async () => {
    try {
      const data = await fetchEstadisticasAsistencias();
      setStats(data);
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Cargar tabla de asistencias según filtros y página
  const loadAsistencias = async () => {
    setLoading(true);
    try {
      const data = await fetchAsistencias({
        page: currentPage,
        limit: limitPerPage,
        search: searchTerm,
        desde: fechaDesde,
        hasta: fechaHasta,
        id_socio: filtroSocioId
      });

      setAsistencias(data.asistencias || []);
      setTotalAsistencias(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Error al cargar asistencias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAsistencias();
  }, [currentPage, searchTerm, fechaDesde, fechaHasta, filtroSocioId]);

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

    setRegisterLoading(true);
    try {
      const payload = selectedSocio
        ? { id_socio: selectedSocio.id_socio }
        : { dni: searchSocioInput.trim() };

      const res = await registrarAsistencia(payload);

      setFeedbackMessage({
        type: 'success',
        text: res.mensaje || '¡Asistencia registrada correctamente!'
      });

      // Limpiar campos y refrescar
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

  // Rango de fechas predefinidos
  const aplicarRangoFecha = (tipo) => {
    const hoy = new Date();
    let desde;
    let hasta;
    let label;

    if (tipo === 'mes_actual') {
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      desde = primerDia.toISOString().split('T')[0];
      hasta = ultimoDia.toISOString().split('T')[0];
      label = `01/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()} - ${String(ultimoDia.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    } else if (tipo === 'hoy') {
      const hoyStr = hoy.toISOString().split('T')[0];
      desde = hoyStr;
      hasta = hoyStr;
      label = 'Hoy';
    } else if (tipo === '7_dias') {
      const hace7Dias = new Date();
      hace7Dias.setDate(hoy.getDate() - 7);
      desde = hace7Dias.toISOString().split('T')[0];
      hasta = hoy.toISOString().split('T')[0];
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

    const headers = ['ID Asistencia', 'Fecha', 'Hora', 'Socio', 'DNI', 'Estado'];
    const rows = asistencias.map((a) => {
      const d = a.hora_ingreso ? new Date(a.hora_ingreso) : new Date();
      const fecha = d.toLocaleDateString('es-AR');
      const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const socioNombre = a.socio ? `${a.socio.nombre || ''} ${a.socio.apellido || ''}`.trim() : 'N/A';
      const dni = a.socio?.dni || 'N/A';
      const estado = a.estado || 'Registrada';
      return [a.id_asistencia, fecha, hora, `"${socioNombre}"`, dni, estado];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `asistencias_gymtrack_${new Date().toISOString().split('T')[0]}.csv`);
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

  // Eliminar Asistencia
  const handleEliminarAsistencia = async (idAsistencia) => {
    setActiveMenuId(null);
    if (!window.confirm('¿Seguro que deseas eliminar este registro de asistencia?')) return;

    try {
      await deleteAsistencia(idAsistencia);
      loadAsistencias();
      loadStats();
    } catch (err) {
      alert(err.message || 'Error al eliminar asistencia');
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
                    <p>Seleccioná un socio para marcar su asistencia</p>
                  </div>
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
                      <th>Hora</th>
                      <th>Socio</th>
                      <th>DNI</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="asist-empty-state">
                          Cargando asistencias...
                        </td>
                      </tr>
                    ) : asistencias.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="asist-empty-state">
                          No se encontraron asistencias registradas con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      asistencias.map((item) => {
                        const dateObj = item.hora_ingreso ? new Date(item.hora_ingreso) : new Date();
                        const fechaStr = dateObj.toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        });
                        const horaStr = dateObj.toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <tr key={item.id_asistencia}>
                            <td>{fechaStr}</td>
                            <td>{horaStr}</td>
                            <td className="asist-table-socio-name">
                              {item.socio ? `${item.socio.nombre || ''} ${item.socio.apellido || ''}`.trim() : 'Socio'}
                            </td>
                            <td className="asist-table-dni">
                              {formatDni(item.socio?.dni)}
                            </td>
                            <td>
                              <span className="asist-badge-status">
                                {item.estado ? item.estado.charAt(0).toUpperCase() + item.estado.slice(1) : 'Registrada'}
                              </span>
                            </td>
                            <td className="asist-actions-cell">
                              <button
                                type="button"
                                className="asist-btn-actions"
                                onClick={() =>
                                  setActiveMenuId(activeMenuId === item.id_asistencia ? null : item.id_asistencia)
                                }
                                title="Acciones"
                              >
                                <FaEllipsisV />
                              </button>

                              {activeMenuId === item.id_asistencia && (
                                <div className="asist-action-menu">
                                  {item.socio && (
                                    <div
                                      className="asist-action-menu-item"
                                      onClick={() => handleVerHistorial(item.socio)}
                                    >
                                      <FaHistory /> Ver historial del socio
                                    </div>
                                  )}
                                  <div
                                    className="asist-action-menu-item delete"
                                    onClick={() => handleEliminarAsistencia(item.id_asistencia)}
                                  >
                                    <FaTrashAlt /> Eliminar asistencia
                                  </div>
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
                  {historialSocio.map((h) => {
                    const d = h.hora_ingreso ? new Date(h.hora_ingreso) : new Date();
                    return (
                      <div key={h.id_asistencia} className="asist-timeline-item">
                        <span className="asist-timeline-date">
                          {d.toLocaleDateString('es-AR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="asist-timeline-time">
                          {d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </span>
                        <span className="asist-badge-status">
                          {h.estado ? h.estado.charAt(0).toUpperCase() + h.estado.slice(1) : 'Registrada'}
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
