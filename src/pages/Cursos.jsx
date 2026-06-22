import { useEffect, useState } from 'react'
import { getCursos, crearCurso, actualizarCurso, siguienteNumeroCurso, guardarPreguntas, getExamenPorCurso, supabase } from '../lib/supabase'

export default function Cursos() {
  const [cursos, setCursos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalExamen, setModalExamen] = useState(null)
  const [modalBorrar, setModalBorrar] = useState(null)
  const [form, setForm] = useState({ nombre: '', duracion: '', modalidad: 'presencial', aval_institucion: false, nombre_aval: '' })
  const [preguntas, setPreguntas] = useState([])
  const [saving, setSaving] = useState(false)
  const [borrandoId, setBorrandoId] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const data = await getCursos()
    setCursos(data)
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function guardarCurso() {
    if (!form.nombre || !form.duracion) return
    setSaving(true)
    try {
      const numero = await siguienteNumeroCurso()
      await crearCurso({ ...form, numero_curso: numero, lugar_online: form.modalidad === 'online' ? 'Puebla, Pue.' : '' })
      await cargar()
      setModal(false)
      setForm({ nombre: '', duracion: '', modalidad: 'presencial', aval_institucion: false, nombre_aval: '' })
    } finally { setSaving(false) }
  }

  function abrirEditar(curso) {
    setForm({ nombre: curso.nombre, duracion: String(curso.duracion), modalidad: curso.modalidad, aval_institucion: curso.aval_institucion || false, nombre_aval: curso.nombre_aval || '' })
    setModalEditar(curso)
  }

  async function guardarEdicion() {
    if (!form.nombre || !form.duracion || !modalEditar) return
    setSaving(true)
    try {
      await actualizarCurso(modalEditar.id, { nombre: form.nombre, duracion: Number(form.duracion), modalidad: form.modalidad, aval_institucion: form.aval_institucion, nombre_aval: form.nombre_aval })
      await cargar()
      setModalEditar(null)
      setForm({ nombre: '', duracion: '', modalidad: 'presencial', aval_institucion: false, nombre_aval: '' })
    } finally { setSaving(false) }
  }

  async function borrarCurso() {
    if (!modalBorrar) return
    setBorrandoId(modalBorrar.id)
    try {
      await supabase.from('preguntas').delete().eq('curso_id', modalBorrar.id)
      await supabase.from('cursos').delete().eq('id', modalBorrar.id)
      await cargar()
      setModalBorrar(null)
    } finally { setBorrandoId(null) }
  }

  async function abrirExamen(curso) {
    const pregs = await getExamenPorCurso(curso.id)
    setPreguntas(pregs.length > 0 ? pregs.map(p => ({ ...p, opciones: p.opciones || ['', '', '', ''] })) : [preguntaVacia()])
    setModalExamen(curso)
  }

  function preguntaVacia() {
    return { pregunta: '', tipo: 'opcion_multiple', opciones: ['', '', '', ''], respuesta_correcta: 0 }
  }

  function agregarPregunta() { setPreguntas(p => [...p, preguntaVacia()]) }

  function actualizarPregunta(idx, campo, valor) {
    setPreguntas(p => p.map((q, i) => i === idx ? { ...q, [campo]: valor } : q))
  }

  function actualizarOpcion(idx, oidx, valor) {
    setPreguntas(p => p.map((q, i) => {
      if (i !== idx) return q
      const ops = [...q.opciones]; ops[oidx] = valor
      return { ...q, opciones: ops }
    }))
  }

  async function guardarExamen() {
    if (!modalExamen) return
    setSaving(true)
    try {
      const rows = preguntas.filter(p => p.pregunta.trim()).map(p => ({
        pregunta: p.pregunta, tipo: p.tipo,
        opciones: p.tipo === 'opcion_multiple' ? p.opciones : null,
        respuesta_correcta: p.respuesta_correcta
      }))
      await guardarPreguntas(modalExamen.id, rows)
      setModalExamen(null)
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40 }}>Cargando cursos...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Cursos</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Administra el catálogo de cursos y sus exámenes</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Nuevo curso</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
        {cursos.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            No hay cursos. Crea el primero.
          </div>
        )}
        {cursos.map(c => (
          <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                Curso #{c.numero_curso}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ background: c.modalidad === 'presencial' ? '#eff6ff' : '#f0fdf4', color: c.modalidad === 'presencial' ? '#1d4ed8' : '#059669', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {c.modalidad === 'presencial' ? 'Presencial' : 'Online'}
                </span>
                {/* Botón editar */}
                <button onClick={() => abrirEditar(c)} title="Editar curso"
                  style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, color: '#475569' }}>
                  ✏️
                </button>
                {/* Botón borrar */}
                <button onClick={() => setModalBorrar(c)} title="Eliminar curso"
                  style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>
                  🗑
                </button>
              </div>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{c.nombre}</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>⏱ {c.duracion} horas</p>
            {c.aval_institucion && <p style={{ color: '#7c3aed', fontSize: 12, marginBottom: 10 }}>🏛 Aval: {c.nombre_aval}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => abrirExamen(c)} style={btnSecondary}>📝 Editar examen</button>
              <a href={`/examen/${c.id}`} target="_blank" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                🔗 Ver examen
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nuevo curso */}
      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Nuevo curso</h3>
            <Field label="Nombre del curso *" value={form.nombre} onChange={f('nombre')} placeholder="ej. Core Tools, 8D, ISO 9001" />
            <Field label="Duración en horas *" value={form.duracion} onChange={f('duracion')} placeholder="ej. 24" type="number" />
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Modalidad *</label>
              <select value={form.modalidad} onChange={e => f('modalidad')(e.target.value)} style={inputStyle}>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
              <input type="checkbox" checked={form.aval_institucion} onChange={e => f('aval_institucion')(e.target.checked)} />
              <span style={{ color: '#374151', fontSize: 13 }}>¿Tiene aval de institución certificadora?</span>
            </label>
            {form.aval_institucion && <Field label="Nombre del aval" value={form.nombre_aval} onChange={f('nombre_aval')} placeholder="ej. Ceneval, UNAM, TEC" />}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardarCurso} disabled={saving || !form.nombre || !form.duracion} style={btnPrimary}>
                {saving ? 'Guardando...' : 'Crear curso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar curso */}
      {modalEditar && (
        <div style={overlayStyle} onClick={() => setModalEditar(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Editar curso #{modalEditar.numero_curso}</h3>
            <Field label="Nombre del curso *" value={form.nombre} onChange={f('nombre')} placeholder="ej. Core Tools, 8D, ISO 9001" />
            <Field label="Duración en horas *" value={form.duracion} onChange={f('duracion')} placeholder="ej. 24" type="number" />
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Modalidad *</label>
              <select value={form.modalidad} onChange={e => f('modalidad')(e.target.value)} style={inputStyle}>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
              <input type="checkbox" checked={form.aval_institucion} onChange={e => f('aval_institucion')(e.target.checked)} />
              <span style={{ color: '#374151', fontSize: 13 }}>¿Tiene aval de institución certificadora?</span>
            </label>
            {form.aval_institucion && <Field label="Nombre del aval" value={form.nombre_aval} onChange={f('nombre_aval')} placeholder="ej. Ceneval, UNAM, TEC" />}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalEditar(null)} style={btnGhost}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={saving || !form.nombre || !form.duracion} style={btnPrimary}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar borrar */}
      {modalBorrar && (
        <div style={overlayStyle} onClick={() => setModalBorrar(null)}>
          <div style={{ ...modalStyle, width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>¿Eliminar este curso?</h3>
              <p style={{ color: '#64748b', fontSize: 14 }}>
                Se eliminará <strong>"{modalBorrar.nombre}"</strong> y todas sus preguntas de examen. Los certificados ya emitidos no se afectan.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setModalBorrar(null)} style={btnGhost}>Cancelar</button>
              <button onClick={borrarCurso} disabled={!!borrandoId}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {borrandoId ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal examen */}
      {modalExamen && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, width: 700, maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={modalTitle}>Examen: {modalExamen.nombre}</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Mínimo aprobatorio: 60%. Los participantes pueden repetirlo.</p>
            {preguntas.map((p, idx) => (
              <div key={idx} style={{ background: '#f8f9fb', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: '#8B1A1A', fontWeight: 700, fontSize: 13 }}>Pregunta {idx + 1}</span>
                  <button onClick={() => setPreguntas(pr => pr.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                <textarea value={p.pregunta} onChange={e => actualizarPregunta(idx, 'pregunta', e.target.value)}
                  placeholder="Escribe la pregunta aquí..." rows={2}
                  style={{ ...inputStyle, resize: 'none', marginBottom: 10 }} />
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Tipo</label>
                  <select value={p.tipo} onChange={e => actualizarPregunta(idx, 'tipo', e.target.value)} style={inputStyle}>
                    <option value="opcion_multiple">Opción múltiple</option>
                    <option value="verdadero_falso">Verdadero / Falso</option>
                  </select>
                </div>
                {p.tipo === 'opcion_multiple' && (
                  <div>
                    <label style={labelStyle}>Opciones (selecciona la correcta con el círculo)</label>
                    {(p.opciones || ['', '', '', '']).map((op, oidx) => (
                      <div key={oidx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <input type="radio" name={`correcta_${idx}`} checked={Number(p.respuesta_correcta) === oidx}
                          onChange={() => actualizarPregunta(idx, 'respuesta_correcta', oidx)} />
                        <input value={op} onChange={e => actualizarOpcion(idx, oidx, e.target.value)}
                          placeholder={`Opción ${oidx + 1}`} style={{ ...inputStyle, flex: 1 }} />
                      </div>
                    ))}
                  </div>
                )}
                {p.tipo === 'verdadero_falso' && (
                  <div>
                    <label style={labelStyle}>Respuesta correcta</label>
                    <select value={p.respuesta_correcta} onChange={e => actualizarPregunta(idx, 'respuesta_correcta', Number(e.target.value))} style={inputStyle}>
                      <option value={0}>Verdadero</option>
                      <option value={1}>Falso</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
            <button onClick={agregarPregunta} style={{ ...btnSecondary, marginBottom: 20 }}>+ Agregar pregunta</button>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalExamen(null)} style={btnGhost}>Cancelar</button>
              <button onClick={guardarExamen} disabled={saving} style={btnPrimary}>
                {saving ? 'Guardando...' : 'Guardar examen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 500, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }
