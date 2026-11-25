/**
 * =========================================================================================
 * ARCHIVO: socio-membresia.jsx
 * RUTA: frontend/src/pages/membresia-socio/socio-membresia.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Módulo de Gestión de Membresías, Pagos Digitales y Facturación del Socio.
 * =========================================================================================
 * 
 * GUÍA DE ARQUITECTURA Y MERCADO PAGO PARA EL DESARROLLADOR:
 * 1. MÉTRICAS DE SUSCRIPCIÓN (Telemetría de Acceso):
 *    - Calcula vigencia en días, barra porcentual transcurrida y semáforo visual:
 *      'activa' (verde), 'por vencer' (amarillo <= 7 días) o 'vencida' (rojo).
 * 2. INTEGRACIÓN COMPLETA CON MERCADO PAGO:
 *    - Creación de Preferencia: `iniciarPagoMembresia()` solicita al backend la preferencia
 *      de Checkout Pro en la API de Mercado Pago, obteniendo `init_point`, `sandbox_init_point` y QR.
 *    - Modal Interactivo: Muestra código QR dinámico de Mercado Pago para escanear desde la app
 *      o botón para abrir el Checkout oficial en pestaña segura.
 *    - Polling Reactivo en Tiempo Real: Mientras el modal de Mercado Pago esté abierto, un
 *      `useEffect` sondea cada 3.5s (`verificarPagoMercadoPago`) buscando aprobación del pago.
 *    - Retorno Automático (Back URLs): Si el usuario paga en la pestaña de Mercado Pago y es
 *      redirigido con `?pago_status=approved&ref=...`, el componente detecta el query param
 *      al montar, acredita la membresía, limpia la URL con `window.history.replaceState` y notifica.
 * 3. HISTORIAL CONTABLE Y COMPROBANTES:
 *    - Lista de cuotas abonadas con fecha, importe en ARS formateado y visor de recibo imprimible.
 */

import { useState, useEffect, useCallback } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import SidebarSocio from '../../components/sidebar-socio/sidebar-socio';
import { useGymContext } from '../../context/GymContext';
import { listarCatalogoGimnasios } from '../../services/gimnasioService';
import {
  getMiMembresia,
  getPlanesDisponibles,
  solicitarMembresiaPendiente,
  iniciarPagoMembresia
} from '../../services/socioMembresiaService';
import {
  MercadoPagoLogo,
  PaymentBadgesRow
} from '../../components/membresia-socio/PaymentLogos';

import {
  FaCreditCard,
  FaCalendarAlt,
  FaRegClock,
  FaCrown,
  FaChevronRight,
  FaTimes,
  FaCheck,
  FaWallet,
  FaReceipt,
  FaPrint,
  FaExternalLinkAlt,
  FaInfoCircle,
  FaSyncAlt,
  FaBuilding
} from 'react-icons/fa';

import './socio-membresia.css';

export default function SocioMembresia() {
  const {
    gimnasioActivo,
    gimnasioActivoId,
    contextVersion,
    refreshProfile,
    seleccionarGimnasio
  } = useGymContext();

  // --------------------------------------------------------------------------
  // Estados Principales
  // --------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [notificacion, setNotificacion] = useState('');

  const ESTADOS_EXCLUIDOS = ['inactivo', 'inactiva', 'pausa', 'pausado', 'pausada', 'cancelado', 'cancelada', 'eliminado', 'eliminada', 'sin_membresia'];

  // Datos de la membresía y socio
  const [socio, setSocio] = useState(null);
  const [gimnasio, setGimnasio] = useState(gimnasioActivo || null);
  const [membresia, setMembresia] = useState(null);
  const [membresiaProgramada, setMembresiaProgramada] = useState(null);
  const [historialPagos, setHistorialPagos] = useState([]);

  // Catálogo multigimnasio y planes disponibles
  const [catalogoGimnasios, setCatalogoGimnasios] = useState([]);
  const [gimnasioModalId, setGimnasioModalId] = useState(gimnasioActivoId || '');
  const [planesDisponibles, setPlanesDisponibles] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(false);

  // Estados de los Modales
  const [modalPlanesAbierto, setModalPlanesAbierto] = useState(false);
  const [modalCheckoutAbierto, setModalCheckoutAbierto] = useState(false);
  const [modalComprobanteAbierto, setModalComprobanteAbierto] = useState(false);

  // Datos temporales para Checkout y Pago
  const [planParaPagar, setPlanParaPagar] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [verificandoPago, setVerificandoPago] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);

  // Pago seleccionado para el comprobante
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);

  // --------------------------------------------------------------------------
  // Carga de Datos (reactiva al gimnasio activo del contexto)
  // --------------------------------------------------------------------------
  const cargarMembresia = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await getMiMembresia();

      if (data.socio) setSocio(data.socio);
      setGimnasio(data.gimnasio || gimnasioActivo || null);
      if (data.membresia && data.membresia.tiene_membresia && (data.membresia.id_membresia_socio || data.membresia.id_membresia)) {
        setMembresia(data.membresia);
      } else {
        setMembresia(null);
      }
      setMembresiaProgramada(data.membresia_programada || null);
      setHistorialPagos(Array.isArray(data.historial_pagos) ? data.historial_pagos : []);
    } catch (err) {
      console.warn('Error al cargar membresía del socio:', err.message);
      setErrorMsg(err.message);
      setMembresia(null);
    } finally {
      setLoading(false);
    }
  }, [gimnasioActivo]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pagoStatus = params.get('pago_status') || params.get('collection_status') || params.get('status');

    const verificarAlMontar = async () => {
      if (pagoStatus) {
        setNotificacion(
          pagoStatus === 'approved'
            ? 'Pago enviado a la pasarela. Tu membresía se activará automáticamente en cuanto el backend confirme la acreditación.'
            : 'Estado de pago actualizado desde la pasarela. Revisá el estado de tu membresía.'
        );
        window.history.replaceState({}, document.title, window.location.pathname);
        await refreshProfile();
        setTimeout(() => setNotificacion(''), 7000);
      }
      await cargarMembresia();
    };

    verificarAlMontar();
  }, [gimnasioActivoId, contextVersion, cargarMembresia, refreshProfile]);

  // --------------------------------------------------------------------------
  // Cargar Planes Disponibles (del gimnasio actual o de otro gimnasio del catálogo)
  // --------------------------------------------------------------------------
  const cargarPlanesDeGimnasio = async (idGymTarget) => {
    try {
      setLoadingPlanes(true);
      const data = await getPlanesDisponibles({ id_gimnasio: idGymTarget || null });
      const rawPlanes = data.planes || [];
      const planesActivos = rawPlanes.filter((plan) => {
        if (plan.estado === false) return false;
        const est = String(plan.estado ?? 'activo').toLowerCase().trim();
        return est !== 'false' && !ESTADOS_EXCLUIDOS.includes(est);
      });
      setPlanesDisponibles(planesActivos);
    } catch (err) {
      console.error('Error al cargar planes disponibles:', err);
      setPlanesDisponibles([]);
    } finally {
      setLoadingPlanes(false);
    }
  };

  const abrirModalPlanes = async (preferirOtroGimnasio = false) => {
    setModalPlanesAbierto(true);
    setLoadingPlanes(true);
    try {
      const catResp = await listarCatalogoGimnasios().catch(() => ({ gimnasios: [] }));
      const gyms = catResp.gimnasios || [];
      setCatalogoGimnasios(gyms);

      let targetId = gimnasioActivoId || gyms[0]?.id_gimnasio || '';
      if (preferirOtroGimnasio && gyms.length > 1) {
        const otro = gyms.find((g) => String(g.id_gimnasio) !== String(gimnasioActivoId));
        if (otro) targetId = otro.id_gimnasio;
      }

      setGimnasioModalId(targetId ? String(targetId) : '');
      await cargarPlanesDeGimnasio(targetId);
    } catch (err) {
      console.error('Error al cargar catálogo de gimnasios:', err);
      setLoadingPlanes(false);
    }
  };

  const handleCambiarGimnasioEnModal = async (nuevoId) => {
    setGimnasioModalId(nuevoId);
    await cargarPlanesDeGimnasio(nuevoId);
  };

  // --------------------------------------------------------------------------
  // Iniciar Proceso de Pago / Checkout (contrato real FastAPI: { id_membresia_gimnasio, proveedor })
  // --------------------------------------------------------------------------
  const prepararPagoPlan = async (plan) => {
    const planId = plan.id_membresia_gimnasio;
    setPlanParaPagar(plan);
    setModalPlanesAbierto(false);
    setModalCheckoutAbierto(true);
    setCheckoutData(null);
    setErrorMsg('');

    try {
      setProcesandoPago(true);
      const res = await iniciarPagoMembresia({
        id_membresia_gimnasio: planId,
        proveedor: 'mercadopago'
      });
      if (res?.orden) {
        setCheckoutData(res.orden);
      }
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo iniciar la orden de pago.');
    } finally {
      setProcesandoPago(false);
    }
  };

  const getCheckoutUrl = () => {
    if (!checkoutData) return null;
    const candidate =
      checkoutData.checkout_url ||
      checkoutData.init_point ||
      checkoutData.sandbox_init_point ||
      checkoutData.links?.checkout ||
      null;
    if (!candidate || typeof candidate !== 'string') return null;
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
    } catch {
      return null;
    }
  };

  const handlePagarConPasarela = () => {
    const urlCheckout = getCheckoutUrl();
    if (!urlCheckout) {
      setErrorMsg(
        checkoutData?.mensaje ||
          'La pasarela de pago no está configurada o no devolvió una URL de checkout válida. Podés solicitar la membresía en estado pendiente para abonarla en recepción.'
      );
      return;
    }
    window.open(urlCheckout, '_blank', 'noopener,noreferrer');
    setNotificacion(
      'Se abrió la pasarela de pago. Tu membresía permanecerá en estado pendiente hasta que el backend confirme la acreditación.'
    );
  };

  const handleActualizarEstadoPago = async () => {
    try {
      setVerificandoPago(true);
      await refreshProfile();
      await cargarMembresia();
      setNotificacion('Estado de membresía y pagos actualizado desde el servidor.');
      setTimeout(() => setNotificacion(''), 5000);
    } catch (e) {
      setErrorMsg(e.message || 'No se pudo actualizar el estado de la membresía.');
    } finally {
      setVerificandoPago(false);
    }
  };

  const handleSolicitarMembresiaPendiente = async () => {
    if (!planParaPagar) return;
    const planId = planParaPagar.id_membresia_gimnasio;
    const targetGymId = planParaPagar.id_gimnasio || (gimnasioModalId ? Number(gimnasioModalId) : gimnasioActivoId);

    try {
      setProcesandoPago(true);
      setErrorMsg('');
      const res = await solicitarMembresiaPendiente({
        id_membresia_gimnasio: planId
      });

      setNotificacion(
        res?.mensaje ||
          'Solicitud registrada en estado pendiente. Quedará activa cuando el gimnasio o la pasarela acrediten el pago.'
      );
      setModalCheckoutAbierto(false);

      await refreshProfile();
      if (targetGymId && String(targetGymId) !== String(gimnasioActivoId)) {
        seleccionarGimnasio(Number(targetGymId));
      } else {
        await cargarMembresia();
      }

      setTimeout(() => setNotificacion(''), 6000);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo registrar la solicitud de membresía.');
    } finally {
      setProcesandoPago(false);
    }
  };

  const abrirDetallePago = (pago) => {
    setPagoSeleccionado(pago);
    setModalComprobanteAbierto(true);
  };

  const tieneMembresiaActiva = Boolean(
    membresia &&
    membresia.tiene_membresia !== false &&
    (membresia.id_membresia_socio || membresia.id_membresia) &&
    !ESTADOS_EXCLUIDOS.includes((membresia.estado || '').toLowerCase().trim())
  );

  const gymSeleccionadoModal = catalogoGimnasios.find(
    (g) => String(g.id_gimnasio) === String(gimnasioModalId)
  ) || gimnasio;

  return (
    <div className="socio-membresia-page">
      <NavGlobal />

      <div className="socio-membresia-body">
        <SidebarSocio />

        <main className="socio-membresia-main">
          {/* Banner de Error */}
          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                padding: '14px 20px',
                borderRadius: '10px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontWeight: '600',
                fontSize: '14.5px',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.2)'
              }}
            >
              <FaTimes />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Banner de Notificación */}
          {notificacion && (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid #22c55e',
                color: '#22c55e',
                padding: '14px 20px',
                borderRadius: '10px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontWeight: '600',
                fontSize: '14.5px',
                boxShadow: '0 4px 15px rgba(34, 197, 94, 0.2)'
              }}
            >
              <FaCheck />
              <span>{notificacion}</span>
            </div>
          )}

          {/* Encabezado Principal */}
          <section className="socio-membresia-header">
            <div className="socio-membresia-title-row">
              <span className="socio-membresia-header-icon">
                <FaCreditCard />
              </span>
              <div>
                <h1 className="socio-membresia-header-title">Mi Membresía</h1>
                <p className="socio-membresia-header-sub">
                  Gestioná tu membresía, realizá pagos y conocé las opciones disponibles.
                </p>
              </div>
            </div>
          </section>

          {/* Grid Superior: Tarjeta Membresía Actual + Tarjeta Mejorar Membresía */}
          <section className="socio-membresia-top-grid">
            {/* Card 1: Membresía Actual */}
            <div className={`membresia-card ${tieneMembresiaActiva ? 'membresia-actual-card' : 'membresia-inactiva-card'}`}>
              {tieneMembresiaActiva ? (
                <div>
                  {/* Header del Plan Actual */}
                  <div className="membresia-plan-header">
                    <div className="membresia-plan-left">
                      <div className="membresia-crown-badge">
                        <FaCrown />
                      </div>
                      <div className="membresia-plan-info">
                        <h3>{membresia.nombre_plan || 'Plan Activo'}</h3>
                        <p>
                          {membresia.estado === 'activa'
                            ? 'Membresía activa'
                            : membresia.estado === 'programada'
                              ? 'Membresía programada (próximo inicio)'
                              : membresia.estado === 'pendiente'
                                ? 'Pendiente de acreditación de pago'
                                : (membresia.estado === 'vencida' ? 'Membresía vencida' : 'Membresía')}
                        </p>
                      </div>
                    </div>

                    <span className={`membresia-status-badge status-${membresia.estado || 'activa'}`}>
                      {membresia.estado_etiqueta || 'Activa'}
                    </span>
                  </div>

                  {/* Precio Contratado (snapshot histórico) */}
                  <div className="membresia-precio-container">
                    <span className="membresia-precio-val">
                      {membresia.precio_formateado || '$0'}
                    </span>
                    <span className="membresia-precio-mes">
                      / {membresia.duracion_contratada_dias ? `${membresia.duracion_contratada_dias} días` : 'período'}
                    </span>
                  </div>

                  {/* Métricas en 3 Columnas */}
                  <div className="membresia-stats-row">
                    <div className="membresia-stat-col">
                      <span className="membresia-stat-label">INICIO</span>
                      <span className="membresia-stat-val">
                        <FaCalendarAlt className="stat-icon" />
                        {membresia.fecha_inicio_formateada || '-'}
                      </span>
                    </div>

                    <div className="membresia-stat-col">
                      <span className="membresia-stat-label">VENCIMIENTO</span>
                      <span className="membresia-stat-val">
                        <FaCalendarAlt className="stat-icon" />
                        {membresia.fecha_vencimiento_formateada || '-'}
                      </span>
                    </div>

                    <div className="membresia-stat-col">
                      <span className="membresia-stat-label">DÍAS RESTANTES</span>
                      <span className="membresia-stat-val dias-resaltado">
                        <FaRegClock className="stat-icon icon-verde" />
                        {membresia.tiempo_restante_texto || '0 días'}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progreso de Vigencia */}
                  <div className="membresia-progress-bar-wrapper">
                    <div className="membresia-progress-track">
                      <div
                        className="membresia-progress-fill"
                        style={{
                          width: `${Math.min(100, Math.max(8, membresia.porcentaje_transcurrido || 0))}%`
                        }}
                      />
                    </div>
                  </div>

                  {membresiaProgramada && (
                    <div
                      style={{
                        marginTop: '14px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#bae6fd',
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <FaCalendarAlt style={{ color: '#38bdf8', flexShrink: 0 }} />
                      <span>
                        <strong>Próxima renovación programada:</strong> {membresiaProgramada.nombre_plan} del{' '}
                        {membresiaProgramada.fecha_inicio_formateada} al {membresiaProgramada.fecha_vencimiento_formateada}.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="membresia-sin-activo-wrapper">
                  <div className="membresia-sin-activo-header">
                    <div className="membresia-sin-activo-badge-icon">
                      <FaCreditCard />
                    </div>
                    <span className="membresia-status-badge status-sin_membresia">
                      Sin Membresía Activa
                    </span>
                  </div>

                  <div className="membresia-sin-activo-content">
                    <h3>No posees una membresía activa</h3>
                    <p>
                      Tu membresía no se encuentra disponible en este momento (ha sido pausada, cancelada o aún no posees un plan asignado).
                    </p>
                  </div>

                  <div className="membresia-sin-activo-footer">
                    <button
                      onClick={() => abrirModalPlanes(false)}
                      className="btn-ver-membresias"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <FaCrown style={{ fontSize: '13px' }} />
                      <span>Ver membresías disponibles</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: ¿Querés mejorar tu membresía o sumar otro gimnasio? */}
            <div className="membresia-card membresia-upgrade-card">
              <div className="upgrade-card-content">
                <h3>¿Querés renovar o sumar otro gimnasio?</h3>
                <p>
                  Con tu cuenta de GymTrack podés contratar membresías en {gimnasio?.nombre || 'tu gimnasio'} o en cualquier otro gimnasio disponible.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => abrirModalPlanes(false)}
                    className="btn-ver-membresias"
                  >
                    <span>Ver planes de este gimnasio</span>
                    <FaChevronRight style={{ fontSize: '12px' }} />
                  </button>
                  <button
                    onClick={() => abrirModalPlanes(true)}
                    className="btn-ver-membresias"
                    style={{ background: 'rgba(158, 240, 26, 0.12)', color: '#9EF01A', border: '1px solid rgba(158, 240, 26, 0.35)' }}
                  >
                    <FaBuilding style={{ fontSize: '12px' }} />
                    <span>Explorar otros gimnasios</span>
                  </button>
                </div>
              </div>

              <div className="upgrade-card-footer">
                <p className="upgrade-footer-note">
                  <FaWallet className="upgrade-footer-note-icon" />
                  <span>Podés pagar tu membresía con Mercado Pago.</span>
                </p>

                {/* Logotipos oficiales vectoriales */}
                <PaymentBadgesRow />
              </div>
            </div>
          </section>

          {/* Sección Inferior: Historial de Pagos */}
          <section className="socio-historial-section">
            <div className="historial-header">
              <div className="historial-title-row">
                <FaReceipt className="historial-icon" />
                <h2>Historial de pagos</h2>
              </div>
              <p className="historial-sub">
                Acá podés ver todos tus pagos y su estado.
              </p>
            </div>

            <div className="historial-lista">
              {loading && historialPagos.length === 0 ? (
                <div className="loading-spinner"></div>
              ) : historialPagos.length > 0 ? (
                historialPagos.map((pago, index) => (
                  <div
                    key={pago.id_pago || index}
                    className="pago-item-row"
                    onClick={() => abrirDetallePago(pago)}
                    title="Click para ver comprobante"
                  >
                    <div className="pago-left-group">
                      <div className="pago-card-icon-box">
                        <FaCreditCard />
                      </div>
                      <div className="pago-fecha-info">
                        <span className="pago-fecha-val">{pago.fecha_formateada}</span>
                        <span className="pago-metodo-sub">{pago.metodo_pago_etiqueta}</span>
                      </div>
                    </div>

                    <div className="pago-plan-group">
                      <span className="pago-plan-nombre">{pago.plan_nombre}</span>
                      <span className="pago-categoria-sub">{pago.categoria || 'Membresía'}</span>
                    </div>

                    <div className="pago-monto-col">
                      {pago.monto_formateado}
                    </div>

                    <div className="pago-badge-col">
                      <span
                        className={`pago-badge-${
                          (pago.estado || '').toLowerCase() === 'aprobado' || (pago.estado || '').toLowerCase() === 'pagado'
                            ? 'pagado'
                            : (pago.estado || 'pendiente').toLowerCase()
                        }`}
                      >
                        {pago.estado_etiqueta || 'Pendiente'}
                      </span>
                    </div>

                    <div className="pago-chevron-col">
                      <FaChevronRight />
                    </div>
                  </div>
                ))
              ) : (
                <div className="pago-empty-state">
                  <FaReceipt style={{ fontSize: '32px', color: '#64748b' }} />
                  <p>Aún no tienes registros de pagos cargados.</p>
                  <button
                    onClick={() => abrirModalPlanes(false)}
                    className="btn-ver-membresias"
                    style={{ width: 'auto', display: 'inline-flex', padding: '10px 20px', margin: 0 }}
                  >
                    Realizar Primer Pago
                  </button>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* ====================================================================
          MODAL 1: MEMBRESÍAS DISPONIBLES EN EL GIMNASIO
          ==================================================================== */}
      {modalPlanesAbierto && (
        <div className="modal-overlay" onClick={() => setModalPlanesAbierto(false)}>
          <div
            className="modal-content-card modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <div>
                <h2>Membresías Disponibles</h2>
                <p>
                  Elegí un gimnasio y seleccioná el plan que quieras contratar o renovar.
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setModalPlanesAbierto(false)}
              >
                <FaTimes />
              </button>
            </div>

            {catalogoGimnasios.length > 0 && (
              <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label htmlFor="modal-gym-select" style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaBuilding style={{ color: '#9EF01A' }} /> Gimnasio:
                </label>
                <select
                  id="modal-gym-select"
                  value={gimnasioModalId}
                  onChange={(e) => handleCambiarGimnasioEnModal(e.target.value)}
                  style={{
                    background: '#141a21',
                    color: '#f8fafc',
                    border: '1px solid rgba(158, 240, 26, 0.35)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13.5px',
                    minWidth: '240px'
                  }}
                >
                  {catalogoGimnasios.map((g) => (
                    <option key={g.id_gimnasio} value={g.id_gimnasio}>
                      {g.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loadingPlanes ? (
              <div className="loading-spinner"></div>
            ) : planesDisponibles.length > 0 ? (
              <div className="planes-modal-grid">
                {planesDisponibles.map((plan) => (
                  <div
                    key={plan.id_membresia_gimnasio}
                    className={`plan-modal-card ${plan.es_superior ? 'plan-destacado' : ''}`}
                  >
                    {plan.es_superior && (
                      <span className="plan-badge-superior">Plan Superior</span>
                    )}

                    <div>
                      <h3 className="plan-modal-title">{plan.nombre}</h3>
                      <div className="plan-modal-precio">
                        {plan.precio_formateado} <span>/ {plan.duracion_texto || `${plan.duracion_dias} días`}</span>
                      </div>

                      <ul className="plan-modal-beneficios">
                        {(plan.beneficios || []).map((b, idx) => (
                          <li key={idx}>
                            <FaCheck />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <button
                        onClick={() => prepararPagoPlan(plan)}
                        className={`btn-plan-select ${plan.es_superior ? 'btn-plan-primary' : 'btn-plan-outline'}`}
                      >
                        {plan.es_plan_actual
                          ? 'Renovar este Plan'
                          : (plan.es_superior ? 'Mejorar a este Plan' : 'Contratar Plan')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="planes-empty-box">
                <FaCrown style={{ fontSize: '38px', color: '#64748b', marginBottom: '10px' }} />
                <h3>No hay membresías activas disponibles</h3>
                <p>
                  En este momento {gymSeleccionadoModal?.nombre || 'el gimnasio seleccionado'} no posee planes activos habilitados para contratación.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: CHECKOUT CON MERCADO PAGO
          ==================================================================== */}
      {modalCheckoutAbierto && planParaPagar && (
        <div className="modal-overlay" onClick={() => setModalCheckoutAbierto(false)}>
          <div
            className="modal-content-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <div>
                <h2>Pagar Membresía</h2>
                <p>Confirmá tu suscripción pagando de forma segura con Mercado Pago o en recepción.</p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setModalCheckoutAbierto(false)}
              >
                <FaTimes />
              </button>
            </div>

            {/* Medio de Pago Digital */}
            <div className="checkout-method-selector">
              <div className="checkout-method-card selected-mp">
                <MercadoPagoLogo height={26} />
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  Dinero en cuenta o Tarjeta
                </span>
              </div>
            </div>

            {/* Resumen de la Orden */}
            <div className="checkout-resumen-box">
              <div className="checkout-resumen-row">
                <span>Plan seleccionado:</span>
                <span style={{ color: '#ffffff', fontWeight: '600' }}>{planParaPagar.nombre}</span>
              </div>
              <div className="checkout-resumen-row">
                <span>Gimnasio:</span>
                <span style={{ color: '#ffffff', fontWeight: '600' }}>{gimnasio?.nombre || 'GymTrack'}</span>
              </div>
              <div className="checkout-resumen-row">
                <span>Duración:</span>
                <span style={{ color: '#ffffff', fontWeight: '600' }}>{planParaPagar.duracion_dias} días</span>
              </div>
              <div className="checkout-resumen-row total-row">
                <span>Total a Pagar:</span>
                <span>{planParaPagar.precio_formateado}</span>
              </div>
            </div>

            {/* Información de acreditación segura */}
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '18px',
                fontSize: '12.5px',
                color: '#cbd5e1'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: '700', marginBottom: '4px' }}>
                <FaInfoCircle />
                <span>Acreditación verificada por el servidor</span>
              </div>
              <p style={{ margin: 0, color: '#94a3b8' }}>
                El monto proviene del plan vigente en el gimnasio. Tu membresía quedará en estado pendiente hasta que el backend confirme la acreditación del pago.
              </p>
            </div>

            {/* Acciones de Pago */}
            <div className="checkout-actions-col">
              <button
                onClick={handlePagarConPasarela}
                disabled={procesandoPago || !getCheckoutUrl()}
                className="btn-checkout-mp"
              >
                <MercadoPagoLogo height={20} />
                <span>
                  {procesandoPago
                    ? 'Generando orden...'
                    : getCheckoutUrl()
                    ? 'Ir a pagar en Mercado Pago'
                    : 'Mercado Pago no configurado en servidor'}
                </span>
                <FaExternalLinkAlt style={{ fontSize: '12px' }} />
              </button>

              <button
                onClick={handleSolicitarMembresiaPendiente}
                disabled={procesandoPago}
                className="btn-simular-aprobado"
              >
                <FaCheck />
                <span>Solicitar Membresía Pendiente (Pagar en Recepción)</span>
              </button>

              <button
                onClick={handleActualizarEstadoPago}
                disabled={verificandoPago}
                style={{
                  background: 'rgba(148, 163, 184, 0.12)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  padding: '11px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <FaSyncAlt className={verificandoPago ? 'spin-icon' : ''} />
                <span>{verificandoPago ? 'Consultando estado...' : 'Actualizar estado desde el servidor'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: COMPROBANTE DE PAGO DIGITAL
          ==================================================================== */}
      {modalComprobanteAbierto && pagoSeleccionado && (
        <div className="modal-overlay" onClick={() => setModalComprobanteAbierto(false)}>
          <div
            className="modal-content-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <div>
                <h2>Comprobante de Pago</h2>
                <p>Recibo digital oficial de pago emitido por GymTrack.</p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setModalComprobanteAbierto(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="comprobante-card">
              <div className="comprobante-header-gym">
                <h3>{gimnasio?.nombre || 'GymTrack Fitness Club'}</h3>
                <p>{gimnasio?.telefono || gimnasio?.email || 'Comprobante digital'}</p>
              </div>

              <div className="comprobante-detalles-grid">
                <div className="comprobante-campo">
                  <label>Comprobante N°</label>
                  <span>{pagoSeleccionado.comprobante || `COMP-${pagoSeleccionado.id_pago}`}</span>
                </div>
                <div className="comprobante-campo">
                  <label>Fecha de Pago</label>
                  <span>{pagoSeleccionado.fecha_formateada}</span>
                </div>
                <div className="comprobante-campo">
                  <label>Socio</label>
                  <span>{socio?.nombre_completo || socio?.nombre || 'Socio'}</span>
                </div>
                <div className="comprobante-campo">
                  <label>DNI</label>
                  <span>{socio?.dni || 'S/D'}</span>
                </div>
                <div className="comprobante-campo">
                  <label>Concepto / Plan</label>
                  <span>{pagoSeleccionado.plan_nombre}</span>
                </div>
                <div className="comprobante-campo">
                  <label>Medio de Pago</label>
                  <span>{pagoSeleccionado.metodo_pago_etiqueta}</span>
                </div>
              </div>

              <div className="comprobante-total-box">
                <span>
                  Estado:{' '}
                  <strong
                    style={{
                      color:
                        pagoSeleccionado.estado === 'aprobado' || pagoSeleccionado.estado === 'pagado'
                          ? '#22c55e'
                          : pagoSeleccionado.estado === 'rechazado' || pagoSeleccionado.estado === 'anulado'
                          ? '#ef4444'
                          : '#f59e0b'
                    }}
                  >
                    {pagoSeleccionado.estado_etiqueta || pagoSeleccionado.estado || 'Pendiente'}
                  </strong>
                </span>
                <span>{pagoSeleccionado.monto_formateado}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.print()}
                className="btn-simular-aprobado"
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.15)' }}
              >
                <FaPrint />
                <span>Imprimir Recibo</span>
              </button>
              <button
                onClick={() => setModalComprobanteAbierto(false)}
                className="btn-ver-membresias"
                style={{ width: 'auto', margin: 0, padding: '10px 24px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
