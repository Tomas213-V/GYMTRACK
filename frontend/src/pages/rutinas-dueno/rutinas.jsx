/**
 * =========================================================================================
 * ARCHIVO: rutinas.jsx
 * RUTA: frontend/src/pages/rutinas-dueno/rutinas.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Gestión organizacional de Plantillas de Rutina (`rutina_gimnasio`)
 *              y Asignaciones a Socios (`rutinas_asignadas_socio_gimnasio`).
 * =========================================================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import { useGymContext } from '../../context/GymContext';
import {
  fetchRutinasResumen,
  fetchRutinaGimnasioById,
  createRutinaGimnasio,
  updateRutinaGimnasio,
  addEjercicioRutinaGimnasio,
  updateEjercicioRutinaGimnasio,
  removeEjercicioRutinaGimnasio,
  reordenarRutinaGimnasio,
  asignarRutinaASocio,
  reasignarResponsableRutina,
  finalizarAsignacionRutina
} from '../../services/rutinaService';
import { getEjerciciosDueno, crearEjercicioDueno } from '../../services/ejercicioService';
import { fetchSocios } from '../../services/socioService';
import { getEmpleados } from '../../services/empleadoService';
import { formatFechaArgentina } from '../../utils/dateUtils';

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
  FaArrowUp,
  FaArrowDown,
  FaCheck,
  FaBuilding,
  FaUserPlus,
  FaUserTie,
  FaFlagCheckered,
  FaExclamationTriangle,
  FaPowerOff
} from 'react-icons/fa';

import './rutinas.css';

function parseDescripcion(desc) {
  const defaults = {
    tipo: 'Full Body',
    duracion: '60 min',
    dias: 'Lunes, Miércoles, Viernes',
    notas: ''
  };
  if (!desc) return defaults;
  try {
    const parsed = JSON.parse(desc);
    if (parsed && typeof parsed === 'object') {
      return {
        tipo: parsed.tipo || defaults.tipo,
        duracion: parsed.duracion || defaults.duracion,
        dias: parsed.dias || defaults.dias,
        notas: parsed.notas || ''
      };
    }
  } catch {
    return { ...defaults, notas: String(desc) };
  }
  return defaults;
}

export default function Rutinas() {
  const { rol, esEmpleado, usuario, gimnasioActivoId, contextVersion } = useGymContext();

  // Vista activa: 'plantillas' | 'asignaciones'
  const [vistaActiva, setVistaActiva] = useState('plantillas');

  // Datos principales
  const [rutinasGym, setRutinasGym] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [selectedRutina, setSelectedRutina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [exitoMsg, setExitoMsg] = useState('');

  // Catálogos auxiliares
  const [sociosList, setSociosList] = useState([]);
  const [empleadosList, setEmpleadosList] = useState([]);
  const [catalogoEjercicios, setCatalogoEjercicios] = useState([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activas' | 'inactivas'
  const [filtroSocioId, setFiltroSocioId] = useState('');
  const [activeCardMenuId, setActiveCardMenuId] = useState(null);

  // Paginación de plantillas
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modal Crear / Editar Plantilla (`rutina_gimnasio`)
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editingRutina, setEditingRutina] = useState(null);
  const [guardandoRutina, setGuardandoRutina] = useState(false);
  const [rutinaFormData, setRutinaFormData] = useState({
    nombre: '',
    nivel: 'Intermedia',
    tipo: 'Full Body',
    duracion: '60 min',
    dias: 'Lunes, Miércoles, Viernes',
    notas: '',
    estado: true
  });
  const [modalEjerciciosSeleccionados, setModalEjerciciosSeleccionados] = useState([]);
  const [modalSearchEjercicio, setModalSearchEjercicio] = useState('');

  // Modal Agregar / Editar Ejercicio en Plantilla
  const [showEjercicioModal, setShowEjercicioModal] = useState(false);
  const [editingEjercicio, setEditingEjercicio] = useState(null);
  const [ejercicioFormData, setEjercicioFormData] = useState({
    id_ejercicio_gimnasio: '',
    series: 4,
    repeticiones: 12,
    peso: 0,
    descanso: 60,
    orden: 1
  });

  // Submodal Crear Ejercicio del Gimnasio
  const [showNuevoEjModal, setShowNuevoEjModal] = useState(false);
  const [nuevoEjFormData, setNuevoEjFormData] = useState({
    nombre: '',
    grupo_muscular: 'Pecho',
    dificultad: 'Intermedia',
    descripcion: ''
  });
  const [guardandoNuevoEj, setGuardandoNuevoEj] = useState(false);

  // Modal Asignar Plantilla a uno o varios Socios (`POST /rutinas/asignaciones`)
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [sociosSeleccionadosIds, setSociosSeleccionadosIds] = useState([]);
  const [busquedaSocioAsignar, setBusquedaSocioAsignar] = useState('');
  const [asignarFormData, setAsignarFormData] = useState({
    id_rutina_gimnasio: '',
    id_empleado_responsable: '',
    fecha_finalizacion: '',
    observaciones: ''
  });

  // Modal Reasignar Responsable (`PATCH /rutinas/asignaciones/{id}/responsable`)
  const [reasignarTarget, setReasignarTarget] = useState(null);
  const [reasignarForm, setReasignarForm] = useState({
    id_empleado_responsable: '',
    observaciones: ''
  });
  const [guardandoReasignacion, setGuardandoReasignacion] = useState(false);

  // Modal Finalizar Asignación (`PATCH /rutinas/asignaciones/{id}/finalizar`)
  const [finalizarTarget, setFinalizarTarget] = useState(null);
  const [finalizarForm, setFinalizarForm] = useState({
    fecha_finalizacion: new Date().toISOString().split('T')[0],
    observaciones: ''
  });
  const [guardandoFinalizacion, setGuardandoFinalizacion] = useState(false);

  const menuRef = useRef(null);

  const mostrarExito = (msg) => {
    setExitoMsg(msg);
    setTimeout(() => setExitoMsg(''), 5000);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveCardMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cargarCatalogos = useCallback(async () => {
    if (!gimnasioActivoId) return;
    try {
      const [ejData, socRes, empRes] = await Promise.all([
        getEjerciciosDueno({ id_gimnasio: gimnasioActivoId }).catch(() => []),
        fetchSocios({ limit: 200, id_gimnasio: gimnasioActivoId }).catch(() => ({ socios: [] })),
        esEmpleado
          ? Promise.resolve(usuario?.id_empleado ? [usuario] : [])
          : getEmpleados({ id_gimnasio: gimnasioActivoId }).catch(() => [])
      ]);
      setCatalogoEjercicios(Array.isArray(ejData) ? ejData : []);
      setSociosList(Array.isArray(socRes?.socios) ? socRes.socios : []);
      const empLista = Array.isArray(empRes)
        ? empRes
        : Array.isArray(empRes?.empleados)
        ? empRes.empleados
        : [];
      setEmpleadosList(empLista);
    } catch (err) {
      console.error('Error cargando catálogos de rutinas:', err);
    }
  }, [gimnasioActivoId, esEmpleado, usuario]);

  const cargarRutinasYAsignaciones = useCallback(async (preservarId = null) => {
    if (!gimnasioActivoId) {
      setRutinasGym([]);
      setAsignaciones([]);
      setSelectedRutina(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetchRutinasResumen({ id_gimnasio: gimnasioActivoId });
      const plantillas = Array.isArray(res?.rutinas_gimnasio) ? res.rutinas_gimnasio : [];
      const asigs = Array.isArray(res?.asignaciones) ? res.asignaciones : [];
      setRutinasGym(plantillas);
      setAsignaciones(asigs);

      setSelectedRutina((prev) => {
        if (plantillas.length === 0) return null;
        if (preservarId) {
          return plantillas.find((r) => String(r.id_rutina_gimnasio) === String(preservarId)) || plantillas[0];
        }
        if (prev) {
          return plantillas.find((r) => r.id_rutina_gimnasio === prev.id_rutina_gimnasio) || plantillas[0];
        }
        return plantillas[0];
      });
    } catch (err) {
      setErrorMsg(err.message || 'No se pudieron cargar las rutinas del gimnasio.');
    } finally {
      setLoading(false);
    }
  }, [gimnasioActivoId]);

  useEffect(() => {
    cargarCatalogos();
    cargarRutinasYAsignaciones();
  }, [cargarCatalogos, cargarRutinasYAsignaciones, contextVersion]);

  // Empleados activos elegibles para ser responsables de una asignación
  const empleadosActivos = useMemo(() => {
    return empleadosList.filter((e) => e.estado !== false);
  }, [empleadosList]);

  // Socios con asociación activa (`id_socio_gimnasio`)
  const sociosAsignables = useMemo(() => {
    return sociosList.filter((s) => s.id_socio_gimnasio && s.estado !== false);
  }, [sociosList]);

  // Socios filtrados dentro del modal "Asignar a usuarios" (siempre declarado antes de cualquier return)
  const sociosAsignablesFiltrados = useMemo(() => {
    const q = busquedaSocioAsignar.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    if (!q) return sociosAsignables;
    return sociosAsignables.filter((s) => {
      const nom = `${s.nombre || ''} ${s.apellido || ''}`.toLowerCase();
      const dni = String(s.dni || '').toLowerCase();
      const dniDigits = dni.replace(/\D/g, '');
      return (
        nom.includes(q) ||
        dni.includes(q) ||
        (qDigits.length > 0 && dniDigits.includes(qDigits))
      );
    });
  }, [sociosAsignables, busquedaSocioAsignar]);

  // Filtrado de plantillas
  const plantillasFiltradas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rutinasGym.filter((r) => {
      if (filtroEstado === 'activas' && r.estado !== true) return false;
      if (filtroEstado === 'inactivas' && r.estado !== false) return false;
      if (q) {
        const nom = (r.nombre || '').toLowerCase();
        const niv = (r.nivel || '').toLowerCase();
        if (!nom.includes(q) && !niv.includes(q)) return false;
      }
      return true;
    });
  }, [rutinasGym, filtroEstado, searchTerm]);

  // Filtrado de asignaciones
  const asignacionesFiltradas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return asignaciones.filter((a) => {
      if (filtroEstado === 'activas' && a.estado !== true) return false;
      if (filtroEstado === 'inactivas' && a.estado !== false) return false;
      if (filtroSocioId) {
        const sid = a.socio_gimnasio?.id_socio ?? a.socio_gimnasio?.socio?.id_socio;
        if (String(sid) !== String(filtroSocioId)) return false;
      }
      if (q) {
        const rutNom = (a.rutina_gimnasio?.nombre || '').toLowerCase();
        const socObj = a.socio_gimnasio?.socio || {};
        const socStr = `${socObj.nombre || ''} ${socObj.apellido || ''} ${socObj.dni || ''}`.toLowerCase();
        const empObj = a.empleado || {};
        const empStr = `${empObj.nombre || ''} ${empObj.apellido || ''}`.toLowerCase();
        if (!rutNom.includes(q) && !socStr.includes(q) && !empStr.includes(q)) return false;
      }
      return true;
    });
  }, [asignaciones, filtroEstado, filtroSocioId, searchTerm]);

  // Paginación de plantillas
  const totalCards = plantillasFiltradas.length;
  const totalPages = Math.ceil(totalCards / itemsPerPage) || 1;
  const paginatedRutinas = plantillasFiltradas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Asignaciones vinculadas a la plantilla actualmente seleccionada
  const asignacionesDeSeleccionada = useMemo(() => {
    if (!selectedRutina) return [];
    return asignaciones.filter(
      (a) => a.id_rutina_gimnasio === selectedRutina.id_rutina_gimnasio
    );
  }, [asignaciones, selectedRutina]);

  if (rol === 'socio') {
    return <Navigate to="/rutinas-socio" replace />;
  }

  // --------------------------------------------------------------------------
  // CRUD DE PLANTILLAS (`rutina_gimnasio`)
  // --------------------------------------------------------------------------
  const handleOpenNuevaRutina = () => {
    setEditingRutina(null);
    setRutinaFormData({
      nombre: '',
      nivel: 'Intermedia',
      tipo: 'Full Body',
      duracion: '60 min',
      dias: 'Lunes, Miércoles, Viernes',
      notas: 'Mantener buena técnica en todos los ejercicios. Descansos de 60-90 segundos entre series.',
      estado: true
    });
    setModalEjerciciosSeleccionados([]);
    setModalSearchEjercicio('');
    setShowRutinaModal(true);
  };

  const handleOpenEditRutina = (rutina) => {
    setActiveCardMenuId(null);
    setEditingRutina(rutina);
    const meta = parseDescripcion(rutina.descripcion);
    setRutinaFormData({
      nombre: rutina.nombre || '',
      nivel: rutina.nivel || 'Intermedia',
      tipo: meta.tipo,
      duracion: meta.duracion,
      dias: meta.dias,
      notas: meta.notas,
      estado: rutina.estado !== false
    });
    setModalEjerciciosSeleccionados([]);
    setModalSearchEjercicio('');
    setShowRutinaModal(true);
  };

  const handleToggleEjercicioEnModal = (ej) => {
    const ejId = ej.id_ejercicio_gimnasio;
    const existe = modalEjerciciosSeleccionados.some((it) => it.id_ejercicio_gimnasio === ejId);
    if (existe) {
      setModalEjerciciosSeleccionados((prev) =>
        prev.filter((it) => it.id_ejercicio_gimnasio !== ejId)
      );
    } else {
      setModalEjerciciosSeleccionados((prev) => [
        ...prev,
        {
          id_ejercicio_gimnasio: ejId,
          nombre: ej.nombre,
          grupo_muscular: ej.grupo_muscular || 'General',
          series: 4,
          repeticiones: 12,
          peso: 0,
          descanso: 60
        }
      ]);
    }
  };

  const handleUpdateParamEjercicioModal = (ejId, campo, valor) => {
    setModalEjerciciosSeleccionados((prev) =>
      prev.map((it) => (it.id_ejercicio_gimnasio === ejId ? { ...it, [campo]: valor } : it))
    );
  };

  const handleSaveRutina = async (e) => {
    e.preventDefault();
    if (!rutinaFormData.nombre.trim()) {
      alert('El nombre de la rutina es obligatorio.');
      return;
    }

    setGuardandoRutina(true);
    setErrorMsg('');
    try {
      const descripcion = JSON.stringify({
        tipo: rutinaFormData.tipo,
        duracion: rutinaFormData.duracion,
        dias: rutinaFormData.dias,
        notas: rutinaFormData.notas
      });

      let saved;
      if (editingRutina) {
        saved = await updateRutinaGimnasio(editingRutina.id_rutina_gimnasio, {
          nombre: rutinaFormData.nombre.trim(),
          nivel: rutinaFormData.nivel,
          descripcion,
          estado: rutinaFormData.estado
        });
        mostrarExito(`Plantilla "${rutinaFormData.nombre.trim()}" actualizada correctamente.`);
      } else {
        saved = await createRutinaGimnasio({
          nombre: rutinaFormData.nombre.trim(),
          nivel: rutinaFormData.nivel,
          descripcion,
          estado: rutinaFormData.estado,
          id_gimnasio: gimnasioActivoId ? Number(gimnasioActivoId) : null
        });

        const newId = saved?.id_rutina_gimnasio;
        if (newId && modalEjerciciosSeleccionados.length > 0) {
          for (let i = 0; i < modalEjerciciosSeleccionados.length; i++) {
            const it = modalEjerciciosSeleccionados[i];
            await addEjercicioRutinaGimnasio(newId, {
              id_ejercicio_gimnasio: it.id_ejercicio_gimnasio,
              series: Number(it.series || 4),
              repeticiones: Number(it.repeticiones || 12),
              peso: Number(it.peso || 0),
              descanso: Number(it.descanso || 60),
              orden: i + 1
            });
          }
        }
        mostrarExito(`Plantilla "${rutinaFormData.nombre.trim()}" creada correctamente.`);
      }

      setShowRutinaModal(false);
      await cargarRutinasYAsignaciones(saved?.id_rutina_gimnasio || editingRutina?.id_rutina_gimnasio);
    } catch (err) {
      alert(err.message || 'Error al guardar la plantilla de rutina.');
    } finally {
      setGuardandoRutina(false);
    }
  };

  const handleToggleEstadoRutina = async (rutina) => {
    setActiveCardMenuId(null);
    const estaActiva = rutina.estado !== false;
    const accion = estaActiva ? 'desactivar' : 'reactivar';
    const detalleMsg = estaActiva
      ? `¿Deseás desactivar la plantilla "${rutina.nombre}"? Pasará a estado inactiva para conservarla por si se vuelve a usar, sin borrarla definitivamente.`
      : `¿Deseás reactivar la plantilla "${rutina.nombre}" para volver a asignarla a los socios?`;

    if (!window.confirm(detalleMsg)) {
      return;
    }
    try {
      await updateRutinaGimnasio(rutina.id_rutina_gimnasio, { estado: !estaActiva });
      mostrarExito(
        estaActiva
          ? `Plantilla "${rutina.nombre}" desactivada correctamente (conservada en historial).`
          : `Plantilla "${rutina.nombre}" reactivada correctamente.`
      );
      await cargarRutinasYAsignaciones(rutina.id_rutina_gimnasio);
    } catch (err) {
      alert(err.message || `Error al ${accion} la rutina.`);
    }
  };

  // --------------------------------------------------------------------------
  // EJERCICIOS DENTRO DE LA PLANTILLA (`rutina_ejercicio_gimnasio`)
  // --------------------------------------------------------------------------
  const handleOpenAddEjercicio = () => {
    if (!selectedRutina) return;
    setEditingEjercicio(null);
    const items = selectedRutina.rutina_ejercicio_gimnasio || [];
    const usados = new Set(items.map((it) => it.id_ejercicio_gimnasio));
    const disponible = catalogoEjercicios.find(
      (ej) => ej.estado !== false && !usados.has(ej.id_ejercicio_gimnasio)
    );
    setEjercicioFormData({
      id_ejercicio_gimnasio: disponible?.id_ejercicio_gimnasio || '',
      series: 4,
      repeticiones: 12,
      peso: 20,
      descanso: 60,
      orden: items.length + 1
    });
    setShowEjercicioModal(true);
  };

  const handleOpenEditEjercicio = (item) => {
    setEditingEjercicio(item);
    setEjercicioFormData({
      id_ejercicio_gimnasio: item.id_ejercicio_gimnasio,
      series: item.series || 4,
      repeticiones: Number(item.repeticiones) || 12,
      peso: item.peso || 0,
      descanso: item.descanso || 60,
      orden: item.orden || 1
    });
    setShowEjercicioModal(true);
  };

  const handleSaveEjercicio = async (e) => {
    e.preventDefault();
    if (!selectedRutina) return;
    try {
      const rutId = selectedRutina.id_rutina_gimnasio;
      if (editingEjercicio) {
        await updateEjercicioRutinaGimnasio(rutId, editingEjercicio.id_rutina_ejercicio_gimnasio, {
          series: Number(ejercicioFormData.series),
          repeticiones: Number(ejercicioFormData.repeticiones),
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
        mostrarExito('Parámetros del ejercicio actualizados.');
      } else {
        await addEjercicioRutinaGimnasio(rutId, {
          id_ejercicio_gimnasio: Number(ejercicioFormData.id_ejercicio_gimnasio),
          series: Number(ejercicioFormData.series),
          repeticiones: Number(ejercicioFormData.repeticiones),
          peso: Number(ejercicioFormData.peso),
          descanso: Number(ejercicioFormData.descanso),
          orden: Number(ejercicioFormData.orden)
        });
        mostrarExito('Ejercicio agregado a la plantilla.');
      }

      setShowEjercicioModal(false);
      const refreshed = await fetchRutinaGimnasioById(rutId);
      setSelectedRutina(refreshed);
      await cargarRutinasYAsignaciones(rutId);
    } catch (err) {
      alert(err.message || 'Error al guardar el ejercicio en la rutina.');
    }
  };

  const handleDeleteEjercicio = async (idItem) => {
    if (!selectedRutina) return;
    if (!window.confirm('¿Seguro que deseás quitar este ejercicio de la plantilla?')) return;
    try {
      const rutId = selectedRutina.id_rutina_gimnasio;
      await removeEjercicioRutinaGimnasio(rutId, idItem);
      const refreshed = await fetchRutinaGimnasioById(rutId);
      setSelectedRutina(refreshed);
      await cargarRutinasYAsignaciones(rutId);
      mostrarExito('Ejercicio retirado de la plantilla.');
    } catch (err) {
      alert(err.message || 'Error al quitar el ejercicio.');
    }
  };

  const handleMoverEjercicio = async (index, direccion) => {
    if (!selectedRutina) return;
    const lista = [...(selectedRutina.rutina_ejercicio_gimnasio || [])];
    const targetIdx = index + direccion;
    if (targetIdx < 0 || targetIdx >= lista.length) return;

    const [movido] = lista.splice(index, 1);
    lista.splice(targetIdx, 0, movido);
    const idsOrdenados = lista.map((it) => it.id_rutina_ejercicio_gimnasio);

    try {
      const rutId = selectedRutina.id_rutina_gimnasio;
      await reordenarRutinaGimnasio(rutId, idsOrdenados);
      const refreshed = await fetchRutinaGimnasioById(rutId);
      setSelectedRutina(refreshed);
      await cargarRutinasYAsignaciones(rutId);
      mostrarExito('Orden de ejercicios actualizado.');
    } catch (err) {
      alert(err.message || 'No se pudo reordenar los ejercicios.');
    }
  };

  // --------------------------------------------------------------------------
  // CREAR EJERCICIO DEL GIMNASIO (`ejercicio_gimnasio`)
  // --------------------------------------------------------------------------
  const handleSaveNuevoEjercicioGym = async (e) => {
    e.preventDefault();
    if (!nuevoEjFormData.nombre.trim()) return;
    setGuardandoNuevoEj(true);
    try {
      const creado = await crearEjercicioDueno({
        nombre: nuevoEjFormData.nombre.trim(),
        grupo_muscular: nuevoEjFormData.grupo_muscular,
        dificultad: nuevoEjFormData.dificultad,
        descripcion: nuevoEjFormData.descripcion.trim() || null,
        id_gimnasio: gimnasioActivoId ? Number(gimnasioActivoId) : null
      });
      setShowNuevoEjModal(false);
      setNuevoEjFormData({ nombre: '', grupo_muscular: 'Pecho', dificultad: 'Intermedia', descripcion: '' });
      await cargarCatalogos();

      if (showRutinaModal && creado?.id_ejercicio_gimnasio) {
        setModalEjerciciosSeleccionados((prev) => [
          ...prev,
          {
            id_ejercicio_gimnasio: creado.id_ejercicio_gimnasio,
            nombre: creado.nombre,
            grupo_muscular: creado.grupo_muscular || 'General',
            series: 4,
            repeticiones: 12,
            peso: 0,
            descanso: 60
          }
        ]);
      }
      if (showEjercicioModal && creado?.id_ejercicio_gimnasio) {
        setEjercicioFormData((prev) => ({
          ...prev,
          id_ejercicio_gimnasio: creado.id_ejercicio_gimnasio
        }));
      }
      mostrarExito(`Ejercicio "${creado.nombre}" agregado al catálogo del gimnasio.`);
    } catch (err) {
      alert(err.message || 'Error al crear el ejercicio del gimnasio.');
    } finally {
      setGuardandoNuevoEj(false);
    }
  };

  // --------------------------------------------------------------------------
  // ASIGNACIONES DE RUTINAS A UNO O VARIOS SOCIOS (`rutinas_asignadas_socio_gimnasio`)
  // --------------------------------------------------------------------------
  const handleOpenAsignarModal = (plantilla = null) => {
    setActiveCardMenuId(null);
    const defaultRut = plantilla || selectedRutina || rutinasGym.find((r) => r.estado !== false);
    setAsignarFormData({
      id_rutina_gimnasio: defaultRut?.id_rutina_gimnasio ? String(defaultRut.id_rutina_gimnasio) : '',
      id_empleado_responsable:
        esEmpleado && usuario?.id_empleado ? String(usuario.id_empleado) : '',
      fecha_finalizacion: '',
      observaciones: ''
    });
    setSociosSeleccionadosIds([]);
    setBusquedaSocioAsignar('');
    setShowAsignarModal(true);
  };

  const handleToggleSocioAsignar = (idSocioGimnasio) => {
    const idStr = String(idSocioGimnasio);
    setSociosSeleccionadosIds((prev) =>
      prev.includes(idStr) ? prev.filter((item) => item !== idStr) : [...prev, idStr]
    );
  };

  const handleToggleTodosSociosAsignar = () => {
    const visiblesIds = sociosAsignablesFiltrados.map((s) => String(s.id_socio_gimnasio));
    const todosMarcados =
      visiblesIds.length > 0 && visiblesIds.every((id) => sociosSeleccionadosIds.includes(id));
    if (todosMarcados) {
      setSociosSeleccionadosIds((prev) => prev.filter((id) => !visiblesIds.includes(id)));
    } else {
      setSociosSeleccionadosIds((prev) => Array.from(new Set([...prev, ...visiblesIds])));
    }
  };

  const handleGuardarAsignacion = async (e) => {
    e.preventDefault();
    if (!asignarFormData.id_rutina_gimnasio || sociosSeleccionadosIds.length === 0) {
      alert('Debés seleccionar una plantilla y al menos un socio asociado al gimnasio.');
      return;
    }
    setGuardandoAsignacion(true);
    let exitosos = 0;
    const errores = [];
    try {
      for (const sgId of sociosSeleccionadosIds) {
        try {
          await asignarRutinaASocio({
            id_rutina_gimnasio: Number(asignarFormData.id_rutina_gimnasio),
            id_socio_gimnasio: Number(sgId),
            id_empleado_responsable: asignarFormData.id_empleado_responsable
              ? Number(asignarFormData.id_empleado_responsable)
              : null,
            fecha_finalizacion: asignarFormData.fecha_finalizacion || null,
            observaciones: asignarFormData.observaciones.trim() || null
          });
          exitosos += 1;
        } catch (errItem) {
          const socioObj = sociosAsignables.find((s) => String(s.id_socio_gimnasio) === String(sgId));
          const etiqueta = socioObj ? `${socioObj.nombre} ${socioObj.apellido}`.trim() : `Socio #${sgId}`;
          errores.push(`${etiqueta}: ${errItem.message || 'error al asignar'}`);
        }
      }

      if (exitosos > 0) {
        setShowAsignarModal(false);
        const resumen =
          errores.length === 0
            ? `Rutina asignada exitosamente a ${exitosos} ${exitosos === 1 ? 'usuario' : 'usuarios'}.`
            : `Rutina asignada a ${exitosos} usuario(s). Omitidos (${errores.length}): ${errores.join(' | ')}`;
        mostrarExito(resumen);
        await cargarRutinasYAsignaciones(selectedRutina?.id_rutina_gimnasio);
      } else {
        alert(`No se pudo asignar la rutina:\n${errores.join('\n')}`);
      }
    } finally {
      setGuardandoAsignacion(false);
    }
  };

  const handleOpenReasignar = (asig) => {
    setReasignarTarget(asig);
    setReasignarForm({
      id_empleado_responsable: empleadosActivos[0]?.id_empleado ? String(empleadosActivos[0].id_empleado) : '',
      observaciones: asig.observaciones || ''
    });
  };

  const handleConfirmReasignar = async (e) => {
    e.preventDefault();
    if (!reasignarTarget || !reasignarForm.id_empleado_responsable) return;
    setGuardandoReasignacion(true);
    try {
      const res = await reasignarResponsableRutina(reasignarTarget.id_rutina_asignada, {
        id_empleado_responsable: Number(reasignarForm.id_empleado_responsable),
        observaciones: reasignarForm.observaciones
      });
      setReasignarTarget(null);
      mostrarExito(res?.mensaje || 'Responsable reasignado exitosamente.');
      await cargarRutinasYAsignaciones(selectedRutina?.id_rutina_gimnasio);
    } catch (err) {
      alert(err.message || 'No se pudo reasignar el responsable.');
    } finally {
      setGuardandoReasignacion(false);
    }
  };

  const handleOpenFinalizar = (asig) => {
    setFinalizarTarget(asig);
    setFinalizarForm({
      fecha_finalizacion: new Date().toISOString().split('T')[0],
      observaciones: asig.observaciones || ''
    });
  };

  const handleConfirmFinalizar = async (e) => {
    e.preventDefault();
    if (!finalizarTarget) return;
    setGuardandoFinalizacion(true);
    try {
      const res = await finalizarAsignacionRutina(finalizarTarget.id_rutina_asignada, {
        fecha_finalizacion: finalizarForm.fecha_finalizacion || null,
        observaciones: finalizarForm.observaciones.trim() || null
      });
      setFinalizarTarget(null);
      mostrarExito(res?.mensaje || 'Asignación finalizada conservando el responsable histórico.');
      await cargarRutinasYAsignaciones(selectedRutina?.id_rutina_gimnasio);
    } catch (err) {
      alert(err.message || 'No se pudo finalizar la asignación.');
    } finally {
      setGuardandoFinalizacion(false);
    }
  };

  // Filtrado catálogo ejercicios en modal
  const catalogoFiltradoModal = catalogoEjercicios.filter((ej) => {
    if (ej.estado === false) return false;
    if (modalSearchEjercicio.trim()) {
      const q = modalSearchEjercicio.toLowerCase();
      return (
        (ej.nombre || '').toLowerCase().includes(q) ||
        (ej.grupo_muscular || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedMeta = selectedRutina ? parseDescripcion(selectedRutina.descripcion) : null;
  const ejerciciosDeRutina = selectedRutina?.rutina_ejercicio_gimnasio || [];

  return (
    <div className="rutinas-layout">
      <NavGlobal />

      <div className="rutinas-body">
        <Sidebar />

        <main className="rutinas-main-content">
          {/* 1. HEADER & ACCIONES */}
          <section className="rut-header-section">
            <div className="rut-header-topbar">
              <div className="rut-title-container">
                <div className="rut-title-icon-badge">
                  <FaDumbbell />
                </div>
                <div className="rut-title-texts">
                  <h1>Gestión de Rutinas</h1>
                  <p>Creá plantillas reutilizables del gimnasio y asignalas a tus socios sin duplicarlas</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="rut-btn-create-custom-ej"
                  onClick={() => setShowNuevoEjModal(true)}
                >
                  <FaPlus /> Ejercicio del gimnasio
                </button>
                <button
                  type="button"
                  className="rut-btn-create-custom-ej"
                  onClick={() => handleOpenAsignarModal()}
                  disabled={rutinasGym.length === 0 || sociosAsignables.length === 0}
                >
                  <FaUserPlus /> Asignar a usuarios
                </button>
                <button type="button" className="rut-btn-primary" onClick={handleOpenNuevaRutina}>
                  <FaPlus /> Nueva plantilla
                </button>
              </div>
            </div>

            {exitoMsg && (
              <div
                style={{
                  background: 'rgba(163, 230, 53, 0.14)',
                  border: '1px solid rgba(163, 230, 53, 0.4)',
                  color: '#bef264',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13.5px'
                }}
              >
                <span><FaCheck style={{ marginRight: '8px' }} />{exitoMsg}</span>
                <button type="button" onClick={() => setExitoMsg('')} style={{ background: 'none', border: 'none', color: '#bef264', cursor: 'pointer' }}>
                  <FaTimes />
                </button>
              </div>
            )}

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.14)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13.5px'
                }}
              >
                <span><FaExclamationTriangle style={{ marginRight: '8px' }} />{errorMsg}</span>
                <button type="button" onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>
                  <FaTimes />
                </button>
              </div>
            )}

            {/* Pestañas Plantillas vs Asignaciones */}
            <div className="rut-origin-tabs" style={{ marginBottom: '14px' }}>
              <button
                type="button"
                className={`rut-origin-tab-btn gimnasio-tab ${vistaActiva === 'plantillas' ? 'active' : ''}`}
                onClick={() => setVistaActiva('plantillas')}
              >
                <FaBuilding style={{ marginRight: '6px' }} />
                Plantillas del Gimnasio ({rutinasGym.length})
              </button>
              <button
                type="button"
                className={`rut-origin-tab-btn propio-tab ${vistaActiva === 'asignaciones' ? 'active' : ''}`}
                onClick={() => setVistaActiva('asignaciones')}
              >
                <FaUserPlus style={{ marginRight: '6px' }} />
                Asignaciones a Socios ({asignaciones.length})
              </button>
            </div>

            {/* Barra de Filtros */}
            <div className="rut-filters-bar">
              <div className="rut-filter-box">
                <FaSearch className="rut-filter-icon" />
                <input
                  type="text"
                  className="rut-filter-input"
                  placeholder={
                    vistaActiva === 'plantillas'
                      ? 'Buscar plantilla por nombre o nivel...'
                      : 'Buscar por rutina, socio, DNI o responsable...'
                  }
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {vistaActiva === 'asignaciones' && (
                <div className="rut-filter-box">
                  <FaUser className="rut-filter-icon" />
                  <select
                    className="rut-filter-input"
                    value={filtroSocioId}
                    onChange={(e) => setFiltroSocioId(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}
                  >
                    <option value="" style={{ background: '#141921' }}>Todos los socios</option>
                    {sociosList.map((s) => (
                      <option key={s.id_socio} value={s.id_socio} style={{ background: '#141921' }}>
                        {s.nombre} {s.apellido} {s.dni ? `(${s.dni})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rut-filter-box">
                <FaListUl className="rut-filter-icon" />
                <select
                  className="rut-filter-input"
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}
                >
                  <option value="todos" style={{ background: '#141921' }}>Todos los estados</option>
                  <option value="activas" style={{ background: '#141921' }}>Solo activas</option>
                  <option value="inactivas" style={{ background: '#141921' }}>
                    {vistaActiva === 'plantillas' ? 'Inactivas' : 'Finalizadas'}
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* 2A. VISTA PLANTILLAS DEL GIMNASIO */}
          {vistaActiva === 'plantillas' ? (
            <div className="rut-master-detail-grid">
              {/* COLUMNA IZQUIERDA */}
              <div className="rut-card-list-panel">
                <h2>Plantillas del gimnasio</h2>

                <div className="rut-routine-cards-stack" ref={menuRef}>
                  {loading ? (
                    <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>Cargando plantillas...</p>
                  ) : paginatedRutinas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                      <FaDumbbell style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.4 }} />
                      <p style={{ margin: 0, fontSize: '14px' }}>No hay plantillas registradas.</p>
                      <button
                        type="button"
                        className="rut-btn-primary"
                        style={{ margin: '14px auto 0 auto' }}
                        onClick={handleOpenNuevaRutina}
                      >
                        Crear primera plantilla
                      </button>
                    </div>
                  ) : (
                    paginatedRutinas.map((r) => {
                      const isSelected = selectedRutina?.id_rutina_gimnasio === r.id_rutina_gimnasio;
                      const meta = parseDescripcion(r.descripcion);
                      const cantEjercicios = r.rutina_ejercicio_gimnasio?.length || 0;
                      const asigsActivas = asignaciones.filter(
                        (a) => a.id_rutina_gimnasio === r.id_rutina_gimnasio && a.estado === true
                      ).length;

                      return (
                        <div
                          key={r.id_rutina_gimnasio}
                          className={`rut-routine-card ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedRutina(r)}
                        >
                          <div className="rut-card-thumb">
                            <FaDumbbell />
                          </div>

                          <div className="rut-card-info">
                            <h4 className="rut-card-title">{r.nombre}</h4>
                            <p className="rut-card-socio">
                              Nivel: {r.nivel || 'General'} • {asigsActivas} socio{asigsActivas === 1 ? '' : 's'} activo{asigsActivas === 1 ? '' : 's'}
                            </p>

                            <div className="rut-card-pills-row">
                              <span className="rut-pill-category">{meta.tipo}</span>
                              <span className="rut-pill-count">{cantEjercicios} ejercicios</span>
                            </div>
                          </div>

                          <div className="rut-card-right-col">
                            <span className="rut-status-badge">
                              {r.estado !== false ? 'Activa' : 'Inactiva'}
                            </span>
                            <button
                              type="button"
                              className="rut-card-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCardMenuId(
                                  activeCardMenuId === r.id_rutina_gimnasio ? null : r.id_rutina_gimnasio
                                );
                              }}
                            >
                              <FaEllipsisV />
                            </button>

                            {activeCardMenuId === r.id_rutina_gimnasio && (
                              <div className="rut-card-context-menu" onClick={(e) => e.stopPropagation()}>
                                <div className="rut-context-item" onClick={() => handleOpenAsignarModal(r)}>
                                  <FaUserPlus /> Asignar a usuarios
                                </div>
                                <div className="rut-context-item" onClick={() => handleOpenEditRutina(r)}>
                                  <FaEdit /> Editar
                                </div>
                                <div
                                  className={`rut-context-item ${r.estado !== false ? 'delete' : ''}`}
                                  onClick={() => handleToggleEstadoRutina(r)}
                                >
                                  <FaPowerOff /> {r.estado !== false ? 'Desactivar rutina' : 'Reactivar rutina'}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {totalCards > 0 && (
                  <div className="rut-card-list-footer">
                    <span>
                      Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalCards)} -{' '}
                      {Math.min(currentPage * itemsPerPage, totalCards)} de {totalCards}
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

              {/* COLUMNA DERECHA: DETALLE DE PLANTILLA */}
              <div className="rut-detail-panel">
                {selectedRutina ? (
                  <>
                    <div className="rut-detail-header-card">
                      <div className="rut-detail-header-content">
                        <div className="rut-detail-title-row">
                          <h2>{selectedRutina.nombre}</h2>
                          <span className="rut-status-badge">
                            {selectedRutina.estado !== false ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>

                        <div className="rut-detail-meta-row">
                          <div className="rut-detail-meta-item">
                            <FaBuilding style={{ color: '#a3e635' }} />
                            <span>Plantilla organizacional reutilizable</span>
                          </div>
                          <div className="rut-detail-meta-item">
                            <FaCalendarAlt style={{ color: '#a3e635' }} />
                            <span>{selectedMeta?.dias || 'Lunes, Miércoles, Viernes'}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="rut-btn-primary"
                            onClick={() => handleOpenAsignarModal(selectedRutina)}
                            disabled={selectedRutina.estado === false || sociosAsignables.length === 0}
                          >
                            <FaUserPlus /> Asignar a usuarios
                          </button>
                          <button
                            type="button"
                            className="rut-btn-edit-general"
                            onClick={() => handleOpenEditRutina(selectedRutina)}
                          >
                            <FaEdit /> Editar plantilla
                          </button>
                          <button
                            type="button"
                            className="rut-btn-edit-general"
                            onClick={() => handleToggleEstadoRutina(selectedRutina)}
                            style={
                              selectedRutina.estado !== false
                                ? { borderColor: 'rgba(239, 68, 68, 0.35)', color: '#fca5a5' }
                                : { borderColor: 'rgba(163, 230, 53, 0.35)', color: '#bef264' }
                            }
                          >
                            <FaPowerOff /> {selectedRutina.estado !== false ? 'Desactivar' : 'Reactivar'}
                          </button>
                        </div>
                      </div>

                      <div className="rut-detail-banner-img">
                        <FaDumbbell />
                      </div>
                    </div>

                    <div className="rut-detail-info-card">
                      <div className="rut-info-card-top">
                        <h3>Información general</h3>
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
                            <p>Nivel</p>
                            <b>{selectedRutina.nivel || 'Intermedia'}</b>
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

                    {/* Ejercicios de la Plantilla */}
                    <div className="rut-detail-exercises-card">
                      <div className="rut-exercises-card-header">
                        <div className="rut-exercises-card-left">
                          <h3>Ejercicios de la plantilla</h3>
                          <span className="rut-badge-exercise-count">{ejerciciosDeRutina.length} ejercicios</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="rut-btn-create-custom-ej"
                            onClick={() => setShowNuevoEjModal(true)}
                          >
                            <FaPlus /> Nuevo ejercicio gym
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
                              <th>Ejercicio del Gimnasio</th>
                              <th>Series</th>
                              <th>Reps</th>
                              <th>Peso</th>
                              <th>Descanso</th>
                              <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ejerciciosDeRutina.length === 0 ? (
                              <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                                  Aún no hay ejercicios agregados a esta plantilla.
                                </td>
                              </tr>
                            ) : (
                              ejerciciosDeRutina.map((item, idx) => {
                                const ejObj = item.ejercicio_gimnasio || {};
                                return (
                                  <tr key={item.id_rutina_ejercicio_gimnasio || idx}>
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
                                    <td>{item.repeticiones || 12}</td>
                                    <td>{item.peso ? `${item.peso} kg` : 'Corporal'}</td>
                                    <td>{item.descanso ?? 60}s</td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      <button
                                        type="button"
                                        className="rut-btn-icon-action"
                                        disabled={idx === 0}
                                        onClick={() => handleMoverEjercicio(idx, -1)}
                                        title="Subir orden"
                                      >
                                        <FaArrowUp />
                                      </button>
                                      <button
                                        type="button"
                                        className="rut-btn-icon-action"
                                        disabled={idx === ejerciciosDeRutina.length - 1}
                                        onClick={() => handleMoverEjercicio(idx, 1)}
                                        title="Bajar orden"
                                      >
                                        <FaArrowDown />
                                      </button>
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
                                        onClick={() => handleDeleteEjercicio(item.id_rutina_ejercicio_gimnasio)}
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

                    {/* Socios asignados a esta plantilla */}
                    <div className="rut-detail-exercises-card" style={{ marginTop: '16px' }}>
                      <div className="rut-exercises-card-header">
                        <div className="rut-exercises-card-left">
                          <h3>Socios con esta rutina asignada</h3>
                          <span className="rut-badge-exercise-count">{asignacionesDeSeleccionada.length}</span>
                        </div>
                      </div>

                      {asignacionesDeSeleccionada.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '13.5px', padding: '12px 0' }}>
                          Todavía ningún socio tiene asignada esta plantilla.
                        </p>
                      ) : (
                        <div className="rut-table-responsive">
                          <table className="rut-table">
                            <thead>
                              <tr>
                                <th>Socio</th>
                                <th>Responsable</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {asignacionesDeSeleccionada.map((asig) => {
                                const soc = asig.socio_gimnasio?.socio || {};
                                const emp = asig.empleado || null;
                                return (
                                  <tr key={asig.id_rutina_asignada}>
                                    <td>
                                      <strong>{soc.nombre} {soc.apellido}</strong>
                                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>DNI: {soc.dni || '-'}</div>
                                    </td>
                                    <td>
                                      {emp ? (
                                        <>
                                          {emp.nombre} {emp.apellido}
                                          {emp.estado === false && (
                                            <span style={{ marginLeft: '6px', fontSize: '11px', color: '#fbbf24' }}>(Histórico)</span>
                                          )}
                                        </>
                                      ) : (
                                        <span style={{ color: '#64748b' }}>Sin asignar</span>
                                      )}
                                    </td>
                                    <td>
                                      <span className="rut-status-badge">
                                        {asig.estado ? 'Activa' : 'Finalizada'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      {asig.estado && (
                                        <>
                                          <button
                                            type="button"
                                            className="rut-btn-icon-action"
                                            onClick={() => handleOpenReasignar(asig)}
                                            title="Reasignar responsable"
                                          >
                                            <FaUserTie />
                                          </button>
                                          <button
                                            type="button"
                                            className="rut-btn-icon-action delete"
                                            onClick={() => handleOpenFinalizar(asig)}
                                            title="Finalizar asignación"
                                          >
                                            <FaFlagCheckered />
                                          </button>
                                        </>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

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
                    <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>Ninguna plantilla seleccionada</h3>
                    <p style={{ margin: 0 }}>Seleccioná una plantilla o creá una nueva para administrarla.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 2B. VISTA ASIGNACIONES A SOCIOS */
            <div className="rut-detail-exercises-card">
              <div className="rut-exercises-card-header">
                <div className="rut-exercises-card-left">
                  <h3>Asignaciones de Rutinas a Socios</h3>
                  <span className="rut-badge-exercise-count">{asignacionesFiltradas.length} registros</span>
                </div>
                <button
                  type="button"
                  className="rut-btn-primary"
                  onClick={() => handleOpenAsignarModal()}
                  disabled={rutinasGym.length === 0 || sociosAsignables.length === 0}
                >
                  <FaUserPlus /> Nueva asignación
                </button>
              </div>

              <div className="rut-table-responsive">
                <table className="rut-table">
                  <thead>
                    <tr>
                      <th>Socio</th>
                      <th>Plantilla Asignada</th>
                      <th>Responsable</th>
                      <th>Fechas</th>
                      <th>Observaciones</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          Cargando asignaciones...
                        </td>
                      </tr>
                    ) : asignacionesFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          No se encontraron asignaciones con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      asignacionesFiltradas.map((asig) => {
                        const soc = asig.socio_gimnasio?.socio || {};
                        const rg = asig.rutina_gimnasio || {};
                        const emp = asig.empleado || null;
                        return (
                          <tr key={asig.id_rutina_asignada}>
                            <td>
                              <strong>{soc.nombre} {soc.apellido}</strong>
                              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>DNI: {soc.dni || '-'}</div>
                            </td>
                            <td>
                              <strong>{rg.nombre || 'Plantilla'}</strong>
                              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{rg.nivel || 'General'}</div>
                            </td>
                            <td>
                              {emp ? (
                                <>
                                  {emp.nombre} {emp.apellido}
                                  {emp.estado === false && (
                                    <div style={{ fontSize: '11px', color: '#fbbf24' }}>Responsable histórico (inactivo)</div>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#64748b' }}>Sin responsable</span>
                              )}
                            </td>
                            <td style={{ fontSize: '12.5px' }}>
                              <div>Alta: {asig.fecha_asignacion ? formatFechaArgentina(asig.fecha_asignacion) : '-'}</div>
                              {asig.fecha_finalizacion && (
                                <div style={{ color: '#94a3b8' }}>Fin: {formatFechaArgentina(asig.fecha_finalizacion)}</div>
                              )}
                            </td>
                            <td style={{ maxWidth: '220px', fontSize: '12.5px', color: '#cbd5e1' }}>
                              {asig.observaciones || '—'}
                            </td>
                            <td>
                              <span className="rut-status-badge">
                                {asig.estado ? 'Activa' : 'Finalizada'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {asig.estado ? (
                                <>
                                  <button
                                    type="button"
                                    className="rut-btn-icon-action"
                                    onClick={() => handleOpenReasignar(asig)}
                                    title="Reasignar entrenador responsable"
                                  >
                                    <FaUserTie />
                                  </button>
                                  <button
                                    type="button"
                                    className="rut-btn-icon-action delete"
                                    onClick={() => handleOpenFinalizar(asig)}
                                    title="Finalizar asignación"
                                  >
                                    <FaFlagCheckered />
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: '#64748b' }}>Cerrada</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: CREAR / EDITAR PLANTILLA (`rutina_gimnasio`) */}
      {showRutinaModal && (
        <div className="rut-modal-overlay" onClick={() => setShowRutinaModal(false)}>
          <div className="rut-modal-card" style={{ maxWidth: '680px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3>{editingRutina ? 'Editar Plantilla del Gimnasio' : 'Nueva Plantilla del Gimnasio'}</h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setShowRutinaModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveRutina}>
              <div className="rut-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                <div className="rut-form-field">
                  <label>Nombre de la Plantilla *</label>
                  <input
                    type="text"
                    className="rut-form-input"
                    placeholder="Ej: Hipertrofia Tren Superior"
                    value={rutinaFormData.nombre}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, nombre: e.target.value })}
                    required
                  />
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
                      <option value="Pecho - Tríceps">Pecho - Tríceps</option>
                      <option value="Espalda - Bíceps">Espalda - Bíceps</option>
                      <option value="Piernas">Piernas</option>
                      <option value="Fuerza">Fuerza</option>
                      <option value="Hipertrofia">Hipertrofia</option>
                      <option value="Definición">Definición</option>
                    </select>
                  </div>

                  <div className="rut-form-field">
                    <label>Nivel</label>
                    <select
                      className="rut-form-select"
                      value={rutinaFormData.nivel}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, nivel: e.target.value })}
                    >
                      <option value="Principiante">Principiante</option>
                      <option value="Intermedia">Intermedia</option>
                      <option value="Avanzada">Avanzada</option>
                    </select>
                  </div>
                </div>

                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Duración estimada</label>
                    <input
                      type="text"
                      className="rut-form-input"
                      value={rutinaFormData.duracion}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, duracion: e.target.value })}
                    />
                  </div>
                  <div className="rut-form-field">
                    <label>Estado</label>
                    <select
                      className="rut-form-select"
                      value={rutinaFormData.estado ? 'true' : 'false'}
                      onChange={(e) => setRutinaFormData({ ...rutinaFormData, estado: e.target.value === 'true' })}
                    >
                      <option value="true">Activa</option>
                      <option value="false">Inactiva</option>
                    </select>
                  </div>
                </div>

                {!editingRutina && (
                  <div className="rut-exercises-selector-section">
                    <div className="rut-exercises-selector-header">
                      <h4>
                        <FaDumbbell style={{ color: '#a3e635' }} />
                        Ejercicios del Gimnasio ({modalEjerciciosSeleccionados.length} seleccionados)
                      </h4>
                      <button
                        type="button"
                        className="rut-btn-create-custom-ej"
                        onClick={() => setShowNuevoEjModal(true)}
                      >
                        <FaPlus /> Nuevo ejercicio gym
                      </button>
                    </div>

                    <div className="rut-filter-box" style={{ height: '36px', marginBottom: '10px' }}>
                      <FaSearch className="rut-filter-icon" />
                      <input
                        type="text"
                        className="rut-filter-input"
                        placeholder="Filtrar ejercicios oficiales del gimnasio..."
                        value={modalSearchEjercicio}
                        onChange={(e) => setModalSearchEjercicio(e.target.value)}
                      />
                    </div>

                    <div className="rut-available-exercises-list">
                      {catalogoFiltradoModal.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '16px 0' }}>
                          No hay ejercicios activos del gimnasio. Creá uno desde el botón superior.
                        </p>
                      ) : (
                        catalogoFiltradoModal.map((ej) => {
                          const isChecked = modalEjerciciosSeleccionados.some(
                            (it) => it.id_ejercicio_gimnasio === ej.id_ejercicio_gimnasio
                          );
                          return (
                            <div
                              key={ej.id_ejercicio_gimnasio}
                              className={`rut-available-ej-item ${isChecked ? 'selected' : ''}`}
                              onClick={() => handleToggleEjercicioEnModal(ej)}
                            >
                              <div className="rut-available-ej-left">
                                <div className="rut-ej-checkbox">{isChecked && <FaCheck />}</div>
                                <div className="rut-available-ej-info">
                                  <h5>{ej.nombre}</h5>
                                  <span>{ej.grupo_muscular || 'General'}</span>
                                </div>
                              </div>
                              <span className="rut-origin-badge gimnasio">
                                <FaBuilding style={{ fontSize: '9px' }} /> Gimnasio
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {modalEjerciciosSeleccionados.length > 0 && (
                      <div className="rut-selected-ej-stack">
                        {modalEjerciciosSeleccionados.map((item, idx) => (
                          <div key={item.id_ejercicio_gimnasio} className="rut-selected-ej-item">
                            <div className="rut-selected-ej-meta">
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>#{idx + 1}</span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{item.nombre}</span>
                            </div>
                            <div className="rut-selected-ej-inputs">
                              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Series:</label>
                              <input
                                type="number"
                                min="1"
                                className="rut-selected-ej-input-sm"
                                value={item.series}
                                onChange={(e) => handleUpdateParamEjercicioModal(item.id_ejercicio_gimnasio, 'series', Number(e.target.value))}
                              />
                              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Reps:</label>
                              <input
                                type="number"
                                min="1"
                                className="rut-selected-ej-input-sm"
                                value={item.repeticiones}
                                onChange={(e) => handleUpdateParamEjercicioModal(item.id_ejercicio_gimnasio, 'repeticiones', Number(e.target.value))}
                              />
                              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Kg:</label>
                              <input
                                type="number"
                                min="0"
                                className="rut-selected-ej-input-sm"
                                value={item.peso}
                                onChange={(e) => handleUpdateParamEjercicioModal(item.id_ejercicio_gimnasio, 'peso', Number(e.target.value))}
                              />
                              <button
                                type="button"
                                className="rut-btn-remove-selected-ej"
                                onClick={() => handleToggleEjercicioEnModal(item)}
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="rut-form-field" style={{ marginTop: '14px' }}>
                  <label>Notas y Recomendaciones</label>
                  <textarea
                    rows="2"
                    className="rut-form-textarea"
                    value={rutinaFormData.notas}
                    onChange={(e) => setRutinaFormData({ ...rutinaFormData, notas: e.target.value })}
                  />
                </div>
              </div>

              <div className="rut-modal-footer">
                <button type="button" className="rut-btn-cancel" onClick={() => setShowRutinaModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="rut-btn-primary" disabled={guardandoRutina}>
                  <FaCheck /> {guardandoRutina ? 'Guardando...' : editingRutina ? 'Guardar Cambios' : 'Crear Plantilla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AGREGAR / EDITAR EJERCICIO EN PLANTILLA */}
      {showEjercicioModal && (
        <div className="rut-modal-overlay" onClick={() => setShowEjercicioModal(false)}>
          <div className="rut-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3>{editingEjercicio ? 'Editar Ejercicio en Plantilla' : 'Agregar Ejercicio a la Plantilla'}</h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setShowEjercicioModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveEjercicio}>
              <div className="rut-modal-body">
                {!editingEjercicio && (
                  <div className="rut-form-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label>Ejercicio del Gimnasio *</label>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#bef264', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                        onClick={() => setShowNuevoEjModal(true)}
                      >
                        + Crear ejercicio del gimnasio
                      </button>
                    </div>
                    <select
                      className="rut-form-select"
                      value={ejercicioFormData.id_ejercicio_gimnasio}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, id_ejercicio_gimnasio: e.target.value })}
                      required
                    >
                      <option value="">-- Elegir ejercicio del gimnasio --</option>
                      {catalogoEjercicios
                        .filter((ej) => ej.estado !== false)
                        .map((ej) => (
                          <option key={ej.id_ejercicio_gimnasio} value={ej.id_ejercicio_gimnasio}>
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
                    <label>Descanso (seg)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      className="rut-form-input"
                      value={ejercicioFormData.descanso}
                      onChange={(e) => setEjercicioFormData({ ...ejercicioFormData, descanso: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rut-form-field">
                  <label>Orden</label>
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
                  <FaCheck /> {editingEjercicio ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREAR EJERCICIO DEL GIMNASIO */}
      {showNuevoEjModal && (
        <div className="rut-modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowNuevoEjModal(false)}>
          <div className="rut-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3>
                <FaBuilding style={{ color: '#a3e635', marginRight: '6px' }} />
                Crear Ejercicio del Gimnasio
              </h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setShowNuevoEjModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveNuevoEjercicioGym}>
              <div className="rut-modal-body">
                <div className="rut-form-field">
                  <label>Nombre del Ejercicio *</label>
                  <input
                    type="text"
                    className="rut-form-input"
                    placeholder="Ej: Press inclinado con mancuernas"
                    value={nuevoEjFormData.nombre}
                    onChange={(e) => setNuevoEjFormData({ ...nuevoEjFormData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Grupo Muscular</label>
                    <select
                      className="rut-form-select"
                      value={nuevoEjFormData.grupo_muscular}
                      onChange={(e) => setNuevoEjFormData({ ...nuevoEjFormData, grupo_muscular: e.target.value })}
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
                      value={nuevoEjFormData.dificultad}
                      onChange={(e) => setNuevoEjFormData({ ...nuevoEjFormData, dificultad: e.target.value })}
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
                    value={nuevoEjFormData.descripcion}
                    onChange={(e) => setNuevoEjFormData({ ...nuevoEjFormData, descripcion: e.target.value })}
                  />
                </div>
              </div>

              <div className="rut-modal-footer">
                <button type="button" className="rut-btn-cancel" onClick={() => setShowNuevoEjModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="rut-btn-primary" disabled={guardandoNuevoEj}>
                  <FaCheck /> {guardandoNuevoEj ? 'Guardando...' : 'Crear ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ASIGNAR PLANTILLA A UNO O VARIOS USUARIOS */}
      {showAsignarModal && (
        <div className="rut-modal-overlay" onClick={() => setShowAsignarModal(false)}>
          <div className="rut-modal-card" style={{ maxWidth: '580px', width: '94%' }} onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3><FaUserPlus style={{ color: '#a3e635', marginRight: '8px' }} />Asignar Rutina a Usuarios</h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setShowAsignarModal(false)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleGuardarAsignacion}>
              <div className="rut-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                <div className="rut-form-field">
                  <label>Plantilla del Gimnasio *</label>
                  <select
                    className="rut-form-select"
                    value={asignarFormData.id_rutina_gimnasio}
                    onChange={(e) => setAsignarFormData({ ...asignarFormData, id_rutina_gimnasio: e.target.value })}
                    required
                  >
                    <option value="">-- Seleccionar plantilla --</option>
                    {rutinasGym
                      .filter((r) => r.estado !== false)
                      .map((r) => (
                        <option key={r.id_rutina_gimnasio} value={r.id_rutina_gimnasio}>
                          {r.nombre} ({r.nivel || 'General'})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="rut-form-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>
                      Socios del Gimnasio * ({sociosSeleccionadosIds.length} seleccionado{sociosSeleccionadosIds.length === 1 ? '' : 's'})
                    </label>
                    <button
                      type="button"
                      onClick={handleToggleTodosSociosAsignar}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#bef264',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      {sociosAsignablesFiltrados.length > 0 &&
                      sociosAsignablesFiltrados.every((s) =>
                        sociosSeleccionadosIds.includes(String(s.id_socio_gimnasio))
                      )
                        ? 'Deseleccionar visibles'
                        : 'Seleccionar todos'}
                    </button>
                  </div>

                  <div className="rut-filter-box" style={{ height: '36px', marginBottom: '8px' }}>
                    <FaSearch className="rut-filter-icon" />
                    <input
                      type="text"
                      className="rut-filter-input"
                      placeholder="Buscar socio por nombre o DNI..."
                      value={busquedaSocioAsignar}
                      onChange={(e) => setBusquedaSocioAsignar(e.target.value)}
                    />
                  </div>

                  <div
                    style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      border: '1px solid #1e293b',
                      borderRadius: '10px',
                      background: '#0d131d',
                      padding: '6px'
                    }}
                  >
                    {sociosAsignablesFiltrados.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '12.5px', padding: '14px 8px', margin: 0 }}>
                        No se encontraron socios activos con ese criterio.
                      </p>
                    ) : (
                      sociosAsignablesFiltrados.map((s) => {
                        const sgIdStr = String(s.id_socio_gimnasio);
                        const checked = sociosSeleccionadosIds.includes(sgIdStr);
                        return (
                          <div
                            key={sgIdStr}
                            onClick={() => handleToggleSocioAsignar(sgIdStr)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              marginBottom: '4px',
                              background: checked ? 'rgba(163, 230, 53, 0.12)' : 'transparent',
                              border: checked
                                ? '1px solid rgba(163, 230, 53, 0.4)'
                                : '1px solid transparent'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="rut-ej-checkbox">{checked && <FaCheck />}</div>
                              <div>
                                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>
                                  {s.nombre} {s.apellido}
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                  DNI: {s.dni || 'S/D'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rut-form-grid-2">
                  <div className="rut-form-field">
                    <label>Empleado Responsable (Opcional)</label>
                    <select
                      className="rut-form-select"
                      value={asignarFormData.id_empleado_responsable}
                      onChange={(e) => setAsignarFormData({ ...asignarFormData, id_empleado_responsable: e.target.value })}
                    >
                      <option value="">-- Sin asignar / Automático --</option>
                      {empleadosActivos.map((emp) => (
                        <option key={emp.id_empleado} value={emp.id_empleado}>
                          {emp.nombre} {emp.apellido}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rut-form-field">
                    <label>Fecha fin estimada (Opcional)</label>
                    <input
                      type="date"
                      className="rut-form-input"
                      value={asignarFormData.fecha_finalizacion}
                      onChange={(e) => setAsignarFormData({ ...asignarFormData, fecha_finalizacion: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rut-form-field">
                  <label>Observaciones para el socio</label>
                  <textarea
                    rows="2"
                    className="rut-form-textarea"
                    placeholder="Indicaciones personalizadas para esta asignación..."
                    value={asignarFormData.observaciones}
                    onChange={(e) => setAsignarFormData({ ...asignarFormData, observaciones: e.target.value })}
                  />
                </div>
              </div>
              <div className="rut-modal-footer">
                <button type="button" className="rut-btn-cancel" onClick={() => setShowAsignarModal(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rut-btn-primary"
                  disabled={guardandoAsignacion || sociosSeleccionadosIds.length === 0}
                >
                  <FaCheck />{' '}
                  {guardandoAsignacion
                    ? 'Asignando...'
                    : `Asignar a ${sociosSeleccionadosIds.length || 0} ${
                        sociosSeleccionadosIds.length === 1 ? 'usuario' : 'usuarios'
                      }`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: REASIGNAR RESPONSABLE */}
      {reasignarTarget && (
        <div className="rut-modal-overlay" onClick={() => setReasignarTarget(null)}>
          <div className="rut-modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3><FaUserTie style={{ color: '#a3e635', marginRight: '8px' }} />Reasignar Responsable</h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setReasignarTarget(null)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleConfirmReasignar}>
              <div className="rut-modal-body">
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: 0 }}>
                  Solo empleados activos del gimnasio pueden asumir la responsabilidad de una rutina asignada.
                </p>
                <div className="rut-form-field">
                  <label>Nuevo Empleado Responsable *</label>
                  <select
                    className="rut-form-select"
                    value={reasignarForm.id_empleado_responsable}
                    onChange={(e) => setReasignarForm({ ...reasignarForm, id_empleado_responsable: e.target.value })}
                    required
                  >
                    <option value="">-- Seleccionar empleado activo --</option>
                    {empleadosActivos.map((emp) => (
                      <option key={emp.id_empleado} value={emp.id_empleado}>
                        {emp.nombre} {emp.apellido} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rut-form-field">
                  <label>Observaciones</label>
                  <textarea
                    rows="2"
                    className="rut-form-textarea"
                    value={reasignarForm.observaciones}
                    onChange={(e) => setReasignarForm({ ...reasignarForm, observaciones: e.target.value })}
                  />
                </div>
              </div>
              <div className="rut-modal-footer">
                <button type="button" className="rut-btn-cancel" onClick={() => setReasignarTarget(null)}>
                  Cancelar
                </button>
                <button type="submit" className="rut-btn-primary" disabled={guardandoReasignacion}>
                  <FaCheck /> {guardandoReasignacion ? 'Guardando...' : 'Reasignar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: FINALIZAR ASIGNACIÓN */}
      {finalizarTarget && (
        <div className="rut-modal-overlay" onClick={() => setFinalizarTarget(null)}>
          <div className="rut-modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="rut-modal-header">
              <h3><FaFlagCheckered style={{ color: '#f59e0b', marginRight: '8px' }} />Finalizar Asignación</h3>
              <button type="button" className="rut-modal-close-btn" onClick={() => setFinalizarTarget(null)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleConfirmFinalizar}>
              <div className="rut-modal-body">
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: 0 }}>
                  La asignación se marcará como finalizada conservando intacto el responsable histórico y la plantilla del gimnasio.
                </p>
                <div className="rut-form-field">
                  <label>Fecha de Finalización</label>
                  <input
                    type="date"
                    className="rut-form-input"
                    value={finalizarForm.fecha_finalizacion}
                    onChange={(e) => setFinalizarForm({ ...finalizarForm, fecha_finalizacion: e.target.value })}
                  />
                </div>
                <div className="rut-form-field">
                  <label>Observaciones de cierre (Opcional)</label>
                  <textarea
                    rows="2"
                    className="rut-form-textarea"
                    value={finalizarForm.observaciones}
                    onChange={(e) => setFinalizarForm({ ...finalizarForm, observaciones: e.target.value })}
                  />
                </div>
              </div>
              <div className="rut-modal-footer">
                <button type="button" className="rut-btn-cancel" onClick={() => setFinalizarTarget(null)}>
                  Cancelar
                </button>
                <button type="submit" className="rut-btn-primary" disabled={guardandoFinalizacion}>
                  <FaCheck /> {guardandoFinalizacion ? 'Finalizando...' : 'Confirmar Finalización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
