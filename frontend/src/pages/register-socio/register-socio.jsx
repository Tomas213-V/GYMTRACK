/**
 * =========================================================================================
 * ARCHIVO: register-socio.jsx
 * RUTA: frontend/src/pages/register-socio/register-socio.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Registro / Activación de acceso para Socios en Supabase Auth.
 *              Permite que un socio nuevo o ya cargado presencialmente por el gimnasio
 *              defina su contraseña y vincule su ficha automáticamente al verificar su correo.
 * =========================================================================================
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerSocio, loginSocio } from '../../services/authService.js';
import { useGymContext } from '../../context/GymContext.jsx';
import logoImg from '../../assets/logo_verde.jpg';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import '../register-dueno/register.css';

export default function RegisterSocio() {
  const navigate = useNavigate();
  const { setSession } = useGymContext();

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    dni: '',
    telefono: '',
    contrasena: '',
    confirmarContrasena: ''
  });

  const [errors, setErrors] = useState({});
  const [backendError, setBackendError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
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
      newErrors.email = 'El correo electrónico es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Ingresá un correo electrónico válido.';
    }

    if (!formData.contrasena) {
      newErrors.contrasena = 'La contraseña es obligatoria.';
    } else if (formData.contrasena.length < 6) {
      newErrors.contrasena = 'La contraseña debe tener al menos 6 caracteres.';
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

    if (!validateForm()) return;

    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanDni = formData.dni.trim() || undefined;
    const cleanTelefono = formData.telefono.trim() || undefined;

    setLoading(true);
    try {
      const res = await registerSocio({
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        email: cleanEmail,
        dni: cleanDni,
        telefono: cleanTelefono,
        contrasena: formData.contrasena
      });

      if (res?.requiere_confirmacion_email) {
        setSuccess(
          res.mensaje ||
            'Cuenta creada. Revisá tu casilla y confirmá tu correo electrónico; luego iniciá sesión en el Portal del Socio para vincular automáticamente tu ficha.'
        );
        return;
      }

      if (res?.token && (res?.socio || res?.usuario)) {
        setSession({
          token: res.token,
          refresh_token: res.refresh_token,
          usuario: res.usuario || res.socio,
          socio: res.socio || res.usuario,
          gimnasios: res.gimnasios || []
        });
        setSuccess(res.mensaje || '¡Cuenta de socio activada! Ingresando...');
        setTimeout(() => navigate('/dashboard-socio'), 800);
        return;
      }

      setSuccess('Cuenta creada correctamente. Ya podés iniciar sesión en el Portal del Socio.');
      setTimeout(() => navigate('/login-socio'), 1500);
    } catch (error) {
      // Si el gimnasio ya había creado la ficha presencial y Supabase tiene auto-confirmación activa,
      // registerSocio creó la cuenta Auth y falló el insert con 409; intentamos loginSocio para auto-vincular.
      const msg = String(error?.message || '');
      if (error?.status === 409 && msg.toLowerCase().includes('ficha de socio')) {
        try {
          const loginRes = await loginSocio({
            email: cleanEmail,
            dni: cleanDni,
            contrasena: formData.contrasena
          });
          if (loginRes?.token && (loginRes?.socio || loginRes?.usuario)) {
            setSession({
              token: loginRes.token,
              refresh_token: loginRes.refresh_token,
              usuario: loginRes.usuario || loginRes.socio,
              socio: loginRes.socio || loginRes.usuario,
              gimnasios: loginRes.gimnasios || []
            });
            setSuccess('¡Tu ficha del gimnasio fue vinculada a tu nueva cuenta! Ingresando...');
            setTimeout(() => navigate('/dashboard-socio'), 800);
            return;
          }
        } catch {
          setBackendError(
            'Ya existe una ficha o cuenta registrada con ese email/DNI. Probá iniciar sesión desde "Portal del Socio" con tu contraseña.'
          );
          return;
        }
      }
      setBackendError(msg || 'No se pudo completar el registro del socio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <div className="register-card">
        <img src={logoImg} alt="GymTrack Logo" className="register-logo" />

        <div className="register-header">
          <h1>Activar Cuenta de Socio</h1>
          <p>
            Usá el mismo correo electrónico que registraste en tu gimnasio para crear tu contraseña e ingresar al Portal del Socio.
          </p>
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
              <label htmlFor="nombre">Nombre *</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Tu nombre"
                className={errors.nombre ? 'register-input-error' : ''}
              />
              {errors.nombre && <span className="register-error-msg">{errors.nombre}</span>}
            </div>

            <div className="register-form-group">
              <label htmlFor="apellido">Apellido *</label>
              <input
                id="apellido"
                name="apellido"
                type="text"
                value={formData.apellido}
                onChange={handleChange}
                placeholder="Tu apellido"
                className={errors.apellido ? 'register-input-error' : ''}
              />
              {errors.apellido && <span className="register-error-msg">{errors.apellido}</span>}
            </div>
          </div>

          <div className="register-form-group">
            <label htmlFor="email">Correo electrónico *</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="socio@email.com"
              className={errors.email ? 'register-input-error' : ''}
            />
            {errors.email && <span className="register-error-msg">{errors.email}</span>}
          </div>

          <div className="register-form-row">
            <div className="register-form-group">
              <label htmlFor="dni">DNI (opcional)</label>
              <input
                id="dni"
                name="dni"
                type="text"
                value={formData.dni}
                onChange={handleChange}
                placeholder="Ej: 39123456"
              />
            </div>

            <div className="register-form-group">
              <label htmlFor="telefono">Teléfono (opcional)</label>
              <input
                id="telefono"
                name="telefono"
                type="text"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="Ej: 11 2345 6789"
              />
            </div>
          </div>

          <PasswordInput
            id="contrasena"
            name="contrasena"
            value={formData.contrasena}
            onChange={handleChange}
            placeholder="Mínimo 6 caracteres"
            label="Contraseña *"
            error={errors.contrasena}
          />

          <PasswordInput
            id="confirmarContrasena"
            name="confirmarContrasena"
            value={formData.confirmarContrasena}
            onChange={handleChange}
            placeholder="Repetí tu contraseña"
            label="Confirmar contraseña *"
            error={errors.confirmarContrasena}
          />

          <button type="submit" className="register-btn-submit" disabled={loading}>
            {loading ? 'Activando cuenta...' : 'Crear contraseña y activar acceso'}
          </button>
        </form>

        <p className="register-footer-text">
          ¿Ya activaste tu cuenta?{' '}
          <Link to="/login-socio">Iniciar sesión como Socio</Link>
        </p>
      </div>
    </main>
  );
}
