import { FaSearch, FaChevronDown, FaCalendarAlt, FaFilter, FaTimes } from "react-icons/fa";
import "./filtros.css";

function PagosFiltros({
  busqueda,
  setBusqueda,
  filtroEstado,
  setFiltroEstado,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  onLimpiarFiltros
}) {
  const hayFiltrosActivos =
    busqueda || filtroEstado !== "todos" || fechaDesde || fechaHasta;

  return (
    <div className="Caja-pagos-filtros">
      {/* Input Buscador (Nombre o DNI) */}
      <div className="Caja-pagos-buscador">
        <FaSearch className="Caja-pagos-buscador-icono" />
        <input
          type="text"
          placeholder="Buscar por nombre o DNI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {busqueda && (
          <button
            type="button"
            className="Caja-pagos-buscador-limpiar"
            onClick={() => setBusqueda("")}
            title="Borrar búsqueda"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Selector de Estados */}
      <div className="Caja-pagos-filtro-select-wrapper">
        <select
          className="Caja-pagos-filtro-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="aprobado">Aprobados</option>
          <option value="pendiente">Pendientes</option>
          <option value="rechazado">Rechazados</option>
          <option value="anulado">Anulados</option>
        </select>
        <FaChevronDown className="Caja-pagos-select-flecha" />
      </div>

      {/* Rango de Fechas: Desde y Hasta */}
      <div className="Caja-pagos-filtro-fechas-grupo">
        <FaCalendarAlt className="Caja-pagos-filtro-icono" />
        <div className="Caja-pagos-fecha-item">
          <label className="Caja-pagos-fecha-label">Desde</label>
          <input
            type="date"
            className="Caja-pagos-fecha-input"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            title="Fecha inicial"
          />
        </div>
        <span className="Caja-pagos-fecha-separador">-</span>
        <div className="Caja-pagos-fecha-item">
          <label className="Caja-pagos-fecha-label">Hasta</label>
          <input
            type="date"
            className="Caja-pagos-fecha-input"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            title="Fecha final"
          />
        </div>
        {(fechaDesde || fechaHasta) && (
          <button
            type="button"
            className="Caja-pagos-fecha-btn-limpiar"
            onClick={() => {
              setFechaDesde("");
              setFechaHasta("");
            }}
            title="Quitar rango de fechas"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Botón Restablecer Filtros */}
      {hayFiltrosActivos && (
        <button
          className="Caja-pagos-filtro-btn"
          onClick={onLimpiarFiltros}
          title="Restablecer todos los filtros"
        >
          <FaFilter className="Caja-pagos-filtro-icono" />
          <span>Limpiar</span>
        </button>
      )}
    </div>
  );
}

export default PagosFiltros;
