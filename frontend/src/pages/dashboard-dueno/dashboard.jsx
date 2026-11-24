/**
 * =========================================================================================
 * ARCHIVO: dashboard.jsx
 * RUTA: frontend/src/pages/dashboard-dueno/dashboard.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Panel de Control Gerencial y Operativo (Dueño / Admin Org / Empleados).
 *              Respeta estrictamente `alcance.acceso_financiero` y `alcance.acceso_rutinas`.
 * =========================================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import NavGlobal from "../../components/nav-global/nav-global";
import Sidebar from "../../components/sidebar-dueno/sidebar";
import { useGymContext } from "../../context/GymContext";
import { fetchDashboardAdmin } from "../../services/dashboardService";
import {
  FaUsers,
  FaMoneyBillWave,
  FaCalendarCheck,
  FaExclamationTriangle,
  FaUserPlus,
  FaReceipt,
  FaDumbbell,
  FaSyncAlt,
  FaArrowUp,
  FaArrowDown,
  FaChevronRight,
  FaBuilding,
  FaClock,
  FaMapMarkerAlt
} from "react-icons/fa";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import "./dashboard.css";

function Dashboard() {
  const { usuario: usuarioCtx, gimnasioActivo, gimnasioActivoId, contextVersion } = useGymContext();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState(null);
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date());

  const cargarDatos = useCallback(async () => {
    if (!gimnasioActivoId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetchDashboardAdmin({ id_sucursal: sucursalFiltro || undefined });
      setData(res);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error("Error al cargar dashboard de administrador:", err);
      setErrorMsg(err.message || "No se pudieron cargar las métricas del gimnasio.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [gimnasioActivoId, sucursalFiltro]);

  useEffect(() => {
    setSucursalFiltro("");
  }, [gimnasioActivoId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, contextVersion]);

  const formatearDinero = (val) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(Number(val) || 0);
  };

  const nombreDuenio = usuarioCtx?.nombre
    ? `${usuarioCtx.nombre} ${usuarioCtx.apellido || ""}`.trim()
    : "Administrador";

  const nombreGym = data?.gimnasio?.nombre || gimnasioActivo?.nombre || "Mi Gimnasio";
  const sucursalesDisponibles = data?.sucursales || [];

  const accesoFinanciero = data?.alcance ? Boolean(data.alcance.acceso_financiero) : true;
  const accesoRutinas = data?.alcance ? Boolean(data.alcance.acceso_rutinas) : true;

  const sociosKpi = data?.kpis?.socios || { total: 0, activos: 0, inactivos: 0, nuevosMes: 0 };
  const ingresosKpi = data?.kpis?.ingresos || null;
  const asistenciasKpi = data?.kpis?.asistencias || {
    hoy: 0,
    abiertas: 0,
    mesActual: 0,
    mesAnterior: 0,
    variacionPorcentaje: 0
  };
  const membresiasKpi = data?.kpis?.membresias || {
    activas: 0,
    pendientes: 0,
    porVencer: 0,
    vencidas: 0
  };
  const rutinasKpi = data?.kpis?.rutinas || {
    totalPlantillas: 0,
    plantillasActivas: 0,
    asignacionesActivas: 0,
    asignacionesFinalizadas: 0
  };

  const graficos = data?.graficos || {
    ingresosMensuales: [],
    asistenciasPorDia: []
  };

  const alertasCuotasTotal =
    (membresiasKpi.vencidas || 0) +
    (membresiasKpi.porVencer || 0) +
    (membresiasKpi.pendientes || 0) +
    (accesoFinanciero ? (ingresosKpi?.pagosPendientes || 0) : 0);

  return (
    <div className="Caja-admin-dashboard">
      <NavGlobal />

      <div className="Caja-admin-dashboard-cuerpo">
        <Sidebar />

        <main className="Caja-admin-dashboard-contenido">
          {/* HEADER HERO */}
          <section className="admin-dash-hero">
            <div className="admin-dash-hero-info">
              <div className="admin-dash-hero-badge-gym">
                <FaBuilding className="admin-dash-badge-icon" />
                <span>{nombreGym}</span>
                <span className="admin-dash-status-dot" title="Gimnasio Activo"></span>
              </div>
              <h1 className="admin-dash-hero-saludo">
                ¡Hola de nuevo, <span>{nombreDuenio}</span>!
              </h1>
              <p className="admin-dash-hero-desc">
                Panel de control en tiempo real de tu gimnasio y sus sucursales autorizadas.
              </p>
            </div>

            <div className="admin-dash-hero-actions">
              {sucursalesDisponibles.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "6px 10px" }}>
                  <FaMapMarkerAlt style={{ color: "#9EF01A", fontSize: "13px" }} />
                  <select
                    value={sucursalFiltro}
                    onChange={(e) => setSucursalFiltro(e.target.value)}
                    style={{ background: "transparent", border: "none", color: "#f8fafc", fontSize: "13px", cursor: "pointer", outline: "none" }}
                  >
                    <option value="" style={{ background: "#141921" }}>Todas las sucursales</option>
                    {sucursalesDisponibles.map((s) => (
                      <option key={s.id_sucursal} value={s.id_sucursal} style={{ background: "#141921" }}>
                        {s.direccion}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="admin-dash-live-time">
                <FaClock />
                <span>{ultimaActualizacion.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <button
                onClick={cargarDatos}
                className={`admin-dash-btn-refresh ${loading ? "girando" : ""}`}
                title="Actualizar métricas"
              >
                <FaSyncAlt />
                <span>Actualizar</span>
              </button>
            </div>
          </section>

          {errorMsg && (
            <div style={{ background: "rgba(239, 68, 68, 0.14)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5", padding: "12px 16px", borderRadius: "10px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
              <FaExclamationTriangle />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ACCIONES RÁPIDAS */}
          <section className="admin-dash-quick-actions">
            <Link to="/socios-dueño" className="admin-dash-quick-btn quick-btn-socios">
              <div className="quick-btn-icon-box"><FaUserPlus /></div>
              <div className="quick-btn-texts">
                <strong>Socios</strong>
                <span>Gestionar asociados</span>
              </div>
              <FaChevronRight className="quick-btn-arrow" />
            </Link>

            {accesoFinanciero && (
              <Link to="/pagos-dueño" className="admin-dash-quick-btn quick-btn-pagos">
                <div className="quick-btn-icon-box"><FaReceipt /></div>
                <div className="quick-btn-texts">
                  <strong>Cobrar Cuota</strong>
                  <span>Registrar pago</span>
                </div>
                <FaChevronRight className="quick-btn-arrow" />
              </Link>
            )}

            <Link to="/asistencias-dueño" className="admin-dash-quick-btn quick-btn-asist">
              <div className="quick-btn-icon-box"><FaCalendarCheck /></div>
              <div className="quick-btn-texts">
                <strong>Asistencias</strong>
                <span>Control de ingresos</span>
              </div>
              <FaChevronRight className="quick-btn-arrow" />
            </Link>

            {accesoRutinas && (
              <Link to="/rutinas-dueño" className="admin-dash-quick-btn quick-btn-rutinas">
                <div className="quick-btn-icon-box"><FaDumbbell /></div>
                <div className="quick-btn-texts">
                  <strong>Rutinas</strong>
                  <span>Plantillas y asignaciones</span>
                </div>
                <FaChevronRight className="quick-btn-arrow" />
              </Link>
            )}
          </section>

          {/* TARJETAS DE KPIS */}
          <section className="admin-dash-kpi-grid">
            {/* KPI 1: Socios */}
            <div className="admin-dash-kpi-card card-socios">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap icon-socios"><FaUsers /></div>
                <span className="kpi-tag-sub">Total Registrados</span>
              </div>
              <div className="kpi-card-main">
                <h3 className="kpi-card-valor">{sociosKpi.total}</h3>
                <span className="kpi-card-label">Socios Asociados</span>
              </div>
              <div className="kpi-card-footer">
                <div className="kpi-pill-success">
                  <span className="pill-dot"></span>
                  <b>{sociosKpi.activos}</b> activos
                </div>
                {sociosKpi.inactivos > 0 && (
                  <div className="kpi-pill-muted">
                    <b>{sociosKpi.inactivos}</b> inactivos
                  </div>
                )}
                <div className="kpi-badge-highlight">
                  +{sociosKpi.nuevosMes} este mes
                </div>
              </div>
            </div>

            {/* KPI 2: Recaudación (solo si acceso_financiero) o Rutinas (entrenador) */}
            {accesoFinanciero && ingresosKpi ? (
              <div className="admin-dash-kpi-card card-ingresos">
                <div className="kpi-card-header">
                  <div className="kpi-icon-wrap icon-ingresos"><FaMoneyBillWave /></div>
                  <div className={`kpi-variation ${(ingresosKpi.variacionPorcentaje || 0) >= 0 ? "up" : "down"}`}>
                    {(ingresosKpi.variacionPorcentaje || 0) >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                    <span>{Math.abs(ingresosKpi.variacionPorcentaje || 0)}%</span>
                  </div>
                </div>
                <div className="kpi-card-main">
                  <h3 className="kpi-card-valor">{formatearDinero(ingresosKpi.mesActual)}</h3>
                  <span className="kpi-card-label">Recaudación del Mes</span>
                </div>
                <div className="kpi-card-footer">
                  <span className="kpi-detail-text">
                    <b>{ingresosKpi.pagosAprobados ?? 0}</b> pagos aprobados
                  </span>
                  <span className="kpi-detail-comp">
                    Mes ant: {formatearDinero(ingresosKpi.mesAnterior)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="admin-dash-kpi-card card-ingresos">
                <div className="kpi-card-header">
                  <div className="kpi-icon-wrap icon-ingresos"><FaDumbbell /></div>
                  <span className="kpi-tag-sub">Entrenamiento</span>
                </div>
                <div className="kpi-card-main">
                  <h3 className="kpi-card-valor">{rutinasKpi.asignacionesActivas ?? 0}</h3>
                  <span className="kpi-card-label">Rutinas Asignadas Activas</span>
                </div>
                <div className="kpi-card-footer">
                  <span className="kpi-detail-text">
                    <b>{rutinasKpi.plantillasActivas ?? 0}</b> plantillas activas
                  </span>
                  <span className="kpi-detail-comp">
                    {rutinasKpi.totalPlantillas ?? 0} en catálogo
                  </span>
                </div>
              </div>
            )}

            {/* KPI 3: Asistencias */}
            <div className="admin-dash-kpi-card card-asistencias">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap icon-asistencias"><FaCalendarCheck /></div>
                <div className="kpi-variation up">
                  <span className="kpi-live-dot"></span>
                  <span>{asistenciasKpi.abiertas || 0} en sala</span>
                </div>
              </div>
              <div className="kpi-card-main">
                <h3 className="kpi-card-valor">{asistenciasKpi.hoy}</h3>
                <span className="kpi-card-label">Asistencias Hoy</span>
              </div>
              <div className="kpi-card-footer">
                <span className="kpi-detail-text">
                  <b>{asistenciasKpi.mesActual}</b> en el mes
                </span>
                {asistenciasKpi.variacionPorcentaje !== 0 && (
                  <span className="kpi-pill-success">
                    {asistenciasKpi.variacionPorcentaje > 0 ? "+" : ""}
                    {asistenciasKpi.variacionPorcentaje}% vs mes ant.
                  </span>
                )}
              </div>
            </div>

            {/* KPI 4: Membresías / Alertas */}
            <div className="admin-dash-kpi-card card-alertas">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap icon-alertas"><FaExclamationTriangle /></div>
                <span className="kpi-badge-warning">{membresiasKpi.activas} activas</span>
              </div>
              <div className="kpi-card-main">
                <h3 className="kpi-card-valor">{alertasCuotasTotal}</h3>
                <span className="kpi-card-label">Membresías / Cuotas por Atender</span>
              </div>
              <div className="kpi-card-footer">
                {(membresiasKpi.vencidas || 0) > 0 && (
                  <div className="kpi-pill-danger">
                    <b>{membresiasKpi.vencidas}</b> {membresiasKpi.vencidas === 1 ? "vencida" : "vencidas"}
                  </div>
                )}
                {(membresiasKpi.porVencer || 0) > 0 && (
                  <div className="kpi-pill-warning">
                    <b>{membresiasKpi.porVencer}</b> por vencer
                  </div>
                )}
                {(membresiasKpi.pendientes || 0) > 0 && (
                  <div className="kpi-pill-warning">
                    <b>{membresiasKpi.pendientes}</b> pendientes
                  </div>
                )}
                {alertasCuotasTotal === 0 && (
                  <div className="kpi-pill-success">
                    <span className="pill-dot"></span> Al día
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* GRÁFICOS ESTADÍSTICOS */}
          <section
            className="admin-dash-charts-grid"
            style={!accesoFinanciero ? { gridTemplateColumns: "1fr" } : undefined}
          >
            {accesoFinanciero && (
              <div className="admin-chart-box">
                <div className="admin-chart-header">
                  <div>
                    <h3 className="admin-chart-title">Evolución de Recaudación</h3>
                    <p className="admin-chart-subtitle">Histórico de ingresos aprobados de los últimos 6 meses</p>
                  </div>
                  <div className="admin-chart-tag">
                    <FaMoneyBillWave /> Facturación
                  </div>
                </div>
                <div className="admin-chart-canvas-wrapper">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={graficos.ingresosMensuales || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ingresosGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222731" vertical={false} />
                      <XAxis dataKey="mes" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#15181e",
                          borderColor: "#262c37",
                          borderRadius: "8px",
                          color: "#fff"
                        }}
                        formatter={(val) => [formatearDinero(val), "Recaudación"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="recaudacion"
                        stroke="#22c55e"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#ingresosGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="admin-chart-box">
              <div className="admin-chart-header">
                <div>
                  <h3 className="admin-chart-title">Afluencia Semanal</h3>
                  <p className="admin-chart-subtitle">Asistencias válidas registradas por día de la semana</p>
                </div>
                <div className="admin-chart-tag tag-cyan">
                  <FaCalendarCheck /> Concurrencia
                </div>
              </div>
              <div className="admin-chart-canvas-wrapper">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={graficos.asistenciasPorDia || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222731" vertical={false} />
                    <XAxis dataKey="dia" stroke="#64748b" fontSize={12} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#15181e",
                        borderColor: "#262c37",
                        borderRadius: "8px",
                        color: "#fff"
                      }}
                      formatter={(val) => [`${val} ingresos`, "Asistencias"]}
                    />
                    <Bar
                      dataKey="asistencias"
                      fill="#0ea5e9"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
