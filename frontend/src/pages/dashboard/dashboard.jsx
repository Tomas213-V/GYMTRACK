/**
 * =========================================================================================
 * ARCHIVO: dashboard.jsx
 * RUTA: frontend/src/pages/dashboard/dashboard.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Panel de Control (Dashboard) principal del Administrador / Dueño del Gimnasio.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 
 * Este componente es el centro neurálgico de analítica del sistema:
 * 
 * 1. PASO 1 (Ciclo de Vida y Carga):
 *    - `cargarDatos()`: Recupera la sesión activa de `localStorage` y llama a `fetchDashboardAdmin()`.
 *    - Actualiza el timestamp de última sincronización para informar frescura de datos al dueño.
 * 
 * 2. PASO 2 (Formateadores Auxiliares):
 *    - `formatearDinero()`: Formatea importes en pesos argentinos (ARS) con `Intl.NumberFormat`.
 * 
 * 3. PASO 3 (Visualización de Datos con Recharts):
 *    - Gráficos de Área (AreaChart): Evolución de ingresos en los últimos meses.
 *    - Gráficos de Barras (BarChart): Distribución de asistencias por franja horaria / día.
 * 
 * 4. PASO 4 (Acciones Rápidas):
 *    - Acceso rápido a crear socio, registrar cobro, asistencia y rutinas.
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import NavGlobal from "../../components/nav-global/nav-global";
import Sidebar from "../../components/sidebar/sidebar";
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
  FaClock
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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date());

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Obtener datos del usuario guardado
      const rawUser = localStorage.getItem("usuario");
      if (rawUser) {
        try {
          setUsuario(JSON.parse(rawUser));
        } catch (e) {
          console.debug("Error leyendo usuario de sesión:", e);
        }
      }

      // 2. Cargar métricas del dashboard
      const res = await fetchDashboardAdmin();
      setData(res);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error("Error al cargar dashboard de administrador:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const formatearDinero = (val) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(Number(val) || 0);
  };

  const nombreDuenio = usuario?.nombre
    ? `${usuario.nombre} ${usuario.apellido || ""}`.trim()
    : "Administrador";

  const nombreGym = data?.gimnasio?.nombre || usuario?.gimnasio?.nombre || "Mi Gimnasio";

  const kpis = data?.kpis || {
    socios: { total: 0, activos: 0, inactivos: 0, pendientes: 0, nuevosMes: 0 },
    ingresos: { mesActual: 0, mesAnterior: 0, variacionPorcentaje: 0, pagosRealizados: 0, pagosPendientes: 0, pagosVencidos: 0 },
    asistencias: { hoy: 0, mesActual: 0, mesAnterior: 0, variacionPorcentaje: 0 },
    membresiasPorVencer: 0,
    membresiasVencidas: 0
  };

  const graficos = data?.graficos || {
    ingresosMensuales: [],
    asistenciasPorDia: []
  };

  return (
    <div className="Caja-admin-dashboard">
      <NavGlobal />

      <div className="Caja-admin-dashboard-cuerpo">
        <Sidebar />

        <main className="Caja-admin-dashboard-contenido">
          {/* =========================================================
              HEADER HERO DEL ADMINISTRADOR / DUEÑO
             ========================================================= */}
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
                Panel de control gerencial. Aquí tienes el rendimiento en tiempo real de tu gimnasio.
              </p>
            </div>

            <div className="admin-dash-hero-actions">
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

          {/* =========================================================
              ACCIONES RÁPIDAS (SHORTCUTS)
             ========================================================= */}
          <section className="admin-dash-quick-actions">
            <Link to="/socios-dueño" className="admin-dash-quick-btn quick-btn-socios">
              <div className="quick-btn-icon-box">
                <FaUserPlus />
              </div>
              <div className="quick-btn-texts">
                <strong>Nuevo Socio</strong>
                <span>Registrar usuario</span>
              </div>
              <FaChevronRight className="quick-btn-arrow" />
            </Link>

            <Link to="/pagos-dueño" className="admin-dash-quick-btn quick-btn-pagos">
              <div className="quick-btn-icon-box">
                <FaReceipt />
              </div>
              <div className="quick-btn-texts">
                <strong>Cobrar Cuota</strong>
                <span>Registrar pago</span>
              </div>
              <FaChevronRight className="quick-btn-arrow" />
            </Link>

            <Link to="/asistencias-dueño" className="admin-dash-quick-btn quick-btn-asist">
              <div className="quick-btn-icon-box">
                <FaCalendarCheck />
              </div>
              <div className="quick-btn-texts">
                <strong>Marcar Entrada</strong>
                <span>Asistencia socios</span>
              </div>
              <FaChevronRight className="quick-btn-arrow" />
            </Link>

            <Link to="/rutinas-dueño" className="admin-dash-quick-btn quick-btn-rutinas">
              <div className="quick-btn-icon-box">
                <FaDumbbell />
              </div>
              <div className="quick-btn-texts">
                <strong>Crear Rutina</strong>
                <span>Planes de entreno</span>
              </div>
              <FaChevronRight className="quick-btn-arrow" />
            </Link>
          </section>

          {/* =========================================================
              TARJETAS DE MÉTRICAS CLAVE (KPIS)
             ========================================================= */}
          <section className="admin-dash-kpi-grid">
            {/* KPI 1: Socios */}
            <div className="admin-dash-kpi-card card-socios">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap icon-socios">
                  <FaUsers />
                </div>
                <span className="kpi-tag-sub">Total Registrados</span>
              </div>
              <div className="kpi-card-main">
                <h3 className="kpi-card-valor">{kpis.socios.total}</h3>
                <span className="kpi-card-label">Socios Totales</span>
              </div>
              <div className="kpi-card-footer">
                <div className="kpi-pill-success">
                  <span className="pill-dot"></span>
                  <b>{kpis.socios.activos}</b> activos
                </div>
                {kpis.socios.inactivos > 0 && (
                  <div className="kpi-pill-muted">
                    <b>{kpis.socios.inactivos}</b> inactivos
                  </div>
                )}
                <div className="kpi-badge-highlight">
                  +{kpis.socios.nuevosMes} este mes
                </div>
              </div>
            </div>

            {/* KPI 2: Recaudación */}
            <div className="admin-dash-kpi-card card-ingresos">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap icon-ingresos">
                  <FaMoneyBillWave />
                </div>
                <div className={`kpi-variation ${kpis.ingresos.variacionPorcentaje >= 0 ? "up" : "down"}`}>
                  {kpis.ingresos.variacionPorcentaje >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                  <span>{Math.abs(kpis.ingresos.variacionPorcentaje)}%</span>
                </div>
              </div>
              <div className="kpi-card-main">
                <h3 className="kpi-card-valor">{formatearDinero(kpis.ingresos.mesActual)}</h3>
                <span className="kpi-card-label">Recaudación del Mes</span>
              </div>
              <div className="kpi-card-footer">
                <span className="kpi-detail-text">
                  <b>{kpis.ingresos.pagosRealizados}</b> pagos concretados
                </span>
                <span className="kpi-detail-comp">
                  Mes ant: {formatearDinero(kpis.ingresos.mesAnterior)}
                </span>
              </div>
            </div>

            {/* KPI 3: Asistencias */}
            <div className="admin-dash-kpi-card card-asistencias">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap icon-asistencias">
                  <FaCalendarCheck />
                </div>
                <div className="kpi-variation up">
                  <span className="kpi-live-dot"></span>
                  <span>En vivo</span>
                </div>
              </div>
              <div className="kpi-card-main">
                <h3 className="kpi-card-valor">{kpis.asistencias.hoy}</h3>
                <span className="kpi-card-label">Asistencias Hoy</span>
              </div>
              <div className="kpi-card-footer">
                <span className="kpi-detail-text">
                  <b>{kpis.asistencias.mesActual}</b> en el mes
                </span>
                {kpis.asistencias.variacionPorcentaje !== 0 && (
                  <span className="kpi-pill-success">
                    {kpis.asistencias.variacionPorcentaje > 0 ? "+" : ""}
                    {kpis.asistencias.variacionPorcentaje}% vs mes ant.
                  </span>
                )}
              </div>
            </div>

            {/* KPI 4: Cuotas Vencidas / Por Vencer */}
            <div className="admin-dash-kpi-card card-alertas">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap icon-alertas">
                  <FaExclamationTriangle />
                </div>
                <span className="kpi-badge-warning">Atención</span>
              </div>
              <div className="kpi-card-main">
                <h3 className="kpi-card-valor">
                  {(kpis.membresiasVencidas || 0) + (kpis.membresiasPorVencer || 0) + (kpis.ingresos?.pagosPendientes || 0) + (kpis.ingresos?.pagosVencidos || 0)}
                </h3>
                <span className="kpi-card-label">Cuotas a Cobrar / Por Vencer</span>
              </div>
              <div className="kpi-card-footer">
                {((kpis.membresiasVencidas || 0) + (kpis.ingresos?.pagosVencidos || 0)) > 0 && (
                  <div className="kpi-pill-danger">
                    <b>{(kpis.membresiasVencidas || 0) + (kpis.ingresos?.pagosVencidos || 0)}</b> {((kpis.membresiasVencidas || 0) + (kpis.ingresos?.pagosVencidos || 0)) === 1 ? "vencida" : "vencidas"}
                  </div>
                )}
                {(kpis.membresiasPorVencer || 0) > 0 && (
                  <div className="kpi-pill-warning">
                    <b>{kpis.membresiasPorVencer}</b> por vencer
                  </div>
                )}
                {(kpis.ingresos?.pagosPendientes || 0) > 0 && (
                  <div className="kpi-pill-warning">
                    <b>{kpis.ingresos.pagosPendientes}</b> pendientes
                  </div>
                )}
                {((kpis.membresiasVencidas || 0) === 0 && (kpis.ingresos?.pagosVencidos || 0) === 0 && (kpis.membresiasPorVencer || 0) === 0 && (kpis.ingresos?.pagosPendientes || 0) === 0) && (
                  <div className="kpi-pill-success">
                    <span className="pill-dot"></span> Al día
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* =========================================================
              GRÁFICOS ESTADÍSTICOS (RECHARTS)
             ========================================================= */}
          <section className="admin-dash-charts-grid">
            {/* Gráfico 1: Evolución de Ingresos */}
            <div className="admin-chart-box">
              <div className="admin-chart-header">
                <div>
                  <h3 className="admin-chart-title">Evolución de Recaudación</h3>
                  <p className="admin-chart-subtitle">Histórico de ingresos de los últimos meses</p>
                </div>
                <div className="admin-chart-tag">
                  <FaMoneyBillWave /> Facturación
                </div>
              </div>
              <div className="admin-chart-canvas-wrapper">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={graficos.ingresosMensuales} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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

            {/* Gráfico 2: Asistencias por día */}
            <div className="admin-chart-box">
              <div className="admin-chart-header">
                <div>
                  <h3 className="admin-chart-title">Afluencia Semanal</h3>
                  <p className="admin-chart-subtitle">Asistencias registradas por día de la semana</p>
                </div>
                <div className="admin-chart-tag tag-cyan">
                  <FaCalendarCheck /> Concurrencia
                </div>
              </div>
              <div className="admin-chart-canvas-wrapper">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={graficos.asistenciasPorDia} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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