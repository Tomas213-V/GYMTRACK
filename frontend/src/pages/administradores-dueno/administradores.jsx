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
import { verificarIdentidad } from '../../services/authService';
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
    telefono: '',
    contrasena_inicial: ''
  });
  const [deteccionAdmin, setDeteccionAdmin] = useState(null);
  const [confirmarIncorporacionAdmin, setConfirmarIncorporacionAdmin] = useState(false);

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
        if (signal?.aborted) return;
        setAsignaciones(Array.isArray(data?.asignaciones) ? data.asignaciones : []);
      } catch (err) {
        if (err.name === 'AbortError' || signal?.aborted) return;
        setErrorMsg(err.message || 'Error al cargar los administradores organizacionales.');
        setAsignaciones([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
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
    setDeteccionAdmin(null);
    setConfirmarIncorporacionAdmin(false);
    setFormData({ nombre: '', apellido: '', email: '', dni: '', telefono: '', contrasena_inicial: '' });
    setModalAbierto(true);
  };

  const verificarAdminExistente = async (dniVal, emailVal) => {
    const cleanDni = String(dniVal || '').trim();
    const cleanEmail = String(emailVal || '').trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (cleanDni.length < 5 && !emailOk) {
      setDeteccionAdmin(null);
      setConfirmarIncorporacionAdmin(false);
      return null;
    }
    try {
      const res = await verificarIdentidad({
        tipo_perfil: 'administrador',
        dni: cleanDni.length >= 5 ? cleanDni : null,
        email: emailOk ? cleanEmail : null,
        id_gimnasio: gimnasioActivoId || null
      });
      setDeteccionAdmin(res);
      if (res?.existe_en_gymtrack) {
        setFormData((prev) => ({ ...prev, contrasena_inicial: '' }));
      }
      return res;
    } catch {
      return null;
    }
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
        const det = await verificarAdminExistente(formData.dni, formData.email);
        if (det?.asociacion_activa_en_este_gimnasio) {
          setErrorMsg(det.mensaje || 'Esta persona ya está asociada a tu gimnasio.');
          return;
        }
        if (det?.conflicto_identidad) {
          setErrorMsg(det.mensaje || 'El DNI y el correo corresponden a personas distintas.');
          return;
        }
        if (det?.existe_en_gymtrack && !confirmarIncorporacionAdmin) {
          setErrorMsg('Confirmá que querés incorporar a esta persona existente como administrador de tu gimnasio.');
          return;
        }
        const pwdInicial = formData.contrasena_inicial.trim();
        if (!det?.tiene_cuenta_auth && !det?.existe_en_gymtrack && pwdInicial && pwdInicial.length < 6) {
          setErrorMsg('La contraseña inicial debe tener al menos 6 caracteres.');
          return;
        }
        const res = await createAdministrador({
          ...formData,
          id_gimnasio: gimnasioActivoId,
          ...(!det?.tiene_cuenta_auth && !det?.existe_en_gymtrack && pwdInicial
            ? { contrasena_inicial: pwdInicial }
            : { contrasena_inicial: '' }),
          ...(det?.existe_en_gymtrack ? { confirmar_incorporacion: true } : {})
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
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setConfirmarIncorporacionAdmin(false);
                  }}
                  onBlur={() => !editando && verificarAdminExistente(formData.dni, formData.email)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label>
                  DNI
                  <input
                    type="text"
                    value={formData.dni}
                    onChange={(e) => {
                      setFormData({ ...formData, dni: e.target.value });
                      setConfirmarIncorporacionAdmin(false);
                    }}
                    onBlur={() => !editando && verificarAdminExistente(formData.dni, formData.email)}
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

              {!editando && deteccionAdmin?.existe_en_gymtrack && !deteccionAdmin?.asociacion_activa_en_este_gimnasio && (
                <div
                  style={{
                    background: 'rgba(158, 240, 26, 0.08)',
                    border: '1px solid rgba(158, 240, 26, 0.35)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#d9f99d'
                  }}
                >
                  <div>
                    <strong>{deteccionAdmin.mensaje}</strong> Se reutilizará su cuenta global sin duplicarla ni cambiar su contraseña.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={confirmarIncorporacionAdmin}
                      onChange={(e) => setConfirmarIncorporacionAdmin(e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    <span>Confirmo incorporar este administrador existente</span>
                  </label>
                </div>
              )}

              {!editando && !deteccionAdmin?.existe_en_gymtrack && !deteccionAdmin?.tiene_cuenta_auth && (
                <label>
                  Contraseña inicial (para cuenta nueva)
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    value={formData.contrasena_inicial}
                    onChange={(e) => setFormData({ ...formData, contrasena_inicial: e.target.value })}
                  />
                </label>
              )}

              {!editando && (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                  Si el correo o DNI ya existe en GymTrack, se vinculará a este gimnasio reutilizando su cuenta global sin modificar su contraseña.
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
