import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const WA_SOPORTE = '522223549353'
const COMO_LLEGO_OPCIONES = [
  'Redes sociales', 'Visita comercial', 'LinkedIn', 'Campaña de correo',
  'Búsqueda en Google', 'Recomendación', 'Otro'
]

export default function EmpresaAcceso() {
  const navigate = useNavigate()
  const [modo, setModo] = useState('elegir') // elegir | registro | login
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Login con ID
  const [idEmpresa, setIdEmpresa] = useState('')
  const [password, setPassword] = useState('')

  // Registro invitado
  const [reg, setReg] = useState({
    nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '',
    ciudad: '', password: '', como_llego: ''
  })
  const r = k => v => setReg(p => ({ ...p, [k]: v }))

  async function loginConID() {
    if (!idEmpresa || !password) return
    setLoading(true); setError('')
    try {
      const { data: emp } = await supabase
        .from('empresas')
        .select('*')
        .eq('id_empresa', idEmpresa.toUpperCase().trim())
        .eq('portal_password', password)
        .single()
      if (!emp) throw new Error('no encontrado')
      if (!emp.activo) throw new Error('inactivo')
      sessionStorage.setItem('empresa_portal', JSON.stringify(emp))
      navigate('/empresa/dashboard')
    } catch (e) {
      setError('ID o contraseña incorrectos. Verifica tus datos o contacta a soporte.')
    } finally { setLoading(false) }
  }

  async function registrarInvitado() {
    if (!reg.nombre || !reg.contacto_email || !reg.password) return
    setLoading(true); setError('')
    try {
      // Generar ID de empresa automático
      const { data: seqData } = await supabase.rpc('nextval', { seq_name: 'empresa_id_seq' }).single().catch(() => ({ data: null }))
      const num = seqData?.nextval || Date.now() % 100000
      const id_empresa = `EMP-${String(num).padStart(4, '0')}`

      const fechaFin = new Date()
      fechaFin.setDate(fechaFin.getDate() + 30) // 30 días de prueba

      const { data: emp, error: errIns } = await supabase.from('empresas').insert({
        nombre: reg.nombre,
        contacto_nombre: reg.contacto_nombre,
        contacto_email: reg.contacto_email,
        contacto_whatsapp: reg.contacto_whatsapp,
        ciudad: reg.ciudad,
        portal_password: reg.password,
        id_empresa,
        tipo_acceso: 'invitado',
        tipo_cliente: 'nuevo',
        fecha_registro: new Date().toISOString(),
        fecha_fin_prueba: fechaFin.toISOString(),
        activo: true,
        como_llego: reg.como_llego || 'Registro directo',
      }).select().single()

      if (errIns) throw errIns

      // Crear notificación para admin
      await supabase.from('notificaciones').insert({
        tipo: 'empresa_registro',
        titulo: 'Nueva empresa en prueba',
        mensaje: `${reg.nombre} se registró en periodo de prueba (${id_empresa})`,
        link: '/admin/empresas'
      }).catch(() => {})

      sessionStorage.setItem('empresa_portal', JSON.stringify(emp))
      navigate('/empresa/dashboard')
    } catch (e) {
      setError('No se pudo completar el registro. Es posible que el correo ya esté registrado.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fff,#fef5f5)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}>← Inicio</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <div style={{ width: 8, height: 8, background: '#8B1A1A', borderRadius: '50%' }} />
          <span style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 14 }}>Hablando con Datos</span>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 24px' }}>
        <div style={{ width: 460, maxWidth: '100%' }}>

          {/* ELEGIR MODO */}
          {modo === 'elegir' && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '36px 40px' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Portal de Empresa</h1>
                <p style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>Elige cómo deseas acceder</p>
              </div>

              <button onClick={() => setModo('login')}
                style={{ width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 12, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div>Ya soy cliente</div>
                  <div style={{ fontSize: 12, fontWeight: 400, opacity: .85, marginTop: 2 }}>Tengo un ID de empresa</div>
                </div>
                <span style={{ fontSize: 20 }}>→</span>
              </button>

              <button onClick={() => setModo('registro')}
                style={{ width: '100%', background: '#fff', color: '#8B1A1A', border: '2px solid #8B1A1A', borderRadius: 12, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div>Quiero probar la plataforma</div>
                  <div style={{ fontSize: 12, fontWeight: 400, opacity: .85, marginTop: 2 }}>30 días gratis con todo incluido</div>
                </div>
                <span style={{ fontSize: 20 }}>→</span>
              </button>

              <div style={{ marginTop: 24, padding: '14px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                <p style={{ color: '#15803d', fontSize: 12, lineHeight: 1.5 }}>
                  ✨ <strong>Prueba gratuita:</strong> Registra a tus empleados, asígnales el microcurso de Principios de Calidad, descarga certificados y explora el cotizador. Sin compromiso.
                </p>
              </div>
            </div>
          )}

          {/* LOGIN CON ID */}
          {modo === 'login' && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '36px 40px' }}>
              <button onClick={() => { setModo('elegir'); setError('') }} style={backBtn}>← Volver</button>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Acceso de cliente</h1>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Ingresa con tu ID de empresa</p>

              {error && <div style={errBox}>{error}</div>}

              <label style={lbl}>ID de empresa</label>
              <input value={idEmpresa} onChange={e => setIdEmpresa(e.target.value)} placeholder="EMP-0001" style={inp}
                onKeyDown={e => e.key === 'Enter' && loginConID()} />
              <label style={lbl}>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp}
                onKeyDown={e => e.key === 'Enter' && loginConID()} />

              <button onClick={loginConID} disabled={loading} style={btnPrimary}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <a href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent('Hola, necesito ayuda para acceder a mi portal de empresa en la plataforma HCD')}`}
                target="_blank" style={waSoporte}>
                💬 ¿Olvidaste tu ID? Contacta a Gerencia de Ventas
              </a>
            </div>
          )}

          {/* REGISTRO INVITADO */}
          {modo === 'registro' && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '32px 36px', maxHeight: '85vh', overflowY: 'auto' }}>
              <button onClick={() => { setModo('elegir'); setError('') }} style={backBtn}>← Volver</button>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Prueba gratuita 30 días</h1>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Registra tu empresa y empieza a explorar</p>

              {error && <div style={errBox}>{error}</div>}

              <label style={lbl}>Nombre de la empresa *</label>
              <input value={reg.nombre} onChange={e => r('nombre')(e.target.value)} placeholder="Mi Empresa S.A." style={inp} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Tu nombre *</label>
                  <input value={reg.contacto_nombre} onChange={e => r('contacto_nombre')(e.target.value)} placeholder="Nombre" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Ciudad</label>
                  <input value={reg.ciudad} onChange={e => r('ciudad')(e.target.value)} placeholder="Puebla" style={inp} />
                </div>
              </div>

              <label style={lbl}>Correo electrónico *</label>
              <input type="email" value={reg.contacto_email} onChange={e => r('contacto_email')(e.target.value)} placeholder="contacto@empresa.com" style={inp} />

              <label style={lbl}>WhatsApp</label>
              <input value={reg.contacto_whatsapp} onChange={e => r('contacto_whatsapp')(e.target.value)} placeholder="222 123 4567" style={inp} />

              <label style={lbl}>¿Cómo nos conociste?</label>
              <select value={reg.como_llego} onChange={e => r('como_llego')(e.target.value)} style={inp}>
                <option value="">Selecciona una opción</option>
                {COMO_LLEGO_OPCIONES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>

              <label style={lbl}>Crea una contraseña *</label>
              <input type="password" value={reg.password} onChange={e => r('password')(e.target.value)} placeholder="Para futuros accesos" style={inp} />

              <button onClick={registrarInvitado}
                disabled={loading || !reg.nombre || !reg.contacto_email || !reg.password}
                style={{ ...btnPrimary, marginTop: 8 }}>
                {loading ? 'Creando cuenta...' : 'Empezar prueba gratuita →'}
              </button>

              <p style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
                Al registrarte obtienes 30 días de acceso completo. Después podrás seguir usando el cotizador siempre gratis.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 16 }
const backBtn = { background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }
const errBox = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 16 }
const waSoporte = { display: 'block', textAlign: 'center', marginTop: 16, color: '#25d366', fontSize: 13, fontWeight: 600, textDecoration: 'none' }
