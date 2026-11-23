import './card.css';

function SocioCard({ socio, onClick }) {
  const nombreCompleto = socio.nombre
    ? `${socio.nombre} ${socio.apellido || ''}`.trim()
    : (socio.usuario
        ? `${socio.usuario.nombre} ${socio.usuario.apellido || ''}`.trim()
        : 'Sin Nombre');

  const memb = Array.isArray(socio.membresia)
    ? (socio.membresia[0] || null)
    : (socio.membresia || null);

  const planNombre = memb?.membresia_gimnasio?.nombre || memb?.tipo || 'Sin Plan';
  const vencimiento = memb?.fecha_vencimiento
    ? new Date(memb.fecha_vencimiento).toLocaleDateString('es-AR')
    : 'N/A';

  return (
    <div className="socio-card" onClick={() => onClick(socio)}>
      <div className="socio-avatar">👤</div>
      <div className="socio-info">
        <h3>{nombreCompleto}</h3>
        <p>DNI: {socio.dni}</p>
        <p>📞 {socio.telefono || 'Sin teléfono'}</p>
      </div>
      <div className="socio-status-section">
        <span className={`badge badge-${socio.estado}`}>{socio.estado}</span>
        <span className="plan-title">{planNombre}</span>
        <span className="vencimiento-date">Vence {vencimiento}</span>
      </div>
      <div className="socio-arrow">❯</div>
    </div>
  );
}

export default SocioCard;