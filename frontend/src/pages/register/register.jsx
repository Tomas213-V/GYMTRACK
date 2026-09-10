import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/authService.js';
import logoImg from '../../assets/logo_verde.jpg';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import './register.css';

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    contrasena: '',
    confirmarContrasena: '',
  });

  const [errors, setErrors] = useState({});
  const [backendError, setBackendError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio.';
    }

    if (!formData.apellido.trim()) {
      newErrors.apellido = 'El apellido es obligatorio.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ingresá un email válido.';
    }

    if (!formData.contrasena) {
      newErrors.contrasena = 'La contraseña es obligatoria.';
    } else if (formData.contrasena.length < 8) {
      newErrors.contrasena = 'La contraseña debe tener al menos 8 caracteres.';
    }

    if (!formData.confirmarContrasena) {
      newErrors.confirmarContrasena = 'Debés confirmar la contraseña.';
    } else if (formData.contrasena !== formData.confirmarContrasena) {
      newErrors.confirmarContrasena = 'Las contraseñas no coinciden.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBackendError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await register({
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        email: formData.email.trim(),
        contrasena: formData.contrasena,
      });

      setSuccess('¡Cuenta creada correctamente! Redirigiendo para iniciar sesión...');

      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error) {
      setBackendError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <div className="register-card">
        <img src={logoImg} alt="GymTrack Logo" className="register-logo" />

        <div className="register-header">
          <h1>Crear cuenta</h1>
          <p>Registrate como dueño para comenzar a gestionar tu gimnasio</p>
        </div>

        {backendError && (
          <div className="register-alerta register-alerta-error">
            {backendError}
          </div>
        )}

        {success && (
          <div className="register-alerta register-alerta-exito">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="register-form-row">
            <div className="register-form-group">
              <label htmlFor="nombre">Nombre</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Tu nombre"
                className={errors.nombre ? 'register-input-error' : ''}
              />
              {errors.nombre && (
                <span className="register-error-msg">{errors.nombre}</span>
              )}
            </div>

            <div className="register-form-group">
              <label htmlFor="apellido">Apellido</label>
              <input
                id="apellido"
                name="apellido"
                type="text"
                value={formData.apellido}
                onChange={handleChange}
                placeholder="Tu apellido"
                className={errors.apellido ? 'register-input-error' : ''}
              />
              {errors.apellido && (
                <span className="register-error-msg">{errors.apellido}</span>
              )}
            </div>
          </div>

          <div className="register-form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              className={errors.email ? 'register-input-error' : ''}
            />
            {errors.email && (
              <span className="register-error-msg">{errors.email}</span>
            )}
          </div>

          <PasswordInput
            id="contrasena"
            name="contrasena"
            value={formData.contrasena}
            onChange={handleChange}
            placeholder="Mínimo 8 caracteres"
            label="Contraseña"
            error={errors.contrasena}
          />

          <PasswordInput
            id="confirmarContrasena"
            name="confirmarContrasena"
            value={formData.confirmarContrasena}
            onChange={handleChange}
            placeholder="Repetí tu contraseña"
            label="Confirmar contraseña"
            error={errors.confirmarContrasena}
          />

          <button
            type="submit"
            className="register-btn-submit"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="register-footer-text">
          ¿Ya tenés una cuenta?{' '}
          <Link to="/login">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}

export default Register;