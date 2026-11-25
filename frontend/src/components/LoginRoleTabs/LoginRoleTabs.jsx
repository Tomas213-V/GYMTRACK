import { Link } from 'react-router-dom'
import { FaCrown, FaUserShield, FaUserTie, FaUser } from 'react-icons/fa'

const ROLE_TABS = [
  { id: 'dueño', label: 'Dueño', to: '/login-dueño', Icon: FaCrown },
  { id: 'administrador', label: 'Admin', fullLabel: 'Administrador', to: '/login-administrador', Icon: FaUserShield },
  { id: 'empleado', label: 'Empleado', to: '/login-empleado', Icon: FaUserTie },
  { id: 'socio', label: 'Socio', to: '/login-socio', Icon: FaUser },
]

export default function LoginRoleTabs({ activeRole }) {
  return (
    <nav className="login-role-tabs" aria-label="Seleccionar tipo de portal">
      {ROLE_TABS.map(({ id, label, fullLabel, to, Icon }) => {
        const isActive = activeRole === id
        return (
          <Link
            key={id}
            to={to}
            className={`login-role-tab ${isActive ? 'is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            title={fullLabel || label}
          >
            <Icon className="login-role-tab-icon" aria-hidden="true" />
            <span className="login-role-tab-label">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
