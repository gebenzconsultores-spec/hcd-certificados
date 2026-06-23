import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './pages/AdminLayout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Cursos from './pages/Cursos.jsx'
import Empresas from './pages/Empresas.jsx'
import Participantes from './pages/Participantes.jsx'
import Certificados from './pages/Certificados.jsx'
import Auditoria from './pages/Auditoria.jsx'
import AdminCotizaciones from './pages/AdminCotizaciones.jsx'
import RentaPlataforma from './pages/RentaPlataforma.jsx'
import Verificar from './pages/Verificar.jsx'
import ExamenPublico from './pages/ExamenPublico.jsx'
import CotizadorPublico from './pages/CotizadorPublico.jsx'
import { EmpresaLogin, EmpresaDashboard } from './pages/PortalEmpresa.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── PÚBLICAS ── */}
          <Route path="/verificar/:idUnico" element={<Verificar />} />
          <Route path="/examen/:cursoId" element={<ExamenPublico />} />
          <Route path="/cotizar" element={<CotizadorPublico />} />
          <Route path="/login" element={<Login />} />

          {/* ── PORTAL EMPRESA ── */}
          <Route path="/empresa/login" element={<EmpresaLogin />} />
          <Route path="/empresa/dashboard" element={<EmpresaDashboard />} />

          {/* ── ADMIN ── */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="cursos" element={<Cursos />} />
            <Route path="empresas" element={<Empresas />} />
            <Route path="participantes" element={<Participantes />} />
            <Route path="certificados" element={<Certificados />} />
            <Route path="auditoria" element={<Auditoria />} />
            <Route path="cotizaciones" element={<AdminCotizaciones />} />
            <Route path="renta" element={<RentaPlataforma />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
