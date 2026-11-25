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
import "./detalle-modal.css";

function normalizarEstadoSocio(valor) {
  if (typeof valor === "boolean") {
    return valor ? "activo" : "inactivo";
  }
  const texto = String(valor ?? "activo").trim().toLowerCase();
  if (["true", "1", "activo", "activa"].includes(texto)) return "activo";
  if (["false", "0", "inactivo", "inactiva"].includes(texto)) return "inactivo";
  return texto || "activo";
}

function SocioDetalleModal({
  abierto,
  socio,
  gymId,
  onCerrar,
  onEliminarSocio,
  onActualizarSocio
}) {
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [exitoMsg, setExitoMsg] = useState("");

  // Estado del formulario de edición (solo campos válidos de SocioUpdate)
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    email: "",
    estado: "activo"
  });

  // Cargar información extendida del socio
  useEffect(() => {
    let montado = true;
    if (abierto && socio?.id_socio) {
      setCargandoDetalle(true);

      getSocioById(socio.id_socio, { id_gimnasio: gymId })
        .catch(() => null)
        .then((socioData) => {
          if (!montado) return;
          const s = socioData || socio;
          setDetalle(s);

          const estadoBool = typeof s.estado === 'boolean'
            ? s.estado
            : ['activo', 'activa', 'true'].includes(String(s.estado || 'activo').toLowerCase());

          setFormData({
            nombre: s.nombre || "",
            apellido: s.apellido || "",
            dni: s.dni || "",
            telefono: s.telefono || "",
            email: s.email || "",
            estado: estadoBool ? "activo" : "inactivo"
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

  const listaMembresias = Array.isArray(s.membresias)
    ? s.membresias
    : (Array.isArray(s.membresia)
      ? s.membresia
      : (s.membresia ? [s.membresia] : []));

  const membActiva =
    s.membresia_actual ||
    listaMembresias.find((m) => ['activo', 'activa'].includes(String(m?.estado ?? '').trim().toLowerCase())) ||
    listaMembresias.find((m) => String(m?.estado ?? '').trim().toLowerCase() === 'pendiente') ||
    listaMembresias.find((m) => String(m?.estado ?? '').trim().toLowerCase() !== 'cancelada') ||
    listaMembresias[0] ||
    null;

  const planNombreBase = membActiva?.membresia_gimnasio?.nombre || membActiva?.plan_membresia?.nombre || "Sin Plan";
  const estadoMembresiaStr = membActiva?.estado ? String(membActiva.estado).trim().toLowerCase() : "";
  const planNombre =
    membActiva && estadoMembresiaStr && estadoMembresiaStr !== "activa" && estadoMembresiaStr !== "activo"
      ? `${planNombreBase} (${estadoMembresiaStr.charAt(0).toUpperCase() + estadoMembresiaStr.slice(1)})`
      : planNombreBase;
  const planPrecio = membActiva?.precio != null
    ? `$${Number(membActiva.precio).toLocaleString("es-AR")}`
    : (membActiva?.membresia_gimnasio?.precio != null ? `$${Number(membActiva.membresia_gimnasio.precio).toLocaleString("es-AR")}` : "No definido");

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "Sin fecha";
    const partes = String(fechaStr).split("T")[0].split("-");
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return fechaStr;
  };

  const vencimiento = membActiva?.fecha_vencimiento
    ? formatearFecha(membActiva.fecha_vencimiento)
    : "Sin vencimiento fijo";

  const fechaAlta = (s.fecha_alta_gimnasio || s.fecha_alta) ? formatearFecha(s.fecha_alta_gimnasio || s.fecha_alta) : "No registrada";
  const estadoActual = normalizarEstadoSocio(s.estado);

  // Cambiar estado rápido desde el selector
  const handleCambiarEstadoRapido = async (nuevoEstado) => {
    setErrorMsg("");
    try {
      const estadoBool = nuevoEstado === "activo";
      await changeEstadoSocio(s.id_socio, estadoBool, gymId);
      setDetalle((prev) => ({ ...(prev || s), estado: estadoBool }));
      setFormData((prev) => ({ ...prev, estado: estadoBool ? "activo" : "inactivo" }));
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
        estado: formData.estado === "activo"
      };

      await updateSocio(s.id_socio, payload, gymId);

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

  // Confirmar y ejecutar baja del socio en el gimnasio
  const handleConfirmarEliminar = async () => {
    setEliminando(true);
    setErrorMsg("");
    try {
      await deleteSocio(s.id_socio, gymId);
      if (onEliminarSocio) onEliminarSocio(s.id_socio);
      onCerrar();
    } catch (err) {
      setErrorMsg(err.message || "Error al dar de baja al socio.");
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

              {/* Zona de Baja Lógica */}
              <div className="socio-detalle-zona-eliminar">
                {!confirmandoEliminar ? (
                  <div className="socio-detalle-eliminar-barra">
                    <p>¿Necesitas dar de baja a este socio del gimnasio?</p>
                    <button
                      type="button"
                      className="socio-btn-eliminar"
                      onClick={() => setConfirmandoEliminar(true)}
                    >
                      <FaTrash />
                      <span>Dar de Baja</span>
                    </button>
                  </div>
                ) : (
                  <div className="socio-detalle-confirmar-caja">
                    <div className="socio-confirmar-texto">
                      <FaExclamationTriangle className="socio-confirmar-icono" />
                      <div>
                        <strong>¿Estás seguro de dar de baja a {nombreCompleto}?</strong>
                        <p>Se desactivará su asociación con este gimnasio conservando su historial de pagos y asistencias.</p>
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
                        <span>{eliminando ? "Procesando..." : "Sí, dar de baja"}</span>
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
                  <label>Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  >
                    <option value="activo">Activo</option>
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
