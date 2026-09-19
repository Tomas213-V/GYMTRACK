import React, { useState, useEffect, useRef } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar/sidebar';
import {
  fetchRutinas,
  fetchRutinaById,
  createRutina,
  updateRutina,
  deleteRutina,
  addEjercicioToRutina,
  updateEjercicioEnRutina,
  removeEjercicioFromRutina,
  fetchCatalogoEjercicios
} from '../../services/rutinaService';
import { fetchSocios } from '../../services/socioService';

import {
  FaDumbbell,
  FaSearch,
  FaUser,
  FaCalendarAlt,
  FaClock,
  FaBullseye,
  FaChartLine,
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaEllipsisV,
  FaTimes,
  FaStickyNote,
  FaListUl,
  FaArrowLeft,
  FaCheck
} from 'react-icons/fa';

import './rutinas.css';

export default function Rutinas() {
  // Listado y selección
  const [rutinas, setRutinas] = useState([]);
  const [selectedRutina, setSelectedRutina] = useState(null);
  const [loading, setLoading] = useState(true);

  // Catálogos
  const [sociosList, setSociosList] = useState([]);
  const [catalogoEjercicios, setCatalogoEjercicios] = useState([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroSocioId, setFiltroSocioId] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Menús desplegables superiores
  const [showSocioFilterMenu, setShowSocioFilterMenu] = useState(false);
  const [showEstadoFilterMenu, setShowEstadoFilterMenu] = useState(false);

  // Menú contextual en tarjeta izquierda
  const [activeCardMenuId, setActiveCardMenuId] = useState(null);

  // Paginación de tarjetas
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modales
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editingRutina, setEditingRutina] = useState(null);
  const [rutinaFormData, setRutinaFormData] = useState({
    nombre: '',
    id_socio: '',
    tipo: 'Full Body',
    dificultad: 'Intermedia',
    duracion: '60 min',
    dias: 'Lunes, Miércoles, Viernes',
    notas: 'Mantener buena técnica en todos los ejercicios. Descansos de 60-90 segundos entre series.',
    estado: 'asignada'
  });

  const [showEjercicioModal, setShowEjercicioModal] = useState(false);
  const [editingEjercicio, setEditingEjercicio] = useState(null);
  const [ejercicioFormData, setEjercicioFormData] = useState({
    id_ejercicio: '',
    series: 4,
    repeticiones: '10 - 12',
    peso: 60,
    descanso: 60,
    orden: 1
  });

  const socioRef = useRef(null);
  const estadoRef = useRef(null);
  const menuRef = useRef(null);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (socioRef.current && !socioRef.current.contains(e.target)) {
        setShowSocioFilterMenu(false);
      }
      if (estadoRef.current && !estadoRef.current.contains(e.target)) {
        setShowEstadoFilterMenu(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveCardMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar lista de socios y catálogo de ejercicios
  useEffect(() => {
    const initData = async () => {
      try {
        const [socRes, ejRes] = await Promise.all([
          fetchSocios({ limit: 'all' }),
          fetchCatalogoEjercicios()
        ]);
        if (socRes && socRes.socios) setSociosList(socRes.socios);
        if (ejRes) setCatalogoEjercicios(ejRes);
      } catch (err) {
        console.error('Error cargando catálogos:', err);
      }
    };
    initData();
  }, []);

  // Cargar Rutinas
  const loadRutinas = async (selectFirst = true) => {
    setLoading(true);
    try {
      const data = await fetchRutinas({
        search: searchTerm,
        id_socio: filtroSocioId,
        estado: filtroEstado
      });

      // Si la base de datos está vacía, proveer rutinas iniciales predeterminadas fieles a la captura
      if ((!data || data.length === 0) && !searchTerm && !filtroSocioId) {
        // Intentar crear las rutinas iniciales de demostración en segundo plano si hay socios
        const demoRutina = {
          nombre: 'Rutina Fuerza - Lunes',
          descripcion: JSON.stringify({
            tipo: 'Full Body',
            dificultad: 'Intermedia',
            duracion: '60 min',
            dias: 'Lunes, Miércoles, Viernes',
            notas: 'Mantener buena técnica en todos los ejercicios. Descansos de 60-90 segundos entre series.'
          }),
          id_socio: sociosList.length > 0 ? sociosList[0].id_socio : null,
          estado: 'asignada'
        };
        try {
          const created = await createRutina(demoRutina);
          if (created && created.id_rutina) {
            // Asociar ejercicios iniciales si hay ejercicios en el catálogo
            if (catalogoEjercicios.length > 0) {
              await addEjercicioToRutina(created.id_rutina, {
                id_ejercicio: catalogoEjercicios[0].id_ejercicio,
                series: 4,
                repeticiones: '10 - 12',
                peso: 60,
                descanso: 60,
                orden: 1
              });
            }
            const reloaded = await fetchRutinas();
            setRutinas(reloaded || []);
            if (reloaded && reloaded.length > 0 && selectFirst) {
              setSelectedRutina(reloaded[0]);
            }
            setLoading(false);
            return;
          }
        } catch {
          // Fallback a arreglo vacío
        }
      }

      setRutinas(data || []);
      if (data && data.length > 0) {
        // Mantener seleccionada la rutina actual si aún existe, sino la primera
        const currentSelectedId = selectedRutina?.id_rutina;
        const exists = data.find((r) => r.id_rutina === currentSelectedId);
        if (exists) {
          setSelectedRutina(exists);
        } else if (selectFirst) {
          setSelectedRutina(data[0]);
        }
      } else {
        setSelectedRutina(null);
      }
    } catch (err) {
      console.error('Error al cargar rutinas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRutinas();
  }, [searchTerm, filtroSocioId, filtroEstado]);

  // Decodificar metadatos desde descripcion JSON o valores por defecto
  const parseDescripcion = (desc) => {
    if (!desc) {
      return {
        tipo: 'Full Body',
        dificultad: 'Intermedia',
        duracion: '60 min',
        dias: 'Lunes, Miércoles, Viernes',
        notas: 'Mantener buena técnica en todos los ejercicios. Descansos de 60-90 segundos entre series.'
      };
    }
    try {
      const parsed = JSON.parse(desc);
      return {
        tipo: parsed.tipo || 'Full Body',
        dificultad: parsed.dificultad || 'Intermedia',
        duracion: parsed.duracion || '60 min',
        dias: parsed.dias || 'Lunes, Miércoles, Viernes',
        notas: parsed.notas || 'Mantener buena técnica en todos los ejercicios. Descansos de 60-90 segundos entre series.'
      };
    } catch {
      return {
        tipo: 'Full Body',
        dificultad: 'Intermedia',
        duracion: '60 min',
        dias: 'Lunes, Miércoles, Viernes',
        notas: desc
      };
    }
  };

  // Abrir modal de nueva rutina
  const handleOpenNuevaRutina = () => {
    setEditingRutina(null);
    setRutinaFormData({
      nombre: '',
      id_socio: sociosList.length > 0 ? sociosList[0].id_socio : '',
      tipo: 'Full Body',
      dificultad: 'Intermedia',
      duracion: '60 min',
      dias: 'Lunes, Miércoles, Viernes',
      notas: 'Mantener buena técnica en todos los ejercicios. Descansos de 60-90 segundos entre series.',
      estado: 'asignada'
    });
    setShowRutinaModal(true);
  };

  // Abrir modal de edición de rutina
  const handleOpenEditRutina = (rutina) => {
    setActiveCardMenuId(null);
    setEditingRutina(rutina);
    const meta = parseDescripcion(rutina.descripcion);
    setRutinaFormData({
      nombre: rutina.nombre || '',
      id_socio: rutina.id_socio || (sociosList.length > 0 ? sociosList[0].id_socio : ''),
      tipo: meta.tipo,
      dificultad: meta.dificultad,
      duracion: meta.duracion,
      dias: meta.dias,
      notas: meta.notas,
      estado: rutina.estado || 'asignada'
    });
    setShowRutinaModal(true);
  };

  // Guardar Rutina (Crear o Actualizar)
  const handleSaveRutina = async (e) => {
    e.preventDefault();
    if (!rutinaFormData.nombre.trim()) {
      alert('El nombre de la rutina es obligatorio.');
      return;
    }

    const payload = {
      nombre: rutinaFormData.nombre.trim(),
      id_socio: rutinaFormData.id_socio ? Number(rutinaFormData.id_socio) : null,
      estado: rutinaFormData.estado || 'asignada',
      descripcion: JSON.stringify({
        tipo: rutinaFormData.tipo,
        dificultad: rutinaFormData.dificultad,
        duracion: rutinaFormData.duracion,
        dias: rutinaFormData.dias,
        notas: rutinaFormData.notas
      })
    };

    try {
      if (editingRutina) {
        await updateRutina(editingRutina.id_rutina, payload);
      } else {
        await createRutina(payload);
      }
      setShowRutinaModal(false);
      loadRutinas();
    } catch (err) {
      alert(err.message || 'Error al guardar la rutina.');
    }
  };

  // Eliminar Rutina
  const handleDeleteRutina = async (rutinaId) => {
    setActiveCardMenuId(null);
    if (!window.confirm('¿Seguro que deseás eliminar esta rutina y todos sus ejercicios asignados?')) return;
    try {
      await deleteRutina(rutinaId);
      loadRutinas();
    } catch (err) {
      alert(err.message || 'Error al eliminar la rutina.');
    }
  };

  // Abrir modal para agregar ejercicio a la rutina
  const handleOpenAddEjercicio = () => {
    if (!selectedRutina) return;
    setEditingEjercicio(null);
    const defaultEjId = catalogoEjercicios.length > 0 ? catalogoEjercicios[0].id_ejercicio : '';
    const nextOrder = (selectedRutina.rutina_ejercicio?.length || 0) + 1;
    setEjercicioFormData({
      id_ejercicio: defaultEjId,
      series: 4,
      repeticiones: '10 - 12',
      peso: 60,
      descanso: 60,
      orden: nextOrder
    });
    setShowEjercicioModal(true);
  };

  // Abrir modal para editar ejercicio en la rutina
  const handleOpenEditEjercicio = (item) => {
    setEditingEjercicio(item);
    setEjercicioFormData({
      id_ejercicio: item.id_ejercicio,
      series: item.series || 4,
      repeticiones: item.repeticiones || '10 - 12',
      peso: item.peso || 0,
      descanso: item.descanso || 60,
      orden: item.orden || 1
    });
    setShowEjercicioModal(true);
  };

  // Guardar ejercicio en la rutina
  const handleSaveEjercicio = async (e) => {
    e.preventDefault();
    if (!selectedRutina) return;

    try {
      if (editingEjercicio) {
        await updateEjercicioEnRutina(selectedRutina.id_rutina, editingEjercicio.id_rutina_ejercicio, {
          series: Number(ejercicioFormData.series),
          repeticiones: ejercicioFormData.repeticiones,
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
      } else {
        await addEjercicioToRutina(selectedRutina.id_rutina, {
          id_ejercicio: Number(ejercicioFormData.id_ejercicio),
          series: Number(ejercicioFormData.series),
          repeticiones: ejercicioFormData.repeticiones,
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
      }

      setShowEjercicioModal(false);
      // Recargar la rutina para reflejar los cambios
      const updated = await fetchRutinaById(selectedRutina.id_rutina);
      setSelectedRutina(updated);
      loadRutinas(false);
    } catch (err) {
      alert(err.message || 'Error al guardar el ejercicio en la rutina.');
    }
  };

  // Eliminar ejercicio de la rutina
  const handleDeleteEjercicio = async (idRutinaEjercicio) => {
    if (!window.confirm('¿Seguro que deseás quitar este ejercicio de la rutina?')) return;
    try {
      await removeEjercicioFromRutina(selectedRutina.id_rutina, idRutinaEjercicio);
      const updated = await fetchRutinaById(selectedRutina.id_rutina);
      setSelectedRutina(updated);
      loadRutinas(false);
    } catch (err) {
      alert(err.message || 'Error al desvincular ejercicio.');
    }
  };

  // Metadatos de la rutina seleccionada
  const selectedMeta = selectedRutina ? parseDescripcion(selectedRutina.descripcion) : null;
  const ejerciciosDeRutina = selectedRutina?.rutina_ejercicio || [];

  // Paginación de tarjetas
  const totalCards = rutinas.length;
  const totalPages = Math.ceil(totalCards / itemsPerPage) || 1;
  const paginatedRutinas = rutinas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="rutinas-layout">
      <NavGlobal />

      <div className="rutinas-body">
        <Sidebar />

        <main className="rutinas-main-content">
          {/* 1. SECCIÓN SUPERIOR: HEADER & FILTROS */}
          <section className="rut-header-section">
            <div className="rut-header-topbar">
              <div className="rut-title-container">
                <div className="rut-title-icon-badge">
                  <FaDumbbell />
                </div>
                <div className="rut-title-texts">
                  <h1>Rutinas</h1>
                  <p>Gestioná las rutinas de entrenamiento de tus socios</p>
                </div>
              </div>

              <button type="button" className="rut-btn-primary" onClick={handleOpenNuevaRutina}>
                <FaPlus /> Nueva rutina
              </button>
            </div>

            {/* Barra de Filtros */}
            <div className="rut-filters-bar">
              {/* Buscador */}
              <div className="rut-filter-box">
                <FaSearch className="rut-filter-icon" />
                <input
                  type="text"
                  className="rut-filter-input"
                  placeholder="Buscar rutina por nombre o socio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Selector de Socio */}
              <div className="rut-filter-box" ref={socioRef}>
                <button
                  type="button"
                  className="rut-filter-dropdown-btn"
                  onClick={() => setShowSocioFilterMenu(!showSocioFilterMenu)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaUser className="rut-filter-icon" />
                    {filtroSocioId
                      ? sociosList.find((s) => s.id_socio === Number(filtroSocioId))?.nombre || 'Socio seleccionado'
                      : 'Todos los socios'}
                  </span>
                  <FaListUl className="rut-filter-icon" style={{ fontSize: '11px' }} />
                </button>

                {showSocioFilterMenu && (
                  <div className="rut-dropdown-menu">
                    <div
                      className={`rut-dropdown-item ${!filtroSocioId ? 'active' : ''}`}
                      onClick={() => {
                        setFiltroSocioId('');
                        setShowSocioFilterMenu(false);
                      }}
                    >
                      Todos los socios
                    </div>
                    {sociosList.map((s) => (
                      <div
                        key={s.id_socio}
                        className={`rut-dropdown-item ${filtroSocioId === s.id_socio.toString() ? 'active' : ''}`}
                        onClick={() => {
                          setFiltroSocioId(s.id_socio.toString());
                          setShowSocioFilterMenu(false);
                        }}
                      >
                        {s.nombre} {s.apellido}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selector de Estado / Tipo */}
              <div className="rut-filter-box" ref={estadoRef}>
                <button
                  type="button"
                  className="rut-filter-dropdown-btn"
                  onClick={() => setShowEstadoFilterMenu(!showEstadoFilterMenu)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaListUl className="rut-filter-icon" />
                    {filtroEstado === 'todos' ? 'Todas las rutinas' : filtroEstado.toUpperCase()}
                  </span>
                  <FaListUl className="rut-filter-icon" style={{ fontSize: '11px' }} />
                </button>

                {showEstadoFilterMenu && (
                  <div className="rut-dropdown-menu">
                    <div
                      className={`rut-dropdown-item ${filtroEstado === 'todos' ? 'active' : ''}`}
                      onClick={() => {
                        setFiltroEstado('todos');
                        setShowEstadoFilterMenu(false);
                      }}
                    >
                      Todas las rutinas
                    </div>
                    <div
                      className={`rut-dropdown-item ${filtroEstado === 'asignada' ? 'active' : ''}`}
                      onClick={() => {
                        setFiltroEstado('asignada');
                        setShowEstadoFilterMenu(false);
                      }}
                    >
                      Asignadas
                    </div>
                    <div
                      className={`rut-dropdown-item ${filtroEstado === 'activa' ? 'active' : ''}`}
                      onClick={() => {
                        setFiltroEstado('activa');
                        setShowEstadoFilterMenu(false);
                      }}
                    >
                      Activas
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 2. GRID MASTER-DETAIL (2 COLUMNAS) */}
          <div className="rut-master-detail-grid">
            {/* COLUMNA IZQUIERDA: LISTADO DE RUTINAS */}
            <div className="rut-card-list-panel">
              <h2>Listado de rutinas</h2>

              <div className="rut-routine-cards-stack" ref={menuRef}>
                {loading ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>Cargando rutinas...</p>
                ) : paginatedRutinas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                    <FaDumbbell style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '14px' }}>No hay rutinas registradas.</p>
                    <button
                      type="button"
                      className="rut-btn-primary"
                      style={{ margin: '14px auto 0 auto' }}
                      onClick={handleOpenNuevaRutina}
                    >
                      Crear primera rutina
                    </button>
                  </div>
                ) : (
                  paginatedRutinas.map((r) => {
                    const isSelected = selectedRutina?.id_rutina === r.id_rutina;
                    const meta = parseDescripcion(r.descripcion);
                    const cantEjercicios = r.rutina_ejercicio?.length || 0;

                    return (
                      <div
                        key={r.id_rutina}
                        className={`rut-routine-card ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedRutina(r)}
                      >
                        <div className="rut-card-thumb">
                          <FaDumbbell />
                        </div>

                        <div className="rut-card-info">
                          <h4 className="rut-card-title">{r.nombre}</h4>
                          <p className="rut-card-socio">
                            {r.socio ? `${r.socio.nombre} ${r.socio.apellido}` : 'Sin socio asignado'}
                          </p>

                          <div className="rut-card-pills-row">
                            <span className="rut-pill-category">{meta.tipo}</span>
                            <span className="rut-pill-count">{cantEjercicios} ejercicios</span>
                          </div>
                        </div>

                        <div className="rut-card-right-col">
                          <span className="rut-status-badge">{r.estado || 'Asignada'}</span>
                          <button
                            type="button"
                            className="rut-card-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCardMenuId(activeCardMenuId === r.id_rutina ? null : r.id_rutina);
                            }}
                          >
                            <FaEllipsisV />
                          </button>

                          {activeCardMenuId === r.id_rutina && (
                            <div className="rut-card-context-menu" onClick={(e) => e.stopPropagation()}>
                              <div className="rut-context-item" onClick={() => handleOpenEditRutina(r)}>
                                <FaEdit /> Editar
                              </div>
                              <div
                                className="rut-context-item delete"
                                onClick={() => handleDeleteRutina(r.id_rutina)}
                              >
                                <FaTrashAlt /> Eliminar
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Paginación de tarjetas */}
              {totalCards > 0 && (
                <div className="rut-card-list-footer">
                  <span>
                    Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalCards)} -{' '}
                    {Math.min(currentPage * itemsPerPage, totalCards)} de {totalCards} rutinas
                  </span>
                  <div className="rut-pagination-btns">
                    <button
                      type="button"
                      className="rut-page-btn"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                      <button
                        key={pg}
                        type="button"
                        className={`rut-page-btn ${currentPage === pg ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pg)}
                      >
                        {pg}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rut-page-btn"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: DETALLE DE LA RUTINA SELECCIONADA */}
            <div className="rut-detail-panel">
              {selectedRutina ? (
                <>
                  {/* Cabecera de la Rutina */}
                  <div className="rut-detail-header-card">
                    <div className="rut-detail-header-content">
                      <button
                        type="button"
                        className="rut-btn-back"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      >
                        <FaArrowLeft /> Volver
                      </button>

                      <div className="rut-detail-title-row">
                        <h2>{selectedRutina.nombre}</h2>
                        <span className="rut-status-badge">{selectedRutina.estado || 'Asignada'}</span>
                      </div>

                      <div className="rut-detail-meta-row">
                        <div className="rut-detail-meta-item">
                          <FaUser style={{ color: '#a3e635' }} />
                          <span>
                            {selectedRutina.socio
                              ? `${selectedRutina.socio.nombre} ${selectedRutina.socio.apellido}`
                              : 'Sin socio asignado'}
                          </span>
                        </div>
                        <div className="rut-detail-meta-item">
                          <FaCalendarAlt style={{ color: '#a3e635' }} />
                          <span>{selectedMeta?.dias || 'Lunes, Miércoles, Viernes'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rut-detail-banner-img">
                      <FaDumbbell />
                    </div>
                  </div>

                  {/* Card: Información General */}
                  <div className="rut-detail-info-card">
                    <div className="rut-info-card-top">
                      <h3>Información general</h3>
                      <button
                        type="button"
                        className="rut-btn-edit-general"
                        onClick={() => handleOpenEditRutina(selectedRutina)}
                      >
                        <FaEdit /> Editar
                      </button>
                    </div>

                    <div className="rut-info-metrics-grid">
                      <div className="rut-metric-box">
                        <FaBullseye className="rut-metric-icon" />
                        <div className="rut-metric-texts">
                          <p>Tipo</p>
                          <b>{selectedMeta?.tipo || 'Full Body'}</b>
                        </div>
                      </div>

                      <div className="rut-metric-box">
                        <FaChartLine className="rut-metric-icon" />
                        <div className="rut-metric-texts">
                          <p>Dificultad</p>
                          <b>{selectedMeta?.dificultad || 'Intermedia'}</b>
                        </div>
                      </div>

                      <div className="rut-metric-box">
                        <FaClock className="rut-metric-icon" />
                        <div className="rut-metric-texts">
                          <p>Duración estimada</p>
                          <b>{selectedMeta?.duracion || '60 min'}</b>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Ejercicios de la Rutina (Tabla) */}
                  <div className="rut-detail-exercises-card">
                    <div className="rut-exercises-card-header">
                      <div className="rut-exercises-card-left">
                        <h3>Ejercicios de la rutina</h3>
                        <span className="rut-badge-exercise-count">{ejerciciosDeRutina.length} ejercicios</span>
                      </div>

                      <button type="button" className="rut-btn-primary" onClick={handleOpenAddEjercicio}>
                        <FaPlus /> Agregar ejercicio
                      </button>
                    </div>

                    <div className="rut-table-responsive">
                      <table className="rut-table">
                        <thead>
                          <tr>
                            <th>Orden</th>
                            <th>Ejercicio</th>
                            <th>Series</th>
                            <th>Repeticiones</th>
                            <th>Peso</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ejerciciosDeRutina.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                                Aún no hay ejercicios asignados a esta rutina.
                              </td>
                            </tr>
                          ) : (
                            ejerciciosDeRutina.map((item, idx) => {
                              const ejObj = item.ejercicio || {};
                              return (
                                <tr key={item.id_rutina_ejercicio || idx}>
                                  <td>
                                    <div className="rut-order-badge">{item.orden || idx + 1}</div>
                                  </td>
                                  <td>
                                    <div className="rut-exercise-cell">
                                      <div className="rut-exercise-cell-thumb">
                                        <FaDumbbell />
                                      </div>
                                      <div className="rut-exercise-cell-text">
                                        <h4>{ejObj.nombre || 'Ejercicio'}</h4>
                                        <p>{ejObj.grupo_muscular || 'General'}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td>{item.series || 4}</td>
                                  <td>{item.repeticiones || '10 - 12'}</td>
                                  <td>{item.peso ? `${item.peso} kg` : '-'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      className="rut-btn-icon-action"
                                      onClick={() => handleOpenEditEjercicio(item)}
                                      title="Editar ejercicio"
                                    >
                                      <FaEdit />
                                    </button>
                                    <button
                                      type="button"
                                      className="rut-btn-icon-action delete"
                                      onClick={() => handleDeleteEjercicio(item.id_rutina_ejercicio)}
                                      title="Quitar ejercicio"
                                    >
                                      <FaTrashAlt />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Card: Notas */}
                  {selectedMeta?.notas && (
                    <div className="rut-detail-notes-card">
                      <FaStickyNote className="rut-notes-icon" />
                      <div className="rut-notes-text">
                        <b>Notas:</b> {selectedMeta.notas}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    backgroundColor: '#121824',
                    border: '1px solid #1e2738',
                    borderRadius: '12px',
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: '#64748b'
                  }}
                >
                  <FaDumbbell style={{ fontSize: '48px', marginBottom: '14px', opacity: 0.3 }} />
                  <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>Ninguna rutina seleccionada</h3>
                  <p style={{ margin: 0 }}>Seleccioná una rutina de la lista o creá una nueva para ver sus detalles.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* 3. MODAL: CREAR / EDITAR RUTINA */}
      {showRutinaModal && (
        <div className="rut-modal-overlay" onClick={() => setShowRutinaModal(false)}>
          <div className="rut-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3>{editingRutina ? 'Editar Rutina' : 'Crear Nueva Rutina'}</h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setShowRutinaModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveRutina}>
              <div className="rut-modal-body">
                <div className="rut-form-field">
                  <label>Nombre de la Rutina *</label>
                  <input
                    type="text"
                    className="rut-form-input"
                    placeholder="Ej: Rutina Fuerza - Lunes"
                    value={rutinaFormData.nombre}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="rut-form-field">
                  <label>Socio Asignado</label>
                  <select
                    className="rut-form-select"
                    value={rutinaFormData.id_socio}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, id_socio: e.target.value })}
                  >
                    <option value="">-- Sin socio asignado --</option>
                    {sociosList.map((s) => (
                      <option key={s.id_socio} value={s.id_socio}>
                        {s.nombre} {s.apellido} ({s.dni})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Tipo / Enfoque</label>
                    <select
                      className="rut-form-select"
                      value={rutinaFormData.tipo}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, tipo: e.target.value })}
                    >
                      <option value="Full Body">Full Body</option>
                      <option value="Pecho - Espalda">Pecho - Espalda</option>
                      <option value="Piernas">Piernas</option>
                      <option value="Brazos">Brazos</option>
                      <option value="Hombros">Hombros</option>
                      <option value="Definición">Definición</option>
                      <option value="Hipertrofia">Hipertrofia</option>
                      <option value="Fuerza">Fuerza</option>
                    </select>
                  </div>

                  <div className="rut-form-field">
                    <label>Dificultad</label>
                    <select
                      className="rut-form-select"
                      value={rutinaFormData.dificultad}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, dificultad: e.target.value })}
                    >
                      <option value="Principiante">Principiante</option>
                      <option value="Intermedia">Intermedia</option>
                      <option value="Avanzada">Avanzada</option>
                    </select>
                  </div>
                </div>

                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Duración Estimada</label>
                    <input
                      type="text"
                      className="rut-form-input"
                      placeholder="Ej: 60 min"
                      value={rutinaFormData.duracion}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, duracion: e.target.value })}
                    />
                  </div>

                  <div className="rut-form-field">
                    <label>Días de Entrenamiento</label>
                    <input
                      type="text"
                      className="rut-form-input"
                      placeholder="Ej: Lunes, Miércoles, Viernes"
                      value={rutinaFormData.dias}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, dias: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rut-form-field">
                  <label>Notas y Recomendaciones</label>
                  <textarea
                    rows="3"
                    className="rut-form-textarea"
                    placeholder="Instrucciones técnicas o pausas entre series..."
                    value={rutinaFormData.notas}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, notas: e.target.value })}
                  />
                </div>
              </div>

              <div className="rut-modal-footer">
                <button type="button" className="rut-btn-cancel" onClick={() => setShowRutinaModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="rut-btn-primary">
                  <FaCheck /> {editingRutina ? 'Guardar Cambios' : 'Crear Rutina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: AGREGAR / EDITAR EJERCICIO EN RUTINA */}
      {showEjercicioModal && (
        <div className="rut-modal-overlay" onClick={() => setShowEjercicioModal(false)}>
          <div className="rut-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3>{editingEjercicio ? 'Editar Ejercicio' : 'Agregar Ejercicio a la Rutina'}</h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setShowEjercicioModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveEjercicio}>
              <div className="rut-modal-body">
                {!editingEjercicio && (
                  <div className="rut-form-field">
                    <label>Seleccionar Ejercicio *</label>
                    <select
                      className="rut-form-select"
                      value={ejercicioFormData.id_ejercicio}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, id_ejercicio: e.target.value })}
                      required
                    >
                      <option value="">-- Elegir ejercicio del catálogo --</option>
                      {catalogoEjercicios.map((ej) => (
                        <option key={ej.id_ejercicio} value={ej.id_ejercicio}>
                          {ej.nombre} ({ej.grupo_muscular || 'General'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Series</label>
                    <input
                      type="number"
                      min="1"
                      className="rut-form-input"
                      value={ejercicioFormData.series}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, series: e.target.value })}
                      required
                    />
                  </div>

                  <div className="rut-form-field">
                    <label>Repeticiones</label>
                    <input
                      type="text"
                      className="rut-form-input"
                      placeholder="Ej: 10 - 12 o 15"
                      value={ejercicioFormData.repeticiones}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, repeticiones: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Peso (kg)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="rut-form-input"
                      value={ejercicioFormData.peso}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, peso: e.target.value })}
                    />
                  </div>

                  <div className="rut-form-field">
                    <label>Descanso (segundos)</label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      className="rut-form-input"
                      value={ejercicioFormData.descanso}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, descanso: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rut-form-field">
                  <label>Orden en la Rutina</label>
                  <input
                    type="number"
                    min="1"
                    className="rut-form-input"
                    value={ejercicioFormData.orden}
                    onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, orden: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="rut-modal-footer">
                <button type="button" className="rut-btn-cancel" onClick={() => setShowEjercicioModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="rut-btn-primary">
                  <FaCheck /> {editingEjercicio ? 'Actualizar Ejercicio' : 'Agregar Ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
