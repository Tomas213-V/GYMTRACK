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

  const planNombreBase = memb?.membresia_gimnasio?.nombre || memb?.plan_membresia?.nombre || memb?.tipo || 'Sin Plan';
  const estadoMembStr = memb?.estado ? String(memb.estado).trim().toLowerCase() : '';
  const planNombre =
    memb && estadoMembStr && estadoMembStr !== 'activa' && estadoMembStr !== 'activo'
      ? `${planNombreBase} (${estadoMembStr.charAt(0).toUpperCase() + estadoMembStr.slice(1)})`
      : planNombreBase;
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return 'N/A';
    const partes = String(fechaStr).split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fechaStr;
  };
  const vencimiento = memb?.fecha_vencimiento ? formatearFecha(memb.fecha_vencimiento) : 'N/A';

  const estadoRaw = socio.estado_asociacion !== undefined && socio.estado_asociacion !== null
    ? socio.estado_asociacion
    : socio.estado;
  const estadoLabel = typeof estadoRaw === 'boolean'
    ? (estadoRaw ? 'activo' : 'inactivo')
    : String(estadoRaw || 'activo').toLowerCase();

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