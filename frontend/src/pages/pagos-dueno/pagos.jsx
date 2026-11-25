/**
 * =========================================================================================
 * ARCHIVO: pagos.jsx
 * RUTA: frontend/src/pages/pagos-dueno/pagos.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Módulo de Caja, Facturación e Historial de Cobros del Dueño / Administrador.
 * =========================================================================================
 * 
 * GUÍA DE ARQUITECTURA FINANCIERA PARA EL DESARROLLADOR:
 * 1. MÉTRICAS DE CAJA Y FACTURACIÓN:
 *    - `resumen`: Tarjetas consolidadas de KPI que calculan en tiempo real:
 *      * Total Recaudado (en pesos argentinos ARS).
 *      * Cobros Realizados / Pagados exitosamente.
 *      * Cobros Pendientes (en proceso de acreditación o esperando transferencia).
 *      * Cobros Vencidos (cuotas impagas que requieren reclamo o suspensión preventiva).
 * 2. FLUJOS MODULARES Y MODALES:
 *    - `<PagosModal />`: Modal de cobro en mostrador / recepción. Permite seleccionar un socio,
 *      asignarle un plan de membresía, definir el medio de pago (efectivo, transferencia, débito)
 *      y registrar el pago instantáneamente actualizando la caja del gimnasio.
 *    - `<PagosDetalleModal />`: Inspección exhaustiva de cada transacción, visor de comprobante,
 *      cambio ágil de estado (`pagado` <-> `pendiente` <-> `vencido`) y anulación/baja del registro.
 * 3. NORMALIZACIÓN Y FILTROS:
 *    - Transforma las relaciones de base de datos (`pago -> membresia -> socio`) en objetos planos
 *      para alimentar la grilla paginada `<PagosTabla />`.
 *    - Soporta búsqueda reactiva por nombre/DNI y filtros combinados por rango de fechas y estado.
 */

import { useState, useEffect, useCallback } from "react";
import NavGlobal from "../../components/nav-global/nav-global";
import Sidebar from "../../components/sidebar-dueno/sidebar";
import { useGymContext } from "../../context/GymContext";
import PagosAcciones from "../../components/pagos-dueno/acciones/acciones";
import PagosFiltros from "../../components/pagos-dueno/filtros/filtros";
import PagosTabla from "../../components/pagos-dueno/tabla/tabla";
import PagosResumen from "../../components/pagos-dueno/resumen/resumen";
import PagosModal from "../../components/pagos-dueno/modal/modal";
import PagosDetalleModal from "../../components/pagos-dueno/detalle-modal/detalle-modal";
import { getPagos, getResumenPagos, registrarPago, actualizarEstadoPago, eliminarPago } from "../../services/pagoService";
import { createSocio } from "../../services/socioService";
import { createMembresiaSocio, deleteMembresiaSocio } from "../../services/membresiaAdminService";
import "./pagos.css";

