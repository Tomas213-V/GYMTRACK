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
  fetchCatalogoEjercicios,
  createEjercicioPersonalizado
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
  FaCheck,
  FaStar,
  FaBuilding
} from 'react-icons/fa';

import './rutinas.css';

export default function Rutinas() {
  // Identificar rol del usuario autenticado
  const rol = localStorage.getItem('rol');
  const socioLocal = JSON.parse(localStorage.getItem('socio') || 'null');
  const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || 'null');
  const esSocio = rol === 'socio' || Boolean(socioLocal) || usuarioLocal?.rol === 'socio';
  const socioIdActual = socioLocal?.id_socio || usuarioLocal?.id_socio || (esSocio ? 1 : '');

  // Listado y selección
  const [rutinas, setRutinas] = useState([]);
  const [selectedRutina, setSelectedRutina] = useState(null);
  const [loading, setLoading] = useState(true);

  // Catálogos
  const [sociosList, setSociosList] = useState([]);
  const [catalogoEjercicios, setCatalogoEjercicios] = useState([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);

  // Filtros generales
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroSocioId, setFiltroSocioId] = useState(esSocio && socioIdActual ? String(socioIdActual) : '');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Menús desplegables superiores
  const [showSocioFilterMenu, setShowSocioFilterMenu] = useState(false);
  const [showEstadoFilterMenu, setShowEstadoFilterMenu] = useState(false);
  const [activeCardMenuId, setActiveCardMenuId] = useState(null);

  // Paginación de tarjetas
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modal de Rutina (Crear / Editar)
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editingRutina, setEditingRutina] = useState(null);
  const [rutinaFormData, setRutinaFormData] = useState({
    nombre: '',
    id_socio: socioIdActual || '',
    tipo: 'Full Body',
    dificultad: 'Intermedia',
    duracion: '60 min',
    dias: 'Lunes, Miércoles, Viernes',
    notas: 'Mantener buena técnica en todos los ejercicios. Descansos de 60-90 segundos entre series.',
    estado: 'asignada'
  });

  // Ejercicios seleccionados para la rutina que se está creando/editando en el modal
  const [modalEjerciciosSeleccionados, setModalEjerciciosSeleccionados] = useState([]);
  const [modalFiltroOrigen, setModalFiltroOrigen] = useState('todos'); // 'todos' | 'gimnasio' | 'propio'
  const [modalSearchEjercicio, setModalSearchEjercicio] = useState('');

  // Modal para agregar o editar un ejercicio individual en la rutina seleccionada
  const [showEjercicioModal, setShowEjercicioModal] = useState(false);
  const [editingEjercicio, setEditingEjercicio] = useState(null);
  const [ejercicioFormData, setEjercicioFormData] = useState({
    id_ejercicio: '',
    series: 4,
    repeticiones: 12,
    peso: 0,
    descanso: 60,
    orden: 1
  });

  // Submodal para crear un nuevo ejercicio personalizado (Mi ejercicio)
  const [showCustomEjModal, setShowCustomEjModal] = useState(false);
  const [customEjFormData, setCustomEjFormData] = useState({
    nombre: '',
    grupo_muscular: 'Pecho',
    dificultad: 'Intermedia',
    descripcion: ''
  });
  const [guardandoCustomEj, setGuardandoCustomEj] = useState(false);

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

  // Cargar catálogo de ejercicios disponibles para el socio / gimnasio
  const cargarCatalogo = async (origen = 'todos') => {
    setLoadingCatalogo(true);
    try {
      const data = await fetchCatalogoEjercicios({
        id_socio: socioIdActual,
        origen: origen
      });
      setCatalogoEjercicios(data || []);
    } catch (err) {
      console.error('Error cargando catálogo de ejercicios:', err);
    } finally {
      setLoadingCatalogo(false);
    }
  };

  // Inicialización de catálogos y socios
  useEffect(() => {
    const initData = async () => {
      try {
        if (!esSocio) {
          const socRes = await fetchSocios({ limit: 'all' });
          if (socRes && socRes.socios) setSociosList(socRes.socios);
        }
        await cargarCatalogo('todos');
      } catch (err) {
        console.error('Error cargando datos iniciales:', err);
      }
    };
    initData();
  }, [esSocio, socioIdActual]);

  // Cargar Rutinas
  const loadRutinas = async (selectFirst = true) => {
    setLoading(true);
    try {
      const effectiveSocioId = esSocio ? (socioIdActual || '') : filtroSocioId;
      const data = await fetchRutinas({
        search: searchTerm,
        id_socio: effectiveSocioId,
        estado: filtroEstado
      });

      setRutinas(data || []);
      if (data && data.length > 0) {
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

  // Decodificar metadatos desde descripción JSON o valores por defecto
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

  // --------------------------------------------------------------------------
  // CREACIÓN Y EDICIÓN DE RUTINAS CON EJERCICIOS PERSONALIZADOS
  // --------------------------------------------------------------------------

  // Abrir modal de nueva rutina
  const handleOpenNuevaRutina = () => {
    setEditingRutina(null);
    setRutinaFormData({
      nombre: esSocio ? 'Mi Rutina Personalizada' : '',
      id_socio: socioIdActual || (sociosList.length > 0 ? sociosList[0].id_socio : ''),
      tipo: 'Full Body',
      dificultad: 'Intermedia',
      duracion: '60 min',
      dias: 'Lunes, Miércoles, Viernes',
      notas: 'Mantener buena técnica en todos los ejercicios. Descansos de 60-90 segundos entre series.',
      estado: 'asignada'
    });

    // Iniciar sin ejercicios preseleccionados o con catálogo fresco
    setModalEjerciciosSeleccionados([]);
    setModalFiltroOrigen('todos');
    setModalSearchEjercicio('');
    setShowRutinaModal(true);
    cargarCatalogo('todos');
  };

  // Abrir modal de edición de rutina
  const handleOpenEditRutina = (rutina) => {
    setActiveCardMenuId(null);
    setEditingRutina(rutina);
    const meta = parseDescripcion(rutina.descripcion);
    setRutinaFormData({
      nombre: rutina.nombre || '',
      id_socio: rutina.id_socio || socioIdActual || '',
      tipo: meta.tipo,
      dificultad: meta.dificultad,
      duracion: meta.duracion,
      dias: meta.dias,
      notas: meta.notas,
      estado: rutina.estado || 'asignada'
    });

    // Copiar ejercicios existentes de la rutina
    const existentes = (rutina.rutina_ejercicio || []).map((item) => ({
      id_ejercicio: item.id_ejercicio,
      nombre: item.ejercicio?.nombre || 'Ejercicio',
      grupo_muscular: item.ejercicio?.grupo_muscular || 'General',
      origen: item.origen || (item.ejercicio?.id_socio ? 'Mi ejercicio' : 'Gimnasio'),
      es_propio: Boolean(item.es_propio || item.ejercicio?.id_socio),
      series: item.series || 4,
      repeticiones: item.repeticiones || 12,
      peso: item.peso || 0,
      descanso: item.descanso || 60,
      orden: item.orden || 1
    }));

    setModalEjerciciosSeleccionados(existentes);
    setModalFiltroOrigen('todos');
    setModalSearchEjercicio('');
    setShowRutinaModal(true);
    cargarCatalogo('todos');
  };

  // Alternar selección de un ejercicio en el modal de rutina
  const handleToggleEjercicioEnModal = (ej) => {
    const yaExiste = modalEjerciciosSeleccionados.find((item) => item.id_ejercicio === ej.id_ejercicio);
    if (yaExiste) {
      setModalEjerciciosSeleccionados(
        modalEjerciciosSeleccionados.filter((item) => item.id_ejercicio !== ej.id_ejercicio)
      );
    } else {
      const nuevoItem = {
        id_ejercicio: ej.id_ejercicio,
        nombre: ej.nombre,
        grupo_muscular: ej.grupo_muscular || 'General',
        origen: ej.origen || (ej.id_socio ? 'Mi ejercicio' : 'Gimnasio'),
        es_propio: Boolean(ej.es_propio || ej.id_socio),
        series: 4,
        repeticiones: 12,
        peso: 0,
        descanso: 60,
        orden: modalEjerciciosSeleccionados.length + 1
      };
      setModalEjerciciosSeleccionados([...modalEjerciciosSeleccionados, nuevoItem]);
    }
  };

  // Actualizar parámetro de un ejercicio seleccionado dentro del modal de rutina
  const handleUpdateParamEjercicioModal = (idEj, campo, valor) => {
    setModalEjerciciosSeleccionados(
      modalEjerciciosSeleccionados.map((item) => {
        if (item.id_ejercicio === idEj) {
          return { ...item, [campo]: valor };
        }
        return item;
      })
    );
  };

  // Guardar Rutina con sus ejercicios asociados
  const handleSaveRutina = async (e) => {
    e.preventDefault();
    if (!rutinaFormData.nombre.trim()) {
      alert('El nombre de la rutina es obligatorio.');
      return;
    }

    const targetSocio = rutinaFormData.id_socio ? Number(rutinaFormData.id_socio) : (socioIdActual ? Number(socioIdActual) : null);

    const payload = {
      nombre: rutinaFormData.nombre.trim(),
      id_socio: targetSocio,
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
      let rutinaGuardada;
      if (editingRutina) {
        rutinaGuardada = await updateRutina(editingRutina.id_rutina, payload);
      } else {
        rutinaGuardada = await createRutina(payload);

        // Si se seleccionaron ejercicios durante la creación, asociarlos uno a uno
        if (rutinaGuardada?.id_rutina && modalEjerciciosSeleccionados.length > 0) {
          for (let i = 0; i < modalEjerciciosSeleccionados.length; i++) {
            const ej = modalEjerciciosSeleccionados[i];
            try {
              await addEjercicioToRutina(rutinaGuardada.id_rutina, {
                id_ejercicio: ej.id_ejercicio,
                series: Number(ej.series || 4),
                repeticiones: Number(ej.repeticiones || 12),
                peso: Number(ej.peso || 0),
                descanso: Number(ej.descanso || 60),
                orden: i + 1
              });
            } catch (asocErr) {
              console.warn('Error asociando ejercicio:', asocErr.message);
            }
          }
        }
      }

      setShowRutinaModal(false);
      await loadRutinas(true);

      // Si se acaba de crear, buscar y seleccionar la rutina recién creada
      if (rutinaGuardada?.id_rutina) {
        const fullRutina = await fetchRutinaById(rutinaGuardada.id_rutina);
        if (fullRutina) setSelectedRutina(fullRutina);
      }
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

  // --------------------------------------------------------------------------
  // CREACIÓN DE EJERCICIOS PERSONALIZADOS (MI EJERCICIO)
  // --------------------------------------------------------------------------

  const handleOpenCrearEjercicioPersonalizado = () => {
    setCustomEjFormData({
      nombre: '',
      grupo_muscular: 'Pecho',
      dificultad: 'Intermedia',
      descripcion: ''
    });
    setShowCustomEjModal(true);
  };

  const handleSaveCustomEjercicio = async (e) => {
    e.preventDefault();
    if (!customEjFormData.nombre.trim()) {
      alert('El nombre del ejercicio es obligatorio.');
      return;
    }

    setGuardandoCustomEj(true);
    try {
      const nuevoEjercicio = await createEjercicioPersonalizado({
        nombre: customEjFormData.nombre.trim(),
        grupo_muscular: customEjFormData.grupo_muscular,
        dificultad: customEjFormData.dificultad,
        descripcion: customEjFormData.descripcion ? customEjFormData.descripcion.trim() : null,
        id_socio: socioIdActual ? Number(socioIdActual) : undefined
      });

      setShowCustomEjModal(false);

      // Recargar catálogo para incluir el nuevo ejercicio
      await cargarCatalogo('todos');

      // Si el modal de rutina está abierto, seleccionarlo automáticamente
      if (showRutinaModal && nuevoEjercicio?.id_ejercicio) {
        const itemParaModal = {
          id_ejercicio: nuevoEjercicio.id_ejercicio,
          nombre: nuevoEjercicio.nombre,
          grupo_muscular: nuevoEjercicio.grupo_muscular || 'General',
          origen: 'Mi ejercicio',
          es_propio: true,
          series: 4,
          repeticiones: 12,
          peso: 0,
          descanso: 60,
          orden: modalEjerciciosSeleccionados.length + 1
        };
        setModalEjerciciosSeleccionados((prev) => [...prev, itemParaModal]);
      }

      // Si el modal de agregar ejercicio a la rutina activa está abierto, preseleccionarlo
      if (showEjercicioModal && nuevoEjercicio?.id_ejercicio) {
        setEjercicioFormData((prev) => ({
          ...prev,
          id_ejercicio: nuevoEjercicio.id_ejercicio
        }));
      }

      alert('¡Ejercicio personalizado creado con éxito!');
    } catch (err) {
      alert(err.message || 'Error al crear el ejercicio personalizado.');
    } finally {
      setGuardandoCustomEj(false);
    }
  };

  // --------------------------------------------------------------------------
  // GESTIÓN DE EJERCICIOS EN LA RUTINA ACTIVA (DETALLE DERECHO)
  // --------------------------------------------------------------------------

  // Abrir modal para agregar ejercicio a la rutina activa
  const handleOpenAddEjercicio = () => {
    if (!selectedRutina) return;
    setEditingEjercicio(null);
    const defaultEjId = catalogoEjercicios.length > 0 ? catalogoEjercicios[0].id_ejercicio : '';
    const nextOrder = (selectedRutina.rutina_ejercicio?.length || 0) + 1;
    setEjercicioFormData({
      id_ejercicio: defaultEjId,
      series: 4,
      repeticiones: 12,
      peso: 20,
      descanso: 60,
      orden: nextOrder
    });
    setShowEjercicioModal(true);
  };

  // Abrir modal para editar parámetros de un ejercicio en la rutina
  const handleOpenEditEjercicio = (item) => {
    setEditingEjercicio(item);
    setEjercicioFormData({
      id_ejercicio: item.id_ejercicio,
      series: item.series || 4,
      repeticiones: Number(item.repeticiones) || 12,
      peso: item.peso || 0,
      descanso: item.descanso || 60,
      orden: item.orden || 1
    });
    setShowEjercicioModal(true);
  };

  // Guardar ejercicio en la rutina activa
  const handleSaveEjercicio = async (e) => {
    e.preventDefault();
    if (!selectedRutina) return;

    try {
      if (editingEjercicio) {
        await updateEjercicioEnRutina(selectedRutina.id_rutina, editingEjercicio.id_rutina_ejercicio, {
          series: Number(ejercicioFormData.series),
          repeticiones: Number(ejercicioFormData.repeticiones),
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
      } else {
        await addEjercicioToRutina(selectedRutina.id_rutina, {
          id_ejercicio: Number(ejercicioFormData.id_ejercicio),
          series: Number(ejercicioFormData.series),
          repeticiones: Number(ejercicioFormData.repeticiones),
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
      }

      setShowEjercicioModal(false);
      const updated = await fetchRutinaById(selectedRutina.id_rutina);
      setSelectedRutina(updated);
      loadRutinas(false);
    } catch (err) {
      alert(err.message || 'Error al guardar el ejercicio en la rutina.');
    }
  };

  // Eliminar ejercicio de la rutina activa
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

  // Filtrado de ejercicios para el selector en el modal
  const catalogoFiltradoModal = catalogoEjercicios.filter((ej) => {
    if (modalFiltroOrigen === 'gimnasio' && ej.es_propio) return false;
    if (modalFiltroOrigen === 'propio' && !ej.es_propio) return false;
    if (modalSearchEjercicio.trim()) {
      const q = modalSearchEjercicio.toLowerCase();
      const matchName = ej.nombre?.toLowerCase().includes(q);
      const matchGroup = ej.grupo_muscular?.toLowerCase().includes(q);
      if (!matchName && !matchGroup) return false;
    }
    return true;
  });

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
                  <h1>{esSocio ? 'Mis Rutinas de Entrenamiento' : 'Gestión de Rutinas'}</h1>
                  <p>
                    {esSocio
                      ? 'Creá y personalizá tus rutinas con ejercicios del gimnasio o creados por vos'
                      : 'Gestioná las rutinas y asignación de ejercicios para todos tus socios'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="rut-btn-create-custom-ej"
                  onClick={handleOpenCrearEjercicioPersonalizado}
                  title="Crear un ejercicio propio para usar en tus rutinas"
                >
                  <FaPlus /> Crear mi ejercicio
                </button>

                <button type="button" className="rut-btn-primary" onClick={handleOpenNuevaRutina}>
                  <FaPlus /> {esSocio ? 'Crear mi rutina' : 'Nueva rutina'}
                </button>
              </div>
            </div>

            {/* Barra de Filtros */}
            <div className="rut-filters-bar">
              {/* Buscador */}
              <div className="rut-filter-box">
                <FaSearch className="rut-filter-icon" />
                <input
                  type="text"
                  className="rut-filter-input"
                  placeholder="Buscar rutina por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Selector de Socio (sólo para administradores/dueños) */}
              {!esSocio ? (
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
              ) : (
                <div className="rut-filter-box" style={{ opacity: 0.85, cursor: 'default' }}>
                  <FaUser className="rut-filter-icon" style={{ color: '#a3e635' }} />
                  <span>Socio: {socioLocal?.nombre || 'Mi Perfil'}</span>
                </div>
              )}

              {/* Selector de Estado */}
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
              <h2>{esSocio ? 'Mis Rutinas' : 'Listado de rutinas'}</h2>

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
                      {esSocio ? 'Crear mi primera rutina' : 'Crear primera rutina'}
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
                            {r.socio ? `${r.socio.nombre} ${r.socio.apellido}` : (esSocio ? 'Mi Rutina' : 'Sin socio asignado')}
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
                              : (esSocio ? 'Mi Rutina' : 'Sin socio asignado')}
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
                        <h3>Ejercicios incluidos</h3>
                        <span className="rut-badge-exercise-count">{ejerciciosDeRutina.length} ejercicios</span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="rut-btn-create-custom-ej"
                          onClick={handleOpenCrearEjercicioPersonalizado}
                        >
                          <FaPlus /> Crear mi ejercicio
                        </button>

                        <button type="button" className="rut-btn-primary" onClick={handleOpenAddEjercicio}>
                          <FaPlus /> Agregar ejercicio
                        </button>
                      </div>
                    </div>

                    <div className="rut-table-responsive">
                      <table className="rut-table">
                        <thead>
                          <tr>
                            <th>Orden</th>
                            <th>Ejercicio</th>
                            <th>Origen</th>
                            <th>Series</th>
                            <th>Reps</th>
                            <th>Peso</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ejerciciosDeRutina.length === 0 ? (
                            <tr>
                              <td colSpan="7" style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                                Aún no hay ejercicios asignados a esta rutina.
                              </td>
                            </tr>
                          ) : (
                            ejerciciosDeRutina.map((item, idx) => {
                              const ejObj = item.ejercicio || {};
                              const esPropio = Boolean(item.es_propio || ejObj.id_socio);

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
                                  <td>
                                    <span className={`rut-origin-badge ${esPropio ? 'propio' : 'gimnasio'}`}>
                                      {esPropio ? <FaUser style={{ fontSize: '9px' }} /> : <FaBuilding style={{ fontSize: '9px' }} />}
                                      {esPropio ? 'Mi ejercicio' : 'Gimnasio'}
                                    </span>
                                  </td>
                                  <td>{item.series || 4}</td>
                                  <td>{item.repeticiones || 12}</td>
                                  <td>{item.peso ? `${item.peso} kg` : '-'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      className="rut-btn-icon-action"
                                      onClick={() => handleOpenEditEjercicio(item)}
                                      title="Editar parámetros"
                                    >
                                      <FaEdit />
                                    </button>
                                    <button
                                      type="button"
                                      className="rut-btn-icon-action delete"
                                      onClick={() => handleDeleteEjercicio(item.id_rutina_ejercicio)}
                                      title="Quitar ejercicio de la rutina"
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

      {/* 3. MODAL: CREAR / EDITAR RUTINA (CON SELECTOR DE EJERCICIOS DEL GIMNASIO Y PROPIOS) */}
      {showRutinaModal && (
        <div className="rut-modal-overlay" onClick={() => setShowRutinaModal(false)}>
          <div
            className="rut-modal-card"
            style={{ maxWidth: '680px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rut-modal-header">
              <h3>{editingRutina ? 'Editar Rutina' : (esSocio ? 'Crear Mi Rutina' : 'Crear Nueva Rutina')}</h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setShowRutinaModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveRutina}>
              <div className="rut-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                <div className="rut-form-field">
                  <label>Nombre de la Rutina *</label>
                  <input
                    type="text"
                    className="rut-form-input"
                    placeholder="Ej: Rutina de Pecho"
                    value={rutinaFormData.nombre}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, nombre: e.target.value })}
                    required
                  />
                </div>

                {!esSocio && (
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
                )}

                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Tipo / Enfoque</label>
                    <select
                      className="rut-form-select"
                      value={rutinaFormData.tipo}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, tipo: e.target.value })}
                    >
                      <option value="Full Body">Full Body</option>
                      <option value="Pecho - Tríceps">Pecho - Tríceps</option>
                      <option value="Espalda - Bíceps">Espalda - Bíceps</option>
                      <option value="Piernas">Piernas</option>
                      <option value="Hombros">Hombros</option>
                      <option value="Fuerza">Fuerza</option>
                      <option value="Hipertrofia">Hipertrofia</option>
                      <option value="Definición">Definición</option>
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

                {/* SECCIÓN INTERACTIVA DE EJERCICIOS (GIMNASIO + PROPIOS) */}
                <div className="rut-exercises-selector-section">
                  <div className="rut-exercises-selector-header">
                    <h4>
                      <FaDumbbell style={{ color: '#a3e635' }} />
                      Ejercicios Disponibles ({modalEjerciciosSeleccionados.length} seleccionados)
                    </h4>

                    <button
                      type="button"
                      className="rut-btn-create-custom-ej"
                      onClick={handleOpenCrearEjercicioPersonalizado}
                    >
                      <FaPlus /> + Crear ejercicio personalizado
                    </button>
                  </div>

                  {/* Pestañas de origen de ejercicio */}
                  <div className="rut-origin-tabs">
                    <button
                      type="button"
                      className={`rut-origin-tab-btn ${modalFiltroOrigen === 'todos' ? 'active' : ''}`}
                      onClick={() => setModalFiltroOrigen('todos')}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      className={`rut-origin-tab-btn gimnasio-tab ${modalFiltroOrigen === 'gimnasio' ? 'active' : ''}`}
                      onClick={() => setModalFiltroOrigen('gimnasio')}
                    >
                      Gimnasio
                    </button>
                    <button
                      type="button"
                      className={`rut-origin-tab-btn propio-tab ${modalFiltroOrigen === 'propio' ? 'active' : ''}`}
                      onClick={() => setModalFiltroOrigen('propio')}
                    >
                      Mis ejercicios
                    </button>
                  </div>

                  {/* Buscador de ejercicio */}
                  <div className="rut-filter-box" style={{ height: '36px', marginBottom: '10px' }}>
                    <FaSearch className="rut-filter-icon" />
                    <input
                      type="text"
                      className="rut-filter-input"
                      placeholder="Filtrar por nombre o grupo muscular..."
                      value={modalSearchEjercicio}
                      onChange={(e) => setModalSearchEjercicio(e.target.value)}
                    />
                  </div>

                  {/* Lista de ejercicios con check y badge */}
                  <div className="rut-available-exercises-list">
                    {catalogoFiltradoModal.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '16px 0' }}>
                        No se encontraron ejercicios en esta categoría.
                      </p>
                    ) : (
                      catalogoFiltradoModal.map((ej) => {
                        const isChecked = modalEjerciciosSeleccionados.some(
                          (item) => item.id_ejercicio === ej.id_ejercicio
                        );

                        return (
                          <div
                            key={ej.id_ejercicio}
                            className={`rut-available-ej-item ${isChecked ? 'selected' : ''}`}
                            onClick={() => handleToggleEjercicioEnModal(ej)}
                          >
                            <div className="rut-available-ej-left">
                              <div className="rut-ej-checkbox">
                                {isChecked && <FaCheck />}
                              </div>
                              <div className="rut-available-ej-info">
                                <h5>{ej.nombre}</h5>
                                <span>{ej.grupo_muscular || 'General'}</span>
                              </div>
                            </div>

                            <span className={`rut-origin-badge ${ej.es_propio ? 'propio' : 'gimnasio'}`}>
                              {ej.es_propio ? <FaUser style={{ fontSize: '9px' }} /> : <FaBuilding style={{ fontSize: '9px' }} />}
                              {ej.es_propio ? 'Mi ejercicio' : 'Gimnasio'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Lista de parámetros de los ejercicios seleccionados */}
                  {modalEjerciciosSeleccionados.length > 0 && (
                    <div className="rut-selected-ej-stack">
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 600, color: '#a3e635' }}>
                        Detalle de series y repeticiones:
                      </p>
                      {modalEjerciciosSeleccionados.map((item, idx) => (
                        <div key={item.id_ejercicio} className="rut-selected-ej-item">
                          <div className="rut-selected-ej-meta">
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>#{idx + 1}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{item.nombre}</span>
                            <span className={`rut-origin-badge ${item.es_propio ? 'propio' : 'gimnasio'}`}>
                              {item.es_propio ? 'Mi ejercicio' : 'Gimnasio'}
                            </span>
                          </div>

                          <div className="rut-selected-ej-inputs">
                            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Series:</label>
                            <input
                              type="number"
                              min="1"
                              className="rut-selected-ej-input-sm"
                              value={item.series}
                              onChange={(e) =>
                                handleUpdateParamEjercicioModal(item.id_ejercicio, 'series', Number(e.target.value))
                              }
                            />

                            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Reps:</label>
                            <input
                              type="number"
                              min="1"
                              className="rut-selected-ej-input-sm"
                              value={item.repeticiones}
                              onChange={(e) =>
                                handleUpdateParamEjercicioModal(item.id_ejercicio, 'repeticiones', Number(e.target.value))
                              }
                            />

                            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Kg:</label>
                            <input
                              type="number"
                              min="0"
                              className="rut-selected-ej-input-sm"
                              value={item.peso}
                              onChange={(e) =>
                                handleUpdateParamEjercicioModal(item.id_ejercicio, 'peso', Number(e.target.value))
                              }
                            />

                            <button
                              type="button"
                              className="rut-btn-remove-selected-ej"
                              onClick={() => handleToggleEjercicioEnModal(item)}
                              title="Quitar"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rut-form-field" style={{ marginTop: '14px' }}>
                  <label>Notas y Recomendaciones</label>
                  <textarea
                    rows="2"
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
                  <FaCheck /> {editingRutina ? 'Guardar Cambios' : 'Guardar rutina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: AGREGAR / EDITAR EJERCICIO INDIVIDUAL EN LA RUTINA */}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label>Seleccionar Ejercicio *</label>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#bef264',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                        onClick={handleOpenCrearEjercicioPersonalizado}
                      >
                        + Crear mi ejercicio
                      </button>
                    </div>

                    <select
                      className="rut-form-select"
                      value={ejercicioFormData.id_ejercicio}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, id_ejercicio: e.target.value })}
                      required
                    >
                      <option value="">-- Elegir ejercicio disponible --</option>
                      <optgroup label="Ejercicios del Gimnasio">
                        {catalogoEjercicios
                          .filter((ej) => !ej.es_propio)
                          .map((ej) => (
                            <option key={ej.id_ejercicio} value={ej.id_ejercicio}>
                              {ej.nombre} ({ej.grupo_muscular || 'General'}) - Gimnasio
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Mis Ejercicios Personalizados">
                        {catalogoEjercicios
                          .filter((ej) => ej.es_propio)
                          .map((ej) => (
                            <option key={ej.id_ejercicio} value={ej.id_ejercicio}>
                              ⭐ {ej.nombre} ({ej.grupo_muscular || 'General'}) - Mi ejercicio
                            </option>
                          ))}
                      </optgroup>
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
                      type="number"
                      min="1"
                      className="rut-form-input"
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

      {/* 5. SUBMODAL: CREAR EJERCICIO PERSONALIZADO (MI EJERCICIO) */}
      {showCustomEjModal && (
        <div className="rut-modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowCustomEjModal(false)}>
          <div className="rut-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3>
                <FaUser style={{ color: '#a3e635', marginRight: '6px' }} />
                Crear Ejercicio Personalizado
              </h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setShowCustomEjModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveCustomEjercicio}>
              <div className="rut-modal-body">
                <div className="rut-form-field">
                  <label>Nombre del Ejercicio *</label>
                  <input
                    type="text"
                    className="rut-form-input"
                    placeholder="Ej: Curl martillo personalizado"
                    value={customEjFormData.nombre}
                    onChange={(e) => setCustomEjFormData({ ...customEjFormData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Grupo Muscular</label>
                    <select
                      className="rut-form-select"
                      value={customEjFormData.grupo_muscular}
                      onChange={(e) => setCustomEjFormData({ ...customEjFormData, grupo_muscular: e.target.value })}
                    >
                      <option value="Pecho">Pecho</option>
                      <option value="Espalda">Espalda</option>
                      <option value="Piernas">Piernas</option>
                      <option value="Brazos">Brazos</option>
                      <option value="Hombros">Hombros</option>
                      <option value="Abdomen">Abdomen</option>
                      <option value="Cardio">Cardio</option>
                      <option value="Cuerpo Completo">Cuerpo Completo</option>
                    </select>
                  </div>

                  <div className="rut-form-field">
                    <label>Dificultad</label>
                    <select
                      className="rut-form-select"
                      value={customEjFormData.dificultad}
                      onChange={(e) => setCustomEjFormData({ ...customEjFormData, dificultad: e.target.value })}
                    >
                      <option value="Principiante">Principiante</option>
                      <option value="Intermedia">Intermedia</option>
                      <option value="Avanzada">Avanzada</option>
                    </select>
                  </div>
                </div>

                <div className="rut-form-field">
                  <label>Descripción / Técnica (Opcional)</label>
                  <textarea
                    rows="3"
                    className="rut-form-textarea"
                    placeholder="Detalles sobre agarre, postura o variante..."
                    value={customEjFormData.descripcion}
                    onChange={(e) => setCustomEjFormData({ ...customEjFormData, descripcion: e.target.value })}
                  />
                </div>
              </div>

              <div className="rut-modal-footer">
                <button type="button" className="rut-btn-cancel" onClick={() => setShowCustomEjModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="rut-btn-primary" disabled={guardandoCustomEj}>
                  <FaCheck /> {guardandoCustomEj ? 'Guardando...' : 'Crear mi ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
