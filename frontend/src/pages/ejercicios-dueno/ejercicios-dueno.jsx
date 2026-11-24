import { useState, useEffect, useCallback, useMemo } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import { useGymContext } from '../../context/GymContext';
import {
  getEjerciciosDueno,
  crearEjercicioDueno,
  actualizarEjercicioDueno
} from '../../services/ejercicioService';

import {
  FaDumbbell,
  FaSearch,
  FaBuilding,
  FaPlus,
  FaEdit,
  FaPowerOff,
  FaTimes,
  FaCheck,
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
  const { gimnasioActivo, gimnasioActivoId, contextVersion } = useGymContext();
  const gymIdActual = gimnasioActivoId || null;

  const [ejercicios, setEjercicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [exitoMsg, setExitoMsg] = useState('');

  // Filtros
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activos' | 'inactivos'
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

  // Modal Confirmar Desactivación / Reactivación lógica (estado = false / true)
  const [toggleEstadoTarget, setToggleEstadoTarget] = useState(null);
  const [actualizandoEstado, setActualizandoEstado] = useState(false);

  const loadEjercicios = useCallback(async () => {
    if (!gimnasioActivoId) {
      setEjercicios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getEjerciciosDueno({ id_gimnasio: gimnasioActivoId });
      setEjercicios(data || []);
    } catch (err) {
      setErrorMsg(err.message || 'Error al cargar los ejercicios del gimnasio.');
    } finally {
      setLoading(false);
    }
  }, [gimnasioActivoId]);

  useEffect(() => {
    loadEjercicios();
  }, [loadEjercicios, contextVersion]);

  const totalCount = ejercicios.length;

  const ejerciciosFiltrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return ejercicios.filter((ej) => {
      if (filtroEstado === 'activos' && ej.estado === false) return false;
      if (filtroEstado === 'inactivos' && ej.estado !== false) return false;

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
  }, [ejercicios, filtroGrupo, filtroEstado, searchTerm]);

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
        await actualizarEjercicioDueno(editingItem.id_ejercicio_gimnasio, payload);
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

  const handleConfirmToggleEstado = async () => {
    if (!toggleEstadoTarget) return;
    setActualizandoEstado(true);
    setErrorMsg('');
    try {
      const estaActivo = toggleEstadoTarget.estado !== false;
      const nuevoEstado = !estaActivo;
      await actualizarEjercicioDueno(toggleEstadoTarget.id_ejercicio_gimnasio, {
        estado: nuevoEstado
      });
      const nombre = toggleEstadoTarget.nombre;
      setToggleEstadoTarget(null);
      mostrarExito(
        nuevoEstado
          ? `El ejercicio "${nombre}" fue reactivado en el catálogo.`
          : `El ejercicio "${nombre}" fue desactivado y conservado en el historial.`
      );
      await loadEjercicios();
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo cambiar el estado del ejercicio.');
      setToggleEstadoTarget(null);
    } finally {
      setActualizandoEstado(false);
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
                  <span className="ed-origin-tab-btn gimnasio-tab active" style={{ cursor: 'default' }}>
                    <FaBuilding style={{ fontSize: '10px' }} /> {gimnasioActivo?.nombre || 'Mi Gimnasio'} ({totalCount})
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  className="ed-select-filtro"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activos">Solo activos</option>
                  <option value="inactivos">Inactivos</option>
                </select>

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
                const estaActivo = ej.estado !== false;
                return (
                  <div
                    key={ej.id_ejercicio_gimnasio}
                    className="ed-exercise-card gimnasio"
                    style={estaActivo ? undefined : { opacity: 0.7 }}
                  >
                    <div>
                      <div className="ed-card-header">
                        <span className="ed-card-muscle-pill">{ej.grupo_muscular || 'General'}</span>

                        <span
                          className="ed-origin-badge gimnasio"
                          style={
                            estaActivo
                              ? undefined
                              : {
                                background: 'rgba(239, 68, 68, 0.14)',
                                color: '#fca5a5',
                                borderColor: 'rgba(239, 68, 68, 0.35)'
                              }
                          }
                        >
                          <FaBuilding style={{ fontSize: '10px' }} /> {estaActivo ? 'Activo' : 'Inactivo'}
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
                        <FaBuilding style={{ color: '#a3e635' }} /> Catálogo oficial del gimnasio
                      </span>

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
                          onClick={() => setToggleEstadoTarget(ej)}
                          title={estaActivo ? 'Desactivar ejercicio' : 'Reactivar ejercicio'}
                          style={
                            estaActivo
                              ? undefined
                              : {
                                color: '#86efac',
                                borderColor: 'rgba(34, 197, 94, 0.35)',
                                background: 'rgba(34, 197, 94, 0.12)'
                              }
                          }
                        >
                          <FaPowerOff />
                        </button>
                      </div>
                    </div>
                  </div>
          );
              })}
      </div>
          )}
    </main>
      </div >

    {/* MODAL CREAR / EDITAR EJERCICIO */ }
  {
    showModal && (
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
    )
  }

  {/* MODAL CONFIRMAR DESACTIVACIÓN / REACTIVACIÓN */ }
  {
    toggleEstadoTarget && (
      <div className="ed-modal-overlay" onClick={() => !actualizandoEstado && setToggleEstadoTarget(null)}>
        <div className="ed-modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
          <div className="ed-modal-header">
            <h3>
              <FaPowerOff
                style={{ color: toggleEstadoTarget.estado !== false ? '#f87171' : '#a3e635' }}
              />
              {toggleEstadoTarget.estado !== false ? 'Desactivar Ejercicio' : 'Reactivar Ejercicio'}
            </h3>
            <button
              type="button"
              className="ed-modal-close-btn"
              onClick={() => !actualizandoEstado && setToggleEstadoTarget(null)}
            >
              <FaTimes />
            </button>
          </div>

          <div className="ed-modal-body">
            <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5 }}>
              {toggleEstadoTarget.estado !== false ? (
                <>
                  ¿Querés desactivar el ejercicio{' '}
                  <strong style={{ color: '#ffffff' }}>"{toggleEstadoTarget.nombre}"</strong>?
                  Pasará a estado inactivo para conservar las rutinas históricas y podrás reactivarlo cuando lo necesites.
                </>
              ) : (
                <>
                  ¿Querés reactivar el ejercicio{' '}
                  <strong style={{ color: '#ffffff' }}>"{toggleEstadoTarget.nombre}"</strong>?
                  Volverá a estar disponible para agregarlo en nuevas rutinas del gimnasio.
                </>
              )}
            </p>
          </div>

          <div className="ed-modal-footer">
            <button
              type="button"
              className="ed-btn-cancel"
              disabled={actualizandoEstado}
              onClick={() => setToggleEstadoTarget(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={toggleEstadoTarget.estado !== false ? 'ed-btn-danger' : 'ed-btn-primary'}
              disabled={actualizandoEstado}
              onClick={handleConfirmToggleEstado}
            >
              <FaPowerOff />{' '}
              {actualizandoEstado
                ? 'Procesando...'
                : toggleEstadoTarget.estado !== false
                  ? 'Desactivar'
                  : 'Reactivar'}
            </button>
          </div>
        </div>
      </div>
    )
  }
    </div >
  );
}
