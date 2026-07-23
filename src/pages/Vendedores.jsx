import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

// Descarga un arreglo de objetos como archivo .xlsx
function exportarAExcel(filas, archivo, hoja = 'Datos') {
  if (!filas || filas.length === 0) { alert('No hay datos para exportar.'); return }
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, hoja)
  XLSX.writeFile(wb, archivo)
}

export default function Vendedores() {
  const [vendedores, setVendedores] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [modal, setModal] = useState(false)
  const [editar, setEditar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', whatsapp: '', correo: '', zona: '', comision: 0, comision_recompra: 0, rol: 'vendedor' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data: v } = await supabase.from('vendedores').select('*').order('created_at', { ascending: true })
      setVendedores(v || [])
      const { data: e } = await supabase.from('empresas').select('id, nombre, estatus, clave_vendedor')
      setEmpresas(e || [])
    } catch (_) {}
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  // Genera clave automática tipo VEND-0001
  async function generarClave() {
    try {
      const { data } = await supabase.rpc('siguiente_id', { p_prefijo: 'VEND', p_tabla: 'vendedores', p_columna: 'clave' })
      if (data) return data
    } catch (_) {}
    let max = 0
    vendedores.forEach(v => {
      const m = (v.clave || '').match(/VEND-(\d+)/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    })
    return `VEND-${String(max + 1).padStart(4, '0')}`
  }

  async function guardar() {
    if (!form.nombre) { alert('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const clave = await generarClave()
      const { error } = await supabase.from('vendedores').insert({
        clave, nombre: form.nombre, whatsapp: form.whatsapp, correo: form.correo,
        zona: form.zona, comision: Number(form.comision) || 0, comision_recompra: Number(form.comision_recompra) || 0, rol: form.rol, activo: true
      })
      if (error) { alert('No se pudo guardar: ' + error.message); setSaving(false); return }
      alert(`✅ Vendedor creado.\n\nClave asignada: ${clave}\n\nEsta clave se usa al registrar empresas que este vendedor traiga.`)
      await cargar()
      setModal(false)
      setForm({ nombre: '', whatsapp: '', correo: '', zona: '', comision: 0, comision_recompra: 0, rol: 'vendedor' })
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  async function guardarEdicion() {
    setSaving(true)
    try {
      const { error } = await supabase.from('vendedores').update({
        nombre: editar.nombre, whatsapp: editar.whatsapp, correo: editar.correo,
        zona: editar.zona, comision: Number(editar.comision) || 0, comision_recompra: Number(editar.comision_recompra) || 0, rol: editar.rol, activo: editar.activo
      }).eq('id', editar.id)
      if (error) { alert('No se pudo guardar: ' + error.message); setSaving(false); return }
      await cargar()
      setEditar(null)
    } catch (e) { alert('Error: ' + (e.message || '')) } finally { setSaving(false) }
  }

  async function eliminar(v) {
    if (v.clave === 'VEND-GERENCIA') { alert('La clave de Gerencia Comercial no se puede eliminar (es la clave por defecto).'); return }
    const cuantas = empresas.filter(e => e.clave_vendedor === v.clave).length
    if (!window.confirm(`¿Eliminar al vendedor ${v.nombre}?${cuantas > 0 ? `\n\nTiene ${cuantas} empresa(s) asignada(s), que quedarán sin vendedor.` : ''}`)) return
    try {
      await supabase.from('vendedores').delete().eq('id', v.id)
      await cargar()
    } catch (e) { alert('Error: ' + (e.message || '')) }
  }

  // Contar empresas y ventas (cliente nuevo) por vendedor
  function statsVendedor(clave) {
    const suyas = empresas.filter(e => e.clave_vendedor === clave)
    const nuevas = suyas.filter(e => e.estatus === 'cliente_nuevo')
    return { total: suyas.length, ventas: nuevas.length }
  }

  const ROL_LABEL = { vendedor: 'Vendedor', director: 'Director', gerencia: 'Gerencia' }

  function descargarExcel() {
    const filas = vendedores.map(v => {
      const st = statsVendedor(v.clave)
      return {
        'Clave': v.clave || '',
        'Nombre': v.nombre || '',
        'Rol': ROL_LABEL[v.rol] || v.rol || '',
        'Zona': v.zona || '',
        'Comisión nuevo (%)': v.comision || 0,
        'Comisión recompra (%)': v.comision_recompra || 0,
        'Clientes': st.total,
        'Ventas (nuevos)': st.ventas,
        'WhatsApp': v.whatsapp || '',
        'Correo': v.correo || '',
        'Activo': v.activo === false ? 'No' : 'Sí',
      }
    })
    const hoy = new Date().toISOString().slice(0, 10)
    exportarAExcel(filas, `vendedores_${hoy}.xlsx`, 'Vendedores')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Vendedores</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Distribuidores de la plataforma. Cada uno tiene una clave para asignar los clientes que trae.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={descargarExcel} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>⬇️ Descargar Excel</button>
          <button onClick={() => setModal(true)} style={btnPrimary}>+ Nuevo vendedor</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Clave', 'Nombre', 'Rol', 'Zona', 'Comisión', 'Clientes', 'Ventas (nuevos)', 'Contacto', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</td></tr>}
            {!loading && vendedores.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay vendedores. Crea el primero.</td></tr>
            )}
            {vendedores.map(v => {
              const st = statsVendedor(v.clave)
              const esGerencia = v.clave === 'VEND-GERENCIA'
              return (
                <tr key={v.id} style={{ borderTop: '1px solid #f1f5f9', background: esGerencia ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '11px 16px' }}>
                    <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '3px 8px', borderRadius: 5, fontSize: 12, fontWeight: 700 }}>{v.clave}</code>
                  </td>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{v.nombre}{esGerencia && <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>(por defecto)</span>}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: v.rol === 'director' ? '#eff6ff' : v.rol === 'gerencia' ? '#f5f3ff' : '#f0fdf4', color: v.rol === 'director' ? '#1d4ed8' : v.rol === 'gerencia' ? '#7c3aed' : '#059669', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{ROL_LABEL[v.rol] || v.rol}</span>
                  </td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{v.zona || '—'}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{(v.comision || 0)}% <span style={{ color: '#94a3b8' }}>nuevo</span> / {(v.comision_recompra || 0)}% <span style={{ color: '#94a3b8' }}>recompra</span></td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{st.total}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ color: '#059669', fontSize: 14, fontWeight: 700 }}>{st.ventas}</span>
                  </td>
                  <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: 12 }}>{v.whatsapp || v.correo || '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditar({ ...v })} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>✏️ Editar</button>
                      {!esGerencia && <button onClick={() => eliminar(v)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo */}
      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Nuevo vendedor</h3>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>La clave se genera automáticamente al guardar.</p>
            <Field label="Nombre completo *" value={form.nombre} onChange={f('nombre')} placeholder="ej. Juan Pérez" />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="WhatsApp" value={form.whatsapp} onChange={f('whatsapp')} placeholder="222 123 4567" /></div>
              <div style={{ flex: 1 }}><Field label="Correo" value={form.correo} onChange={f('correo')} placeholder="correo@ejemplo.com" /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Zona" value={form.zona} onChange={f('zona')} placeholder="ej. Puebla-Tlaxcala" /></div>
              <div style={{ flex: 1 }}><Field label="Comisión cliente nuevo (%)" type="number" value={form.comision} onChange={f('comision')} placeholder="15" /></div>
              <div style={{ flex: 1 }}><Field label="Comisión recompra (%)" type="number" value={form.comision_recompra} onChange={f('comision_recompra')} placeholder="10" /></div>
            </div>
            <label style={lbl}>Rol</label>
            <select value={form.rol} onChange={e => f('rol')(e.target.value)} style={inp}>
              <option value="vendedor">Vendedor</option>
              <option value="director">Director</option>
              <option value="gerencia">Gerencia</option>
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.nombre} style={btnPrimary}>{saving ? 'Guardando...' : 'Crear vendedor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editar && (
        <div style={overlayStyle} onClick={() => setEditar(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Editar vendedor</h3>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>Clave: <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4 }}>{editar.clave}</code></p>
            <Field label="Nombre completo *" value={editar.nombre} onChange={v => setEditar(p => ({ ...p, nombre: v }))} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="WhatsApp" value={editar.whatsapp || ''} onChange={v => setEditar(p => ({ ...p, whatsapp: v }))} /></div>
              <div style={{ flex: 1 }}><Field label="Correo" value={editar.correo || ''} onChange={v => setEditar(p => ({ ...p, correo: v }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Zona" value={editar.zona || ''} onChange={v => setEditar(p => ({ ...p, zona: v }))} /></div>
              <div style={{ flex: 1 }}><Field label="Comisión cliente nuevo (%)" type="number" value={editar.comision || 0} onChange={v => setEditar(p => ({ ...p, comision: v }))} /></div>
              <div style={{ flex: 1 }}><Field label="Comisión recompra (%)" type="number" value={editar.comision_recompra || 0} onChange={v => setEditar(p => ({ ...p, comision_recompra: v }))} /></div>
            </div>
            <label style={lbl}>Rol</label>
            <select value={editar.rol} onChange={e => setEditar(p => ({ ...p, rol: e.target.value }))} style={inp}>
              <option value="vendedor">Vendedor</option>
              <option value="director">Director</option>
              <option value="gerencia">Gerencia</option>
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditar(null)} style={btnGhost}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
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
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }
