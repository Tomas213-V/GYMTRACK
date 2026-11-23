// ==============================================================================
// GESTIÓN DE ADMINISTRADORES ORGANIZACIONALES (SOLO DUEÑO)
// Contratos FastAPI: /api/administradores
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import { useGymContext } from '../../context/GymContext';
import {
  getAdministradores,
  createAdministrador,
  updateAdministrador,
  cambiarEstadoAsignacionAdministrador
} from '../../services/administradorService';
import {
  FaUserShield,
  FaPlus,
  FaEdit,
  FaBan,
  FaCheck,
  FaTimes,
  FaEnvelope,
  FaPhone,
  FaIdCard,
  FaSyncAlt
} from 'react-icons/fa';
import '../sucursales-dueno/sucursales.css';

export default function AdministradoresDueno() {
  const { gimnasioActivo, gimnasioActivoId, esDueno, contextVersion } = useGymContext();

  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [exitoMsg, setExitoMsg] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    dni: '',
    telefono: ''
  });

  const mostrarExito = (msg) => {
    setExitoMsg(msg);
    setTimeout(() => setExitoMsg(''), 4500);
  };

  const cargarAdministradores = useCallback(
    async (signal) => {
      if (!gimnasioActivoId) {
        setAsignaciones([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErrorMsg('');
        const data = await getAdministradores({ id_gimnasio: gimnasioActivoId, signal });
        setAsignaciones(Array.isArray(data?.asignaciones) ? data.asignaciones : []);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setErrorMsg(err.message || 'Error al cargar los administradores organizacionales.');
        setAsignaciones([]);
      } finally {
        setLoading(false);
      }
    },
    [gimnasioActivoId]
  );

  useEffect(() => {
    const controller = new AbortController();
    cargarAdministradores(controller.signal);
    return () => controller.abort();
  }, [cargarAdministradores, contextVersion]);

  const abrirCrear = () => {
    setEditando(null);
    setFormData({ nombre: '', apellido: '', email: '', dni: '', telefono: '' });
    setModalAbierto(true);
  };

  const abrirEditar = (admin) => {
    setEditando(admin);
    setFormData({
      nombre: admin.nombre || '',
      apellido: admin.apellido || '',
      email: admin.email || '',
      dni: admin.dni || '',
      telefono: admin.telefono || ''
    });
    setModalAbierto(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.apellido.trim() || !formData.email.trim()) {
      setErrorMsg('Nombre, apellido y email son obligatorios.');
      return;
    }

    try {
      setGuardando(true);
      setErrorMsg('');
      if (editando) {
        await updateAdministrador(editando.id_administrador, formData);
        mostrarExito('Datos del administrador actualizados correctamente.');
      } else {
        const res = await createAdministrador({
          ...formData,
          id_gimnasio: gimnasioActivoId
        });
        mostrarExito(res?.mensaje || 'Administrador organizacional registrado correctamente.');
      }
      setModalAbierto(false);
      await cargarAdministradores();
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo guardar el administrador.');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleAsignacion = async (asig) => {
    try {
      setErrorMsg('');
      const nuevoEstado = asig.estado === false;
      await cambiarEstadoAsignacionAdministrador(asig.id_administrador_gimnasio, nuevoEstado);
      mostrarExito(
        `Asignación de administrador ${nuevoEstado ? 'activada' : 'desactivada'} en este gimnasio.`
      );
      await cargarAdministradores();
    } catch (err) {
      setErrorMsg(err.message || 'Error al actualizar el estado de la asignación.');
    }
  };

  return (
    <div className="suc-layout">
      <NavGlobal />
      <div className="suc-body">
        <Sidebar />
        <main className="suc-main">
          <section className="suc-header">
            <div>
              <div className="suc-badge">
                <FaUserShield /> {gimnasioActivo?.nombre || 'Gimnasio Activo'}
              </div>
              <h1>Administradores Organizacionales</h1>
              <p>
                Gestioná administradores con alcance a nivel de todo el gimnasio (separados de los
                empleados operativos de sucursal).
              </p>
            </div>

            <div className="suc-header-actions">
              <button type="button" className="suc-btn-outline" onClick={() => cargarAdministradores()} title="Recargar">
                <FaSyncAlt />
              </button>
              {esDueno && (
                <button type="button" className="suc-btn-primary" onClick={abrirCrear}>
                  <FaPlus /> Nuevo Administrador
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

          {loading ? (
            <div className="suc-empty">Cargando administradores...</div>
          ) : asignaciones.length === 0 ? (
            <div className="suc-empty">
              <FaUserShield className="suc-empty-icon" />
              <h3>No hay administradores asignados a este gimnasio</h3>
              <p>Registrá un administrador organizacional para delegar la gestión de sucursales, empleados, socios y caja.</p>
              {esDueno && (
                <button type="button" className="suc-btn-primary" onClick={abrirCrear}>
                  <FaPlus /> Registrar Administrador
                </button>
              )}
            </div>
          ) : (
            <div className="suc-grid">
              {asignaciones.map((asig) => {
                const admin = asig.administrador || {};
                const activa = asig.estado !== false && admin.estado !== false;
                return (
                  <div key={asig.id_administrador_gimnasio} className={`suc-card ${activa ? '' : 'inactiva'}`}>
                    <div className="suc-card-top">
                      <div className="suc-card-icon">
                        <FaUserShield />
                      </div>
                      <span className={`suc-status ${activa ? 'activa' : 'inactiva'}`}>
                        {activa ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <h3>
                      {admin.nombre || 'Administrador'} {admin.apellido || ''}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', color: '#cbd5e1' }}>
                      <span><FaEnvelope style={{ marginRight: '6px', color: '#94a3b8' }} />{admin.email || '-'}</span>
                      <span><FaIdCard style={{ marginRight: '6px', color: '#94a3b8' }} />DNI: {admin.dni || 'Sin DNI'}</span>
                      <span><FaPhone style={{ marginRight: '6px', color: '#94a3b8' }} />{admin.telefono || 'Sin teléfono'}</span>
                    </div>

                    {esDueno && (
                      <div className="suc-card-actions">
                        <button type="button" className="suc-action-btn" onClick={() => abrirEditar(admin)}>
                          <FaEdit /> Editar
                        </button>
                        <button
                          type="button"
                          className={`suc-action-btn ${asig.estado !== false ? 'warn' : 'ok'}`}
                          onClick={() => handleToggleAsignacion(asig)}
                        >
                          {asig.estado !== false ? <><FaBan /> Desactivar</> : <><FaCheck /> Activar</>}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {modalAbierto && (
        <div className="suc-modal-overlay" onClick={() => setModalAbierto(false)}>
          <div className="suc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="suc-modal-header">
              <h2>{editando ? 'Editar Administrador' : 'Nuevo Administrador Organizacional'}</h2>
              <button type="button" onClick={() => setModalAbierto(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleGuardar} className="suc-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label>
                  Nombre *
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </label>
                <label>
                  Apellido *
                  <input
                    type="text"
                    required
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Correo Electrónico *
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label>
                  DNI
                  <input
                    type="text"
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </label>
              </div>

              {!editando && (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                  Si el correo ya corresponde a un administrador en GymTrack, se vinculará a este gimnasio sin duplicar su perfil.
                  El administrador enlazará su cuenta al iniciar sesión con su correo verificado en Supabase Auth.
                </p>
              )}

              <div className="suc-modal-footer">
                <button type="button" className="suc-btn-outline" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="suc-btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Registrar Administrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
