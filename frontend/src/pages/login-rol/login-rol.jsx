import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  loginAdministrador,
  loginEmpleado,
  recuperarContrasena
} from '../../services/authService.js';
import { useGymContext } from '../../context/GymContext.jsx';
import logoImg from '../../assets/logo_verde.jpg';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import LoginRoleTabs from '../../components/LoginRoleTabs/LoginRoleTabs';
import '../login-dueno/login.css';

const CONFIG_POR_ROL = {
  administrador: {
    titulo: 'Portal de Administrador',
    subtitulo: 'Acceso exclusivo para administradores organizacionales de gimnasio',
    placeholderEmail: 'admin@gimnasio.com',
    loginFn: loginAdministrador
  },
  empleado: {
    titulo: 'Portal de Empleado',
    subtitulo: 'Acceso exclusivo para administradores de sucursal, recepcionistas y entrenadores',
    placeholderEmail: 'empleado@gimnasio.com',
    loginFn: loginEmpleado
  }
};

export default function LoginRol({ rolFormulario = 'administrador' }) {
  const navigate = useNavigate();
  const { setSession } = useGymContext();
  const cfg = CONFIG_POR_ROL[rolFormulario] || CONFIG_POR_ROL.administrador;

  const [formData, setFormData] = useState({
    email: '',
    contrasena: ''
  });
  const [errors, setErrors] = useState({});
  const [backendError, setBackendError] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Ingresá un email válido.';
    }
    if (!formData.contrasena) {
      newErrors.contrasena = 'La contraseña es obligatoria.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBackendError('');
    setRecoveryMsg('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const data = await cfg.loginFn({
        email: formData.email.trim(),
        contrasena: formData.contrasena
      });

      setSession({
        token: data.token,
        refresh_token: data.refresh_token,
        usuario: data.usuario,
        gimnasios: data.gimnasios,
        sucursales: data.sucursales,
        sucursales_asignadas: data.sucursales_asignadas,
        contextos_disponibles: data.contextos_disponibles,
        requiere_seleccion_gimnasio: data.requiere_seleccion_gimnasio
      });

      if (data.requiere_seleccion_gimnasio) {
        navigate('/seleccionar-gimnasio', { replace: true });
      } else if (rolFormulario === 'empleado' || data.usuario?.rol === 'empleado') {
        navigate('/socios-dueño', { replace: true });
      } else {
        navigate('/dashboard-dueño', { replace: true });
      }
    } catch (error) {
      setBackendError(error.message || 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async (event) => {
    event.preventDefault();
    setBackendError('');
    setRecoveryMsg('');
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setBackendError('Ingresá tu correo electrónico arriba para enviarte el enlace de recuperación.');
      return;
    }
    try {
      const res = await recuperarContrasena(formData.email.trim());
      setRecoveryMsg(res?.mensaje || 'Si la cuenta existe, enviamos un correo de recuperación.');
    } catch (err) {
      setBackendError(err.message || 'No se pudo solicitar la recuperación de contraseña.');
    }
  };

  return (
    <main className="login-page">
      <div className="login-shell">
        <LoginRoleTabs activeRole={rolFormulario === 'empleado' ? 'empleado' : 'administrador'} />
        <div className="login-card">
          <img src={logoImg} alt="GymTrack Logo" className="login-logo" />

          <h1>{cfg.titulo}</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.86rem', textAlign: 'center', margin: '-6px 0 14px' }}>
            {cfg.subtitulo}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={cfg.placeholderEmail}
                autoComplete="email"
              />
              {errors.email && <span className="login-error">{errors.email}</span>}
            </div>

            <PasswordInput
              id="contrasena"
              name="contrasena"
              value={formData.contrasena}
              onChange={handleChange}
              placeholder="************"
              label="Contraseña"
              error={errors.contrasena}
            />

            {recoveryMsg && (
              <div
                style={{
                  background: 'rgba(158, 240, 26, 0.1)',
                  border: '1px solid rgba(158, 240, 26, 0.35)',
                  color: '#d9f99d',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '0.85rem',
                  marginBottom: '10px'
                }}
              >
                {recoveryMsg}
              </div>
            )}

            {backendError && <div className="login-backend-error">{backendError}</div>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
