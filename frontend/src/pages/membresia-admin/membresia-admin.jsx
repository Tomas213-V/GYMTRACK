/**
 * =========================================================================================
 * ARCHIVO: membresia-admin.jsx
 * RUTA: frontend/src/pages/membresia-admin/membresia-admin.jsx
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

import { useState, useEffect, useMemo } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar/sidebar';
import {
  getPlanesMembresia,
  createPlanMembresia,
  updatePlanMembresia,
  deshabilitarPlanMembresia,
  deletePlanMembresia,
  getMembresiasSocios,
  createMembresiaSocio,
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

export default function MembresiaAdmin() {

  // --------------------------------------------------------------------------
  // Estados Generales
  // --------------------------------------------------------------------------
  const [tabActiva, setTabActiva] = useState('planes'); // 'planes' | 'socios'
  const [loading, setLoading] = useState(true);
  const [notificacion, setNotificacion] = useState(null); // { tipo: 'exito'|'error', mensaje: '' }

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
  const [planEditando, setPlanEditando] = useState(null); // null = nuevo, objeto = editar
  const [formPlan, setFormPlan] = useState({
    nombre: '',
    precio: '',
    duracion_dias: 30,
    estado: 'activo'
  });

  const [modalMembresiaAbierto, setModalMembresiaAbierto] = useState(false);
  const [membresiaEditando, setMembresiaEditando] = useState(null); // null = nuevo, objeto = editar
  const [formMembresia, setFormMembresia] = useState({
    id_socio: '',
    id_plan_membresia: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    dias_adicionales: 0,
    precio: '',
    estado: 'activa'
  });

  // Modal Confirmación Genérico (eliminar o cancelar)
  const [modalConfirmacion, setModalConfirmacion] = useState({
    abierto: false,
    titulo: '',
    mensaje: '',
    textoBoton: 'Confirmar',
    peligroso: true,
    onConfirm: () => {}
  });

  const [guardando, setGuardando] = useState(false);

  // --------------------------------------------------------------------------
  // Notificaciones automáticas
  // --------------------------------------------------------------------------
  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => {
      setNotificacion(null);
    }, 4500);
  };

  // --------------------------------------------------------------------------
  // Carga de Datos
  // --------------------------------------------------------------------------
  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [planesData, membresiasData, sociosData] = await Promise.all([
        getPlanesMembresia('todos').catch(() => []),
        getMembresiasSocios({ estado: 'todos' }).catch(() => []),
        getSociosDropdown().catch(() => [])
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
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // --------------------------------------------------------------------------
  // Métricas y Estadísticas Calculadas
  // --------------------------------------------------------------------------
  const metricas = useMemo(() => {
    const planesActivos = planes.filter(p => p.estado === 'activo').length;
    const totalMembresias = membresias.length;
    const membresiasActivas = membresias.filter(m => m.estado === 'activa').length;
    const membresiasVencidas = membresias.filter(m => m.estado === 'vencida').length;
    const membresiasCanceladas = membresias.filter(m => m.estado === 'cancelada').length;

    // Calcular recaudación estimada mensual por membresías activas
    const estimadoActivo = membresias
      .filter(m => m.estado === 'activa')
      .reduce((acc, curr) => acc + (parseFloat(curr.precio) || 0), 0);

    return {
      planesActivos,
      totalPlanes: planes.length,
      totalMembresias,
      membresiasActivas,
      membresiasVencidas,
      membresiasCanceladas,
      estimadoActivo
    };
  }, [planes, membresias]);

  // --------------------------------------------------------------------------
  // Filtrado de Planes
  // --------------------------------------------------------------------------
  const planesFiltrados = useMemo(() => {
    return planes.filter(p => {
      if (filtroEstadoPlan !== 'todos') {
        if (p.estado !== filtroEstadoPlan) return false;
      }
      return true;
    });
  }, [planes, filtroEstadoPlan]);

  // --------------------------------------------------------------------------
  // Filtrado de Membresías de Socios
  // --------------------------------------------------------------------------
  const membresiasFiltradas = useMemo(() => {
    return membresias.filter(m => {
      if (filtroEstadoMembresia !== 'todos') {
        if (m.estado !== filtroEstadoMembresia) return false;
      }

      if (busquedaSocio.trim()) {
        const busq = busquedaSocio.toLowerCase().trim();
        const nombreCompleto = `${m.socio?.nombre || ''} ${m.socio?.apellido || ''}`.toLowerCase();
        const dni = (m.socio?.dni || '').toString();
        const nombrePlan = (m.plan_membresia?.nombre || '').toLowerCase();

        const coincide = nombreCompleto.includes(busq) || dni.includes(busq) || nombrePlan.includes(busq);
        if (!coincide) return false;
      }

      return true;
    });
  }, [membresias, filtroEstadoMembresia, busquedaSocio]);

  // --------------------------------------------------------------------------
  // Manejo de Modales: Planes
  // --------------------------------------------------------------------------
  const abrirModalNuevoPlan = () => {
    setPlanEditando(null);
    setFormPlan({
      nombre: '',
      precio: '',
      duracion_dias: 30,
      estado: 'activo'
    });
    setModalPlanAbierto(true);
  };

  const abrirModalEditarPlan = (plan) => {
    setPlanEditando(plan);
    setFormPlan({
      nombre: plan.nombre || '',
      precio: plan.precio !== undefined ? plan.precio : '',
      duracion_dias: plan.duracion_dias || 30,
      estado: plan.estado || 'activo'
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

    try {
      setGuardando(true);
      if (planEditando) {
        // Actualizar
        await updatePlanMembresia(planEditando.id_plan_membresia, formPlan);
        mostrarNotificacion('Plan de membresía actualizado exitosamente');
      } else {
        // Crear
        await createPlanMembresia(formPlan);
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
    const nuevoEstado = plan.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      if (nuevoEstado === 'inactivo') {
        await deshabilitarPlanMembresia(plan.id_plan_membresia);
      } else {
        await updatePlanMembresia(plan.id_plan_membresia, { estado: 'activo' });
      }
      mostrarNotificacion(`El plan "${plan.nombre}" ahora está ${nuevoEstado}.`);
      await cargarDatos();
    } catch (err) {
      mostrarNotificacion(err.message || 'Error al cambiar estado del plan', 'error');
    }
  };

  const confirmarEliminarPlan = (plan) => {
    setModalConfirmacion({
      abierto: true,
      titulo: 'Eliminar Plan de Membresía',
      mensaje: `¿Estás seguro de que deseas eliminar el plan "${plan.nombre}"? Si hay socios con este plan asignado, se desactivará automáticamente para conservar el registro histórico.`,
      textoBoton: 'Sí, Eliminar Plan',
      peligroso: true,
      onConfirm: async () => {
        try {
          const res = await deletePlanMembresia(plan.id_plan_membresia);
          mostrarNotificacion(res.mensaje || 'Plan eliminado correctamente');
          setModalConfirmacion(prev => ({ ...prev, abierto: false }));
          await cargarDatos();
        } catch (err) {
          mostrarNotificacion(err.message || 'Error al eliminar el plan', 'error');
        }
      }
    });
  };

  // --------------------------------------------------------------------------
  // Manejo de Modales: Membresías de Socios
  // --------------------------------------------------------------------------
  const abrirModalNuevaMembresia = () => {
    setMembresiaEditando(null);
    const primerPlan = planes.find(p => p.estado === 'activo') || planes[0];
    const fInicio = new Date().toISOString().split('T')[0];
    const duracion = primerPlan ? primerPlan.duracion_dias : 30;
    const fVenc = new Date();
    fVenc.setDate(fVenc.getDate() + duracion);

    setFormMembresia({
      id_socio: sociosLista[0]?.id_socio || '',
      id_plan_membresia: primerPlan?.id_plan_membresia || '',
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
    setFormMembresia({
      id_socio: memb.id_socio,
      id_plan_membresia: memb.id_plan_membresia || memb.plan_membresia?.id_plan_membresia || '',
      fecha_inicio: memb.fecha_inicio ? memb.fecha_inicio.split('T')[0] : '',
      fecha_vencimiento: memb.fecha_vencimiento ? memb.fecha_vencimiento.split('T')[0] : '',
      dias_adicionales: 0,
      precio: memb.precio !== undefined ? memb.precio : (memb.plan_membresia?.precio || ''),
      estado: memb.estado || 'activa'
    });
    setModalMembresiaAbierto(true);
  };

  // Al cambiar de plan en el formulario de membresía, sugerir precio y recalcular fecha de vencimiento
  const handleCambioPlanEnForm = (planId) => {
    const planSel = planes.find(p => p.id_plan_membresia === parseInt(planId));
    if (planSel) {
      const fIni = formMembresia.fecha_inicio ? new Date(formMembresia.fecha_inicio) : new Date();
      const fVenc = new Date(fIni);
      fVenc.setDate(fVenc.getDate() + (planSel.duracion_dias || 30) + (parseInt(formMembresia.dias_adicionales) || 0));

      setFormMembresia(prev => ({
        ...prev,
        id_plan_membresia: planId,
        precio: planSel.precio,
        fecha_vencimiento: fVenc.toISOString().split('T')[0]
      }));
    } else {
      setFormMembresia(prev => ({ ...prev, id_plan_membresia: planId }));
    }
  };

  // Al cambiar la fecha de inicio, recalcular vencimiento si hay un plan seleccionado
  const handleCambioFechaInicio = (nuevaFecha) => {
    const planSel = planes.find(p => p.id_plan_membresia === parseInt(formMembresia.id_plan_membresia));
    const duracion = planSel ? (planSel.duracion_dias || 30) : 30;
    const fIni = nuevaFecha ? new Date(nuevaFecha) : new Date();
    const fVenc = new Date(fIni);
    fVenc.setDate(fVenc.getDate() + duracion + (parseInt(formMembresia.dias_adicionales) || 0));

    setFormMembresia(prev => ({
      ...prev,
      fecha_inicio: nuevaFecha,
      fecha_vencimiento: fVenc.toISOString().split('T')[0]
    }));
  };

  const handleExtenderDiasRapido = (diasExtra) => {
    const base = formMembresia.fecha_vencimiento ? new Date(formMembresia.fecha_vencimiento) : new Date();
    base.setDate(base.getDate() + diasExtra);
    setFormMembresia(prev => ({
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
        // Actualizar existente
        await updateMembresiaSocio(membresiaEditando.id_membresia, {
          id_plan_membresia: formMembresia.id_plan_membresia,
          fecha_inicio: formMembresia.fecha_inicio,
          fecha_vencimiento: formMembresia.fecha_vencimiento,
          precio: formMembresia.precio,
          estado: formMembresia.estado
        });
        mostrarNotificacion('Membresía del socio actualizada exitosamente');
      } else {
        // Crear nueva asignación
        await createMembresiaSocio({
          id_socio: formMembresia.id_socio,
          id_plan_membresia: formMembresia.id_plan_membresia,
          fecha_inicio: formMembresia.fecha_inicio,
          dias_adicionales: formMembresia.dias_adicionales || 0,
          precio: formMembresia.precio,
          estado: formMembresia.estado
        });
        mostrarNotificacion('Membresía asignada al socio exitosamente');
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
      mensaje: `¿Deseas dar de baja y cancelar la membresía de ${nombreSocio}? La membresía pasará a estado cancelada y no podrá ingresar al gimnasio con este pase.`,
      textoBoton: 'Sí, Cancelar Membresía',
      peligroso: true,
      onConfirm: async () => {
        try {
          await cancelarMembresiaSocio(memb.id_membresia);
          mostrarNotificacion('Membresía cancelada correctamente');
          setModalConfirmacion(prev => ({ ...prev, abierto: false }));
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
      mensaje: `¿Confirmas la eliminación del registro de membresía de ${nombreSocio}? Si posee pagos contables vinculados, se marcará como cancelada para no romper la facturación.`,
      textoBoton: 'Sí, Eliminar Registro',
      peligroso: true,
      onConfirm: async () => {
        try {
          const res = await deleteMembresiaSocio(memb.id_membresia);
          mostrarNotificacion(res.mensaje || 'Membresía eliminada correctamente');
          setModalConfirmacion(prev => ({ ...prev, abierto: false }));
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

  const calcularDiasRestantes = (fechaVenc) => {
    if (!fechaVenc) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(fechaVenc.split('T')[0] + 'T00:00:00');
    const diffTime = venc - hoy;
    const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDias;
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
                    const sociosConEstePlan = membresias.filter(
                      m => m.id_plan_membresia === plan.id_plan_membresia && m.estado === 'activa'
                    ).length;

                    return (
                      <div
                        key={plan.id_plan_membresia}
                        className={`plan-card-item ${plan.estado === 'inactivo' ? 'plan-inactivo' : ''}`}
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

                          <span className={`estado-badge estado-${plan.estado}`}>
                            {plan.estado === 'activo' ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>

                        <div className="plan-precio-container">
                          <span className="plan-precio-valor">
                            {formatearMoneda(plan.precio)}
                          </span>
                          <span className="plan-precio-sub">
                            / {plan.duracion_dias >= 365 ? 'año' : plan.duracion_dias >= 30 ? 'mes' : `${plan.duracion_dias} días`}
                          </span>
                        </div>

                        <div className="plan-stats-strip">
                          <div className="stat-pill">
                            <FaUserCheck className="pill-icon" />
                            <span><strong>{sociosConEstePlan}</strong> socios activos</span>
                          </div>
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
                            className={`btn-plan-action ${plan.estado === 'activo' ? 'btn-pausar' : 'btn-activar'}`}
                            onClick={() => alternarEstadoPlan(plan)}
                            title={plan.estado === 'activo' ? 'Desactivar plan' : 'Activar plan'}
                          >
                            {plan.estado === 'activo' ? <FaBan /> : <FaCheck />}
                            <span>{plan.estado === 'activo' ? 'Pausar' : 'Activar'}</span>
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

                          return (
                            <tr key={memb.id_membresia} className={`fila-membresia ${memb.estado === 'cancelada' ? 'fila-cancelada' : ''}`}>
                              {/* Socio */}
                              <td>
                                <div className="socio-col-user">
                                  <div className="socio-avatar">
                                    {memb.socio?.nombre ? memb.socio.nombre[0].toUpperCase() : 'S'}
                                  </div>
                                  <div className="socio-col-meta">
                                    <span className="socio-col-nombre">
                                      {memb.socio ? `${memb.socio.nombre} ${memb.socio.apellido || ''}` : 'Socio Desconocido'}
                                    </span>
                                    <span className="socio-col-dni">
                                      DNI: {memb.socio?.dni || 'Sin DNI'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Plan */}
                              <td>
                                <div className="plan-col-tag">
                                  <FaCrown className="tag-crown" />
                                  <span>{memb.plan_membresia?.nombre || 'Plan Sin Nombre'}</span>
                                </div>
                              </td>

                              {/* Precio */}
                              <td>
                                <span className="precio-col-val">
                                  {formatearMoneda(memb.precio || memb.plan_membresia?.precio || 0)}
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
                                {memb.estado === 'cancelada' ? (
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
                                <span className={`estado-badge estado-${memb.estado}`}>
                                  {memb.estado === 'activa' ? 'Activa' : memb.estado === 'vencida' ? 'Vencida' : 'Cancelada'}
                                </span>
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
                <label>Estado del Plan</label>
                <select
                  value={formPlan.estado}
                  onChange={(e) => setFormPlan({ ...formPlan, estado: e.target.value })}
                >
                  <option value="activo">Activo (Disponible para asignar y pagar)</option>
                  <option value="inactivo">Inactivo (Pausado temporalmente)</option>
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
                  {planes.map((p) => (
                    <option key={p.id_plan_membresia} value={p.id_plan_membresia}>
                      {p.nombre} - {formatearMoneda(p.precio)} ({p.duracion_dias} días)
                    </option>
                  ))}
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
                    <option value="activa">Activa (Habilitado para entrenar)</option>
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
