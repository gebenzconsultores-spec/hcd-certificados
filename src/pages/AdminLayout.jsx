import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import Notificaciones from './Notificaciones.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { logout } from '../lib/supabase'
import { useEffect } from 'react'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '◉', end: true },
  { sep: 'Capacitación' },
  { to: '/admin/cursos', label: 'Cursos y exámenes', icon: '🎓' },
  { to: '/admin/microcursos', label: 'Microcursos', icon: '⚡' },
  { to: '/admin/participantes', label: 'Participantes', icon: '👥' },
  { to: '/admin/certificados', label: 'Certificados', icon: '📜' },
  { to: '/admin/auditoria', label: 'Auditoría / ZIP', icon: '📦' },
  { sep: 'Comercial' },
  { to: '/admin/empresas', label: 'Empresas', icon: '🏢' },
  { to: '/admin/precios', label: 'Precios y catálogo', icon: '🏷️' },
  { to: '/admin/cotizaciones', label: 'Cotizaciones', icon: '💼' },
  { to: '/admin/cotizador-config', label: 'Config. cotizador', icon: '⚙️' },
  { to: '/admin/compras', label: 'Compras y solicitudes', icon: '🎫' },
  { to: '/admin/ventas', label: 'Ventas y comisiones', icon: '💰' },
  { to: '/admin/renta', label: 'Renta plataforma', icon: '💳' },
  { sep: 'Configuración' },
  { to: '/admin/equipo', label: 'Equipo y permisos', icon: '🔐' },
]

export default function AdminLayout() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !session) navigate('/login')
  }, [session, loading])

  if (loading || !session) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fb' }}>
      <aside style={{ width: 240, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, background: '#8B1A1A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 10, height: 10, background: '#fff', borderRadius: '50%' }} />
            </div>
            <div>
              <div style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 12, lineHeight: 1 }}>Hablando con Datos</div>
              <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>Panel Administrador</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px' }}>
          {NAV.map((item, i) => {
            if (item.sep) return (
              <div key={i} style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', padding: '12px 12px 4px', marginTop: 4 }}>
                {item.sep}
              </div>
            )
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, marginBottom: 2,
                  textDecoration: 'none', fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#8B1A1A' : '#475569',
                  background: isActive ? '#f9f0f0' : 'transparent',
                })}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </NavLink>
            )
          })}

          <div style={{ marginTop: 16, padding: '0 4px' }}>
            <a href="/cotizar" target="_blank"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f9f0f0', border: '1px solid #fecaca', textDecoration: 'none', color: '#8B1A1A', fontSize: 12, fontWeight: 600 }}>
              🔗 Ver cotizador público
            </a>
          </div>
        </nav>

        <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
          <button onClick={() => { logout(); navigate('/login') }}
            style={{ width: '100%', background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '7px', fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 240, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '16px 32px 0' }}>
          <Notificaciones />
        </div>
        <div style={{ padding: '12px 32px 28px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
