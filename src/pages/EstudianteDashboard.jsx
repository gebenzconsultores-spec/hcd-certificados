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
  const [modalDatos, setModalDatos] = useState(false)

  useEffect(() => {
    const data = sessionStorage.getItem('estudiante_portal')
    if (!data) { navigate('/estudiante/acceso'); return }
    const est = JSON.parse(data)
    setEstudiante(est)
    cargar(est)
  }, [])

  async function cargar(est) {
    setLoading(true)
    // Cargar cada cosa por separado para que un join roto no vacíe todo
    try {
      const { data: certs } = await supabase.from('certificados').select('*, curso:cursos(nombre, aval_institucion, nombre_aval)').eq('participante_id', est.id).order('created_at', { ascending: false })
      setCertificados(certs || [])
    } catch (_) {
      const { data: certs } = await supabase.from('certificados').select('*').eq('participante_id', est.id)
      setCertificados(certs || [])
    }
    try {
      const { data: res } = await supabase.from('resultados_examen').select('*, curso:cursos(nombre, numero_curso)').eq('participante_id', est.id).order('created_at', { ascending: false })
      setResultados(res || [])
    } catch (_) { setResultados([]) }
    try {
      const { data: cursos } = await supabase.from('cursos').select('*').eq('activo', true).order('numero_curso', { ascending: false })
      setCursosDisponibles(cursos || [])
    } catch (_) { setCursosDisponibles([]) }
    // Asignaciones SIN join primero (más confiable), luego enriquece con microcurso
    let asig = []
    try {
      const r = await supabase.from('asignaciones').select('*').eq('empleado_id', est.id).order('created_at', { ascending: false })
      asig = r.data || []
    } catch (_) { asig = [] }
    setAsignaciones(asig)
    // Refrescar el consentimiento de oportunidades desde la BD (por si cambió)
    try {
      const { data: yo } = await supabase.from('participantes').select('disponible_oportunidades').eq('id', est.id).maybeSingle()
      if (yo) {
        setEstudiante(prev => ({ ...(prev || est), disponible_oportunidades: yo.disponible_oportunidades }))
        try {
          const sesion = JSON.parse(sessionStorage.getItem('estudiante_portal') || '{}')
          sessionStorage.setItem('estudiante_portal', JSON.stringify({ ...sesion, disponible_oportunidades: yo.disponible_oportunidades }))
        } catch (_) {}
      }
    } catch (_) {}
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
      <a href="https://wa.me/522223549353?text=Hola,%20necesito%20soporte%20con%20la%20plataforma%20de%20Hablando%20con%20Datos" target="_blank" rel="noopener noreferrer" title="Soporte por WhatsApp"
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 900, background: '#25D366', color: '#fff', borderRadius: 999, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14, boxShadow: '0 6px 20px rgba(37,211,102,.45)' }}>
        <svg width="20" height="20" viewBox="0 0 32 32" fill="#fff"><path d="M16 .396C7.164.396 0 7.56 0 16.396c0 2.885.755 5.598 2.078 7.946L.06 32l7.86-2.06A15.9 15.9 0 0016 32.396c8.836 0 16-7.164 16-16S24.836.396 16 .396zm0 29.2a13.2 13.2 0 01-6.72-1.84l-.48-.286-4.664 1.223 1.244-4.544-.313-.468A13.15 13.15 0 012.8 16.396C2.8 9.11 8.714 3.196 16 3.196S29.2 9.11 29.2 16.396 23.286 29.596 16 29.596zm7.24-9.87c-.397-.198-2.35-1.16-2.714-1.292-.364-.132-.63-.198-.895.199-.264.396-1.026 1.292-1.258 1.556-.232.264-.463.297-.86.099-.397-.198-1.676-.617-3.193-1.97-1.18-1.052-1.977-2.352-2.21-2.749-.231-.396-.025-.61.174-.807.179-.178.397-.463.596-.694.199-.232.264-.397.397-.661.132-.264.066-.496-.033-.694-.099-.198-.895-2.157-1.226-2.952-.323-.775-.65-.67-.895-.683l-.762-.013c-.264 0-.694.099-1.058.496-.364.397-1.39 1.359-1.39 3.317s1.423 3.849 1.622 4.113c.198.264 2.801 4.278 6.786 5.999.949.409 1.689.653 2.266.836.952.302 1.818.26 2.503.158.763-.114 2.35-.961 2.682-1.889.33-.928.33-1.723.231-1.889-.099-.165-.363-.264-.76-.462z"/></svg>
        Soporte
      </a>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModalDatos(true)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#1d4ed8', cursor: 'pointer', fontWeight: 600 }}>
              ✏️ Mis datos
            </button>
            <button onClick={salir} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#475569', cursor: 'pointer' }}>
              Cerrar sesión
            </button>
          </div>
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

        {/* Banner convocatoria (solo individuales) */}
        {!esDeEmpresa && <BannerConvocatoriaEstudiante onIr={() => setTab('proximos')} />}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
          {[
            { id: 'asignados', label: '⚡ Microcredenciales' },
            { id: 'certificados', label: '📜 Mis certificados' },
            { id: 'examenes', label: '📊 Mis exámenes' },
            { id: 'cursos', label: '🎓 Mis cursos' },
            ...(!esDeEmpresa ? [{ id: 'desbloquear', label: '🔑 Activar curso pagado' }] : []),
            ...(!esDeEmpresa ? [{ id: 'proximos', label: '📣 Convocatorias HCD' }] : []),
            ...(!esDeEmpresa ? [{ id: 'cotizaciones', label: '💼 Mis cotizaciones' }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#1d4ed8' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#1d4ed8' : '#64748b', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB MICROCURSOS ASIGNADOS (solo tipo microcurso) */}
        {tab === 'asignados' && (() => {
          const micros = asignaciones.filter(a => a.tipo === 'microcurso' || a.microcurso_titulo)
          return (
          <div>
            {micros.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                Aún no tienes microcredenciales asignadas.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                {micros.map(a => (
                  <div key={a.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                        {a.modalidad_asignacion === 'autogestivo' ? '📱 Autogestivo' : '⚡ Microcurso'}
                      </span>
                      <span style={{ background: a.estado === 'completado' ? '#f0fdf4' : '#fef9c3', color: a.estado === 'completado' ? '#059669' : '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                        {a.estado}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{a.microcurso_titulo || a.curso_nombre}</h3>
                    {a.microcurso?.descripcion && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{a.microcurso.descripcion}</p>}
                    {a.microcurso?.link_externo ? (
                      <a href={a.microcurso.link_externo} target="_blank"
                        style={{ display: 'inline-block', background: '#1d4ed8', color: '#fff', textDecoration: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 700 }}>
                        Tomar microcurso →
                      </a>
                    ) : (
                      <span style={{ color: '#f59e0b', fontSize: 12 }}>Enlace próximamente disponible</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )
        })()}

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
            {esDeEmpresa ? (
              <>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Cursos que tu empresa te asignó</p>
                <CursosAsignados estudiante={estudiante} certificados={certificados} />
              </>
            ) : (
              <>
                {/* Individual: solo cursos que ha desbloqueado/pagado */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                  <p style={{ color: '#1e40af', fontSize: 13 }}>
                    ℹ️ Para presentar un examen, primero debes adquirir el curso. Cotiza en "Convocatorias HCD" o activa tu curso pagado con tu ID de compra.
                  </p>
                </div>
                <MisCursosIndividual estudiante={estudiante} certificados={certificados} />
              </>
            )}
          </div>
        )}

        {/* TAB DESBLOQUEAR CON ID DE COMPRA (solo individual) */}
        {tab === 'desbloquear' && !esDeEmpresa && (
          <DesbloquearCurso estudiante={estudiante} cursosDisponibles={cursosDisponibles} onDone={() => cargar(estudiante)} />
        )}

        {/* TAB PRÓXIMOS CURSOS (solo individual) */}
        {tab === 'proximos' && !esDeEmpresa && (
          <ProximosEstudiante estudiante={estudiante} irACotizaciones={() => setTab('cotizaciones')} />
        )}

        {/* TAB MIS COTIZACIONES (solo individual) */}
        {tab === 'cotizaciones' && !esDeEmpresa && (
          <MisCotizacionesEstudiante estudiante={estudiante} />
        )}
      </div>

      {modalDatos && (
        <ModalMisDatos estudiante={estudiante} onClose={() => setModalDatos(false)} onActualizado={(nuevos) => setEstudiante(e => ({ ...e, ...nuevos }))} />
      )}
    </div>
  )
}

// ─── Modal: el estudiante edita sus propios datos ─────────────
function ModalMisDatos({ estudiante, onClose, onActualizado }) {
  const [datos, setDatos] = useState({
    nombre: estudiante.nombre || '',
    correo: estudiante.correo || '',
    whatsapp: estudiante.whatsapp || '',
    disponible_oportunidades: estudiante.disponible_oportunidades || false,
  })
  const [saving, setSaving] = useState(false)
  const d = k => v => setDatos(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!datos.nombre) { alert('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('participantes').update({
        nombre: datos.nombre, correo: datos.correo, whatsapp: datos.whatsapp,
        disponible_oportunidades: datos.disponible_oportunidades
      }).eq('id', estudiante.id)
      if (error) { alert('No se pudo guardar: ' + error.message); setSaving(false); return }
      // Sincronizar el nombre denormalizado en asignaciones (para que "Asignados" no quede viejo)
      try {
        await supabase.from('asignaciones').update({ empleado_nombre: datos.nombre }).eq('empleado_id', estudiante.id)
      } catch (_) {}
      // Actualizar la sesión guardada
      try {
        const sesion = JSON.parse(sessionStorage.getItem('estudiante_portal') || '{}')
        sessionStorage.setItem('estudiante_portal', JSON.stringify({ ...sesion, ...datos }))
      } catch (_) {}
      onActualizado(datos)
      alert('✅ Tus datos se actualizaron correctamente.')
      onClose()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 440, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Mis datos</h3>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>Corrige tu información de contacto.</p>

        <label style={estLbl}>Nombre completo *</label>
        <input value={datos.nombre} onChange={e => d('nombre')(e.target.value)} style={estInp} />

        <label style={{ ...estLbl, marginTop: 12 }}>Correo</label>
        <input value={datos.correo} onChange={e => d('correo')(e.target.value)} placeholder="correo@ejemplo.com" style={estInp} />

        <label style={{ ...estLbl, marginTop: 12 }}>WhatsApp</label>
        <input value={datos.whatsapp} onChange={e => d('whatsapp')(e.target.value)} placeholder="2221234567" style={estInp} />

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 18, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
          <input type="checkbox" checked={datos.disponible_oportunidades} onChange={e => d('disponible_oportunidades')(e.target.checked)} style={{ accentColor: '#059669', width: 18, height: 18, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: '#166534' }}>
            <strong>Quiero recibir nuevas oportunidades laborales</strong><br />
            <span style={{ color: '#15803d', fontSize: 12 }}>Autorizo a Hablando con Datos a compartir mi perfil profesional con empresas. Puedes desactivarlo cuando quieras.</span>
          </span>
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

const estLbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const estInp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

// ─── Cursos asignados (empleado de empresa) ───────────────────
function CursosAsignados({ estudiante, certificados }) {
  const [asignaciones, setAsignaciones] = useState([])
  useEffect(() => {
    supabase.from('asignaciones').select('*').eq('empleado_id', estudiante.id).then(({ data }) => {
      // Solo cursos (no microcursos) y que no estén dados de baja/cancelados
      const soloCursos = (data || []).filter(a =>
        a.tipo !== 'microcurso' && !a.microcurso_titulo &&
        a.estado !== 'baja' && a.estado !== 'cancelado'
      )
      setAsignaciones(soloCursos)
    })
  }, [])

  if (asignaciones.length === 0) {
    return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Tu empresa aún no te ha asignado cursos.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
      {asignaciones.map(a => {
        const yaHecho = certificados.some(cert => cert.nombre_curso === a.curso_nombre) || a.estado === 'completado'
        return (
          <div key={a.id} style={{ background: '#fff', border: `1px solid ${yaHecho ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 12, padding: '18px 20px' }}>
            {yaHecho && <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>✓ Completado</span>}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '8px 0 4px' }}>{a.curso_nombre}</h3>
            {a.fecha_programada && <p style={{ color: '#1d4ed8', fontSize: 12, marginBottom: 12 }}>📅 {new Date(a.fecha_programada + 'T00:00:00').toLocaleDateString('es-MX')} {a.hora_programada || ''}</p>}
            {!yaHecho && a.curso_id && (
              <a href={`/examen/${a.curso_id}`}
                style={{ display: 'inline-block', background: '#1d4ed8', color: '#fff', textDecoration: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700, marginTop: 8 }}>
                Presentar examen →
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Mis cursos (individual: solo los desbloqueados) ──────────
function MisCursosIndividual({ estudiante, certificados }) {
  const [cursos, setCursos] = useState([])
  useEffect(() => {
    cargarCursos()
  }, [])

  async function cargarCursos() {
    // Combinar: cursos comprados (con ID) + cursos asignados (convocatorias, manual)
    const [{ data: compras }, { data: asigs }] = await Promise.all([
      supabase.from('compras').select('*').eq('participante_id', estudiante.id).eq('estado', 'usado'),
      supabase.from('asignaciones').select('*').eq('empleado_id', estudiante.id)
    ])
    const lista = []
    ;(compras || []).forEach(c => lista.push({ id: 'c' + c.id, curso_id: c.curso_id, curso_nombre: c.curso_nombre, fecha: c.fecha_curso }))
    ;(asigs || []).forEach(a => {
      // Evitar duplicar si ya está por compra
      if (!lista.find(x => x.curso_nombre === (a.curso_nombre || a.microcurso_titulo))) {
        lista.push({ id: 'a' + a.id, curso_id: a.curso_id, curso_nombre: a.curso_nombre || a.microcurso_titulo, fecha: a.fecha_programada })
      }
    })
    setCursos(lista)
  }

  if (cursos.length === 0) {
    return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aún no tienes cursos activos. Activa uno con tu ID de compra o inscríbete a una convocatoria.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
      {cursos.map(c => {
        const yaHecho = certificados.some(cert => cert.nombre_curso === c.curso_nombre)
        return (
          <div key={c.id} style={{ background: '#fff', border: `1px solid ${yaHecho ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 12, padding: '18px 20px' }}>
            {yaHecho && <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>✓ Completado</span>}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '8px 0 4px' }}>{c.curso_nombre}</h3>
            {c.fecha && <p style={{ color: '#1d4ed8', fontSize: 12, marginBottom: 12 }}>📅 {new Date(c.fecha).toLocaleDateString('es-MX')}</p>}
            {!yaHecho && c.curso_id && (
              <a href={`/examen/${c.curso_id}`}
                style={{ display: 'inline-block', background: '#1d4ed8', color: '#fff', textDecoration: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700, marginTop: 8 }}>
                Presentar examen →
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Desbloquear curso con ID de compra (individual) ──────────
function DesbloquearCurso({ estudiante, cursosDisponibles, onDone }) {
  const [idCompra, setIdCompra] = useState('')
  const [fecha, setFecha] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [saving, setSaving] = useState(false)

  async function activar() {
    if (!idCompra) return
    setSaving(true); setError('')
    try {
      const { data: compra } = await supabase.from('compras').select('*')
        .eq('id_compra', idCompra.toUpperCase().trim())
        .eq('estado', 'activo').maybeSingle()
      if (!compra) { setError('ID de compra no válido o ya usado. Verifica con Hablando con Datos.'); setSaving(false); return }

      // Vincular la compra al participante y marcar usada
      await supabase.from('compras').update({
        estado: 'usado',
        participante_id: estudiante.id,
        participante_nombre: estudiante.nombre,
        tipo_comprador: 'individual',
        fecha_curso: fecha || null
      }).eq('id', compra.id)

      // Dar acceso al examen
      await supabase.from('participantes').update({ acceso_examen: true }).eq('id', estudiante.id)

      setExito(true)
      setTimeout(() => onDone(), 1500)
    } catch (e) {
      setError('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  if (exito) {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#15803d', marginBottom: 8 }}>¡Curso activado!</h3>
        <p style={{ color: '#15803d', fontSize: 14 }}>Ya puedes presentar tu examen desde "Mis cursos".</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '28px 32px' }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Activar curso pagado</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Ingresa el ID de compra que te dio Hablando con Datos al confirmar tu pago.</p>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>ID de compra</label>
        <input value={idCompra} onChange={e => setIdCompra(e.target.value.toUpperCase())} placeholder="COMPRA-0001"
          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', marginBottom: 14 }} />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Fecha del curso (opcional)</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', marginBottom: 20 }} />

        <button onClick={activar} disabled={saving || !idCompra}
          style={{ width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Activando...' : 'Activar y habilitar examen'}
        </button>

        <div style={{ background: '#eff6ff', borderRadius: 8, padding: '12px 14px', marginTop: 16, fontSize: 12, color: '#1e40af' }}>
          ¿No tienes ID de compra? Cotiza tu curso en la pestaña "Próximos cursos" y al confirmar tu pago te lo proporcionaremos.
        </div>
      </div>
    </div>
  )
}

// ─── Próximos cursos para estudiante individual ───────────────
function BannerConvocatoriaEstudiante({ onIr }) {
  const [convocatorias, setConvocatorias] = useState([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    (async () => {
      try {
        const hoy = new Date().toISOString().split('T')[0]
        const { data } = await supabase.from('proximos_cursos').select('*').gte('fecha', hoy).order('fecha', { ascending: true })
        if (!data) return
        // Solo las dirigidas a ESTUDIANTE (mostrar_en = 'estudiante' o 'ambos', o sin definir = ambos)
        const visibles = data.filter(c =>
          (!c.estado || c.estado === 'abierto') &&
          (!c.mostrar_en || c.mostrar_en === 'estudiante' || c.mostrar_en === 'ambos')
        )
        setConvocatorias(visibles)
      } catch (_) {}
    })()
  }, [])

  useEffect(() => {
    if (convocatorias.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % convocatorias.length), 5000)
    return () => clearInterval(t)
  }, [convocatorias])

  if (convocatorias.length === 0) return null
  const convocatoria = convocatorias[idx]

  return (
    <div style={{ background: 'linear-gradient(135deg,#8B1A1A,#a52222)', borderRadius: 14, padding: '20px 26px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>📣 Convocatoria HCD</div>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Hablando con Datos te invita a su siguiente curso</h3>
        <p style={{ color: 'rgba(255,255,255,.92)', fontSize: 14 }}>
          <strong>{convocatoria.curso_nombre}</strong> · 📅 {new Date(convocatoria.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}{convocatoria.hora ? ` · ${convocatoria.hora}` : ''} · vía Zoom
        </p>
        <p style={{ color: 'rgba(255,255,255,.85)', fontSize: 13, marginTop: 4 }}>
          {convocatoria.tipo_costo === 'sin_costo' ? '🎁 Sin costo' : '💰 Cupo limitado'}
        </p>
        {convocatoria.codigo_promo && <div style={{ display: 'inline-block', background: 'rgba(255,255,255,.2)', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginTop: 6 }}>🎟️ Código promo: {convocatoria.codigo_promo}</div>}
      </div>
      <button onClick={onIr} style={{ background: '#fff', color: '#8B1A1A', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Inscríbete →
      </button>
      {convocatorias.length > 1 && (
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
          {convocatorias.map((_, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, background: i === idx ? '#fff' : 'rgba(255,255,255,.4)', cursor: 'pointer', transition: 'all .3s' }} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProximosEstudiante({ estudiante, irACotizaciones }) {
  const [proximos, setProximos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [inscribiendo, setInscribiendo] = useState(null)
  const [matriz, setMatriz] = useState([])
  const [cursosInfo, setCursosInfo] = useState([])
  const [modalCotizar, setModalCotizar] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: prox }, { data: insc }, { data: mat }, { data: cur }] = await Promise.all([
      supabase.from('proximos_cursos').select('*').eq('estado', 'abierto').order('fecha', { ascending: true }),
      supabase.from('inscripciones').select('*'),
      supabase.from('precios_categoria').select('*'),
      supabase.from('cursos').select('id, categoria, duracion')
    ])
    setProximos(prox || [])
    setInscripciones(insc || [])
    setMatriz(mat || [])
    setCursosInfo(cur || [])
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
    // Con costo: abrir modal para generar cotización (1 persona)
    if (p.tipo_costo === 'con_costo') {
      const info = cursosInfo.find(c => c.id === p.curso_id) || null
      setModalCotizar({ proximo: p, cursoInfo: info })
      return
    }
    // Sin costo: inscripción directa (como antes)
    setInscribiendo(p.id)
    try {
      await supabase.from('inscripciones').insert({
        proximo_curso_id: p.id, curso_nombre: p.curso_nombre, fecha: p.fecha,
        participante_id: estudiante.id, participante_nombre: estudiante.nombre, participante_correo: estudiante.correo,
        origen: 'individual', estado: 'inscrito'
      })
      await supabase.from('proximos_cursos').update({ cupo_ocupado: (p.cupo_ocupado || 0) + 1 }).eq('id', p.id)

      // Dar acceso al examen
      await supabase.from('participantes').update({ acceso_examen: true }).eq('id', estudiante.id)

      // Registrar/actualizar en CURSOS CONFIRMADOS (calendario admin)
      try {
        const { data: existe } = await supabase.from('cursos_confirmados')
          .select('id, num_participantes').eq('curso_nombre', p.curso_nombre).eq('fecha_inicio', p.fecha).maybeSingle()
        if (existe) {
          await supabase.from('cursos_confirmados').update({ num_participantes: (existe.num_participantes || 0) + 1 }).eq('id', existe.id)
        } else {
          await supabase.from('cursos_confirmados').insert({
            curso_id: p.curso_id, curso_nombre: p.curso_nombre,
            fecha_inicio: p.fecha, hora: p.hora, num_participantes: 1,
            origen: 'proximo_curso', modalidad: 'zoom', estado: 'confirmado',
            notas: 'Convocatoria HCD'
          })
        }
      } catch (_) {}

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
                  {p.tipo_costo === 'sin_costo' ? '🎁 Gratis' : '💰 Con costo'}
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
                    {inscribiendo === p.id ? 'Inscribiendo...' : p.tipo_costo === 'sin_costo' ? `Inscribirme (${disp} lugares)` : 'Inscribirme'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalCotizar && (
        <ModalCotizarEstudiante
          estudiante={estudiante}
          proximo={modalCotizar.proximo}
          cursoInfo={modalCotizar.cursoInfo}
          matriz={matriz}
          onClose={() => setModalCotizar(null)}
          onDone={() => { setModalCotizar(null); irACotizaciones && irACotizaciones() }}
        />
      )}
    </div>
  )
}

// ─── Modal: el estudiante genera su cotización (1 persona) ─────
function ModalCotizarEstudiante({ estudiante, proximo, cursoInfo, matriz, onClose, onDone }) {
  const [saving, setSaving] = useState(false)

  const horas = Number(cursoInfo?.duracion) || 0
  const bloque = '1-5' // el individual siempre es 1 persona
  const precioBase = cursoInfo ? precioHoraCotEst(matriz, cursoInfo.categoria, bloque, tierDuracionCotEst(horas)) * horas : 0
  const subtotal = precioBase
  const ivaMonto = subtotal * IVA_COT_EST
  const total = subtotal + ivaMonto

  async function generar() {
    if (!cursoInfo) { alert('Espera a que carguen los datos del curso.'); return }
    if (precioBase <= 0) { alert('No se encontró precio en Precios y Catálogo para este curso. Contacta a HCD.'); return }
    setSaving(true)
    try {
      const year = new Date().getFullYear()
      const { data: foliosExist } = await supabase.from('cotizaciones').select('folio').like('folio', `HCD-COT-${year}-%`)
      let maxNum = 0
      ;(foliosExist || []).forEach(c => {
        const m = (c.folio || '').match(/HCD-COT-\d+-(\d+)/)
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
      })
      const folio = `HCD-COT-${year}-${String(maxNum + 1).padStart(4, '0')}`

      const payload = {
        folio,
        empresa_nombre: estudiante.nombre,
        contacto_nombre: estudiante.nombre,
        contacto_email: estudiante.correo || '',
        contacto_whatsapp: estudiante.whatsapp || estudiante.telefono || '',
        curso_id: proximo.curso_id,
        curso_nombre: proximo.curso_nombre,
        tipo_precio: 'persona',
        modalidad: 'online',
        num_personas: 1,
        dias: horas <= 8 ? 1 : horas <= 16 ? 2 : 3,
        precio_base: precioBase,
        descuento_tipo: null,
        descuento_valor: 0,
        requiere_viaticos: false,
        monto_viaticos: 0,
        aplica_iva: true,
        subtotal,
        iva: ivaMonto,
        total,
        es_cliente_nuevo: true,
        comision_porcentaje: 15,
        comision_monto: total * 0.15,
        incluye_consultoria: false,
        cupon_codigo: null,
        notas: `[Convocatoria HCD ${proximo.fecha}] Alumno individual: ${estudiante.nombre}`,
        fecha_deseada: proximo.fecha || null,
        empresa_id: null,
        empresa_registrada: false,
        estado: 'enviada'
      }

      const { error: errCot } = await supabase.from('cotizaciones').insert(payload)
      if (errCot) { alert('No se pudo guardar la cotización: ' + (errCot.message || 'error')); setSaving(false); return }

      try {
        await supabase.from('notificaciones').insert({
          tipo: 'cotizacion', titulo: 'Nueva cotización (alumno individual)',
          mensaje: `${estudiante.nombre} cotizó ${proximo.curso_nombre} por $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          link: '/admin/cotizaciones'
        })
      } catch (_) {}

      const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
      const ventana = window.open('', '_blank', 'width=900,height=700')
      if (ventana) {
        ventana.document.write(htmlCotizacionEstudiante({
          estudiante, curso_nombre: proximo.curso_nombre, bloque, horas, subtotal, iva_monto: ivaMonto, total, folio, fecha
        }))
        ventana.document.close()
      }

      alert(`✅ Cotización ${folio} generada.\n\nLa encuentras en "Mis cotizaciones". Adjunta ahí tu orden de compra; al confirmar tu pago, HCD te dará tu ID para activar el curso.`)
      onDone()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlayEst} onClick={onClose}>
      <div style={{ ...modalStyleEst }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Inscribirme: {proximo.curso_nombre}</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
          {new Date(proximo.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} · {proximo.hora} · vía Zoom
        </p>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          {precioBase <= 0 ? (
            <p style={{ color: '#92400e', fontSize: 13 }}>No se encontró precio para este curso. Contacta a HCD por WhatsApp.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 4 }}>
                <span>1 persona · {horas}h</span>
                <span>Subtotal ${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                <span>IVA (16%)</span><span>${ivaMonto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#1d4ed8', fontWeight: 800, borderTop: '1px solid #bfdbfe', paddingTop: 6 }}>
                <span>Total</span><span>${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
        </div>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>Al generar la cotización se descarga tu PDF y queda en "Mis cotizaciones", donde podrás adjuntar tu orden de compra.</p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={generar} disabled={saving || precioBase <= 0} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Generando...' : 'Generar cotización'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: Mis cotizaciones (alumno individual) ────────────────
function MisCotizacionesEstudiante({ estudiante }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    // Cotizaciones del alumno: por correo, individuales (sin empresa)
    const { data } = await supabase.from('cotizaciones').select('*')
      .eq('contacto_email', estudiante.correo || '___')
      .is('empresa_id', null)
      .order('created_at', { ascending: false })
    setCotizaciones(data || [])
    setLoading(false)
  }

  function estaVencida(cot) {
    if (cot.estado === 'aceptada' || cot.estado === 'aceptada_cliente' || cot.orden_compra_url) return false
    const dias = Math.floor((new Date() - new Date(cot.created_at)) / (1000 * 60 * 60 * 24))
    return dias > 30
  }
  function diasRestantes(cot) {
    return 30 - Math.floor((new Date() - new Date(cot.created_at)) / (1000 * 60 * 60 * 24))
  }

  // Opción A: adjuntar OC = marca la cotización aceptada + avisa a HCD (sin generar compra/venta)
  async function subirOC(cot, file) {
    if (!file) return
    if (file.type !== 'application/pdf') { alert('Solo se permiten archivos PDF'); return }
    setSubiendo(cot.id)
    try {
      const nombreArchivo = `${cot.folio}_${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage.from('ordenes-compra').upload(nombreArchivo, file, { upsert: true })
      if (upErr) { alert('No se pudo subir el PDF. Verifica el bucket "ordenes-compra" en Supabase.\n\nDetalle: ' + (upErr.message || '')); setSubiendo(null); return }
      const { data: urlData } = supabase.storage.from('ordenes-compra').getPublicUrl(nombreArchivo)

      const { error: errCot } = await supabase.from('cotizaciones').update({
        orden_compra_url: urlData.publicUrl, orden_compra_nombre: file.name, estado: 'aceptada'
      }).eq('id', cot.id)
      if (errCot) { alert('Hubo un problema al actualizar la cotización: ' + (errCot.message || '')); setSubiendo(null); return }

      try {
        await supabase.from('notificaciones').insert({
          tipo: 'orden_compra', titulo: 'Orden de compra recibida (individual)',
          mensaje: `${estudiante.nombre} subió OC para ${cot.curso_nombre}. Confirma el pago y genera su ID de compra.`,
          link: '/admin/cotizaciones'
        })
      } catch (_) {}

      alert('✅ Orden de compra recibida. HCD confirmará tu pago y te dará tu ID de compra para activar el curso en "Activar curso pagado".')
      await cargar()
    } catch (e) {
      alert('Error inesperado: ' + (e.message || 'intenta de nuevo'))
    } finally { setSubiendo(null) }
  }

  async function eliminar(cot) {
    if (!window.confirm('¿Eliminar esta cotización?')) return
    const { error } = await supabase.from('cotizaciones').delete().eq('id', cot.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    await cargar()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando cotizaciones...</div>

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>Tus cotizaciones. Adjunta tu orden de compra para confirmar tu pago.</p>
      {cotizaciones.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💼</div>
          <p style={{ color: '#64748b', fontSize: 14 }}>Aún no tienes cotizaciones. Genera una desde "Convocatorias HCD".</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {cotizaciones.map(cot => {
            const vencida = estaVencida(cot)
            const dias = diasRestantes(cot)
            const aceptada = cot.estado === 'aceptada' || cot.estado === 'aceptada_cliente' || cot.orden_compra_url
            return (
              <div key={cot.id} style={{ background: '#fff', border: `1px solid ${aceptada ? '#bbf7d0' : vencida ? '#fecaca' : '#e2e8f0'}`, borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{cot.folio}</code>
                      {aceptada ? (
                        <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>✓ OC recibida</span>
                      ) : vencida ? (
                        <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>⏳ Vencida</span>
                      ) : (
                        <span style={{ background: '#fef9c3', color: '#92400e', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Vence en {dias} días</span>
                      )}
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{cot.curso_nombre}</h3>
                    <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                      Total: <strong style={{ color: '#1d4ed8' }}>${cot.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Generada: {new Date(cot.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    {!aceptada && (
                      <label style={{ background: '#1d4ed8', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: subiendo === cot.id ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                        {subiendo === cot.id ? 'Procesando...' : '⬆️ Adjuntar orden de compra'}
                        <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={subiendo === cot.id}
                          onChange={e => subirOC(cot, e.target.files[0])} />
                      </label>
                    )}
                    {cot.orden_compra_url && (
                      <a href={cot.orden_compra_url} target="_blank" style={{ background: '#f0fdf4', color: '#059669', padding: '6px 14px', borderRadius: 8, fontSize: 11, textDecoration: 'none', fontWeight: 600, border: '1px solid #bbf7d0' }}>📎 Ver OC</a>
                    )}
                    <button onClick={() => eliminar(cot)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>🗑 Eliminar</button>
                  </div>
                </div>
                {aceptada && (
                  <div style={{ marginTop: 14, background: '#eff6ff', border: '1px dashed #1d4ed8', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#1e40af' }}>
                    HCD confirmará tu pago y te dará tu <strong>ID de compra</strong>. Con él, activa el curso en la pestaña "🔑 Activar curso pagado".
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Precio de convocatoria para alumno individual (mismo modelo que el cotizador) ───
const IVA_COT_EST = 0.16
const EMAIL_COT_EST = 'luisgomez@hablandocondatos.com.mx'
const overlayEst = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalStyleEst = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 460, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }

function tierDuracionCotEst(horas) {
  const h = Number(horas) || 0
  if (h <= 8) return '1'
  if (h <= 16) return '2'
  if (h <= 24) return '3'
  return '4'
}
function precioHoraCotEst(matriz, categoria, bloque, tier) {
  const r = (matriz || []).find(x => x.categoria === (categoria || 'B') && x.bloque === bloque && (x.duracion_tier || '1') === tier)
  return r ? Number(r.precio_hora) || 0 : 0
}

function htmlCotizacionEstudiante({ estudiante, curso_nombre, bloque, horas, subtotal, iva_monto, total, folio, fecha }) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Cotización ${folio}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',sans-serif;color:#1e293b;background:#fff;}
.page{max-width:800px;margin:0 auto;padding:40px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #8B1A1A;}
.company{font-size:22px;font-weight:800;color:#8B1A1A;}
.sub{font-size:11px;color:#64748b;margin-top:2px;}
.folio-area{text-align:right;}
.folio-label{font-size:11px;color:#64748b;letter-spacing:1px;text-transform:uppercase;}
.folio-val{font-size:18px;font-weight:800;color:#8B1A1A;}
.fecha{color:#64748b;font-size:12px;margin-top:4px;}
.seccion{margin-bottom:24px;}
.seccion h3{font-size:13px;font-weight:700;color:#8B1A1A;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.dato label{font-size:11px;color:#64748b;display:block;margin-bottom:2px;}
.dato span{font-size:14px;color:#1e293b;font-weight:500;}
table{width:100%;border-collapse:collapse;margin-top:8px;}
th{background:#f8f9fb;padding:10px 14px;text-align:left;font-size:11px;color:#64748b;letter-spacing:.5px;text-transform:uppercase;}
td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}
.total-row td{font-weight:800;font-size:15px;color:#8B1A1A;border-top:2px solid #8B1A1A;border-bottom:none;}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:11px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body><div class="page">
<div class="header">
  <div>
    <div class="company">● Hablando con Datos</div>
    <div class="sub">Consultoría y Capacitación en Sistemas de Gestión</div>
    <div class="sub" style="margin-top:4px">Gerencia de Ventas</div>
    <div class="sub">WhatsApp: 222 354 9353 · ${EMAIL_COT_EST}</div>
  </div>
  <div class="folio-area">
    <div class="folio-label">Cotización</div>
    <div class="folio-val">${folio}</div>
    <div class="fecha">Fecha: ${fecha}</div>
    <div class="fecha">Vigencia: 30 días naturales</div>
  </div>
</div>
<div class="seccion">
  <h3>Datos del alumno</h3>
  <div class="grid2">
    <div class="dato"><label>Nombre</label><span>${estudiante.nombre || ''}</span></div>
    <div class="dato"><label>Correo</label><span>${estudiante.correo || ''}</span></div>
  </div>
</div>
<div class="seccion">
  <h3>Detalle de la cotización</h3>
  <table>
    <thead><tr><th>Concepto</th><th>Detalle</th><th style="text-align:right">Importe</th></tr></thead>
    <tbody>
      <tr><td><strong>${curso_nombre}</strong></td><td>1 persona · ${horas}h</td><td style="text-align:right">$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">Subtotal</td><td style="text-align:right">$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">IVA (16%)</td><td style="text-align:right">$${iva_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
      <tr class="total-row"><td colspan="2" style="text-align:right">TOTAL</td><td style="text-align:right">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (IVA incl.)</td></tr>
    </tbody>
  </table>
</div>
<div class="seccion" style="background:#f8f9fb;border-radius:8px;padding:16px;">
  <h3 style="margin-bottom:8px">Condiciones</h3>
  <p style="font-size:12px;color:#475569;line-height:1.8">
    • Cotización válida por 30 días naturales.<br/>
    • Precios en pesos mexicanos (MXN). IVA del 16% incluido.<br/>
    • Al confirmar tu pago, HCD te dará un ID de compra para activar el curso.<br/>
    • Incluye material didáctico y constancia con folio único verificable.<br/>
    • Contacto: WhatsApp 222 354 9353 · ${EMAIL_COT_EST}
  </p>
</div>
<div class="footer">
  <p>Hablando con Datos — Consultoría y Capacitación en Sistemas de Gestión · Puebla, México</p>
  <p style="margin-top:4px">Folio: ${folio} · Gerencia de Ventas: 222 354 9353 · ${EMAIL_COT_EST}</p>
</div>
</div><script>window.onload=()=>{window.print();}</script></body></html>`
}
