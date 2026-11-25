import './card.css';

function SocioCard({ socio, onClick }) {
  const nombreCompleto = socio.nombre
    ? `${socio.nombre} ${socio.apellido || ''}`.trim()
    : (socio.usuario
        ? `${socio.usuario.nombre} ${socio.usuario.apellido || ''}`.trim()
        : 'Sin Nombre');

  const memb =
    socio.membresia_actual ||
    (Array.isArray(socio.membresias) ? socio.membresias[0] : null) ||
    (Array.isArray(socio.membresia) ? socio.membresia[0] : socio.membresia) ||
    null;

  const planNombre = memb?.membresia_gimnasio?.nombre || memb?.plan_membresia?.nombre || memb?.tipo || 'Sin Plan';
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return 'N/A';
    const partes = String(fechaStr).split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fechaStr;
  };
  const vencimiento = memb?.fecha_vencimiento ? formatearFecha(memb.fecha_vencimiento) : 'N/A';

  const estadoLabel = typeof socio.estado === 'boolean'
    ? (socio.estado ? 'activo' : 'inactivo')
    : String(socio.estado || 'activo').toLowerCase();

  return (
    <div className="socio-card" onClick={() => onClick(socio)}>
      <div className="socio-avatar">👤</div>
      <div className="socio-info">
        <h3>{nombreCompleto}</h3>
        <p>DNI: {socio.dni}</p>
        <p>📞 {socio.telefono || 'Sin teléfono'}</p>
      </div>
      <div className="socio-status-section">
        <span className={`badge badge-${estadoLabel}`}>{estadoLabel}</span>
        <span className="plan-title">{planNombre}</span>
        <span className="vencimiento-date">Vence {vencimiento}</span>
      </div>
      <div className="socio-arrow">❯</div>
    </div>
  );
}

export default SocioCard;