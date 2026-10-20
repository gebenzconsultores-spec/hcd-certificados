import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Pantalla para poner una contraseña nueva del panel admin.
// Se llega aquí de dos formas:
//  1) Desde el correo "Reset password" de Supabase (el link inicia sesión
//     temporalmente y AuthProvider redirige aquí).
//  2) Desde el botón "Cambiar contraseña" del panel, ya con sesión iniciada.
export default function RestablecerPassword() {
  const navigate = useNavigate()
  const [listo, setListo] = useState(false)      // ya sabemos si hay sesión
  const [conSesion, setConSesion] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let vivo = true
    // El link del correo trae los tokens en la URL; supabase-js los procesa solo.
    // Damos un momento por si la sesión todavía se está creando.
    const revisar = () => supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setConSesion(!!data.session)
      setListo(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (vivo && s) { setConSesion(true); setListo(true) }
    })
    revisar()
    const t = setTimeout(revisar, 1500)
    return () => { vivo = false; clearTimeout(t); subscription.unsubscribe() }
  }, [])

  async function guardar() {
    setError('')
    if (pwd.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pwd !== pwd2) { setError('Las dos contraseñas no coinciden.'); return }
    setGuardando(true)
    const { error: err } = await supabase.auth.updateUser({ password: pwd })
    setGuardando(false)
    if (err) { setError('No se pudo guardar: ' + err.message); return }
    setOk(true)
    setTimeout(() => navigate('/admin'), 1800)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 'clamp(24px,6vw,40px)', width: 'min(420px,100%)', boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #e2e8f0' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#f9f0f0', padding: '10px 20px', borderRadius: 50 }}>
            <div style={{ width: 10, height: 10, background: '#8B1A1A', borderRadius: '50%' }} />
            <span style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 16 }}>Hablando con Datos</span>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 16 }}>Nueva contraseña</h1>
        </div>

        {!listo && <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }}>Verificando enlace...</p>}

        {listo && !conSesion && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#991b1b', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              El enlace ya expiró o ya se usó. Pide que te envíen uno nuevo, o entra con tu contraseña actual.
            </p>
            <button onClick={() => navigate('/login')} style={btn}>Ir a iniciar sesión</button>
          </div>
        )}

        {listo && conSesion && !ok && (
          <>
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <label style={lbl}>Contraseña nueva</label>
            <input type={ver ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Mínimo 8 caracteres" style={inp} autoComplete="new-password" />
            <label style={lbl}>Repite la contraseña</label>
            <input type={ver ? 'text' : 'password'} value={pwd2} onChange={e => setPwd2(e.target.value)} style={inp} autoComplete="new-password"
              onKeyDown={e => e.key === 'Enter' && guardar()} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', margin: '10px 0 20px', cursor: 'pointer' }}>
              <input type="checkbox" checked={ver} onChange={e => setVer(e.target.checked)} /> Mostrar contraseña
            </label>
            <button onClick={guardar} disabled={guardando} style={btn}>{guardando ? 'Guardando...' : 'Guardar contraseña'}</button>
          </>
        )}

        {ok && <p style={{ textAlign: 'center', color: '#059669', fontSize: 14, fontWeight: 600 }}>✓ Contraseña actualizada. Entrando al panel...</p>}
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#f8f9fb', boxSizing: 'border-box' }
const btn = { width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }
