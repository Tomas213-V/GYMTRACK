import { useState, useEffect } from "react";
import {
  FaTimes,
  FaTrash,
  FaEdit,
  FaUser,
  FaIdCard,
  FaPhone,
  FaDumbbell,
  FaExclamationTriangle,
  FaSave,
  FaCheckCircle
} from "react-icons/fa";
import { getSocioById, updateSocio, deleteSocio, changeEstadoSocio } from "../../../services/socioService";
import { getPlanes } from "../../../services/pagoService";
import "./detalle-modal.css";

function SocioDetalleModal({
  abierto,
  socio,
  onCerrar,
  onEliminarSocio,
  onActualizarSocio,
  gymId
}) {
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [exitoMsg, setExitoMsg] = useState("");
  const [planesDisponibles, setPlanesDisponibles] = useState([]);

  // Estado del formulario de edición
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    estado: "activo",
    id_plan_membresia: "",
    plan: ""
  });

  // Cargar información extendida del socio y planes del gimnasio
  useEffect(() => {
    let montado = true;
    if (abierto && socio?.id_socio) {
      setCargandoDetalle(true);

      const idGym = gymId || (() => {
        try {
          const u = JSON.parse(localStorage.getItem("usuario") || "{}");
          const user = Array.isArray(u) ? u[0] : u;
          return user?.id_gimnasio || user?.gimnasio_id || null;
        } catch {
          return null;
        }
      })();

      Promise.all([
        getSocioById(socio.id_socio).catch(() => null),
        getPlanes({ id_gimnasio: idGym }).catch(() => [])
      ])
        .then(([socioData, planes]) => {
          if (!montado) return;
          const s = socioData || socio;
          setDetalle(s);

          if (Array.isArray(planes)) {
            setPlanesDisponibles(planes);
          }

          const u = s.usuario || {};
          const membActiva = Array.isArray(s.membresia) && s.membresia.length > 0
            ? (s.membresia.find(m => m.estado === 'activo') || s.membresia[0])
            : (s.membresia && !Array.isArray(s.membresia) ? s.membresia : null);

          setFormData({
            nombre: s.nombre || u.nombre || "",
            apellido: s.apellido || u.apellido || "",
            dni: s.dni || "",
            telefono: s.telefono || "",
            email: s.email || u.email || "",
            contrasena: "",
            estado: (s.estado || "activo").toLowerCase(),
            id_plan_membresia: membActiva?.id_plan_membresia || membActiva?.plan_membresia?.id_plan_membresia || "",
            plan: membActiva?.plan_membresia?.nombre || membActiva?.tipo || "Plan Premium"
          });
        })
        .finally(() => {
          if (montado) setCargandoDetalle(false);
        });
    } else {
      setDetalle(null);
    }
    return () => {
      montado = false;
    };
  }, [abierto, socio, gymId]);

  if (!abierto || !socio) return null;

  // Extraer datos calculados
  const s = detalle || socio;
  const usuarioData = s.usuario || {};
  const nombreCompleto = s.nombre
    ? `${s.nombre} ${s.apellido || ""}`.trim()
    : (usuarioData.nombre
        ? `${usuarioData.nombre} ${usuarioData.apellido || ""}`.trim()
        : "Socio");

  const membActiva = Array.isArray(s.membresia) && s.membresia.length > 0
    ? (s.membresia.find(m => m.estado === 'activo') || s.membresia[0])
    : (s.membresia && !Array.isArray(s.membresia) ? s.membresia : null);

  const planNombre = membActiva?.plan_membresia?.nombre || membActiva?.tipo || "Sin Plan";
  const planPrecio = membActiva?.precio != null 
    ? `$${Number(membActiva.precio).toLocaleString("es-AR")}` 
    : (membActiva?.plan_membresia?.precio != null ? `$${Number(membActiva.plan_membresia.precio).toLocaleString("es-AR")}` : "No definido");

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "Sin fecha";
    const partes = fechaStr.split("T")[0].split("-");
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return fechaStr;
  };

  const vencimiento = membActiva?.fecha_vencimiento
    ? formatearFecha(membActiva.fecha_vencimiento)
    : "Sin vencimiento fijo";

  const fechaAlta = s.fecha_alta ? formatearFecha(s.fecha_alta) : "No registrada";
  const estadoActual = (s.estado || "activo").toLowerCase();

  // Cambiar estado rápido desde el selector
  const handleCambiarEstadoRapido = async (nuevoEstado) => {
    setErrorMsg("");
    try {
      await changeEstadoSocio(s.id_socio, nuevoEstado);
      setDetalle((prev) => ({ ...prev, estado: nuevoEstado }));
      setFormData((prev) => ({ ...prev, estado: nuevoEstado }));
      if (onActualizarSocio) onActualizarSocio();
    } catch (err) {
      setErrorMsg(err.message || "Error al cambiar estado.");
    }
  };

  // Guardar formulario de edición
  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setExitoMsg("");
    setGuardando(true);

    try {
      const payload = {
        nombre: formData.nombre,
        apellido: formData.apellido,
        dni: formData.dni,
        telefono: formData.telefono,
        email: formData.email,
        estado: formData.estado,
        id_plan_membresia: formData.id_plan_membresia || undefined,
        plan: formData.plan || undefined
      };

      if (formData.contrasena && formData.contrasena.trim()) {
        payload.contrasena = formData.contrasena.trim();
      }

      await updateSocio(s.id_socio, payload);

      setExitoMsg("¡Datos del socio actualizados exitosamente!");
      setTimeout(() => {
        setExitoMsg("");
        setModoEdicion(false);
        if (onActualizarSocio) onActualizarSocio();
      }, 700);
    } catch (err) {
      setErrorMsg(err.message || "Error al actualizar datos del socio.");
    } finally {
      setGuardando(false);
    }
  };

  // Confirmar y ejecutar eliminación
  const handleConfirmarEliminar = async () => {
    setEliminando(true);
    setErrorMsg("");
    try {
      await deleteSocio(s.id_socio);
      if (onEliminarSocio) onEliminarSocio(s.id_socio);
      onCerrar();
    } catch (err) {
      setErrorMsg(err.message || "Error al eliminar socio.");
      setEliminando(false);
    }
  };

  return (
    <div className="socio-detalle-overlay" onClick={onCerrar}>
      <div
        className="socio-detalle-contenedor"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="socio-detalle-header">
          <div className="socio-detalle-titulo-grupo">
            <div className="socio-detalle-icono-verde">
              <FaUser />
            </div>
            <div>
              <h2>{modoEdicion ? "Editar Socio" : `Detalle del Socio #${s.id_socio}`}</h2>
              <p>{modoEdicion ? "Modifica los datos del socio y su membresía" : "Información completa y estado de membresía"}</p>
            </div>
          </div>
          <button className="socio-detalle-btn-cerrar" onClick={onCerrar} title="Cerrar ventana">
            <FaTimes />
          </button>
        </div>

        {/* Alertas */}
        {exitoMsg && (
          <div className="socio-detalle-alerta socio-detalle-alerta-exito">
            <FaCheckCircle />
            <span>{exitoMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="socio-detalle-alerta socio-detalle-alerta-error">
            <FaExclamationTriangle />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Indicador de sincronización de datos extendidos */}
        {cargandoDetalle && (
          <div style={{ padding: '6px 20px', fontSize: '13px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <span>Sincronizando información detallada del socio...</span>
          </div>
        )}

        {/* Cuerpo del Modal */}
        <div className="socio-detalle-cuerpo">
          {!modoEdicion ? (
            /* ================= MODO LECTURA / DETALLE ================= */
            <>
              {/* Banner Destacado con Estado y Membresía */}
              <div className="socio-detalle-banner">
                <div className="socio-detalle-socio-resumen">
                  <div className="socio-detalle-avatar">
                    <FaUser />
                  </div>
                  <div>
                    <h3 className="socio-detalle-nombre">{nombreCompleto}</h3>
                    <div className="socio-detalle-chips">
                      <span className="socio-detalle-chip">
                        <FaIdCard /> DNI: {s.dni || "S/D"}
                      </span>
                      <span className="socio-detalle-chip">
                        <FaPhone /> {s.telefono || "Sin teléfono"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="socio-detalle-estado-grupo">
                  <label>Estado del Socio:</label>
                  <select
                    className={`socio-badge socio-badge-select socio-badge-${estadoActual}`}
                    value={estadoActual}
                    onChange={(e) => handleCambiarEstadoRapido(e.target.value)}
                  >
                    <option value="activo">Activo</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* Secciones de Información */}
              <div className="socio-detalle-seccion">
                <h4 className="socio-detalle-seccion-titulo">Plan y Membresía Actual</h4>
                <div className="socio-detalle-grid">
                  <div className="socio-detalle-item">
                    <span className="socio-detalle-item-label">Plan Activo</span>
                    <span className="socio-detalle-item-valor socio-plan-nombre">
                      <FaDumbbell className="socio-item-icono" />
                      {planNombre}
                    </span>
                  </div>

                  <div className="socio-detalle-item">
                    <span className="socio-detalle-item-label">Precio / Cuota</span>
                    <span className="socio-detalle-item-valor socio-precio-valor">
                      {planPrecio}
                    </span>
                  </div>

                  <div className="socio-detalle-item">
                    <span className="socio-detalle-item-label">Vencimiento de Cuota</span>
                    <span className="socio-detalle-item-valor">
                      {vencimiento}
                    </span>
                  </div>

                  <div className="socio-detalle-item">
                    <span className="socio-detalle-item-label">Fecha de Alta</span>
                    <span className="socio-detalle-item-valor">
                      {fechaAlta}
                    </span>
                  </div>
                </div>
              </div>

              <div className="socio-detalle-seccion">
                <h4 className="socio-detalle-seccion-titulo">Datos de Contacto y Acceso</h4>
                <div className="socio-detalle-grid">
                  <div className="socio-detalle-item">
                    <span className="socio-detalle-item-label">Teléfono Móvil</span>
                    <span className="socio-detalle-item-valor">
                      {s.telefono || "Sin teléfono especificado"}
                    </span>
                  </div>

                  <div className="socio-detalle-item">
                    <span className="socio-detalle-item-label">Correo Electrónico (Login)</span>
                    <span className="socio-detalle-item-valor">
                      {s.email && !s.email.includes("@gymtrack.local")
                        ? s.email
                        : (usuarioData.email && !usuarioData.email.includes("@gymtrack.local")
                            ? usuarioData.email
                            : "No especificado")}
                    </span>
                  </div>

                  <div className="socio-detalle-item">
                    <span className="socio-detalle-item-label">Contraseña de Portal</span>
                    <span className="socio-detalle-item-valor" style={{ color: s.contrasena ? '#8cff00' : '#ffa500' }}>
                      {s.contrasena ? "✓ Configurada" : "⚠ Sin contraseña asignada"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra de Acciones: Ver Perfil y Editar */}
              <div className="socio-detalle-acciones-barra" style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={`/perfil-dueño?id=${socio.id_socio}`}
                  className="socio-btn-editar"
                  style={{ textDecoration: 'none', background: '#22252b', color: '#f3f4f6', borderColor: '#363a45', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <FaUser />
                  <span>Ver Ficha / Perfil</span>
                </a>
                <button
                  type="button"
                  className="socio-btn-editar"
                  onClick={() => setModoEdicion(true)}
                >
                  <FaEdit />
                  <span>Editar Socio</span>
                </button>
              </div>

              {/* Zona de Peligro / Eliminación */}
              <div className="socio-detalle-zona-eliminar">
                {!confirmandoEliminar ? (
                  <div className="socio-detalle-eliminar-barra">
                    <p>¿Necesitas dar de baja a este socio del sistema?</p>
                    <button
                      type="button"
                      className="socio-btn-eliminar"
                      onClick={() => setConfirmandoEliminar(true)}
                    >
                      <FaTrash />
                      <span>Eliminar Socio</span>
                    </button>
                  </div>
                ) : (
                  <div className="socio-detalle-confirmar-caja">
                    <div className="socio-confirmar-texto">
                      <FaExclamationTriangle className="socio-confirmar-icono" />
                      <div>
                        <strong>¿Estás seguro de eliminar a {nombreCompleto}?</strong>
                        <p>Esta acción removerá el socio, sus membresías y pagos asociados de forma irreversible.</p>
                      </div>
                    </div>
                    <div className="socio-confirmar-botones">
                      <button
                        type="button"
                        className="socio-btn-cancelar"
                        onClick={() => setConfirmandoEliminar(false)}
                        disabled={eliminando}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="socio-btn-peligro-confirmar"
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
            </>
          ) : (
            /* ================= MODO EDICIÓN ================= */
            <form onSubmit={handleGuardarEdicion} className="socio-edicion-form">
              <div className="socio-form-fila">
                <div className="socio-form-grupo">
                  <label>Nombre</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
                <div className="socio-form-grupo">
                  <label>Apellido</label>
                  <input
                    type="text"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  />
                </div>
              </div>

              <div className="socio-form-fila">
                <div className="socio-form-grupo">
                  <label>DNI</label>
                  <input
                    type="text"
                    required
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  />
                </div>
                <div className="socio-form-grupo">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>
              </div>

              <div className="socio-form-fila">
                <div className="socio-form-grupo">
                  <label>Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="socio-form-grupo">
                  <label>Modificar Contraseña</label>
                  <input
                    type="password"
                    placeholder="Dejar en blanco para no cambiar"
                    value={formData.contrasena || ""}
                    onChange={(e) => setFormData({ ...formData, contrasena: e.target.value })}
                  />
                </div>
              </div>

              <div className="socio-form-fila">
                <div className="socio-form-grupo">
                  <label>Plan de Membresía</label>
                  <select
                    value={formData.id_plan_membresia}
                    onChange={(e) => {
                      const idSeleccionado = e.target.value;
                      const planObj = planesDisponibles.find(
                        (p) => String(p.id_plan_membresia) === String(idSeleccionado)
                      );
                      setFormData({
                        ...formData,
                        id_plan_membresia: idSeleccionado,
                        plan: planObj ? planObj.nombre : formData.plan
                      });
                    }}
                  >
                    {planesDisponibles.length > 0 ? (
                      planesDisponibles.map((p) => (
                        <option key={p.id_plan_membresia} value={p.id_plan_membresia}>
                          {p.nombre} {p.precio ? `($${p.precio})` : ""}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="">Plan Básico</option>
                        <option value="">Plan Premium</option>
                        <option value="">Pase Libre</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="socio-form-grupo">
                  <label>Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  >
                    <option value="activo">Activo</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="socio-edicion-acciones">
                <button
                  type="button"
                  className="socio-btn-cancelar"
                  onClick={() => setModoEdicion(false)}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="socio-btn-guardar"
                  disabled={guardando}
                >
                  <FaSave />
                  <span>{guardando ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!modoEdicion && (
          <div className="socio-detalle-footer">
            <button type="button" className="socio-btn-cancelar" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SocioDetalleModal;
