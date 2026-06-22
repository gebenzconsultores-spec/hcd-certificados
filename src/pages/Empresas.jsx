import { useEffect, useState } from 'react'
import { getEmpresas, crearEmpresa } from '../lib/supabase'

export default function Empresas() {
  const [empresas, setEmpresas] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const data = await getEmpresas()
    setEmpresas(data)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!form.nombre) return
    setSaving(true)
    try {
      await crearEmpresa(form)
      await cargar()
      setModal(false)
      setForm({ nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Empresas</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Clientes corporativos de Hablando con Datos</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Nueva empresa</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Empresa', 'Ciudad', 'Contacto', 'Email', 'WhatsApp'].map(h => (
                <th key={h} style={{ padding: '11px 18px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empresas.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay empresas registradas</td></tr>
            )}
            {empresas.map(e => (
              <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 18px', color: '#1e293b', fontWeight: 600 }}>{e.nombre}</td>
                <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.ciudad || '—'}</td>
                <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.contacto_nombre || '—'}</td>
                <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.contacto_email || '—'}</td>
                <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.contacto_whatsapp || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Nueva empresa</h3>
            <Field label="Nombre de la empresa *" value={form.nombre} onChange={f('nombre')} placeholder="ej. Volkswagen de México" />
            <Field label="Ciudad" value={form.ciudad} onChange={f('ciudad')} placeholder="ej. Puebla" />
            <Field label="Nombre del contacto" value={form.contacto_nombre} onChange={f('contacto_nombre')} placeholder="ej. Juan Pérez" />
            <Field label="Email del contacto" type="email" value={form.contacto_email} onChange={f('contacto_email')} placeholder="contacto@empresa.com" />
            <Field label="WhatsApp del contacto" value={form.contacto_whatsapp} onChange={f('contacto_whatsapp')} placeholder="222 123 4567" />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.nombre} style={btnPrimary}>
                {saving ? 'Guardando...' : 'Guardar empresa'}
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
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b' }} />
    </div>
  )
}

const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 500, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }
