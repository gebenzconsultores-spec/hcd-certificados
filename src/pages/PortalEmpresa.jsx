import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── LOGIN EMPRESA ─────────────────────────────────────────────
export function EmpresaLogin() {
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function entrar() {
    if (!correo || !password) return
    setLoading(true); setError('')
    try {
      // Buscar empresa por correo de contacto + verificar password simple
      const { data: emp } = await supabase
        .from('empresas')
        .select('*')
        .eq('contacto_email', correo)
        .eq('portal_password', password)
        .single()
      if (!emp) throw new Error('no encontrado')
      // Guardar en sessionStorage
      sessionStorage.setItem('empresa_portal', JSON.stringify(emp))
      navigate(`/empresa/dashboard`)
    } catch {
      setError('Correo o contraseña incorrectos. Contacta a Hablando con Datos.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 48px', width: 420, boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #e2e8f0' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f9f0f0', padding: '8px 18px', borderRadius: 50, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, background: '#8B1A1A', borderRadius: '50%' }} />
            <span style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 14 }}>Hablando con Datos</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Portal de empresa</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Consulta el historial de capacitación de tu personal</p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Correo de contacto</label>
          <input type="email" value={correo} onChange={e => setCorreo(e.target.value)}
            placeholder="contacto@empresa.com" style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && entrar()} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && entrar()} />
        </div>
        <button onClick={entrar} disabled={loading}
          style={{ width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 16 }}>
          ¿No tienes acceso? Contacta a Hablando con Datos
        </p>
      </div>
    </div>
  )
}

// ── DASHBOARD EMPRESA ─────────────────────────────────────────
export function EmpresaDashboard() {
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState(null)
  const [certificados, setCertificados] = useState([])
  const [resultados, setResultados] = useState([])
  const [cursos, setCursos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tabActiva, setTabActiva] = useState('certificados')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const emp = sessionStorage.getItem('empresa_portal')
    if (!emp) { navigate('/empresa/login'); return }
    const empData = JSON.parse(emp)
    setEmpresa(empData)
    cargar(empData.id)
  }, [])

  async function cargar(empresaId) {
    setLoading(true)
    const [{ data: certs }, { data: res }, { data: cur }] = await Promise.all([
      supabase.from('certificados')
        .select('*, participante:participantes(nombre, correo, whatsapp), curso:cursos(nombre, numero_curso, duracion)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false }),
      supabase.from('resultados_examen')
        .select('*, participante:participantes(nombre, correo), curso:cursos(nombre, numero_curso)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false }),
      supabase.from('cursos').select('*').eq('activo', true).order('numero_curso', { ascending: false })
    ])
    setCertificados(certs || [])
    setResultados(res || [])
    setCursos(cur || [])
    setLoading(false)
  }

  function salir() {
    sessionStorage.removeItem('empresa_portal')
    navigate('/empresa/login')
  }

  if (!empresa) return null

  const certsFiltrados = certificados.filter(c =>
    `${c.nombre_participante} ${c.id_unico} ${c.nombre_curso}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Estadísticas
  const empleadosUnicos = [...new Set(certificados.map(c => c.participante?.correo))].length
  const cursosDistintos = [...new Set(certificados.map(c => c.nombre_curso))].length
  const aprobados = resultados.filter(r => r.aprobado).length

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, background: '#8B1A1A', borderRadius: '50%' }} />
            <span style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 15 }}>Hablando con Datos</span>
            <span style={{ color: '#d1d5db' }}>|</span>
            <span style={{ color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{empresa.nombre}</span>
          </div>
          <button onClick={salir} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Dashboard de capacitación</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Historial de cursos y certificados de tu personal</p>
        </div>

        {/* Estadísticas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Certificados emitidos', value: certificados.length, color: '#8B1A1A' },
            { label: 'Empleados capacitados', value: empleadosUnicos, color: '#1d4ed8' },
            { label: 'Cursos distintos', value: cursosDistintos, color: '#7c3aed' },
            { label: 'Exámenes aprobados', value: aprobados, color: '#059669' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{loading ? '—' : s.value}</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
          {[
            { id: 'certificados', label: '📜 Certificados' },
            { id: 'resultados', label: '📊 Resultados de exámenes' },
            { id: 'cursos', label: '🎓 Cursos disponibles' },
          ].map(t => (
            <button key={t.id} onClick={() => setTabActiva(t.id)}
              style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tabActiva === t.id ? '#8B1A1A' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tabActiva === t.id ? 700 : 400, color: tabActiva === t.id ? '#8B1A1A' : '#64748b', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: Certificados */}
        {tabActiva === 'certificados' && (
          <div>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, ID o curso..."
              style={{ ...inputStyle, maxWidth: 400, marginBottom: 16 }} />
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fb' }}>
                    {['ID Único', 'Empleado', 'Curso', 'Modalidad', 'Fecha', 'Verificar'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {certsFiltrados.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin certificados</td></tr>
                  )}
                  {certsFiltrados.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>{c.id_unico}</code>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#1e293b', fontSize: 13, fontWeight: 600 }}>{c.nombre_participante}</td>
                      <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{c.nombre_curso}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ background: c.modalidad === 'presencial' ? '#eff6ff' : '#f0fdf4', color: c.modalidad === 'presencial' ? '#1d4ed8' : '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                          {c.modalidad === 'presencial' ? 'Presencial' : 'Online'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: 12 }}>{new Date(c.fecha_emision).toLocaleDateString('es-MX')}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <a href={`/verificar/${c.id_unico}`} target="_blank"
                          style={{ color: '#8B1A1A', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                          🔗 Ver
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Resultados */}
        {tabActiva === 'resultados' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Empleado', 'Curso', 'Calificación', 'Resultado', 'Intento', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin resultados</td></tr>
                )}
                {resultados.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '11px 16px', color: '#1e293b', fontSize: 13, fontWeight: 600 }}>{r.participante?.nombre}</td>
                    <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{r.curso?.nombre}</td>
                    <td style={{ padding: '11px 16px', fontWeight: 800, color: r.aprobado ? '#059669' : '#dc2626', fontSize: 15 }}>{r.calificacion}%</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ background: r.aprobado ? '#f0fdf4' : '#fef2f2', color: r.aprobado ? '#059669' : '#dc2626', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {r.aprobado ? '✓ Aprobado' : '✗ No aprobado'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#64748b', fontSize: 13 }}>#{r.intento || 1}</td>
                    <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB: Cursos disponibles */}
        {tabActiva === 'cursos' && (
          <div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Cursos activos de Hablando con Datos disponibles para tu personal</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
              {cursos.map(c => {
                const yaHecho = certificados.some(cert => cert.nombre_curso === c.nombre)
                return (
                  <div key={c.id} style={{ background: '#fff', border: `1px solid ${yaHecho ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>#{c.numero_curso}</span>
                      {yaHecho && <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>✓ Completado</span>}
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{c.nombre}</h3>
                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>⏱ {c.duracion} horas · {c.modalidad === 'presencial' ? 'Presencial' : 'Online'}</p>
                    {c.aval_institucion && <p style={{ color: '#7c3aed', fontSize: 11, marginBottom: 10 }}>🏛 {c.nombre_aval}</p>}
                    <a href={`/examen/${c.id}`} target="_blank"
                      style={{ display: 'inline-block', background: '#8B1A1A', color: '#fff', textDecoration: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                      Tomar examen →
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
