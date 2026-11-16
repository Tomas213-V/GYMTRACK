import { useState, useEffect, useCallback, useMemo } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import {
  getEjerciciosDueno,
  crearEjercicioDueno,
  actualizarEjercicioDueno,
  eliminarEjercicioDueno
} from '../../services/ejercicioService';

import {
  FaDumbbell,
  FaSearch,
  FaBuilding,
  FaGlobe,
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaTimes,
  FaCheck,
  FaLayerGroup,
  FaExclamationTriangle
} from 'react-icons/fa';

import './ejercicios-dueno.css';

const GRUPOS_MUSCULARES = [
  'Pecho',
  'Espalda',
  'Piernas',
  'Brazos',
  'Hombros',
  'Abdomen',
  'Cardio',
  'Cuerpo Completo'
];

export default function EjerciciosDueno() {
  const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || 'null');
  const gymIdActual = usuarioLocal?.id_gimnasio || usuarioLocal?.gimnasio?.id_gimnasio || null;

  const [ejercicios, setEjercicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [exitoMsg, setExitoMsg] = useState('');

  // Filtros
  const [filtroOrigen, setFiltroOrigen] = useState('todos'); // 'todos' | 'gimnasio' | 'base'
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Crear / Editar Ejercicio del Gimnasio
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    grupo_muscular: 'Pecho',
    dificultad: 'Intermedia',
    descripcion: ''
  });

  // Modal Confirmar Eliminación
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const loadEjercicios = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getEjerciciosDueno();
      setEjercicios(data || []);
    } catch (err) {
      setErrorMsg(err.message || 'Error al cargar los ejercicios del gimnasio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEjercicios();
  }, [loadEjercicios]);

  // Métricas reales del catálogo
  const totalCount = ejercicios.length;
  const gymOwnCount = useMemo(
    () => ejercicios.filter((ej) => Boolean(ej.id_gimnasio)).length,
    [ejercicios]
  );
  const baseCount = useMemo(
    () => ejercicios.filter((ej) => !ej.id_gimnasio).length,
    [ejercicios]
  );

  // Filtrado combinado en cliente para mantener métricas estables y búsqueda instantánea
  const ejerciciosFiltrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return ejercicios.filter((ej) => {
      if (filtroOrigen === 'gimnasio' && !ej.id_gimnasio) return false;
      if (filtroOrigen === 'base' && ej.id_gimnasio) return false;

      if (filtroGrupo !== 'todos') {
        const gm = (ej.grupo_muscular || '').toLowerCase();
        if (!gm.includes(filtroGrupo.toLowerCase())) return false;
      }

      if (q) {
        const nombre = (ej.nombre || '').toLowerCase();
        const desc = (ej.descripcion || '').toLowerCase();
        const grupo = (ej.grupo_muscular || '').toLowerCase();
        if (!nombre.includes(q) && !desc.includes(q) && !grupo.includes(q)) return false;
      }

      return true;
    });
  }, [ejercicios, filtroOrigen, filtroGrupo, searchTerm]);

  const mostrarExito = (msg) => {
    setExitoMsg(msg);
    setTimeout(() => setExitoMsg(''), 4000);
  };

  const handleOpenCrear = () => {
    setEditingItem(null);
    setModalError('');
    setFormData({
      nombre: '',
      grupo_muscular: 'Pecho',
      dificultad: 'Intermedia',
      descripcion: ''
    });
    setShowModal(true);
  };

  const handleOpenEditar = (item) => {
    setEditingItem(item);
    setModalError('');
    setFormData({
      nombre: item.nombre || '',
      grupo_muscular: item.grupo_muscular || 'Pecho',
      dificultad: item.dificultad || 'Intermedia',
      descripcion: item.descripcion && item.descripcion !== 'Sin descripción técnica disponible'
        ? item.descripcion
        : ''
    });
    setShowModal(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      setModalError('El nombre del ejercicio es obligatorio.');
      return;
    }

    setGuardando(true);
    setModalError('');
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        grupo_muscular: formData.grupo_muscular,
        dificultad: formData.dificultad,
        descripcion: formData.descripcion.trim() || null
      };

      if (editingItem) {
        await actualizarEjercicioDueno(editingItem.id_ejercicio, payload);
        mostrarExito(`Ejercicio "${payload.nombre}" actualizado con éxito.`);
      } else {
        await crearEjercicioDueno({
          ...payload,
          ...(gymIdActual ? { id_gimnasio: Number(gymIdActual) } : {})
        });
        mostrarExito(`Ejercicio "${payload.nombre}" agregado al catálogo del gimnasio.`);
      }

      setShowModal(false);
      await loadEjercicios();
    } catch (err) {
      setModalError(err.message || 'Error al guardar el ejercicio.');
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setEliminando(true);
    setErrorMsg('');
    try {
      await eliminarEjercicioDueno(deleteTarget.id_ejercicio);
      const nombre = deleteTarget.nombre;
      setDeleteTarget(null);
      mostrarExito(`El ejercicio "${nombre}" fue eliminado del catálogo.`);
      await loadEjercicios();
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo eliminar el ejercicio.');
      setDeleteTarget(null);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="ed-layout">
      <NavGlobal />

      <div className="ed-body">
        <Sidebar />

        <main className="ed-main-content">
          {/* HEADER */}
          <section className="ed-header-section">
            <div className="ed-header-topbar">
              <div className="ed-title-container">
                <div className="ed-title-icon-badge">
                  <FaDumbbell />
                </div>
                <div className="ed-title-texts">
                  <h1>Catálogo de Ejercicios</h1>
                  <p>Administrá los ejercicios oficiales de tu gimnasio disponibles para las rutinas de tus socios</p>
                </div>
              </div>

              <button type="button" className="ed-btn-primary" onClick={handleOpenCrear}>
                <FaPlus /> Nuevo Ejercicio
              </button>
            </div>

            {exitoMsg && (
              <div className="ed-alert ed-alert-success">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaCheck /> {exitoMsg}
                </span>
                <button type="button" className="ed-alert-close" onClick={() => setExitoMsg('')} aria-label="Cerrar">
                  <FaTimes />
                </button>
              </div>
            )}

            {errorMsg && !loading && (
              <div className="ed-alert ed-alert-error">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaExclamationTriangle /> {errorMsg}
                </span>
                <button type="button" className="ed-alert-close" onClick={() => setErrorMsg('')} aria-label="Cerrar">
                  <FaTimes />
                </button>
              </div>
            )}

            {/* MÉTRICAS */}
            <div className="ed-stats-grid">



            </div>

            {/* FILTROS Y BÚSQUEDA */}
            <div className="ed-filters-bar">
              <div className="ed-filters-left">
                <div className="ed-search-input-box">
                  <FaSearch style={{ color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, músculo o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="ed-origin-tabs">
                  <button
                    type="button"
                    className={`ed-origin-tab-btn ${filtroOrigen === 'todos' ? 'active' : ''}`}
                    onClick={() => setFiltroOrigen('todos')}
                  >
                    Todos ({totalCount})
                  </button>
                  <button
                    type="button"
                    className={`ed-origin-tab-btn gimnasio-tab ${filtroOrigen === 'gimnasio' ? 'active' : ''}`}
                    onClick={() => setFiltroOrigen('gimnasio')}
                  >
                    <FaBuilding style={{ fontSize: '10px' }} /> Mi Gimnasio ({gymOwnCount})
                  </button>
                  <button
                    type="button"
                    className={`ed-origin-tab-btn base-tab ${filtroOrigen === 'base' ? 'active' : ''}`}
                    onClick={() => setFiltroOrigen('base')}
                  >
                    <FaGlobe style={{ fontSize: '10px' }} /> Base ({baseCount})
                  </button>
                </div>
              </div>

              <select
                className="ed-select-filtro"
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
              >
                <option value="todos">Todos los músculos</option>
                {GRUPOS_MUSCULARES.map((grupo) => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* LISTADO DE EJERCICIOS */}
          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>
              Cargando catálogo de ejercicios...
            </p>
          ) : ejerciciosFiltrados.length === 0 ? (
            <div className="ed-empty-state">
              <FaDumbbell className="ed-empty-icon" />
              <h3>No se encontraron ejercicios</h3>
              <p>
                {ejercicios.length === 0
                  ? 'Todavía no hay ejercicios cargados en tu gimnasio. Creá el primero para usar en las rutinas.'
                  : 'Probá ajustando los términos de búsqueda o los filtros aplicados.'}
              </p>
              <button type="button" className="ed-btn-primary" onClick={handleOpenCrear}>
                <FaPlus /> Crear Ejercicio del Gimnasio
              </button>
            </div>
          ) : (
            <div className="ed-exercises-grid">
              {ejerciciosFiltrados.map((ej) => {
                const esDelGimnasio = Boolean(ej.id_gimnasio);

                return (
                  <div
                    key={ej.id_ejercicio}
                    className={`ed-exercise-card ${esDelGimnasio ? 'gimnasio' : 'base'}`}
                  >
                    <div>
                      <div className="ed-card-header">
                        <span className="ed-card-muscle-pill">{ej.grupo_muscular || 'General'}</span>

                        <span className={`ed-origin-badge ${esDelGimnasio ? 'gimnasio' : 'base'}`}>
                          {esDelGimnasio ? (
                            <>
                              <FaBuilding style={{ fontSize: '10px' }} /> Mi Gimnasio
                            </>
                          ) : (
                            <>
                              <FaGlobe style={{ fontSize: '10px' }} /> Base
                            </>
                          )}
                        </span>
                      </div>

                      <div className="ed-card-body">
                        <h4 className="ed-card-title">{ej.nombre}</h4>
                        <p className="ed-card-desc">
                          {ej.descripcion || 'Sin descripción técnica registrada.'}
                        </p>

                        <div className="ed-card-meta-row">
                          <span className="ed-diff-badge">
                            Dificultad: {ej.dificultad || 'Intermedia'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="ed-card-footer">
                      <span className="ed-card-owner-text">
                        {esDelGimnasio ? (
                          <>
                            <FaBuilding style={{ color: '#a3e635' }} /> Asignado a tu gimnasio
                          </>
                        ) : (
                          <>
                            <FaGlobe style={{ color: '#60a5fa' }} /> Ejercicio base del sistema
                          </>
                        )}
                      </span>

                      {esDelGimnasio ? (
                        <div className="ed-card-actions">
                          <button
                            type="button"
                            className="ed-btn-icon-edit"
                            onClick={() => handleOpenEditar(ej)}
                            title="Editar ejercicio"
                          >
                            <FaEdit />
                          </button>
                          <button
                            type="button"
                            className="ed-btn-icon-delete"
                            onClick={() => setDeleteTarget(ej)}
                            title="Eliminar ejercicio"
                          >
                            <FaTrashAlt />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                          Global
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* MODAL CREAR / EDITAR EJERCICIO */}
      {showModal && (
        <div className="ed-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ed-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ed-modal-header">
              <h3>
                <FaBuilding style={{ color: '#a3e635' }} />
                {editingItem ? 'Editar Ejercicio del Gimnasio' : 'Nuevo Ejercicio del Gimnasio'}
              </h3>
              <button type="button" className="ed-modal-close-btn" onClick={() => setShowModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className="ed-modal-body">
                {modalError && (
                  <div className="ed-alert ed-alert-error" style={{ marginBottom: 0 }}>
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="ed-form-field">
                  <label>Nombre del Ejercicio *</label>
                  <input
                    type="text"
                    className="ed-form-input"
                    placeholder="Ej: Press de banca con barra"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="ed-form-grid-2">
                  <div className="ed-form-field">
                    <label>Grupo Muscular</label>
                    <select
                      className="ed-form-select"
                      value={formData.grupo_muscular}
                      onChange={(e) => setFormData({ ...formData, grupo_muscular: e.target.value })}
                    >
                      {GRUPOS_MUSCULARES.map((grupo) => (
                        <option key={grupo} value={grupo}>
                          {grupo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ed-form-field">
                    <label>Dificultad</label>
                    <select
                      className="ed-form-select"
                      value={formData.dificultad}
                      onChange={(e) => setFormData({ ...formData, dificultad: e.target.value })}
                    >
                      <option value="Principiante">Principiante</option>
                      <option value="Intermedia">Intermedia</option>
                      <option value="Avanzada">Avanzada</option>
                    </select>
                  </div>
                </div>

                <div className="ed-form-field">
                  <label>Descripción / Instrucciones Técnicas (Opcional)</label>
                  <textarea
                    rows="3"
                    className="ed-form-textarea"
                    placeholder="Detalles sobre técnica, postura, rango de movimiento o variantes..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>
              </div>

              <div className="ed-modal-footer">
                <button type="button" className="ed-btn-cancel" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="ed-btn-primary" disabled={guardando}>
                  <FaCheck /> {guardando ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Crear Ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {deleteTarget && (
        <div className="ed-modal-overlay" onClick={() => !eliminando && setDeleteTarget(null)}>
          <div className="ed-modal-card" style={{ maxWidth: '430px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ed-modal-header">
              <h3>
                <FaExclamationTriangle style={{ color: '#f87171' }} />
                Eliminar Ejercicio
              </h3>
              <button
                type="button"
                className="ed-modal-close-btn"
                onClick={() => !eliminando && setDeleteTarget(null)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="ed-modal-body">
              <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5 }}>
                ¿Estás seguro de que querés eliminar el ejercicio{' '}
                <strong style={{ color: '#ffffff' }}>"{deleteTarget.nombre}"</strong>?
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="ed-modal-footer">
              <button
                type="button"
                className="ed-btn-cancel"
                disabled={eliminando}
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ed-btn-danger"
                disabled={eliminando}
                onClick={handleConfirmDelete}
              >
                <FaTrashAlt /> {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
