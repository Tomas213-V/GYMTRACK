
/**
 * =========================================================================================
 * ARCHIVO: content.jsx
 * RUTA: frontend/src/components/socios-dueno/socio-content/content.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Controlador central de la interfaz de Socios (listado, filtros, modales y paginación).
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 1. PASO 1 (Estados Reactivos):
 *    - `socios`: Listado de socios recuperados de la API para la página actual.
 *    - `search` y `estado`: Criterios de filtrado reactivo (búsqueda por texto y filtro por activo/pendiente/inactivo).
 *    - `page`, `totalPages`, `totalSocios`: Control de navegación paginada (límite de 6 por página).
 * 2. PASO 2 (Modales):
 *    - `showCreateModal`: Abre `<SocioModal />` para registrar un nuevo alumno.
 *    - `showDetailModal`: Abre `<SocioDetalleModal />` para ver ficha médica, pagos y editar o dar de baja.
 * 3. PASO 3 (Sincronización con el Servidor):
 *    - `loadSocios()`: Función memoizada con `useCallback` que invoca `fetchSocios` y actualiza la lista.
 */

import { useState, useEffect, useCallback } from 'react'
import { useGymContext } from '../../../context/GymContext'
import { fetchSocios } from '../../../services/socioService'
import SocioHeader from '../socio-header/header'
import SocioResumen from '../socio-resumen/resumen'
import SocioSearch from '../socio-search-filter/search'
import SocioList from '../socio-card/list'
import SocioModal from '../socio-modal/modal'
import SocioDetalleModal from '../socio-detalle-modal/detalle-modal'
import './content.css'

function SociosContent() {
  const { gimnasioActivoId, contextVersion } = useGymContext()
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('todos')

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalSocios, setTotalSocios] = useState(0)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSocio, setSelectedSocio] = useState(null)

  const gymId = gimnasioActivoId || null

  const loadSocios = useCallback(async () => {
    if (!gimnasioActivoId) {
      setSocios([])
      setTotalSocios(0)
      setTotalPages(1)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const response = await fetchSocios({ page, limit: 6, estado, search })
      setSocios(response.socios || [])
      setTotalPages(response.totalPages || 1)
      setTotalSocios(response.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [gimnasioActivoId, page, estado, search])

  useEffect(() => {
    setPage(1)
  }, [gimnasioActivoId])

  useEffect(() => {
    loadSocios()
  }, [loadSocios, contextVersion])

  const handleOpenCreateModal = () => {
    setShowCreateModal(true)
  }

  const handleOpenDetailModal = (socio) => {
    setSelectedSocio(socio)
    setShowDetailModal(true)
  }

  const handleEliminarSocio = async () => {
    setShowDetailModal(false)
    setSelectedSocio(null)
    await loadSocios()
  }

  const handleActualizarSocio = async () => {
    await loadSocios()
  }

  return (
    <div className="socios-content">
      <SocioHeader onOpenModal={handleOpenCreateModal} />

      <SocioResumen
        stats={{
          total: totalSocios,
          activos: socios.filter((s) => s.estado === true || s.estado === 'activo').length,
          pendientes: socios.filter((s) => s.estado === 'pendiente').length,
          inactivos: socios.filter((s) => s.estado === false || s.estado === 'inactivo').length,
        }}
      />

      <SocioSearch
        searchValue={search}
        setSearchValue={setSearch}
        activeFilter={estado}
        setActiveFilter={(val) => {
          setEstado(val)
          setPage(1)
        }}
      />

      {error && <div className="error-banner">{error}</div>}

      <SocioList
        socios={socios}
        loading={loading}
        onSelectSocio={handleOpenDetailModal}
      />

      {/* Paginador */}
      <div className="pagination-container">
        <span>
          Mostrando página {page} de {totalPages} ({totalSocios} socios en total)
        </span>
        <div className="pagination-buttons">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <button
            disabled={page === totalPages || totalPages === 0}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modal Registrar Nuevo Socio */}
      {showCreateModal && (
        <SocioModal
          gymId={gymId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadSocios()
          }}
        />
      )}

      {/* Modal Detalle Completo, Edición y Eliminación */}
      <SocioDetalleModal
        abierto={showDetailModal}
        socio={selectedSocio}
        gymId={gymId}
        onCerrar={() => {
          setShowDetailModal(false)
          setSelectedSocio(null)
        }}
        onEliminarSocio={handleEliminarSocio}
        onActualizarSocio={handleActualizarSocio}
      />
    </div>
  )
}

export default SociosContent