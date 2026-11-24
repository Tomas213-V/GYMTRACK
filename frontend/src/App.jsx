/**
 * =========================================================================================
 * ARCHIVO: App.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Enrutador central y mapa de navegación de la aplicación web.
 * =========================================================================================
 * 
 * GUÍA DE ARQUITECTURA PARA UN DESARROLLADOR EXTERNO:
 * GYMTRACK está estructurado en 3 grandes áreas de navegación:
 * 
 * 1. ZONA PÚBLICA (Landing & Marketing):
 *    - Páginas informativas abiertas a cualquier visitante sin autenticación:
 *      Landing (`/`, `/landing`), Precios (`/precio-landing`), Soporte (`/support-landing`), etc.
 * 
 * 2. ZONA DEL DUEÑO / ADMINISTRADOR DEL GIMNASIO:
 *    - Autenticación: Login (`/login-dueño`) y Registro (`/register-dueño`).
 *    - Creación de Gimnasio: Onboarding forzoso si el dueño aún no registró su establecimiento (`/crear-gimnasio-dueño`).
 *    - Panel Administrativo (Protegido con `<ProtectedRoute rolRequerido="dueño">`):
 *      Dashboard analítico, Gestión de Socios, Pagos/Caja, Membresías del Gym, Asistencias,
 *      Rutinas y Perfil del administrador.
 * 
 * 3. ZONA DEL SOCIO / ALUMNO:
 *    - Autenticación: Login del socio (`/login-socio`) usando DNI o credenciales otorgadas por el gimnasio.
 *    - Panel del Socio (Protegido con `<ProtectedRoute rolRequerido="socio">`):
 *      Dashboard personal, Estado y pago de Membresías, Catálogo de Ejercicios,
 *      Rutinas asignadas por profesores, Registro y código QR de Asistencias.
 * 
 * CONTROL DE ACCESO:
 * `<ProtectedRoute />` inspecciona el token JWT en localStorage, valida el rol del usuario,
 * y verifica si el dueño ya dio de alta su gimnasio antes de permitir el ingreso.
 */

import { Route, Routes } from 'react-router-dom'

// Páginas Públicas y de Presentación
import Landing from './pages/landing/landing'
import Progress from './pages/progress-landing/progress'
import Precio from './pages/precio-landing/precio'
import Soporte from './pages/support-landing/support'
import Ejercicios from './pages/ejercicios-landing/ejercicios'

// Autenticación
import Login from './pages/login-dueno/login'
import LoginRol from './pages/login-rol/login-rol'
import LoginSocio from './pages/login-socio/login-socio'
import Register from './pages/register-dueno/register'
import RegisterSocio from './pages/register-socio/register-socio'
import SeleccionarGimnasio from './pages/seleccionar-gimnasio/seleccionar-gimnasio'

// Páginas del Rol Dueño / Administrador
import Dashboard from './pages/dashboard-dueno/dashboard'
import CrearGimnasio from './pages/crear-gimnasio-dueno/crear-gimnasio'
import SucursalesDueno from './pages/sucursales-dueno/sucursales'
import AdministradoresDueno from './pages/administradores-dueno/administradores'
import EmpleadosDueno from './pages/empleados-dueno/empleados'
import Socios from './pages/socios-dueno/socios'
import Pagos from './pages/pagos-dueno/pagos'
import MembresiaAdmin from './pages/membresia-dueno/membresia-admin'
import Asistencias from './pages/asistencias-dueno/asistencias'
import Rutinas from './pages/rutinas-dueno/rutinas'
import EjerciciosDueno from './pages/ejercicios-dueno/ejercicios-dueno'
import Perfil from './pages/perfil-socio/perfil'
import PerfilDueno from './pages/perfil-dueno/perfil-dueno'

// Páginas del Rol Socio / Alumno
import DashboardSocio from './pages/dashboard-socio/dashboard-socio'
import SocioMembresia from './pages/membresia-socio/socio-membresia'
import AsistenciaSocio from './pages/asistencia-socio/asistencia-socio'
import SocioEjercicios from './pages/ejercicios-socio/socio-ejercicios'
import SocioRutinas from './pages/rutinas-socio/socio-rutinas'

// Componente Guardián de Rutas y Estilos Generales
import ProtectedRoute from './components/ProtectedRoute'
import { useGymContext } from './context/GymContext'
import './App.css'

