import { FaUser, FaChevronRight, FaChevronLeft, FaChevronDown, FaCheckCircle } from "react-icons/fa";
import "./tabla.css";

function getEstadoCuotaMeta(estadoCuota) {
  const est = String(estadoCuota || "").toLowerCase();
  if (est === "activa" || est === "al_dia") {
    return { label: "Al día", bg: "rgba(34, 197, 94, 0.14)", color: "#86efac", border: "rgba(34, 197, 94, 0.35)" };
  }
  if (est === "pendiente") {
    return { label: "Pendiente", bg: "rgba(245, 158, 11, 0.14)", color: "#fcd34d", border: "rgba(245, 158, 11, 0.35)" };
  }
  if (est === "cancelada") {
    return { label: "Cancelada", bg: "rgba(148, 163, 184, 0.14)", color: "#cbd5e1", border: "rgba(148, 163, 184, 0.35)" };
  }
  return { label: "Vencida", bg: "rgba(239, 68, 68, 0.14)", color: "#fca5a5", border: "rgba(239, 68, 68, 0.35)" };
}

function PagosTabla({
  pagos = [],
  totalPagos = 0,
  paginaActual = 1,
  setPaginaActual,
  elementosPorPagina = 8,
  onVerTodos,
  onCambiarEstado,
  onVerDetalle,
  cargando = false
}) {
  // Formateador de moneda en pesos argentinos
  const formatearMonto = (valor) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(valor).replace("ARS", "$").trim();
  };

  const totalPaginas = Math.ceil(totalPagos / elementosPorPagina) || 1;
  const indiceInicio = (paginaActual - 1) * elementosPorPagina;

  return (
    <div className="Caja-pagos-recientes">
      {/* Cabecera de la sección */}
      <div className="Caja-pagos-recientes-header">
        <h2>Pagos recientes</h2>
        <button className="Caja-pagos-btn-ver-todos" onClick={onVerTodos}>
          Ver todos
        </button>
      </div>

      {/* Contenedor de la tabla */}
      <div className="Caja-pagos-tabla-contenedor">
        <table className="Caja-pagos-tabla">
          <thead>
            <tr>
              <th className="Caja-pagos-th-socio">Socio</th>
              <th className="Caja-pagos-th-plan">Plan</th>
              <th className="Caja-pagos-th-fecha">Fecha</th>
              <th className="Caja-pagos-th-monto">Monto</th>
              <th className="Caja-pagos-th-plan">Estado de cuota</th>
              <th className="Caja-pagos-th-estado">Estado Pago</th>
              <th className="Caja-pagos-th-accion"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="7" className="Caja-pagos-sin-resultados" style={{ color: '#10b981', padding: '32px' }}>
                  Cargando listado de pagos...
                </td>
              </tr>
            ) : pagos.length > 0 ? (
              pagos.map((item) => {
                const estadoPago = String(item.estado ?? "aprobado").toLowerCase();
                const cuotaMeta = getEstadoCuotaMeta(item.estadoCuota);
                return (
                <tr key={item.id} className="Caja-pagos-fila">
                  {/* Socio con Avatar */}
                  <td className="Caja-pagos-td-socio">
                    <div className="Caja-pagos-socio-item">
                      <div className="Caja-pagos-socio-avatar">
                        <FaUser />
                      </div>
                      <div className="Caja-pagos-socio-detalles">
                        <span className="Caja-pagos-socio-nombre">{item.socio?.nombre || "Socio"}</span>
                        <span className="Caja-pagos-socio-dni">DNI: {item.socio?.dni || "S/D"}</span>
                      </div>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="Caja-pagos-td-plan">{item.plan || "Plan Básico"}</td>

                  {/* Fecha */}
                  <td className="Caja-pagos-td-fecha">{item.fecha}</td>

                  {/* Monto */}
                  <td className="Caja-pagos-td-monto">{formatearMonto(item.monto)}</td>

                  {/* Estado de cuota */}
                  <td className="Caja-pagos-td-plan">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          background: cuotaMeta.bg,
                          color: cuotaMeta.color,
                          border: `1px solid ${cuotaMeta.border}`
                        }}
                      >
                        {cuotaMeta.label}
                      </span>
                      {item.fechaVencimiento && (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Vto: {item.fechaVencimiento}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Estado Badge / Selector manual editable + Marcar como pagado */}
                  <td className="Caja-pagos-td-estado">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                      <div className="Caja-pagos-estado-selector-wrapper">
                        <select
                          className={`Caja-pagos-badge Caja-pagos-badge-select Caja-pagos-badge-${
                            estadoPago === "aprobado"
                              ? "pagado"
                              : estadoPago === "pendiente"
                              ? "pendiente"
                              : "vencido"
                          }`}
                          value={estadoPago}
                          onChange={(e) => onCambiarEstado && onCambiarEstado(item.id, e.target.value)}
                          title="Haz clic para cambiar el estado manualmente"
                        >
                          <option value="aprobado">Aprobado</option>
                          <option value="pendiente">Pendiente</option>
                          <option value="rechazado">Rechazado</option>
                          <option value="anulado">Anulado</option>
                        </select>
                        <FaChevronDown className="Caja-pagos-badge-flecha" />
                      </div>
                      {estadoPago === "pendiente" && onCambiarEstado && (
                        <button
                          type="button"
                          onClick={() => onCambiarEstado(item.id, "aprobado")}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 9px',
                            borderRadius: '7px',
                            border: '1px solid rgba(163, 230, 53, 0.45)',
                            background: 'rgba(163, 230, 53, 0.14)',
                            color: '#bef264',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <FaCheckCircle /> Marcar como pagado
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Flecha lateral / Abrir subventana de detalle y eliminación */}
                  <td className="Caja-pagos-td-accion">
                    <button
                      type="button"
                      className="Caja-pagos-btn-accion-fila"
                      onClick={() => onVerDetalle && onVerDetalle(item)}
                      title="Ver información detallada y opciones del pago"
                    >
                      <FaChevronRight className="Caja-pagos-fila-flecha" />
                    </button>
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="Caja-pagos-sin-resultados">
                  No se encontraron pagos con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="Caja-pagos-paginacion">
        <div className="Caja-pagos-paginacion-info">
          Mostrando {totalPagos > 0 ? indiceInicio + 1 : 0} -{" "}
          {Math.min(indiceInicio + elementosPorPagina, totalPagos)} de {totalPagos} pagos
        </div>
        <div className="Caja-pagos-paginacion-controles">
          <button
            className="Caja-pagos-pag-btn Caja-pagos-pag-nav"
            disabled={paginaActual === 1}
            onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
          >
            <FaChevronLeft />
          </button>

          {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              className={`Caja-pagos-pag-btn ${paginaActual === num ? "Caja-pagos-pag-activo" : ""
                }`}
              onClick={() => setPaginaActual(num)}
            >
              {num}
            </button>
          ))}

          <button
            className="Caja-pagos-pag-btn Caja-pagos-pag-nav"
            disabled={paginaActual >= totalPaginas}
            onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
          >
            <FaChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PagosTabla;
