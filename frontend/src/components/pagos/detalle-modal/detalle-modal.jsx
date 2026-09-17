import { useState, useEffect } from "react";
import { 
  FaTimes, 
  FaTrash, 
  FaUser, 
  FaCalendarAlt, 
  FaMoneyBillWave, 
  FaCreditCard, 
  FaExchangeAlt, 
  FaReceipt, 
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaTimesCircle
} from "react-icons/fa";
import { getPagoById } from "../../../services/pagoService";
import "./detalle-modal.css";

function PagosDetalleModal({
  abierto,
  pago,
  onCerrar,
  onEliminarPago,
  onCambiarEstado
}) {
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cargar información completa del pago desde la API cuando se abre el modal
  useEffect(() => {
    if (abierto && pago?.id) {
      setConfirmandoEliminar(false);
      setErrorMsg("");
      setCargandoDetalle(true);
      getPagoById(pago.id)
        .then((data) => {
          setDetalle(data);
        })
        .catch((err) => {
          console.warn("No se pudo cargar detalle extendido:", err);
          setDetalle(null);
        })
        .finally(() => {
          setCargandoDetalle(false);
        });
    } else {
      setDetalle(null);
      setConfirmandoEliminar(false);
      setErrorMsg("");
    }
  }, [abierto, pago]);

  if (!abierto || !pago) return null;

  // Formateador de moneda en pesos argentinos
  const formatearMonto = (valor) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(valor).replace("ARS", "$").trim();
  };

  // Formatear fechas YYYY-MM-DD a DD/MM/YYYY
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "-";
    const partes = fechaStr.split("T")[0].split("-");
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
  };

  // Ícono según método de pago
  const renderIconoMetodo = (metodo) => {
    const m = String(metodo || "efectivo").toLowerCase();
    if (m === "transferencia") return <FaExchangeAlt />;
    if (m === "tarjeta") return <FaCreditCard />;
    return <FaMoneyBillWave />;
  };

  // Datos extraídos del detalle de Supabase o del objeto pago de la tabla
  const socioData = detalle?.membresia?.socio || {};
  const usuarioData = socioData.usuario || {};
  const nombreSocio = usuarioData.nombre
    ? `${usuarioData.nombre} ${usuarioData.apellido || ""}`.trim()
    : (pago.socio?.nombre || "Socio");
  const dniSocio = socioData.dni || pago.socio?.dni || "S/D";
  const telefonoSocio = socioData.telefono || "No especificado";
  const emailSocio = usuarioData.email || "No especificado";
  const metodoPago = detalle?.metodo_pago || pago.metodo_pago || "efectivo";
  const estadoActual = (pago.estado || detalle?.estado || "pagado").toLowerCase();
  const fechaPago = pago.fecha || formatearFecha(detalle?.fecha_pago);
  const planNombre = detalle?.membresia?.tipo || pago.plan || "Plan General";
  const vencimientoMembresia = detalle?.membresia?.fecha_vencimiento
    ? formatearFecha(detalle.membresia.fecha_vencimiento)
    : "Sin vencimiento fijo";

  // Manejador de eliminación con confirmación
  const handleConfirmarEliminar = async () => {
    setEliminando(true);
    setErrorMsg("");
    try {
      await onEliminarPago(pago.id);
      onCerrar();
    } catch (err) {
      setErrorMsg(err.message || "Error al eliminar el pago");
      setEliminando(false);
    }
  };

  return (
    <div className="Caja-pagos-modal-overlay" onClick={onCerrar}>
      <div
        className="Caja-pagos-modal-contenedor Caja-pagos-detalle-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del Modal */}
        <div className="Caja-pagos-modal-header">
          <div className="Caja-pagos-modal-titulo-grupo">
            <div className="Caja-pagos-accion-icono Caja-pagos-accion-icono-verde">
              <FaReceipt />
            </div>
            <div>
              <h2>Detalle del Pago #{String(pago.id).padStart(4, "0")}</h2>
              <p>Información completa del registro y del socio</p>
            </div>
          </div>
          <button className="Caja-pagos-modal-cerrar" onClick={onCerrar} title="Cerrar ventana">
            <FaTimes />
          </button>
        </div>

        {/* Mensaje de error si la eliminación falla */}
        {errorMsg && (
          <div className="Caja-pagos-alerta Caja-pagos-alerta-error">
            <FaExclamationTriangle />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Cuerpo del Modal */}
        <div className="Caja-pagos-detalle-cuerpo">
          {/* Tarjeta Destacada de Monto y Estado */}
          <div className="Caja-pagos-detalle-banner">
            <div className="Caja-pagos-detalle-monto-grupo">
              <span className="Caja-pagos-detalle-monto-label">Monto cobrado</span>
              <span className="Caja-pagos-detalle-monto-valor">
                {formatearMonto(pago.monto)}
              </span>
            </div>

            <div className="Caja-pagos-detalle-estado-selector">
              <label>Estado del Pago:</label>
              <select
                className={`Caja-pagos-badge Caja-pagos-badge-select Caja-pagos-badge-${estadoActual}`}
                value={estadoActual}
                onChange={(e) => onCambiarEstado && onCambiarEstado(pago.id, e.target.value)}
              >
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="vencido">Vencido</option>
              </select>
            </div>
          </div>

          {/* Tarjeta de Información del Socio */}
          <div className="Caja-pagos-detalle-seccion">
            <h4 className="Caja-pagos-detalle-seccion-titulo">Datos del Socio</h4>
            <div className="Caja-pagos-detalle-socio-card">
              <div className="Caja-pagos-socio-avatar">
                <FaUser />
              </div>
              <div className="Caja-pagos-detalle-socio-info">
                <h3>{nombreSocio}</h3>
                <div className="Caja-pagos-detalle-chips">
                  <span className="Caja-pagos-detalle-chip">DNI: {dniSocio}</span>
                  <span className="Caja-pagos-detalle-chip">Tel: {telefonoSocio}</span>
                  {emailSocio && !emailSocio.includes("@gymtrack.local") && (
                    <span className="Caja-pagos-detalle-chip">Email: {emailSocio}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Grilla de Detalles del Pago y Plan */}
          <div className="Caja-pagos-detalle-seccion">
            <h4 className="Caja-pagos-detalle-seccion-titulo">Detalles de la Transacción</h4>
            <div className="Caja-pagos-detalle-grid">
              <div className="Caja-pagos-detalle-item">
                <span className="Caja-pagos-detalle-item-label">Plan / Membresía</span>
                <span className="Caja-pagos-detalle-item-valor">{planNombre}</span>
              </div>

              <div className="Caja-pagos-detalle-item">
                <span className="Caja-pagos-detalle-item-label">Fecha del Pago</span>
                <span className="Caja-pagos-detalle-item-valor">{fechaPago}</span>
              </div>

              <div className="Caja-pagos-detalle-item">
                <span className="Caja-pagos-detalle-item-label">Método de Pago</span>
                <span className="Caja-pagos-detalle-item-valor Caja-pagos-metodo-badge">
                  {renderIconoMetodo(metodoPago)}
                  {metodoPago.charAt(0).toUpperCase() + metodoPago.slice(1)}
                </span>
              </div>

              <div className="Caja-pagos-detalle-item">
                <span className="Caja-pagos-detalle-item-label">Vencimiento Cuota</span>
                <span className="Caja-pagos-detalle-item-valor">{vencimientoMembresia}</span>
              </div>
            </div>
          </div>

          {/* Zona de Peligro / Confirmación de Eliminación */}
          <div className="Caja-pagos-detalle-zona-eliminar">
            {!confirmandoEliminar ? (
              <div className="Caja-pagos-detalle-eliminar-barra">
                <p>¿Necesitas anular o remover esta transacción del sistema?</p>
                <button
                  type="button"
                  className="Caja-pagos-btn-eliminar-pago"
                  onClick={() => setConfirmandoEliminar(true)}
                >
                  <FaTrash />
                  <span>Eliminar Pago</span>
                </button>
              </div>
            ) : (
              <div className="Caja-pagos-detalle-confirmar-caja">
                <div className="Caja-pagos-confirmar-texto">
                  <FaExclamationTriangle className="Caja-pagos-confirmar-icono" />
                  <div>
                    <strong>¿Estás seguro de eliminar este pago?</strong>
                    <p>Esta acción removerá el registro de la base de datos de manera irreversible.</p>
                  </div>
                </div>
                <div className="Caja-pagos-confirmar-botones">
                  <button
                    type="button"
                    className="Caja-pagos-btn-cancelar"
                    onClick={() => setConfirmandoEliminar(false)}
                    disabled={eliminando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="Caja-pagos-btn-peligro-confirmar"
                    onClick={handleConfirmarEliminar}
                    disabled={eliminando}
                  >
                    <FaTrash />
                    <span>{eliminando ? "Eliminando..." : "Sí, eliminar definitivamente"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="Caja-pagos-modal-footer">
          <button type="button" className="Caja-pagos-btn-cancelar" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default PagosDetalleModal;
