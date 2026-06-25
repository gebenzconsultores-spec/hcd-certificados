import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ROLES = {
  admin: { label: 'Administrador', color: '#8B1A1A', desc: 'Acceso total: ventas, comisiones, configuración' },
  subadmin: { label: 'Subadministrador', color: '#1d4ed8', desc: 'Dashboard de comportamiento. No ve ventas ni modifica configuración' },
  soporte: { label: 'Soporte', color: '#059669', desc: 'Modifica datos de estudiantes y empresas. No ve ventas' },
}

export default function AdminEquipo() {
  const [equipo, setEquipo] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'soporte' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('equipo').select('*').order('created_at', { ascending: false })
    setEquipo(data || [])
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!form.nombre || !form.email) return
    setSaving(true)
    try {
      await supabase.from('equipo').insert({ ...form, activo: true })
      await cargar()
      setModal(false)
      setForm({ nombre: '', email: '', rol: 'soporte' })
    } catch (e) {
      alert('No se pudo agregar. Es posible que el correo ya esté registrado.')
    } finally { setSaving(false) }
  }

  async function toggleActivo(m) {
    await supabase.from('equipo').update({ activo: !m.activo }).eq('id', m.id)
    await cargar()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este miembro del equipo?')) return
    await supabase.from('equipo').delete().eq('id', id)
    await cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Equipo y permisos</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Gestiona accesos de subadministradores y soporte</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Agregar miembro</button>
      </div>

      {/* Explicación de roles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {Object.entries(ROLES).map(([key, rol]) => (
          <div key={key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${rol.color}` }}>
            <div style={{ color: rol.color, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{rol.label}</div>
            <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>{rol.desc}</p>
          </div>
        ))}
      </div>

      {/* Aviso importante */}
      <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '12px 18px', marginBottom: 24 }}>
        <p style={{ color: '#713f12', fontSize: 13 }}>
          ℹ️ Para que un miembro pueda iniciar sesión, primero debes crearle un usuario en <strong>Supabase → Authentication → Users</strong> con el mismo correo que registres aquí.
        </p>
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Nombre', 'Correo', 'Rol', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipo.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay miembros del equipo registrados</td></tr>
            )}
            {equipo.map(m => {
              const rol = ROLES[m.rol] || ROLES.soporte
              return (
                <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{m.nombre}</td>
                  <td style={{ padding: '12px 16px', color: '#475569', fontSize: 13 }}>{m.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: `${rol.color}15`, color: rol.color, padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{rol.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={m.activo} onChange={() => toggleActivo(m)} style={{ accentColor: '#059669', width: 15, height: 15 }} />
                      <span style={{ fontSize: 12, color: m.activo ? '#059669' : '#94a3b8' }}>{m.activo ? 'Activo' : 'Inactivo'}</span>
                    </label>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => eliminar(m.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Agregar miembro del equipo</h3>
            <label style={lbl}>Nombre completo *</label>
            <input value={form.nombre} onChange={e => f('nombre')(e.target.value)} placeholder="Nombre del colaborador" style={inp} />
            <label style={lbl}>Correo electrónico *</label>
            <input type="email" value={form.email} onChange={e => f('email')(e.target.value)} placeholder="correo@hablandocondatos.com" style={inp} />
            <label style={lbl}>Rol</label>
            <select value={form.rol} onChange={e => f('rol')(e.target.value)} style={inp}>
              <option value="subadmin">Subadministrador (solo dashboard)</option>
              <option value="soporte">Soporte (edita estudiantes/empresas)</option>
            </select>
            <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '12px 16px', marginTop: 12, fontSize: 12, color: '#64748b' }}>
              {ROLES[form.rol]?.desc}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.nombre || !form.email} style={btnPrimary}>{saving ? 'Guardando...' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 460, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
