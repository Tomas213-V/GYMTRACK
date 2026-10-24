import { useState, useEffect } from "react";
import { FaPlus, FaTimes, FaUserCheck, FaUserPlus } from "react-icons/fa";
import { getMembresias, getPlanes } from "../../../services/pagoService";
import "./modal.css";

function PagosModal({ abierto, onCerrar, onGuardarPago, gymId }) {
  const [sociosDisponibles, setSociosDisponibles] = useState([]);
  const [planesDisponibles, setPlanesDisponibles] = useState([]);
  const [modoSeleccion, setModoSeleccion] = useState("existente"); // 'existente' o 'nuevo'

  const [formulario, setFormulario] = useState({
    id_socio: "",
    id_membresia: "",
    id_plan_membresia: "",
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

  // Cargar lista de socios existentes del gimnasio y planes disponibles
  useEffect(() => {
    if (!abierto) return;

    let cancelado = false;

    const cargarDatos = async () => {
      try {
        const idGym = gymId || (() => {
          try {
            const u = JSON.parse(localStorage.getItem("usuario") || "{}");
            const user = Array.isArray(u) ? u[0] : u;
            return user?.id_gimnasio || user?.gimnasio_id || user?.socio?.id_gimnasio || null;
          } catch {
            return null;
          }
        })();

        const [planes, socios] = await Promise.all([
          getPlanes({ id_gimnasio: idGym }).catch(() => []),
          getMembresias({ id_gimnasio: idGym }).catch(() => [])
        ]);

        if (cancelado) return;

        const planesValidos = Array.isArray(planes) ? planes : [];
        setPlanesDisponibles(planesValidos);

        const sociosValidos = Array.isArray(socios) ? socios : [];
        setSociosDisponibles(sociosValidos);

        if (sociosValidos.length > 0) {
          const primero = sociosValidos[0];
          const nombreCompleto = primero.nombre
            ? `${primero.nombre} ${primero.apellido || ''}`.trim()
            : (primero.socio?.nombre
                ? `${primero.socio.nombre} ${primero.socio.apellido || ''}`.trim()
                : (primero.socio?.usuario?.nombre
                    ? `${primero.socio.usuario.nombre} ${primero.socio.usuario.apellido || ''}`.trim()
                    : 'Socio'));
          const planNombre = primero.plan_membresia?.nombre || (planesValidos[0]?.nombre || 'Plan Premium');
          const planMatch = planesValidos.find((p) => p.nombre === planNombre) || planesValidos[0];
          const precioMonto = primero.precio != null
            ? String(primero.precio)
            : (planMatch?.precio != null ? String(planMatch.precio) : '18000');

          setFormulario((prev) => ({
            ...prev,
            id_socio: primero.id_socio,
            id_membresia: primero.id_membresia || "",
            id_plan_membresia: primero.id_plan_membresia || planMatch?.id_plan_membresia || "",
            nombreSocio: nombreCompleto,
            dniSocio: primero.socio?.dni || primero.dni || '',
            plan: planMatch?.nombre || planNombre,
            monto: precioMonto,
            fecha_pago: new Date().toISOString().split("T")[0]
          }));
          setModoSeleccion("existente");
        } else {
          setModoSeleccion("nuevo");
          const defaultPlan = planesValidos[0];
          setFormulario((prev) => ({
            ...prev,
            id_socio: "",
            id_membresia: "",
            id_plan_membresia: defaultPlan?.id_plan_membresia || "",
            nombreSocio: "",
            dniSocio: "",
            plan: defaultPlan?.nombre || "Plan Premium",
            monto: defaultPlan?.precio != null ? String(defaultPlan.precio) : "18000",
            fecha_pago: new Date().toISOString().split("T")[0]
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

  const handleSeleccionarSocioExistente = (e) => {
    const socioId = e.target.value;
    const socio = sociosDisponibles.find((s) => String(s.id_socio) === String(socioId));

    if (socio) {
      const nombreCompleto = socio.nombre
        ? `${socio.nombre} ${socio.apellido || ''}`.trim()
        : (socio.socio?.nombre
            ? `${socio.socio.nombre} ${socio.socio.apellido || ''}`.trim()
            : (socio.socio?.usuario?.nombre
                ? `${socio.socio.usuario.nombre} ${socio.socio.usuario.apellido || ''}`.trim()
                : 'Socio'));
      const planNombre = socio.plan_membresia?.nombre || formulario.plan;
      const planObj = planesDisponibles.find((p) => p.nombre === planNombre) || planesDisponibles[0];

      const precioMonto = socio.precio != null
        ? String(socio.precio)
        : (planObj?.precio != null ? String(planObj.precio) : formulario.monto);

      setModoSeleccion("existente");
      setFormulario((prev) => ({
        ...prev,
        id_socio: socio.id_socio,
        id_membresia: socio.id_membresia || "",
        id_plan_membresia: socio.id_plan_membresia || planObj?.id_plan_membresia || "",
        nombreSocio: nombreCompleto,
        dniSocio: socio.socio?.dni || socio.dni || '',
        plan: planObj?.nombre || planNombre,
        monto: precioMonto
      }));
    }
  };

  const handleCambiarAModoNuevo = () => {
    setModoSeleccion("nuevo");
    const defaultPlan = planesDisponibles[0];
    setFormulario((prev) => ({
      ...prev,
      id_socio: "",
      id_membresia: "",
      id_plan_membresia: defaultPlan?.id_plan_membresia || prev.id_plan_membresia,
      nombreSocio: "",
      dniSocio: "",
      plan: defaultPlan?.nombre || prev.plan,
      monto: defaultPlan?.precio != null ? String(defaultPlan.precio) : prev.monto
    }));
  };

  const handleCambiarAModoExistente = () => {
    if (sociosDisponibles.length === 0) return;
    const primero = sociosDisponibles[0];
    const nombreCompleto = primero.nombre
      ? `${primero.nombre} ${primero.apellido || ''}`.trim()
      : (primero.socio?.nombre
          ? `${primero.socio.nombre} ${primero.socio.apellido || ''}`.trim()
          : (primero.socio?.usuario?.nombre
              ? `${primero.socio.usuario.nombre} ${primero.socio.usuario.apellido || ''}`.trim()
              : 'Socio'));
    const planObj = planesDisponibles.find((p) => p.nombre === primero.plan_membresia?.nombre) || planesDisponibles[0];

    setModoSeleccion("existente");
    setFormulario((prev) => ({
      ...prev,
      id_socio: primero.id_socio,
      id_membresia: primero.id_membresia || "",
      id_plan_membresia: primero.id_plan_membresia || planObj?.id_plan_membresia || "",
      nombreSocio: nombreCompleto,
      dniSocio: primero.socio?.dni || primero.dni || '',
      plan: planObj?.nombre || prev.plan,
      monto: primero.precio != null ? String(primero.precio) : (planObj?.precio != null ? String(planObj.precio) : prev.monto)
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormulario((prev) => {
      const nuevo = { ...prev, [name]: value };

      // Si cambia de plan, actualizar id_plan_membresia y precio sugerido
      if (name === "plan") {
        const planObj = planesDisponibles.find((p) => p.nombre === value);
        if (planObj) {
          nuevo.id_plan_membresia = planObj.id_plan_membresia;
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
        id_membresia: modoSeleccion === "nuevo" ? undefined : (formulario.id_membresia || undefined),
        id_plan_membresia: formulario.id_plan_membresia || undefined
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
                  const nombre = s.nombre
                    ? `${s.nombre} ${s.apellido || ''}`.trim()
                    : (s.socio?.nombre
                        ? `${s.socio.nombre} ${s.socio.apellido || ''}`.trim()
                        : (s.socio?.usuario?.nombre
                            ? `${s.socio.usuario.nombre} ${s.socio.usuario.apellido || ''}`.trim()
                            : 'Socio'));
                  const planDesc = s.plan_membresia?.nombre || (s.id_membresia ? 'Membresía activa' : 'Sin membresía previa');
                  return (
                    <option key={s.id_socio} value={s.id_socio}>
                      {nombre} (DNI: {s.dni || s.socio?.dni || 'S/D'}) — {planDesc}
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
                  planesDisponibles.map((p) => (
                    <option key={p.id_plan_membresia} value={p.nombre}>
                      {p.nombre} {p.precio ? `($${p.precio})` : ''}
                    </option>
                  ))
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
