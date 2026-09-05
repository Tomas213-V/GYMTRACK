import { useState } from 'react'
//import heroImg from './assets/hero.png'
//import reactLogo from './assets/react.svg'
//import viteLogo from './assets/vite.svg'
//import {Toaster,toast} from "sonner"

import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Landing from './pages/landing/landing'
import Login from './pages/login/login'
import Register from './pages/register/register'
import Dashboard from './pages/dashboard/dashboard'
import Progress from './pages/progress/progress'

import ProtectedRoute from './components/ProtectedRoute'

import './App.css'

function App() {
  
  const [count, setCount] = useState(0)

  return (
    
    <>
     <Routes>

        <Route path="/" element={<Landing />} />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
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

     </Routes>
    </>
  )
}

export default App
