import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

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
  const [count, setCount] = useState(0)

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/socio/ejercicios"
          element={
            <ProtectedRoute>
              <SocioEjercicios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ejercicios"
          element={
            localStorage.getItem('rol') === 'socio' || Boolean(localStorage.getItem('socio')) ? (
              <ProtectedRoute>
                <SocioEjercicios />
              </ProtectedRoute>
            ) : (
              <Ejercicios />
            )
          }
        />
        <Route path="/ejerciciosLanding" element={<Ejercicios />} />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/login-socio"
          element={<LoginSocio />}
        />

        <Route
          path="/socio/dashboard"
          element={<DashboardSocio />}
        />

        {/* Sección de Membresías */}
        <Route
          path="/socio/membresia"
          element={
            <ProtectedRoute>
              <SocioMembresia />
            </ProtectedRoute>
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
          path="/membresia-admin"
          element={
            <ProtectedRoute>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias"
          element={
            <ProtectedRoute>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membresias-admin"
          element={
            <ProtectedRoute>
              <MembresiaAdmin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/socio/asistencia"
          element={
            <ProtectedRoute>
              <AsistenciaSocio />
            </ProtectedRoute>
          }
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/crear-gimnasio"
          element={
            <ProtectedRoute permitirSinGimnasio={true}>
              <CrearGimnasio />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/progress"
          element={<Progress/>}
        />
        <Route 
          path="/progressLanding"
          element={<Progress/>}
        />
        <Route 
          path="/precio"
          element={<Precio/>}
        />
        <Route 
          path="/precioLanding"
          element={<Precio/>}
        />
      
        <Route 
          path="/support"
          element={<Soporte/>}
        />
        
        <Route 
          path="/pagos" 
          element={
            <ProtectedRoute>
              <Pagos/>
            </ProtectedRoute>
          }
        />

        <Route 
          path="/socios" 
          element={
            <ProtectedRoute>
              <Socios/>
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
          path="/socio/rutinas"
          element={
            <ProtectedRoute>
              <SocioRutinas />
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
              <Perfil/>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}

export default App
