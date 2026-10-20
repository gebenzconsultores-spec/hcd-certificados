import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'

// Carga diferida por página: cada pantalla se descarga solo cuando se visita,
// así un alumno que abre su examen no baja todo el panel admin (Excel, PDF, etc.).
// Si tras un deploy nuevo falla la descarga de una pantalla vieja, recarga 1 vez.
const K_RECARGA = 'hcd_recarga_chunk'
const ss = {
  get: k => { try { return sessionStorage.getItem(k) } catch (_) { return null } },
  set: (k, v) => { try { sessionStorage.setItem(k, v) } catch (_) {} },
  del: k => { try { sessionStorage.removeItem(k) } catch (_) {} },
}
function cargar(fn) {
  return lazy(() => fn()
    .then(m => { ss.del(K_RECARGA); return m })
    .catch(err => {
      if (!ss.get(K_RECARGA)) { ss.set(K_RECARGA, '1'); window.location.reload(); return new Promise(() => {}) }
      throw err
    }))
}

// Públicas
const Bienvenida = cargar(() => import('./pages/Bienvenida.jsx'))
const Login = cargar(() => import('./pages/Login.jsx'))
const RestablecerPassword = cargar(() => import('./pages/RestablecerPassword.jsx'))
const Verificar = cargar(() => import('./pages/Verificar.jsx'))
const ExamenPublico = cargar(() => import('./pages/ExamenPublico.jsx'))
const CotizadorPublico = cargar(() => import('./pages/CotizadorPublico.jsx'))
// Accesos empresa y estudiante
const EmpresaAcceso = cargar(() => import('./pages/EmpresaAcceso.jsx'))
const EstudianteAcceso = cargar(() => import('./pages/EstudianteAcceso.jsx'))
const EstudianteDashboard = cargar(() => import('./pages/EstudianteDashboard.jsx'))
const EmpresaDashboard = cargar(() => import('./pages/PortalEmpresa.jsx').then(m => ({ default: m.EmpresaDashboard })))
// Admin
const AdminLayout = cargar(() => import('./pages/AdminLayout.jsx'))
const Dashboard = cargar(() => import('./pages/Dashboard.jsx'))
const Cursos = cargar(() => import('./pages/Cursos.jsx'))
const Empresas = cargar(() => import('./pages/Empresas.jsx'))
const Vendedores = cargar(() => import('./pages/Vendedores.jsx'))
const Participantes = cargar(() => import('./pages/Participantes.jsx'))
const Certificados = cargar(() => import('./pages/Certificados.jsx'))
const Auditoria = cargar(() => import('./pages/Auditoria.jsx'))
const AdminCotizaciones = cargar(() => import('./pages/AdminCotizaciones.jsx'))
const RentaPlataforma = cargar(() => import('./pages/RentaPlataforma.jsx'))
const AdminVentas = cargar(() => import('./pages/AdminVentas.jsx'))
const AdminMicrocursos = cargar(() => import('./pages/AdminMicrocursos.jsx'))
const AdminEquipo = cargar(() => import('./pages/AdminEquipo.jsx'))
const AdminPrecios = cargar(() => import('./pages/AdminPrecios.jsx'))
const AdminCompras = cargar(() => import('./pages/AdminCompras.jsx'))
const AdminCotizadorConfig = cargar(() => import('./pages/AdminCotizadorConfig.jsx'))
const CotizadorEspecial = cargar(() => import('./pages/CotizadorEspecial.jsx'))
const AdminProximosCursos = cargar(() => import('./pages/AdminProximosCursos.jsx'))
const AdminCursosConfirmados = cargar(() => import('./pages/AdminCursosConfirmados.jsx'))
const AdminCandidatos = cargar(() => import('./pages/AdminCandidatos.jsx'))
const AdminComisiones = cargar(() => import('./pages/AdminComisiones.jsx'))
const AdminEvaluaciones = cargar(() => import('./pages/AdminEvaluaciones.jsx'))
const AdminSeguimiento = cargar(() => import('./pages/AdminSeguimiento.jsx'))
const AdminRecompensas = cargar(() => import('./pages/AdminRecompensas.jsx'))

const Cargando = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>Cargando...</div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Cargando />}>
        <Routes>
          {/* ── PÚBLICAS ── */}
          <Route path="/" element={<Bienvenida />} />
          <Route path="/verificar/:idUnico" element={<Verificar />} />
          <Route path="/examen/:cursoId" element={<ExamenPublico />} />
          <Route path="/cotizar" element={<CotizadorPublico />} />
          <Route path="/login" element={<Login />} />
          <Route path="/restablecer" element={<RestablecerPassword />} />
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
            <Route path="proximos" element={<AdminProximosCursos />} />
            <Route path="confirmados" element={<AdminCursosConfirmados />} />
            <Route path="empresas" element={<Empresas />} />
            <Route path="candidatos" element={<AdminCandidatos />} />
            <Route path="vendedores" element={<Vendedores />} />
            <Route path="comisiones" element={<AdminComisiones />} />
            <Route path="evaluaciones" element={<AdminEvaluaciones />} />
            <Route path="cotizaciones" element={<AdminCotizaciones />} />
            <Route path="cotizador-config" element={<AdminCotizadorConfig />} />
            <Route path="cotizador-especial" element={<CotizadorEspecial />} />
            <Route path="ventas" element={<AdminVentas />} />
            <Route path="renta" element={<RentaPlataforma />} />
            <Route path="compras" element={<AdminCompras />} />
            <Route path="seguimiento" element={<AdminSeguimiento />} />
            <Route path="recompensas" element={<AdminRecompensas />} />
            <Route path="equipo" element={<AdminEquipo />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
