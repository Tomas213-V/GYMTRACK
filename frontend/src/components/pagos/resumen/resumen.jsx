import { FaDollarSign, FaCheck, FaClock } from "react-icons/fa";
import "./resumen.css";

function PagosResumen({ resumen, onVerEstadisticas }) {
  // Formateador de moneda en pesos argentinos
  const formatearMonto = (valor) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(valor).replace("ARS", "$").trim();
  };

  return (
    <div className="Caja-pagos-resumen">
      <div className="Caja-pagos-resumen-header">
        <h2>Resumen de pagos</h2>
        <button
          className="Caja-pagos-btn-estadisticas"
          onClick={
            onVerEstadisticas ||
            (() => alert("Módulo de analíticas avanzadas en construcción."))
          }
        >
          Ver estadísticas
        </button>
      </div>

      <div className="Caja-pagos-resumen-subtitulo">Este mes</div>

      {/* Métricas en 3 columnas */}
      <div className="Caja-pagos-resumen-metricas">
        {/* 1. Total recaudado */}
        <div className="Caja-pagos-metrica-item">
          <div className="Caja-pagos-metrica-icono Caja-pagos-metrica-icono-morado">
            <FaDollarSign />
          </div>
          <div className="Caja-pagos-metrica-valor">
            {formatearMonto(resumen.total_recaudado)}
          </div>
          <div className="Caja-pagos-metrica-etiqueta">Total recaudado</div>
        </div>

        {/* 2. Pagos realizados */}
        <div className="Caja-pagos-metrica-item">
          <div className="Caja-pagos-metrica-icono Caja-pagos-metrica-icono-verde">
            <FaCheck />
          </div>
          <div className="Caja-pagos-metrica-valor">{resumen.pagos_realizados}</div>
          <div className="Caja-pagos-metrica-etiqueta">Pagos realizados</div>
        </div>

        {/* 3. Pendientes */}
        <div className="Caja-pagos-metrica-item">
          <div className="Caja-pagos-metrica-icono Caja-pagos-metrica-icono-naranja">
            <FaClock />
          </div>
          <div className="Caja-pagos-metrica-valor">{resumen.pagos_pendientes}</div>
          <div className="Caja-pagos-metrica-etiqueta">Pendientes</div>
        </div>
      </div>
    </div>
  );
}

export default PagosResumen;
