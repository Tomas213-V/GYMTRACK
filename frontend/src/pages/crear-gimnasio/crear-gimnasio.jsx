import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { crearGimnasio } from '../../services/gimnasioService';
import { FaDumbbell, FaMapMarkerAlt, FaPhone, FaEnvelope, FaSignOutAlt } from 'react-icons/fa';
import './crear-gimnasio.css';

function CrearGimnasio() {
  const navigate = useNavigate();
  const [usuario] = useState(() => {
    try {
      const userGuardado = localStorage.getItem('usuario');
      return userGuardado ? JSON.parse(userGuardado) : null;
    } catch {
      return null;
    }
  });

  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    email: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (usuario?.gimnasio?.id_gimnasio) {
      navigate('/dashboard-dueño');
    }
  }, [usuario, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.nombre.trim()) {
      setError('El nombre del gimnasio es obligatorio.');
      return;
    }

    setLoading(true);

    try {
      const res = await crearGimnasio({
        nombre: formData.nombre.trim(),
        direccion: formData.direccion.trim() || null,
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null
      });

      setSuccess('¡Gimnasio registrado con éxito! Redirigiendo al panel...');

      // Actualizar el objeto usuario en localStorage con los datos del gimnasio creado
      if (usuario) {
        const usuarioActualizado = {
          ...usuario,
          gimnasio: res.gimnasio
        };
        localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));
      }

      setTimeout(() => {
        navigate('/dashboard-dueño');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Ocurrió un error al registrar el gimnasio.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login-dueño');
  };

  return (
    <div className="Caja-crear-gimnasio-pagina">
      {/* Barra superior con logo y cerrar sesión */}
      <header className="Caja-crear-gimnasio-header-nav">
        <div className="Caja-crear-gimnasio-marca">
          <b>GYM<span>TRACK</span></b>
        </div>
        <button
          className="Caja-crear-gimnasio-btn-logout"
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          <FaSignOutAlt />
          <span>Cerrar sesión</span>
        </button>
      </header>

      {/* Contenedor central del formulario */}
      <main className="Caja-crear-gimnasio-cuerpo">
        <div className="Caja-crear-gimnasio-card">
          <div className="Caja-crear-gimnasio-icono-badge">
            <FaDumbbell />
          </div>

          <div className="Caja-crear-gimnasio-titulos">
            <h1>Configurá tu Gimnasio</h1>
            <p>
              {usuario?.nombre
                ? `¡Hola, ${usuario.nombre}! Para empezar a gestionar tus socios, cuotas y finanzas, ingresá los datos de tu gimnasio.`
                : 'Para empezar a gestionar socios, cuotas y finanzas, ingresá los datos de tu gimnasio.'}
            </p>
          </div>

          {error && (
            <div className="Caja-crear-gimnasio-alerta Caja-crear-gimnasio-alerta-error">
              {error}
            </div>
          )}

          {success && (
            <div className="Caja-crear-gimnasio-alerta Caja-crear-gimnasio-alerta-exito">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="Caja-crear-gimnasio-form">
            <div className="Caja-crear-gimnasio-grupo">
              <label htmlFor="nombre">Nombre del Gimnasio *</label>
              <div className="Caja-crear-gimnasio-input-wrapper">
                <FaDumbbell className="Caja-crear-gimnasio-input-icono" />
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  placeholder="Ej: Power Gym Central"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="Caja-crear-gimnasio-grupo">
              <label htmlFor="direccion">Dirección</label>
              <div className="Caja-crear-gimnasio-input-wrapper">
                <FaMapMarkerAlt className="Caja-crear-gimnasio-input-icono" />
                <input
                  type="text"
                  id="direccion"
                  name="direccion"
                  placeholder="Ej: Av. San Martín 1234, Mendoza"
                  value={formData.direccion}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="Caja-crear-gimnasio-fila">
              <div className="Caja-crear-gimnasio-grupo">
                <label htmlFor="telefono">Teléfono de Contacto</label>
                <div className="Caja-crear-gimnasio-input-wrapper">
                  <FaPhone className="Caja-crear-gimnasio-input-icono" />
                  <input
                    type="text"
                    id="telefono"
                    name="telefono"
                    placeholder="Ej: 2614567890"
                    value={formData.telefono}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="Caja-crear-gimnasio-grupo">
                <label htmlFor="email">Email del Gimnasio</label>
                <div className="Caja-crear-gimnasio-input-wrapper">
                  <FaEnvelope className="Caja-crear-gimnasio-input-icono" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Ej: contacto@powergym.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="Caja-crear-gimnasio-btn-submit"
              disabled={loading}
            >
              {loading ? 'Creando gimnasio...' : 'Registrar Gimnasio y Continuar'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default CrearGimnasio;
