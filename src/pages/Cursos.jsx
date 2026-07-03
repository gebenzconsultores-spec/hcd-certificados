import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCursos, crearCurso, getExamenPorCurso, guardarPreguntas } from '../lib/supabase'

const COLOR_FAMILIA = {
  'Sistemas de Gestión': '#1d4ed8',
  'Herramientas Automotrices': '#8B1A1A',
  'Lean Six Sigma': '#059669',
  'Estadística y Software': '#7c3aed',
}
const PREFIJO_FAMILIA = {
  'Sistemas de Gestión': 'SG',
  'Herramientas Automotrices': 'AUTO',
  'Lean Six Sigma': 'LEAN',
  'Estadística y Software': 'EST',
}

// Días según duración en horas: ≤8=1, >8 y <16=2, ≥16=3
function diasPorHoras(horas) {
  const h = Number(horas) || 0
  if (h <= 8) return 1
  if (h <= 16) return 2
  return 3
}

export default function Cursos() {
  const [cursos, setCursos] = useState([])
  const [familias, setFamilias] = useState([])
  const [loading, setLoading] = useState(true)
  const [familiaAbierta, setFamiliaAbierta] = useState(null)
  const [vista, setVista] = useState('cursos') // 'cursos' o 'microcredenciales'
  const [microcursos, setMicrocursos] = useState([])

  const [modal, setModal] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalExamen, setModalExamen] = useState(null)
  const [form, setForm] = useState({ nombre: '', duracion: '', familia_id: '', modalidad: 'online', aval_institucion: false, nombre_aval: '' })
  const [preguntas, setPreguntas] = useState([])
  const [saving, setSaving] = useState(false)
  // Crear nueva familia desde el modal de curso
  const [nuevaFamilia, setNuevaFamilia] = useState(false)
  const [nombreNuevaFamilia, setNombreNuevaFamilia] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [cur, { data: fam }, { data: micro }] = await Promise.all([
      getCursos(),
      supabase.from('familias').select('*').order('orden'),
      supabase.from('microcursos').select('*').order('titulo')
    ])
    setCursos(cur || [])
    setFamilias(fam || [])
    setMicrocursos(micro || [])
    if (fam && fam.length && !familiaAbierta) setFamiliaAbierta(fam[0].id)
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  // Genera clave interna automática tipo SG-01, AUTO-05 según familia
  async function generarClaveInterna(familiaId) {
    const familia = familias.find(x => x.id === familiaId)
    const prefijo = PREFIJO_FAMILIA[familia?.nombre] || 'CUR'
    const mismosFamilia = cursos.filter(c => c.familia_id === familiaId)
    let maxNum = 0
    mismosFamilia.forEach(c => {
      const m = (c.clave_interna || '').match(new RegExp(`${prefijo}-(\\d+)`))
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    })
    return `${prefijo}-${String(maxNum + 1).padStart(2, '0')}`
  }

  // Genera clave de familia tipo HCD-001, HCD-002...
  function siguienteClaveFamilia() {
    let max = 0
    familias.forEach(fa => {
      const m = (fa.clave || '').match(/HCD-(\d+)/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    })
    return `HCD-${String(max + 1).padStart(3, '0')}`
  }

  // Crea una familia nueva y devuelve su id
  async function crearFamilia(nombre) {
    const clave = siguienteClaveFamilia()
    const { data, error } = await supabase.from('familias')
      .insert({ nombre, clave, color: '#64748b', orden: familias.length + 1 })
      .select().single()
    if (error) { alert('No se pudo crear la familia: ' + error.message); return null }
    return data
  }

  async function guardarCurso() {
    if (!form.nombre || !form.duracion) { alert('Completa nombre y duración'); return }
    // Familia: existente o nueva
    let familiaId = form.familia_id
    if (nuevaFamilia) {
      if (!nombreNuevaFamilia.trim()) { alert('Escribe el nombre de la nueva familia'); return }
      const fam = await crearFamilia(nombreNuevaFamilia.trim())
      if (!fam) return
      familiaId = fam.id
      await cargar()
    }
    if (!familiaId) { alert('Selecciona o crea una familia'); return }
    setSaving(true)
    try {
      const clave_interna = await generarClaveInterna(familiaId)
      await crearCurso({
        nombre: form.nombre, duracion: Number(form.duracion),
        dias: diasPorHoras(form.duracion),
        familia_id: familiaId, clave_interna,
        modalidad: form.modalidad, aval_institucion: form.aval_institucion,
        nombre_aval: form.nombre_aval, activo: true, es_publico: true
      })
      await cargar()
      setModal(false)
      setForm({ nombre: '', duracion: '', familia_id: '', modalidad: 'online', aval_institucion: false, nombre_aval: '' })
      setNuevaFamilia(false); setNombreNuevaFamilia('')
    } catch (e) {
      alert('No se pudo crear: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  async function guardarEdicion() {
    setSaving(true)
    try {
      await supabase.from('cursos').update({
        nombre: modalEditar.nombre, duracion: Number(modalEditar.duracion),
        dias: diasPorHoras(modalEditar.duracion),
        familia_id: modalEditar.familia_id,
        modalidad: modalEditar.modalidad || 'online',
        aval_institucion: !!modalEditar.aval_institucion,
        nombre_aval: modalEditar.nombre_aval || null
      }).eq('id', modalEditar.id)
      await cargar()
      setModalEditar(null)
    } catch (e) {
      alert('No se pudo guardar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  async function borrarCurso(curso) {
    if (!window.confirm(`¿Eliminar "${curso.nombre}" del catálogo?`)) return
    await supabase.from('cursos').delete().eq('id', curso.id)
    await cargar()
  }

  // ── Examen ──
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

  if (loading) return <div style={{ color: '#64748b', padding: 40 }}>Cargando catálogo...</div>

  const cursosDeFamilia = familiaAbierta ? cursos.filter(c => c.familia_id === familiaAbierta) : []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Catálogo de cursos</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Cursos organizados por familia, con clave interna y exámenes</p>
        </div>
        {vista === 'cursos' && <button onClick={() => setModal(true)} style={btnPrimary}>+ Agregar curso</button>}
      </div>

      {/* Sub-pestañas: Cursos / Microcredenciales */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setVista('cursos')} style={{ background: vista === 'cursos' ? '#8B1A1A' : '#f1f5f9', color: vista === 'cursos' ? '#fff' : '#475569', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📚 Cursos</button>
        <button onClick={() => setVista('microcredenciales')} style={{ background: vista === 'microcredenciales' ? '#8B1A1A' : '#f1f5f9', color: vista === 'microcredenciales' ? '#fff' : '#475569', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⚡ Microcredenciales</button>
      </div>

      {vista === 'cursos' ? (
        <>
          {/* Familias como pestañas */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {familias.map(fam => {
              const count = cursos.filter(c => c.familia_id === fam.id).length
              const color = COLOR_FAMILIA[fam.nombre] || '#64748b'
              const activa = familiaAbierta === fam.id
              return (
                <button key={fam.id} onClick={() => setFamiliaAbierta(fam.id)}
                  style={{ background: activa ? color : '#fff', color: activa ? '#fff' : color, border: `2px solid ${color}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {fam.clave ? `${fam.clave} · ` : ''}{fam.nombre} ({count})
                </button>
              )
            })}
          </div>

          {/* Cursos de la familia abierta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
            {cursosDeFamilia.length === 0 ? (
              <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay cursos en esta familia.</div>
            ) : (
              cursosDeFamilia.map(c => {
                const fam = familias.find(x => x.id === c.familia_id)
                const color = COLOR_FAMILIA[fam?.nombre] || '#64748b'
                return (
                  <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <span style={{ background: `${color}15`, color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        🔑 {c.clave_interna || 'Sin clave'}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>⏱ {c.duracion}h · {c.dias || diasPorHoras(c.duracion)} día{(c.dias || diasPorHoras(c.duracion)) > 1 ? 's' : ''}</span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12, lineHeight: 1.3 }}>{c.nombre}</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => abrirExamen(c)} style={btnSecondary}>📝 Editar examen</button>
                      <a href={`/examen/${c.id}`} target="_blank" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>🔗 Ver examen</a>
                      <button onClick={() => setModalEditar({ ...c })} style={{ ...btnSecondary, padding: '7px 12px' }}>✏️</button>
                      <button onClick={() => borrarCurso(c)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      ) : (
        /* Microcredenciales */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
          {microcursos.length === 0 ? (
            <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay microcredenciales registradas.</div>
          ) : (
            microcursos.map(m => (
              <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
                <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>⚡ Microcredencial</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '12px 0 8px', lineHeight: 1.3 }}>{m.titulo}</h3>
                {m.descripcion && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{m.descripcion}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => abrirExamen(m)} style={btnSecondary}>📝 Editar examen</button>
                  <a href={`/examen/${m.id}`} target="_blank" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>🔗 Ver examen</a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal agregar curso */}
      {modal && (
        <div style={overlay} onClick={() => { setModal(false); setNuevaFamilia(false); setNombreNuevaFamilia('') }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Agregar curso</h3>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>La clave interna y los días se calculan automáticamente.</p>

            <Field label="Nombre del curso" value={form.nombre} onChange={f('nombre')} placeholder="ej. ISO 9001:2015 Interpretación" />

            <label style={lbl}>Familia</label>
            {!nuevaFamilia ? (
              <>
                <select value={form.familia_id} onChange={e => f('familia_id')(e.target.value)} style={inp}>
                  <option value="">— Selecciona la familia —</option>
                  {familias.map(fa => <option key={fa.id} value={fa.id}>{fa.clave ? `${fa.clave} · ` : ''}{fa.nombre}</option>)}
                </select>
                <button type="button" onClick={() => setNuevaFamilia(true)}
                  style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: 12, cursor: 'pointer', marginTop: 6, padding: 0, fontWeight: 600 }}>
                  + Agregar nueva familia
                </button>
              </>
            ) : (
              <>
                <input value={nombreNuevaFamilia} onChange={e => setNombreNuevaFamilia(e.target.value)}
                  placeholder="Nombre de la nueva familia" style={inp} />
                <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Se le asignará la clave {siguienteClaveFamilia()} automáticamente.</p>
                <button type="button" onClick={() => { setNuevaFamilia(false); setNombreNuevaFamilia('') }}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', marginTop: 6, padding: 0 }}>
                  ← Usar una familia existente
                </button>
              </>
            )}

            <Field label="Duración (horas)" value={form.duracion} onChange={f('duracion')} placeholder="ej. 8" type="number" />
            {form.duracion && (
              <p style={{ color: '#059669', fontSize: 12, marginTop: -6, marginBottom: 4 }}>
                📅 Este curso será de <strong>{diasPorHoras(form.duracion)} día{diasPorHoras(form.duracion) > 1 ? 's' : ''}</strong>
              </p>
            )}

            <label style={lbl}>Modalidad</label>
            <select value={form.modalidad} onChange={e => f('modalidad')(e.target.value)} style={inp}>
              <option value="online">En línea</option>
              <option value="presencial">Presencial</option>
              <option value="mixta">Mixta</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14 }}>
              <input type="checkbox" checked={form.aval_institucion} onChange={e => f('aval_institucion')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
              <span style={{ color: '#374151', fontSize: 13 }}>Tiene aval de institución</span>
            </label>
            {form.aval_institucion && (
              <Field label="Nombre del aval" value={form.nombre_aval} onChange={f('nombre_aval')} placeholder="ej. STPS, Universidad X" />
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => { setModal(false); setNuevaFamilia(false); setNombreNuevaFamilia('') }} style={btnGhost}>Cancelar</button>
              <button onClick={guardarCurso} disabled={saving} style={btnPrimary}>{saving ? 'Creando...' : 'Agregar curso'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar curso */}
      {modalEditar && (
        <div style={overlay} onClick={() => setModalEditar(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Editar curso · {modalEditar.clave_interna}</h3>

            <Field label="Nombre" value={modalEditar.nombre} onChange={v => setModalEditar(p => ({ ...p, nombre: v }))} />

            <label style={lbl}>Familia</label>
            <select value={modalEditar.familia_id || ''} onChange={e => setModalEditar(p => ({ ...p, familia_id: e.target.value }))} style={inp}>
              {familias.map(fa => <option key={fa.id} value={fa.id}>{fa.clave ? `${fa.clave} · ` : ''}{fa.nombre}</option>)}
            </select>

            <Field label="Duración (horas)" value={modalEditar.duracion} onChange={v => setModalEditar(p => ({ ...p, duracion: v }))} type="number" />
            {modalEditar.duracion && (
              <p style={{ color: '#059669', fontSize: 12, marginTop: -6, marginBottom: 4 }}>
                📅 Curso de <strong>{diasPorHoras(modalEditar.duracion)} día{diasPorHoras(modalEditar.duracion) > 1 ? 's' : ''}</strong>
              </p>
            )}

            <label style={lbl}>Modalidad</label>
            <select value={modalEditar.modalidad || 'online'} onChange={e => setModalEditar(p => ({ ...p, modalidad: e.target.value }))} style={inp}>
              <option value="online">En línea</option>
              <option value="presencial">Presencial</option>
              <option value="mixta">Mixta</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14 }}>
              <input type="checkbox" checked={!!modalEditar.aval_institucion} onChange={e => setModalEditar(p => ({ ...p, aval_institucion: e.target.checked }))} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
              <span style={{ color: '#374151', fontSize: 13 }}>Tiene aval de institución</span>
            </label>
            {modalEditar.aval_institucion && (
              <Field label="Nombre del aval" value={modalEditar.nombre_aval || ''} onChange={v => setModalEditar(p => ({ ...p, nombre_aval: v }))} />
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setModalEditar(null)} style={btnGhost}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal examen */}
      {modalExamen && (
        <div style={overlay} onClick={() => setModalExamen(null)}>
          <div style={{ ...modalStyle, width: 640, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Examen · {modalExamen.nombre || modalExamen.titulo}</h3>
            {preguntas.map((q, idx) => (
              <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#8B1A1A' }}>Pregunta {idx + 1}</span>
                  <button onClick={() => setPreguntas(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Eliminar</button>
                </div>
                <input value={q.pregunta} onChange={e => actualizarPregunta(idx, 'pregunta', e.target.value)} placeholder="Escribe la pregunta" style={{ ...inp, marginBottom: 10 }} />
                {q.opciones.map((op, oidx) => (
                  <div key={oidx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input type="radio" checked={q.respuesta_correcta === oidx} onChange={() => actualizarPregunta(idx, 'respuesta_correcta', oidx)} style={{ accentColor: '#059669' }} />
                    <input value={op} onChange={e => actualizarOpcion(idx, oidx, e.target.value)} placeholder={`Opción ${oidx + 1}`} style={{ ...inp, flex: 1 }} />
                  </div>
                ))}
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Marca el círculo de la respuesta correcta.</p>
              </div>
            ))}
            <button onClick={agregarPregunta} style={{ ...btnSecondary, width: '100%', marginBottom: 16 }}>+ Agregar pregunta</button>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalExamen(null)} style={btnGhost}>Cancelar</button>
              <button onClick={guardarExamen} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar examen'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const btnGhost = { background: 'none', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }
