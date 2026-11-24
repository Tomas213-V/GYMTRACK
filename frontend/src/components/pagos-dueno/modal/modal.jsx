import { useState, useEffect } from "react";
import { FaPlus, FaTimes, FaUserCheck, FaUserPlus } from "react-icons/fa";
import { getMembresias, getPlanes } from "../../../services/pagoService";
import { getFechaArgentinaISO } from "../../../utils/dateUtils";
import "./modal.css";

function extraerDatosSocio(s, planesDisponibles = []) {
  if (!s) return null;

  const socioObj = s.socio || s;
  const nombreCompleto = socioObj.nombre
    ? `${socioObj.nombre} ${socioObj.apellido || ''}`.trim()
    : 'Socio';

  const dni = socioObj.dni || '';

  const membList = Array.isArray(s.membresias)
    ? s.membresias
    : (Array.isArray(s.membresia) ? s.membresia : (s.membresia ? [s.membresia] : []));

  const membActiva =
    s.membresia_activa ||
    membList.find((m) => ['pendiente', 'activa', 'activo'].includes(String(m.estado || '').toLowerCase())) ||
    membList[0] ||
    null;

  const idMembresiaSocio = membActiva?.id_membresia_socio || '';
  const idPlan =
    membActiva?.id_membresia_gimnasio ||
    membActiva?.membresia_gimnasio?.id_membresia_gimnasio ||
    '';

  const planObjPorId = idPlan
    ? planesDisponibles.find((p) => String(p.id_membresia_gimnasio) === String(idPlan))
    : null;

  const planObj =
    membActiva?.membresia_gimnasio ||
    planObjPorId ||
    null;

  const planNombre = planObj?.nombre || null;
  const precio = membActiva?.precio ?? planObj?.precio ?? null;

  return {
    id_socio: socioObj.id_socio || s.id_socio,
    nombreCompleto,
    dni,
    id_membresia_socio: idMembresiaSocio,
    id_membresia_gimnasio: idPlan,
    planNombre,
    precio
  };
}

