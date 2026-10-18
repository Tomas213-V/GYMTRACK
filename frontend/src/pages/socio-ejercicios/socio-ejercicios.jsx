import { useState, useEffect, useCallback } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import SidebarSocio from '../../components/sidebar-socio/sidebar-socio';
import {
  getEjerciciosSocio,
  crearEjercicioSocio,
  actualizarEjercicioSocio,
  eliminarEjercicioSocio
} from '../../services/socioEjercicioService';

import {
  FaDumbbell,
  FaSearch,
  FaUser,
  FaBuilding,
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaTimes,
  FaCheck,
  FaStar,
  FaLayerGroup
} from 'react-icons/fa';

import './socio-ejercicios.css';

export default function SocioEjercicios() {
  const [ejercicios, setEjercicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [exitoMsg, setExitoMsg] = useState('');

  // Filtros
  const [filtroOrigen, setFiltroOrigen] = useState('todos'); // 'todos' | 'gimnasio' | 'propio'
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Crear / Editar Ejercicio Propio
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    grupo_muscular: 'Pecho',
    dificultad: 'Intermedia',
    descripcion: ''
  });

  // Cargar ejercicios del socio (Gimnasio + Propios)
  const loadEjercicios = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getEjerciciosSocio({
        origen: filtroOrigen,
        grupo_muscular: filtroGrupo,
        search: searchTerm
      });
      setEjercicios(data || []);
    } catch (err) {
      setErrorMsg(err.message || 'Error al cargar los ejercicios.');
    } finally {
      setLoading(false);
    }
  }, [filtroOrigen, filtroGrupo, searchTerm]);

  useEffect(() => {
    loadEjercicios();
  }, [loadEjercicios]);

  // Contadores para las tarjetas de métricas
  const totalCount = ejercicios.length;
  const gymCount = ejercicios.filter((e) => !e.es_propio).length;
  const propiosCount = ejercicios.filter((e) => e.es_propio).length;

  // Abrir modal de creación
  const handleOpenCrear = () => {
    setEditingItem(null);
    setFormData({
      nombre: '',
      grupo_muscular: 'Pecho',
      dificultad: 'Intermedia',
      descripcion: ''
    });
    setShowModal(true);
  };

  // Abrir modal de edición
  const handleOpenEditar = (item) => {
    setEditingItem(item);
    setFormData({
      nombre: item.nombre || '',
      grupo_muscular: item.grupo_muscular || 'Pecho',
      dificultad: item.dificultad || 'Intermedia',
      descripcion: item.descripcion && item.descripcion !== 'Sin descripción técnica disponible' ? item.descripcion : ''
    });
    setShowModal(true);
  };

  // Guardar (Crear o Editar)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      alert('El nombre del ejercicio es obligatorio.');
      return;
    }

    setGuardando(true);
    try {
      if (editingItem) {
        await actualizarEjercicioSocio(editingItem.id_ejercicio, formData);
        setExitoMsg('¡Ejercicio personalizado actualizado con éxito!');
      } else {
        await crearEjercicioSocio(formData);
        setExitoMsg('¡Ejercicio personalizado creado con éxito!');
      }
      setShowModal(false);
      await loadEjercicios();
      setTimeout(() => setExitoMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Error al procesar el ejercicio.');
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar ejercicio propio
  const handleDelete = async (item) => {
    if (!window.confirm(`¿Estás seguro de que deseás eliminar tu ejercicio "${item.nombre}"?`)) {
      return;
    }

    try {
      await eliminarEjercicioSocio(item.id_ejercicio);
      setExitoMsg(`El ejercicio "${item.nombre}" ha sido eliminado.`);
      await loadEjercicios();
      setTimeout(() => setExitoMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Error al eliminar el ejercicio.');
    }
  };

  return (
    <div className="se-layout">
      <NavGlobal />

      <div className="se-body">
        <SidebarSocio />

        <main className="se-main-content">
          {/* HEADER */}
          <section className="se-header-section">
            <div className="se-header-topbar">
              <div className="se-title-container">
                <div className="se-title-icon-badge">
                  <FaDumbbell />
                </div>
                <div className="se-title-texts">
                  <h1>Biblioteca de Ejercicios</h1>
                  <p>Consultá los ejercicios oficiales de tu gimnasio y gestioná tus ejercicios personalizados</p>
                </div>
              </div>

              <button type="button" className="se-btn-primary" onClick={handleOpenCrear}>
                <FaPlus /> Crear mi ejercicio
              </button>
            </div>

            {/* Notificación de éxito */}
            {exitoMsg && (
              <div
                style={{
                  background: 'rgba(163, 230, 53, 0.15)',
                  border: '1px solid rgba(163, 230, 53, 0.4)',
                  color: '#bef264',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginBottom: '18px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <FaCheck /> {exitoMsg}
              </div>
            )}

            {/* METRICS / STATS */}
            <div className="se-stats-grid">
              <div className="se-stat-card">
                <div className="se-stat-icon-wrap total">
                  <FaLayerGroup />
                </div>
                <div className="se-stat-info">
                  <h3>{totalCount}</h3>
                  <p>Ejercicios disponibles</p>
                </div>
              </div>

              <div className="se-stat-card">
                <div className="se-stat-icon-wrap gimnasio">
                  <FaBuilding />
                </div>
                <div className="se-stat-info">
                  <h3>{gymCount}</h3>
                  <p>Ejercicios del Gimnasio</p>
                </div>
              </div>

              <div className="se-stat-card">
                <div className="se-stat-icon-wrap propio">
                  <FaStar />
                </div>
                <div className="se-stat-info">
                  <h3>{propiosCount}</h3>
                  <p>Mis Ejercicios Creados</p>
                </div>
              </div>
            </div>

            {/* FILTROS Y BÚSQUEDA */}
            <div className="se-filters-bar">
              <div className="se-filters-left">
                {/* Buscador */}
                <div className="se-search-input-box">
                  <FaSearch style={{ color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Pestañas de origen */}
                <div className="se-origin-tabs">
                  <button
                    type="button"
                    className={`se-origin-tab-btn ${filtroOrigen === 'todos' ? 'active' : ''}`}
                    onClick={() => setFiltroOrigen('todos')}
                  >
                    Todos ({totalCount})
                  </button>
                  <button
                    type="button"
                    className={`se-origin-tab-btn gimnasio-tab ${filtroOrigen === 'gimnasio' ? 'active' : ''}`}
                    onClick={() => setFiltroOrigen('gimnasio')}
                  >
                    <FaBuilding style={{ fontSize: '10px' }} /> Gimnasio ({gymCount})
                  </button>
                  <button
                    type="button"
                    className={`se-origin-tab-btn propio-tab ${filtroOrigen === 'propio' ? 'active' : ''}`}
                    onClick={() => setFiltroOrigen('propio')}
                  >
                    <FaUser style={{ fontSize: '10px' }} /> Mis ejercicios ({propiosCount})
                  </button>
                </div>
              </div>

              {/* Selector de grupo muscular */}
              <select
                className="se-select-filtro"
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
              >
                <option value="todos">Todos los músculos</option>
                <option value="Pecho">Pecho</option>
                <option value="Espalda">Espalda</option>
                <option value="Piernas">Piernas</option>
                <option value="Brazos">Brazos</option>
                <option value="Hombros">Hombros</option>
                <option value="Abdomen">Abdomen</option>
                <option value="Cardio">Cardio</option>
                <option value="Cuerpo Completo">Cuerpo Completo</option>
              </select>
            </div>
          </section>

          {/* LISTADO DE EJERCICIOS */}
          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>
              Cargando ejercicios...
            </p>
          ) : errorMsg ? (
            <div style={{ color: '#ef4444', textAlign: 'center', padding: '30px 0' }}>
              <p>{errorMsg}</p>
              <button type="button" className="se-btn-primary" style={{ margin: '0 auto' }} onClick={loadEjercicios}>
                Reintentar
              </button>
            </div>
          ) : ejercicios.length === 0 ? (
            <div
              style={{
                backgroundColor: '#14171b',
                border: '1px solid #23272f',
                borderRadius: '14px',
                padding: '60px 20px',
                textAlign: 'center',
                color: '#64748b'
              }}
            >
              <FaDumbbell style={{ fontSize: '46px', marginBottom: '14px', opacity: 0.3 }} />
              <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>No se encontraron ejercicios</h3>
              <p style={{ margin: '0 0 16px 0' }}>
                {filtroOrigen === 'propio'
                  ? 'Aún no has creado ningún ejercicio personalizado. ¡Animate a crear el primero!'
                  : 'Probá ajustando los términos de búsqueda o los filtros de grupo muscular.'}
              </p>
              {filtroOrigen === 'propio' && (
                <button type="button" className="se-btn-primary" style={{ margin: '0 auto' }} onClick={handleOpenCrear}>
                  <FaPlus /> Crear mi primer ejercicio
                </button>
              )}
            </div>
          ) : (
            <div className="se-exercises-grid">
              {ejercicios.map((ej) => {
                const esPropio = ej.es_propio;

                return (
                  <div key={ej.id_ejercicio} className={`se-exercise-card ${esPropio ? 'propio' : 'gimnasio'}`}>
                    <div>
                      <div className="se-card-header">
                        <span className="se-card-muscle-pill">{ej.grupo_muscular}</span>

                        <span className={`se-origin-badge ${esPropio ? 'propio' : 'gimnasio'}`}>
                          {esPropio ? <FaUser style={{ fontSize: '10px' }} /> : <FaBuilding style={{ fontSize: '10px' }} />}
                          {esPropio ? 'Mi ejercicio' : 'Gimnasio'}
                        </span>
                      </div>

                      <div className="se-card-body">
                        <h4 className="se-card-title">{ej.nombre}</h4>
                        <p className="se-card-desc">{ej.descripcion}</p>

                        <div className="se-card-meta-row">
                          <span className="se-diff-badge">Dificultad: {ej.dificultad}</span>
                        </div>
                      </div>
                    </div>

                    <div className="se-card-footer">
                      <span className="se-card-owner-text">
                        {esPropio ? (
                          <>
                            <FaStar style={{ color: '#a3e635' }} /> Creado por vos
                          </>
                        ) : (
                          <>
                            <FaBuilding style={{ color: '#60a5fa' }} /> Proveído por el gimnasio
                          </>
                        )}
                      </span>

                      {esPropio ? (
                        <div className="se-card-actions">
                          <button
                            type="button"
                            className="se-btn-icon-edit"
                            onClick={() => handleOpenEditar(ej)}
                            title="Editar mi ejercicio"
                          >
                            <FaEdit />
                          </button>
                          <button
                            type="button"
                            className="se-btn-icon-delete"
                            onClick={() => handleDelete(ej)}
                            title="Eliminar mi ejercicio"
                          >
                            <FaTrashAlt />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                          Oficial
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

      {/* MODAL: CREAR / EDITAR EJERCICIO PROPIO */}
      {showModal && (
        <div className="se-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="se-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="se-modal-header">
              <h3>
                <FaUser style={{ color: '#a3e635' }} />
                {editingItem ? 'Editar Mi Ejercicio' : 'Crear Ejercicio Propio'}
              </h3>
              <button type="button" className="se-modal-close-btn" onClick={() => setShowModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className="se-modal-body">
                <div className="se-form-field">
                  <label>Nombre del Ejercicio *</label>
                  <input
                    type="text"
                    className="se-form-input"
                    placeholder="Ej: Curl martillo en polea baja"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="se-form-grid-2">
                  <div className="se-form-field">
                    <label>Grupo Muscular</label>
                    <select
                      className="se-form-select"
                      value={formData.grupo_muscular}
                      onChange={(e) => setFormData({ ...formData, grupo_muscular: e.target.value })}
                    >
                      <option value="Pecho">Pecho</option>
                      <option value="Espalda">Espalda</option>
                      <option value="Piernas">Piernas</option>
                      <option value="Brazos">Brazos</option>
                      <option value="Hombros">Hombros</option>
                      <option value="Abdomen">Abdomen</option>
                      <option value="Cardio">Cardio</option>
                      <option value="Cuerpo Completo">Cuerpo Completo</option>
                    </select>
                  </div>

                  <div className="se-form-field">
                    <label>Dificultad</label>
                    <select
                      className="se-form-select"
                      value={formData.dificultad}
                      onChange={(e) => setFormData({ ...formData, dificultad: e.target.value })}
                    >
                      <option value="Principiante">Principiante</option>
                      <option value="Intermedia">Intermedia</option>
                      <option value="Avanzada">Avanzada</option>
                    </select>
                  </div>
                </div>

                <div className="se-form-field">
                  <label>Descripción / Instrucciones Técnicas (Opcional)</label>
                  <textarea
                    rows="3"
                    className="se-form-textarea"
                    placeholder="Detalles sobre agarre, postura o variantes para realizar el ejercicio..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>
              </div>

              <div className="se-modal-footer">
                <button type="button" className="se-btn-cancel" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="se-btn-primary" disabled={guardando}>
                  <FaCheck /> {guardando ? 'Guardando...' : (editingItem ? 'Guardar Cambios' : 'Crear Ejercicio')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
