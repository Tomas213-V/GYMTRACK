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
  FaClock,
  FaCheckCircle,
  FaHourglassHalf
} from "react-icons/fa";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import "./dashboard.css";

const PIE_COLORS = ["#22c55e", "#0ea5e9", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6"];

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

  const formatearHora = (isoStr) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoStr;
    }
  };

  const formatearFecha = (isoStr) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return isoStr;
    }
  };

  const nombreDuenio = usuario?.nombre
    ? `${usuario.nombre} ${usuario.apellido || ""}`.trim()
    : "Administrador";

  const nombreGym = data?.gimnasio?.nombre || usuario?.gimnasio?.nombre || "Mi Gimnasio";

  const kpis = data?.kpis || {
    socios: { total: 0, activos: 0, inactivos: 0, pendientes: 0, nuevosMes: 0 },
    ingresos: { mesActual: 0, mesAnterior: 0, variacionPorcentaje: 0, pagosRealizados: 0, pagosPendientes: 0, pagosVencidos: 0 },
    asistencias: { hoy: 0, mesActual: 0, mesAnterior: 0, variacionPorcentaje: 0 },
    membresiasPorVencer: 0
  };

  const graficos = data?.graficos || {
    ingresosMensuales: [],
    asistenciasPorDia: [],
    distribucionPlanes: []
  };

  const actividad = data?.actividadReciente || {
    asistencias: [],
    pagos: []
  };

  const vencimientos = data?.proximosVencimientos || [];

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
                <h3 className="kpi-card-valor">{kpis.membresiasPorVencer + kpis.ingresos.pagosPendientes}</h3>
                <span className="kpi-card-label">Cuotas a Cobrar / Por Vencer</span>
              </div>
              <div className="kpi-card-footer">
                <div className="kpi-pill-warning">
                  <b>{kpis.ingresos.pagosPendientes}</b> pendientes
                </div>
                {kpis.ingresos.pagosVencidos > 0 && (
                  <div className="kpi-pill-danger">
                    <b>{kpis.ingresos.pagosVencidos}</b> vencidos
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

          {/* =========================================================
              SEGUNDA FILA DE CONTENIDO: PLANES Y VENCIMIENTOS
             ========================================================= */}
          <section className="admin-dash-middle-grid">
            {/* Distribución por Planes */}
            <div className="admin-chart-box">
              <div className="admin-chart-header">
                <div>
                  <h3 className="admin-chart-title">Membresías por Plan</h3>
                  <p className="admin-chart-subtitle">Distribución activa de socios por categoría</p>
                </div>
              </div>
              <div className="admin-pie-layout">
                <div className="admin-pie-chart-wrap">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={graficos.distribucionPlanes}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {graficos.distribucionPlanes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#15181e",
                          borderColor: "#262c37",
                          borderRadius: "8px",
                          color: "#fff"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="admin-pie-legend">
                  {graficos.distribucionPlanes.map((item, idx) => (
                    <div key={idx} className="admin-legend-item">
                      <span
                        className="admin-legend-dot"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      ></span>
                      <span className="admin-legend-label">{item.name}</span>
                      <span className="admin-legend-val">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alerta de Vencimientos Próximos */}
            <div className="admin-dash-table-card">
              <div className="dash-table-header">
                <div>
                  <h3 className="dash-table-title">Vencimientos Próximos (7 días)</h3>
                  <p className="dash-table-subtitle">Socios cuyas membresías están por caducar</p>
                </div>
                <Link to="/pagos-dueño" className="dash-view-all-link">
                  Gestionar cuotas <FaChevronRight />
                </Link>
              </div>

              <div className="dash-table-body">
                {vencimientos.length === 0 ? (
                  <div className="dash-empty-state">
                    <FaCheckCircle className="dash-empty-icon text-success" />
                    <p>No hay cuotas por vencer en los próximos 7 días.</p>
                  </div>
                ) : (
                  <div className="dash-vencimientos-list">
                    {vencimientos.map((item) => (
                      <div key={item.id_membresia} className="dash-vencimiento-item">
                        <div className="dash-venc-avatar">
                          {item.socio.nombre?.slice(0, 2).toUpperCase() || "SO"}
                        </div>
                        <div className="dash-venc-info">
                          <strong>{item.socio.nombre}</strong>
                          <span>DNI: {item.socio.dni || "S/D"} • {item.plan}</span>
                        </div>
                        <div className="dash-venc-date-tag">
                          <FaHourglassHalf />
                          <span>Vence: {formatearFecha(item.fecha_fin)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* =========================================================
              ACTIVIDAD RECIENTE EN VIVO: ASISTENCIAS Y PAGOS
             ========================================================= */}
          <section className="admin-dash-feed-grid">
            {/* Feed 1: Últimas Asistencias */}
            <div className="admin-dash-table-card">
              <div className="dash-table-header">
                <div>
                  <h3 className="dash-table-title">Últimos Ingresos Registrados</h3>
                  <p className="dash-table-subtitle">Socios que ingresaron recientemente al gimnasio</p>
                </div>
                <Link to="/asistencias-dueño" className="dash-view-all-link">
                  Ver todas <FaChevronRight />
                </Link>
              </div>

              <div className="dash-feed-list">
                {actividad.asistencias.length === 0 ? (
                  <div className="dash-empty-state">
                    <p>No hay ingresos recientes registrados hoy.</p>
                  </div>
                ) : (
                  actividad.asistencias.map((asist, idx) => (
                    <div key={asist.id || idx} className="dash-feed-item">
                      <div className="dash-feed-left">
                        <div className="dash-feed-avatar avatar-asist">
                          {asist.socio ? asist.socio[0].toUpperCase() : "S"}
                        </div>
                        <div className="dash-feed-text">
                          <strong>{asist.socio}</strong>
                          <span>DNI: {asist.dni}</span>
                        </div>
                      </div>
                      <div className="dash-feed-right">
                        <span className="dash-badge-hora">
                          <FaClock /> {formatearHora(asist.hora)}
                        </span>
                        <span className="dash-badge-asist-status">Presente</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Feed 2: Últimos Pagos Registrados */}
            <div className="admin-dash-table-card">
              <div className="dash-table-header">
                <div>
                  <h3 className="dash-table-title">Últimos Pagos Recibidos</h3>
                  <p className="dash-table-subtitle">Cobranzas y registros financieros recientes</p>
                </div>
                <Link to="/pagos-dueño" className="dash-view-all-link">
                  Ver todos <FaChevronRight />
                </Link>
              </div>

              <div className="dash-feed-list">
                {actividad.pagos.length === 0 ? (
                  <div className="dash-empty-state">
                    <p>No se han registrado pagos recientemente.</p>
                  </div>
                ) : (
                  actividad.pagos.map((pago, idx) => (
                    <div key={pago.id || idx} className="dash-feed-item">
                      <div className="dash-feed-left">
                        <div className="dash-feed-avatar avatar-pago">
                          <FaMoneyBillWave />
                        </div>
                        <div className="dash-feed-text">
                          <strong>{pago.socio}</strong>
                          <span>{pago.plan} • {pago.metodo}</span>
                        </div>
                      </div>
                      <div className="dash-feed-right">
                        <strong className="dash-feed-monto">
                          {formatearDinero(pago.monto)}
                        </strong>
                        <span className={`dash-badge-pago-estado estado-${pago.estado}`}>
                          {pago.estado}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;