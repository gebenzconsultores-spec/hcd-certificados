import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, getExamenPorCurso, guardarResultadoExamen, crearParticipante, crearCertificado, siguienteConsecutivo } from '../lib/supabase'
import { generarYAbrirCertificado } from '../lib/certificado'

const MINIMO = 0.7 // 70% mínimo aprobatorio

export default function ExamenPublico() {
  const { cursoId } = useParams()
  const [fase, setFase] = useState('registro') // registro | examen | resultado | bloqueado
  const [curso, setCurso] = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [participante, setParticipante] = useState({ nombre: '', correo: '', whatsapp: '', empresa: '', es_universitario: false, universidad: '', carrera: '' })
  const [respuestas, setRespuestas] = useState({})
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [intento, setIntento] = useState(1)
  // Alumno reconocido (viene de su portal con sesión activa)
  const [alumno, setAlumno] = useState(null)
  const [mensajeBloqueo, setMensajeBloqueo] = useState('')

  const p = k => v => setParticipante(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.from('cursos').select('*').eq('id', cursoId).single()
      setCurso(data)
      const pregs = await getExamenPorCurso(cursoId)
      setPreguntas(pregs)

      // ¿Viene un alumno con sesión activa desde su portal?
      let sesion = null
      try { sesion = JSON.parse(sessionStorage.getItem('estudiante_portal') || 'null') } catch (_) {}

      if (sesion && sesion.id) {
        // Recargar sus datos frescos de la BD (por si cambió el acceso)
        const { data: alu } = await supabase.from('participantes').select('*').eq('id', sesion.id).maybeSingle()
        const registro = alu || sesion

        // Validar acceso al examen
        if (registro.acceso_examen === false) {
          setMensajeBloqueo('Tu empresa o el administrador aún no te ha habilitado el acceso a este examen. Solicita que te asignen al curso.')
          setFase('bloqueado')
          return
        }

        // Verificar que esté asignado a ESTE curso (asignación viva)
        const { data: asigs } = await supabase.from('asignaciones')
          .select('id, estado').eq('empleado_id', registro.id).eq('curso_id', cursoId)
        const asignado = (asigs || []).some(a => a.estado !== 'baja' && a.estado !== 'cancelado')

        if (!asignado && registro.tipo !== 'individual') {
          setMensajeBloqueo('No estás asignado a este curso. Pide a tu empresa que te inscriba antes de presentar el examen.')
          setFase('bloqueado')
          return
        }

        // Reconocido y con acceso: precargar datos y saltar registro
        setAlumno(registro)
        setParticipante({
          nombre: registro.nombre || '', correo: registro.correo || '', whatsapp: registro.whatsapp || '',
          empresa: registro.empresa_manual || '', es_universitario: !!registro.es_universitario,
          universidad: registro.universidad || '', carrera: registro.carrera || ''
        })
        setFase('examen')
      }
    }
    cargar()
  }, [cursoId])

  function iniciarExamen() {
    if (!participante.nombre || !participante.correo || !participante.whatsapp) return
    setFase('examen')
  }

  function seleccionar(preguntaId, opcion) {
    setRespuestas(p => ({ ...p, [preguntaId]: opcion }))
  }

  async function enviarExamen() {
    setLoading(true)
    let correctas = 0
    preguntas.forEach(p => {
      if (respuestas[p.id] !== undefined && Number(respuestas[p.id]) === Number(p.respuesta_correcta)) correctas++
    })
    const calificacion = preguntas.length > 0 ? correctas / preguntas.length : 0
    const aprobado = calificacion >= MINIMO

    // Determinar el participante: si es alumno reconocido, usar su id; si no, buscar/crear
    let partId
    let empresaIdCert = null
    if (alumno && alumno.id) {
      partId = alumno.id
      empresaIdCert = alumno.empresa_id || alumno.registrado_por_empresa || null
    } else {
      const { data: existing } = await supabase.from('participantes').select('id, empresa_id, registrado_por_empresa').eq('correo', participante.correo).maybeSingle()
      if (existing) {
        partId = existing.id
        empresaIdCert = existing.empresa_id || existing.registrado_por_empresa || null
      } else {
        const nuevo = await crearParticipante({
          nombre: participante.nombre,
          correo: participante.correo,
          whatsapp: participante.whatsapp,
          empresa_manual: participante.empresa,
          es_universitario: participante.es_universitario,
          universidad: participante.universidad || null,
          carrera: participante.carrera || null,
          tipo: 'individual'
        })
        partId = nuevo.id
      }
    }

    // Guardar resultado
    await guardarResultadoExamen({
      participante_id: partId,
      curso_id: cursoId,
      calificacion: Math.round(calificacion * 100),
      aprobado,
      respuestas_json: respuestas,
      intento
    })

    let certData = null
    if (aprobado) {
      const consec = await siguienteConsecutivo()
      const numCurso = curso.numero_certificado || curso.numero_curso || consec
      const id_unico = `HCD-${numCurso}-${consec}`
      certData = await crearCertificado({
        id_unico,
        participante_id: partId,
        curso_id: cursoId,
        empresa_id: empresaIdCert, // liga a la empresa para que aparezca en su portal
        nombre_participante: participante.nombre,
        nombre_curso: curso.nombre,
        lugar: curso.lugar_online || 'Online',
        duracion: curso.duracion,
        modalidad: 'online',
        instructor_nombre: 'Néstor Daniel Reyes Díaz',
        instructor_rfc: 'REDN-770428-433-0005',
        director_nombre: 'Mirna Rosas Delgado',
        fecha_emision: new Date().toISOString(),
      })
      // Marcar la asignación como completada (si existe)
      try {
        await supabase.from('asignaciones').update({ estado: 'completado' })
          .eq('empleado_id', partId).eq('curso_id', cursoId)
      } catch (_) {}
    }

    setResultado({ correctas, total: preguntas.length, calificacion: Math.round(calificacion * 100), aprobado, cert: certData, esDeEmpresa: !!empresaIdCert })
    setFase('resultado')
    setLoading(false)
  }

  function repetir() {
    setRespuestas({})
    setIntento(i => i + 1)
    setFase('examen')
    setResultado(null)
  }

  if (!curso) return <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Cargando...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      {/* Header */}
      <div style={{ background: '#8B1A1A', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} />
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Hablando con Datos</span>
        <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 13 }}>— Examen en línea</span>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        {/* FASE BLOQUEADO */}
        {fase === 'bloqueado' && (
          <div style={{ background: '#fff', border: '2px solid #f59e0b', borderRadius: 16, padding: '36px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#92400e', marginBottom: 8 }}>Acceso no habilitado</h2>
            <p style={{ color: '#64748b', fontSize: 15 }}>{mensajeBloqueo}</p>
          </div>
        )}

        {/* FASE REGISTRO (solo para individuales sin sesión) */}
        {fase === 'registro' && (
          <div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '28px 32px', marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{curso.nombre}</h1>
              <p style={{ color: '#64748b', fontSize: 14 }}>Duración: {curso.duracion} horas · Mínimo aprobatorio: 70%</p>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '28px 32px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>Tus datos para el certificado</h2>
              <Field label="Nombre completo *" value={participante.nombre} onChange={p('nombre')} placeholder="Como aparecerá en tu certificado" />
              <Field label="Correo electrónico *" type="email" value={participante.correo} onChange={p('correo')} placeholder="correo@ejemplo.com" />
              <Field label="WhatsApp *" value={participante.whatsapp} onChange={p('whatsapp')} placeholder="222 123 4567" />
              <Field label="Empresa donde trabajas (opcional)" value={participante.empresa} onChange={p('empresa')} placeholder="Para estadísticas" />

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
                <input type="checkbox" checked={participante.es_universitario} onChange={e => p('es_universitario')(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#8B1A1A' }} />
                <span style={{ color: '#374151', fontSize: 13 }}>Soy estudiante universitario</span>
              </label>
              {participante.es_universitario && (
                <>
                  <Field label="Universidad" value={participante.universidad} onChange={p('universidad')} placeholder="ej. BUAP, UDLAP" />
                  <Field label="Carrera" value={participante.carrera} onChange={p('carrera')} placeholder="ej. Ingeniería Industrial" />
                </>
              )}

              <button onClick={iniciarExamen}
                disabled={!participante.nombre || !participante.correo || !participante.whatsapp}
                style={{ width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
                Comenzar examen →
              </button>
            </div>
          </div>
        )}

        {/* FASE EXAMEN */}
        {fase === 'examen' && (
          <div>
            {alumno && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
                <span style={{ color: '#15803d', fontSize: 13 }}>✓ Presentando como <strong>{alumno.nombre}</strong>{alumno.id_empleado ? ` (${alumno.id_empleado})` : ''}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{curso.nombre}</h2>
              <span style={{ color: '#64748b', fontSize: 13 }}>{Object.keys(respuestas).length}/{preguntas.length} respondidas</span>
            </div>

            {preguntas.map((p, idx) => {
              const opciones = p.tipo === 'verdadero_falso' ? ['Verdadero', 'Falso'] : (p.opciones || [])
              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', marginBottom: 14 }}>
                  <p style={{ fontWeight: 600, color: '#1e293b', fontSize: 15, marginBottom: 14 }}>
                    <span style={{ color: '#8B1A1A', marginRight: 8 }}>{idx + 1}.</span>{p.pregunta}
                  </p>
                  {opciones.map((op, oidx) => (
                    <label key={oidx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', background: respuestas[p.id] === oidx ? '#f9f0f0' : '#f8f9fb', border: `1.5px solid ${respuestas[p.id] === oidx ? '#8B1A1A' : '#e2e8f0'}` }}>
                      <input type="radio" name={`q_${p.id}`} checked={respuestas[p.id] === oidx}
                        onChange={() => seleccionar(p.id, oidx)} style={{ accentColor: '#8B1A1A' }} />
                      <span style={{ color: '#374151', fontSize: 14 }}>{op}</span>
                    </label>
                  ))}
                </div>
              )
            })}

            <button onClick={enviarExamen}
              disabled={loading || Object.keys(respuestas).length < preguntas.length}
              style={{ width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
              {loading ? 'Enviando...' : 'Enviar examen'}
            </button>
            {Object.keys(respuestas).length < preguntas.length && (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
                Responde todas las preguntas para poder enviar
              </p>
            )}
          </div>
        )}

        {/* FASE RESULTADO */}
        {fase === 'resultado' && resultado && (
          <div style={{ background: '#fff', border: `2px solid ${resultado.aprobado ? '#16a34a' : '#dc2626'}`, borderRadius: 16, padding: '36px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{resultado.aprobado ? '🎉' : '😔'}</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: resultado.aprobado ? '#15803d' : '#dc2626', marginBottom: 8 }}>
              {resultado.aprobado ? '¡Felicidades, aprobaste!' : 'No aprobaste esta vez'}
            </h2>
            <p style={{ color: '#64748b', fontSize: 15, marginBottom: 24 }}>
              Obtuviste <strong>{resultado.calificacion}%</strong> — {resultado.correctas} de {resultado.total} respuestas correctas
              <br /><span style={{ fontSize: 13, color: '#94a3b8' }}>(mínimo para aprobar: 70%)</span>
            </p>

            {resultado.aprobado && (() => {
              // ¿El certificado quedó ligado a una empresa? Entonces NO descarga; lo gestiona RH
              const esDeEmpresa = resultado.esDeEmpresa
              if (esDeEmpresa) {
                return (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 20px' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                      <p style={{ color: '#1e40af', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Tu certificado quedó registrado</p>
                      <p style={{ color: '#475569', fontSize: 13 }}>
                        Solicítalo a través de tu área de <strong>Recursos Humanos</strong>. Ellos pueden descargarlo desde el portal de tu empresa.
                      </p>
                    </div>
                  </div>
                )
              }
              // Individual: sí puede descargar el suyo
              return resultado.cert ? (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 20px', marginBottom: 16 }}>
                    <div style={{ color: '#15803d', fontSize: 13, marginBottom: 4 }}>Tu ID de certificado</div>
                    <code style={{ color: '#166534', fontSize: 18, fontWeight: 800 }}>{resultado.cert.id_unico}</code>
                  </div>
                  <button onClick={() => generarYAbrirCertificado(resultado.cert)}
                    style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
                    📜 Descargar mi certificado en PDF
                  </button>
                </div>
              ) : null
            })()}

            {!resultado.aprobado && (
              <button onClick={repetir}
                style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                🔄 Intentar de nuevo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', color: '#1e293b' }} />
    </div>
  )
}
