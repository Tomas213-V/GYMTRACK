import { useState } from 'react'
//import heroImg from './assets/hero.png'
//import reactLogo from './assets/react.svg'
//import viteLogo from './assets/vite.svg'
//import {Toaster,toast} from "sonner"

import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Landing from './pages/landing/landing'
import Login from './pages/login/login'
import LoginSocio from './pages/login-socio/login-socio'
import DashboardSocio from './pages/dashboard-socio/dashboard-socio'
import Register from './pages/register/register'
import Dashboard from './pages/dashboard/dashboard'
import Progress from './pages/progress/progress'
import Precio from './pages/precio/precio'
import ProtectedRoute from './components/ProtectedRoute'
import Ejercicios from './pages/ejercicios/ejercicios'
import Soporte from './pages/support/support'
import Pagos from './pages/pagos/pagos'
import CrearGimnasio from './pages/crear-gimnasio/crear-gimnasio'
import Socios from './pages/socios/socios'
import Asistencias from './pages/asistencias/asistencias'
import Rutinas from './pages/rutinas/rutinas'
import Perfil from './pages/perfil/perfil'
import './App.css'



function App() {
  
  const [count, setCount] = useState(0)

  return (
    
    <>
     <Routes>

        <Route path="/" element={<Landing />} />
        <Route path="/ejercicios" element={<Ejercicios />} />
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
            <Asistencias/>
          </ProtectedRoute>
        }
        />

        <Route 
        path="/rutinas" 
        element={
          <ProtectedRoute>
            <Rutinas/>
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
