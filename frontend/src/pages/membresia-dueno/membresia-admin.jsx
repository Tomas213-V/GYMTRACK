/**
 * =========================================================================================
 * ARCHIVO: membresia-admin.jsx
 * RUTA: frontend/src/pages/membresia-dueno/membresia-admin.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Panel de Control del Administrador para la Configuración de Planes y Membresías.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 1. PASO 1 (Pestaña "Planes"):
 *    - Definición del catálogo comercial del gimnasio (ej: Pase Diario, Mensual, Trimestral, Anual).
 *    - Configuración de tarifas en pesos y vigencia en días.
 *    - Activación, deshabilitación y eliminación de planes.
 * 2. PASO 2 (Pestaña "Socios"):
 *    - Asignación manual de membresías a socios seleccionados.
 *    - Control de estados (activas, vencidas, canceladas) y filtros de búsqueda rápida.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import { useGymContext } from '../../context/GymContext';
import {
  getPlanesMembresia,
  createPlanMembresia,
  updatePlanMembresia,
  deshabilitarPlanMembresia,
  deletePlanMembresia,
  getMembresiasSocios,
  createMembresiaSocio,
  renovarMembresiaSocio,
  updateMembresiaSocio,
  cancelarMembresiaSocio,
  deleteMembresiaSocio,
  getSociosDropdown
} from '../../services/membresiaAdminService';

import {
  FaCreditCard,
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaBan,
  FaCheck,
  FaCalendarAlt,
  FaRegClock,
  FaUserCheck,
  FaUsers,
  FaDollarSign,
  FaCrown,
  FaTimes,
  FaExclamationTriangle,
  FaSyncAlt,
  FaFilter,
  FaUserPlus
} from 'react-icons/fa';

import './membresia-admin.css';

const isPlanActivo = (p) => p?.estado === true || String(p?.estado || '').toLowerCase() === 'activo';
const getPlanId = (p) => p?.id_membresia_gimnasio ?? p?.id_plan_membresia;
const getMembId = (m) => m?.id_membresia_socio ?? m?.id_membresia;

export default function MembresiaAdmin() {
  const { gimnasioActivoId, contextVersion } = useGymContext();

  // --------------------------------------------------------------------------
  // Estados Generales
  // --------------------------------------------------------------------------
  const [tabActiva, setTabActiva] = useState('planes');
  const [loading, setLoading] = useState(true);
  const [notificacion, setNotificacion] = useState(null);

  // Datos
  const [planes, setPlanes] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [sociosLista, setSociosLista] = useState([]);

  // Filtros
  const [filtroEstadoPlan, setFiltroEstadoPlan] = useState('todos');
  const [busquedaSocio, setBusquedaSocio] = useState('');
  const [filtroEstadoMembresia, setFiltroEstadoMembresia] = useState('todos');

  // Modales
  const [modalPlanAbierto, setModalPlanAbierto] = useState(false);
  const [planEditando, setPlanEditando] = useState(null);
  const [formPlan, setFormPlan] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    duracion_dias: 30,
    limite_asistencias_semanales: '',
    limite_asistencias_totales: '',
    estado: true
  });

  const [modalMembresiaAbierto, setModalMembresiaAbierto] = useState(false);
  const [membresiaEditando, setMembresiaEditando] = useState(null);
  const [formMembresia, setFormMembresia] = useState({
    id_socio: '',
    id_plan_membresia: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    dias_adicionales: 0,
    precio: '',
    estado: 'activa'
  });

  const [modalConfirmacion, setModalConfirmacion] = useState({
    abierto: false,
    titulo: '',
    mensaje: '',
    textoBoton: 'Confirmar',
    peligroso: true,
    onConfirm: () => {}
  });

  const [guardando, setGuardando] = useState(false);

  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => {
      setNotificacion(null);
    }, 4500);
  };

  // --------------------------------------------------------------------------
  // Carga de Datos (reactiva al cambio de gimnasio activo)
  // --------------------------------------------------------------------------
  const cargarDatos = useCallback(async () => {
    if (!gimnasioActivoId) {
      setPlanes([]);
      setMembresias([]);
      setSociosLista([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [planesData, membresiasData, sociosData] = await Promise.all([
        getPlanesMembresia('todos'),
        getMembresiasSocios({ estado: 'todos' }),
        getSociosDropdown()
      ]);

      setPlanes(planesData);
      setMembresias(membresiasData);
      setSociosLista(sociosData);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      mostrarNotificacion(err.message || 'Error al cargar los datos', 'error');
    } finally {
      setLoading(false);
    }
  }, [gimnasioActivoId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, contextVersion]);

  const calcularDiasRestantes = (fechaVenc) => {
    if (!fechaVenc) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(fechaVenc.split('T')[0] + 'T00:00:00');
    const diffTime = venc - hoy;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const obtenerEstadoMembresia = (memb) => {
    const est = (memb?.estado || '').toLowerCase().trim();
    if (est === 'cancelada' || est === 'cancelado') return 'cancelada';
    if (est === 'pendiente') return 'pendiente';
    const dias = calcularDiasRestantes(memb?.fecha_vencimiento);
    if (est === 'vencida' || est === 'vencido' || (dias !== null && dias < 0)) return 'vencida';
    if (est === 'activa' || est === 'activo' || !est) return 'activa';
    return est;
  };

  const metricas = useMemo(() => {
    const planesActivos = planes.filter((p) => isPlanActivo(p)).length;
    const totalMembresias = membresias.length;
    const membresiasActivas = membresias.filter((m) => obtenerEstadoMembresia(m) === 'activa').length;
    const membresiasPendientes = membresias.filter((m) => obtenerEstadoMembresia(m) === 'pendiente').length;
    const membresiasVencidas = membresias.filter((m) => obtenerEstadoMembresia(m) === 'vencida').length;
    const membresiasCanceladas = membresias.filter((m) => obtenerEstadoMembresia(m) === 'cancelada').length;

    const estimadoActivo = membresias
      .filter((m) => obtenerEstadoMembresia(m) === 'activa')
      .reduce((acc, curr) => acc + (parseFloat(curr.precio_contratado ?? curr.precio) || 0), 0);

    return {
      planesActivos,
      totalPlanes: planes.length,
      totalMembresias,
      membresiasActivas,
      membresiasPendientes,
      membresiasVencidas,
      membresiasCanceladas,
      estimadoActivo
    };
  }, [planes, membresias]);

  const planesFiltrados = useMemo(() => {
    return planes.filter((p) => {
      if (filtroEstadoPlan === 'activo') return isPlanActivo(p);
      if (filtroEstadoPlan === 'inactivo') return !isPlanActivo(p);
      return true;
    });
  }, [planes, filtroEstadoPlan]);

  const membresiasFiltradas = useMemo(() => {
    return membresias.filter((m) => {
      const estadoCalculado = obtenerEstadoMembresia(m);
      if (filtroEstadoMembresia !== 'todos' && estadoCalculado !== filtroEstadoMembresia) {
        return false;
      }

      if (busquedaSocio.trim()) {
        const busq = busquedaSocio.toLowerCase().trim();
        const nombreCompleto = `${m.socio?.nombre || ''} ${m.socio?.apellido || ''}`.toLowerCase();
        const dni = (m.socio?.dni || '').toString();
        const nombrePlan = (m.plan_membresia?.nombre || m.membresia_gimnasio?.nombre || '').toLowerCase();

        if (!nombreCompleto.includes(busq) && !dni.includes(busq) && !nombrePlan.includes(busq)) {
          return false;
        }
      }

      return true;
    });
  }, [membresias, filtroEstadoMembresia, busquedaSocio]);

  // --------------------------------------------------------------------------
  // Modales: Planes (membresia_gimnasio)
  // --------------------------------------------------------------------------
  const abrirModalNuevoPlan = () => {
    setPlanEditando(null);
    setFormPlan({
      nombre: '',
      descripcion: '',
      precio: '',
      duracion_dias: 30,
      limite_asistencias_semanales: '',
      limite_asistencias_totales: '',
      estado: true
    });
    setModalPlanAbierto(true);
  };

  const abrirModalEditarPlan = (plan) => {
    setPlanEditando(plan);
    setFormPlan({
      nombre: plan.nombre || '',
      descripcion: plan.descripcion || '',
      precio: plan.precio !== undefined ? plan.precio : '',
      duracion_dias: plan.duracion_dias || 30,
      limite_asistencias_semanales: plan.limite_asistencias_semanales ?? '',
      limite_asistencias_totales: plan.limite_asistencias_totales ?? '',
      estado: isPlanActivo(plan)
    });
    setModalPlanAbierto(true);
  };

  const guardarPlan = async (e) => {
    e.preventDefault();
    if (!formPlan.nombre.trim()) {
      mostrarNotificacion('El nombre del plan es obligatorio', 'error');
      return;
    }
    if (formPlan.precio === '' || isNaN(formPlan.precio) || parseFloat(formPlan.precio) < 0) {
      mostrarNotificacion('El precio debe ser un número válido igual o mayor a 0', 'error');
      return;
    }
    if (!formPlan.duracion_dias || isNaN(formPlan.duracion_dias) || parseInt(formPlan.duracion_dias) <= 0) {
      mostrarNotificacion('La duración en días debe ser mayor a 0', 'error');
      return;
    }

    const payload = {
      nombre: formPlan.nombre.trim(),
      descripcion: formPlan.descripcion.trim() || null,
      precio: Number(formPlan.precio),
      duracion_dias: Number(formPlan.duracion_dias),
      limite_asistencias_semanales:
        formPlan.limite_asistencias_semanales !== '' ? Number(formPlan.limite_asistencias_semanales) : null,
      limite_asistencias_totales:
        formPlan.limite_asistencias_totales !== '' ? Number(formPlan.limite_asistencias_totales) : null,
      estado: Boolean(formPlan.estado)
    };

    try {
      setGuardando(true);
      if (planEditando) {
        await updatePlanMembresia(getPlanId(planEditando), payload);
        mostrarNotificacion('Plan de membresía actualizado exitosamente');
      } else {
        await createPlanMembresia(payload);
        mostrarNotificacion('Plan de membresía creado exitosamente');
      }
      setModalPlanAbierto(false);
      await cargarDatos();
    } catch (err) {
      mostrarNotificacion(err.message || 'Error al guardar el plan', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const alternarEstadoPlan = async (plan) => {
    const actualmenteActivo = isPlanActivo(plan);
    const idPlan = getPlanId(plan);
    try {
      if (actualmenteActivo) {
        await deshabilitarPlanMembresia(idPlan);
      } else {
        await updatePlanMembresia(idPlan, { estado: true });
      }
      mostrarNotificacion(`El plan "${plan.nombre}" ahora está ${actualmenteActivo ? 'inactivo' : 'activo'}.`);
      await cargarDatos();
    } catch (err) {
      mostrarNotificacion(err.message || 'Error al cambiar estado del plan', 'error');
    }
  };

  const confirmarEliminarPlan = (plan) => {
    setModalConfirmacion({
      abierto: true,
      titulo: 'Eliminar Plan de Membresía',
      mensaje: `¿Estás seguro de que deseas eliminar el plan "${plan.nombre}"? Si hay socios con contrataciones de este plan, se desactivará automáticamente para conservar el registro histórico.`,
      textoBoton: 'Sí, Eliminar Plan',
      peligroso: true,
      onConfirm: async () => {
        try {
          const res = await deletePlanMembresia(getPlanId(plan));
          mostrarNotificacion(res.mensaje || 'Plan eliminado correctamente');
          setModalConfirmacion((prev) => ({ ...prev, abierto: false }));
          await cargarDatos();
        } catch (err) {
          mostrarNotificacion(err.message || 'Error al eliminar el plan', 'error');
        }
      }
    });
  };

  // --------------------------------------------------------------------------
  // Modales: Membresías de Socios (membresia_socio)
  // --------------------------------------------------------------------------
  const abrirModalNuevaMembresia = () => {
    setMembresiaEditando(null);
    const primerPlan = planes.find((p) => isPlanActivo(p)) || planes[0];
    const fInicio = new Date().toISOString().split('T')[0];
    const duracion = primerPlan ? primerPlan.duracion_dias : 30;
    const fVenc = new Date();
    fVenc.setDate(fVenc.getDate() + duracion);

    setFormMembresia({
      id_socio: sociosLista[0]?.id_socio || '',
      id_plan_membresia: primerPlan ? getPlanId(primerPlan) : '',
      fecha_inicio: fInicio,
      fecha_vencimiento: fVenc.toISOString().split('T')[0],
      dias_adicionales: 0,
      precio: primerPlan ? primerPlan.precio : '',
      estado: 'activa'
    });
    setModalMembresiaAbierto(true);
  };

  const abrirModalEditarMembresia = (memb) => {
    setMembresiaEditando(memb);
    const estActual = (memb.estado || 'activa').toLowerCase();
    const estValido = ['pendiente', 'activa', 'vencida', 'cancelada'].includes(estActual) ? estActual : 'activa';
    setFormMembresia({
      id_socio: memb.id_socio,
      id_plan_membresia: memb.id_membresia_gimnasio || memb.id_plan_membresia || getPlanId(memb.plan_membresia) || '',
      fecha_inicio: memb.fecha_inicio ? memb.fecha_inicio.split('T')[0] : '',
      fecha_vencimiento: memb.fecha_vencimiento ? memb.fecha_vencimiento.split('T')[0] : '',
      dias_adicionales: 0,
      precio: memb.precio_contratado ?? memb.precio ?? memb.plan_membresia?.precio ?? '',
      estado: estValido
    });
    setModalMembresiaAbierto(true);
  };

  const handleCambioPlanEnForm = (planId) => {
    const planSel = planes.find((p) => String(getPlanId(p)) === String(planId));
    if (planSel) {
      const fIni = formMembresia.fecha_inicio ? new Date(formMembresia.fecha_inicio) : new Date();
      const fVenc = new Date(fIni);
      fVenc.setDate(fVenc.getDate() + (planSel.duracion_dias || 30) + (parseInt(formMembresia.dias_adicionales) || 0));

      setFormMembresia((prev) => ({
        ...prev,
        id_plan_membresia: planId,
        precio: planSel.precio,
        fecha_vencimiento: fVenc.toISOString().split('T')[0]
      }));
    } else {
      setFormMembresia((prev) => ({ ...prev, id_plan_membresia: planId }));
    }
  };

  const handleCambioFechaInicio = (nuevaFecha) => {
    const planSel = planes.find((p) => String(getPlanId(p)) === String(formMembresia.id_plan_membresia));
    const duracion = planSel ? (planSel.duracion_dias || 30) : 30;
    const fIni = nuevaFecha ? new Date(nuevaFecha) : new Date();
    const fVenc = new Date(fIni);
    fVenc.setDate(fVenc.getDate() + duracion + (parseInt(formMembresia.dias_adicionales) || 0));

    setFormMembresia((prev) => ({
      ...prev,
      fecha_inicio: nuevaFecha,
      fecha_vencimiento: fVenc.toISOString().split('T')[0]
    }));
  };

  const handleExtenderDiasRapido = (diasExtra) => {
    const base = formMembresia.fecha_vencimiento ? new Date(formMembresia.fecha_vencimiento) : new Date();
    base.setDate(base.getDate() + diasExtra);
    setFormMembresia((prev) => ({
      ...prev,
      fecha_vencimiento: base.toISOString().split('T')[0]
    }));
  };

  const guardarMembresia = async (e) => {
    e.preventDefault();
    if (!formMembresia.id_socio) {
      mostrarNotificacion('Debes seleccionar un socio', 'error');
      return;
    }
    if (!formMembresia.id_plan_membresia) {
      mostrarNotificacion('Debes seleccionar un plan de membresía', 'error');
      return;
    }

    try {
      setGuardando(true);
      if (membresiaEditando) {
        await updateMembresiaSocio(getMembId(membresiaEditando), {
          fecha_vencimiento: formMembresia.fecha_vencimiento,
          estado: formMembresia.estado
        });
        mostrarNotificacion('Membresía del socio actualizada exitosamente');
      } else {
        const yaTieneActiva = membresias.some(
          (m) =>
            String(m.id_socio || m.socio_gimnasio?.id_socio) === String(formMembresia.id_socio) &&
            String(m.estado || '').toLowerCase() === 'activa'
        );
        const payload = {
          id_socio: Number(formMembresia.id_socio),
          id_membresia_gimnasio: Number(formMembresia.id_plan_membresia),
          fecha_inicio: formMembresia.fecha_inicio || undefined,
          estado: formMembresia.estado === 'pendiente' ? 'pendiente' : 'activa',
          registrar_pago: formMembresia.estado !== 'pendiente'
        };
        if (yaTieneActiva) {
          await renovarMembresiaSocio(payload);
          mostrarNotificacion('Renovación encadenada registrada exitosamente');
        } else {
          await createMembresiaSocio(payload);
          mostrarNotificacion('Membresía contratada y asignada al socio exitosamente');
        }
      }
      setModalMembresiaAbierto(false);
      await cargarDatos();
    } catch (err) {
      mostrarNotificacion(err.message || 'Error al guardar la membresía', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarCancelarMembresia = (memb) => {
    const nombreSocio = `${memb.socio?.nombre || ''} ${memb.socio?.apellido || ''}`.trim() || 'este socio';
    setModalConfirmacion({
      abierto: true,
      titulo: 'Cancelar Membresía',
      mensaje: `¿Deseas dar de baja y cancelar la membresía de ${nombreSocio}? Pasará a estado cancelada y no podrá ingresar con este pase.`,
      textoBoton: 'Sí, Cancelar Membresía',
      peligroso: true,
      onConfirm: async () => {
        try {
          await cancelarMembresiaSocio(getMembId(memb));
          mostrarNotificacion('Membresía cancelada correctamente');
          setModalConfirmacion((prev) => ({ ...prev, abierto: false }));
          await cargarDatos();
        } catch (err) {
          mostrarNotificacion(err.message || 'Error al cancelar la membresía', 'error');
        }
      }
    });
  };

  const confirmarEliminarMembresia = (memb) => {
    const nombreSocio = `${memb.socio?.nombre || ''} ${memb.socio?.apellido || ''}`.trim() || 'este socio';
    setModalConfirmacion({
      abierto: true,
      titulo: 'Eliminar Membresía',
      mensaje: `¿Confirmas la eliminación del registro de membresía de ${nombreSocio}? Si posee pagos vinculados, se marcará como cancelada para conservar el historial contable.`,
      textoBoton: 'Sí, Eliminar Registro',
      peligroso: true,
      onConfirm: async () => {
        try {
          const res = await deleteMembresiaSocio(getMembId(memb));
          mostrarNotificacion(res.mensaje || 'Membresía procesada correctamente');
          setModalConfirmacion((prev) => ({ ...prev, abierto: false }));
          await cargarDatos();
        } catch (err) {
          mostrarNotificacion(err.message || 'Error al eliminar la membresía', 'error');
        }
      }
    });
  };

  // --------------------------------------------------------------------------
  // Funciones Auxiliares de Formato
  // --------------------------------------------------------------------------
  const formatearMoneda = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '-';
    try {
      const f = new Date(fechaStr.split('T')[0] + 'T00:00:00');
      return f.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return fechaStr;
    }
  };



  return (
    <div className="membresia-admin-layout">
      <NavGlobal />

      <div className="membresia-admin-body">
        <Sidebar />

        <main className="membresia-admin-content">
          {/* Alerta / Toast de Notificación */}
          {notificacion && (
            <div className={`membresia-toast toast-${notificacion.tipo}`}>
              {notificacion.tipo === 'exito' ? <FaCheck /> : <FaExclamationTriangle />}
              <span>{notificacion.mensaje}</span>
              <button onClick={() => setNotificacion(null)} className="toast-close">
                <FaTimes />
              </button>
            </div>
          )}

          {/* Encabezado Principal */}
          <header className="membresia-admin-header">
            <div className="header-titles">
              <div className="header-badge-tag">
                <FaCrown />
                <span>Panel Administrativo</span>
              </div>
              <h1 className="header-title">Gestión de Membresías</h1>
              <p className="header-subtitle">
                Crea planes para tu gimnasio, administra los precios y gestiona las membresías activas de tus socios.
              </p>
            </div>

            <div className="header-actions">
              {tabActiva === 'planes' ? (
                <button
                  className="btn-accion-principal"
                  onClick={abrirModalNuevoPlan}
                >
                  <FaPlus />
                  <span>Nuevo Plan</span>
                </button>
              ) : (
                <button
                  className="btn-accion-principal"
                  onClick={abrirModalNuevaMembresia}
                >
                  <FaUserPlus />
                  <span>Asignar a Socio</span>
                </button>
              )}
            </div>
          </header>

          {/* Tarjetas de Métricas Resumen */}
          <section className="metricas-grid">
            <div className="metrica-card">
              <div className="metrica-icon-box box-verde">
                <FaCreditCard />
              </div>
              <div className="metrica-info">
                <span className="metrica-label">Planes Activos</span>
                <span className="metrica-valor">{metricas.planesActivos} <small>/ {metricas.totalPlanes}</small></span>
              </div>
            </div>

            <div className="metrica-card">
              <div className="metrica-icon-box box-azul">
                <FaUsers />
              </div>
              <div className="metrica-info">
                <span className="metrica-label">Membresías Totales</span>
                <span className="metrica-valor">{metricas.totalMembresias}</span>
              </div>
            </div>

            <div className="metrica-card">
              <div className="metrica-icon-box box-verde-claro">
                <FaUserCheck />
              </div>
              <div className="metrica-info">
                <span className="metrica-label">Socios con Plan Activo</span>
                <span className="metrica-valor">{metricas.membresiasActivas}</span>
              </div>
            </div>

            <div className="metrica-card">
              <div className="metrica-icon-box box-amarillo">
                <FaRegClock />
              </div>
              <div className="metrica-info">
                <span className="metrica-label">Vencidas o Canceladas</span>
                <span className="metrica-valor">{metricas.membresiasVencidas + metricas.membresiasCanceladas}</span>
              </div>
            </div>

            <div className="metrica-card">
              <div className="metrica-icon-box box-dorado">
                <FaDollarSign />
              </div>
              <div className="metrica-info">
                <span className="metrica-label">Recaudación en Activas</span>
                <span className="metrica-valor">{formatearMoneda(metricas.estimadoActivo)}</span>
              </div>
            </div>
          </section>

          {/* Navegación por Pestañas (Tabs) */}
          <div className="membresia-tabs-bar">
            <button
              className={`tab-btn ${tabActiva === 'planes' ? 'tab-activa' : ''}`}
              onClick={() => setTabActiva('planes')}
            >
              <FaCrown className="tab-icon" />
              <span>Planes de Membresía ({planes.length})</span>
            </button>

            <button
              className={`tab-btn ${tabActiva === 'socios' ? 'tab-activa' : ''}`}
              onClick={() => setTabActiva('socios')}
            >
              <FaUsers className="tab-icon" />
              <span>Membresías de Socios ({membresias.length})</span>
            </button>
          </div>

          {/* ================================================================
              TAB 1: PLANES DE MEMBRESÍA (CATÁLOGO)
              ================================================================ */}
          {tabActiva === 'planes' && (
            <section className="tab-seccion">
              {/* Barra de Filtros para Planes */}
              <div className="seccion-toolbar">
                <div className="toolbar-left">
                  <span className="toolbar-label">
                    <FaFilter /> Filtrar por estado:
                  </span>
                  <div className="pill-filters">
                    <button
                      className={`pill-btn ${filtroEstadoPlan === 'todos' ? 'pill-activo' : ''}`}
                      onClick={() => setFiltroEstadoPlan('todos')}
                    >
                      Todos ({planes.length})
                    </button>
                    <button
                      className={`pill-btn ${filtroEstadoPlan === 'activo' ? 'pill-activo' : ''}`}
                      onClick={() => setFiltroEstadoPlan('activo')}
                    >
                      Activos ({metricas.planesActivos})
                    </button>
                    <button
                      className={`pill-btn ${filtroEstadoPlan === 'inactivo' ? 'pill-activo' : ''}`}
                      onClick={() => setFiltroEstadoPlan('inactivo')}
                    >
                      Inactivos ({planes.length - metricas.planesActivos})
                    </button>
                  </div>
                </div>

                <div className="toolbar-right">
                  <button className="btn-recargar" onClick={cargarDatos} title="Recargar datos">
                    <FaSyncAlt />
                  </button>
                </div>
              </div>

              {/* Grid de Planes */}
              {loading && planes.length === 0 ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Cargando planes de membresía...</p>
                </div>
              ) : planesFiltrados.length > 0 ? (
                <div className="planes-grid">
                  {planesFiltrados.map((plan) => {
                    const planId = getPlanId(plan);
                    const activo = isPlanActivo(plan);
                    const sociosConEstePlan = membresias.filter(
                      (m) => String(m.id_membresia_gimnasio || m.id_plan_membresia) === String(planId) && m.estado === 'activa'
                    ).length;

                    return (
                      <div
                        key={planId}
                        className={`plan-card-item ${!activo ? 'plan-inactivo' : ''}`}
                      >
                        <div className="plan-card-header">
                          <div className="plan-title-box">
                            <div className="plan-crown-icon">
                              <FaCrown />
                            </div>
                            <div>
                              <h3 className="plan-nombre">{plan.nombre}</h3>
                              <span className="plan-duracion-badge">
                                <FaCalendarAlt className="icon-mini" /> {plan.duracion_dias} días de vigencia
                              </span>
                            </div>
                          </div>

                          <span className={`estado-badge estado-${activo ? 'activo' : 'inactivo'}`}>
                            {activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>

                        {plan.descripcion && (
                          <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '0 0 10px 0' }}>
                            {plan.descripcion}
                          </p>
                        )}

                        <div className="plan-precio-container">
                          <span className="plan-precio-valor">
                            {formatearMoneda(plan.precio)}
                          </span>
                          <span className="plan-precio-sub">
                            / {plan.duracion_dias} días
                          </span>
                        </div>

                        <div className="plan-stats-strip">
                          <div className="stat-pill">
                            <FaUserCheck className="pill-icon" />
                            <span><strong>{sociosConEstePlan}</strong> socios activos</span>
                          </div>
                          {(plan.limite_asistencias_semanales || plan.limite_asistencias_totales) && (
                            <div className="stat-pill" style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                              <span>
                                {plan.limite_asistencias_semanales ? `${plan.limite_asistencias_semanales}/sem` : ''}
                                {plan.limite_asistencias_semanales && plan.limite_asistencias_totales ? ' • ' : ''}
                                {plan.limite_asistencias_totales ? `${plan.limite_asistencias_totales} totales` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="plan-card-footer">
                          <button
                            className="btn-plan-action btn-editar"
                            onClick={() => abrirModalEditarPlan(plan)}
                            title="Editar detalles del plan"
                          >
                            <FaEdit />
                            <span>Editar</span>
                          </button>

                          <button
                            className={`btn-plan-action ${activo ? 'btn-pausar' : 'btn-activar'}`}
                            onClick={() => alternarEstadoPlan(plan)}
                            title={activo ? 'Desactivar plan' : 'Activar plan'}
                          >
                            {activo ? <FaBan /> : <FaCheck />}
                            <span>{activo ? 'Desactivar' : 'Activar'}</span>
                          </button>

                          <button
                            className="btn-plan-action btn-eliminar"
                            onClick={() => confirmarEliminarPlan(plan)}
                            title="Eliminar este plan"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state-box">
                  <FaCrown className="empty-icon" />
                  <h3>No hay planes de membresía encontrados</h3>
                  <p>Crea tu primer plan para que tus socios puedan suscribirse y abonar sus cuotas.</p>
                  <button className="btn-accion-principal" onClick={abrirModalNuevoPlan}>
                    <FaPlus />
                    <span>Crear Plan de Membresía</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ================================================================
              TAB 2: MEMBRESÍAS ASIGNADAS A SOCIOS
              ================================================================ */}
          {tabActiva === 'socios' && (
            <section className="tab-seccion">
              {/* Toolbar con Buscador y Filtro de Estado */}
              <div className="seccion-toolbar">
                <div className="toolbar-search-box">
                  <FaSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por socio, DNI o nombre del plan..."
                    value={busquedaSocio}
                    onChange={(e) => setBusquedaSocio(e.target.value)}
                  />
                  {busquedaSocio && (
                    <button className="clear-search-btn" onClick={() => setBusquedaSocio('')}>
                      <FaTimes />
                    </button>
                  )}
                </div>

                <div className="toolbar-right">
                  <div className="pill-filters">
                    <button
                      className={`pill-btn ${filtroEstadoMembresia === 'todos' ? 'pill-activo' : ''}`}
                      onClick={() => setFiltroEstadoMembresia('todos')}
                    >
                      Todas ({membresias.length})
                    </button>
                    <button
                      className={`pill-btn ${filtroEstadoMembresia === 'activa' ? 'pill-activo' : ''}`}
                      onClick={() => setFiltroEstadoMembresia('activa')}
                    >
                      Activas ({metricas.membresiasActivas})
                    </button>
                    <button
                      className={`pill-btn ${filtroEstadoMembresia === 'pendiente' ? 'pill-activo' : ''}`}
                      onClick={() => setFiltroEstadoMembresia('pendiente')}
                    >
                      Pendientes ({metricas.membresiasPendientes})
                    </button>
                    <button
                      className={`pill-btn ${filtroEstadoMembresia === 'vencida' ? 'pill-activo' : ''}`}
                      onClick={() => setFiltroEstadoMembresia('vencida')}
                    >
                      Vencidas ({metricas.membresiasVencidas})
                    </button>
                    <button
                      className={`pill-btn ${filtroEstadoMembresia === 'cancelada' ? 'pill-activo' : ''}`}
                      onClick={() => setFiltroEstadoMembresia('cancelada')}
                    >
                      Canceladas ({metricas.membresiasCanceladas})
                    </button>
                  </div>

                  <button className="btn-recargar" onClick={cargarDatos} title="Recargar lista">
                    <FaSyncAlt />
                  </button>
                </div>
              </div>

              {/* Listado / Tabla de Membresías */}
              {loading && membresias.length === 0 ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Cargando membresías de socios...</p>
                </div>
              ) : membresiasFiltradas.length > 0 ? (
                <div className="membresias-tabla-card">
                  <div className="tabla-scroll">
                    <table className="tabla-membresias">
                      <thead>
                        <tr>
                          <th>Socio</th>
                          <th>Plan Asignado</th>
                          <th>Precio</th>
                          <th>Inicio</th>
                          <th>Vencimiento</th>
                          <th>Días Restantes</th>
                          <th>Estado</th>
                          <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {membresiasFiltradas.map((memb) => {
                          const diasRestantes = calcularDiasRestantes(memb.fecha_vencimiento);
                          const esVencida = diasRestantes !== null && diasRestantes < 0;
                          const esPorVencer = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 5;

                          const estadoCalculado = obtenerEstadoMembresia(memb);
                          const socioObj = memb.socio || memb.socio_gimnasio?.socio || null;
                          const planObj = memb.membresia_gimnasio || memb.plan_membresia || null;
                          const precioMostrado = memb.precio_contratado ?? memb.precio ?? planObj?.precio ?? 0;

                          return (
                            <tr key={getMembId(memb)} className={`fila-membresia ${estadoCalculado === 'cancelada' ? 'fila-cancelada' : ''}`}>
                              {/* Socio */}
                              <td>
                                <div className="socio-col-user">
                                  <div className="socio-avatar">
                                    {socioObj?.nombre ? socioObj.nombre[0].toUpperCase() : 'S'}
                                  </div>
                                  <div className="socio-col-meta">
                                    <span className="socio-col-nombre">
                                      {socioObj ? `${socioObj.nombre} ${socioObj.apellido || ''}` : 'Socio Desconocido'}
                                    </span>
                                    <span className="socio-col-dni">
                                      DNI: {socioObj?.dni || 'Sin DNI'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Plan */}
                              <td>
                                <div className="plan-col-tag">
                                  <FaCrown className="tag-crown" />
                                  <span>{planObj?.nombre || 'Plan Sin Nombre'}</span>
                                </div>
                              </td>

                              {/* Precio */}
                              <td>
                                <span className="precio-col-val">
                                  {formatearMoneda(precioMostrado)}
                                </span>
                              </td>

                              {/* Inicio */}
                              <td>
                                <span className="fecha-col-val">
                                  {formatearFecha(memb.fecha_inicio)}
                                </span>
                              </td>

                              {/* Vencimiento */}
                              <td>
                                <span className="fecha-col-val">
                                  {formatearFecha(memb.fecha_vencimiento)}
                                </span>
                              </td>

                              {/* Días Restantes */}
                              <td>
                                {estadoCalculado === 'cancelada' ? (
                                  <span className="dias-badge dias-cancelado">Cancelada</span>
                                ) : diasRestantes === null ? (
                                  <span className="dias-badge">-</span>
                                ) : esVencida ? (
                                  <span className="dias-badge dias-vencido">
                                    Venció hace {Math.abs(diasRestantes)}d
                                  </span>
                                ) : (
                                  <span className={`dias-badge ${esPorVencer ? 'dias-urgente' : 'dias-ok'}`}>
                                    {diasRestantes} días restantes
                                  </span>
                                )}
                              </td>

                              {/* Estado Badge */}
                              <td>
                                {(() => {
                                  const estadoCalculado = obtenerEstadoMembresia(memb);
                                  return (
                                      <span className={`estado-badge estado-${estadoCalculado}`}>
                                        {estadoCalculado === 'activa'
                                          ? 'Activa'
                                          : estadoCalculado === 'pendiente'
                                          ? 'Pendiente'
                                          : estadoCalculado === 'vencida'
                                          ? 'Vencida'
                                          : 'Cancelada'}
                                      </span>
                                    );
                                  })()}
                                </td>

                                {/* Acciones */}
                                <td>
                                  <div className="acciones-row">
                                    <button
                                      className="btn-tabla-action btn-tabla-editar"
                                      onClick={() => abrirModalEditarMembresia(memb)}
                                      title="Editar o renovar membresía"
                                    >
                                      <FaEdit />
                                    </button>

                                    {memb.estado !== 'cancelada' && (
                                      <button
                                        className="btn-tabla-action btn-tabla-cancelar"
                                        onClick={() => confirmarCancelarMembresia(memb)}
                                        title="Cancelar membresía del socio"
                                      >
                                        <FaBan />
                                      </button>
                                    )}

                                    <button
                                      className="btn-tabla-action btn-tabla-eliminar"
                                      onClick={() => confirmarEliminarMembresia(memb)}
                                      title="Eliminar registro"
                                    >
                                      <FaTrash />
                                    </button>
                                  </div>
                                </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state-box">
                  <FaUserCheck className="empty-icon" />
                  <h3>No hay membresías asignadas que coincidan</h3>
                  <p>Asigna un plan a cualquier socio de tu gimnasio para llevar el control de vencimientos.</p>
                  <button className="btn-accion-principal" onClick={abrirModalNuevaMembresia}>
                    <FaUserPlus />
                    <span>Asignar Membresía a Socio</span>
                  </button>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* ====================================================================
          MODAL 1: CREAR / EDITAR PLAN DE MEMBRESÍA
          ==================================================================== */}
      {modalPlanAbierto && (
        <div className="modal-overlay" onClick={() => setModalPlanAbierto(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon">
                <FaCrown />
              </div>
              <div>
                <h2>{planEditando ? 'Editar Plan de Membresía' : 'Nuevo Plan de Membresía'}</h2>
                <p>Configura las condiciones, precio y vigencia del plan para tu gimnasio.</p>
              </div>
              <button className="modal-btn-close" onClick={() => setModalPlanAbierto(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={guardarPlan} className="modal-form">
              <div className="form-group">
                <label>Nombre del Plan *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pase Libre Musculación, Pase 3 Días, Anual VIP..."
                  value={formPlan.nombre}
                  onChange={(e) => setFormPlan({ ...formPlan, nombre: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Precio (ARS) *</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">$</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      placeholder="Ej: 15000"
                      value={formPlan.precio}
                      onChange={(e) => setFormPlan({ ...formPlan, precio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Duración (en días) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 30"
                    value={formPlan.duracion_dias}
                    onChange={(e) => setFormPlan({ ...formPlan, duracion_dias: e.target.value })}
                  />
                </div>
              </div>

              {/* Atajos rápidos de días */}
              <div className="duracion-shortcuts">
                <span className="shortcuts-label">Atajos comunes:</span>
                <div className="shortcuts-btns">
                  <button
                    type="button"
                    className={`shortcut-btn ${parseInt(formPlan.duracion_dias) === 15 ? 'active' : ''}`}
                    onClick={() => setFormPlan({ ...formPlan, duracion_dias: 15 })}
                  >
                    15 días (Quincenal)
                  </button>
                  <button
                    type="button"
                    className={`shortcut-btn ${parseInt(formPlan.duracion_dias) === 30 ? 'active' : ''}`}
                    onClick={() => setFormPlan({ ...formPlan, duracion_dias: 30 })}
                  >
                    30 días (1 mes)
                  </button>
                  <button
                    type="button"
                    className={`shortcut-btn ${parseInt(formPlan.duracion_dias) === 90 ? 'active' : ''}`}
                    onClick={() => setFormPlan({ ...formPlan, duracion_dias: 90 })}
                  >
                    90 días (3 meses)
                  </button>
                  <button
                    type="button"
                    className={`shortcut-btn ${parseInt(formPlan.duracion_dias) === 365 ? 'active' : ''}`}
                    onClick={() => setFormPlan({ ...formPlan, duracion_dias: 365 })}
                  >
                    365 días (1 año)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Descripción (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Acceso libre a todas las sucursales y sala de musculación"
                  value={formPlan.descripcion}
                  onChange={(e) => setFormPlan({ ...formPlan, descripcion: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Límite semanal de asistencias (opcional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={formPlan.limite_asistencias_semanales}
                    onChange={(e) => setFormPlan({ ...formPlan, limite_asistencias_semanales: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Límite total de asistencias (opcional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={formPlan.limite_asistencias_totales}
                    onChange={(e) => setFormPlan({ ...formPlan, limite_asistencias_totales: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Estado del Plan</label>
                <select
                  value={formPlan.estado ? 'true' : 'false'}
                  onChange={(e) => setFormPlan({ ...formPlan, estado: e.target.value === 'true' })}
                >
                  <option value="true">Activo (Disponible para asignar y contratar)</option>
                  <option value="false">Inactivo (Deshabilitado temporalmente)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setModalPlanAbierto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primario"
                >
                  {guardando ? 'Guardando...' : (planEditando ? 'Guardar Cambios' : 'Crear Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: ASIGNAR / EDITAR MEMBRESÍA DE SOCIO
          ==================================================================== */}
      {modalMembresiaAbierto && (
        <div className="modal-overlay" onClick={() => setModalMembresiaAbierto(false)}>
          <div className="modal-container modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon icon-azul">
                <FaUserCheck />
              </div>
              <div>
                <h2>{membresiaEditando ? 'Modificar Membresía de Socio' : 'Asignar Membresía a Socio'}</h2>
                <p>Selecciona el socio, el plan a vincular y ajusta los plazos de vigencia.</p>
              </div>
              <button className="modal-btn-close" onClick={() => setModalMembresiaAbierto(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={guardarMembresia} className="modal-form">
              {/* Socio */}
              <div className="form-group">
                <label>Socio del Gimnasio *</label>
                {membresiaEditando ? (
                  <input
                    type="text"
                    disabled
                    value={`${membresiaEditando.socio?.nombre || ''} ${membresiaEditando.socio?.apellido || ''} (DNI: ${membresiaEditando.socio?.dni || 'N/A'})`}
                    className="input-disabled"
                  />
                ) : (
                  <select
                    required
                    value={formMembresia.id_socio}
                    onChange={(e) => setFormMembresia({ ...formMembresia, id_socio: e.target.value })}
                  >
                    <option value="">-- Seleccionar Socio --</option>
                    {sociosLista.map((s) => (
                      <option key={s.id_socio} value={s.id_socio}>
                        {s.nombre} {s.apellido} {s.dni ? `(DNI: ${s.dni})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Plan de membresía */}
              <div className="form-group">
                <label>Plan de Membresía *</label>
                <select
                  required
                  value={formMembresia.id_plan_membresia}
                  onChange={(e) => handleCambioPlanEnForm(e.target.value)}
                >
                  <option value="">-- Seleccionar Plan --</option>
                    {planes.map((p) => {
                      const pid = getPlanId(p);
                      return (
                        <option key={pid} value={pid}>
                          {p.nombre} - {formatearMoneda(p.precio)} ({p.duracion_dias} días)
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Fecha de Inicio *</label>
                  <input
                    type="date"
                    required
                    value={formMembresia.fecha_inicio}
                    onChange={(e) => handleCambioFechaInicio(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Fecha de Vencimiento *</label>
                  <input
                    type="date"
                    required
                    value={formMembresia.fecha_vencimiento}
                    onChange={(e) => setFormMembresia({ ...formMembresia, fecha_vencimiento: e.target.value })}
                  />
                </div>
              </div>

              {/* Extensión rápida de días */}
              <div className="duracion-shortcuts">
                <span className="shortcuts-label">Extender vencimiento:</span>
                <div className="shortcuts-btns">
                  <button
                    type="button"
                    className="shortcut-btn"
                    onClick={() => handleExtenderDiasRapido(7)}
                  >
                    +7 días
                  </button>
                  <button
                    type="button"
                    className="shortcut-btn"
                    onClick={() => handleExtenderDiasRapido(15)}
                  >
                    +15 días
                  </button>
                  <button
                    type="button"
                    className="shortcut-btn"
                    onClick={() => handleExtenderDiasRapido(30)}
                  >
                    +30 días (1 mes)
                  </button>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Precio Acordado (ARS)</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">$</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Precio del plan..."
                      value={formMembresia.precio}
                      onChange={(e) => setFormMembresia({ ...formMembresia, precio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Estado de la Membresía</label>
                  <select
                    value={formMembresia.estado}
                    onChange={(e) => setFormMembresia({ ...formMembresia, estado: e.target.value })}
                  >
                    <option value="activa">Activa (Habilitada para entrenar)</option>
                    <option value="pendiente">Pendiente (Pendiente de acreditación)</option>
                    <option value="vencida">Vencida</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setModalMembresiaAbierto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primario"
                >
                  {guardando ? 'Guardando...' : (membresiaEditando ? 'Guardar Cambios' : 'Asignar Membresía')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: CONFIRMACIÓN GENÉRICA (ELIMINAR / CANCELAR)
          ==================================================================== */}
      {modalConfirmacion.abierto && (
        <div className="modal-overlay" onClick={() => setModalConfirmacion(prev => ({ ...prev, abierto: false }))}>
          <div className="modal-container modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-confirmacion-body">
              <div className={`confirm-icon-box ${modalConfirmacion.peligroso ? 'confirm-danger' : 'confirm-warning'}`}>
                <FaExclamationTriangle />
              </div>
              <h3 className="confirm-title">{modalConfirmacion.titulo}</h3>
              <p className="confirm-message">{modalConfirmacion.mensaje}</p>

              <div className="confirm-actions">
                <button
                  className="btn-secundario"
                  onClick={() => setModalConfirmacion(prev => ({ ...prev, abierto: false }))}
                >
                  Volver
                </button>
                <button
                  className={`btn-confirm-action ${modalConfirmacion.peligroso ? 'btn-danger' : 'btn-primario'}`}
                  onClick={modalConfirmacion.onConfirm}
                >
                  {modalConfirmacion.textoBoton}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
