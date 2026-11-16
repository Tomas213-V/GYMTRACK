/**
 * =========================================================================================
 * ARCHIVO: socio-rutinas.jsx
 * RUTA: frontend/src/pages/rutinas-socio/socio-rutinas.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Módulo interactivo de Rutinas para el Socio / Alumno.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 1. PASO 1 (Rutinas Asignadas vs Plantillas del Gimnasio):
 *    - El alumno puede visualizar la rutina personalizada asignada por su profesor.
 *    - Pestaña para explorar y "adoptar" rutinas modelo creadas por el gimnasio (hipertrofia, definición, fuerza).
 * 2. PASO 2 (Modo Entrenamiento Activo):
 *    - Cronómetro de descanso entre series integrado (`FaStopwatch`).
 *    - Seguimiento de repeticiones y cargas efectivas levantadas.
 * 3. PASO 3 (Rutinas Propias):
 *    - Permite al alumno crear sus propias secuencias de ejercicios personalizadas si lo desea.
 */

import { useState, useEffect, useMemo } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import SidebarSocio from '../../components/sidebar-socio/sidebar-socio';
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
  createEjercicioPersonalizado,
  activarRutina
} from '../../services/rutinaService';

import {
  FaDumbbell,
  FaSearch,
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaCheck,
  FaTimes,
  FaPlay,
  FaStar,
  FaClock,
  FaCalendarAlt,
  FaInfoCircle,
  FaSyncAlt,
  FaBolt,
  FaLayerGroup,
  FaCrown,
  FaListUl,
  FaStopwatch
} from 'react-icons/fa';

import './socio-rutinas.css';

export default function SocioRutinas() {


  // Datos del socio desde sesión
  const socioLocal = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('socio') || localStorage.getItem('usuario') || '{}');
    } catch {
      return {};
    }
  }, []);

  const socioIdActual = socioLocal?.id_socio || 1;

  // Estados de datos
  const [misRutinas, setMisRutinas] = useState([]);
  const [catalogoEjercicios, setCatalogoEjercicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notificacion, setNotificacion] = useState('');

  // Rutina seleccionada para vista de detalle en "Mis Rutinas"
  const [selectedRutina, setSelectedRutina] = useState(null);

  // Filtros
  const [searchMisRutinas, setSearchMisRutinas] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activa' | 'asignada'

  // --------------------------------------------------------------------------
  // Modales
  // --------------------------------------------------------------------------
  // 1. Modal Crear / Editar Mi Rutina
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editingRutina, setEditingRutina] = useState(null);
  const [rutinaFormData, setRutinaFormData] = useState({
    nombre: '',
    tipo: 'Full Body',
    dificultad: 'Intermedia',
    duracion: '60 min',
    dias: 'Lunes, Miércoles, Viernes',
    notas: 'Mantener buena postura y control del peso en todas las repeticiones.',
    objetivo: 'Fuerza e hipertrofia'
  });
  const [modalEjerciciosSeleccionados, setModalEjerciciosSeleccionados] = useState([]);
  const [modalSearchEj, setModalSearchEj] = useState('');
  const [modalFiltroGrupo, setModalFiltroGrupo] = useState('todos');
  const [modalFiltroOrigen, setModalFiltroOrigen] = useState('todos'); // 'todos' | 'gimnasio' | 'propio'
  const [guardandoRutina, setGuardandoRutina] = useState(false);

  // 2. Modal Agregar Ejercicio a la Rutina Seleccionada
  const [showAddEjModal, setShowAddEjModal] = useState(false);
  const [editingEjercicioItem, setEditingEjercicioItem] = useState(null);
  const [ejercicioFormData, setEjercicioFormData] = useState({
    id_ejercicio: '',
    series: 4,
    repeticiones: 10,
    peso: 20,
    descanso: 60,
    orden: 1
  });
  const [guardandoEjercicio, setGuardandoEjercicio] = useState(false);

  // 3. Modal Crear Ejercicio Personalizado Propio
  const [showCustomEjModal, setShowCustomEjModal] = useState(false);
  const [customEjFormData, setCustomEjFormData] = useState({
    nombre: '',
    grupo_muscular: 'Pecho',
    dificultad: 'Intermedia',
    descripcion: ''
  });
  const [guardandoCustomEj, setGuardandoCustomEj] = useState(false);

  // 4. Modo Entrenamiento Interactivo (Workout Mode)
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [workoutRutina, setWorkoutRutina] = useState(null);
  const [ejerciciosCompletados, setEjerciciosCompletados] = useState({});
  const [workoutTimerSeconds, setWorkoutTimerSeconds] = useState(0);
  const [restTimerSeconds, setRestTimerSeconds] = useState(null);
  const [timerActivo, setTimerActivo] = useState(false);

  // --------------------------------------------------------------------------
  // Carga de Datos
  // --------------------------------------------------------------------------
  const showToast = (msg) => {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(''), 5000);
  };

  const parseDescripcion = (desc) => {
    if (!desc) {
      return {
        tipo: 'Full Body',
        dificultad: 'Intermedia',
        duracion: '60 min',
        dias: 'Lunes, Miércoles, Viernes',
        notas: 'Mantener buena técnica en todos los ejercicios.',
        objetivo: 'Entrenamiento general'
      };
    }
    try {
      const parsed = JSON.parse(desc);
      return {
        tipo: parsed.tipo || 'Full Body',
        dificultad: parsed.dificultad || 'Intermedia',
        duracion: parsed.duracion || '60 min',
        dias: parsed.dias || 'Lunes, Miércoles, Viernes',
        notas: parsed.notas || 'Mantener buena técnica en todos los ejercicios.',
        objetivo: parsed.objetivo || 'Entrenamiento general'
      };
    } catch {
      return {
        tipo: 'Personalizada',
        dificultad: 'Intermedia',
        duracion: '60 min',
        dias: 'Semanal',
        notas: desc,
        objetivo: 'Personalizado'
      };
    }
  };

  // Cargar mis rutinas
  const loadMisRutinas = async (preservarSeleccionId = null) => {
    try {
      setLoading(true);
      const data = await fetchRutinas({
        id_socio: socioIdActual,
        search: searchMisRutinas,
        estado: filtroEstado
      });

      const list = data || [];
      setMisRutinas(list);

      if (list.length > 0) {
        if (preservarSeleccionId) {
          const match = list.find((r) => r.id_rutina === preservarSeleccionId);
          setSelectedRutina(match || list[0]);
        } else if (selectedRutina) {
          const stillExists = list.find((r) => r.id_rutina === selectedRutina.id_rutina);
          setSelectedRutina(stillExists || list[0]);
        } else {
          // Por defecto seleccionar la activa si existe, o la primera
          const activa = list.find((r) => r.estado === 'activa');
          setSelectedRutina(activa || list[0]);
        }
      } else {
        setSelectedRutina(null);
      }
    } catch (err) {
      console.error('Error cargando rutinas del socio:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar catálogo de ejercicios para modales
  const loadCatalogo = async () => {
    try {
      const data = await fetchCatalogoEjercicios({ id_socio: socioIdActual });
      setCatalogoEjercicios(data || []);
    } catch (err) {
      console.warn('Error cargando catálogo:', err);
    }
  };

  useEffect(() => {
    loadMisRutinas();
    loadCatalogo();
  }, [searchMisRutinas, filtroEstado]);

  // --------------------------------------------------------------------------
  // Cronómetro del Modo Entrenamiento
  // --------------------------------------------------------------------------
  useEffect(() => {
    let interval = null;
    if (workoutModalOpen) {
      interval = setInterval(() => {
        setWorkoutTimerSeconds((sec) => sec + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workoutModalOpen]);

  // Temporizador de descanso
  useEffect(() => {
    let restInterval = null;
    if (timerActivo && restTimerSeconds !== null && restTimerSeconds > 0) {
      restInterval = setInterval(() => {
        setRestTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerActivo(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(restInterval);
  }, [timerActivo, restTimerSeconds]);

  const iniciarTimerDescanso = (segundos) => {
    setRestTimerSeconds(segundos);
    setTimerActivo(true);
  };

  // --------------------------------------------------------------------------
  // Métricas
  // --------------------------------------------------------------------------
  const rutinaActivaActual = useMemo(() => {
    return misRutinas.find((r) => r.estado === 'activa') || null;
  }, [misRutinas]);

  const totalEjerciciosRutinaActiva = useMemo(() => {
    return rutinaActivaActual?.rutina_ejercicio?.length || 0;
  }, [rutinaActivaActual]);

  // --------------------------------------------------------------------------
  // Acciones sobre Rutinas
  // --------------------------------------------------------------------------

  // Activar una rutina
  const handleActivarRutina = async (rutinaId) => {
    try {
      await activarRutina(rutinaId);
      showToast('¡Rutina marcada como ACTIVA! Se mostrará en tu panel principal.');
      await loadMisRutinas(rutinaId);
    } catch (err) {
      alert(err.message || 'Error al activar la rutina.');
    }
  };

  // Abrir modal de creación de rutina propia
  const handleOpenCrearRutina = () => {
    setEditingRutina(null);
    setRutinaFormData({
      nombre: '',
      tipo: 'Full Body',
      dificultad: 'Intermedia',
      duracion: '60 min',
      dias: 'Lunes, Miércoles, Viernes',
      notas: 'Realizar buen calentamiento previo y mantener buena técnica.',
      objetivo: 'Fuerza y tonificación'
    });
    setModalEjerciciosSeleccionados([]);
    setModalSearchEj('');
    setModalFiltroGrupo('todos');
    setModalFiltroOrigen('todos');
    setShowRutinaModal(true);
  };

  // Abrir modal de edición de rutina
  const handleOpenEditarRutina = (rutina) => {
    setEditingRutina(rutina);
    const meta = parseDescripcion(rutina.descripcion);
    setRutinaFormData({
      nombre: rutina.nombre || '',
      tipo: meta.tipo,
      dificultad: meta.dificultad,
      duracion: meta.duracion,
      dias: meta.dias,
      notas: meta.notas,
      objetivo: meta.objetivo
    });

    const existentes = (rutina.rutina_ejercicio || []).map((re) => ({
      id_ejercicio: re.id_ejercicio,
      nombre: re.ejercicio?.nombre || 'Ejercicio',
      grupo_muscular: re.ejercicio?.grupo_muscular || 'General',
      es_propio: Boolean(re.es_propio || re.ejercicio?.id_socio),
      series: re.series || 4,
      repeticiones: re.repeticiones || 10,
      peso: re.peso || 0,
      descanso: re.descanso || 60,
      orden: re.orden || 1
    }));

    setModalEjerciciosSeleccionados(existentes);
    setModalSearchEj('');
    setModalFiltroGrupo('todos');
    setModalFiltroOrigen('todos');
    setShowRutinaModal(true);
  };

  // Alternar selección de un ejercicio dentro del modal de rutina
  const handleToggleEjercicioModal = (ej) => {
    const yaExiste = modalEjerciciosSeleccionados.find((item) => item.id_ejercicio === ej.id_ejercicio);
    if (yaExiste) {
      setModalEjerciciosSeleccionados(
        modalEjerciciosSeleccionados.filter((item) => item.id_ejercicio !== ej.id_ejercicio)
      );
    } else {
      const nuevo = {
        id_ejercicio: ej.id_ejercicio,
        nombre: ej.nombre,
        grupo_muscular: ej.grupo_muscular || 'General',
        es_propio: Boolean(ej.es_propio || ej.id_socio),
        series: 4,
        repeticiones: 10,
        peso: 20,
        descanso: 60,
        orden: modalEjerciciosSeleccionados.length + 1
      };
      setModalEjerciciosSeleccionados([...modalEjerciciosSeleccionados, nuevo]);
    }
  };

  // Guardar Rutina (Crear o Editar)
  const handleSaveRutina = async (e) => {
    e.preventDefault();
    if (!rutinaFormData.nombre.trim()) {
      alert('Por favor, ingresá un nombre para tu rutina.');
      return;
    }

    setGuardandoRutina(true);
    try {
      const payload = {
        nombre: rutinaFormData.nombre.trim(),
        id_socio: socioIdActual,
        estado: editingRutina ? editingRutina.estado : (misRutinas.length === 0 ? 'activa' : 'asignada'),
        descripcion: JSON.stringify({
          tipo: rutinaFormData.tipo,
          dificultad: rutinaFormData.dificultad,
          duracion: rutinaFormData.duracion,
          dias: rutinaFormData.dias,
          notas: rutinaFormData.notas,
          objetivo: rutinaFormData.objetivo
        })
      };

      let resRutina;
      if (editingRutina) {
        resRutina = await updateRutina(editingRutina.id_rutina, payload);
        showToast('¡Rutina actualizada con éxito!');
      } else {
        resRutina = await createRutina(payload);

        // Asociar ejercicios seleccionados
        if (resRutina?.id_rutina && modalEjerciciosSeleccionados.length > 0) {
          for (let i = 0; i < modalEjerciciosSeleccionados.length; i++) {
            const ej = modalEjerciciosSeleccionados[i];
            try {
              await addEjercicioToRutina(resRutina.id_rutina, {
                id_ejercicio: ej.id_ejercicio,
                series: Number(ej.series || 4),
                repeticiones: Number(ej.repeticiones || 10),
                peso: Number(ej.peso || 0),
                descanso: Number(ej.descanso || 60),
                orden: i + 1
              });
            } catch (errAsoc) {
              console.warn('Error asociando ejercicio:', errAsoc);
            }
          }
        }
        showToast('¡Tu nueva rutina fue creada con éxito!');
      }

      setShowRutinaModal(false);
      await loadMisRutinas(resRutina?.id_rutina);
    } catch (err) {
      alert(err.message || 'Error al guardar la rutina.');
    } finally {
      setGuardandoRutina(false);
    }
  };

  // Eliminar Rutina
  const handleDeleteRutina = async (rutina) => {
    if (!window.confirm(`¿Seguro que deseás eliminar tu rutina "${rutina.nombre}"?`)) return;
    try {
      await deleteRutina(rutina.id_rutina);
      showToast(`Rutina "${rutina.nombre}" eliminada.`);
      await loadMisRutinas();
    } catch (err) {
      alert(err.message || 'Error al eliminar la rutina.');
    }
  };

  // --------------------------------------------------------------------------
  // Gestión de Ejercicios en la Rutina Seleccionada
  // --------------------------------------------------------------------------
  const handleOpenAddEjercicio = () => {
    if (!selectedRutina) return;
    setEditingEjercicioItem(null);
    const primerEjId = catalogoEjercicios.length > 0 ? catalogoEjercicios[0].id_ejercicio : '';
    setEjercicioFormData({
      id_ejercicio: primerEjId,
      series: 4,
      repeticiones: 10,
      peso: 20,
      descanso: 60,
      orden: (selectedRutina.rutina_ejercicio?.length || 0) + 1
    });
    setShowAddEjModal(true);
  };

  const handleOpenEditEjercicio = (item) => {
    setEditingEjercicioItem(item);
    setEjercicioFormData({
      id_ejercicio: item.id_ejercicio,
      series: item.series || 4,
      repeticiones: item.repeticiones || 10,
      peso: item.peso || 0,
      descanso: item.descanso || 60,
      orden: item.orden || 1
    });
    setShowAddEjModal(true);
  };

  const handleSaveEjercicioEnRutina = async (e) => {
    e.preventDefault();
    if (!selectedRutina) return;

    setGuardandoEjercicio(true);
    try {
      if (editingEjercicioItem) {
        await updateEjercicioEnRutina(selectedRutina.id_rutina, editingEjercicioItem.id_rutina_ejercicio, {
          series: Number(ejercicioFormData.series),
          repeticiones: Number(ejercicioFormData.repeticiones),
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
        showToast('Parámetros de ejercicio actualizados.');
      } else {
        await addEjercicioToRutina(selectedRutina.id_rutina, {
          id_ejercicio: Number(ejercicioFormData.id_ejercicio),
          series: Number(ejercicioFormData.series),
          repeticiones: Number(ejercicioFormData.repeticiones),
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
        showToast('¡Ejercicio agregado a la rutina!');
      }

      setShowAddEjModal(false);
      const updated = await fetchRutinaById(selectedRutina.id_rutina);
      setSelectedRutina(updated);
      loadMisRutinas(selectedRutina.id_rutina);
    } catch (err) {
      alert(err.message || 'Error al guardar el ejercicio en la rutina.');
    } finally {
      setGuardandoEjercicio(false);
    }
  };

  const handleDeleteEjercicioDeRutina = async (item) => {
    if (!window.confirm(`¿Quitar "${item.ejercicio?.nombre || 'este ejercicio'}" de la rutina?`)) return;
    try {
      await removeEjercicioFromRutina(selectedRutina.id_rutina, item.id_rutina_ejercicio);
      showToast('Ejercicio quitado de la rutina.');
      const updated = await fetchRutinaById(selectedRutina.id_rutina);
      setSelectedRutina(updated);
      loadMisRutinas(selectedRutina.id_rutina);
    } catch (err) {
      alert(err.message || 'Error al quitar el ejercicio.');
    }
  };

  // Crear Ejercicio Propio
  const handleOpenCrearEjercicioPropio = () => {
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
      alert('Ingresá el nombre del ejercicio.');
      return;
    }

    setGuardandoCustomEj(true);
    try {
      const nuevo = await createEjercicioPersonalizado({
        ...customEjFormData,
        id_socio: socioIdActual
      });

      showToast(`¡Ejercicio "${nuevo.nombre}" creado exitosamente!`);
      setShowCustomEjModal(false);
      await loadCatalogo();

      // Si el modal de rutina está abierto, seleccionarlo
      if (showRutinaModal && nuevo?.id_ejercicio) {
        setModalEjerciciosSeleccionados((prev) => [
          ...prev,
          {
            id_ejercicio: nuevo.id_ejercicio,
            nombre: nuevo.nombre,
            grupo_muscular: nuevo.grupo_muscular,
            es_propio: true,
            series: 4,
            repeticiones: 10,
            peso: 0,
            descanso: 60,
            orden: prev.length + 1
          }
        ]);
      }
    } catch (err) {
      alert(err.message || 'Error al crear el ejercicio.');
    } finally {
      setGuardandoCustomEj(false);
    }
  };

  // Iniciar Modo Entrenamiento
  const handleIniciarEntrenamiento = (rutina) => {
    setWorkoutRutina(rutina);
    setEjerciciosCompletados({});
    setWorkoutTimerSeconds(0);
    setWorkoutModalOpen(true);
    setRestTimerSeconds(null);
    setTimerActivo(false);
  };

  // Cerrar Modo Entrenamiento
  const handleCerrarEntrenamiento = () => {
    setWorkoutModalOpen(false);
    setTimerActivo(false);
    setRestTimerSeconds(null);
  };

  const toggleEjercicioCompletado = (idRe, descansoSegundos = 60) => {
    const estaCompletado = Boolean(ejerciciosCompletados[idRe]);
    setEjerciciosCompletados((prev) => ({
      ...prev,
      [idRe]: !estaCompletado
    }));

    if (!estaCompletado) {
      iniciarTimerDescanso(Number(descansoSegundos) || 60);
    }
  };

  // Formato para segundos en reloj
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Filtros del catálogo para el modal de rutina
  const catalogoFiltradoModal = catalogoEjercicios.filter((ej) => {
    if (modalFiltroOrigen === 'gimnasio' && ej.es_propio) return false;
    if (modalFiltroOrigen === 'propio' && !ej.es_propio) return false;
    if (modalFiltroGrupo !== 'todos' && ej.grupo_muscular !== modalFiltroGrupo) return false;
    if (modalSearchEj.trim()) {
      const q = modalSearchEj.toLowerCase();
      const matchName = ej.nombre?.toLowerCase().includes(q);
      const matchGroup = ej.grupo_muscular?.toLowerCase().includes(q);
      if (!matchName && !matchGroup) return false;
    }
    return true;
  });

  const selectedMeta = selectedRutina ? parseDescripcion(selectedRutina.descripcion) : null;
  const ejerciciosDeRutina = selectedRutina?.rutina_ejercicio || [];

  return (
    <div className="sr-page-layout">
      <NavGlobal />

      <div className="sr-body-container">
        <SidebarSocio />

        <main className="sr-main-area">
          {/* TOAST / ALERTA DE NOTIFICACIÓN */}
          {notificacion && (
            <div className="sr-alert-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaCheck />
                <span>{notificacion}</span>
              </div>
              <button onClick={() => setNotificacion('')} className="sr-alert-close">
                <FaTimes />
              </button>
            </div>
          )}

          {/* ================================================================
              1. HERO HEADER
              ================================================================ */}
          <section className="sr-header-section">
            <div className="sr-header-topbar">
              <div className="sr-title-wrap">
                <div className="sr-title-badge-icon">
                  <FaDumbbell />
                </div>
                <div>
                  <h1>Panel de Rutinas de Entrenamiento</h1>
                  <p>
                    Gestioná las rutinas asignadas por tu gimnasio o creá tus propias rutinas a medida y llevá el registro de cada entrenamiento.
                  </p>
                </div>
              </div>

              <div className="sr-header-actions">
                <button
                  type="button"
                  className="sr-btn-custom-ej"
                  onClick={handleOpenCrearEjercicioPropio}
                  title="Crear un nuevo ejercicio que no esté en el catálogo"
                >
                  <FaPlus /> Crear mi ejercicio
                </button>

                <button
                  type="button"
                  className="sr-btn-primary"
                  onClick={handleOpenCrearRutina}
                >
                  <FaPlus /> Crear mi rutina
                </button>
              </div>
            </div>

            {/* TARJETAS DE MÉTRICAS RÁPIDAS */}
            <div className="sr-metrics-grid">
              <div className="sr-metric-card">
                <div className="sr-metric-icon-wrap" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                  <FaDumbbell />
                </div>
                <div className="sr-metric-data">
                  <h3>{misRutinas.length}</h3>
                  <p>Mis Rutinas Guardadas</p>
                </div>
              </div>

              <div className="sr-metric-card">
                <div className="sr-metric-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <FaCrown />
                </div>
                <div className="sr-metric-data">
                  <h3 style={{ fontSize: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rutinaActivaActual ? rutinaActivaActual.nombre : 'Ninguna activa'}
                  </h3>
                  <p>Rutina Activa Hoy</p>
                </div>
              </div>

              <div className="sr-metric-card">
                <div className="sr-metric-icon-wrap" style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}>
                  <FaLayerGroup />
                </div>
                <div className="sr-metric-data">
                  <h3>{totalEjerciciosRutinaActiva}</h3>
                  <p>Ejercicios en Rutina Activa</p>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================
              2. MIS RUTINAS (ASIGNADAS POR EL GIMNASIO Y PROPIAS)
              ================================================================ */}
          <div className="sr-tab-content">
              {/* Barra de Filtros para Mis Rutinas */}
              <div className="sr-filters-bar">
                <div className="sr-search-box">
                  <FaSearch style={{ color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Buscar entre mis rutinas..."
                    value={searchMisRutinas}
                    onChange={(e) => setSearchMisRutinas(e.target.value)}
                  />
                </div>

                <div className="sr-filter-select-wrap">
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Estado:</span>
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="sr-select-filter"
                  >
                    <option value="todos">Todas las rutinas</option>
                    <option value="activa">Solo activa</option>
                    <option value="asignada">Asignadas</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="sr-btn-refresh"
                  onClick={() => loadMisRutinas()}
                  title="Refrescar rutinas"
                >
                  <FaSyncAlt />
                </button>
              </div>

              {/* Grid Maestro-Detalle (Izquierda: Rutinas, Derecha: Detalle de Ejercicios) */}
              <div className="sr-master-detail-grid">
                
                {/* COLUMNA IZQUIERDA: LISTA DE RUTINAS */}
                <div className="sr-left-panel">
                  <div className="sr-panel-header">
                    <h2>Mis Rutinas Registradas</h2>
                    <span className="sr-count-pill">{misRutinas.length}</span>
                  </div>

                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                      <p>Cargando tus rutinas...</p>
                    </div>
                  ) : misRutinas.length === 0 ? (
                    <div className="sr-empty-card">
                      <FaDumbbell style={{ fontSize: '42px', opacity: 0.3, marginBottom: '12px' }} />
                      <h3>No tenés rutinas registradas aún</h3>
                      <p>
                        Cuando tu gimnasio te asigne una rutina o cuando crees una propia, aparecerá aquí.
                      </p>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'center' }}>
                        <button type="button" className="sr-btn-primary" onClick={handleOpenCrearRutina}>
                          <FaPlus /> Crear mi primera rutina
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="sr-cards-stack">
                      {misRutinas.map((r) => {
                        const isSelected = selectedRutina?.id_rutina === r.id_rutina;
                        const esActiva = r.estado === 'activa';
                        const meta = parseDescripcion(r.descripcion);
                        const cantEjercicios = r.rutina_ejercicio?.length || 0;

                        return (
                          <div
                            key={r.id_rutina}
                            className={`sr-routine-card ${isSelected ? 'selected' : ''} ${esActiva ? 'is-active-card' : ''}`}
                            onClick={() => setSelectedRutina(r)}
                          >
                            <div className="sr-routine-card-top">
                              <div className="sr-routine-card-icon">
                                <FaDumbbell />
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <h4 className="sr-routine-card-title">{r.nombre}</h4>
                                  {esActiva && (
                                    <span className="sr-badge-activa">
                                      <FaBolt style={{ fontSize: '10px' }} /> ACTIVA HOY
                                    </span>
                                  )}
                                </div>
                                <p className="sr-routine-card-type">{meta.tipo} • {meta.dificultad}</p>
                              </div>
                            </div>

                            <div className="sr-routine-card-details">
                              <div className="sr-detail-item">
                                <FaCalendarAlt style={{ color: '#22c55e' }} />
                                <span>{meta.dias}</span>
                              </div>
                              <div className="sr-detail-item">
                                <FaClock style={{ color: '#38bdf8' }} />
                                <span>{meta.duracion}</span>
                              </div>
                              <div className="sr-detail-item">
                                <FaListUl style={{ color: '#c084fc' }} />
                                <span>{cantEjercicios} ejercicios</span>
                              </div>
                            </div>

                            <div className="sr-routine-card-actions">
                              {/* Botón Entrenar Ahora */}
                              <button
                                type="button"
                                className="sr-btn-card-action train"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIniciarEntrenamiento(r);
                                }}
                                title="Abrir modo entrenamiento guiado para hoy"
                              >
                                <FaPlay style={{ fontSize: '10px' }} /> Entrenar
                              </button>

                              {/* Botón Activar (si no es la activa) */}
                              {!esActiva && (
                                <button
                                  type="button"
                                  className="sr-btn-card-action activate"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleActivarRutina(r.id_rutina);
                                  }}
                                  title="Establecer como rutina activa principal"
                                >
                                  <FaBolt style={{ fontSize: '11px' }} /> Activar
                                </button>
                              )}

                              <button
                                type="button"
                                className="sr-btn-card-icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditarRutina(r);
                                }}
                                title="Editar rutina"
                              >
                                <FaEdit />
                              </button>

                              <button
                                type="button"
                                className="sr-btn-card-icon delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRutina(r);
                                }}
                                title="Eliminar rutina"
                              >
                                <FaTrashAlt />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* COLUMNA DERECHA: DETALLE COMPLETO DE EJERCICIOS */}
                <div className="sr-right-panel">
                  {selectedRutina ? (
                    <div>
                      {/* Banner de la Rutina Seleccionada */}
                      <div className="sr-detail-header-card">
                        <div className="sr-detail-header-top">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <h2>{selectedRutina.nombre}</h2>
                              {selectedRutina.estado === 'activa' ? (
                                <span className="sr-badge-activa">
                                  <FaBolt style={{ fontSize: '10px' }} /> RUTINA ACTIVA
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="sr-btn-make-active"
                                  onClick={() => handleActivarRutina(selectedRutina.id_rutina)}
                                >
                                  <FaBolt /> Establecer como Activa
                                </button>
                              )}
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: '6px 0 0 0' }}>
                              {selectedMeta?.objetivo || 'Plan de entrenamiento personalizado'}
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="sr-btn-primary"
                              onClick={() => handleIniciarEntrenamiento(selectedRutina)}
                            >
                              <FaPlay /> Iniciar Entrenamiento
                            </button>
                            <button
                              type="button"
                              className="sr-btn-secondary"
                              onClick={handleOpenAddEjercicio}
                            >
                              <FaPlus /> Agregar Ejercicio
                            </button>
                            <button
                              type="button"
                              className="sr-btn-close-detail"
                              onClick={() => setSelectedRutina(null)}
                              title="Cerrar panel de rutina"
                            >
                              <FaTimes /> Cerrar
                            </button>
                          </div>
                        </div>

                        {/* Metadatos en Fila */}
                        <div className="sr-detail-pills-row">
                          <span className="sr-meta-pill">
                            <strong>Tipo:</strong> {selectedMeta?.tipo}
                          </span>
                          <span className="sr-meta-pill">
                            <strong>Nivel:</strong> {selectedMeta?.dificultad}
                          </span>
                          <span className="sr-meta-pill">
                            <strong>Días:</strong> {selectedMeta?.dias}
                          </span>
                          <span className="sr-meta-pill">
                            <strong>Duración:</strong> {selectedMeta?.duracion}
                          </span>
                        </div>

                        {selectedMeta?.notas && (
                          <div className="sr-detail-notes-box">
                            <FaInfoCircle style={{ color: '#38bdf8', marginTop: '3px', flexShrink: 0 }} />
                            <span>{selectedMeta.notas}</span>
                          </div>
                        )}
                      </div>

                      {/* Lista de Ejercicios */}
                      <div className="sr-exercises-section">
                        <div className="sr-section-title-row">
                          <h3>Ejercicios Asignados ({ejerciciosDeRutina.length})</h3>
                          <button
                            type="button"
                            className="sr-link-btn"
                            onClick={handleOpenAddEjercicio}
                          >
                            + Sumar ejercicio
                          </button>
                        </div>

                        {ejerciciosDeRutina.length === 0 ? (
                          <div className="sr-empty-exercises">
                            <FaDumbbell style={{ fontSize: '30px', opacity: 0.3 }} />
                            <p>Esta rutina no tiene ejercicios agregados todavía.</p>
                            <button
                              type="button"
                              className="sr-btn-primary"
                              onClick={handleOpenAddEjercicio}
                            >
                              <FaPlus /> Agregar primer ejercicio
                            </button>
                          </div>
                        ) : (
                          <div className="sr-exercise-items-list">
                            {ejerciciosDeRutina.map((item, index) => {
                              const ej = item.ejercicio || {};
                              const esPropio = Boolean(item.es_propio || ej.id_socio);

                              return (
                                <div key={item.id_rutina_ejercicio || index} className="sr-exercise-item-card">
                                  <div className="sr-exercise-order-badge">
                                    {index + 1}
                                  </div>

                                  <div className="sr-exercise-item-info">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <h4>{ej.nombre || 'Ejercicio'}</h4>
                                      <span className={`sr-tag-origen ${esPropio ? 'propio' : 'gimnasio'}`}>
                                        {esPropio ? 'Mi ejercicio' : 'Gym oficial'}
                                      </span>
                                    </div>
                                    <p className="sr-exercise-item-muscle">
                                      {ej.grupo_muscular || 'Musculación'} • {ej.dificultad || 'Intermedia'}
                                    </p>
                                  </div>

                                  <div className="sr-exercise-stats-box">
                                    <div className="sr-stat-col">
                                      <span className="label">Series × Reps</span>
                                      <span className="value">{item.series || 4} × {item.repeticiones || 10}</span>
                                    </div>
                                    <div className="sr-stat-col">
                                      <span className="label">Carga</span>
                                      <span className="value">{item.peso && item.peso > 0 ? `${item.peso} kg` : 'Corporal'}</span>
                                    </div>
                                    <div className="sr-stat-col">
                                      <span className="label">Descanso</span>
                                      <span className="value">{item.descanso || 60}s</span>
                                    </div>
                                  </div>

                                  <div className="sr-exercise-item-actions">
                                    <button
                                      type="button"
                                      className="sr-btn-card-icon"
                                      onClick={() => handleOpenEditEjercicio(item)}
                                      title="Editar series, repeticiones o peso"
                                    >
                                      <FaEdit />
                                    </button>
                                    <button
                                      type="button"
                                      className="sr-btn-card-icon delete"
                                      onClick={() => handleDeleteEjercicioDeRutina(item)}
                                      title="Quitar de la rutina"
                                    >
                                      <FaTrashAlt />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="sr-no-selection">
                      <FaDumbbell style={{ fontSize: '48px', opacity: 0.3, marginBottom: '14px' }} />
                      <h3>Seleccioná una rutina</h3>
                      <p>Hacé clic en cualquier rutina del listado izquierdo para ver y gestionar sus ejercicios.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
        </main>
      </div>

      {/* ================================================================
          MODAL 1: CREAR / EDITAR MI RUTINA
          ================================================================ */}
      {showRutinaModal && (
        <div className="sr-modal-overlay" onClick={() => setShowRutinaModal(false)}>
          <div className="sr-modal-card large" onClick={(e) => e.stopPropagation()}>
            <div className="sr-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaDumbbell style={{ color: '#22c55e' }} />
                <h3>{editingRutina ? 'Editar Mi Rutina' : 'Crear Mi Rutina Personalizada'}</h3>
              </div>
              <button type="button" className="sr-modal-close-btn" onClick={() => setShowRutinaModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveRutina}>
              <div className="sr-modal-body">
                {/* Campos Básicos */}
                <div className="sr-form-grid-2">
                  <div className="sr-form-field">
                    <label>Nombre de la Rutina *</label>
                    <input
                      type="text"
                      className="sr-form-input"
                      placeholder="Ej: Piernas & Core Potente"
                      value={rutinaFormData.nombre}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, nombre: e.target.value })}
                      required
                    />
                  </div>

                  <div className="sr-form-field">
                    <label>Tipo / División</label>
                    <select
                      className="sr-form-select"
                      value={rutinaFormData.tipo}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, tipo: e.target.value })}
                    >
                      <option value="Full Body">Full Body (Cuerpo Completo)</option>
                      <option value="Torso - Pierna">Torso - Pierna</option>
                      <option value="Push - Pull - Legs">Push - Pull - Legs (Empuje / Jalón / Pierna)</option>
                      <option value="Tren Superior">Tren Superior</option>
                      <option value="Tren Inferior & Glúteos">Tren Inferior & Glúteos</option>
                      <option value="Fuerza 5x5">Fuerza 5×5</option>
                      <option value="Funcional & HIIT">Funcional & HIIT</option>
                      <option value="Personalizada">Personalizada</option>
                    </select>
                  </div>
                </div>

                <div className="sr-form-grid-3">
                  <div className="sr-form-field">
                    <label>Dificultad</label>
                    <select
                      className="sr-form-select"
                      value={rutinaFormData.dificultad}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, dificultad: e.target.value })}
                    >
                      <option value="Principiante">Principiante</option>
                      <option value="Intermedia">Intermedia</option>
                      <option value="Avanzada">Avanzada</option>
                    </select>
                  </div>

                  <div className="sr-form-field">
                    <label>Duración Estimada</label>
                    <input
                      type="text"
                      className="sr-form-input"
                      placeholder="Ej: 60 min"
                      value={rutinaFormData.duracion}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, duracion: e.target.value })}
                    />
                  </div>

                  <div className="sr-form-field">
                    <label>Días Sugeridos</label>
                    <input
                      type="text"
                      className="sr-form-input"
                      placeholder="Ej: Lun, Mié, Vie"
                      value={rutinaFormData.dias}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, dias: e.target.value })}
                    />
                  </div>
                </div>

                <div className="sr-form-field">
                  <label>Objetivo Principal</label>
                  <input
                    type="text"
                    className="sr-form-input"
                    placeholder="Ej: Hipertrofia y aumento de fuerza en tren superior"
                    value={rutinaFormData.objetivo}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, objetivo: e.target.value })}
                  />
                </div>

                <div className="sr-form-field">
                  <label>Notas Técnicas / Consejos de Descanso</label>
                  <textarea
                    rows="2"
                    className="sr-form-textarea"
                    placeholder="Instrucciones sobre descansos, técnica o cuidados..."
                    value={rutinaFormData.notas}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, notas: e.target.value })}
                  />
                </div>

                {/* SELECTOR DE EJERCICIOS PARA LA RUTINA (Solo si es nueva o quiere editar selección) */}
                {!editingRutina && (
                  <div className="sr-modal-exercises-selector">
                    <div className="sr-selector-header">
                      <div>
                        <h4>Seleccioná los ejercicios para tu rutina</h4>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8' }}>
                          Podés elegir del catálogo del gimnasio o de tus propios ejercicios ({modalEjerciciosSeleccionados.length} seleccionados)
                        </p>
                      </div>

                      <button
                        type="button"
                        className="sr-btn-custom-ej-sm"
                        onClick={handleOpenCrearEjercicioPropio}
                      >
                        <FaPlus /> Crear mi ejercicio
                      </button>
                    </div>

                    {/* Barra de filtros del selector */}
                    <div className="sr-selector-filter-row">
                      <div className="sr-search-box-sm">
                        <FaSearch style={{ color: '#64748b' }} />
                        <input
                          type="text"
                          placeholder="Buscar ejercicio..."
                          value={modalSearchEj}
                          onChange={(e) => setModalSearchEj(e.target.value)}
                        />
                      </div>

                      <select
                        className="sr-select-filter-sm"
                        value={modalFiltroGrupo}
                        onChange={(e) => setModalFiltroGrupo(e.target.value)}
                      >
                        <option value="todos">Todos los músculos</option>
                        <option value="Pecho">Pecho</option>
                        <option value="Espalda">Espalda</option>
                        <option value="Piernas">Piernas</option>
                        <option value="Hombros">Hombros</option>
                        <option value="Brazos">Brazos</option>
                        <option value="Abdomen">Abdomen</option>
                      </select>

                      <select
                        className="sr-select-filter-sm"
                        value={modalFiltroOrigen}
                        onChange={(e) => setModalFiltroOrigen(e.target.value)}
                      >
                        <option value="todos">Todos los orígenes</option>
                        <option value="gimnasio">Gimnasio Oficial</option>
                        <option value="propio">Mis Ejercicios</option>
                      </select>
                    </div>

                    {/* Lista con Checkbox de Ejercicios */}
                    <div className="sr-selector-list">
                      {catalogoFiltradoModal.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                          No hay ejercicios que coincidan con la búsqueda.
                        </p>
                      ) : (
                        catalogoFiltradoModal.map((ej) => {
                          const isSelected = modalEjerciciosSeleccionados.some(
                            (item) => item.id_ejercicio === ej.id_ejercicio
                          );

                          return (
                            <div
                              key={ej.id_ejercicio}
                              className={`sr-selector-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleToggleEjercicioModal(ej)}
                            >
                              <div className="sr-selector-checkbox">
                                {isSelected ? <FaCheck /> : null}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="sr-item-name">{ej.nombre}</span>
                                  <span className={`sr-tag-origen-sm ${ej.es_propio ? 'propio' : 'gym'}`}>
                                    {ej.es_propio ? 'Propio' : 'Gym'}
                                  </span>
                                </div>
                                <span className="sr-item-muscle">{ej.grupo_muscular} • {ej.dificultad}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="sr-modal-footer">
                <button type="button" className="sr-btn-cancel" onClick={() => setShowRutinaModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="sr-btn-primary" disabled={guardandoRutina}>
                  <FaCheck /> {guardandoRutina ? 'Guardando...' : (editingRutina ? 'Guardar Cambios' : 'Crear Rutina')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL 2: AGREGAR / EDITAR EJERCICIO EN RUTINA SELECCIONADA
          ================================================================ */}
      {showAddEjModal && (
        <div className="sr-modal-overlay" onClick={() => setShowAddEjModal(false)}>
          <div className="sr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sr-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaDumbbell style={{ color: '#22c55e' }} />
                <h3>{editingEjercicioItem ? 'Modificar Parámetros de Ejercicio' : 'Agregar Ejercicio a la Rutina'}</h3>
              </div>
              <button type="button" className="sr-modal-close-btn" onClick={() => setShowAddEjModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveEjercicioEnRutina}>
              <div className="sr-modal-body">
                {!editingEjercicioItem && (
                  <div className="sr-form-field">
                    <label>Seleccionar Ejercicio *</label>
                    <select
                      className="sr-form-select"
                      value={ejercicioFormData.id_ejercicio}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, id_ejercicio: e.target.value })}
                      required
                    >
                      <option value="">-- Elegí un ejercicio del catálogo --</option>
                      {catalogoEjercicios.map((ej) => (
                        <option key={ej.id_ejercicio} value={ej.id_ejercicio}>
                          {ej.nombre} ({ej.grupo_muscular}) {ej.es_propio ? '★ Mi ejercicio' : '• Gym'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="sr-form-grid-2">
                  <div className="sr-form-field">
                    <label>Series (Sets)</label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      className="sr-form-input"
                      value={ejercicioFormData.series}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, series: e.target.value })}
                      required
                    />
                  </div>

                  <div className="sr-form-field">
                    <label>Repeticiones (Reps)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="sr-form-input"
                      value={ejercicioFormData.repeticiones}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, repeticiones: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="sr-form-grid-2">
                  <div className="sr-form-field">
                    <label>Peso / Carga sugerida (kg)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="sr-form-input"
                      value={ejercicioFormData.peso}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, peso: e.target.value })}
                    />
                    <small style={{ color: '#64748b', fontSize: '11px' }}>Ingresá 0 para peso corporal</small>
                  </div>

                  <div className="sr-form-field">
                    <label>Descanso entre series (segundos)</label>
                    <input
                      type="number"
                      min="15"
                      step="5"
                      className="sr-form-input"
                      value={ejercicioFormData.descanso}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, descanso: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="sr-modal-footer">
                <button type="button" className="sr-btn-cancel" onClick={() => setShowAddEjModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="sr-btn-primary" disabled={guardandoEjercicio}>
                  <FaCheck /> {guardandoEjercicio ? 'Guardando...' : 'Guardar en Rutina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL 3: CREAR EJERCICIO PERSONALIZADO PROPIO
          ================================================================ */}
      {showCustomEjModal && (
        <div className="sr-modal-overlay" onClick={() => setShowCustomEjModal(false)}>
          <div className="sr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sr-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaStar style={{ color: '#a3e635' }} />
                <h3>Crear Mi Propio Ejercicio</h3>
              </div>
              <button type="button" className="sr-modal-close-btn" onClick={() => setShowCustomEjModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveCustomEjercicio}>
              <div className="sr-modal-body">
                <div className="sr-form-field">
                  <label>Nombre del Ejercicio *</label>
                  <input
                    type="text"
                    className="sr-form-input"
                    placeholder="Ej: Press de pecho en máquina divergente"
                    value={customEjFormData.nombre}
                    onChange={(e) => setCustomEjFormData({ ...customEjFormData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="sr-form-grid-2">
                  <div className="sr-form-field">
                    <label>Grupo Muscular</label>
                    <select
                      className="sr-form-select"
                      value={customEjFormData.grupo_muscular}
                      onChange={(e) => setCustomEjFormData({ ...customEjFormData, grupo_muscular: e.target.value })}
                    >
                      <option value="Pecho">Pecho</option>
                      <option value="Espalda">Espalda</option>
                      <option value="Piernas">Piernas</option>
                      <option value="Hombros">Hombros</option>
                      <option value="Brazos">Brazos</option>
                      <option value="Abdomen">Abdomen</option>
                      <option value="Cardio">Cardio</option>
                      <option value="Cuerpo Completo">Cuerpo Completo</option>
                    </select>
                  </div>

                  <div className="sr-form-field">
                    <label>Dificultad</label>
                    <select
                      className="sr-form-select"
                      value={customEjFormData.dificultad}
                      onChange={(e) => setCustomEjFormData({ ...customEjFormData, dificultad: e.target.value })}
                    >
                      <option value="Principiante">Principiante</option>
                      <option value="Intermedia">Intermedia</option>
                      <option value="Avanzada">Avanzada</option>
                    </select>
                  </div>
                </div>

                <div className="sr-form-field">
                  <label>Instrucciones de Técnica o Variación</label>
                  <textarea
                    rows="2"
                    className="sr-form-textarea"
                    placeholder="Ej: Agarre prono cerrado, pausar 1 segundo abajo..."
                    value={customEjFormData.descripcion}
                    onChange={(e) => setCustomEjFormData({ ...customEjFormData, descripcion: e.target.value })}
                  />
                </div>
              </div>

              <div className="sr-modal-footer">
                <button type="button" className="sr-btn-cancel" onClick={() => setShowCustomEjModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="sr-btn-primary" disabled={guardandoCustomEj}>
                  <FaCheck /> {guardandoCustomEj ? 'Creando...' : 'Crear Ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL 4: MODO ENTRENAMIENTO INTERACTIVO (WORKOUT MODE)
          ================================================================ */}
      {workoutModalOpen && workoutRutina && (
        <div className="sr-modal-overlay" onClick={handleCerrarEntrenamiento}>
          <div className="sr-workout-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sr-workout-header">
              <div>
                <span className="sr-badge-live">
                  <span className="live-dot"></span> EN SESIÓN
                </span>
                <h2>{workoutRutina.nombre}</h2>
              </div>

              <div className="sr-workout-timers-bar">
                {/* Cronómetro General */}
                <div className="sr-timer-box main">
                  <FaStopwatch />
                  <span>{formatTime(workoutTimerSeconds)}</span>
                </div>

                {/* Temporizador de Descanso */}
                {restTimerSeconds !== null && (
                  <div className={`sr-timer-box rest ${timerActivo ? 'active' : 'finished'}`}>
                    <FaClock />
                    <span>Descanso: {formatTime(restTimerSeconds)}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="sr-btn-finish-workout"
                  onClick={() => {
                    const hechos = Object.values(ejerciciosCompletados).filter(Boolean).length;
                    const total = workoutRutina.rutina_ejercicio?.length || 0;
                    alert(`¡Entrenamiento finalizado! 🏆\nTiempo: ${formatTime(workoutTimerSeconds)}\nEjercicios completados: ${hechos} de ${total}.\n¡Excelente trabajo! 💪`);
                    handleCerrarEntrenamiento();
                  }}
                >
                  <FaCheck /> Terminar Sesión
                </button>

                {/* Botón Cerrar / Salir del Entrenamiento */}
                <button
                  type="button"
                  className="sr-btn-close-workout"
                  onClick={handleCerrarEntrenamiento}
                  title="Cerrar panel de entrenamiento"
                >
                  <FaTimes /> Cerrar
                </button>

                {/* Botón X de Cierre Rápido */}
                <button
                  type="button"
                  className="sr-workout-close-x"
                  onClick={handleCerrarEntrenamiento}
                  title="Cerrar ventana"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Selector Rápido de Descanso */}
            <div className="sr-rest-quick-bar">
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Descansar:</span>
              <button onClick={() => iniciarTimerDescanso(30)} className="sr-quick-rest-btn">30s</button>
              <button onClick={() => iniciarTimerDescanso(45)} className="sr-quick-rest-btn">45s</button>
              <button onClick={() => iniciarTimerDescanso(60)} className="sr-quick-rest-btn">60s</button>
              <button onClick={() => iniciarTimerDescanso(90)} className="sr-quick-rest-btn">90s</button>
              <button onClick={() => iniciarTimerDescanso(120)} className="sr-quick-rest-btn">2m</button>
              {timerActivo && (
                <button onClick={() => setTimerActivo(false)} className="sr-quick-rest-btn stop">
                  Pausar
                </button>
              )}
            </div>

            {/* Lista de Ejercicios del Entrenamiento */}
            <div className="sr-workout-exercises-body">
              {workoutRutina.rutina_ejercicio?.map((item, idx) => {
                const ej = item.ejercicio || {};
                const isChecked = Boolean(ejerciciosCompletados[item.id_rutina_ejercicio || idx]);

                return (
                  <div
                    key={item.id_rutina_ejercicio || idx}
                    className={`sr-workout-row ${isChecked ? 'completed' : ''}`}
                    onClick={() => toggleEjercicioCompletado(item.id_rutina_ejercicio || idx, item.descanso || 60)}
                  >
                    <div className="sr-workout-checkbox">
                      {isChecked && <FaCheck />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ textDecoration: isChecked ? 'line-through' : 'none' }}>
                          {ej.nombre || 'Ejercicio'}
                        </h4>
                        <span className="sr-tag-muscle">{ej.grupo_muscular}</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                        {item.series || 4} series × {item.repeticiones || 10} reps •{' '}
                        {item.peso && item.peso > 0 ? `${item.peso} kg` : 'Peso corporal'} •{' '}
                        Descanso {item.descanso || 60}s
                      </p>
                    </div>

                    <button
                      type="button"
                      className="sr-btn-trigger-rest"
                      onClick={(e) => {
                        e.stopPropagation();
                        iniciarTimerDescanso(item.descanso || 60);
                      }}
                      title="Iniciar descanso de este ejercicio"
                    >
                      <FaStopwatch /> Descansar {item.descanso || 60}s
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
