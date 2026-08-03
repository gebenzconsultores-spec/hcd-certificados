import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import Notificaciones from './Notificaciones.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { logout } from '../lib/supabase'
import { useEffect, useState } from 'react'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '◉', end: true },
  { sep: 'Capacitación' },
  { to: '/admin/cursos', label: 'Catálogo de cursos', icon: '📚' },
  { to: '/admin/confirmados', label: 'Calendario de cursos', icon: '📅' },
  { to: '/admin/participantes', label: 'Participantes', icon: '👥' },
  { to: '/admin/certificados', label: 'Certificados', icon: '📜' },
  { to: '/admin/evaluaciones', label: 'Evaluaciones', icon: '⭐' },
  { to: '/admin/auditoria', label: 'Auditoría / ZIP', icon: '📦' },
  { sep: 'Comercial' },
  { to: '/admin/empresas', label: 'Empresas', icon: '🏢' },
  { to: '/admin/candidatos', label: 'Candidatos', icon: '🧑‍💼' },
  { to: '/admin/vendedores', label: 'Vendedores', icon: '🤝' },
  { to: '/admin/comisiones', label: 'Comisiones', icon: '💵' },
  { to: '/admin/precios', label: 'Precios y catálogo', icon: '🏷️' },
  { to: '/admin/cotizaciones', label: 'Cotizaciones', icon: '💼' },
  { to: '/admin/cotizador-config', label: 'Config. cotizador', icon: '⚙️' },
  { to: '/admin/cotizador-especial', label: 'Cotizador especial', icon: '✨' },
  { to: '/admin/compras', label: 'Compras y solicitudes', icon: '🎫' },
  { to: '/admin/seguimiento', label: 'Seguimiento comercial', icon: '🔭' },
  { to: '/admin/ventas', label: 'Ventas y cobranza', icon: '💰' },
  { to: '/admin/renta', label: 'Renta plataforma', icon: '💳' },
  { sep: 'Configuración' },
  { to: '/admin/equipo', label: 'Equipo y permisos', icon: '🔐' },
]

export default function AdminLayout() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 900)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!loading && !session) navigate('/login')
  }, [session, loading])

  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#8B1A1A', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ color: '#64748b', fontSize: 13 }}>Cargando panel...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  if (!session) return null

  const navLinks = (
    <>
      {NAV.map((item, i) => {
        if (item.sep) return (
          <div key={i} style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', padding: '12px 12px 4px', marginTop: 4 }}>
            {item.sep}
          </div>
        )
        return (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, marginBottom: 2,
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
      <div style={{ marginTop: 12, padding: '0 4px' }}>
        <a href="/cotizar" target="_blank"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#f9f0f0', border: '1px solid #fecaca', textDecoration: 'none', color: '#8B1A1A', fontSize: 12, fontWeight: 600 }}>
          🔗 Ver cotizador público
        </a>
      </div>
    </>
  )

  const footer = (
    <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8f0' }}>
      <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
      <button onClick={() => { logout(); navigate('/login') }}
        style={{ width: '100%', background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, color: '#475569', cursor: 'pointer' }}>
        Cerrar sesión
      </button>
    </div>
  )

  // ── Versión MÓVIL: barra arriba + menú desplegable hacia abajo ──
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Menú"
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 18, cursor: 'pointer', lineHeight: 1, color: '#8B1A1A' }}>
              {menuOpen ? '✕' : '☰'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, background: '#8B1A1A', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 9, height: 9, background: '#fff', borderRadius: '50%' }} />
              </div>
              <div style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 13 }}>Panel Admin</div>
            </div>
          </div>
          <Notificaciones />
        </div>

        {menuOpen && (
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '8px 10px', maxHeight: '72vh', overflowY: 'auto', boxShadow: '0 10px 24px rgba(0,0,0,.06)' }}>
            <nav>{navLinks}</nav>
            {footer}
          </div>
        )}

        <div style={{ padding: '14px 14px 28px', overflowX: 'auto' }}>
          <Outlet />
        </div>
      </div>
    )
  }

  // ── Versión ESCRITORIO: sidebar fijo de siempre ──
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
        <nav style={{ flex: 1, padding: '12px' }}>{navLinks}</nav>
        {footer}
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
