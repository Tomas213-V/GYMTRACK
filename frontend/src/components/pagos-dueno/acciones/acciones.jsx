import { FaDollarSign, FaChevronRight } from "react-icons/fa";
import "./acciones.css";

function PagosAcciones({ onAbrirModal }) {
  return (
    <div className="Caja-pagos-acciones">
      {/* Tarjeta Registrar Pago (con borde y glow verde) */}
      <div
        className="Caja-pagos-accion-card Caja-pagos-accion-card-verde"
        onClick={onAbrirModal}
        role="button"
        tabIndex={0}
      >
        <div className="Caja-pagos-accion-icono Caja-pagos-accion-icono-verde">
          <FaDollarSign />
        </div>
        <div className="Caja-pagos-accion-info">
          <h3>Registrar pago</h3>
          <p>Registrar un nuevo pago de un socio</p>
        </div>
        <div className="Caja-pagos-accion-flecha">
          <FaChevronRight />
        </div>
      </div>
    </div>
  );
}

export default PagosAcciones;
