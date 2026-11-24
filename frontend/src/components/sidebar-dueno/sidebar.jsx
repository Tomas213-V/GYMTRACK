// ==============================================================================
// MENÚ LATERAL — DUEÑO Y EMPLEADOS (CON PERMISOS POR ROL Y NUEVOS MÓDULOS)
// ==============================================================================

import { useState, useEffect } from 'react';
import './sidebar.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaMoneyBill,
  FaHeadset,
  FaUsers,
  FaCalendarCheck,
  FaDumbbell,
  FaRunning,
  FaUser,
  FaCreditCard,
  FaSignOutAlt,
  FaTimes,
  FaMapMarkerAlt,
  FaUserTie,
  FaUserShield
} from 'react-icons/fa';
import { FaHouse } from 'react-icons/fa6';
import { useGymContext } from '../../context/GymContext';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { esDueno, esAdministrador, esEmpleado, hasPermission, logout } = useGymContext();
  const [abiertoMovil, setAbiertoMovil] = useState(false);

  useEffect(() => {
    const toggleHandler = () => setAbiertoMovil((prev) => !prev);
    window.addEventListener('gymtrack:toggle-sidebar', toggleHandler);
    return () => window.removeEventListener('gymtrack:toggle-sidebar', toggleHandler);
  }, []);

  useEffect(() => {
    setAbiertoMovil((prev) => (prev ? false : prev));
  }, [location.pathname]);

  const opcionesEmpleado = [
    {
      ruta: '/socios-dueño',
      nombre: 'Socios',
      icono: <FaUsers />,
      alias: ['/socios', '/socios-dueno', '/empleado/socios'],
      visible: true
    },
    {
      ruta: '/rutinas-dueño',
      nombre: 'Rutinas',
      icono: <FaDumbbell />,
      alias: ['/rutinas', '/rutinas-dueno', '/empleado/rutinas'],
      visible: true
    },
    {
      ruta: '/ejercicios-dueño',
      nombre: 'Ejercicios',
      icono: <FaRunning />,
      alias: ['/ejercicios-dueno', '/ejercicios', '/empleado/ejercicios'],
      visible: true
    },
    {
      ruta: '/pagos-dueño',
      nombre: 'Pagos',
      icono: <FaMoneyBill />,
      alias: ['/pagos', '/pagos-dueno', '/empleado/pagos'],
      visible: true
    },
    {
      ruta: '/asistencias-dueño',
      nombre: 'Asistencia',
      icono: <FaCalendarCheck />,
      alias: ['/asistencias', '/asistencias-dueno', '/empleado/asistencias'],
      visible: true
    },
    {
      ruta: '/perfil-dueño',
      nombre: 'Perfil',
      icono: <FaUser />,
      alias: ['/perfil', '/perfil-dueno', '/empleado/perfil'],
      visible: true
    }
  ];

  const todasLasOpciones = [
    {
      ruta: '/dashboard-dueño',
      nombre: 'Inicio',
      icono: <FaHouse />,
      alias: ['/dashboard', '/dashboard-dueno'],
      visible: true
    },
    {
      ruta: '/sucursales-dueño',
      nombre: 'Sucursales',
      icono: <FaMapMarkerAlt />,
      alias: ['/sucursales', '/sucursales-dueno'],
      visible: esDueno || hasPermission('ver_sucursales')
    },
    {
      ruta: '/administradores-dueño',
      nombre: 'Administradores',
      icono: <FaUserShield />,
      alias: ['/administradores', '/administradores-dueno'],
      visible: esDueno
    },
    {
      ruta: '/empleados-dueño',
      nombre: 'Empleados',
      icono: <FaUserTie />,
      alias: ['/empleados', '/empleados-dueno'],
      visible: esDueno || hasPermission('ver_empleados')
    },
    {
      ruta: '/socios-dueño',
      nombre: 'Socios',
      icono: <FaUsers />,
      alias: ['/socios', '/socios-dueno', '/empleado/socios'],
      visible: esDueno || hasPermission('gestionar_socios') || hasPermission('ver_socios')
    },
    {
      ruta: '/membresia-dueño',
      nombre: 'Membresías',
      icono: <FaCreditCard />,
      alias: ['/membresias-dueño', '/membresia-admin', '/membresias', '/membresias-admin', '/membresia-dueno', '/membresias-dueno'],
      visible: esDueno || hasPermission('gestionar_membresias')
    },
    {
      ruta: '/asistencias-dueño',
      nombre: 'Asistencias',
      icono: <FaCalendarCheck />,
      alias: ['/asistencias', '/asistencias-dueno', '/empleado/asistencias'],
      visible: esDueno || hasPermission('gestionar_asistencias') || hasPermission('ver_asistencias')
    },
    {
      ruta: '/ejercicios-dueño',
      nombre: 'Ejercicios',
      icono: <FaRunning />,
      alias: ['/ejercicios-dueno', '/ejercicios', '/empleado/ejercicios'],
      visible: esDueno || hasPermission('gestionar_ejercicios')
    },
    {
      ruta: '/rutinas-dueño',
      nombre: 'Rutinas',
      icono: <FaDumbbell />,
      alias: ['/rutinas', '/rutinas-dueno', '/empleado/rutinas'],
      visible: esDueno || hasPermission('gestionar_rutinas')
    },
    {
      ruta: '/pagos-dueño',
      nombre: 'Pagos',
      icono: <FaMoneyBill />,
      alias: ['/pagos', '/pagos-dueno', '/empleado/pagos'],
      visible: esDueno || hasPermission('gestionar_pagos')
    },
    {
      ruta: '/perfil-dueño',
      nombre: 'Mi Perfil',
      icono: <FaUser />,
      alias: ['/perfil', '/perfil-dueno', '/empleado/perfil'],
      visible: true
    },
    {
      ruta: '/support-dueño',
      nombre: 'Soporte',
      icono: <FaHeadset />,
      alias: ['/support', '/support-dueno', '/soporte-dueño', '/soporte-dueno'],
      visible: true
    }
  ];

  const opciones = esEmpleado
    ? opcionesEmpleado
    : todasLasOpciones.filter((op) => op.visible);

  const handleLogout = () => {
    const destino = esAdministrador
      ? '/login-administrador'
      : esEmpleado
      ? '/login-empleado'
      : '/login-dueño';
    logout();
    navigate(destino, { replace: true });
  };

  return (
    <>
      {abiertoMovil && (
        <div
          className="Caja-sidebar-overlay"
          onClick={() => setAbiertoMovil(false)}
          aria-label="Cerrar menú lateral"
        />
      )}

      <aside className={`Caja-sidebar ${abiertoMovil ? 'abierto-movil' : ''}`}>
        <div className="Caja-sidebar-mobile-header">
          <div className="Caja-sidebar-mobile-logo">
            <b>
              GYM<span>TRACK</span>
            </b>
          </div>
          <button
            className="Caja-sidebar-close-btn"
            onClick={() => setAbiertoMovil(false)}
            aria-label="Cerrar navegación"
          >
            <FaTimes />
          </button>
        </div>

        <div className="Caja-sidebar-opciones">
          {opciones.map((opcion, index) => {
            const esActivo =
              location.pathname === opcion.ruta ||
              (opcion.alias && opcion.alias.includes(location.pathname));

            return (
              <Link
                to={opcion.ruta}
                key={index}
                className={esActivo ? 'Caja-sidebar-link-activo' : ''}
                onClick={() => setAbiertoMovil(false)}
              >
                <i className="Caja-sidebar-icono">{opcion.icono}</i>
                <span>{opcion.nombre}</span>
              </Link>
            );
          })}
        </div>

        <div className="Caja-sidebar-bottom">
          <button onClick={handleLogout} className="Caja-sidebar-logout-btn">
            <FaSignOutAlt className="Caja-sidebar-logout-icon" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
