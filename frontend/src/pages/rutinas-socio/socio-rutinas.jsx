/**
 * =========================================================================================
 * ARCHIVO: socio-rutinas.jsx
 * RUTA: frontend/src/pages/rutinas-socio/socio-rutinas.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Módulo interactivo de Rutinas del Socio:
 *   - Pestaña 1: Mis Rutinas Personales (`rutina_socio`, usando exclusivamente `ejercicio_socio`)
 *   - Pestaña 2: Rutinas Asignadas por el Gimnasio (`rutinas_asignadas_socio_gimnasio`, solo lectura)
 *   - Modo Entrenamiento Interactivo con cronómetro de sesión y descanso.
 * =========================================================================================
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import SidebarSocio from '../../components/sidebar-socio/sidebar-socio';
import { useGymContext } from '../../context/GymContext';
import {
  fetchRutinasResumen,
  fetchRutinaPersonalById,
  createRutinaPersonal,
  updateRutinaPersonal,
  deleteRutinaPersonal,
  addEjercicioRutinaPersonal,
  updateEjercicioRutinaPersonal,
  removeEjercicioRutinaPersonal,
  reordenarRutinaPersonal
} from '../../services/rutinaService';
import {
  getEjerciciosSocio,
  crearEjercicioSocio
} from '../../services/socioEjercicioService';
import { formatFechaArgentina } from '../../utils/dateUtils';

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
  FaStopwatch,
  FaArrowUp,
  FaArrowDown,
  FaBuilding,
  FaUserTie
} from 'react-icons/fa';

import './socio-rutinas.css';

function parseDescripcion(desc) {
  const defaults = {
    tipo: 'Personalizada',
    dificultad: 'Intermedia',
    duracion: '60 min',
    dias: 'Lunes, Miércoles, Viernes',
    notas: '',
    objetivo: 'Entrenamiento general'
  };
  if (!desc) return defaults;
  try {
    const parsed = JSON.parse(desc);
    if (parsed && typeof parsed === 'object') {
      return {
        tipo: parsed.tipo || defaults.tipo,
        dificultad: parsed.dificultad || defaults.dificultad,
        duracion: parsed.duracion || defaults.duracion,
        dias: parsed.dias || defaults.dias,
        notas: parsed.notas || '',
        objetivo: parsed.objetivo || defaults.objetivo
      };
    }
  } catch {
    return { ...defaults, notas: String(desc) };
  }
  return defaults;
}

export default function SocioRutinas() {
  const { usuario, gimnasioActivo, gimnasioActivoId, contextVersion } = useGymContext();
  const socioIdActual = usuario?.id_socio || null;

  // Pestaña activa: 'personales' | 'asignadas'
  const [tabActiva, setTabActiva] = useState('personales');

  // Datos
  const [rutinasPersonales, setRutinasPersonales] = useState([]);
  const [rutinasAsignadas, setRutinasAsignadas] = useState([]);
  const [ejerciciosPropios, setEjerciciosPropios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notificacion, setNotificacion] = useState('');

  // Selección
  const [selectedPersonal, setSelectedPersonal] = useState(null);
  const [selectedAsignada, setSelectedAsignada] = useState(null);

  // Filtros
  const [searchText, setSearchText] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activa' | 'inactiva'

  // Modal 1: Crear / Editar Rutina Personal (`rutina_socio`)
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
  const [guardandoRutina, setGuardandoRutina] = useState(false);

  // Modal 2: Agregar / Editar Ejercicio Personal en Rutina Personal
  const [showAddEjModal, setShowAddEjModal] = useState(false);
  const [editingEjercicioItem, setEditingEjercicioItem] = useState(null);
  const [ejercicioFormData, setEjercicioFormData] = useState({
    id_ejercicio_socio: '',
    series: 4,
    repeticiones: 10,
    peso: 20,
    descanso: 60,
    orden: 1
  });
  const [guardandoEjercicio, setGuardandoEjercicio] = useState(false);

  // Modal 3: Crear Ejercicio Personal Propio (`ejercicio_socio`)
  const [showCustomEjModal, setShowCustomEjModal] = useState(false);
  const [customEjFormData, setCustomEjFormData] = useState({
    nombre: '',
    grupo_muscular: 'Pecho',
    dificultad: 'Intermedia',
    descripcion: ''
  });
  const [guardandoCustomEj, setGuardandoCustomEj] = useState(false);

  // Modal 4: Modo Entrenamiento Interactivo (sirve para personales y asignadas)
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [workoutPayload, setWorkoutPayload] = useState(null); // { nombre, items: [{ key, nombre, grupo, series, repeticiones, peso, descanso }] }
  const [ejerciciosCompletados, setEjerciciosCompletados] = useState({});
  const [workoutTimerSeconds, setWorkoutTimerSeconds] = useState(0);
  const [restTimerSeconds, setRestTimerSeconds] = useState(null);
  const [timerActivo, setTimerActivo] = useState(false);

  const showToast = (msg) => {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(''), 5000);
  };

  const cargarTodo = useCallback(async (preservarPersonalId = null) => {
    if (!socioIdActual) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [resumen, misEj] = await Promise.all([
        fetchRutinasResumen(),
        getEjerciciosSocio({ origen: 'propio' })
      ]);

      const personales = Array.isArray(resumen?.rutinas_personales) ? resumen.rutinas_personales : [];
      const asignadas = Array.isArray(resumen?.rutinas_asignadas) ? resumen.rutinas_asignadas : [];

      setRutinasPersonales(personales);
      setRutinasAsignadas(asignadas);
      setEjerciciosPropios(Array.isArray(misEj) ? misEj : []);

      setSelectedPersonal((prev) => {
        if (personales.length === 0) return null;
        if (preservarPersonalId) {
          return personales.find((r) => String(r.id_rutina_socio) === String(preservarPersonalId)) || personales[0];
        }
        if (prev) {
          return personales.find((r) => r.id_rutina_socio === prev.id_rutina_socio) || personales[0];
        }
        return personales.find((r) => r.estado === true) || personales[0];
      });

      setSelectedAsignada((prev) => {
        if (asignadas.length === 0) return null;
        if (prev) {
          return asignadas.find((a) => a.id_rutina_asignada === prev.id_rutina_asignada) || asignadas[0];
        }
        return asignadas.find((a) => a.estado === true) || asignadas[0];
      });
    } catch (err) {
      console.error('Error cargando rutinas del socio:', err);
      showToast(err.message || 'No se pudieron cargar tus rutinas. Reintentá en un momento.');
    } finally {
      setLoading(false);
    }
  }, [socioIdActual]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo, gimnasioActivoId, contextVersion]);

  // Cronómetro de sesión
  useEffect(() => {
    let interval = null;
    if (workoutModalOpen) {
      interval = setInterval(() => setWorkoutTimerSeconds((s) => s + 1), 1000);
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
    return () => {
      if (restInterval) clearInterval(restInterval);
    };
  }, [timerActivo, restTimerSeconds]);

  const iniciarTimerDescanso = (segundos) => {
    setRestTimerSeconds(segundos);
    setTimerActivo(true);
  };

  // Listas filtradas
  const personalesFiltradas = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rutinasPersonales.filter((r) => {
      if (filtroEstado === 'activa' && r.estado !== true) return false;
      if (filtroEstado === 'inactiva' && r.estado !== false) return false;
      if (q && !(r.nombre || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rutinasPersonales, filtroEstado, searchText]);

  const asignadasFiltradas = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rutinasAsignadas.filter((a) => {
      if (filtroEstado === 'activa' && a.estado !== true) return false;
      if (filtroEstado === 'inactiva' && a.estado !== false) return false;
      if (q) {
        const nom = (a.rutina_gimnasio?.nombre || '').toLowerCase();
        const obs = (a.observaciones || '').toLowerCase();
        if (!nom.includes(q) && !obs.includes(q)) return false;
      }
      return true;
    });
  }, [rutinasAsignadas, filtroEstado, searchText]);

  const asignadasActivasCount = useMemo(
    () => rutinasAsignadas.filter((a) => a.estado === true).length,
    [rutinasAsignadas]
  );

  // --------------------------------------------------------------------------
  // Acciones sobre Rutinas Personales (`rutina_socio`)
  // --------------------------------------------------------------------------
  const handleToggleEstadoPersonal = async (rutina) => {
    try {
      const nuevoEstado = !rutina.estado;
      await updateRutinaPersonal(rutina.id_rutina_socio, { estado: nuevoEstado });
      showToast(nuevoEstado ? 'Rutina personal activada.' : 'Rutina personal pausada.');
      await cargarTodo(rutina.id_rutina_socio);
    } catch (err) {
      alert(err.message || 'No se pudo actualizar el estado de la rutina.');
    }
  };

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
    setShowRutinaModal(true);
  };

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
    setModalEjerciciosSeleccionados([]);
    setShowRutinaModal(true);
  };

  const handleToggleEjercicioModal = (ej) => {
    const idEj = ej.id_ejercicio_socio;
    const existe = modalEjerciciosSeleccionados.some((it) => it.id_ejercicio_socio === idEj);
    if (existe) {
      setModalEjerciciosSeleccionados((prev) => prev.filter((it) => it.id_ejercicio_socio !== idEj));
    } else {
      setModalEjerciciosSeleccionados((prev) => [
        ...prev,
        {
          id_ejercicio_socio: idEj,
          nombre: ej.nombre,
          grupo_muscular: ej.grupo_muscular || 'General',
          series: 4,
          repeticiones: 10,
          peso: 20,
          descanso: 60
        }
      ]);
    }
  };

  const handleSaveRutina = async (e) => {
    e.preventDefault();
    if (!rutinaFormData.nombre.trim()) {
      alert('Por favor, ingresá un nombre para tu rutina.');
      return;
    }

    setGuardandoRutina(true);
    try {
      const descripcion = JSON.stringify({
        tipo: rutinaFormData.tipo,
        dificultad: rutinaFormData.dificultad,
        duracion: rutinaFormData.duracion,
        dias: rutinaFormData.dias,
        notas: rutinaFormData.notas,
        objetivo: rutinaFormData.objetivo
      });

      let saved;
      if (editingRutina) {
        saved = await updateRutinaPersonal(editingRutina.id_rutina_socio, {
          nombre: rutinaFormData.nombre.trim(),
          descripcion
        });
        showToast('¡Rutina personal actualizada con éxito!');
      } else {
        saved = await createRutinaPersonal({
          nombre: rutinaFormData.nombre.trim(),
          descripcion,
          estado: true
        });

        const newId = saved?.id_rutina_socio;
        if (newId && modalEjerciciosSeleccionados.length > 0) {
          for (let i = 0; i < modalEjerciciosSeleccionados.length; i++) {
            const ej = modalEjerciciosSeleccionados[i];
            await addEjercicioRutinaPersonal(newId, {
              id_ejercicio_socio: ej.id_ejercicio_socio,
              series: Number(ej.series || 4),
              repeticiones: Number(ej.repeticiones || 10),
              peso: Number(ej.peso || 0),
              descanso: Number(ej.descanso || 60),
              orden: i + 1
            });
          }
        }
        showToast('¡Tu nueva rutina personal fue creada con éxito!');
      }

      setShowRutinaModal(false);
      setTabActiva('personales');
      await cargarTodo(saved?.id_rutina_socio || editingRutina?.id_rutina_socio);
    } catch (err) {
      alert(err.message || 'Error al guardar la rutina.');
    } finally {
      setGuardandoRutina(false);
    }
  };

  const handleDeleteRutina = async (rutina) => {
    if (!window.confirm(`¿Seguro que deseás eliminar tu rutina personal "${rutina.nombre}"?`)) return;
    try {
      await deleteRutinaPersonal(rutina.id_rutina_socio);
      showToast(`Rutina "${rutina.nombre}" eliminada.`);
      await cargarTodo();
    } catch (err) {
      alert(err.message || 'Error al eliminar la rutina.');
    }
  };

  // --------------------------------------------------------------------------
  // Ejercicios en Rutina Personal (`rutina_ejercicio_socio` -> `ejercicio_socio`)
  // --------------------------------------------------------------------------
  const handleOpenAddEjercicio = () => {
    if (!selectedPersonal) return;
    setEditingEjercicioItem(null);
    const items = selectedPersonal.rutina_ejercicio_socio || [];
    const usados = new Set(items.map((it) => it.id_ejercicio_socio));
    const primero = ejerciciosPropios.find((e) => !usados.has(e.id_ejercicio_socio));
    setEjercicioFormData({
      id_ejercicio_socio: primero?.id_ejercicio_socio || '',
      series: 4,
      repeticiones: 10,
      peso: 20,
      descanso: 60,
      orden: items.length + 1
    });
    setShowAddEjModal(true);
  };

  const handleOpenEditEjercicio = (item) => {
    setEditingEjercicioItem(item);
    setEjercicioFormData({
      id_ejercicio_socio: item.id_ejercicio_socio,
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
    if (!selectedPersonal) return;

    setGuardandoEjercicio(true);
    try {
      const rutId = selectedPersonal.id_rutina_socio;
      if (editingEjercicioItem) {
        await updateEjercicioRutinaPersonal(rutId, editingEjercicioItem.id_rutina_ejercicio_socio, {
          series: Number(ejercicioFormData.series),
          repeticiones: Number(ejercicioFormData.repeticiones),
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
        showToast('Parámetros del ejercicio actualizados.');
      } else {
        await addEjercicioRutinaPersonal(rutId, {
          id_ejercicio_socio: Number(ejercicioFormData.id_ejercicio_socio),
          series: Number(ejercicioFormData.series),
          repeticiones: Number(ejercicioFormData.repeticiones),
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
        showToast('¡Ejercicio personal agregado a tu rutina!');
      }

      setShowAddEjModal(false);
      const updated = await fetchRutinaPersonalById(rutId);
      setSelectedPersonal(updated);
      await cargarTodo(rutId);
    } catch (err) {
      alert(err.message || 'Error al guardar el ejercicio en la rutina.');
    } finally {
      setGuardandoEjercicio(false);
    }
  };

  const handleDeleteEjercicioDeRutina = async (item) => {
    if (!selectedPersonal) return;
    if (!window.confirm(`¿Quitar "${item.ejercicio_socio?.nombre || 'este ejercicio'}" de la rutina?`)) return;
    try {
      const rutId = selectedPersonal.id_rutina_socio;
      await removeEjercicioRutinaPersonal(rutId, item.id_rutina_ejercicio_socio);
      showToast('Ejercicio quitado de la rutina.');
      const updated = await fetchRutinaPersonalById(rutId);
      setSelectedPersonal(updated);
      await cargarTodo(rutId);
    } catch (err) {
      alert(err.message || 'Error al quitar el ejercicio.');
    }
  };

  const handleMoverEjercicio = async (index, direccion) => {
    if (!selectedPersonal) return;
    const lista = [...(selectedPersonal.rutina_ejercicio_socio || [])];
    const targetIdx = index + direccion;
    if (targetIdx < 0 || targetIdx >= lista.length) return;

    const [movido] = lista.splice(index, 1);
    lista.splice(targetIdx, 0, movido);
    const idsOrdenados = lista.map((it) => it.id_rutina_ejercicio_socio);

    try {
      const rutId = selectedPersonal.id_rutina_socio;
      await reordenarRutinaPersonal(rutId, idsOrdenados);
      const updated = await fetchRutinaPersonalById(rutId);
      setSelectedPersonal(updated);
      await cargarTodo(rutId);
      showToast('Orden de ejercicios actualizado.');
    } catch (err) {
      alert(err.message || 'No se pudo reordenar la rutina.');
    }
  };

  // Crear Ejercicio Personal (`ejercicio_socio`)
  const handleSaveCustomEjercicio = async (e) => {
    e.preventDefault();
    if (!customEjFormData.nombre.trim()) return;
    setGuardandoCustomEj(true);
    try {
      const nuevo = await crearEjercicioSocio({
        nombre: customEjFormData.nombre.trim(),
        grupo_muscular: customEjFormData.grupo_muscular,
        dificultad: customEjFormData.dificultad,
        descripcion: customEjFormData.descripcion.trim() || null
      });

      showToast(`¡Ejercicio personal "${nuevo.nombre}" creado!`);
      setShowCustomEjModal(false);
      setCustomEjFormData({ nombre: '', grupo_muscular: 'Pecho', dificultad: 'Intermedia', descripcion: '' });

      const misEj = await getEjerciciosSocio({ origen: 'propio' }).catch(() => []);
      setEjerciciosPropios(Array.isArray(misEj) ? misEj : []);

      if (showRutinaModal && nuevo?.id_ejercicio_socio) {
        setModalEjerciciosSeleccionados((prev) => [
          ...prev,
          {
            id_ejercicio_socio: nuevo.id_ejercicio_socio,
            nombre: nuevo.nombre,
            grupo_muscular: nuevo.grupo_muscular || 'General',
            series: 4,
            repeticiones: 10,
            peso: 0,
            descanso: 60
          }
        ]);
      }
      if (showAddEjModal && nuevo?.id_ejercicio_socio) {
        setEjercicioFormData((prev) => ({
          ...prev,
          id_ejercicio_socio: nuevo.id_ejercicio_socio
        }));
      }
    } catch (err) {
      alert(err.message || 'Error al crear el ejercicio personal.');
    } finally {
      setGuardandoCustomEj(false);
    }
  };

  // Iniciar Modo Entrenamiento (soporta rutina personal o asignada)
  const handleIniciarEntrenamientoPersonal = (rutina) => {
    const items = (rutina.rutina_ejercicio_socio || []).map((it, idx) => ({
      key: it.id_rutina_ejercicio_socio || idx,
      nombre: it.ejercicio_socio?.nombre || 'Ejercicio',
      grupo: it.ejercicio_socio?.grupo_muscular || 'General',
      series: it.series || 4,
      repeticiones: it.repeticiones || 10,
      peso: it.peso || 0,
      descanso: it.descanso || 60
    }));
    setWorkoutPayload({ nombre: rutina.nombre, items });
    setEjerciciosCompletados({});
    setWorkoutTimerSeconds(0);
    setRestTimerSeconds(null);
    setTimerActivo(false);
    setWorkoutModalOpen(true);
  };

  const handleIniciarEntrenamientoAsignada = (asig) => {
    const rg = asig.rutina_gimnasio || {};
    const items = (rg.rutina_ejercicio_gimnasio || []).map((it, idx) => ({
      key: it.id_rutina_ejercicio_gimnasio || idx,
      nombre: it.ejercicio_gimnasio?.nombre || 'Ejercicio',
      grupo: it.ejercicio_gimnasio?.grupo_muscular || 'General',
      series: it.series || 4,
      repeticiones: it.repeticiones || 10,
      peso: it.peso || 0,
      descanso: it.descanso || 60
    }));
    setWorkoutPayload({ nombre: rg.nombre || 'Rutina Asignada', items });
    setEjerciciosCompletados({});
    setWorkoutTimerSeconds(0);
    setRestTimerSeconds(null);
    setTimerActivo(false);
    setWorkoutModalOpen(true);
  };

  const handleCerrarEntrenamiento = () => {
    setWorkoutModalOpen(false);
    setTimerActivo(false);
    setRestTimerSeconds(null);
  };

  const toggleEjercicioCompletado = (key, descansoSegundos = 60) => {
    const ya = Boolean(ejerciciosCompletados[key]);
    setEjerciciosCompletados((prev) => ({ ...prev, [key]: !ya }));
    if (!ya) iniciarTimerDescanso(Number(descansoSegundos) || 60);
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const catalogoPropioFiltrado = ejerciciosPropios.filter((ej) => {
    if (modalFiltroGrupo !== 'todos' && ej.grupo_muscular !== modalFiltroGrupo) return false;
    if (modalSearchEj.trim()) {
      const q = modalSearchEj.toLowerCase();
      return (
        (ej.nombre || '').toLowerCase().includes(q) ||
        (ej.grupo_muscular || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedPersonalMeta = selectedPersonal ? parseDescripcion(selectedPersonal.descripcion) : null;
  const ejerciciosDePersonal = selectedPersonal?.rutina_ejercicio_socio || [];

  const selectedAsignadaRut = selectedAsignada?.rutina_gimnasio || null;
  const selectedAsignadaMeta = selectedAsignadaRut ? parseDescripcion(selectedAsignadaRut.descripcion) : null;
  const ejerciciosDeAsignada = selectedAsignadaRut?.rutina_ejercicio_gimnasio || [];

  return (
    <div className="sr-page-layout">
      <NavGlobal />

      <div className="sr-body-container">
        <SidebarSocio />

        <main className="sr-main-area">
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

          {/* HERO HEADER */}
          <section className="sr-header-section">
            <div className="sr-header-topbar">
              <div className="sr-title-wrap">
                <div className="sr-title-badge-icon">
                  <FaDumbbell />
                </div>
                <div>
                  <h1>Mis Rutinas de Entrenamiento</h1>
                  <p>
                    Gestioná tus rutinas personales (con tus propios ejercicios) y consultá las rutinas asignadas por {gimnasioActivo?.nombre || 'tus gimnasios'}.
                  </p>
                </div>
              </div>

              <div className="sr-header-actions">
                <button
                  type="button"
                  className="sr-btn-custom-ej"
                  onClick={() => setShowCustomEjModal(true)}
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

            {/* MÉTRICAS */}
            <div className="sr-metrics-grid">
              <div className="sr-metric-card">
                <div className="sr-metric-icon-wrap" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                  <FaDumbbell />
                </div>
                <div className="sr-metric-data">
                  <h3>{rutinasPersonales.length}</h3>
                  <p>Rutinas Personales</p>
                </div>
              </div>

              <div className="sr-metric-card">
                <div className="sr-metric-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <FaCrown />
                </div>
                <div className="sr-metric-data">
                  <h3>{asignadasActivasCount}</h3>
                  <p>Asignadas Activas por Gimnasio</p>
                </div>
              </div>

              <div className="sr-metric-card">
                <div className="sr-metric-icon-wrap" style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}>
                  <FaLayerGroup />
                </div>
                <div className="sr-metric-data">
                  <h3>{ejerciciosPropios.length}</h3>
                  <p>Mis Ejercicios Propios</p>
                </div>
              </div>
            </div>
          </section>

          {/* TABS + FILTROS */}
          <div className="sr-tab-content">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={tabActiva === 'personales' ? 'sr-btn-primary' : 'sr-btn-secondary'}
                onClick={() => setTabActiva('personales')}
              >
                <FaStar /> Mis Rutinas Personales ({rutinasPersonales.length})
              </button>
              <button
                type="button"
                className={tabActiva === 'asignadas' ? 'sr-btn-primary' : 'sr-btn-secondary'}
                onClick={() => setTabActiva('asignadas')}
              >
                <FaBuilding /> Asignadas por Gimnasio ({rutinasAsignadas.length})
              </button>
            </div>

            <div className="sr-filters-bar">
              <div className="sr-search-box">
                <FaSearch style={{ color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Buscar rutina..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div className="sr-filter-select-wrap">
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Estado:</span>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="sr-select-filter"
                >
                  <option value="todos">Todas</option>
                  <option value="activa">Solo activas</option>
                  <option value="inactiva">{tabActiva === 'personales' ? 'Pausadas' : 'Finalizadas'}</option>
                </select>
              </div>

              <button
                type="button"
                className="sr-btn-refresh"
                onClick={() => cargarTodo()}
                title="Refrescar rutinas"
              >
                <FaSyncAlt />
              </button>
            </div>

            {/* PESTAÑA 1: RUTINAS PERSONALES */}
            {tabActiva === 'personales' ? (
              <div className="sr-master-detail-grid">
                <div className="sr-left-panel">
                  <div className="sr-panel-header">
                    <h2>Mis Rutinas Personales</h2>
                    <span className="sr-count-pill">{personalesFiltradas.length}</span>
                  </div>

                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>Cargando rutinas...</div>
                  ) : personalesFiltradas.length === 0 ? (
                    <div className="sr-empty-card">
                      <FaDumbbell style={{ fontSize: '42px', opacity: 0.3, marginBottom: '12px' }} />
                      <h3>Aún no tenés rutinas personales</h3>
                      <p>Armá tus propias rutinas con tus ejercicios personalizados.</p>
                      <button type="button" className="sr-btn-primary" style={{ marginTop: '14px' }} onClick={handleOpenCrearRutina}>
                        <FaPlus /> Crear mi primera rutina
                      </button>
                    </div>
                  ) : (
                    <div className="sr-cards-stack">
                      {personalesFiltradas.map((r) => {
                        const isSelected = selectedPersonal?.id_rutina_socio === r.id_rutina_socio;
                        const esActiva = r.estado === true;
                        const meta = parseDescripcion(r.descripcion);
                        const cantEj = r.rutina_ejercicio_socio?.length || 0;

                        return (
                          <div
                            key={r.id_rutina_socio}
                            className={`sr-routine-card ${isSelected ? 'selected' : ''} ${esActiva ? 'is-active-card' : ''}`}
                            onClick={() => setSelectedPersonal(r)}
                          >
                            <div className="sr-routine-card-top">
                              <div className="sr-routine-card-icon"><FaDumbbell /></div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <h4 className="sr-routine-card-title">{r.nombre}</h4>
                                  {esActiva && (
                                    <span className="sr-badge-activa"><FaBolt style={{ fontSize: '10px' }} /> ACTIVA</span>
                                  )}
                                </div>
                                <p className="sr-routine-card-type">{meta.tipo} • {meta.dificultad}</p>
                              </div>
                            </div>

                            <div className="sr-routine-card-details">
                              <div className="sr-detail-item"><FaCalendarAlt style={{ color: '#22c55e' }} /><span>{meta.dias}</span></div>
                              <div className="sr-detail-item"><FaClock style={{ color: '#38bdf8' }} /><span>{meta.duracion}</span></div>
                              <div className="sr-detail-item"><FaListUl style={{ color: '#c084fc' }} /><span>{cantEj} ejercicios</span></div>
                            </div>

                            <div className="sr-routine-card-actions">
                              <button
                                type="button"
                                className="sr-btn-card-action train"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIniciarEntrenamientoPersonal(r);
                                }}
                              >
                                <FaPlay style={{ fontSize: '10px' }} /> Entrenar
                              </button>
                              <button
                                type="button"
                                className="sr-btn-card-action activate"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleEstadoPersonal(r);
                                }}
                              >
                                <FaBolt style={{ fontSize: '11px' }} /> {esActiva ? 'Pausar' : 'Activar'}
                              </button>
                              <button
                                type="button"
                                className="sr-btn-card-icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditarRutina(r);
                                }}
                                title="Editar"
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
                                title="Eliminar"
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

                {/* DETALLE RUTINA PERSONAL */}
                <div className="sr-right-panel">
                  {selectedPersonal ? (
                    <div>
                      <div className="sr-detail-header-card">
                        <div className="sr-detail-header-top">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <h2>{selectedPersonal.nombre}</h2>
                              <span className="sr-badge-activa">
                                <FaBolt style={{ fontSize: '10px' }} /> {selectedPersonal.estado ? 'ACTIVA' : 'PAUSADA'}
                              </span>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: '6px 0 0 0' }}>
                              {selectedPersonalMeta?.objetivo || 'Rutina personal del socio'}
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="sr-btn-primary"
                              onClick={() => handleIniciarEntrenamientoPersonal(selectedPersonal)}
                            >
                              <FaPlay /> Iniciar Entrenamiento
                            </button>
                            <button type="button" className="sr-btn-secondary" onClick={handleOpenAddEjercicio}>
                              <FaPlus /> Agregar Ejercicio
                            </button>
                          </div>
                        </div>

                        <div className="sr-detail-pills-row">
                          <span className="sr-meta-pill"><strong>Tipo:</strong> {selectedPersonalMeta?.tipo}</span>
                          <span className="sr-meta-pill"><strong>Nivel:</strong> {selectedPersonalMeta?.dificultad}</span>
                          <span className="sr-meta-pill"><strong>Días:</strong> {selectedPersonalMeta?.dias}</span>
                          <span className="sr-meta-pill"><strong>Duración:</strong> {selectedPersonalMeta?.duracion}</span>
                        </div>

                        {selectedPersonalMeta?.notas && (
                          <div className="sr-detail-notes-box">
                            <FaInfoCircle style={{ color: '#38bdf8', marginTop: '3px', flexShrink: 0 }} />
                            <span>{selectedPersonalMeta.notas}</span>
                          </div>
                        )}
                      </div>

                      <div className="sr-exercises-section">
                        <div className="sr-section-title-row">
                          <h3>Ejercicios en tu Rutina ({ejerciciosDePersonal.length})</h3>
                          <button type="button" className="sr-link-btn" onClick={handleOpenAddEjercicio}>
                            + Sumar ejercicio propio
                          </button>
                        </div>

                        {ejerciciosDePersonal.length === 0 ? (
                          <div className="sr-empty-exercises">
                            <FaDumbbell style={{ fontSize: '30px', opacity: 0.3 }} />
                            <p>Esta rutina personal no tiene ejercicios todavía.</p>
                            <button type="button" className="sr-btn-primary" onClick={handleOpenAddEjercicio}>
                              <FaPlus /> Agregar primer ejercicio
                            </button>
                          </div>
                        ) : (
                          <div className="sr-exercise-items-list">
                            {ejerciciosDePersonal.map((item, index) => {
                              const ej = item.ejercicio_socio || {};
                              return (
                                <div key={item.id_rutina_ejercicio_socio || index} className="sr-exercise-item-card">
                                  <div className="sr-exercise-order-badge">{item.orden || index + 1}</div>
                                  <div className="sr-exercise-item-info">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <h4>{ej.nombre || 'Ejercicio personal'}</h4>
                                      <span className="sr-tag-origen propio">Mi ejercicio</span>
                                    </div>
                                    <p className="sr-exercise-item-muscle">
                                      {ej.grupo_muscular || 'General'} • {ej.dificultad || 'Intermedia'}
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
                                      <span className="value">{item.descanso ?? 60}s</span>
                                    </div>
                                  </div>
                                  <div className="sr-exercise-item-actions">
                                    <button
                                      type="button"
                                      className="sr-btn-card-icon"
                                      disabled={index === 0}
                                      onClick={() => handleMoverEjercicio(index, -1)}
                                      title="Subir orden"
                                    >
                                      <FaArrowUp />
                                    </button>
                                    <button
                                      type="button"
                                      className="sr-btn-card-icon"
                                      disabled={index === ejerciciosDePersonal.length - 1}
                                      onClick={() => handleMoverEjercicio(index, 1)}
                                      title="Bajar orden"
                                    >
                                      <FaArrowDown />
                                    </button>
                                    <button
                                      type="button"
                                      className="sr-btn-card-icon"
                                      onClick={() => handleOpenEditEjercicio(item)}
                                      title="Editar parámetros"
                                    >
                                      <FaEdit />
                                    </button>
                                    <button
                                      type="button"
                                      className="sr-btn-card-icon delete"
                                      onClick={() => handleDeleteEjercicioDeRutina(item)}
                                      title="Quitar"
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
                      <h3>Seleccioná una rutina personal</h3>
                      <p>Hacé clic en cualquiera de tus rutinas para ver, editar o reordenar sus ejercicios.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* PESTAÑA 2: RUTINAS ASIGNADAS POR EL GIMNASIO (SOLO LECTURA + WORKOUT MODE) */
              <div className="sr-master-detail-grid">
                <div className="sr-left-panel">
                  <div className="sr-panel-header">
                    <h2>Asignadas por tu Gimnasio</h2>
                    <span className="sr-count-pill">{asignadasFiltradas.length}</span>
                  </div>

                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>Cargando asignaciones...</div>
                  ) : asignadasFiltradas.length === 0 ? (
                    <div className="sr-empty-card">
                      <FaBuilding style={{ fontSize: '42px', opacity: 0.3, marginBottom: '12px' }} />
                      <h3>Sin rutinas asignadas</h3>
                      <p>Cuando un entrenador o administrador de tu gimnasio te asigne una plantilla, aparecerá aquí.</p>
                    </div>
                  ) : (
                    <div className="sr-cards-stack">
                      {asignadasFiltradas.map((asig) => {
                        const isSelected = selectedAsignada?.id_rutina_asignada === asig.id_rutina_asignada;
                        const rg = asig.rutina_gimnasio || {};
                        const cantEj = rg.rutina_ejercicio_gimnasio?.length || 0;
                        const emp = asig.empleado || null;

                        return (
                          <div
                            key={asig.id_rutina_asignada}
                            className={`sr-routine-card ${isSelected ? 'selected' : ''} ${asig.estado ? 'is-active-card' : ''}`}
                            onClick={() => setSelectedAsignada(asig)}
                          >
                            <div className="sr-routine-card-top">
                              <div className="sr-routine-card-icon"><FaBuilding /></div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <h4 className="sr-routine-card-title">{rg.nombre || 'Rutina del Gimnasio'}</h4>
                                  <span className="sr-badge-activa">
                                    {asig.estado ? 'ACTIVA' : 'FINALIZADA'}
                                  </span>
                                </div>
                                <p className="sr-routine-card-type">
                                  Nivel: {rg.nivel || 'General'} • {cantEj} ejercicios
                                </p>
                              </div>
                            </div>

                            <div className="sr-routine-card-details">
                              {emp && (
                                <div className="sr-detail-item">
                                  <FaUserTie style={{ color: '#38bdf8' }} />
                                  <span>{emp.nombre} {emp.apellido}</span>
                                </div>
                              )}
                              <div className="sr-detail-item">
                                <FaCalendarAlt style={{ color: '#22c55e' }} />
                                <span>
                                  {asig.fecha_asignacion ? formatFechaArgentina(asig.fecha_asignacion) : 'Reciente'}
                                </span>
                              </div>
                            </div>

                            <div className="sr-routine-card-actions">
                              <button
                                type="button"
                                className="sr-btn-card-action train"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIniciarEntrenamientoAsignada(asig);
                                }}
                              >
                                <FaPlay style={{ fontSize: '10px' }} /> Entrenar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* DETALLE ASIGNADA */}
                <div className="sr-right-panel">
                  {selectedAsignada && selectedAsignadaRut ? (
                    <div>
                      <div className="sr-detail-header-card">
                        <div className="sr-detail-header-top">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <h2>{selectedAsignadaRut.nombre}</h2>
                              <span className="sr-badge-activa">
                                {selectedAsignada.estado ? 'ASIGNADA ACTIVA' : 'FINALIZADA'}
                              </span>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: '6px 0 0 0' }}>
                              Plantilla oficial asignada por tu gimnasio (solo lectura)
                            </p>
                          </div>

                          <button
                            type="button"
                            className="sr-btn-primary"
                            onClick={() => handleIniciarEntrenamientoAsignada(selectedAsignada)}
                          >
                            <FaPlay /> Iniciar Entrenamiento
                          </button>
                        </div>

                        <div className="sr-detail-pills-row">
                          <span className="sr-meta-pill"><strong>Nivel:</strong> {selectedAsignadaRut.nivel || 'General'}</span>
                          {selectedAsignada.empleado && (
                            <span className="sr-meta-pill">
                              <strong>Responsable:</strong> {selectedAsignada.empleado.nombre} {selectedAsignada.empleado.apellido}
                            </span>
                          )}
                          {selectedAsignada.fecha_asignacion && (
                            <span className="sr-meta-pill">
                              <strong>Asignada:</strong> {formatFechaArgentina(selectedAsignada.fecha_asignacion)}
                            </span>
                          )}
                          {selectedAsignada.fecha_finalizacion && (
                            <span className="sr-meta-pill">
                              <strong>Fin:</strong> {formatFechaArgentina(selectedAsignada.fecha_finalizacion)}
                            </span>
                          )}
                        </div>

                        {(selectedAsignada.observaciones || selectedAsignadaMeta?.notas) && (
                          <div className="sr-detail-notes-box">
                            <FaInfoCircle style={{ color: '#38bdf8', marginTop: '3px', flexShrink: 0 }} />
                            <span>{selectedAsignada.observaciones || selectedAsignadaMeta?.notas}</span>
                          </div>
                        )}
                      </div>

                      <div className="sr-exercises-section">
                        <div className="sr-section-title-row">
                          <h3>Ejercicios del Plan ({ejerciciosDeAsignada.length})</h3>
                        </div>

                        {ejerciciosDeAsignada.length === 0 ? (
                          <div className="sr-empty-exercises">
                            <FaDumbbell style={{ fontSize: '30px', opacity: 0.3 }} />
                            <p>Esta plantilla aún no tiene ejercicios cargados.</p>
                          </div>
                        ) : (
                          <div className="sr-exercise-items-list">
                            {ejerciciosDeAsignada.map((item, idx) => {
                              const ej = item.ejercicio_gimnasio || {};
                              return (
                                <div key={item.id_rutina_ejercicio_gimnasio || idx} className="sr-exercise-item-card">
                                  <div className="sr-exercise-order-badge">{item.orden || idx + 1}</div>
                                  <div className="sr-exercise-item-info">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <h4>{ej.nombre || 'Ejercicio del gimnasio'}</h4>
                                      <span className="sr-tag-origen gimnasio">Gym oficial</span>
                                    </div>
                                    <p className="sr-exercise-item-muscle">
                                      {ej.grupo_muscular || 'General'} • {ej.dificultad || 'Intermedia'}
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
                                      <span className="value">{item.descanso ?? 60}s</span>
                                    </div>
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
                      <FaBuilding style={{ fontSize: '48px', opacity: 0.3, marginBottom: '14px' }} />
                      <h3>Seleccioná una rutina asignada</h3>
                      <p>Aquí podrás ver el detalle completo de los planes asignados por tus profesores.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODAL 1: CREAR / EDITAR RUTINA PERSONAL */}
      {showRutinaModal && (
        <div className="sr-modal-overlay" onClick={() => setShowRutinaModal(false)}>
          <div className="sr-modal-card large" onClick={(e) => e.stopPropagation()}>
            <div className="sr-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaDumbbell style={{ color: '#22c55e' }} />
                <h3>{editingRutina ? 'Editar Mi Rutina Personal' : 'Crear Mi Rutina Personal'}</h3>
              </div>
              <button type="button" className="sr-modal-close-btn" onClick={() => setShowRutinaModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveRutina}>
              <div className="sr-modal-body">
                <div className="sr-form-grid-2">
                  <div className="sr-form-field">
                    <label>Nombre de la Rutina *</label>
                    <input
                      type="text"
                      className="sr-form-input"
                      placeholder="Ej: Piernas & Core"
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
                      <option value="Full Body">Full Body</option>
                      <option value="Torso - Pierna">Torso - Pierna</option>
                      <option value="Push - Pull - Legs">Push - Pull - Legs</option>
                      <option value="Tren Superior">Tren Superior</option>
                      <option value="Tren Inferior">Tren Inferior</option>
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
                      value={rutinaFormData.duracion}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, duracion: e.target.value })}
                    />
                  </div>
                  <div className="sr-form-field">
                    <label>Días Sugeridos</label>
                    <input
                      type="text"
                      className="sr-form-input"
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
                    value={rutinaFormData.objetivo}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, objetivo: e.target.value })}
                  />
                </div>

                <div className="sr-form-field">
                  <label>Notas Técnicas</label>
                  <textarea
                    rows="2"
                    className="sr-form-textarea"
                    value={rutinaFormData.notas}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, notas: e.target.value })}
                  />
                </div>

                {!editingRutina && (
                  <div className="sr-modal-exercises-selector">
                    <div className="sr-selector-header">
                      <div>
                        <h4>Seleccioná tus ejercicios personales</h4>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8' }}>
                          Las rutinas personales utilizan tus ejercicios propios ({modalEjerciciosSeleccionados.length} seleccionados)
                        </p>
                      </div>
                      <button
                        type="button"
                        className="sr-btn-custom-ej-sm"
                        onClick={() => setShowCustomEjModal(true)}
                      >
                        <FaPlus /> Crear mi ejercicio
                      </button>
                    </div>

                    <div className="sr-selector-filter-row">
                      <div className="sr-search-box-sm">
                        <FaSearch style={{ color: '#64748b' }} />
                        <input
                          type="text"
                          placeholder="Buscar entre mis ejercicios..."
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
                    </div>

                    <div className="sr-selector-list">
                      {catalogoPropioFiltrado.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                          Todavía no tenés ejercicios propios cargados. Creá uno desde "+ Crear mi ejercicio".
                        </p>
                      ) : (
                        catalogoPropioFiltrado.map((ej) => {
                          const isSelected = modalEjerciciosSeleccionados.some(
                            (it) => it.id_ejercicio_socio === ej.id_ejercicio_socio
                          );
                          return (
                            <div
                              key={ej.id_ejercicio_socio}
                              className={`sr-selector-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleToggleEjercicioModal(ej)}
                            >
                              <div className="sr-selector-checkbox">{isSelected ? <FaCheck /> : null}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="sr-item-name">{ej.nombre}</span>
                                  <span className="sr-tag-origen-sm propio">Propio</span>
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
                  <FaCheck /> {guardandoRutina ? 'Guardando...' : editingRutina ? 'Guardar Cambios' : 'Crear Rutina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AGREGAR / EDITAR EJERCICIO PROPIO EN RUTINA PERSONAL */}
      {showAddEjModal && (
        <div className="sr-modal-overlay" onClick={() => setShowAddEjModal(false)}>
          <div className="sr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sr-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaDumbbell style={{ color: '#22c55e' }} />
                <h3>{editingEjercicioItem ? 'Modificar Parámetros' : 'Agregar Ejercicio Personal'}</h3>
              </div>
              <button type="button" className="sr-modal-close-btn" onClick={() => setShowAddEjModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveEjercicioEnRutina}>
              <div className="sr-modal-body">
                {!editingEjercicioItem && (
                  <div className="sr-form-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label>Seleccionar Mi Ejercicio *</label>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#a3e635', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        onClick={() => setShowCustomEjModal(true)}
                      >
                        + Crear nuevo ejercicio
                      </button>
                    </div>
                    <select
                      className="sr-form-select"
                      value={ejercicioFormData.id_ejercicio_socio}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, id_ejercicio_socio: e.target.value })}
                      required
                    >
                      <option value="">-- Elegí uno de tus ejercicios propios --</option>
                      {ejerciciosPropios.map((ej) => (
                        <option key={ej.id_ejercicio_socio} value={ej.id_ejercicio_socio}>
                          {ej.nombre} ({ej.grupo_muscular || 'General'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="sr-form-grid-2">
                  <div className="sr-form-field">
                    <label>Series</label>
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
                    <label>Repeticiones</label>
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
                  </div>
                  <div className="sr-form-field">
                    <label>Descanso (segundos)</label>
                    <input
                      type="number"
                      min="0"
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

      {/* MODAL 3: CREAR EJERCICIO PERSONAL PROPIO */}
      {showCustomEjModal && (
        <div className="sr-modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowCustomEjModal(false)}>
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
                    placeholder="Ej: Press de pecho con mancuernas"
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
                  <label>Instrucciones de Técnica (Opcional)</label>
                  <textarea
                    rows="2"
                    className="sr-form-textarea"
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

      {/* MODAL 4: MODO ENTRENAMIENTO INTERACTIVO */}
      {workoutModalOpen && workoutPayload && (
        <div className="sr-modal-overlay" onClick={handleCerrarEntrenamiento}>
          <div className="sr-workout-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sr-workout-header">
              <div>
                <span className="sr-badge-live"><span className="live-dot"></span> EN SESIÓN</span>
                <h2>{workoutPayload.nombre}</h2>
              </div>

              <div className="sr-workout-timers-bar">
                <div className="sr-timer-box main">
                  <FaStopwatch />
                  <span>{formatTime(workoutTimerSeconds)}</span>
                </div>

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
                    const total = workoutPayload.items.length;
                    alert(`¡Entrenamiento finalizado!\nTiempo: ${formatTime(workoutTimerSeconds)}\nEjercicios completados: ${hechos} de ${total}.`);
                    handleCerrarEntrenamiento();
                  }}
                >
                  <FaCheck /> Terminar Sesión
                </button>

                <button type="button" className="sr-workout-close-x" onClick={handleCerrarEntrenamiento}>
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="sr-rest-quick-bar">
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Descansar:</span>
              <button onClick={() => iniciarTimerDescanso(30)} className="sr-quick-rest-btn">30s</button>
              <button onClick={() => iniciarTimerDescanso(60)} className="sr-quick-rest-btn">60s</button>
              <button onClick={() => iniciarTimerDescanso(90)} className="sr-quick-rest-btn">90s</button>
              <button onClick={() => iniciarTimerDescanso(120)} className="sr-quick-rest-btn">120s</button>
            </div>

            <div className="sr-workout-exercises-list">
              {workoutPayload.items.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>
                  Esta rutina aún no tiene ejercicios cargados.
                </p>
              ) : (
                workoutPayload.items.map((item, idx) => {
                  const hecho = Boolean(ejerciciosCompletados[item.key]);
                  return (
                    <div
                      key={item.key}
                      className={`sr-workout-ej-row ${hecho ? 'done' : ''}`}
                      onClick={() => toggleEjercicioCompletado(item.key, item.descanso)}
                    >
                      <div className={`sr-workout-check-circle ${hecho ? 'checked' : ''}`}>
                        {hecho && <FaCheck />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, textDecoration: hecho ? 'line-through' : 'none' }}>
                          {idx + 1}. {item.nombre}
                        </h4>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {item.grupo} • {item.series}×{item.repeticiones} • {item.peso > 0 ? `${item.peso} kg` : 'Corporal'} • Descanso {item.descanso}s
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
