import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBuilding, FaMapMarkerAlt, FaUserShield, FaCheckCircle, FaSignOutAlt, FaArrowRight } from 'react-icons/fa';
import { useGymContext } from '../../context/GymContext';
import { getContextosDisponibles } from '../../services/authService';
import logoImg from '../../assets/logo_verde.jpg';
import '../login-dueno/login.css';
import './seleccionar-gimnasio.css';

export default function SeleccionarGimnasio() {
  const navigate = useNavigate();
  const {
    rol,
    esSocio,
    esAdministrador,
    esEmpleado,
    contextosDisponibles,
    confirmarContexto,
    logout
  } = useGymContext();

  const [opciones, setOpciones] = useState(contextosDisponibles || []);
  const [seleccionadoId, setSeleccionadoId] = useState(
    contextosDisponibles?.[0]?.contexto_id || ''
  );
  const [cargando, setCargando] = useState(contextosDisponibles.length === 0);
  const [confirmando, setConfirmando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (Array.isArray(contextosDisponibles) && contextosDisponibles.length > 0) {
      setOpciones(contextosDisponibles);
      setSeleccionadoId((prev) => prev || contextosDisponibles[0].contexto_id);
      setCargando(false);
      return;
    }

    const controller = new AbortController();
    getContextosDisponibles({ signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(res?.contextos_disponibles) ? res.contextos_disponibles : [];
        setOpciones(list);
        if (list.length === 1) {
          confirmarContexto(list[0]).then((ok) => {
            if (ok) {
              navigate(esSocio ? '/dashboard-socio' : '/dashboard-dueño', { replace: true });
            }
          });
        } else if (list.length > 0) {
          setSeleccionadoId(list[0].contexto_id);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        setErrorMsg(err.message || 'No se pudieron obtener tus gimnasios disponibles.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });

    return () => controller.abort();
  }, [contextosDisponibles, confirmarContexto, esSocio, navigate]);

  const handleIngresar = async () => {
    const elegido = opciones.find((op) => op.contexto_id === seleccionadoId);
    if (!elegido) {
      setErrorMsg('Seleccioná un gimnasio para continuar.');
      return;
    }

    setErrorMsg('');
    setConfirmando(true);
    try {
      const ok = await confirmarContexto(elegido);
      if (!ok) {
        setErrorMsg('No fue posible validar tu acceso a este gimnasio. Intentá nuevamente.');
        return;
      }
      navigate(esSocio || elegido.rol === 'socio' ? '/dashboard-socio' : '/dashboard-dueño', {
        replace: true
      });
    } catch (err) {
      setErrorMsg(err.message || 'No fue posible iniciar en el gimnasio seleccionado.');
    } finally {
      setConfirmando(false);
    }
  };

  const handleCerrarSesion = () => {
    const loginPath = esSocio
      ? '/login-socio'
      : esAdministrador
      ? '/login-administrador'
      : esEmpleado
      ? '/login-empleado'
      : '/login-dueño';
    logout();
    navigate(loginPath, { replace: true });
  };

  return (
    <main className="login-page">
      <div className="login-card selector-gym-card">
        <img src={logoImg} alt="GymTrack Logo" className="login-logo" />

        <h1>¿A qué gimnasio querés ingresar?</h1>
        <p className="selector-gym-subtitulo">
          Seleccioná una única asociación activa para esta sesión. Para cambiar de gimnasio más adelante,
          deberás cerrar sesión y volver a iniciar sesión.
        </p>

        {errorMsg && <div className="login-backend-error">{errorMsg}</div>}

        {cargando ? (
          <div className="selector-gym-empty">Cargando tus gimnasios autorizados...</div>
        ) : opciones.length === 0 ? (
          <div className="selector-gym-empty">
            No se encontraron asociaciones activas para tu perfil ({rol || 'usuario'}).
          </div>
        ) : (
          <div className="selector-gym-lista" role="radiogroup" aria-label="Gimnasios disponibles">
            {opciones.map((op) => {
              const activo = seleccionadoId === op.contexto_id;
              return (
                <button
                  key={op.contexto_id}
                  type="button"
                  className={`selector-gym-item ${activo ? 'seleccionado' : ''}`}
                  onClick={() => setSeleccionadoId(op.contexto_id)}
                  aria-pressed={activo}
                >
                  <div className="selector-gym-item-icono">
                    <FaBuilding />
                  </div>
                  <div className="selector-gym-item-info">
                    <div className="selector-gym-item-titulo">
                      <strong>{op.nombre_gimnasio}</strong>
                      <span className="selector-gym-rol-badge">
                        <FaUserShield /> {op.etiqueta_rol}
                      </span>
                    </div>
                    {op.id_sucursal && (
                      <div className="selector-gym-item-sucursal">
                        <FaMapMarkerAlt />
                        <span>
                          {op.nombre_sucursal}
                          {op.direccion_sucursal && op.direccion_sucursal !== op.nombre_sucursal
                            ? ` — ${op.direccion_sucursal}`
                            : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="selector-gym-item-check">
                    {activo && <FaCheckCircle />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="selector-gym-acciones">
          <button
            type="button"
            className="login-button"
            disabled={confirmando || cargando || opciones.length === 0}
            onClick={handleIngresar}
          >
            {confirmando ? 'Ingresando...' : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                Ingresar al gimnasio <FaArrowRight />
              </span>
            )}
          </button>

          <button
            type="button"
            className="selector-gym-btn-logout"
            onClick={handleCerrarSesion}
          >
            <FaSignOutAlt /> Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}
