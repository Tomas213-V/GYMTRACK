// ==============================================================================
// GESTIÓN DE SUCURSALES (CRUD COMPLETO POR GIMNASIO ACTIVO)
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import { useGymContext } from '../../context/GymContext';
import {
  getSucursales,
  createSucursal,
  updateSucursal,
  cambiarEstadoSucursal
} from '../../services/sucursalService';
import {
  FaMapMarkerAlt,
  FaPhone,
  FaPlus,
  FaEdit,
  FaBan,
  FaCheck,
  FaTimes,
  FaBuilding,
  FaSyncAlt
} from 'react-icons/fa';
import './sucursales.css';

export default function SucursalesDueno() {
  const { gimnasioActivo, gimnasioActivoId, esDueno, esAdministrador, hasPermission, contextVersion } = useGymContext();
  const puedeGestionarSucursales = esDueno || esAdministrador || hasPermission('gestionar_sucursales');

  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [exitoMsg, setExitoMsg] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState({
    direccion: '',
    telefono: '',
    descripcion: '',
    estado: true
  });

  const mostrarExito = (msg) => {
    setExitoMsg(msg);
    setTimeout(() => setExitoMsg(''), 4000);
  };

  const cargarSucursales = useCallback(async (signal) => {
    if (!gimnasioActivoId) {
      setSucursales([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await getSucursales({ estado: filtroEstado, signal });
      setSucursales(data || []);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setErrorMsg(err.message || 'Error al cargar las sucursales.');
      setSucursales([]);
    } finally {
      setLoading(false);
    }
  }, [gimnasioActivoId, filtroEstado]);

  useEffect(() => {
    const controller = new AbortController();
    cargarSucursales(controller.signal);
    return () => controller.abort();
  }, [cargarSucursales, contextVersion]);

  const abrirCrear = () => {
    setEditando(null);
    setFormData({ direccion: '', telefono: '', descripcion: '', estado: true });
    setModalAbierto(true);
  };

  const abrirEditar = (suc) => {
    setEditando(suc);
    setFormData({
      direccion: suc.direccion || '',
      telefono: suc.telefono || '',
      descripcion: suc.descripcion || '',
      estado: suc.estado !== false
    });
    setModalAbierto(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!formData.direccion.trim()) {
      setErrorMsg('La dirección de la sucursal es obligatoria.');
      return;
    }

    try {
      setGuardando(true);
      setErrorMsg('');
      if (editando) {
        await updateSucursal(editando.id_sucursal, formData);
        mostrarExito('Sucursal actualizada correctamente.');
      } else {
        await createSucursal(formData);
        mostrarExito('Sucursal creada exitosamente.');
      }
      setModalAbierto(false);
      await cargarSucursales();
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo guardar la sucursal.');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleEstado = async (suc) => {
    const nuevoEstado = !suc.estado;
    if (!nuevoEstado && !window.confirm(`¿Deseás desactivar la sucursal "${suc.direccion}"? Se conservará el historial de asistencias.`)) {
      return;
    }
    try {
      setErrorMsg('');
      await cambiarEstadoSucursal(suc.id_sucursal, nuevoEstado);
      mostrarExito(`Sucursal ${nuevoEstado ? 'activada' : 'desactivada'} correctamente.`);
      await cargarSucursales();
    } catch (err) {
      setErrorMsg(err.message || 'Error al cambiar el estado de la sucursal.');
    }
  };

  const activasCount = sucursales.filter((s) => s.estado).length;

  return (
    <div className="suc-layout">
      <NavGlobal />
      <div className="suc-body">
        <Sidebar />
        <main className="suc-main">
          <section className="suc-header">
            <div>
              <div className="suc-badge">
                <FaBuilding /> {gimnasioActivo?.nombre || 'Gimnasio Activo'}
              </div>
              <h1>Gestión de Sucursales</h1>
              <p>Administrá las sedes de tu gimnasio. Las membresías del gimnasio habilitan el acceso a todas sus sucursales activas.</p>
            </div>

            <div className="suc-header-actions">
              <button type="button" className="suc-btn-outline" onClick={() => cargarSucursales()} title="Recargar">
                <FaSyncAlt />
              </button>
              {puedeGestionarSucursales && (
                <button type="button" className="suc-btn-primary" onClick={abrirCrear}>
                  <FaPlus /> Nueva Sucursal
                </button>
              )}
            </div>
          </section>

          {exitoMsg && (
            <div className="suc-alert suc-alert-success">
              <span><FaCheck /> {exitoMsg}</span>
              <button type="button" onClick={() => setExitoMsg('')}><FaTimes /></button>
            </div>
          )}

          {errorMsg && (
            <div className="suc-alert suc-alert-error">
              <span>{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg('')}><FaTimes /></button>
            </div>
          )}

          <div className="suc-toolbar">
            <div className="suc-pills">
              <button
                type="button"
                className={filtroEstado === 'todos' ? 'active' : ''}
                onClick={() => setFiltroEstado('todos')}
              >
                Todas ({sucursales.length})
              </button>
              <button
                type="button"
                className={filtroEstado === 'true' ? 'active' : ''}
                onClick={() => setFiltroEstado('true')}
              >
                Activas ({activasCount})
              </button>
              <button
                type="button"
                className={filtroEstado === 'false' ? 'active' : ''}
                onClick={() => setFiltroEstado('false')}
              >
                Inactivas ({sucursales.length - activasCount})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="suc-empty">Cargando sucursales...</div>
          ) : sucursales.length === 0 ? (
            <div className="suc-empty">
              <FaMapMarkerAlt className="suc-empty-icon" />
              <h3>No hay sucursales registradas</h3>
              <p>Creá al menos una sucursal activa para que los socios puedan registrar sus asistencias.</p>
              {puedeGestionarSucursales && (
                <button type="button" className="suc-btn-primary" onClick={abrirCrear}>
                  <FaPlus /> Crear Primera Sucursal
                </button>
              )}
            </div>
          ) : (
            <div className="suc-grid">
              {sucursales.map((suc) => (
                <div key={suc.id_sucursal} className={`suc-card ${suc.estado ? '' : 'inactiva'}`}>
                  <div className="suc-card-top">
                    <div className="suc-card-icon">
                      <FaMapMarkerAlt />
                    </div>
                    <span className={`suc-status ${suc.estado ? 'activa' : 'inactiva'}`}>
                      {suc.estado ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <h3>{suc.direccion}</h3>
                  <p className="suc-desc">{suc.descripcion || 'Sin descripción adicional.'}</p>

                  <div className="suc-meta">
                    <span><FaPhone /> {suc.telefono || 'Sin teléfono'}</span>
                    <span>ID #{suc.id_sucursal}</span>
                  </div>

                  {puedeGestionarSucursales && (
                    <div className="suc-card-actions">
                      <button type="button" className="suc-action-btn" onClick={() => abrirEditar(suc)}>
                        <FaEdit /> Editar
                      </button>
                      <button
                        type="button"
                        className={`suc-action-btn ${suc.estado ? 'warn' : 'ok'}`}
                        onClick={() => handleToggleEstado(suc)}
                      >
                        {suc.estado ? <><FaBan /> Desactivar</> : <><FaCheck /> Activar</>}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {modalAbierto && (
        <div className="suc-modal-overlay" onClick={() => setModalAbierto(false)}>
          <div className="suc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="suc-modal-header">
              <h2>{editando ? 'Editar Sucursal' : 'Nueva Sucursal'}</h2>
              <button type="button" onClick={() => setModalAbierto(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleGuardar} className="suc-form">
              <label>
                Dirección *
                <input
                  type="text"
                  required
                  placeholder="Ej: Av. San Martín 1250 - Sucursal Centro"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                />
              </label>

              <label>
                Teléfono
                <input
                  type="text"
                  placeholder="Ej: 261-4550000"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </label>

              <label>
                Descripción
                <textarea
                  rows="3"
                  placeholder="Horarios, servicios o referencias de esta sucursal..."
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                />
              </label>

              <label className="suc-checkbox-row">
                <input
                  type="checkbox"
                  checked={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.checked })}
                />
                <span>Sucursal activa (habilitada para ingresos de socios)</span>
              </label>

              <div className="suc-modal-footer">
                <button type="button" className="suc-btn-outline" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="suc-btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Crear Sucursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