function RoleAwareRoute({
  socioElement,
  staffElement,
  publicElement = null,
  staffPermiso = null,
  bloquearEmpleado = false
}) {
  const { isAuthenticated, esSocio } = useGymContext()

  if (!isAuthenticated) {
    if (publicElement) return publicElement
    return <ProtectedRoute>{staffElement}</ProtectedRoute>
  }

  if (esSocio) {
    return <ProtectedRoute rolRequerido="socio">{socioElement}</ProtectedRoute>
  }

  return (
    <ProtectedRoute
      rolRequerido="staff"
      permisoRequerido={staffPermiso}
      bloquearEmpleado={bloquearEmpleado}
    >
      {staffElement}
    </ProtectedRoute>
  )
}

function App() {
  return (
    <>
      <Routes>
        {/* =========================================================
            SECCIÓN 1: RUTAS PÚBLICAS / LANDING PAGE
            Accesibles libremente por cualquier usuario sin iniciar sesión.
            ========================================================= */}
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/inicio-landing" element={<Landing />} />
        <Route path="/precio-landing" element={<Precio />} />
        <Route path="/ejercicios-landing" element={<Ejercicios />} />
        <Route path="/progress-landing" element={<Progress />} />
        <Route path="/progreso-landing" element={<Progress />} />
        <Route path="/support-landing" element={<Soporte />} />
        <Route path="/soporte-landing" element={<Soporte />} />

        {/* Alias y compatibilidad para la landing */}
        <Route path="/precioLanding" element={<Precio />} />
        <Route path="/ejerciciosLanding" element={<Ejercicios />} />
        <Route path="/progressLanding" element={<Progress />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/precio" element={<Precio />} />

        {/* =========================================================
            RUTAS DE DUEÑO / ADMINISTRADOR (-dueño / -dueno)
            ========================================================= */}
        <Route path="/login-dueño" element={<Login />} />
        <Route path="/login-dueno" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login-administrador" element={<LoginRol rolFormulario="administrador" />} />
        <Route path="/login-admin" element={<LoginRol rolFormulario="administrador" />} />
        <Route path="/login-empleado" element={<LoginRol rolFormulario="empleado" />} />
        <Route path="/login-staff" element={<LoginRol rolFormulario="empleado" />} />
        <Route
          path="/seleccionar-gimnasio"
          element={
            <ProtectedRoute permitirSinGimnasio={true} permitirSinContexto={true}>
              <SeleccionarGimnasio />
            </ProtectedRoute>
          }
        />

        <Route path="/register-dueño" element={<Register />} />
        <Route path="/register-dueno" element={<Register />} />
        <Route path="/register-landing" element={<Register />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" bloquearEmpleado={true}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" bloquearEmpleado={true}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute rolRequerido="staff" bloquearEmpleado={true}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sucursales-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="ver_sucursales" bloquearEmpleado={true}>
              <SucursalesDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sucursales-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="ver_sucursales" bloquearEmpleado={true}>
              <SucursalesDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sucursales"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="ver_sucursales" bloquearEmpleado={true}>
              <SucursalesDueno />
            </ProtectedRoute>
          }
        />

        <Route
          path="/administradores-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <AdministradoresDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/administradores-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <AdministradoresDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/administradores"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <AdministradoresDueno />
            </ProtectedRoute>
          }
        />

        <Route
          path="/empleados-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="ver_empleados" bloquearEmpleado={true}>
              <EmpleadosDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empleados-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="ver_empleados" bloquearEmpleado={true}>
              <EmpleadosDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empleados"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="ver_empleados" bloquearEmpleado={true}>
              <EmpleadosDueno />
            </ProtectedRoute>
          }
        />

        <Route
          path="/crear-gimnasio-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño" permitirSinGimnasio={true}>
              <CrearGimnasio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crear-gimnasio-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño" permitirSinGimnasio={true}>
              <CrearGimnasio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crear-gimnasio"
          element={
            <ProtectedRoute rolRequerido="dueño" permitirSinGimnasio={true}>
              <CrearGimnasio />
            </ProtectedRoute>
          }
        />

        <Route
          path="/socios-dueño"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Socios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socios-dueno"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Socios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socios"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Socios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/membresia-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_membresias" bloquearEmpleado={true}>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresia-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_membresias" bloquearEmpleado={true}>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_membresias" bloquearEmpleado={true}>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_membresias" bloquearEmpleado={true}>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresia-admin"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_membresias" bloquearEmpleado={true}>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_membresias" bloquearEmpleado={true}>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias-admin"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_membresias" bloquearEmpleado={true}>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/asistencias-dueño"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Asistencias />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asistencias-dueno"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Asistencias />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rutinas-dueño"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Rutinas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rutinas-dueno"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Rutinas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ejercicios-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_ejercicios">
              <EjerciciosDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ejercicios-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_ejercicios">
              <EjerciciosDueno />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pagos-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_pagos">
              <Pagos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pagos-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_pagos">
              <Pagos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pagos"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_pagos">
              <Pagos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil-dueño"
          element={
            <ProtectedRoute rolRequerido="staff">
              <PerfilDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil-dueno"
          element={
            <ProtectedRoute rolRequerido="staff">
              <PerfilDueno />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" bloquearEmpleado={true}>
              <Soporte />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" bloquearEmpleado={true}>
              <Soporte />
            </ProtectedRoute>
          }
        />
        <Route
          path="/soporte-dueño"
          element={
            <ProtectedRoute rolRequerido="staff" bloquearEmpleado={true}>
              <Soporte />
            </ProtectedRoute>
          }
        />
        <Route
          path="/soporte-dueno"
          element={
            <ProtectedRoute rolRequerido="staff" bloquearEmpleado={true}>
              <Soporte />
            </ProtectedRoute>
          }
        />

        {/* Alias dedicados para el rol Empleado (6 secciones operativas) */}
        <Route
          path="/empleado/socios"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Socios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empleado/rutinas"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Rutinas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empleado/ejercicios"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_ejercicios">
              <EjerciciosDueno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empleado/pagos"
          element={
            <ProtectedRoute rolRequerido="staff" permisoRequerido="gestionar_pagos">
              <Pagos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empleado/asistencias"
          element={
            <ProtectedRoute rolRequerido="staff">
              <Asistencias />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empleado/perfil"
          element={
            <ProtectedRoute rolRequerido="staff">
              <PerfilDueno />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            RUTAS DE SOCIO (-socio)
            ========================================================= */}
        <Route path="/login-socio" element={<LoginSocio />} />
        <Route path="/register-socio" element={<RegisterSocio />} />
        <Route path="/activar-socio" element={<RegisterSocio />} />

        <Route
          path="/dashboard-socio"
          element={
            <ProtectedRoute rolRequerido="socio">
              <DashboardSocio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socio/dashboard"
          element={
            <ProtectedRoute rolRequerido="socio">
              <DashboardSocio />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ejercicios-socio"
          element={
            <ProtectedRoute rolRequerido="socio">
              <SocioEjercicios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socio/ejercicios"
          element={
            <ProtectedRoute rolRequerido="socio">
              <SocioEjercicios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rutinas-socio"
          element={
            <ProtectedRoute rolRequerido="socio">
              <SocioRutinas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socio/rutinas"
          element={
            <ProtectedRoute rolRequerido="socio">
              <SocioRutinas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/asistencia-socio"
          element={
            <ProtectedRoute rolRequerido="socio">
              <AsistenciaSocio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asistencias-socio"
          element={
            <ProtectedRoute rolRequerido="socio">
              <AsistenciaSocio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socio/asistencia"
          element={
            <ProtectedRoute rolRequerido="socio">
              <AsistenciaSocio />
            </ProtectedRoute>
          }
        />

        <Route
          path="/membresia-socio"
          element={
            <ProtectedRoute rolRequerido="socio">
              <SocioMembresia />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socio/membresia"
          element={
            <ProtectedRoute rolRequerido="socio">
              <SocioMembresia />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mi-membresia"
          element={
            <ProtectedRoute rolRequerido="socio">
              <SocioMembresia />
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil-socio"
          element={
            <ProtectedRoute rolRequerido="socio">
              <Perfil />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            RUTAS CONDICIONALES / COMPARTIDAS
            ========================================================= */}
        <Route
          path="/ejercicios"
          element={
            <RoleAwareRoute
              socioElement={<SocioEjercicios />}
              staffElement={<EjerciciosDueno />}
              publicElement={<Ejercicios />}
              staffPermiso="gestionar_ejercicios"
            />
          }
        />

        <Route
          path="/membresia"
          element={
            <RoleAwareRoute
              socioElement={<SocioMembresia />}
              staffElement={<MembresiaAdmin />}
              staffPermiso="gestionar_membresias"
              bloquearEmpleado={true}
            />
          }
        />

        <Route
          path="/asistencias"
          element={
            <RoleAwareRoute
              socioElement={<AsistenciaSocio />}
              staffElement={<Asistencias />}
            />
          }
        />

        <Route
          path="/rutinas"
          element={
            <RoleAwareRoute
              socioElement={<SocioRutinas />}
              staffElement={<Rutinas />}
            />
          }
        />

        <Route
          path="/perfil"
          element={
            <RoleAwareRoute
              socioElement={<Perfil />}
              staffElement={<PerfilDueno />}
            />
          }
        />

        <Route
          path="/support"
          element={<Soporte />}
        />
      </Routes>
    </>
  )
}

export default App
