/**
 * =========================================================================================
 * ARCHIVO: Button.jsx
 * RUTA: frontend/src/components/Button.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Componente UI reutilizable para botones de acción con variantes de estilo.
 * =========================================================================================
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Texto o elementos internos del botón
 * @param {Function} [props.onClick] - Callback ejecutado al hacer clic
 * @param {'button'|'submit'|'reset'} [props.type='button'] - Tipo HTML del botón
 * @param {'primary'|'secondary'|'danger'|'outline'} [props.variant='primary'] - Variante temática de diseño
 */

import './Button.css'

function Button({ children, onClick, type = 'button', variant = 'primary' }) {
  return (
    <button className={`custom-btn ${variant}`} type={type} onClick={onClick}>
      {children}
    </button>
  )
}

export default Button