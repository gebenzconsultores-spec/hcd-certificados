import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// WhatsApp de HCD para "¿No recuerdas tu ID?"
const WHATSAPP_HCD = '522223549353'

export default function EstudianteAcceso() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [idEmpleado, setIdEmpleado] = useState('')
  const [password, setPassword] = useState('')

  async function loginConID() {
    if (!idEmpleado) return
    setLoading(true); setError('')
    try {
      const { data: part } = await supabase
        .from('participantes')
        .select('*')
        .eq('id_empleado', idEmpleado.toUpperCase().trim())
        .maybeSingle()

      if (!part) {
        setError('ID no encontrado. Si no recuerdas tu ID, solicítalo a Hablando con Datos.')
        setLoading(false)
        return
      }
      // Si tiene contraseña asignada, verificarla
      if (part.portal_password) {
        if (!password) { setError('Escribe tu contraseña.'); setLoading(false); return }
        if (password !== part.portal_password) { setError('Contraseña incorrecta.'); setLoading(false); return }
      }
      // Verificar acceso al examen (control por selección de la empresa/HCD)
      if (part.acceso_examen === false) {
        setError('Aún no tienes el acceso habilitado. Solicítalo a Hablando con Datos o a tu empresa.')
        setLoading(false)
        return
      }
      sessionStorage.setItem('estudiante_portal', JSON.stringify(part))
      navigate('/estudiante/dashboard')
    } catch (e) {
      setError('Error al entrar: ' + (e.message || 'intenta de nuevo'))
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fff,#eff6ff)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}>← Inicio</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <div style={{ width: 8, height: 8, background: '#1d4ed8', borderRadius: '50%' }} />
          <span style={{ color: '#1d4ed8', fontWeight: 800, fontSize: 14 }}>Hablando con Datos</span>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 24px' }}>
        <div style={{ width: 440, maxWidth: '100%' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '36px 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Portal de Estudiante</h1>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>Ingresa con tu ID de acceso</p>
            </div>

            {error && <div style={errBox}>{error}</div>}

            <label style={lbl}>Tu ID</label>
            <input value={idEmpleado} onChange={e => setIdEmpleado(e.target.value)} placeholder="ALU-0001" style={inp}
              onKeyDown={e => e.key === 'Enter' && loginConID()} />

            <label style={lbl}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tu contraseña" style={inp}
              onKeyDown={e => e.key === 'Enter' && loginConID()} />

            <button onClick={loginConID} disabled={loading} style={btnPrimary}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 18, borderTop: '1px solid #f1f5f9' }}>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>¿No recuerdas tu ID?</p>
              <a href={`https://wa.me/${WHATSAPP_HCD}?text=${encodeURIComponent('Hola, no recuerdo mi ID de acceso al portal de estudiante de Hablando con Datos. Me lo pueden compartir?')}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25D366', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700 }}>
                💬 Solicítalo a HCD por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { width: '100%', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 16 }
const backBtn = { background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }
const errBox = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 16 }
