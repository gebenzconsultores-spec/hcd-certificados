import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { logout } from '../lib/supabase'
import { useEffect } from 'react'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '◉', end: true },
  { to: '/admin/cursos', label: 'Cursos', icon: '🎓' },
  { to: '/admin/empresas', label: 'Empresas', icon: '🏢' },
  { to: '/admin/participantes', label: 'Participantes', icon: '👥' },
  { to: '/admin/certificados', label: 'Certificados', icon: '📜' },
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
      {/* SIDEBAR */}
      <aside style={{ width: 240, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, background: '#8B1A1A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 10, height: 10, background: '#fff', borderRadius: '50%' }} />
            </div>
            <div>
              <div style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 13, lineHeight: 1 }}>Hablando con Datos</div>
              <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>Certificados</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                textDecoration: 'none', fontSize: 14, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#8B1A1A' : '#475569',
                background: isActive ? '#f9f0f0' : 'transparent',
                transition: 'all .15s'
              })}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>{session.user.email}</div>
          <button onClick={() => { logout(); navigate('/login') }}
            style={{ width: '100%', background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px', fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main style={{ flex: 1, marginLeft: 240, padding: '32px 36px', minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  )
}
