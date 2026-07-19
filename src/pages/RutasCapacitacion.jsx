import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── RUTAS DE CAPACITACIÓN — Fase 1 ───────────────────────────
// Organigrama (puestos con "reporta a"), requisitos de capacitación
// por puesto (conocimiento libre y/o curso HCD) y asignación de empleados.
export default function RutasCapacitacion({ empresa }) {
  const [puestos, setPuestos] = useState([])
  const [requisitos, setRequisitos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [cursos, setCursos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalPuesto, setModalPuesto] = useState(null)   // {} nuevo | puesto editar
  const [modalReq, setModalReq] = useState(null)         // puesto al que se agrega requisito

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    // Puestos de la empresa
    const { data: pts } = await supabase.from('puestos').select('*').eq('empresa_id', empresa.id).order('orden').order('created_at')
    const listaPuestos = pts || []

    // Requisitos de esos puestos
    let reqs = []
    if (listaPuestos.length > 0) {
      const { data: rq } = await supabase.from('puesto_requisitos').select('*').in('puesto_id', listaPuestos.map(p => p.id))
      reqs = rq || []
    }

    // Empleados de la empresa (por registrado_por_empresa O empresa_id)
    const e1 = await supabase.from('participantes').select('id, nombre, correo, id_empleado, puesto_id, empresa_id, registrado_por_empresa').eq('registrado_por_empresa', empresa.id)
    const e2 = await supabase.from('participantes').select('id, nombre, correo, id_empleado, puesto_id, empresa_id, registrado_por_empresa').eq('empresa_id', empresa.id)
    const mapEmp = new Map()
    ;[...(e1.data || []), ...(e2.data || [])].forEach(e => mapEmp.set(e.id, e))

    // Cursos activos (para requisitos de tipo curso)
    const { data: cur } = await supabase.from('cursos').select('id, nombre, categoria').eq('activo', true).order('nombre')

    setPuestos(listaPuestos)
    setRequisitos(reqs)
    setEmpleados([...mapEmp.values()])
    setCursos(cur || [])
    setLoading(false)
  }

  function reqsDePuesto(pid) { return requisitos.filter(r => r.puesto_id === pid) }
  function empleadosDePuesto(pid) { return empleados.filter(e => e.puesto_id === pid) }
  function nombrePuesto(pid) { return puestos.find(p => p.id === pid)?.nombre || '—' }
  const sinPuesto = empleados.filter(e => !e.puesto_id)

  async function eliminarPuesto(p) {
    if (!window.confirm(`¿Eliminar el puesto "${p.nombre}"? Los empleados quedarán sin puesto y se borrarán sus requisitos.`)) return
    const { error } = await supabase.from('puestos').delete().eq('id', p.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    await cargar()
  }

  async function eliminarReq(r) {
    const { error } = await supabase.from('puesto_requisitos').delete().eq('id', r.id)
    if (error) { alert('No se pudo quitar: ' + error.message); return }
    await cargar()
  }

  async function asignarEmpleado(empId, puestoId) {
    if (!empId) return
    const { error } = await supabase.from('participantes').update({ puesto_id: puestoId }).eq('id', empId)
    if (error) { alert('No se pudo asignar: ' + error.message); return }
    await cargar()
  }

  async function quitarEmpleado(empId) {
    const { error } = await supabase.from('participantes').update({ puesto_id: null }).eq('id', empId)
    if (error) { alert('No se pudo quitar: ' + error.message); return }
    await cargar()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando rutas de capacitación...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <p style={{ color: '#64748b', fontSize: 14, maxWidth: 620 }}>
          Define tu <strong>organigrama</strong>: crea los puestos de tu empresa, describe qué conocimientos requiere cada uno
          (incluyendo cursos de HCD) y asigna a tus empleados. Con esto la plataforma podrá diagnosticar y sugerir su ruta de capacitación.
        </p>
        <button onClick={() => setModalPuesto({})} style={btnPrimary}>+ Nuevo puesto</button>
      </div>

      {/* Empleados sin puesto */}
      {sinPuesto.length > 0 && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#713f12' }}>
          ⚠️ Tienes <strong>{sinPuesto.length}</strong> empleado(s) sin puesto asignado. Asígnalos dentro de cada puesto para incluirlos en el diagnóstico.
        </div>
      )}

      {puestos.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          Aún no has creado puestos. Empieza con "+ Nuevo puesto" (ej. Gerente de Calidad, Auxiliar de Producción…).
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {puestos.map(p => {
            const reqs = reqsDePuesto(p.id)
            const emps = empleadosDePuesto(p.id)
            const disponibles = empleados.filter(e => e.puesto_id !== p.id)
            return (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>{p.nombre}</h3>
                    {p.puesto_padre_id && (
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>↳ Reporta a: {nombrePuesto(p.puesto_padre_id)}</div>
                    )}
                    {p.descripcion && <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>{p.descripcion}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setModalPuesto(p)} style={iconBtn}>✏️ Editar</button>
                    <button onClick={() => eliminarPuesto(p)} style={{ ...iconBtn, color: '#dc2626', borderColor: '#fecaca' }}>🗑</button>
                  </div>
                </div>

                {/* Requisitos */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Requisitos de capacitación</span>
                    <button onClick={() => setModalReq(p)} style={{ ...iconBtn, fontSize: 12 }}>+ Agregar requisito</button>
                  </div>
                  {reqs.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 12 }}>Sin requisitos. Agrega los conocimientos o cursos que exige este puesto.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {reqs.map(r => (
                        <span key={r.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: r.tipo === 'curso' ? '#eff6ff' : '#f1f5f9',
                          color: r.tipo === 'curso' ? '#1d4ed8' : '#475569',
                          border: `1px solid ${r.tipo === 'curso' ? '#bfdbfe' : '#e2e8f0'}`
                        }}>
                          {r.tipo === 'curso' ? '🎓' : '📌'} {r.descripcion}
                          {r.obligatorio ? <span title="Obligatorio" style={{ color: '#8B1A1A' }}>★</span> : <span title="Deseable" style={{ color: '#94a3b8' }}>☆</span>}
                          <button onClick={() => eliminarReq(r)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Empleados en el puesto */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
                    Empleados en este puesto ({emps.length})
                  </div>
                  {emps.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {emps.map(e => (
                        <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, fontSize: 12, background: '#f8f9fb', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                          {e.nombre}
                          <button onClick={() => quitarEmpleado(e.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select value="" onChange={e => asignarEmpleado(e.target.value, p.id)} style={{ ...inp, maxWidth: 320 }}>
                    <option value="">+ Asignar empleado a este puesto…</option>
                    {disponibles.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre}{e.puesto_id ? ` (mover desde: ${nombrePuesto(e.puesto_id)})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalPuesto && (
        <ModalPuesto empresa={empresa} puestos={puestos} editando={modalPuesto.id ? modalPuesto : null}
          onClose={() => setModalPuesto(null)} onDone={() => { setModalPuesto(null); cargar() }} />
      )}
      {modalReq && (
        <ModalRequisito puesto={modalReq} cursos={cursos}
          onClose={() => setModalReq(null)} onDone={() => { setModalReq(null); cargar() }} />
      )}
    </div>
  )
}

// ─── Modal: crear / editar puesto ─────────────────────────────
function ModalPuesto({ empresa, puestos, editando, onClose, onDone }) {
  const [nombre, setNombre] = useState(editando?.nombre || '')
  const [descripcion, setDescripcion] = useState(editando?.descripcion || '')
  const [padre, setPadre] = useState(editando?.puesto_padre_id || '')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!nombre.trim()) { alert('Escribe el nombre del puesto'); return }
    setSaving(true)
    try {
      const payload = {
        empresa_id: empresa.id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        puesto_padre_id: padre || null
      }
      if (editando) {
        const { error } = await supabase.from('puestos').update(payload).eq('id', editando.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('puestos').insert({ ...payload, orden: puestos.length })
        if (error) throw error
      }
      onDone()
    } catch (e) {
      alert('Error al guardar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  // No permitir que un puesto reporte a sí mismo
  const opcionesPadre = puestos.filter(p => !editando || p.id !== editando.id)

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{editando ? 'Editar puesto' : 'Nuevo puesto'}</h3>
        <label style={lbl}>Nombre del puesto *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej. Gerente de Calidad" style={inp} />
        <label style={lbl}>Descripción del puesto</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} placeholder="Responsabilidades y perfil general del puesto…" style={{ ...inp, resize: 'vertical' }} />
        <label style={lbl}>Reporta a (opcional)</label>
        <select value={padre} onChange={e => setPadre(e.target.value)} style={inp}>
          <option value="">— Sin jefe directo (nivel superior) —</option>
          {opcionesPadre.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving || !nombre.trim()} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar puesto'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: agregar requisito a un puesto ─────────────────────
function ModalRequisito({ puesto, cursos, onClose, onDone }) {
  const [tipo, setTipo] = useState('texto')       // 'texto' | 'curso'
  const [descripcion, setDescripcion] = useState('')
  const [cursoId, setCursoId] = useState('')
  const [obligatorio, setObligatorio] = useState(true)
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (tipo === 'texto' && !descripcion.trim()) { alert('Escribe el conocimiento requerido'); return }
    if (tipo === 'curso' && !cursoId) { alert('Elige el curso requerido'); return }
    setSaving(true)
    try {
      const curso = cursos.find(c => c.id === cursoId)
      const payload = {
        puesto_id: puesto.id,
        tipo,
        descripcion: tipo === 'curso' ? (curso?.nombre || 'Curso') : descripcion.trim(),
        curso_id: tipo === 'curso' ? cursoId : null,
        obligatorio
      }
      const { error } = await supabase.from('puesto_requisitos').insert(payload)
      if (error) throw error
      onDone()
    } catch (e) {
      alert('Error al guardar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Agregar requisito</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Puesto: <strong>{puesto.nombre}</strong></p>

        <label style={lbl}>Tipo de requisito</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          {[['texto', '📌 Conocimiento', 'Texto libre'], ['curso', '🎓 Curso HCD', 'De nuestro catálogo']].map(([v, l, d]) => (
            <button key={v} type="button" onClick={() => setTipo(v)}
              style={{ flex: 1, padding: '10px', border: `2px solid ${tipo === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 10, background: tipo === v ? '#f9f0f0' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tipo === v ? '#8B1A1A' : '#475569' }}>{l}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{d}</div>
            </button>
          ))}
        </div>

        {tipo === 'texto' ? (
          <>
            <label style={lbl}>Conocimiento requerido</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="ej. Manejo de montacargas, Excel avanzado…" style={inp} />
          </>
        ) : (
          <>
            <label style={lbl}>Curso requerido</label>
            <select value={cursoId} onChange={e => setCursoId(e.target.value)} style={inp}>
              <option value="">— Elige un curso —</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Ej. "El puesto requiere dominio de ISO 9001". Esto se usará en el diagnóstico y la ruta sugerida.</p>
          </>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14 }}>
          <input type="checkbox" checked={obligatorio} onChange={e => setObligatorio(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
          <span style={{ fontSize: 13, color: '#374151' }}>Obligatorio <span style={{ color: '#94a3b8' }}>(si se desmarca, cuenta como deseable)</span></span>
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Agregar'}</button>
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const iconBtn = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: '#475569', fontWeight: 600 }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 500, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
