import { useEffect, useState } from 'react'
import { supabase, getCertificados, crearCertificado, getCursos, getEmpresas, getParticipantes, siguienteConsecutivo } from '../lib/supabase'
import { generarYAbrirCertificado } from '../lib/certificado'

export default function Certificados() {
  const [certificados, setCertificados] = useState([])
  const [cursos, setCursos] = useState([])
  const [cursosConfirmados, setCursosConfirmados] = useState([])
  const [cursoConfirmadoSel, setCursoConfirmadoSel] = useState('')
  const [idManual, setIdManual] = useState('')
  const [empresas, setEmpresas] = useState([])
  const [participantes, setParticipantes] = useState([])
  const [modal, setModal] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({
    participante_id: '', curso_id: '', empresa_id: '',
    lugar: '', instructor_nombre: 'Néstor Daniel Reyes Díaz',
    instructor_rfc: 'REDN-770428-433-0005', director_nombre: 'Mirna Rosas Delgado',
    modalidad: 'presencial', fecha_curso: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargar()
    getCursos().then(setCursos).catch(() => setCursos([]))
    getEmpresas().then(setEmpresas).catch(() => setEmpresas([]))
    cargarConfirmados()
    cargarParticipantes()
  }, [])

  async function cargarConfirmados() {
    try {
      const { data } = await supabase.from('cursos_confirmados')
        .select('id, curso_id, curso_nombre, empresa_id, empresa_nombre, fecha_inicio, modalidad, numero_curso')
        .order('fecha_inicio', { ascending: false })
      setCursosConfirmados(data || [])
    } catch (_) {
      setCursosConfirmados([])
    }
  }

  async function cargarParticipantes() {
    // Cargar TODOS sin join (el join puede fallar y dejar la lista vacía)
    try {
      const { data } = await supabase.from('participantes')
        .select('id, nombre, correo, id_empleado, empresa_id, registrado_por_empresa, tipo')
        .order('nombre', { ascending: true })
      setParticipantes(data || [])
    } catch (_) {
      setParticipantes([])
    }
  }

  async function cargar() {
    const data = await getCertificados()
    setCertificados(data)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  // Al seleccionar modalidad, pre-llenar lugar
  function cambiarModalidad(v) {
    setForm(p => ({ ...p, modalidad: v, lugar: v === 'online' ? 'Puebla, Pue.' : '' }))
  }

  // Al seleccionar empresa, pre-llenar lugar si es presencial
  function cambiarEmpresa(empresa_id) {
    const emp = empresas.find(e => e.id === empresa_id)
    setForm(p => ({
      ...p, empresa_id,
      lugar: p.modalidad === 'presencial' ? (emp?.ciudad || emp?.nombre || '') : p.lugar
    }))
  }

  // Al elegir un curso del calendario: resolver curso del catálogo y autollenar
  function seleccionarCursoConfirmado(id) {
    setCursoConfirmadoSel(id)
    setIdManual('')
    const cc = cursosConfirmados.find(x => x.id === id)
    if (!cc) { setForm(p => ({ ...p, curso_id: '' })); return }
    const emp = empresas.find(e => e.id === cc.empresa_id)
    const modalidad = cc.modalidad || 'presencial'
    setForm(p => ({
      ...p,
      curso_id: cc.curso_id || '',
      empresa_id: cc.empresa_id || '',
      modalidad,
      fecha_curso: cc.fecha_inicio || '',
      lugar: modalidad === 'online' ? 'Puebla, Pue.' : (emp?.ciudad || cc.empresa_nombre || emp?.nombre || p.lugar)
    }))
  }

  async function emitir() {
    if (!form.participante_id || !form.curso_id || !form.lugar) { alert('Completa participante, curso y lugar'); return }
    setSaving(true)
    try {
      const curso = cursos.find(c => c.id === form.curso_id)
      const participante = participantes.find(p => p.id === form.participante_id)
      const cc = cursosConfirmados.find(x => x.id === cursoConfirmadoSel)
      // ID: si lo escribiste a mano, se usa tal cual; si no, se genera solo (número de curso del calendario + consecutivo global a 4 dígitos)
      let id_unico
      if (idManual.trim()) {
        id_unico = idManual.trim()
      } else {
        const numCurso = cc?.numero_curso || curso?.numero_curso || 'SN'
        const consec = await siguienteConsecutivo()
        id_unico = `HCD-${numCurso}-${String(consec).padStart(4, '0')}`
      }

      const { data: cert, error } = await supabase.from('certificados').insert({
        id_unico,
        participante_id: form.participante_id,
        curso_id: form.curso_id,
        empresa_id: form.empresa_id || null,
        nombre_participante: participante.nombre,
        nombre_curso: curso.nombre,
        lugar: form.lugar,
        duracion: curso.duracion,
        modalidad: form.modalidad,
        instructor_nombre: form.instructor_nombre,
        instructor_rfc: form.instructor_rfc,
        director_nombre: form.director_nombre,
        fecha_curso: form.fecha_curso || null,
        fecha_emision: new Date().toISOString(),
      }).select().single()

      if (error) {
        alert('No se pudo emitir el certificado: ' + error.message)
        setSaving(false)
        return
      }

      try { await generarYAbrirCertificado(cert) } catch (e) { alert('El certificado se guardó, pero hubo un problema al generar el PDF: ' + (e.message || '')) }
      await cargar()
      setModal(false)
      setForm({ participante_id: '', curso_id: '', empresa_id: '', lugar: '', instructor_nombre: 'Néstor Daniel Reyes Díaz', instructor_rfc: 'REDN-770428-433-0005', director_nombre: 'Mirna Rosas Delgado', modalidad: 'presencial', fecha_curso: '' })
      setCursoConfirmadoSel('')
      setIdManual('')
    } catch (e) {
      alert('Error al emitir: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  async function eliminarCertificado(cert) {
    if (!window.confirm(`¿Eliminar el certificado de ${cert.nombre_participante} (${cert.id_unico})? No se puede deshacer.`)) return
    try {
      const { error } = await supabase.from('certificados').delete().eq('id', cert.id)
      if (error) { alert('No se pudo eliminar: ' + error.message); return }
      await cargar()
    } catch (e) {
      alert('Error al eliminar: ' + (e.message || ''))
    }
  }

  const filtrados = certificados.filter(c =>
    `${c.nombre_participante} ${c.id_unico} ${c.nombre_curso}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Certificados</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Emite y gestiona certificados</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Emitir certificado</button>
      </div>

      <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, ID o curso..."
        style={{ ...inputStyle, marginBottom: 16, maxWidth: 440 }} />

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['ID Único', 'Participante', 'Curso', 'Empresa', 'Modalidad', 'Fecha', ''].map(h => (
                <th key={h} style={{ padding: '11px 18px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay certificados emitidos</td></tr>
            )}
            {filtrados.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 18px' }}>
                  <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{c.id_unico}</code>
                </td>
                <td style={{ padding: '11px 18px', color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{c.nombre_participante}</td>
                <td style={{ padding: '11px 18px', color: '#475569', fontSize: 13 }}>{c.nombre_curso}</td>
                <td style={{ padding: '11px 18px', color: '#475569', fontSize: 13 }}>{c.empresa?.nombre || '—'}</td>
                <td style={{ padding: '11px 18px' }}>
                  <span style={{ background: c.modalidad === 'presencial' ? '#eff6ff' : '#f0fdf4', color: c.modalidad === 'presencial' ? '#1d4ed8' : '#059669', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {c.modalidad === 'presencial' ? 'Presencial' : 'Online'}
                  </span>
                </td>
                <td style={{ padding: '11px 18px', color: '#94a3b8', fontSize: 12 }}>
                  {new Date(c.fecha_emision).toLocaleDateString('es-MX')}
                </td>
                <td style={{ padding: '11px 18px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => generarYAbrirCertificado(c)} style={btnSecondary}>
                      🖨️ PDF
                    </button>
                    <button onClick={() => eliminarCertificado(c)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal emitir */}
      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={{ ...modalStyle, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Emitir certificado</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Participante * <span style={{ color: '#94a3b8', fontWeight: 400 }}>({participantes.length} registrados)</span></label>
              <select value={form.participante_id} onChange={e => f('participante_id')(e.target.value)} style={inputStyle}>
                <option value="">— Selecciona participante —</option>
                {participantes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}{p.id_empleado ? ` (${p.id_empleado})` : ''}{p.correo ? ` — ${p.correo}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Curso * <span style={{ color: '#94a3b8', fontWeight: 400 }}>(del calendario)</span></label>
              <select value={cursoConfirmadoSel} onChange={e => seleccionarCursoConfirmado(e.target.value)} style={inputStyle}>
                <option value="">— Selecciona curso del calendario —</option>
                {cursosConfirmados.map(cc => (
                  <option key={cc.id} value={cc.id}>
                    {cc.curso_nombre}{cc.fecha_inicio ? ` · ${new Date(cc.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX')}` : ''}{cc.empresa_nombre ? ` · ${cc.empresa_nombre}` : ''}
                  </option>
                ))}
              </select>
              {cursosConfirmados.length === 0 && <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>No hay cursos en el calendario todavía. Prográmalos en "Calendario de cursos".</p>}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Modalidad *</label>
              <select value={form.modalidad} onChange={e => cambiarModalidad(e.target.value)} style={inputStyle}>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Empresa (opcional)</label>
              <select value={form.empresa_id} onChange={e => cambiarEmpresa(e.target.value)} style={inputStyle}>
                <option value="">— Sin empresa —</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Fecha del curso <span style={{ color: '#94a3b8', fontWeight: 400 }}>(la del calendario; aparece en el certificado)</span></label>
              <input type="date" value={form.fecha_curso} onChange={e => f('fecha_curso')(e.target.value)} style={inputStyle} />
            </div>

            <Field label="Lugar impartido *" value={form.lugar} onChange={f('lugar')} placeholder="ej. Puebla, Pue. o nombre de empresa" />
            <Field label="Instructor" value={form.instructor_nombre} onChange={f('instructor_nombre')} />
            <Field label="RFC del instructor" value={form.instructor_rfc} onChange={f('instructor_rfc')} />
            <Field label="Dirección" value={form.director_nombre} onChange={f('director_nombre')} />

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>ID del diploma <span style={{ color: '#94a3b8', fontWeight: 400 }}>(se genera solo; puedes escribirlo a mano)</span></label>
              <input value={idManual} onChange={e => setIdManual(e.target.value)}
                placeholder={`Automático: HCD-${cursosConfirmados.find(x => x.id === cursoConfirmadoSel)?.numero_curso || (cursos.find(c => c.id === form.curso_id)?.numero_curso || 'SN')}-XXXX`}
                style={{ ...inputStyle, fontFamily: 'monospace' }} />
              <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                Si lo dejas vacío: número de curso <strong>{cursosConfirmados.find(x => x.id === cursoConfirmadoSel)?.numero_curso || cursos.find(c => c.id === form.curso_id)?.numero_curso || '—'}</strong> + el siguiente consecutivo global a 4 dígitos. Para el curso de ayer, escríbelo a mano (ej. HCD-498-3030).
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={emitir} disabled={saving || !form.participante_id || !form.curso_id || !form.lugar} style={btnPrimary}>
                {saving ? 'Emitiendo...' : 'Emitir y descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 520, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }
