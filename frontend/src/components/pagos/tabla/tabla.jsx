import { FaUser, FaChevronRight, FaChevronLeft, FaChevronDown } from "react-icons/fa";
import "./tabla.css";

function PagosTabla({
  pagos = [],
  totalPagos = 0,
  paginaActual = 1,
  setPaginaActual,
  elementosPorPagina = 8,
  onVerTodos,
  onCambiarEstado,
  onVerDetalle
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
              <th className="Caja-pagos-th-estado">Estado (Editable)</th>
              <th className="Caja-pagos-th-accion"></th>
            </tr>
          </thead>
          <tbody>
            {pagos.length > 0 ? (
              pagos.map((item) => (
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

                  {/* Estado Badge / Selector manual editable */}
                  <td className="Caja-pagos-td-estado">
                    <div className="Caja-pagos-estado-selector-wrapper">
                      <select
                        className={`Caja-pagos-badge Caja-pagos-badge-select Caja-pagos-badge-${(item.estado || "pagado").toLowerCase()}`}
                        value={(item.estado || "pagado").toLowerCase()}
                        onChange={(e) => onCambiarEstado && onCambiarEstado(item.id, e.target.value)}
                        title="Haz clic para cambiar el estado manualmente"
                      >
                        <option value="pagado">Pagado</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="vencido">Vencido</option>
                      </select>
                      <FaChevronDown className="Caja-pagos-badge-flecha" />
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
              ))
            ) : (
              <tr>
                <td colSpan="6" className="Caja-pagos-sin-resultados">
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
              className={`Caja-pagos-pag-btn ${
                paginaActual === num ? "Caja-pagos-pag-activo" : ""
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