function Pagos() {
  const { gimnasioActivo, gimnasioActivoId, contextVersion } = useGymContext();
  const [pagos, setPagos] = useState([]);
  const [resumen, setResumen] = useState({
    total_recaudado: 0,
    pagos_realizados: 0,
    pagos_pendientes: 0,
    pagos_vencidos: 0
  });

  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 8;

  const [modalAbierto, setModalAbierto] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "";
    const partes = fechaStr.split("T")[0].split("-");
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
  };

  const cargarDatos = useCallback(async () => {
    if (!gimnasioActivoId) {
      setPagos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const [resPagos, resResumen] = await Promise.all([
        getPagos({ limit: 100, id_gimnasio: gimnasioActivoId }),
        getResumenPagos({ id_gimnasio: gimnasioActivoId }).catch(() => null)
      ]);

      let pagosFormateados = [];
      if (resPagos && Array.isArray(resPagos.datos)) {
        pagosFormateados = resPagos.datos.map((item) => {
          const memb = item.membresia_socio || item.membresia || {};
          const socio = memb.socio_gimnasio?.socio || memb.socio || {};
          const nombreCompleto = socio.nombre
            ? `${socio.nombre} ${socio.apellido || ""}`.trim()
            : (socio.dni ? `Socio DNI ${socio.dni}` : "Socio");
          const dni = socio.dni || "S/D";
          const planNombre = memb.membresia_gimnasio?.nombre || "Plan";

          const estadoPagoNorm = (item.estado || "aprobado").toLowerCase();
          const estadoMembNorm = String(memb.estado || "").toLowerCase();
          const fechaVenc = memb.fecha_vencimiento || "";
          const hoyIso = new Date().toISOString().split("T")[0];
          let estadoCuota = estadoMembNorm || (estadoPagoNorm === "aprobado" ? "activa" : "pendiente");
          if (estadoCuota === "activa" && fechaVenc && fechaVenc.split("T")[0] < hoyIso) {
            estadoCuota = "vencida";
          }

          return {
            id: item.id_pago,
            socio: { nombre: nombreCompleto, dni },
            plan: planNombre,
            fecha: formatearFecha(item.fecha_pago),
            fechaOriginal: item.fecha_pago,
            fechaVencimiento: fechaVenc ? formatearFecha(fechaVenc) : "",
            estadoCuota,
            monto: Number(item.monto) || 0,
            metodo_pago: item.metodo_pago || "efectivo",
            estado: estadoPagoNorm
          };
        });
      }
      setPagos(pagosFormateados);

      if (resResumen) {
        setResumen({
          total_recaudado: resResumen.total_recaudado || 0,
          pagos_realizados: resResumen.pagos_aprobados ?? resResumen.pagos_realizados ?? 0,
          pagos_pendientes: resResumen.pagos_pendientes || 0,
          pagos_vencidos: (resResumen.pagos_rechazados || 0) + (resResumen.pagos_anulados || 0)
        });
      } else {
        const rec = pagosFormateados.reduce(
          (acc, p) => {
            if (p.estado === "aprobado" || p.estado === "pagado") {
              acc.total_recaudado += p.monto;
              acc.pagos_realizados += 1;
            } else if (p.estado === "pendiente") {
              acc.pagos_pendientes += 1;
            } else if (p.estado === "rechazado" || p.estado === "anulado") {
              acc.pagos_vencidos += 1;
            }
            return acc;
          },
          { total_recaudado: 0, pagos_realizados: 0, pagos_pendientes: 0, pagos_vencidos: 0 }
        );
        setResumen(rec);
      }
    } catch (err) {
      console.error("Error al cargar pagos desde backend:", err);
      setPagos([]);
    } finally {
      setCargando(false);
    }
  }, [gimnasioActivoId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, contextVersion]);

  const handleGuardarPago = async (formulario) => {
    let idMembresiaSocio =
      !formulario.cambioPlan && formulario.id_membresia_socio
        ? Number(formulario.id_membresia_socio)
        : null;
    let idSocio = formulario.id_socio ? Number(formulario.id_socio) : null;

    // Si es un socio nuevo desde caja, crear/asociar identidad primero en POST /api/socios
    if (!idSocio && (formulario.dniSocio || formulario.nombreSocio)) {
      const partes = String(formulario.nombreSocio || "").trim().split(/\s+/);
      const resSocio = await createSocio({
        id_gimnasio: gimnasioActivoId,
        nombre: partes[0] || "Socio",
        apellido: partes.slice(1).join(" ") || "-",
        dni: formulario.dniSocio || undefined
      });
      idSocio = resSocio?.socio?.id_socio || null;
    }

    // Si aún no tiene contratación activa/pendiente (o solicitó cambio de plan), crearla mediante POST /api/membresias
    if (!idMembresiaSocio) {
      if (!idSocio || !formulario.id_membresia_gimnasio) {
        throw new Error("Debés seleccionar un socio y un plan de membresía para registrar el pago.");
      }
      if (
        formulario.cambioPlan &&
        formulario.id_membresia_socio_anterior &&
        ["pendiente", "activa"].includes(String(formulario.estado_membresia_anterior || "").toLowerCase())
      ) {
        await deleteMembresiaSocio(Number(formulario.id_membresia_socio_anterior));
      }
      const resMemb = await createMembresiaSocio({
        id_socio: idSocio,
        id_membresia_gimnasio: Number(formulario.id_membresia_gimnasio),
        id_gimnasio: gimnasioActivoId,
        estado: "pendiente",
        registrar_pago: false
      });
      idMembresiaSocio =
        resMemb?.membresia_socio?.id_membresia_socio ||
        resMemb?.membresia?.id_membresia_socio ||
        null;
    }

    if (!idMembresiaSocio) {
      throw new Error("No se pudo resolver la contratación de membresía para asociar el pago.");
    }

    await registrarPago({
      id_membresia_socio: idMembresiaSocio,
      monto: formulario.monto !== "" && formulario.monto != null ? Number(formulario.monto) : undefined,
      fecha_pago: formulario.fecha_pago || undefined,
      metodo_pago: formulario.metodo_pago,
      estado: String(formulario.estado || "aprobado").toLowerCase(),
      comprobante: formulario.comprobante || undefined,
      id_gimnasio: gimnasioActivoId
    });

    await cargarDatos();
  };

  const handleCambiarEstado = async (idPago, nuevoEstado) => {
    setPagos((prevPagos) =>
      prevPagos.map((p) => (p.id === idPago ? { ...p, estado: nuevoEstado } : p))
    );

    try {
      await actualizarEstadoPago(idPago, nuevoEstado);
      await cargarDatos();
    } catch (error) {
      console.error("Error al actualizar estado del pago:", error);
      await cargarDatos();
    }
  };

  const handleVerDetalle = (pago) => {
    setPagoSeleccionado(pago);
    setModalDetalleAbierto(true);
  };

  // Anular pago (baja lógica a 'anulado' para preservar historial contable)
  const handleEliminarPago = async (idPago) => {
    await eliminarPago(idPago);
    await cargarDatos();
  };

  // Restablecer todos los filtros aplicados
  const handleLimpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("todos");
    setFechaDesde("");
    setFechaHasta("");
    setPaginaActual(1);
  };

  // Filtrado reactivo por texto (nombre/dni), estado y rango de fechas
  const pagosFiltrados = pagos.filter((item) => {
    // 1. Filtro por Estado
    const estadoItem = String(item.estado || "").toLowerCase();
    const coincideEstado =
      filtroEstado === "todos" || estadoItem === filtroEstado.toLowerCase();

    // 2. Filtro por Buscador (Nombre y DNI)
    const termino = busqueda.toLowerCase().trim();
    const terminoNumerico = termino.replace(/\D/g, "");
    const nombre = String(item.socio?.nombre || "").toLowerCase();
    const dni = String(item.socio?.dni || "").toLowerCase();
    const dniNumerico = dni.replace(/\D/g, "");
    const plan = String(item.plan || "").toLowerCase();

    const coincideTexto =
      !termino ||
      nombre.includes(termino) ||
      dni.includes(termino) ||
      (terminoNumerico.length > 0 && dniNumerico.includes(terminoNumerico)) ||
      plan.includes(termino);

    // 3. Filtro por Rango de Fechas (fecha_pago YYYY-MM-DD)
    const fechaPago = item.fechaOriginal || "";
    const coincideDesde = !fechaDesde || (fechaPago >= fechaDesde);
    const coincideHasta = !fechaHasta || (fechaPago <= fechaHasta);

    return coincideEstado && coincideTexto && coincideDesde && coincideHasta;
  });

  const totalPagos = pagosFiltrados.length;
  const indiceInicio = (paginaActual - 1) * elementosPorPagina;
  const pagosPaginados = pagosFiltrados.slice(indiceInicio, indiceInicio + elementosPorPagina);

  return (
    <div className="Caja-pagos">
      <NavGlobal />

      <div className="Caja-pagos-cuerpo">
        <Sidebar />

        <main className="Caja-pagos-contenido">
          {/* Encabezado */}
          <div className="Caja-pagos-header">
            <h1 className="Caja-pagos-header-titulo">Pagos</h1>
            <p className="Caja-pagos-header-subtitulo">
              {gimnasioActivo?.nombre
                ? `Gestiona los pagos de ${gimnasioActivo.nombre} y el estado de sus cuotas.`
                : "Gestiona los pagos de tus socios y el estado de sus cuotas."}
            </p>
          </div>

          {/* Componente Modular: Acciones superiores (solo Registrar pago) */}
          <PagosAcciones
            onAbrirModal={() => setModalAbierto(true)}
          />

          {/* Componente Modular: Filtros por fecha, estado y buscador */}
          <PagosFiltros
            busqueda={busqueda}
            setBusqueda={(val) => {
              setBusqueda(val);
              setPaginaActual(1);
            }}
            filtroEstado={filtroEstado}
            setFiltroEstado={(val) => {
              setFiltroEstado(val);
              setPaginaActual(1);
            }}
            fechaDesde={fechaDesde}
            setFechaDesde={(val) => {
              setFechaDesde(val);
              setPaginaActual(1);
            }}
            fechaHasta={fechaHasta}
            setFechaHasta={(val) => {
              setFechaHasta(val);
              setPaginaActual(1);
            }}
            onLimpiarFiltros={handleLimpiarFiltros}
          />

          {/* Cuadrícula Principal: Tabla y Resumen de Métricas */}
          <div className="Caja-pagos-grid">
            {/* Componente Modular: Tabla de Pagos Recientes con Estado Editable */}
            <PagosTabla
              pagos={pagosPaginados}
              totalPagos={totalPagos}
              paginaActual={paginaActual}
              setPaginaActual={setPaginaActual}
              elementosPorPagina={elementosPorPagina}
              onVerTodos={handleLimpiarFiltros}
              onCambiarEstado={handleCambiarEstado}
              onVerDetalle={handleVerDetalle}
              cargando={cargando}
            />

            {/* Componente Modular: Resumen de Pagos */}
            <PagosResumen resumen={resumen} />
          </div>

          {/* Componente Modular: Modal Registrar Pago */}
          <PagosModal
            abierto={modalAbierto}
            onCerrar={() => setModalAbierto(false)}
            onGuardarPago={handleGuardarPago}
            gymId={gimnasioActivoId}
          />

          {/* Componente Modular: Modal de Detalle Completo y Eliminación */}
          <PagosDetalleModal
            abierto={modalDetalleAbierto}
            pago={pagoSeleccionado}
            onCerrar={() => {
              setModalDetalleAbierto(false);
              setPagoSeleccionado(null);
            }}
            onEliminarPago={handleEliminarPago}
            onCambiarEstado={async (idPago, nuevoEstado) => {
              await handleCambiarEstado(idPago, nuevoEstado);
              if (pagoSeleccionado && pagoSeleccionado.id === idPago) {
                setPagoSeleccionado((prev) => ({ ...prev, estado: nuevoEstado }));
              }
            }}
          />
        </main>
      </div>
    </div>
  );
}

export default Pagos;