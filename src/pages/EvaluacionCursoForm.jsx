import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Encuesta de satisfacción del curso (evaluaciones_curso).
// Se usa antes de presentar el examen: el alumno califica el curso y después
// se le habilita el examen. Las 5 calificaciones con estrellas son obligatorias.
const PREGUNTAS_ESTRELLAS = [
  { k: 'cal_contenido', t: '1. ¿Cómo calificarías el contenido del curso?' },
  { k: 'cal_instructor', t: '2. ¿Cómo calificarías al instructor / ponente?' },
  { k: 'cal_expectativas', t: '3. ¿El curso cumplió con tus expectativas?' },
  { k: 'cal_material', t: '4. ¿Cómo calificarías el material didáctico?' },
  { k: 'cal_recomendaria', t: '5. ¿Recomendarías este curso a un colega?' },
]

export default function EvaluacionCursoForm({ estudiante, curso, evaluacion, onDone, onCancel, textoBoton = 'Enviar evaluación' }) {
  const [r, setR] = useState({
    cal_contenido: evaluacion?.cal_contenido || evaluacion?.calificacion || 0,
    cal_instructor: evaluacion?.cal_instructor || 0,
    cal_expectativas: evaluacion?.cal_expectativas || 0,
    cal_material: evaluacion?.cal_material || 0,
    cal_recomendaria: evaluacion?.cal_recomendaria || 0,
    mejoras: evaluacion?.mejoras || '',
    curso_deseado: evaluacion?.curso_deseado || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const faltan = PREGUNTAS_ESTRELLAS.filter(p => !r[p.k]).length
  const promedio = () => {
    const vals = PREGUNTAS_ESTRELLAS.map(p => r[p.k]).filter(v => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

  async function guardar() {
    if (faltan > 0) { setError(`Te falta calificar ${faltan} pregunta${faltan === 1 ? '' : 's'} con estrellas.`); return }
    setError('')
    setSaving(true)
    try {
      const payload = {
        participante_id: estudiante.id, participante_nombre: estudiante.nombre,
        curso_id: curso.curso_id || null, curso_nombre: curso.curso_nombre,
        calificacion: Math.round(promedio()),
        cal_contenido: r.cal_contenido, cal_instructor: r.cal_instructor,
        cal_expectativas: r.cal_expectativas, cal_material: r.cal_material,
        cal_recomendaria: r.cal_recomendaria,
        mejoras: r.mejoras.trim() || null,
        curso_deseado: r.curso_deseado.trim() || null,
      }
      const { error: err } = evaluacion
        ? await supabase.from('evaluaciones_curso').update(payload).eq('id', evaluacion.id)
        : await supabase.from('evaluaciones_curso').insert(payload)
      if (err) throw err
      onDone && onDone()
    } catch (e) {
      setError('No se pudo guardar tu evaluación: ' + (e.message || 'intenta de nuevo.'))
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '12px 16px', marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#8B1A1A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Sobre el curso</p>
        {PREGUNTAS_ESTRELLAS.map(p => (
          <div key={p.k}>
            <label style={lbl}>{p.t}</label>
            <Estrellas value={r[p.k]} onChange={v => setR(prev => ({ ...prev, [p.k]: v }))} />
          </div>
        ))}
        <label style={lbl}>¿Qué mejorarías del curso? (opcional)</label>
        <textarea value={r.mejoras} onChange={e => setR(p => ({ ...p, mejoras: e.target.value }))} rows={2} placeholder="Tus sugerencias nos ayudan a mejorar…" style={ta} />
      </div>

      <div style={{ background: '#f0f9ff', borderRadius: 10, padding: '12px 16px', marginTop: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Ayúdanos a servirte mejor</p>
        <label style={lbl}>6. ¿Qué curso o servicio te gustaría que HCD te ofreciera? (opcional)</label>
        <textarea value={r.curso_deseado} onChange={e => setR(p => ({ ...p, curso_deseado: e.target.value }))} rows={2} placeholder="Ej: Auditor líder ISO 45001, consultoría en Six Sigma, certificación Green Belt…" style={ta} />
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginTop: 14 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
        {onCancel && <button onClick={onCancel} style={{ background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>}
        <button onClick={guardar} disabled={saving}
          style={{ background: faltan ? '#cbd5e1' : '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Guardando...' : textoBoton}
        </button>
      </div>
    </div>
  )
}

function Estrellas({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)} type="button" aria-label={`${n} de 5`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 30, lineHeight: 1, color: n <= value ? '#f59e0b' : '#e2e8f0', padding: 0 }}>★</button>
      ))}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 5, marginTop: 14 }
const ta = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#1e293b', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }
