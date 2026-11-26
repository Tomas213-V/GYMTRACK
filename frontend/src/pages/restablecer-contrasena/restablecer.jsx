import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { recuperarContrasena, restablecerContrasena } from '../../services/authService.js';
import logoImg from '../../assets/logo_verde.jpg';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import '../login-dueno/login.css';

function parseRecoveryParams(searchStr, hashStr) {
  const hashRaw = hashStr ? hashStr.replace(/^#/, '') : '';
  const hashParams = new URLSearchParams(hashRaw);
  const queryParams = new URLSearchParams(searchStr || '');

  const accessToken = hashParams.get('access_token') || queryParams.get('access_token') || '';
  const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash') || '';
  const type = hashParams.get('type') || queryParams.get('type') || 'recovery';
  const errorCode = hashParams.get('error_code') || queryParams.get('error_code') || '';
  const rawErrorDesc =
    hashParams.get('error_description') ||
    queryParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error') ||
    '';

  let errorDesc = rawErrorDesc;
  if (errorCode === 'otp_expired' || rawErrorDesc.toLowerCase().includes('expired')) {
    errorDesc = 'El enlace de recuperación expiró o ya fue utilizado. Solicitá uno nuevo abajo.';
  }

  return { accessToken, tokenHash, type, errorDesc };
}

function extractEmailFromJwt(token) {
  if (!token || typeof token !== 'string') return '';
  const parts = token.split('.');
  if (parts.length !== 3) return '';
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  } catch {
    return '';
  }
}

export default function RestablecerContrasena() {
  const location = useLocation();
  const initialRecovery = useMemo(
    () => parseRecoveryParams(location.search, location.hash),
    [location.search, location.hash]
  );
  const tieneToken = Boolean(initialRecovery.accessToken || initialRecovery.tokenHash);
  const emailDesdeToken = useMemo(
    () => extractEmailFromJwt(initialRecovery.accessToken),
    [initialRecovery.accessToken]
  );

  const [email, setEmail] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [restablecimientoCompletado, setRestablecimientoCompletado] = useState(false);

  const mostrarFormNuevaPassword = tieneToken && !restablecimientoCompletado;
  const displayedError = errorMsg || (!successMsg ? initialRecovery.errorDesc : '');

  const handleSubmitNuevaPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const passClean = nuevaContrasena.trim();
    if (passClean.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (passClean !== confirmarContrasena.trim()) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    try {
      setLoading(true);
      const res = await restablecerContrasena({
        access_token: initialRecovery.accessToken || null,
        token_hash: initialRecovery.tokenHash || null,
        type: initialRecovery.type || 'recovery',
        nueva_contrasena: passClean,
        confirmar_contrasena: confirmarContrasena.trim()
      });
      setSuccessMsg(
        res?.mensaje || 'Contraseña actualizada correctamente. Ya podés iniciar sesión.'
      );
      setNuevaContrasena('');
      setConfirmarContrasena('');
      setRestablecimientoCompletado(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitarEnlace = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Ingresá un correo electrónico válido.');
      return;
    }

    try {
      setLoading(true);
      const res = await recuperarContrasena(cleanEmail);
      setSuccessMsg(
        res?.mensaje ||
          'Si existe una cuenta asociada a ese correo electrónico, recibirás un enlace de recuperación.'
      );
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo enviar el enlace de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-shell">
        <div className="login-card">
          <img src={logoImg} alt="GymTrack Logo" className="login-logo" />

          <h1>
            {restablecimientoCompletado
              ? '¡Contraseña Actualizada!'
              : mostrarFormNuevaPassword
              ? 'Actualizar Contraseña'
              : 'Recuperar Contraseña'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '-16px 0 24px' }}>
            {restablecimientoCompletado
              ? 'Tu clave ya quedó actualizada en GymTrack.'
              : mostrarFormNuevaPassword
              ? 'Ingresá tu nueva contraseña para completar la recuperación de tu cuenta.'
              : 'Ingresá tu correo para recibir el enlace de restablecimiento de contraseña.'}
          </p>

          {restablecimientoCompletado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {successMsg && (
                <div
                  style={{
                    background: 'rgba(158, 240, 26, 0.1)',
                    border: '1px solid rgba(158, 240, 26, 0.35)',
                    color: '#d9f99d',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '0.9rem'
                  }}
                >
                  {successMsg}
                </div>
              )}

              <Link to="/login-dueño" className="login-button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                Ir a iniciar sesión
              </Link>
            </div>
          ) : mostrarFormNuevaPassword ? (
            <form onSubmit={handleSubmitNuevaPassword}>
              {emailDesdeToken && (
                <div className="login-form-group">
                  <label htmlFor="recovery-account-email">Correo electrónico</label>
                  <input
                    id="recovery-account-email"
                    type="email"
                    value={emailDesdeToken}
                    readOnly
                    style={{ opacity: 0.85, cursor: 'default' }}
                  />
                </div>
              )}

              <PasswordInput
                id="nueva_contrasena"
                name="nueva_contrasena"
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                label="Nueva contraseña"
              />

              <PasswordInput
                id="confirmar_contrasena"
                name="confirmar_contrasena"
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                placeholder="Repetí la contraseña"
                label="Confirmar contraseña"
              />

              {successMsg && (
                <div
                  style={{
                    background: 'rgba(158, 240, 26, 0.1)',
                    border: '1px solid rgba(158, 240, 26, 0.35)',
                    color: '#d9f99d',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.85rem'
                  }}
                >
                  {successMsg}
                </div>
              )}

              {displayedError && <div className="login-backend-error">{displayedError}</div>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>

              <Link to="/login-dueño" className="register-button-login">
                Volver al login
              </Link>
            </form>
          ) : (
            <form onSubmit={handleSolicitarEnlace}>
              <div className="login-form-group">
                <label htmlFor="recovery-email">Correo electrónico</label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@gmail.com"
                  autoComplete="email"
                />
              </div>

              {successMsg && (
                <div
                  style={{
                    background: 'rgba(158, 240, 26, 0.1)',
                    border: '1px solid rgba(158, 240, 26, 0.35)',
                    color: '#d9f99d',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.85rem'
                  }}
                >
                  {successMsg}
                </div>
              )}

              {displayedError && <div className="login-backend-error">{displayedError}</div>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>

              <Link to="/login-dueño" className="register-button-login">
                Volver al login
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
