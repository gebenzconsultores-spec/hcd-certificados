import { useEffect, useState } from 'react'
import { getParticipantes, crearParticipante, getEmpresas } from '../lib/supabase'

export default function Participantes() {
  const [participantes, setParticipantes] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [modal, setModal] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({
    nombre: '', correo: '', whatsapp: '', empresa_id: '',
    empresa_manual: '', tipo: 'empresa', es_universitario: false, universidad: '', carrera: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargar()
    getEmpresas().then(setEmpresas)
  }, [])

  async function cargar(b = '') {
    const data = await getParticipantes({ busqueda: b })
    setParticipantes(data)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!form.nombre || !form.correo) return
    setSaving(true)
    try {
      await crearParticipante({
        nombre: form.nombre,
        correo: form.correo,
        whatsapp: form.whatsapp,
        empresa_id: form.tipo === 'empresa' ? form.empresa_id || null : null,
        empresa_manual: form.tipo === 'individual' ? form.empresa_manual : null,
        tipo: form.tipo,
        es_universitario: form.es_universitario,
        universidad: form.es_universitario ? form.universidad : null,
        carrera: form.es_universitario ? form.carrera : null,
      })
      await cargar()
      setModal(false)
      setForm({ nombre: '', correo: '', whatsapp: '', empresa_id: '', empresa_manual: '', tipo: 'empresa', es_universitario: false, universidad: '', carrera: '' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Participantes</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Personas registradas en el sistema</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Nuevo participante</button>
      </div>

      <input value={busqueda} onChange={e => { setBusqueda(e.target.value); cargar(e.target.value) }}
        placeholder="Buscar por nombre..." style={{ ...inputStyle, marginBottom: 16, maxWidth: 400 }} />

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Nombre', 'Correo', 'WhatsApp', 'Empresa / Institución', 'Tipo'].map(h => (
                <th key={h} style={{ padding: '11px 18px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participantes.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay participantes registrados</td></tr>
            )}
            {participantes.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 18px', color: '#1e293b', fontWeight: 600 }}>{p.nombre}</td>
                <td style={{ padding: '11px 18px', color: '#475569', fontSize: 13 }}>{p.correo}</td>
                <td style={{ padding: '11px 18px', color: '#475569', fontSize: 13 }}>{p.whatsapp || '—'}</td>
                <td style={{ padding: '11px 18px', color: '#475569', fontSize: 13 }}>
                  {p.empresa?.nombre || p.empresa_manual || (p.es_universitario ? p.universidad : '—')}
                </td>
                <td style={{ padding: '11px 18px' }}>
                  <span style={{
                    background: p.tipo === 'empresa' ? '#eff6ff' : p.es_universitario ? '#f5f3ff' : '#f0fdf4',
                    color: p.tipo === 'empresa' ? '#1d4ed8' : p.es_universitario ? '#7c3aed' : '#059669',
                    padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600
                  }}>
                    {p.tipo === 'empresa' ? 'Empresa' : p.es_universitario ? 'Universitario' : 'Individual'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={{ ...modalStyle, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Nuevo participante</h3>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[['empresa', 'De empresa'], ['individual', 'Individual']].map(([v, l]) => (
                <button key={v} onClick={() => f('tipo')(v)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${form.tipo === v ? '#8B1A1A' : '#e2e8f0'}`, background: form.tipo === v ? '#f9f0f0' : '#fff', color: form.tipo === v ? '#8B1A1A' : '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {l}
                </button>
              ))}
            </div>

            <Field label="Nombre completo *" value={form.nombre} onChange={f('nombre')} placeholder="Nombre completo" />
            <Field label="Correo electrónico *" type="email" value={form.correo} onChange={f('correo')} placeholder="correo@ejemplo.com" />
            <Field label="WhatsApp" value={form.whatsapp} onChange={f('whatsapp')} placeholder="222 123 4567" />

            {form.tipo === 'empresa' ? (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Empresa</label>
                <select value={form.empresa_id} onChange={e => f('empresa_id')(e.target.value)} style={inputStyle}>
                  <option value="">— Selecciona empresa —</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            ) : (
              <>
                <Field label="Empresa donde trabaja (opcional)" value={form.empresa_manual} onChange={f('empresa_manual')} placeholder="Para estadísticas" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                  <input type="checkbox" checked={form.es_universitario} onChange={e => f('es_universitario')(e.target.checked)} />
                  <span style={{ color: '#374151', fontSize: 13 }}>¿Es estudiante universitario?</span>
                </label>
                {form.es_universitario && (
                  <>
                    <Field label="Universidad" value={form.universidad} onChange={f('universidad')} placeholder="ej. BUAP, UDLAP" />
                    <Field label="Carrera" value={form.carrera} onChange={f('carrera')} placeholder="ej. Ingeniería Industrial" />
                  </>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.nombre || !form.correo} style={btnPrimary}>
                {saving ? 'Guardando...' : 'Registrar participante'}
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
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 520, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }
