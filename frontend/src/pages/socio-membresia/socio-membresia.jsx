import { useState, useEffect } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import SidebarSocio from '../../components/sidebar-socio/sidebar-socio';
import {
  getMiMembresia,
  getPlanesDisponibles,
  iniciarPagoMembresia,
  confirmarPagoMembresia,
  verificarPagoMercadoPago
} from '../../services/socioMembresiaService';
import {
  MercadoPagoLogo,
  UalaLogo,
  PaymentBadgesRow
} from '../../components/socio-membresia/PaymentLogos';

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
  FaCopy,
  FaExternalLinkAlt,
  FaInfoCircle,
  FaSyncAlt
} from 'react-icons/fa';

import './socio-membresia.css';

export default function SocioMembresia() {
  // --------------------------------------------------------------------------
  // Estados Principales
  // --------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [notificacion, setNotificacion] = useState('');
  const [copiadoKey, setCopiadoKey] = useState('');

  // Estados excluidos que representan que una membresía o plan está pausado, cancelado o inactivo
  const ESTADOS_EXCLUIDOS = ['inactivo', 'inactiva', 'pausa', 'pausado', 'pausada', 'cancelado', 'cancelada', 'eliminado', 'eliminada', 'sin_membresia'];

  // Datos de la membresía y socio
  const [socio, setSocio] = useState(null);
  const [gimnasio, setGimnasio] = useState(null);
  const [membresia, setMembresia] = useState(null);
  const [historialPagos, setHistorialPagos] = useState([]);

  // Planes disponibles en el gimnasio
  const [planesDisponibles, setPlanesDisponibles] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(false);

  // Estados de los Modales
  const [modalPlanesAbierto, setModalPlanesAbierto] = useState(false);
  const [modalCheckoutAbierto, setModalCheckoutAbierto] = useState(false);
  const [modalComprobanteAbierto, setModalComprobanteAbierto] = useState(false);

  // Datos temporales para Checkout y Pago
  const [planParaPagar, setPlanParaPagar] = useState(null);
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] = useState('mercadopago');
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [verificandoPago, setVerificandoPago] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);

  // Pago seleccionado para el comprobante
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);

  // --------------------------------------------------------------------------
  // Carga Inicial de Datos y Detección de Retorno de Mercado Pago
  // --------------------------------------------------------------------------
  const cargarMembresia = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await getMiMembresia();

      if (data.socio) setSocio(data.socio);
      if (data.gimnasio) setGimnasio(data.gimnasio);
      if (data.membresia && data.membresia.tiene_membresia && data.membresia.id_membresia) {
        setMembresia(data.membresia);
      } else {
        setMembresia(null);
      }
      if (data.historial_pagos) setHistorialPagos(data.historial_pagos);

    } catch (err) {
      console.warn('Error al cargar membresía del socio:', err.message);
      setErrorMsg(err.message);
      setMembresia(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Detectar si el usuario retorna desde el checkout de Mercado Pago
    const params = new URLSearchParams(window.location.search);
    const pagoStatus = params.get('pago_status') || params.get('collection_status') || params.get('status');
    const ref = params.get('ref') || params.get('external_reference');
    const paymentId = params.get('payment_id') || params.get('collection_id');

    const verificarAlMontar = async () => {
      if (pagoStatus === 'approved') {
        try {
          const res = await verificarPagoMercadoPago({
            external_reference: ref || '',
            payment_id: paymentId || ''
          });
          if (res.aprobado) {
            setNotificacion(res.mensaje || '¡Pago aprobado por Mercado Pago! Tu membresía ha sido renovada.');
          }
        } catch (e) {
          console.error('Error al confirmar retorno de Mercado Pago:', e);
        } finally {
          window.history.replaceState({}, document.title, window.location.pathname);
          setTimeout(() => setNotificacion(''), 7000);
        }
      } else {
        // Verificar silenciosamente si hay algún pago aprobado en Mercado Pago de este socio pendiente de acreditar
        try {
          const res = await verificarPagoMercadoPago();
          if (res.aprobado && !res.ya_registrado) {
            setNotificacion(res.mensaje || '¡Se acreditó tu último pago de Mercado Pago!');
            setTimeout(() => setNotificacion(''), 7000);
          }
        } catch {
          // silencioso
        }
      }
      await cargarMembresia();
    };

    verificarAlMontar();
  }, []);

  // --------------------------------------------------------------------------
  // Polling automático mientras el modal de checkout de MP esté abierto
  // --------------------------------------------------------------------------
  useEffect(() => {
    let intervalId = null;
    if (modalCheckoutAbierto && metodoPagoSeleccionado === 'mercadopago' && checkoutData?.external_reference) {
      intervalId = setInterval(async () => {
        try {
          const res = await verificarPagoMercadoPago({
            external_reference: checkoutData.external_reference
          });
          if (res.aprobado) {
            setNotificacion(res.mensaje || '¡Pago detectado y acreditado con éxito desde Mercado Pago!');
            setModalCheckoutAbierto(false);
            await cargarMembresia();
            setTimeout(() => setNotificacion(''), 7000);
          }
        } catch {
          // continuar polling
        }
      }, 3500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [modalCheckoutAbierto, metodoPagoSeleccionado, checkoutData]);

  // --------------------------------------------------------------------------
  // Cargar Planes Disponibles del Gimnasio
  // --------------------------------------------------------------------------
  const abrirModalPlanes = async () => {
    setModalPlanesAbierto(true);
    try {
      setLoadingPlanes(true);
      const data = await getPlanesDisponibles();
      if (data.planes) {
        // Filtrar estrictamente para que NO aparezcan planes pausados, inactivos, cancelados o eliminados
        const planesActivos = (data.planes || []).filter(plan => {
          const est = (plan.estado || '').toLowerCase().trim();
          return (est === 'activo' || est === 'activa' || !est) && !ESTADOS_EXCLUIDOS.includes(est);
        });
        setPlanesDisponibles(planesActivos);
      } else {
        setPlanesDisponibles([]);
      }
    } catch (err) {
      console.error('Error al cargar planes disponibles:', err);
    } finally {
      setLoadingPlanes(false);
    }
  };

  // --------------------------------------------------------------------------
  // Iniciar Proceso de Pago / Checkout
  // --------------------------------------------------------------------------
  const prepararPagoPlan = async (plan) => {
    setPlanParaPagar(plan);
    setModalPlanesAbierto(false);
    setModalCheckoutAbierto(true);
    setCheckoutData(null);

    try {
      setProcesandoPago(true);
      const res = await iniciarPagoMembresia({
        id_plan_membresia: plan.id_plan_membresia,
        metodo_pago: metodoPagoSeleccionado,
        tipo_operacion: plan.es_superior ? 'upgrade' : 'renovacion'
      });
      if (res.checkout) {
        setCheckoutData(res.checkout);
      }
    } catch (err) {
      console.error('Error al iniciar preferencia de pago:', err);
    } finally {
      setProcesandoPago(false);
    }
  };

  const handleCambiarMetodo = async (nuevoMetodo) => {
    setMetodoPagoSeleccionado(nuevoMetodo);
    if (!planParaPagar) return;

    try {
      setProcesandoPago(true);
      const res = await iniciarPagoMembresia({
        id_plan_membresia: planParaPagar.id_plan_membresia,
        metodo_pago: nuevoMetodo,
        tipo_operacion: planParaPagar.es_superior ? 'upgrade' : 'renovacion'
      });
      if (res.checkout) {
        setCheckoutData(res.checkout);
      }
    } catch (err) {
      console.error('Error al actualizar método:', err);
    } finally {
      setProcesandoPago(false);
    }
  };

  // Abrir Mercado Pago Oficial o Sandbox
  const handlePagarConPasarela = () => {
    if (metodoPagoSeleccionado === 'mercadopago') {
      const urlMP = checkoutData?.sandbox_init_point || checkoutData?.init_point;
      if (urlMP) {
        window.open(urlMP, '_blank');
        return;
      }
    }
    // Si no hay URL directa, ejecutar confirmación directa
    ejecutarConfirmacionPago();
  };

  // Verificar manualmente si el pago en Mercado Pago se completó
  const handleVerificarPagoMP = async () => {
    try {
      setVerificandoPago(true);
      const res = await verificarPagoMercadoPago({
        external_reference: checkoutData?.external_reference || ''
      });

      if (res.aprobado) {
        setNotificacion(res.mensaje || '¡Pago verificado y acreditado exitosamente!');
        setModalCheckoutAbierto(false);
        await cargarMembresia();
        setTimeout(() => setNotificacion(''), 7000);
      } else {
        alert(res.mensaje || 'Aún no se detecta la acreditación de tu pago en Mercado Pago. Si acabas de abonar, aguarda unos segundos y vuelve a presionar el botón.');
      }
    } catch (e) {
      alert('Error al verificar pago: ' + e.message);
    } finally {
      setVerificandoPago(false);
    }
  };

  // --------------------------------------------------------------------------
  // Confirmar Pago Directo (Simulación de Sandbox o Aprobación)
  // --------------------------------------------------------------------------
  const ejecutarConfirmacionPago = async () => {
    if (!planParaPagar) return;

    try {
      setProcesandoPago(true);
      const refPago = checkoutData?.external_reference || `PAY-${Date.now()}`;
      const compPago = `${metodoPagoSeleccionado.toUpperCase()}-${Math.floor(10000000 + Math.random() * 90000000)}`;

      const res = await confirmarPagoMembresia({
        id_plan_membresia: planParaPagar.id_plan_membresia,
        monto: planParaPagar.precio,
        metodo_pago: metodoPagoSeleccionado,
        referencia_pago: refPago,
        comprobante: compPago
      });

      setNotificacion(res.mensaje || '¡Pago procesado con éxito!');
      setModalCheckoutAbierto(false);

      // Recargar datos actualizados desde el backend
      await cargarMembresia();

      setTimeout(() => {
        setNotificacion('');
      }, 5000);

    } catch (err) {
      alert('Error al confirmar el pago: ' + err.message);
    } finally {
      setProcesandoPago(false);
    }
  };

  // --------------------------------------------------------------------------
  // Copiar Credenciales de Prueba al Portapapeles
  // --------------------------------------------------------------------------
  const copiarTexto = (texto, key) => {
    navigator.clipboard.writeText(texto);
    setCopiadoKey(key);
    setTimeout(() => setCopiadoKey(''), 2000);
  };

  // --------------------------------------------------------------------------
  // Ver Detalle / Comprobante de un Pago del Historial
  // --------------------------------------------------------------------------
  const abrirDetallePago = (pago) => {
    setPagoSeleccionado(pago);
    setModalComprobanteAbierto(true);
  };

  // Determinar si el socio posee una membresía activa y visible
  const tieneMembresiaActiva = Boolean(
    membresia &&
    membresia.tiene_membresia !== false &&
    membresia.id_membresia &&
    !ESTADOS_EXCLUIDOS.includes((membresia.estado || '').toLowerCase().trim())
  );

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
                            : (membresia.estado === 'vencida' ? 'Membresía vencida' : 'Membresía')}
                        </p>
                      </div>
                    </div>

                    <span className={`membresia-status-badge status-${membresia.estado || 'activa'}`}>
                      {membresia.estado_etiqueta || 'Activa'}
                    </span>
                  </div>

                  {/* Precio Mensual */}
                  <div className="membresia-precio-container">
                    <span className="membresia-precio-val">
                      {membresia.precio_formateado || '$0'}
                    </span>
                    <span className="membresia-precio-mes">/ mes</span>
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
                      onClick={abrirModalPlanes}
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

            {/* Card 2: ¿Querés mejorar tu membresía? */}
            <div className="membresia-card membresia-upgrade-card">
              <div className="upgrade-card-content">
                <h3>¿Querés mejorar tu membresía?</h3>
                <p>
                  Conocé las membresías disponibles en tu gimnasio y accedé a más beneficios.
                </p>

                <button
                  onClick={abrirModalPlanes}
                  className="btn-ver-membresias"
                >
                  <span>Ver membresías disponibles</span>
                  <FaChevronRight style={{ fontSize: '12px' }} />
                </button>
              </div>

              <div className="upgrade-card-footer">
                <p className="upgrade-footer-note">
                  <FaWallet className="upgrade-footer-note-icon" />
                  <span>Podés pagar tu membresía con Mercado Pago o Ualá.</span>
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
                      <span className={`pago-badge-${(pago.estado || 'pagado').toLowerCase()}`}>
                        {pago.estado_etiqueta || 'Pagado'}
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
                    onClick={abrirModalPlanes}
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
                  Opciones exclusivas de {gimnasio?.nombre || 'tu gimnasio'} para renovar o mejorar tu plan.
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setModalPlanesAbierto(false)}
              >
                <FaTimes />
              </button>
            </div>

            {loadingPlanes ? (
              <div className="loading-spinner"></div>
            ) : planesDisponibles.length > 0 ? (
              <div className="planes-modal-grid">
                {planesDisponibles.map((plan) => (
                  <div
                    key={plan.id_plan_membresia}
                    className={`plan-modal-card ${plan.es_superior ? 'plan-destacado' : ''}`}
                  >
                    {plan.es_superior && (
                      <span className="plan-badge-superior">Plan Superior</span>
                    )}

                    <div>
                      <h3 className="plan-modal-title">{plan.nombre}</h3>
                      <div className="plan-modal-precio">
                        {plan.precio_formateado} <span>/ {plan.duracion_texto}</span>
                      </div>

                      <ul className="plan-modal-beneficios">
                        {plan.beneficios.map((b, idx) => (
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
                          : (plan.es_superior ? 'Mejorar a este Plan' : 'Seleccionar Plan')}
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
                  En este momento {gimnasio?.nombre || 'el gimnasio'} no posee membresías activas habilitadas para suscripción (pueden encontrarse pausadas temporalmente). Por favor, consulta directamente en recepción.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: CHECKOUT CON MERCADO PAGO Y UALÁ
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
                <p>Seleccioná tu medio de pago favorito para confirmar tu suscripción.</p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setModalCheckoutAbierto(false)}
              >
                <FaTimes />
              </button>
            </div>

            {/* Selector de Medios de Pago */}
            <div className="checkout-method-selector">
              <div
                className={`checkout-method-card ${metodoPagoSeleccionado === 'mercadopago' ? 'selected-mp' : ''}`}
                onClick={() => handleCambiarMetodo('mercadopago')}
              >
                <MercadoPagoLogo height={26} />
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  Dinero en cuenta o Tarjeta
                </span>
              </div>

              <div
                className={`checkout-method-card ${metodoPagoSeleccionado === 'uala' ? 'selected-uala' : ''}`}
                onClick={() => handleCambiarMetodo('uala')}
              >
                <UalaLogo height={26} />
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  Ualá Bis / Débito prepago
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

            {/* Panel de Credenciales de Prueba para Comprador */}
            {metodoPagoSeleccionado === 'mercadopago' && (
              <div
                style={{
                  background: 'rgba(0, 158, 227, 0.08)',
                  border: '1px solid rgba(0, 158, 227, 0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#009ee3', fontWeight: '700', fontSize: '13px', marginBottom: '8px' }}>
                  <FaInfoCircle />
                  <span>Datos de Comprador de Prueba para Mercado Pago</span>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#94a3b8' }}>
                  Al abrirse la pasarela de Mercado Pago, podés iniciar sesión con este usuario de prueba:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                  <div style={{ background: '#11161b', padding: '8px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Usuario: <strong style={{ color: '#ffffff' }}>TESTUSER225610921</strong></span>
                    <button
                      onClick={() => copiarTexto('TESTUSER225610921', 'user')}
                      style={{ background: 'none', border: 'none', color: copiadoKey === 'user' ? '#22c55e' : '#94a3b8', cursor: 'pointer' }}
                      title="Copiar usuario"
                    >
                      <FaCopy />
                    </button>
                  </div>

                  <div style={{ background: '#11161b', padding: '8px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Clave: <strong style={{ color: '#ffffff' }}>7oW55vd3jW</strong></span>
                    <button
                      onClick={() => copiarTexto('7oW55vd3jW', 'pass')}
                      style={{ background: 'none', border: 'none', color: copiadoKey === 'pass' ? '#22c55e' : '#94a3b8', cursor: 'pointer' }}
                      title="Copiar contraseña"
                    >
                      <FaCopy />
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#64748b' }}>
                  Código de verificación SMS (si lo solicita): <strong style={{ color: '#cbd5e1' }}>355000</strong>
                </div>
              </div>
            )}

            {/* Acciones de Pago */}
            <div className="checkout-actions-col">
              {metodoPagoSeleccionado === 'mercadopago' ? (
                <>
                  <button
                    onClick={handlePagarConPasarela}
                    disabled={procesandoPago}
                    className="btn-checkout-mp"
                  >
                    <MercadoPagoLogo height={20} />
                    <span>{procesandoPago ? 'Generando checkout...' : `Pagar con Mercado Pago`}</span>
                    <FaExternalLinkAlt style={{ fontSize: '12px' }} />
                  </button>

                  {/* Botón para verificar estado de Mercado Pago si ya pagó */}
                  {checkoutData && (
                    <button
                      onClick={handleVerificarPagoMP}
                      disabled={verificandoPago}
                      style={{
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#22c55e',
                        border: '1.5px solid #22c55e',
                        padding: '13px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 0 15px rgba(34, 197, 94, 0.2)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {verificandoPago ? <FaSyncAlt className="spin-icon" /> : <FaCheck />}
                      <span>
                        {verificandoPago ? 'Consultando Mercado Pago...' : '¿Ya pagaste en Mercado Pago? Verificar y Acreditar Pago'}
                      </span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={handlePagarConPasarela}
                  disabled={procesandoPago}
                  className="btn-checkout-uala"
                >
                  <UalaLogo height={20} />
                  <span>{procesandoPago ? 'Generando checkout...' : `Pagar con Ualá Bis`}</span>
                  <FaExternalLinkAlt style={{ fontSize: '12px' }} />
                </button>
              )}

              {/* Botón de Test / Sandbox Instantáneo */}
              <button
                onClick={ejecutarConfirmacionPago}
                disabled={procesandoPago}
                className="btn-simular-aprobado"
              >
                <FaCheck />
                <span>Simular Pago Aprobado (Test Rápido Sin Salir)</span>
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
                <p>{gimnasio?.direccion || 'Sede Central'}</p>
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
                <span>Estado: <strong style={{ color: '#22c55e' }}>Aprobado</strong></span>
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
