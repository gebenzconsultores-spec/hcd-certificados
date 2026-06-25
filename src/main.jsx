import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'

// Públicas
import Bienvenida from './pages/Bienvenida.jsx'
import Login from './pages/Login.jsx'
import Verificar from './pages/Verificar.jsx'
import ExamenPublico from './pages/ExamenPublico.jsx'
import CotizadorPublico from './pages/CotizadorPublico.jsx'

// Accesos empresa y estudiante
import EmpresaAcceso from './pages/EmpresaAcceso.jsx'
import EstudianteAcceso from './pages/EstudianteAcceso.jsx'
import EstudianteDashboard from './pages/EstudianteDashboard.jsx'
import { EmpresaDashboard } from './pages/PortalEmpresa.jsx'

// Admin
import AdminLayout from './pages/AdminLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Cursos from './pages/Cursos.jsx'
import Empresas from './pages/Empresas.jsx'
import Participantes from './pages/Participantes.jsx'
import Certificados from './pages/Certificados.jsx'
import Auditoria from './pages/Auditoria.jsx'
import AdminCotizaciones from './pages/AdminCotizaciones.jsx'
import RentaPlataforma from './pages/RentaPlataforma.jsx'
import AdminVentas from './pages/AdminVentas.jsx'
import AdminMicrocursos from './pages/AdminMicrocursos.jsx'
import AdminEquipo from './pages/AdminEquipo.jsx'
import AdminPrecios from './pages/AdminPrecios.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── PÚBLICAS ── */}
          <Route path="/" element={<Bienvenida />} />
          <Route path="/verificar/:idUnico" element={<Verificar />} />
          <Route path="/examen/:cursoId" element={<ExamenPublico />} />
          <Route path="/cotizar" element={<CotizadorPublico />} />
          <Route path="/login" element={<Login />} />

          {/* ── ACCESO EMPRESA ── */}
          <Route path="/empresa/acceso" element={<EmpresaAcceso />} />
          <Route path="/empresa/dashboard" element={<EmpresaDashboard />} />

          {/* ── ACCESO ESTUDIANTE ── */}
          <Route path="/estudiante/acceso" element={<EstudianteAcceso />} />
          <Route path="/estudiante/dashboard" element={<EstudianteDashboard />} />

          {/* ── ADMIN ── */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="cursos" element={<Cursos />} />
            <Route path="precios" element={<AdminPrecios />} />
            <Route path="participantes" element={<Participantes />} />
            <Route path="certificados" element={<Certificados />} />
            <Route path="auditoria" element={<Auditoria />} />
            <Route path="microcursos" element={<AdminMicrocursos />} />
            <Route path="empresas" element={<Empresas />} />
            <Route path="cotizaciones" element={<AdminCotizaciones />} />
            <Route path="ventas" element={<AdminVentas />} />
            <Route path="renta" element={<RentaPlataforma />} />
            <Route path="equipo" element={<AdminEquipo />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
