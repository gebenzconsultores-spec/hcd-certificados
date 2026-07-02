import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './pages/AdminLayout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Cursos from './pages/Cursos.jsx'
import Empresas from './pages/Empresas.jsx'
import Vendedores from './pages/Vendedores.jsx'
import Participantes from './pages/Participantes.jsx'
import Certificados from './pages/Certificados.jsx'
import Auditoria from './pages/Auditoria.jsx'
import Verificar from './pages/Verificar.jsx'
import ExamenPublico from './pages/ExamenPublico.jsx'
import { EmpresaLogin, EmpresaDashboard } from './pages/PortalEmpresa.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/verificar/:idUnico" element={<Verificar />} />
          <Route path="/examen/:cursoId" element={<ExamenPublico />} />
          <Route path="/login" element={<Login />} />

          {/* Portal empresa */}
          <Route path="/empresa/login" element={<EmpresaLogin />} />
          <Route path="/empresa/dashboard" element={<EmpresaDashboard />} />

          {/* Admin protegido */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="cursos" element={<Cursos />} />
            <Route path="empresas" element={<Empresas />} />
            <Route path="vendedores" element={<Vendedores />} />
            <Route path="participantes" element={<Participantes />} />
            <Route path="certificados" element={<Certificados />} />
            <Route path="auditoria" element={<Auditoria />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
