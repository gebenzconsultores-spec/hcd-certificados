import { useEffect, useState } from 'react'
import { supabase, getEmpresas } from '../lib/supabase'

export default function Empresas() {
  const [empresas, setEmpresas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [modal, setModal] = useState(false)
  const [filtro, setFiltro] = useState('todas') // 'todas', 'cliente_nuevo', 'cartera'
  const [form, setForm] = useState({
    nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '',
    estatus: 'cliente_nuevo', clave_vendedor: 'VEND-GERENCIA'
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const data = await getEmpresas()
      setEmpresas(data || [])
    } catch (_) {
      const { data } = await supabase.from('empresas').select('*').order('created_at', { ascending: false })
      setEmpresas(data || [])
    }
    try {
      const { data: v } = await supabase.from('vendedores').select('clave, nombre').eq('activo', true).order('nombre')
      setVendedores(v || [])
    } catch (_) { setVendedores([]) }
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!form.nombre) return
    setSaving(true)
    try {
      // Buscar el vendedor por clave para ligar su id
      const vend = vendedores.find(v => v.clave === form.clave_vendedor)
      const { error } = await supabase.from('empresas').insert({
        nombre: form.nombre,
        contacto_nombre: form.contacto_nombre,
        contacto_email: form.contacto_email,
        contacto_whatsapp: form.contacto_whatsapp,
        ciudad: form.ciudad,
        estatus: form.estatus,
        clave_vendedor: form.clave_vendedor || 'VEND-GERENCIA',
        activo: true
      })
      if (error) { alert('No se pudo guardar: ' + error.message); setSaving(false); return }
      await cargar()
      setModal(false)
      setForm({ nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '', estatus: 'cliente_nuevo', clave_vendedor: 'VEND-GERENCIA' })
    } catch (e) { alert('Error: ' + (e.message || '')) } finally { setSaving(false) }
  }

  const filtradas = filtro === 'todas' ? empresas : empresas.filter(e => (e.estatus || 'cliente_nuevo') === filtro)
  const nombreVendedor = clave => vendedores.find(v => v.clave === clave)?.nombre || clave || '—'

  const conteoNuevos = empresas.filter(e => (e.estatus || 'cliente_nuevo') === 'cliente_nuevo').length
  const conteoCartera = empresas.filter(e => e.estatus === 'cartera').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Empresas</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Clientes corporativos. Solo los "cliente nuevo" cuentan como venta de la plataforma.</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Nueva empresa</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['todas', `Todas (${empresas.length})`], ['cliente_nuevo', `🟢 Cliente nuevo (${conteoNuevos})`], ['cartera', `📁 En cartera (${conteoCartera})`]].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            style={{ background: filtro === v ? '#8B1A1A' : '#fff', color: filtro === v ? '#fff' : '#475569', border: `1px solid ${filtro === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Empresa', 'Estatus', 'Vendedor', 'Ciudad', 'Contacto', 'WhatsApp'].map(h => (
                <th key={h} style={{ padding: '11px 18px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay empresas en este filtro</td></tr>
            )}
            {filtradas.map(e => {
              const nuevo = (e.estatus || 'cliente_nuevo') === 'cliente_nuevo'
              return (
                <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 18px', color: '#1e293b', fontWeight: 600 }}>{e.nombre}</td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ background: nuevo ? '#f0fdf4' : '#f1f5f9', color: nuevo ? '#059669' : '#64748b', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {nuevo ? '🟢 Cliente nuevo' : '📁 En cartera'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>
                    <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{e.clave_vendedor || 'VEND-GERENCIA'}</code>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{nombreVendedor(e.clave_vendedor)}</div>
                  </td>
                  <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.ciudad || '—'}</td>
                  <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.contacto_nombre || '—'}</td>
                  <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.contacto_whatsapp || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Nueva empresa</h3>

            {/* Estatus */}
            <label style={lbl}>Estatus del cliente *</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {[['cliente_nuevo', '🟢 Cliente nuevo', 'Cuenta como venta'], ['cartera', '📁 En cartera', 'Cliente propio, no cuenta como venta']].map(([v, l, d]) => (
                <button key={v} type="button" onClick={() => f('estatus')(v)}
                  style={{ flex: 1, padding: '12px', border: `2px solid ${form.estatus === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 10, background: form.estatus === v ? '#f9f0f0' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.estatus === v ? '#8B1A1A' : '#475569' }}>{l}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{d}</div>
                </button>
              ))}
            </div>

            {/* Clave de vendedor */}
            <label style={lbl}>Clave de vendedor</label>
            <select value={form.clave_vendedor} onChange={e => f('clave_vendedor')(e.target.value)} style={inp}>
              {vendedores.map(v => <option key={v.clave} value={v.clave}>{v.clave} — {v.nombre}</option>)}
            </select>
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, marginBottom: 14 }}>Si la empresa llegó directo (sin vendedor), deja "Gerencia Comercial".</p>

            <Field label="Nombre de la empresa *" value={form.nombre} onChange={f('nombre')} placeholder="ej. Volkswagen de México" />
            <Field label="Ciudad" value={form.ciudad} onChange={f('ciudad')} placeholder="ej. Puebla" />
            <Field label="Nombre del contacto" value={form.contacto_nombre} onChange={f('contacto_nombre')} placeholder="ej. Juan Pérez" />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Email del contacto" type="email" value={form.contacto_email} onChange={f('contacto_email')} placeholder="contacto@empresa.com" /></div>
              <div style={{ flex: 1 }}><Field label="WhatsApp" value={form.contacto_whatsapp} onChange={f('contacto_whatsapp')} placeholder="222 123 4567" /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.nombre} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar empresa'}</button>
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
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', boxSizing: 'border-box' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }
