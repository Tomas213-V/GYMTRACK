import './resumen.css';

function SociosResumen({ stats }) {
  return (
    <div className="socios-resumen-grid">
      <div className="resumen-card">
        <span className="card-icon">👤</span>
        <div className="card-value">{stats.total}</div>
        <div className="card-label">Total socios</div>
      </div>
      <div className="resumen-card">
        <span className="card-icon active">✔</span>
        <div className="card-value">{stats.activos}</div>
        <div className="card-label">Activos</div>
      </div>
      <div className="resumen-card">
        <span className="card-icon pending">🕒</span>
        <div className="card-value">{stats.pendientes}</div>
        <div className="card-label">Pendientes</div>
      </div>
      <div className="resumen-card">
        <span className="card-icon inactive">✖</span>
        <div className="card-value">{stats.inactivos}</div>
        <div className="card-label">Inactivos</div>
      </div>
    </div>
  );
}

export default SociosResumen;