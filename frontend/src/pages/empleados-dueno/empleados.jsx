// ==============================================================================
// GESTIÓN DE EMPLEADOS REUTILIZABLES Y ASIGNACIONES A SUCURSALES (N:M)
// Contratos FastAPI: POST /api/empleados, POST /api/empleados/{id}/asignaciones,
// PUT /api/empleados/{id}, PUT/PATCH /api/empleados/asignaciones/{id}
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import NavGlobal from '../../components/nav-global/nav-global';
import Sidebar from '../../components/sidebar-dueno/sidebar';
import { useGymContext } from '../../context/GymContext';
import {
  getEmpleados,
  createEmpleado,
  asignarEmpleadoASucursal,
  updateEmpleado,
  updateAsignacionEmpleado,
  cambiarEstadoAsignacionEmpleado
} from '../../services/empleadoService';
import { getSucursales } from '../../services/sucursalService';
import {
  FaUserTie,
  FaPlus,
  FaEdit,
  FaBan,
  FaCheck,
  FaTimes,
  FaMapMarkerAlt,
  FaEnvelope,
  FaPhone,
  FaIdCard,
  FaSearch,
  FaSyncAlt
} from 'react-icons/fa';
import '../sucursales-dueno/sucursales.css';

const ROLES_OPCIONES = [
  { value: 'administrador', label: 'Administrador de sucursal' },
  { value: 'recepcionista', label: 'Recepcionista' },
  { value: 'entrenador', label: 'Entrenador' }
];

