import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaHistory, 
  FaCalendarCheck, 
  FaArrowLeft, 
  FaSignOutAlt, 
  FaDumbbell 
} from 'react-icons/fa';
import ModalHistorialAsistencias from '../../components/asistencia-socio/modalAsistencia-socio/modalAsistenciaSocio';
import { fetchHistorialPorSocio, registrarAsistencia } from '../../services/asistenciaService';
import './asistencia-socio.css';

function AsistenciaSocio() {
  const navigate = useNavigate();

  // DOCUMENTACIÓN: Estado para almacenar datos del socio desde el almacenamiento local
  const [socio, setSocio] = useState(null);
  
  // DOCUMENTACIÓN: Estados de control de UI (cargas, alertas, modales)
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [yaRegistradoHoy, setYaRegistradoHoy] = useState(false);
  const [ultimaAsistenciaHoy, setUltimaAsistenciaHoy] = useState(null);
  const [alerta, setAlerta] = useState(null);

  // DOCUMENTACIÓN: Control de ventanas emergentes (modales)
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [datosConfirmacion, setDatosConfirmacion] = useState(null);

  // DOCUMENTACIÓN: Obtener hora en tiempo real para el reloj en pantalla
  const [horaActual, setHoraActual] = useState(new Date());

  useEffect(() => {
    // Reloj continuo
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // DOCUMENTACIÓN: Cargar socio e historial del día para verificar duplicados
  const verificarRegistroPrevio = async (idSocio) => {
    try {
      setCargando(true);
      const data = await fetchHistorialPorSocio(idSocio);
      const lista = data.asistencias || [];

      // Comprobamos si la última asistencia coincide con la fecha de hoy
      const hoy = new Date().toISOString().split('T')[0];
      const ingresoHoy = lista.find(a => {
        if (!a.hora_ingreso) return false;
        const fechaIngreso = new Date(a.hora_ingreso).toISOString().split('T')[0];
        return fechaIngreso === hoy;
      });

      if (ingresoHoy) {
        setYaRegistradoHoy(true);
        setUltimaAsistenciaHoy(ingresoHoy);
      }
    } catch (err) {
      console.error('Error al verificar asistencias previas:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Recuperar credenciales del localStorage guardadas al iniciar sesión
    const socioGuardado = localStorage.getItem('socio');
    const usuarioGuardado = localStorage.getItem('usuario');
    let datosSocio = null;

    if (socioGuardado) {
      datosSocio = JSON.parse(socioGuardado);
    } else if (usuarioGuardado) {
      datosSocio = JSON.parse(usuarioGuardado);
    }

    if (datosSocio && (datosSocio.id_socio || datosSocio.id)) {
      setSocio(datosSocio);
      verificarRegistroPrevio(datosSocio.id_socio || datosSocio.id);
    } else {
      setCargando(false);
      setAlerta({
        tipo: 'error',
        mensaje: 'No se pudo verificar el perfil del socio autenticado.'
      });
    }
  }, []);

  // DOCUMENTACIÓN: Registrar asistencia al presionar el botón principal
  const handleRegistrarAsistencia = async () => {
    if (yaRegistradoHoy) return;

    try {
      setRegistrando(true);
      setAlerta(null);

      const idSocio = socio.id_socio || socio.id;

      const data = await registrarAsistencia({ id_socio: idSocio, dni: socio.dni });

      // Deshabilitar nuevos registros durante el día
      setYaRegistradoHoy(true);
      setUltimaAsistenciaHoy(data.asistencia);

      // Abrir pestaña emergente (Modal) de confirmación exitosa
      setDatosConfirmacion({
        mensaje: data.mensaje || '¡Asistencia registrada correctamente!',
        hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        fecha: new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      });
      setMostrarModalConfirmacion(true);

    } catch (err) {
      setAlerta({
        tipo: 'error',
        mensaje: err.message || 'No se pudo completar el registro de asistencia.'
      });
    } finally {
      setRegistrando(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login-socio');
  };

  return (
    <div className="asistencia-socio-container">
      {/* DOCUMENTACIÓN: Barra superior del socio */}
      <header className="asistencia-socio-nav">
        <Link to="/socio/dashboard" className="asistencia-socio-marca">
          GYM<span>TRACK</span>
        </Link>
        <div className="asistencia-socio-nav-actions">
          <Link to="/perfil" className="asistencia-btn-nav secondary">
            <FaArrowLeft /> Volver al Perfil
          </Link>
          <button onClick={handleLogout} className="asistencia-btn-nav logout">
            <FaSignOutAlt /> Salir
          </button>
        </div>
      </header>

      <main className="asistencia-socio-content">
        {/* DOCUMENTACIÓN: Tarjeta Central de Marcar Ingreso */}
        <div className="asistencia-card-main">
          <div className="asistencia-card-header">
            <div className="asistencia-badge-icon">
              <FaDumbbell />
            </div>
            <h2>Registro de Asistencia</h2>
            <p>Registra tu acceso diario al gimnasio de forma rápida</p>
          </div>

          {/* Reloj y Fecha actual */}
          <div className="asistencia-clock-box">
            <span className="asistencia-clock-time">
              {horaActual.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="asistencia-clock-date">
              {horaActual.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          {/* Alertas informativas o de error */}
          {alerta && (
            <div className={`asistencia-alert ${alerta.tipo}`}>
              <FaExclamationTriangle />
              <span>{alerta.mensaje}</span>
            </div>
          )}

          {/* DOCUMENTACIÓN: Control de estado según reglas del sistema */}
          {cargando ? (
            <div className="asistencia-loader">
              <div className="asistencia-spinner"></div>
              <p>Verificando estado de asistencia...</p>
            </div>
          ) : (
            <div className="asistencia-action-area">
              {yaRegistradoHoy ? (
                <div className="asistencia-status-registered">
                  <FaCheckCircle className="asistencia-check-icon" />
                  <h3>¡Asistencia de hoy ya registrada!</h3>
                  <p>
                    Registraste tu ingreso hoy a las{' '}
                    <strong>
                      {ultimaAsistenciaHoy?.hora_ingreso
                        ? new Date(ultimaAsistenciaHoy.hora_ingreso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                        : 'horario confirmado'}
                    </strong>
                  </p>
                  <span className="asistencia-restriction-msg">
                    El sistema permite un (1) registro de asistencia por día por socio.
                  </span>
                </div>
              ) : (
                <button
                  className="asistencia-btn-registrar"
                  onClick={handleRegistrarAsistencia}
                  disabled={registrando}
                >
                  <FaCalendarCheck />
                  {registrando ? 'Registrando...' : 'Marcar Mi Asistencia Ahora'}
                </button>
              )}

              {/* DOCUMENTACIÓN: Botón para abrir el Modal de Historial */}
              <button
                className="asistencia-btn-historial"
                onClick={() => setMostrarModalHistorial(true)}
              >
                <FaHistory /> Ver Historial Completo de Asistencias
              </button>
            </div>
          )}
        </div>
      </main>

      {/* DOCUMENTACIÓN: Modal Emergente de Confirmación de Asistencia */}
      {mostrarModalConfirmacion && (
        <div className="asistencia-modal-overlay">
          <div className="asistencia-modal-card confirm">
            <div className="asistencia-modal-icon success">
              <FaCheckCircle />
            </div>
            <h2>¡Asistencia Confirmada!</h2>
            <p className="asistencia-modal-msg">{datosConfirmacion?.mensaje}</p>
            <div className="asistencia-modal-details">
              <div>
                <span>Fecha</span>
                <strong>{datosConfirmacion?.fecha}</strong>
              </div>
              <div>
                <span>Hora de Ingreso</span>
                <strong>{datosConfirmacion?.hora} hs</strong>
              </div>
            </div>
            <button
              className="asistencia-modal-btn-close"
              onClick={() => setMostrarModalConfirmacion(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* DOCUMENTACIÓN: Modal Emergente para el Historial de Fechas y Horarios */}
      {mostrarModalHistorial && socio && (
        <ModalHistorialAsistencias
          idSocio={socio.id_socio || socio.id}
          onClose={() => setMostrarModalHistorial(false)}
        />
      )}
    </div>
  );
}

export default AsistenciaSocio;