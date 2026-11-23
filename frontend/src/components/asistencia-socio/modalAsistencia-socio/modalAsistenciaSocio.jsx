import { useState, useEffect } from 'react';
import { FaTimes, FaCalendarAlt, FaClock, FaCalendarDay } from 'react-icons/fa';
import { fetchHistorialPorSocio } from '../../../services/asistenciaService';
import { formatFechaArgentina, formatHoraArgentina } from '../../../utils/dateUtils';
import './modalAsistenciaSocio.css';

function ModalHistorialAsistencias({ idSocio, onClose }) {
  // DOCUMENTACIÓN: Estados para listar el historial y aplicar carga
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // DOCUMENTACIÓN: Cargar el historial desde GET /api/asistencias/socio/:id_socio
  useEffect(() => {
    const fetchHistorial = async () => {
      try {
        setCargando(true);
        const data = await fetchHistorialPorSocio(idSocio);
        setHistorial(data.asistencias || []);
      } catch (err) {
        setErrorMsg(err.message || 'Error de conexión con el servidor.');
      } finally {
        setCargando(false);
      }
    };

    if (idSocio) {
      fetchHistorial();
    }
  }, [idSocio]);

  // DOCUMENTACIÓN: Formatear fecha a legible (horario Argentina)
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return 'Fecha no disponible';
    try {
      return formatFechaArgentina(fechaStr, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return fechaStr;
    }
  };

  // DOCUMENTACIÓN: Formatear hora a HH:MM (horario Argentina)
  const formatearHora = (fechaStr) => {
    if (!fechaStr) return '--:--';
    try {
      return formatHoraArgentina(fechaStr);
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="modal-historial-overlay">
      <div className="modal-historial-card">
        <div className="modal-historial-header">
          <div className="modal-historial-title">
            <FaCalendarAlt className="modal-historial-icon" />
            <div>
              <h3>Historial de Asistencias</h3>
              <p>Consulta tus fechas y horarios de ingreso al gimnasio</p>
            </div>
          </div>
          <button className="modal-historial-close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-historial-body">
          {cargando ? (
            <div className="modal-historial-loading">
              <div className="modal-historial-spinner"></div>
              <p>Cargando registros...</p>
            </div>
          ) : errorMsg ? (
            <div className="modal-historial-error">{errorMsg}</div>
          ) : historial.length === 0 ? (
            <div className="modal-historial-empty">
              <FaCalendarDay size={32} />
              <p>Aún no posees asistencias registradas en el sistema.</p>
            </div>
          ) : (
            <div className="modal-historial-table-wrapper">
              <table className="modal-historial-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Sucursal</th>
                    <th>Ingreso</th>
                    <th>Salida</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item, index) => (
                    <tr key={item.id_asistencia_socio || item.id_asistencia || index}>
                      <td>{formatearFecha(item.hora_ingreso)}</td>
                      <td>{item.sucursal?.direccion || '-'}</td>
                      <td>
                        <span className="modal-historial-hora">
                          <FaClock /> {formatearHora(item.hora_ingreso)} hs
                        </span>
                      </td>
                      <td>
                        {item.hora_salida ? `${formatearHora(item.hora_salida)} hs` : 'En curso'}
                      </td>
                      <td>
                        <span className="modal-historial-badge">
                          {item.estado || 'presente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-historial-footer">
          <button className="modal-historial-btn-ok" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalHistorialAsistencias;