import React from 'react'
import SocioCard from './card'
import './list.css'


function SocioList({ socios, loading, onSelectSocio }) {
  if (loading) return <div className="loading-state">Cargando socios...</div>;
  if (!socios || socios.length === 0) {
    return <div className="empty-state">No se encontraron socios registrados.</div>;
  }

  return (
    <div className="socios-list-grid">
      {socios.map((socio) => (
        <SocioCard key={socio.id_socio} socio={socio} onClick={onSelectSocio} />
      ))}
    </div>
  );
}

export default SocioList;