function PagosModal({ abierto, onCerrar, onGuardarPago, gymId }) {
  const [sociosDisponibles, setSociosDisponibles] = useState([]);
  const [planesDisponibles, setPlanesDisponibles] = useState([]);
  const [modoSeleccion, setModoSeleccion] = useState("existente"); // 'existente' o 'nuevo'

  const [formulario, setFormulario] = useState({
    id_socio: "",
    id_membresia_socio: "",
    id_membresia_gimnasio: "",
    nombreSocio: "",
    dniSocio: "",
    plan: "Plan Premium",
    monto: "0",
    metodo_pago: "efectivo",
    estado: "aprobado",
    fecha_pago: getFechaArgentinaISO()
  });

  const [mensajeExito, setMensajeExito] = useState("");
  const [mensajeError, setMensajeError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Cargar lista de socios existentes del gimnasio y planes disponibles
  useEffect(() => {
    if (!abierto) return;

    let cancelado = false;

    const cargarDatos = async () => {
      try {
        const [planes, socios] = await Promise.all([
          getPlanes({ id_gimnasio: gymId || null }).catch(() => []),
          getMembresias({ id_gimnasio: gymId || null }).catch(() => [])
        ]);

        if (cancelado) return;

        const planesValidos = Array.isArray(planes) ? planes : [];
        setPlanesDisponibles(planesValidos);

        const sociosValidos = Array.isArray(socios) ? socios : [];
        setSociosDisponibles(sociosValidos);

        const aplicarSocioEnFormulario = (socioRaw, planesList, fechaOverride) => {
          const info = extraerDatosSocio(socioRaw, planesList);
          const planMatch =
            (info.id_membresia_gimnasio &&
              planesList.find((p) => String(p.id_membresia_gimnasio) === String(info.id_membresia_gimnasio))) ||
            (info.planNombre && planesList.find((p) => p.nombre === info.planNombre)) ||
            planesList[0];

          const planFinal = info.planNombre || planMatch?.nombre || 'Plan';
          const precioFinal =
            info.precio != null
              ? String(info.precio)
              : (planMatch?.precio != null ? String(planMatch.precio) : '0');

          setFormulario((prev) => ({
            ...prev,
            id_socio: info.id_socio || "",
            id_membresia_socio: info.id_membresia_socio || "",
            id_membresia_gimnasio: info.id_membresia_gimnasio || planMatch?.id_membresia_gimnasio || "",
            nombreSocio: info.nombreCompleto,
            dniSocio: info.dni,
            plan: planFinal,
            monto: precioFinal,
            ...(fechaOverride ? { fecha_pago: fechaOverride } : {})
          }));
        };

        if (sociosValidos.length > 0) {
          aplicarSocioEnFormulario(sociosValidos[0], planesValidos, getFechaArgentinaISO());
          setModoSeleccion("existente");
        } else {
          setModoSeleccion("nuevo");
          const defaultPlan = planesValidos[0];
          setFormulario((prev) => ({
            ...prev,
            id_socio: "",
            id_membresia_socio: "",
            id_membresia_gimnasio: defaultPlan?.id_membresia_gimnasio || "",
            nombreSocio: "",
            dniSocio: "",
            plan: defaultPlan?.nombre || "Plan",
            monto: defaultPlan?.precio != null ? String(defaultPlan.precio) : "0",
            fecha_pago: getFechaArgentinaISO()
          }));
        }
      } catch (err) {
        console.warn("Error cargando socios/planes:", err);
      }
    };

    cargarDatos();

    return () => {
      cancelado = true;
    };
  }, [abierto, gymId]);

  if (!abierto) return null;

  const seleccionarSocio = (socio) => {
    const info = extraerDatosSocio(socio, planesDisponibles);
    if (!info) return;

    const planObj =
      (info.id_membresia_gimnasio &&
        planesDisponibles.find((p) => String(p.id_membresia_gimnasio) === String(info.id_membresia_gimnasio))) ||
      (info.planNombre && planesDisponibles.find((p) => p.nombre === info.planNombre)) ||
      planesDisponibles[0];

    const planFinal = info.planNombre || planObj?.nombre || formulario.plan;
    const precioMonto =
      info.precio != null
        ? String(info.precio)
        : (planObj?.precio != null ? String(planObj.precio) : formulario.monto);

    setModoSeleccion("existente");
    setFormulario((prev) => ({
      ...prev,
      id_socio: info.id_socio || "",
      id_membresia_socio: info.id_membresia_socio || "",
      id_membresia_gimnasio: info.id_membresia_gimnasio || planObj?.id_membresia_gimnasio || "",
      nombreSocio: info.nombreCompleto,
      dniSocio: info.dni,
      plan: planFinal,
      monto: precioMonto
    }));
  };

  const handleSeleccionarSocioExistente = (e) => {
    const socioId = e.target.value;
    const socio = sociosDisponibles.find(
      (s) => String(s.socio?.id_socio || s.id_socio) === String(socioId)
    );
    if (socio) seleccionarSocio(socio);
  };

  const handleCambiarAModoNuevo = () => {
    setModoSeleccion("nuevo");
    const defaultPlan = planesDisponibles[0];
    setFormulario((prev) => ({
      ...prev,
      id_socio: "",
      id_membresia_socio: "",
      id_membresia_gimnasio: defaultPlan?.id_membresia_gimnasio || prev.id_membresia_gimnasio,
      nombreSocio: "",
      dniSocio: "",
      plan: defaultPlan?.nombre || prev.plan,
      monto: defaultPlan?.precio != null ? String(defaultPlan.precio) : prev.monto
    }));
  };

  const handleCambiarAModoExistente = () => {
    if (sociosDisponibles.length === 0) return;
    seleccionarSocio(sociosDisponibles[0]);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormulario((prev) => {
      const nuevo = { ...prev, [name]: value };

      if (name === "plan") {
        const planObj = planesDisponibles.find((p) => p.nombre === value);
        if (planObj) {
          nuevo.id_membresia_gimnasio = planObj.id_membresia_gimnasio;
          if (planObj.precio != null) {
            nuevo.monto = String(planObj.precio);
          }
        }
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
        id_socio: modoSeleccion === "nuevo" ? undefined : (formulario.id_socio || undefined),
        id_membresia_socio: modoSeleccion === "nuevo" ? undefined : (formulario.id_membresia_socio || undefined),
        id_membresia_gimnasio: formulario.id_membresia_gimnasio || undefined
      };
      await onGuardarPago(payload);
      setMensajeExito("¡Pago registrado correctamente en la base de datos!");
      setTimeout(() => {
        setMensajeExito("");
        onCerrar();
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
              <p>Selecciona un socio registrado o crea uno nuevo con su pago</p>
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

          {/* Selector de modo: Socio Existente vs Nuevo Socio */}
          <div className="Caja-pagos-modo-selector">
            <button
              type="button"
              className={`Caja-pagos-modo-btn ${modoSeleccion === 'existente' ? 'activo' : ''}`}
              onClick={handleCambiarAModoExistente}
              disabled={sociosDisponibles.length === 0}
            >
              <FaUserCheck /> Socio Existente {sociosDisponibles.length > 0 ? `(${sociosDisponibles.length})` : ''}
            </button>
            <button
              type="button"
              className={`Caja-pagos-modo-btn ${modoSeleccion === 'nuevo' ? 'activo' : ''}`}
              onClick={handleCambiarAModoNuevo}
            >
              <FaUserPlus /> Nuevo Socio
            </button>
          </div>

          {/* Si está en modo existente, dropdown de socios registrados */}
          {modoSeleccion === "existente" && sociosDisponibles.length > 0 && (
            <div className="Caja-pagos-form-grupo">
              <label>Seleccionar Socio Registrado</label>
              <select
                value={formulario.id_socio || ""}
                onChange={handleSeleccionarSocioExistente}
              >
                {sociosDisponibles.map((s) => {
                  const info = extraerDatosSocio(s, planesDisponibles);
                  const socioId = s.socio?.id_socio ?? s.id_socio;
                  const planDesc = info?.planNombre || (info?.id_membresia ? 'Membresía activa' : 'Sin membresía previa');
                  return (
                    <option key={socioId} value={socioId}>
                      {info?.nombreCompleto || 'Socio'} (DNI: {info?.dni || 'S/D'}) — {planDesc}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {modoSeleccion === "nuevo" && (
            <div className="Caja-pagos-aviso-nuevo">
              ✓ El socio se registrará automáticamente en tu base de datos junto con su plan y pago.
            </div>
          )}

          {/* Campos de Nombre y DNI */}
          <div className="Caja-pagos-form-fila">
            <div className="Caja-pagos-form-grupo">
              <label>
                Nombre y Apellido {modoSeleccion === "existente" && <span style={{ fontSize: '11px', color: '#8c93a0', fontWeight: 'normal' }}>(Registrado)</span>}
              </label>
              <input
                type="text"
                name="nombreSocio"
                placeholder="Ej: Juan Pérez"
                value={formulario.nombreSocio}
                onChange={handleInputChange}
                readOnly={modoSeleccion === "existente"}
                required
              />
            </div>

            <div className="Caja-pagos-form-grupo">
              <label>
                DNI del Socio {modoSeleccion === "existente" && <span style={{ fontSize: '11px', color: '#8c93a0', fontWeight: 'normal' }}>(Registrado)</span>}
              </label>
              <input
                type="text"
                name="dniSocio"
                placeholder="Ej: 39123456"
                value={formulario.dniSocio}
                onChange={handleInputChange}
                readOnly={modoSeleccion === "existente"}
                required
              />
            </div>
          </div>

          {/* Plan y Monto */}
          <div className="Caja-pagos-form-fila">
            <div className="Caja-pagos-form-grupo">
              <label>Plan</label>
              <select
                name="plan"
                value={formulario.plan}
                onChange={handleInputChange}
              >
                {planesDisponibles.length > 0 ? (
                  <>
                    {formulario.plan && !planesDisponibles.some((p) => p.nombre === formulario.plan) && (
                      <option value={formulario.plan}>{formulario.plan}</option>
                    )}
                    {planesDisponibles.map((p) => (
                      <option key={p.id_membresia_gimnasio} value={p.nombre}>
                        {p.nombre} {p.precio ? `($${p.precio})` : ''}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="Plan Premium">Plan Premium</option>
                    <option value="Plan Básico">Plan Básico</option>
                    <option value="Pase Libre">Pase Libre</option>
                  </>
                )}
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
                <option value="aprobado">Aprobado</option>
                <option value="pendiente">Pendiente</option>
                <option value="rechazado">Rechazado</option>
                <option value="anulado">Anulado</option>
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
