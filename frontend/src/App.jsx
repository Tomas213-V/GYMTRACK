import { Route, Routes } from 'react-router-dom'

import Landing from './pages/landing/landing'
import Login from './pages/login/login'
import LoginSocio from './pages/login-socio/login-socio'
import DashboardSocio from './pages/dashboard-socio/dashboard-socio'
import SocioMembresia from './pages/socio-membresia/socio-membresia'
import AsistenciaSocio from './pages/asistencia-socio/asistencia-socio'
import Register from './pages/register/register'
import Dashboard from './pages/dashboard/dashboard'
import Progress from './pages/progress/progress'
import Precio from './pages/precio/precio'
import Ejercicios from './pages/ejercicios/ejercicios'
import SocioEjercicios from './pages/socio-ejercicios/socio-ejercicios'
import Soporte from './pages/support/support'
import Pagos from './pages/pagos/pagos'
import CrearGimnasio from './pages/crear-gimnasio/crear-gimnasio'
import Socios from './pages/socios/socios'
import Asistencias from './pages/asistencias/asistencias'
import Rutinas from './pages/rutinas/rutinas'
import SocioRutinas from './pages/socio-rutinas/socio-rutinas'
import Perfil from './pages/perfil/perfil'
import MembresiaAdmin from './pages/membresia-admin/membresia-admin'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
function App() {
  return (
    <>
      <Routes>
        {/* =========================================================
            RUTAS DE LA LANDING (-landing)
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

        <Route path="/register-dueño" element={<Register />} />
        <Route path="/register-dueno" element={<Register />} />
        <Route path="/register-landing" element={<Register />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Dashboard />
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
            <ProtectedRoute rolRequerido="dueño">
              <Socios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socios-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Socios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/socios"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Socios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/membresia-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresia-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresia-admin"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias-admin"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/asistencias-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Asistencias />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asistencias-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Asistencias />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rutinas-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Rutinas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rutinas-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Rutinas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pagos-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Pagos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pagos-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Pagos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pagos"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Pagos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Perfil />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Perfil />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Soporte />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Soporte />
            </ProtectedRoute>
          }
        />
        <Route
          path="/soporte-dueño"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Soporte />
            </ProtectedRoute>
          }
        />
        <Route
          path="/soporte-dueno"
          element={
            <ProtectedRoute rolRequerido="dueño">
              <Soporte />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            RUTAS DE SOCIO (-socio)
            ========================================================= */}
        <Route path="/login-socio" element={<LoginSocio />} />

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
            localStorage.getItem('rol') === 'socio' || Boolean(localStorage.getItem('socio')) ? (
              <ProtectedRoute rolRequerido="socio">
                <SocioEjercicios />
              </ProtectedRoute>
            ) : (
              <Ejercicios />
            )
          }
        />

        <Route
          path="/membresia"
          element={
            <ProtectedRoute>
              {localStorage.getItem('rol') === 'socio' || Boolean(localStorage.getItem('socio')) ? (
                <SocioMembresia />
              ) : (
                <MembresiaAdmin />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/asistencias"
          element={
            <ProtectedRoute>
              {localStorage.getItem('rol') === 'socio' || Boolean(localStorage.getItem('socio')) ? (
                <AsistenciaSocio />
              ) : (
                <Asistencias />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/rutinas"
          element={
            <ProtectedRoute>
              {localStorage.getItem('rol') === 'socio' || Boolean(localStorage.getItem('socio')) ? (
                <SocioRutinas />
              ) : (
                <Rutinas />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <Perfil />
            </ProtectedRoute>
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
