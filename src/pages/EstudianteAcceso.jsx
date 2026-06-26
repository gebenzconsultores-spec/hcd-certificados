import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function EstudianteAcceso() {
  const navigate = useNavigate()
  const [modo, setModo] = useState('elegir') // elegir | login | registro
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Login con ID empleado
  const [idEmpleado, setIdEmpleado] = useState('')

  // Registro invitado
  const [reg, setReg] = useState({
    nombre: '', correo: '', whatsapp: '', empresa: '',
    es_universitario: false, universidad: '', carrera: ''
  })
  const r = k => v => setReg(p => ({ ...p, [k]: v }))

  async function loginConID() {
    if (!idEmpleado) return
    setLoading(true); setError('')
    try {
      const { data: part } = await supabase
        .from('participantes')
        .select('*, empresa:empresas(nombre)')
        .eq('id_empleado', idEmpleado.toUpperCase().trim())
        .single()
      if (!part) throw new Error('no encontrado')
      sessionStorage.setItem('estudiante_portal', JSON.stringify(part))
      navigate('/estudiante/dashboard')
    } catch (e) {
      setError('ID de empleado no encontrado. Verifica con tu empresa o regístrate como individual.')
    } finally { setLoading(false) }
  }

  async function registrarInvitado() {
    if (!reg.nombre || !reg.correo) return
    setLoading(true); setError('')
    try {
      // Verificar si ya existe
      const { data: existe } = await supabase.from('participantes').select('*, empresa:empresas(nombre)').eq('correo', reg.correo).maybeSingle()
      if (existe) {
        sessionStorage.setItem('estudiante_portal', JSON.stringify(existe))
        navigate('/estudiante/dashboard')
        return
      }

      // Generar ID de empleado automático basado en conteo
      let id_empleado
      try {
        const { data: idData } = await supabase.rpc('siguiente_id', { p_prefijo: 'ALU', p_tabla: 'participantes', p_columna: 'id_empleado' })
        id_empleado = idData
      } catch (_) {}
      if (!id_empleado) {
        const { data: existentes } = await supabase.from('participantes').select('id_empleado').not('id_empleado', 'is', null)
        let maxNum = 0
        ;(existentes || []).forEach(e => {
          const m = (e.id_empleado || '').match(/ALU-(\d+)/)
          if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
        })
        id_empleado = `ALU-${String(maxNum + 1).padStart(4, '0')}`
      }

      const { data: part, error: errIns } = await supabase.from('participantes').insert({
        nombre: reg.nombre,
        correo: reg.correo,
        whatsapp: reg.whatsapp,
        empresa_manual: reg.empresa,
        id_empleado,
        tipo: 'individual',
        es_universitario: reg.es_universitario,
        universidad: reg.es_universitario ? reg.universidad : null,
        carrera: reg.es_universitario ? reg.carrera : null,
      }).select('*, empresa:empresas(nombre)').single()

      if (errIns) throw errIns

      sessionStorage.setItem('estudiante_portal', JSON.stringify(part))
      navigate('/estudiante/dashboard')
    } catch (e) {
      setError('No se pudo completar el registro. Intenta de nuevo.')
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
        <div style={{ width: 460, maxWidth: '100%' }}>

          {/* ELEGIR */}
          {modo === 'elegir' && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '36px 40px' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Portal de Estudiante</h1>
                <p style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>¿Cómo deseas acceder?</p>
              </div>

              <button onClick={() => setModo('login')}
                style={{ width: '100%', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 12, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div>Mi empresa me inscribió</div>
                  <div style={{ fontSize: 12, fontWeight: 400, opacity: .85, marginTop: 2 }}>Tengo un ID de empleado</div>
                </div>
                <span style={{ fontSize: 20 }}>→</span>
              </button>

              <button onClick={() => setModo('registro')}
                style={{ width: '100%', background: '#fff', color: '#1d4ed8', border: '2px solid #1d4ed8', borderRadius: 12, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div>Tomo el curso por mi cuenta</div>
                  <div style={{ fontSize: 12, fontWeight: 400, opacity: .85, marginTop: 2 }}>Registro individual</div>
                </div>
                <span style={{ fontSize: 20 }}>→</span>
              </button>
            </div>
          )}

          {/* LOGIN CON ID */}
          {modo === 'login' && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '36px 40px' }}>
              <button onClick={() => { setModo('elegir'); setError('') }} style={backBtn}>← Volver</button>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Acceso de empleado</h1>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Ingresa el ID que te dio tu empresa</p>

              {error && <div style={errBox}>{error}</div>}

              <label style={lbl}>ID de empleado</label>
              <input value={idEmpleado} onChange={e => setIdEmpleado(e.target.value)} placeholder="ALU-0001" style={inp}
                onKeyDown={e => e.key === 'Enter' && loginConID()} />

              <button onClick={loginConID} disabled={loading} style={{ ...btnPrimary, background: '#1d4ed8' }}>
                {loading ? 'Entrando...' : 'Entrar a mi examen'}
              </button>
            </div>
          )}

          {/* REGISTRO INVITADO */}
          {modo === 'registro' && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '32px 36px', maxHeight: '85vh', overflowY: 'auto' }}>
              <button onClick={() => { setModo('elegir'); setError('') }} style={backBtn}>← Volver</button>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Registro individual</h1>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Para quienes toman el curso por su cuenta</p>

              {error && <div style={errBox}>{error}</div>}

              <label style={lbl}>Nombre completo *</label>
              <input value={reg.nombre} onChange={e => r('nombre')(e.target.value)} placeholder="Como aparecerá en tu certificado" style={inp} />

              <label style={lbl}>Correo electrónico *</label>
              <input type="email" value={reg.correo} onChange={e => r('correo')(e.target.value)} placeholder="correo@ejemplo.com" style={inp} />

              <label style={lbl}>WhatsApp</label>
              <input value={reg.whatsapp} onChange={e => r('whatsapp')(e.target.value)} placeholder="222 123 4567" style={inp} />

              <label style={lbl}>Empresa donde trabajas (opcional)</label>
              <input value={reg.empresa} onChange={e => r('empresa')(e.target.value)} placeholder="Para estadísticas" style={inp} />

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14, marginBottom: 4 }}>
                <input type="checkbox" checked={reg.es_universitario} onChange={e => r('es_universitario')(e.target.checked)} style={{ accentColor: '#1d4ed8', width: 16, height: 16 }} />
                <span style={{ color: '#374151', fontSize: 13 }}>Soy estudiante universitario</span>
              </label>
              {reg.es_universitario && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Universidad</label>
                    <input value={reg.universidad} onChange={e => r('universidad')(e.target.value)} placeholder="BUAP" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Carrera</label>
                    <input value={reg.carrera} onChange={e => r('carrera')(e.target.value)} placeholder="Ing. Industrial" style={inp} />
                  </div>
                </div>
              )}

              <button onClick={registrarInvitado} disabled={loading || !reg.nombre || !reg.correo}
                style={{ ...btnPrimary, background: '#1d4ed8', marginTop: 16 }}>
                {loading ? 'Registrando...' : 'Registrarme y continuar →'}
              </button>
            </div>
          )}

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
