import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generarYAbrirCertificado } from '../lib/certificado'

const WA_SOPORTE = '522223549353'

export default function EstudianteDashboard() {
  const navigate = useNavigate()
  const [estudiante, setEstudiante] = useState(null)
  const [certificados, setCertificados] = useState([])
  const [resultados, setResultados] = useState([])
  const [cursosDisponibles, setCursosDisponibles] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('asignados')

  useEffect(() => {
    const data = sessionStorage.getItem('estudiante_portal')
    if (!data) { navigate('/estudiante/acceso'); return }
    const est = JSON.parse(data)
    setEstudiante(est)
    cargar(est)
  }, [])

  async function cargar(est) {
    setLoading(true)
    const [{ data: certs }, { data: res }, { data: cursos }, { data: asig }] = await Promise.all([
      supabase.from('certificados').select('*, curso:cursos(nombre, aval_institucion, nombre_aval)').eq('participante_id', est.id).order('created_at', { ascending: false }),
      supabase.from('resultados_examen').select('*, curso:cursos(nombre, numero_curso)').eq('participante_id', est.id).order('created_at', { ascending: false }),
      supabase.from('cursos').select('*').eq('activo', true).order('numero_curso', { ascending: false }),
      supabase.from('asignaciones').select('*, microcurso:microcursos(titulo, descripcion, link_externo, duracion_min)').eq('empleado_id', est.id).order('created_at', { ascending: false })
    ])
    setCertificados(certs || [])
    setResultados(res || [])
    setCursosDisponibles(cursos || [])
    setAsignaciones(asig || [])
    setLoading(false)
  }

  function salir() {
    sessionStorage.removeItem('estudiante_portal')
    navigate('/estudiante/acceso')
  }

  // REGLA DE DESCARGA:
  // - Si es de empresa (tiene empresa_id): NO descarga, mensaje RH
  // - Si es individual: 1 descarga gratis, luego mensaje de contacto
  const esDeEmpresa = !!estudiante?.empresa_id

  async function intentarDescargar(cert) {
    if (esDeEmpresa) return // no debería llamarse, el botón está bloqueado

    // Individual: verificar contador de descargas
    if ((cert.descargas_count || 0) >= 1) {
      // Ya descargó una vez
      return
    }

    // Permitir descarga y registrar
    await generarYAbrirCertificado(cert)
    await supabase.from('certificados').update({
      descargas_count: (cert.descargas_count || 0) + 1,
      primera_descarga: cert.primera_descarga || new Date().toISOString()
    }).eq('id', cert.id)
    // Recargar
    cargar(estudiante)
  }

  if (!estudiante) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, background: '#1d4ed8', borderRadius: '50%' }} />
            <span style={{ color: '#1d4ed8', fontWeight: 800, fontSize: 15 }}>Hablando con Datos</span>
            <span style={{ color: '#d1d5db' }}>|</span>
            <span style={{ color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{estudiante.nombre}</span>
            {estudiante.id_empleado && (
              <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{estudiante.id_empleado}</code>
            )}
          </div>
          <button onClick={salir} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Mi panel de capacitación</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Tus exámenes, certificados y cursos disponibles</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Certificados obtenidos', value: certificados.length, color: '#1d4ed8' },
            { label: 'Exámenes presentados', value: resultados.length, color: '#059669' },
            { label: 'Aprobados', value: resultados.filter(r => r.aprobado).length, color: '#8B1A1A' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 22px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{loading ? '—' : s.value}</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
          {[
            { id: 'asignados', label: '⚡ Mis microcursos' },
            { id: 'certificados', label: '📜 Mis certificados' },
            { id: 'examenes', label: '📊 Mis exámenes' },
            { id: 'cursos', label: '🎓 Cursos disponibles' },
            ...(!esDeEmpresa ? [{ id: 'proximos', label: '📆 Próximos cursos' }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#1d4ed8' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#1d4ed8' : '#64748b', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB MICROCURSOS ASIGNADOS */}
        {tab === 'asignados' && (
          <div>
            {asignaciones.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                Tu empresa aún no te ha asignado microcursos. ¡Pronto verás aquí tus capacitaciones!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                {asignaciones.map(a => (
                  <div key={a.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                        {a.modalidad_asignacion === 'autogestivo' ? '📱 Autogestivo' : '🎥 Zoom'}
                      </span>
                      <span style={{ background: a.estado === 'completado' ? '#f0fdf4' : '#fef9c3', color: a.estado === 'completado' ? '#059669' : '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                        {a.estado}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{a.microcurso_titulo || a.curso_nombre}</h3>
                    {a.microcurso?.descripcion && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{a.microcurso.descripcion}</p>}
                    {a.fecha_programada && <p style={{ color: '#1d4ed8', fontSize: 12, marginBottom: 10 }}>📅 {new Date(a.fecha_programada).toLocaleDateString('es-MX')} {a.hora_programada || ''}</p>}
                    {a.microcurso?.link_externo ? (
                      <a href={a.microcurso.link_externo} target="_blank"
                        style={{ display: 'inline-block', background: '#1d4ed8', color: '#fff', textDecoration: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 700 }}>
                        Tomar microcurso →
                      </a>
                    ) : a.tipo === 'microcurso' ? (
                      <span style={{ color: '#f59e0b', fontSize: 12 }}>Enlace próximamente disponible</span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: 12 }}>Curso programado por tu empresa</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CERTIFICADOS */}
        {tab === 'certificados' && (
          <div>
            {/* Aviso según tipo */}
            {esDeEmpresa ? (
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                <p style={{ color: '#713f12', fontSize: 13 }}>
                  ℹ️ Tus certificados son gestionados por tu empresa. Para obtener una copia, solicítala a tu <strong>departamento de Recursos Humanos</strong>.
                </p>
              </div>
            ) : (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                <p style={{ color: '#1e40af', fontSize: 13 }}>
                  ℹ️ Tienes <strong>1 descarga gratuita</strong> por certificado. Para copias adicionales, contacta a Hablando con Datos.
                </p>
              </div>
            )}

            {certificados.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                Aún no tienes certificados. ¡Presenta un examen para obtener el tuyo!
              </div>
            )}

            <div style={{ display: 'grid', gap: 12 }}>
              {certificados.map(cert => {
                const yaDescargo = (cert.descargas_count || 0) >= 1
                return (
                  <div key={cert.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{cert.id_unico}</code>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginTop: 8 }}>{cert.nombre_curso}</h3>
                      <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                        {cert.lugar} · {cert.duracion} hrs · {new Date(cert.fecha_emision).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      {esDeEmpresa ? (
                        <a href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent('Hola, soy ' + estudiante.nombre + ' y necesito información sobre mi certificado ' + cert.id_unico)}`}
                          target="_blank"
                          style={{ background: '#f1f5f9', color: '#64748b', padding: '8px 16px', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                          Solicitar con RH
                        </a>
                      ) : yaDescargo ? (
                        <>
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Ya descargado</span>
                          <a href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent('Hola, necesito una copia adicional de mi certificado ' + cert.id_unico)}`}
                            target="_blank"
                            style={{ background: '#25d366', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 700 }}>
                            💬 Solicitar copia
                          </a>
                        </>
                      ) : (
                        <button onClick={() => intentarDescargar(cert)}
                          style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          📥 Descargar (1 vez gratis)
                        </button>
                      )}
                      <a href={`/verificar/${cert.id_unico}`} target="_blank" style={{ color: '#64748b', fontSize: 11, textDecoration: 'none' }}>
                        🔗 Ver verificación
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB EXÁMENES */}
        {tab === 'examenes' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Curso', 'Calificación', 'Resultado', 'Intento', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '11px 18px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aún no has presentado exámenes</td></tr>
                )}
                {resultados.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 18px', color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{r.curso?.nombre}</td>
                    <td style={{ padding: '12px 18px', fontWeight: 800, color: r.aprobado ? '#059669' : '#dc2626', fontSize: 15 }}>{r.calificacion}%</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ background: r.aprobado ? '#f0fdf4' : '#fef2f2', color: r.aprobado ? '#059669' : '#dc2626', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {r.aprobado ? '✓ Aprobado' : '✗ No aprobado'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748b', fontSize: 13 }}>#{r.intento || 1}</td>
                    <td style={{ padding: '12px 18px', color: '#94a3b8', fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CURSOS DISPONIBLES */}
        {tab === 'cursos' && (
          <div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Cursos en línea que puedes tomar</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
              {cursosDisponibles.map(c => {
                const yaHecho = certificados.some(cert => cert.nombre_curso === c.nombre)
                return (
                  <div key={c.id} style={{ background: '#fff', border: `1px solid ${yaHecho ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>#{c.numero_curso}</span>
                      {yaHecho && <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>✓ Completado</span>}
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{c.nombre}</h3>
                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>⏱ {c.duracion} hrs · {c.modalidad === 'presencial' ? 'Presencial' : 'Online'}</p>
                    {!yaHecho && (
                      <a href={`/examen/${c.id}`} target="_blank"
                        style={{ display: 'inline-block', background: '#1d4ed8', color: '#fff', textDecoration: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700 }}>
                        Presentar examen →
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB PRÓXIMOS CURSOS (solo individual) */}
        {tab === 'proximos' && !esDeEmpresa && (
          <ProximosEstudiante estudiante={estudiante} />
        )}
      </div>
    </div>
  )
}

// ─── Próximos cursos para estudiante individual ───────────────
function ProximosEstudiante({ estudiante }) {
  const [proximos, setProximos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [inscribiendo, setInscribiendo] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: prox }, { data: insc }] = await Promise.all([
      supabase.from('proximos_cursos').select('*').eq('estado', 'abierto').order('fecha', { ascending: true }),
      supabase.from('inscripciones').select('*')
    ])
    setProximos(prox || [])
    setInscripciones(insc || [])
    setLoading(false)
  }

  function fmtFecha(f) {
    return new Date(f + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  function cuposDisp(p) {
    return p.cupo_maximo - inscripciones.filter(i => i.proximo_curso_id === p.id).length
  }
  function yaInscrito(p) {
    return inscripciones.some(i => i.proximo_curso_id === p.id && i.participante_id === estudiante.id)
  }

  async function inscribirme(p) {
    if (p.tipo_costo === 'con_costo') {
      alert('Este curso tiene costo. Por favor cotízalo o contacta a HCD para tu inscripción.')
      return
    }
    setInscribiendo(p.id)
    try {
      await supabase.from('inscripciones').insert({
        proximo_curso_id: p.id, curso_nombre: p.curso_nombre, fecha: p.fecha,
        participante_id: estudiante.id, participante_nombre: estudiante.nombre, participante_correo: estudiante.correo,
        origen: 'individual', estado: 'inscrito'
      })
      await supabase.from('proximos_cursos').update({ cupo_ocupado: (p.cupo_ocupado || 0) + 1 }).eq('id', p.id)
      await cargar()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setInscribiendo(null) }
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando...</div>

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>Cursos programados por Zoom. Inscríbete a los que te interesen.</p>
      {proximos.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          No hay próximos cursos por ahora.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
          {proximos.map(p => {
            const disp = cuposDisp(p)
            const inscrito = yaInscrito(p)
            return (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', borderTop: `4px solid ${p.tipo_costo === 'sin_costo' ? '#059669' : '#8B1A1A'}` }}>
                <span style={{ background: p.tipo_costo === 'sin_costo' ? '#f0fdf4' : '#f9f0f0', color: p.tipo_costo === 'sin_costo' ? '#059669' : '#8B1A1A', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  {p.tipo_costo === 'sin_costo' ? '🎁 Gratis' : `$${Number(p.precio).toLocaleString('es-MX')}`}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '8px 0' }}>{p.curso_nombre}</h3>
                <div style={{ color: '#475569', fontSize: 13 }}>📅 {fmtFecha(p.fecha)}</div>
                <div style={{ color: '#475569', fontSize: 13, marginBottom: 12 }}>🕐 {p.hora} · 🎥 Zoom</div>
                {inscrito ? (
                  <div style={{ background: '#f0fdf4', color: '#059669', borderRadius: 8, padding: '10px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>✓ Ya estás inscrito</div>
                ) : disp <= 0 ? (
                  <button disabled style={{ width: '100%', background: '#f1f5f9', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'not-allowed' }}>Cupo lleno</button>
                ) : (
                  <button onClick={() => inscribirme(p)} disabled={inscribiendo === p.id}
                    style={{ width: '100%', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {inscribiendo === p.id ? 'Inscribiendo...' : p.tipo_costo === 'sin_costo' ? `Inscribirme (${disp} lugares)` : 'Ver detalles'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
