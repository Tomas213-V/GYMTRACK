import { useState, useEffect, useCallback } from "react";
import NavGlobal from "../../components/nav-global/nav-global";
import Sidebar from "../../components/sidebar/sidebar";
import PagosAcciones from "../../components/pagos/acciones/acciones";
import PagosFiltros from "../../components/pagos/filtros/filtros";
import PagosTabla from "../../components/pagos/tabla/tabla";
import PagosResumen from "../../components/pagos/resumen/resumen";
import PagosModal from "../../components/pagos/modal/modal";
import PagosDetalleModal from "../../components/pagos/detalle-modal/detalle-modal";
import { getPagos, getResumenPagos, registrarPago, actualizarEstadoPago, eliminarPago } from "../../services/pagoService";
import "./pagos.css";

function Pagos() {
  const [pagos, setPagos] = useState([]);
  const [resumen, setResumen] = useState({
    total_recaudado: 0,
    pagos_realizados: 0,
    pagos_pendientes: 0,
    pagos_vencidos: 0
  });

  const [cargando, setCargando] = useState(true);
  const [usuarioActual, setUsuarioActual] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 8;

  // Estado del modal de registro
  const [modalAbierto, setModalAbierto] = useState(false);

  // Estado del modal de detalle y eliminación
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);

  // Formatear fechas YYYY-MM-DD a DD/MM/YYYY
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "";
    const partes = fechaStr.split("T")[0].split("-");
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
  };

  // Cargar pagos y métricas desde el backend con los datos del usuario autenticado
  // Función auxiliar para obtener el ID de gimnasio del usuario logueado
  const obtenerGymId = (u) => {
    if (!u) return "";
    if (u.gimnasio && typeof u.gimnasio === 'object') {
      if (Array.isArray(u.gimnasio)) {
        return u.gimnasio[0]?.id_gimnasio || "";
      }
      return u.gimnasio.id_gimnasio || "";
    }
    return u.id_gimnasio || "";
  };

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      let gymId = "";
      const guardado = localStorage.getItem("usuario");
      if (guardado) {
        try {
          const u = JSON.parse(guardado);
          setUsuarioActual(u);
          gymId = obtenerGymId(u);
        } catch {
          // Ignorar error de parseo
        }
      }

      // 1. Obtener pagos reales de la base de datos (filtrados exclusivamente por su gimnasio)
      let resPagos = await getPagos({ limit: 100, id_gimnasio: gymId });
      let pagosFormateados = [];

      if (resPagos && Array.isArray(resPagos.datos)) {
        pagosFormateados = resPagos.datos.map((item) => {
          const socio = item.membresia?.socio || {};
          const nombreCompleto = socio.nombre
            ? `${socio.nombre} ${socio.apellido || ""}`.trim()
            : (socio.usuario?.nombre
                ? `${socio.usuario.nombre} ${socio.usuario.apellido || ""}`.trim()
                : (socio.dni ? `Socio DNI ${socio.dni}` : "Socio"));
          const dni = socio.dni || "S/D";
          const planNombre = item.membresia?.plan_membresia?.nombre || item.membresia?.tipo || "Plan Básico";

          return {
            id: item.id_pago,
            socio: { nombre: nombreCompleto, dni: dni },
            plan: planNombre,
            fecha: formatearFecha(item.fecha_pago),
            fechaOriginal: item.fecha_pago,
            monto: Number(item.monto) || 0,
            estado: (item.estado || "pagado").toLowerCase()
          };
        });
      }
      setPagos(pagosFormateados);

      // 2. Obtener resumen de métricas reales del gimnasio
      let resResumen = await getResumenPagos({ id_gimnasio: gymId });
      if (resResumen) {
        setResumen({
          total_recaudado: resResumen.total_recaudado || 0,
          pagos_realizados: resResumen.pagos_realizados || 0,
          pagos_pendientes: resResumen.pagos_pendientes || 0,
          pagos_vencidos: resResumen.pagos_vencidos || 0
        });
      } else {
        const rec = pagosFormateados.reduce((acc, p) => {
          if (p.estado === "pagado") {
            acc.total_recaudado += p.monto;
            acc.pagos_realizados += 1;
          } else if (p.estado === "pendiente") {
            acc.pagos_pendientes += 1;
          } else if (p.estado === "vencido") {
            acc.pagos_vencidos += 1;
          }
          return acc;
        }, { total_recaudado: 0, pagos_realizados: 0, pagos_pendientes: 0, pagos_vencidos: 0 });
        setResumen(rec);
      }
    } catch (err) {
      console.error("Error al cargar pagos desde backend:", err);
      setPagos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Guardar nuevo pago conectando directamente a la API
  const handleGuardarPago = async (formulario) => {
    const gymId = obtenerGymId(usuarioActual);

    await registrarPago({
      id_socio: formulario.id_socio || undefined,
      id_membresia: formulario.id_membresia || undefined,
      id_plan_membresia: formulario.id_plan_membresia || undefined,
      nombreSocio: formulario.nombreSocio,
      dniSocio: formulario.dniSocio,
      plan: formulario.plan,
      monto: Number(formulario.monto),
      fecha_pago: formulario.fecha_pago,
      metodo_pago: formulario.metodo_pago,
      estado: formulario.estado.toLowerCase(),
      id_gimnasio: gymId
    });

    // Recargar pagos de inmediato desde la base de datos
    await cargarDatos();
  };

  // Cambiar el estado del socio / pago de forma manual
  const handleCambiarEstado = async (idPago, nuevoEstado) => {
    // 1. Actualización optimista en el frontend
    setPagos((prevPagos) =>
      prevPagos.map((p) => (p.id === idPago ? { ...p, estado: nuevoEstado } : p))
    );

    try {
      await actualizarEstadoPago(idPago, nuevoEstado);
      // 2. Refrescar métricas y asegurar sincronía
      await cargarDatos();
    } catch (error) {
      console.error("Error al actualizar estado del pago:", error);
      await cargarDatos();
    }
  };

  // Abrir modal de detalle completo de un pago
  const handleVerDetalle = (pago) => {
    setPagoSeleccionado(pago);
    setModalDetalleAbierto(true);
  };

  // Eliminar un pago y recargar datos
  const handleEliminarPago = async (idPago) => {
    // 1. Remoción optimista
    setPagos((prev) => prev.filter((p) => p.id !== idPago));
    // 2. Ejecutar eliminación en base de datos
    await eliminarPago(idPago);
    // 3. Recargar datos y métricas
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
              {usuarioActual?.gimnasio?.nombre
                ? `Gestiona los pagos de ${usuarioActual.gimnasio.nombre} y el estado de sus cuotas.`
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
            />

            {/* Componente Modular: Resumen de Pagos */}
            <PagosResumen resumen={resumen} />
          </div>

          {/* Componente Modular: Modal Registrar Pago */}
          <PagosModal
            abierto={modalAbierto}
            onCerrar={() => setModalAbierto(false)}
            onGuardarPago={handleGuardarPago}
            gymId={obtenerGymId(usuarioActual)}
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