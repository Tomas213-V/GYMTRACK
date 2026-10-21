/**
 * =========================================================================================
 * ARCHIVO: PasswordInput.jsx
 * RUTA: frontend/src/components/PasswordInput/PasswordInput.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Componente reutilizable para campos de contraseña con toggle de visibilidad.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR:
 * 1. Propósito: Proveer un input seguro y accesible que permita al usuario alternar entre
 *    modo oculto (`type="password"`) y modo visible (`type="text"`) mediante un ícono de ojo SVG.
 * 2. Props:
 *    - `id`, `name`: Identificadores del elemento HTML para accesibilidad (`htmlFor`).
 *    - `value`, `onChange`: Control bidireccional estándar de React.
 *    - `placeholder`, `label`: Textos descriptivos.
 *    - `error`: Mensaje de validación a renderizar si existe fallo.
 */

import { useState } from 'react'
import './PasswordInput.css'

function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder = 'Contraseña',
  label = 'Contraseña',
  error = ''
}) {
  // PASO 1: Estado booleano para alternar entre mostrar u ocultar la clave
  const [showPassword, setShowPassword] = useState(false)


  return (
    <div className="password-form-group">

      <label htmlFor={id}>
        {label}
      </label>

      <div className="password-input-container">

        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />

        {/* BOTÓN DEL OJITO */}

        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={
            showPassword
              ? 'Ocultar contraseña'
              : 'Mostrar contraseña'
          }
        >
          {showPassword ? (

            /* OJO ABIERTO */

            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
              />

              <circle
                cx="12"
                cy="12"
                r="2.5"
              />
            </svg>

          ) : (

            /* OJO TACHADO */

            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 3l18 18" />

              <path
                d="M10.6 6.2A10.5 10.5 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.1 3.7"
              />

              <path
                d="M6.2 6.3C3.5 8.1 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8"
              />

              <path
                d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
              />
            </svg>

          )}

        </button>

      </div>

      {/* ERROR */}

      {error && (
        <span className="password-error">
          {error}
        </span>
      )}

    </div>
  )
}


export default PasswordInput