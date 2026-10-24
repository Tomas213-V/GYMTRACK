import './search.css'

function SocioSearch({
  searchValue,
  setSearchValue,
  activeFilter,
  setActiveFilter,
}) {
  const tabs = [
    { id: 'todos', label: 'Todos' },
    { id: 'activo', label: 'Activos' },
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'inactivo', label: 'Inactivos' },
  ]

  return (
    <div className="socios-controls">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por DNI o teléfono..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>

      <div className="filter-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeFilter === tab.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SocioSearch