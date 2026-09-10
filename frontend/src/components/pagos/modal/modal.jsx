import { useState, useEffect } from "react";
import { FaPlus, FaTimes } from "react-icons/fa";
import { getMembresias } from "../../../services/pagoService";
import "./modal.css";

function PagosModal({ abierto, onCerrar, onGuardarPago, gymId }) {
  const [membresiasDisponibles, setMembresiasDisponibles] = useState([]);
  const [modoSeleccion, setModoSeleccion] = useState("existente"); // 'existente' o 'nuevo'

  const [formulario, setFormulario] = useState({
    id_membresia: "",
    nombreSocio: "",
    dniSocio: "",
    plan: "Plan Premium",
    monto: "18000",
    metodo_pago: "efectivo",
    estado: "pagado",
    fecha_pago: new Date().toISOString().split("T")[0]
  });

  const [mensajeExito, setMensajeExito] = useState("");
  const [mensajeError, setMensajeError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Cargar lista de socios/membresías existentes
  useEffect(() => {
    if (abierto) {
      getMembresias({ id_gimnasio: gymId })
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setMembresiasDisponibles(data);
            const primero = data[0];
            const usuario = primero.socio?.usuario || {};
            setFormulario((prev) => ({
              ...prev,
              id_membresia: primero.id_membresia,
              nombreSocio: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Socio',
              dniSocio: primero.socio?.dni || '',
              plan: primero.tipo || 'Plan Premium',
              monto: primero.precio ? String(primero.precio) : '18000'
            }));
            setModoSeleccion("existente");
          } else {
            setMembresiasDisponibles([]);
            setModoSeleccion("nuevo");
            setFormulario((prev) => ({
              ...prev,
              id_membresia: "",
              nombreSocio: "",
              dniSocio: ""
            }));
          }
        })
        .catch((err) => {
          console.warn("No se pudieron obtener membresías:", err);
          setModoSeleccion("nuevo");
          setFormulario((prev) => ({
            ...prev,
            id_membresia: "",
            nombreSocio: "",
            dniSocio: ""
          }));
        });
    }
  }, [abierto, gymId]);

  if (!abierto) return null;

  const handleSeleccionarSocioExistente = (e) => {
    const membId = e.target.value;
    if (membId === "nuevo") {
      setModoSeleccion("nuevo");
      setFormulario((prev) => ({
        ...prev,
        id_membresia: "",
        nombreSocio: "",
        dniSocio: ""
      }));
      return;
    }

    const memb = membresiasDisponibles.find((m) => String(m.id_membresia) === String(membId));
    if (memb) {
      const u = memb.socio?.usuario || {};
      setModoSeleccion("existente");
      setFormulario((prev) => ({
        ...prev,
        id_membresia: memb.id_membresia,
        nombreSocio: `${u.nombre || ''} ${u.apellido || ''}`.trim() || 'Socio',
        dniSocio: memb.socio?.dni || '',
        plan: memb.tipo || prev.plan,
        monto: memb.precio ? String(memb.precio) : prev.monto
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormulario((prev) => {
      const nuevo = { ...prev, [name]: value };
      // Si el usuario escribe manualmente nombre o DNI, desvincular de membresía existente
      if (name === "nombreSocio" || name === "dniSocio") {
        nuevo.id_membresia = "";
        setModoSeleccion("nuevo");
      }
      return nuevo;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensajeError("");
    setMensajeExito("");
    setCargando(true);

    try {
      const payload = {
        ...formulario,
        id_membresia: modoSeleccion === "nuevo" ? "" : (formulario.id_membresia || "")
      };
      await onGuardarPago(payload);
      setMensajeExito("¡Pago registrado correctamente en la base de datos!");
      setTimeout(() => {
        setMensajeExito("");
        onCerrar();
        setFormulario({
          id_membresia: "",
          nombreSocio: "",
          dniSocio: "",
          plan: "Plan Premium",
          monto: "18000",
          metodo_pago: "efectivo",
          estado: "pagado",
          fecha_pago: new Date().toISOString().split("T")[0]
        });
      }, 700);
    } catch (err) {
      setMensajeError(err.message || "Error al procesar el pago");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="Caja-pagos-modal-overlay" onClick={onCerrar}>
      <div
        className="Caja-pagos-modal-contenedor"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="Caja-pagos-modal-header">
          <div className="Caja-pagos-modal-titulo-grupo">
            <div className="Caja-pagos-accion-icono Caja-pagos-accion-icono-verde">
              <FaPlus />
            </div>
            <div>
              <h2>Registrar Nuevo Pago</h2>
              <p>Ingresa o selecciona el socio para registrar su pago</p>
            </div>
          </div>
          <button className="Caja-pagos-modal-cerrar" onClick={onCerrar}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="Caja-pagos-modal-form">
          {mensajeExito && (
            <div className="Caja-pagos-alerta Caja-pagos-alerta-exito">
              {mensajeExito}
            </div>
          )}
          {mensajeError && (
            <div className="Caja-pagos-alerta Caja-pagos-alerta-error">
              {mensajeError}
            </div>
          )}

          {/* Selector de Socio: Existente o Nuevo */}
          {membresiasDisponibles.length > 0 && (
            <div className="Caja-pagos-form-grupo">
              <label>Socio</label>
              <select
                value={modoSeleccion === "nuevo" ? "nuevo" : formulario.id_membresia}
                onChange={handleSeleccionarSocioExistente}
              >
                <optgroup label="Socios con membresía activa">
                  {membresiasDisponibles.map((m) => {
                    const u = m.socio?.usuario || {};
                    const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim() || 'Socio';
                    return (
                      <option key={m.id_membresia} value={m.id_membresia}>
                        {nombre} (DNI: {m.socio?.dni || 'S/D'}) - {m.tipo}
                      </option>
                    );
                  })}
                </optgroup>
                <option value="nuevo">+ Registrar nuevo socio o socio sin membresía</option>
              </select>
            </div>
          )}

          {/* Campos de Nombre y DNI (editables o manuales si es nuevo socio) */}
          <div className="Caja-pagos-form-fila">
            <div className="Caja-pagos-form-grupo">
              <label>Nombre y Apellido</label>
              <input
                type="text"
                name="nombreSocio"
                placeholder="Ej: Mariano López"
                value={formulario.nombreSocio}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="Caja-pagos-form-grupo">
              <label>DNI del Socio</label>
              <input
                type="text"
                name="dniSocio"
                placeholder="Ej: 39123456"
                value={formulario.dniSocio}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="Caja-pagos-form-fila">
            <div className="Caja-pagos-form-grupo">
              <label>Plan</label>
              <select
                name="plan"
                value={formulario.plan}
                onChange={handleInputChange}
              >
                <option value="Plan Premium">Plan Premium</option>
                <option value="Plan Básico">Plan Básico</option>
                <option value="Pase Libre">Pase Libre</option>
              </select>
            </div>

            <div className="Caja-pagos-form-grupo">
              <label>Monto ($)</label>
              <input
                type="number"
                name="monto"
                placeholder="18000"
                value={formulario.monto}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="Caja-pagos-form-fila">
            <div className="Caja-pagos-form-grupo">
              <label>Método de Pago</label>
              <select
                name="metodo_pago"
                value={formulario.metodo_pago}
                onChange={handleInputChange}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>

            <div className="Caja-pagos-form-grupo">
              <label>Estado</label>
              <select
                name="estado"
                value={formulario.estado}
                onChange={handleInputChange}
              >
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="vencido">Vencido</option>
              </select>
            </div>
          </div>

          <div className="Caja-pagos-form-grupo">
            <label>Fecha de Pago</label>
            <input
              type="date"
              name="fecha_pago"
              value={formulario.fecha_pago}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="Caja-pagos-modal-acciones">
            <button
              type="button"
              className="Caja-pagos-btn-cancelar"
              onClick={onCerrar}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="Caja-pagos-btn-guardar"
              disabled={cargando}
            >
              {cargando ? "Guardando en Base de Datos..." : "Guardar Pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PagosModal;