export default function EmpleadosDueno() {
  const {
    gimnasioActivo,
    gimnasioActivoId,
    esDueno,
    esAdministrador,
    hasPermission,
    contextVersion
  } = useGymContext();
  const puedeGestionarEmpleados = esDueno || esAdministrador || hasPermission('gestionar_empleados');

  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [exitoMsg, setExitoMsg] = useState('');

  const [search, setSearch] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    telefono: '',
    asignaciones: [] // [{ id_empleado_sucursal?, id_sucursal, rol, estado }]
  });

  const mostrarExito = (msg) => {
    setExitoMsg(msg);
    setTimeout(() => setExitoMsg(''), 4500);
  };

  const cargarTodo = useCallback(
    async (signal) => {
      if (!gimnasioActivoId) {
        setEmpleados([]);
        setSucursales([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErrorMsg('');
        const [empsData, sucsData] = await Promise.all([
          getEmpleados({ estado: filtroEstado, search, id_sucursal: filtroSucursal, signal }),
          getSucursales({ estado: 'todos', signal })
        ]);
        if (signal?.aborted) return;
        setEmpleados(empsData || []);
        setSucursales(sucsData || []);
      } catch (err) {
        if (err.name === 'AbortError' || signal?.aborted) return;
        setErrorMsg(err.message || 'Error al cargar empleados y sucursales.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [gimnasioActivoId, filtroEstado, search, filtroSucursal]
  );

  useEffect(() => {
    const controller = new AbortController();
    cargarTodo(controller.signal);
    return () => controller.abort();
  }, [cargarTodo, contextVersion]);

  const abrirCrear = () => {
    setEditando(null);
    const primeraSuc = sucursales.find((s) => s.estado !== false) || sucursales[0];
    setFormData({
      nombre: '',
      apellido: '',
      dni: '',
      email: '',
      telefono: '',
      asignaciones: primeraSuc
        ? [{ id_sucursal: primeraSuc.id_sucursal, rol: 'recepcionista', estado: true }]
        : []
    });
    setModalAbierto(true);
  };

  const abrirEditar = (emp) => {
    setEditando(emp);
    const asigns = (emp.asignaciones || [])
      .filter((a) => a.estado !== false)
      .map((a) => ({
        id_empleado_sucursal: a.id_empleado_sucursal,
        id_sucursal: Number(a.id_sucursal),
        rol: a.rol || 'recepcionista',
        estado: true
      }));
    setFormData({
      nombre: emp.nombre || '',
      apellido: emp.apellido || '',
      dni: emp.dni || '',
      email: emp.email || '',
      telefono: emp.telefono || '',
      asignaciones: asigns
    });
    setModalAbierto(true);
  };

  const toggleSucursalEnForm = (idSucursal) => {
    setFormData((prev) => {
      const existe = prev.asignaciones.find((a) => Number(a.id_sucursal) === Number(idSucursal));
      if (existe) {
        return {
          ...prev,
          asignaciones: prev.asignaciones.filter((a) => Number(a.id_sucursal) !== Number(idSucursal))
        };
      }
      return {
        ...prev,
        asignaciones: [
          ...prev.asignaciones,
          { id_sucursal: Number(idSucursal), rol: 'recepcionista', estado: true }
        ]
      };
    });
  };

  const cambiarRolSucursal = (idSucursal, nuevoRol) => {
    setFormData((prev) => ({
      ...prev,
      asignaciones: prev.asignaciones.map((a) =>
        Number(a.id_sucursal) === Number(idSucursal) ? { ...a, rol: nuevoRol } : a
      )
    }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.apellido.trim()) {
      setErrorMsg('Nombre y apellido son obligatorios.');
      return;
    }
    if (!formData.email.trim() && !formData.dni.trim()) {
      setErrorMsg('Debés ingresar al menos email o DNI para identificar al empleado.');
      return;
    }
    if (formData.asignaciones.length === 0) {
      setErrorMsg('Debés asignar el empleado al menos a una sucursal.');
      return;
    }

    try {
      setGuardando(true);
      setErrorMsg('');

      if (editando) {
        await updateEmpleado(editando.id_empleado, {
          nombre: formData.nombre,
          apellido: formData.apellido,
          dni: formData.dni,
          email: formData.email,
          telefono: formData.telefono
        });

        const prevAsignaciones = editando.asignaciones || [];
        const prevBySuc = new Map(prevAsignaciones.map((a) => [Number(a.id_sucursal), a]));
        const nextBySuc = new Map(formData.asignaciones.map((a) => [Number(a.id_sucursal), a]));

        for (const [sucId, nextAsig] of nextBySuc.entries()) {
          const prevAsig = prevBySuc.get(sucId);
          if (prevAsig && prevAsig.id_empleado_sucursal) {
            if (prevAsig.rol !== nextAsig.rol || prevAsig.estado === false) {
              await updateAsignacionEmpleado(prevAsig.id_empleado_sucursal, {
                rol: nextAsig.rol,
                estado: true
              });
            }
          } else {
            await asignarEmpleadoASucursal(editando.id_empleado, {
              id_sucursal: sucId,
              rol: nextAsig.rol
            });
          }
        }

        for (const [sucId, prevAsig] of prevBySuc.entries()) {
          if (!nextBySuc.has(sucId) && prevAsig.estado !== false && prevAsig.id_empleado_sucursal) {
            await cambiarEstadoAsignacionEmpleado(prevAsig.id_empleado_sucursal, false);
          }
        }

        mostrarExito('Empleado y asignaciones actualizados correctamente.');
      } else {
        const [primera, ...restantes] = formData.asignaciones;
        const creadoRes = await createEmpleado({
          id_sucursal: primera.id_sucursal,
          rol: primera.rol,
          nombre: formData.nombre,
          apellido: formData.apellido,
          dni: formData.dni,
          email: formData.email,
          telefono: formData.telefono
        });

        const empId = creadoRes?.empleado?.id_empleado;
        if (empId && restantes.length > 0) {
          for (const extra of restantes) {
            await asignarEmpleadoASucursal(empId, {
              id_sucursal: extra.id_sucursal,
              rol: extra.rol
            });
          }
        }

        mostrarExito(
          creadoRes?.creado === false
            ? 'Empleado existente reutilizado y asignado a las sucursales seleccionadas.'
            : 'Empleado registrado y asignado correctamente.'
        );
      }

      setModalAbierto(false);
      await cargarTodo();
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo guardar el empleado.');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleAsignacion = async (asig) => {
    if (!asig?.id_empleado_sucursal) return;
    try {
      setErrorMsg('');
      const nuevo = asig.estado === false;
      await cambiarEstadoAsignacionEmpleado(asig.id_empleado_sucursal, nuevo);
      mostrarExito(`Asignación en sucursal ${nuevo ? 'activada' : 'desactivada'} correctamente.`);
      await cargarTodo();
    } catch (err) {
      setErrorMsg(err.message || 'Error al actualizar la asignación del empleado.');
    }
  };

  const handleToggleEstadoPerfil = async (emp) => {
    try {
      setErrorMsg('');
      const nuevo = emp.estado === false;
      await updateEmpleado(emp.id_empleado, { estado: nuevo });
      mostrarExito(`Perfil del empleado ${nuevo ? 'activado' : 'desactivado'} correctamente.`);
      await cargarTodo();
    } catch (err) {
      setErrorMsg(err.message || 'Error al cambiar el estado del empleado.');
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
                <FaUserTie /> {gimnasioActivo?.nombre || 'Gimnasio Activo'}
              </div>
              <h1>Gestión de Empleados</h1>
              <p>Administrá empleados reutilizables y sus asignaciones independientes por sucursal (rol y estado).</p>
            </div>

            <div className="suc-header-actions">
              <button type="button" className="suc-btn-outline" onClick={() => cargarTodo()} title="Recargar">
                <FaSyncAlt />
              </button>
              {puedeGestionarEmpleados && (
                <button
                  type="button"
                  className="suc-btn-primary"
                  onClick={abrirCrear}
                  disabled={sucursales.length === 0}
                  title={sucursales.length === 0 ? 'Creá primero una sucursal' : 'Registrar o asignar empleado'}
                >
                  <FaPlus /> Nuevo Empleado
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

          {sucursales.length === 0 && !loading && (
            <div className="suc-alert suc-alert-error">
              <span>Primero registrá al menos una sucursal en este gimnasio para poder asignar empleados.</span>
            </div>
          )}

          <div className="suc-toolbar">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <FaSearch style={{ position: 'absolute', left: '10px', top: '12px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, DNI o email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    background: '#14181f',
                    border: '1px solid #262d38',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '9px 12px 9px 32px',
                    fontSize: '13.5px'
                  }}
                />
              </div>

              <select
                value={filtroSucursal}
                onChange={(e) => setFiltroSucursal(e.target.value)}
                style={{
                  background: '#14181f',
                  border: '1px solid #262d38',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '13.5px'
                }}
              >
                <option value="todas">Todas las sucursales</option>
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.direccion}
                  </option>
                ))}
              </select>
            </div>

            <div className="suc-pills">
              <button type="button" className={filtroEstado === 'todos' ? 'active' : ''} onClick={() => setFiltroEstado('todos')}>
                Todos
              </button>
              <button type="button" className={filtroEstado === 'true' ? 'active' : ''} onClick={() => setFiltroEstado('true')}>
                Activos
              </button>
              <button type="button" className={filtroEstado === 'false' ? 'active' : ''} onClick={() => setFiltroEstado('false')}>
                Inactivos
              </button>
            </div>
          </div>

          {loading ? (
            <div className="suc-empty">Cargando empleados...</div>
          ) : empleados.length === 0 ? (
            <div className="suc-empty">
              <FaUserTie className="suc-empty-icon" />
              <h3>No hay empleados registrados</h3>
              <p>Agregá recepcionistas, entrenadores o administradores de sucursal.</p>
            </div>
          ) : (
            <div className="suc-grid">
              {empleados.map((emp) => (
                <div key={emp.id_empleado} className={`suc-card ${emp.estado !== false ? '' : 'inactiva'}`}>
                  <div className="suc-card-top">
                    <div className="suc-card-icon">
                      <FaUserTie />
                    </div>
                    <span className={`suc-status ${emp.estado !== false ? 'activa' : 'inactiva'}`}>
                      {emp.estado !== false ? 'Activo' : 'Desactivado'}
                    </span>
                  </div>

                  <h3>
                    {emp.nombre} {emp.apellido}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', color: '#cbd5e1' }}>
                    <span><FaEnvelope style={{ marginRight: '6px', color: '#94a3b8' }} />{emp.email || '-'}</span>
                    <span><FaIdCard style={{ marginRight: '6px', color: '#94a3b8' }} />DNI: {emp.dni || 'Sin DNI'}</span>
                    <span><FaPhone style={{ marginRight: '6px', color: '#94a3b8' }} />{emp.telefono || 'Sin teléfono'}</span>
                  </div>

                  <div style={{ borderTop: '1px solid #222934', paddingTop: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                      Asignaciones por sucursal:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(emp.asignaciones || []).map((asig) => (
                        <div
                          key={asig.id_empleado_sucursal || asig.id_sucursal}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#0d1015',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            opacity: asig.estado === false ? 0.55 : 1
                          }}
                        >
                          <span style={{ flex: 1 }}>
                            <FaMapMarkerAlt style={{ color: '#a3e635', marginRight: '6px' }} />
                            {asig.sucursal?.direccion || `Sucursal #${asig.id_sucursal}`}
                          </span>
                          <span
                            style={{
                              background: 'rgba(56, 189, 248, 0.14)',
                              color: '#38bdf8',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              textTransform: 'capitalize',
                              fontWeight: 600
                            }}
                          >
                            {asig.rol}
                          </span>
                          {puedeGestionarEmpleados && asig.id_empleado_sucursal && (
                            <button
                              type="button"
                              onClick={() => handleToggleAsignacion(asig)}
                              title={asig.estado === false ? 'Reactivar asignación' : 'Desactivar asignación'}
                              style={{
                                background: 'transparent',
                                border: '1px solid #2c3544',
                                color: asig.estado === false ? '#a3e635' : '#f59e0b',
                                borderRadius: '6px',
                                padding: '3px 7px',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                            >
                              {asig.estado === false ? 'Activar' : 'Pausar'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {puedeGestionarEmpleados && (
                    <div className="suc-card-actions">
                      <button type="button" className="suc-action-btn" onClick={() => abrirEditar(emp)}>
                        <FaEdit /> Editar / Asignar
                      </button>
                      <button
                        type="button"
                        className={`suc-action-btn ${emp.estado !== false ? 'warn' : 'ok'}`}
                        onClick={() => handleToggleEstadoPerfil(emp)}
                      >
                        {emp.estado !== false ? <><FaBan /> Desactivar</> : <><FaCheck /> Activar</>}
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
              <h2>{editando ? 'Editar Empleado y Asignaciones' : 'Registrar / Asignar Empleado'}</h2>
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

              <label>
                Correo Electrónico *
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </label>

              {!editando && (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                  Si el email o DNI ya existe en GymTrack, se reutilizará la identidad del empleado sin duplicarla.
                  La persona vinculará su cuenta al iniciar sesión con su correo verificado en Supabase Auth.
                </p>
              )}

              <div>
                <span style={{ fontSize: '13px', color: '#cbd5e1', display: 'block', marginBottom: '8px' }}>
                  Sucursales asignadas y rol operativo *
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sucursales.map((suc) => {
                    const asig = formData.asignaciones.find((a) => Number(a.id_sucursal) === Number(suc.id_sucursal));
                    const checked = Boolean(asig);
                    return (
                      <div
                        key={suc.id_sucursal}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          background: '#0d1015',
                          border: `1px solid ${checked ? '#a3e635' : '#28313e'}`,
                          padding: '8px 12px',
                          borderRadius: '8px'
                        }}
                      >
                        <label className="suc-checkbox-row" style={{ flex: 1, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSucursalEnForm(suc.id_sucursal)}
                          />
                          <span>{suc.direccion}</span>
                        </label>
                        {checked && (
                          <select
                            value={asig.rol}
                            onChange={(e) => cambiarRolSucursal(suc.id_sucursal, e.target.value)}
                            style={{ width: '185px', padding: '6px 8px' }}
                          >
                            {ROLES_OPCIONES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="suc-modal-footer">
                <button type="button" className="suc-btn-outline" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="suc-btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Registrar Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
