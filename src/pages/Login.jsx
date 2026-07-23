import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginAdmin } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { session } = useAuth()

  if (session) { navigate('/admin'); return null }

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true); setError('')
    try {
      await loginAdmin(email, password)
      // Carga limpia para que la sesión de Supabase ya esté lista al entrar
      // (evita el panel en blanco que obligaba a refrescar a mano).
      window.location.assign('/admin')
    } catch (e) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 48px', width: 420, boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #e2e8f0' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#f9f0f0', padding: '10px 20px', borderRadius: 50 }}>
            <div style={{ width: 10, height: 10, background: '#8B1A1A', borderRadius: '50%' }} />
            <span style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 16 }}>Hablando con Datos</span>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>Sistema de Certificados — Panel Admin</p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@hablandocondatos.com" style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        <button onClick={handleLogin} disabled={loading} style={btnStyle}>
          {loading ? 'Entrando...' : 'Entrar al sistema'}
        </button>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, letterSpacing: .3 }
const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#f8f9fb' }
const btnStyle = { width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: .3 }
