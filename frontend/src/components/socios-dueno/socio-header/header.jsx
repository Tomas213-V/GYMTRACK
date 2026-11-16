import './header.css';

function SocioHeader({ onOpenModal }) {
  return (
    <div className="socios-header">
      <div>
        <h1>Socios</h1>
        <p>Gestiona y consulta todos los socios de tu gimnasio</p>
      </div>
      <button className="btn-nuevo-socio" onClick={onOpenModal}>
        + Nuevo socio
      </button>
    </div>
  );
}

export default SocioHeader;