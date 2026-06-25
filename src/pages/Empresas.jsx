import { useEffect, useState } from 'react'
import { getEmpresas, crearEmpresa, supabase } from '../lib/supabase'

export default function Empresas() {
  const [empresas, setEmpresas] = useState([])
  const [modal, setModal] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todas')
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
      // Generar ID para empresa creada por admin (cliente directo)
      const { count } = await supabase.from('empresas').select('id', { count: 'exact', head: true })
      const id_empresa = `EMP-${String((count || 0) + 1).padStart(4, '0')}`
      await crearEmpresa({ ...form, id_empresa, tipo_acceso: 'cliente', tipo_cliente: 'nuevo', activo: true })
      await cargar()
      setModal(false)
      setForm({ nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '' })
    } finally { setSaving(false) }
  }

  async function toggleActivo(emp) {
    await supabase.from('empresas').update({ activo: !emp.activo }).eq('id', emp.id)
    await cargar()
  }

  async function cambiarTipoAcceso(emp, tipo) {
    const update = { tipo_acceso: tipo }
    // Si lo pasamos a cliente, quitar límite de prueba
    if (tipo === 'cliente') update.fecha_fin_prueba = null
    await supabase.from('empresas').update(update).eq('id', emp.id)
    await cargar()
    if (detalle?.id === emp.id) setDetalle({ ...detalle, ...update })
  }

  function diasRestantes(emp) {
    if (emp.tipo_acceso === 'cliente' || !emp.fecha_fin_prueba) return null
    const dias = Math.ceil((new Date(emp.fecha_fin_prueba) - new Date()) / (1000 * 60 * 60 * 24))
    return dias
  }

  const filtradas = empresas
    .filter(e => filtro === 'todas' || (filtro === 'clientes' && e.tipo_acceso === 'cliente') || (filtro === 'prueba' && e.tipo_acceso === 'invitado'))
    .filter(e => `${e.nombre} ${e.id_empresa} ${e.contacto_email}`.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Empresas</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Clientes y empresas en prueba</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Nueva empresa</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['todas', 'Todas'], ['clientes', 'Clientes'], ['prueba', 'En prueba']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            style={{ padding: '6px 16px', borderRadius: 20, border: `2px solid ${filtro === v ? '#8B1A1A' : '#e2e8f0'}`, background: filtro === v ? '#f9f0f0' : '#fff', color: filtro === v ? '#8B1A1A' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar empresa, ID, correo..."
          style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 13, outline: 'none', minWidth: 260 }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['ID', 'Empresa', 'Acceso', 'Cliente', 'Prueba', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay empresas</td></tr>
            )}
            {filtradas.map(e => {
              const dias = diasRestantes(e)
              return (
                <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px' }}>
                    {e.id_empresa ? <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{e.id_empresa}</code> : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>
                    {e.nombre}
                    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 400 }}>{e.contacto_email}</div>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: e.tipo_acceso === 'cliente' ? '#f0fdf4' : '#eff6ff', color: e.tipo_acceso === 'cliente' ? '#059669' : '#1d4ed8', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {e.tipo_acceso === 'cliente' ? 'Cliente' : 'Invitado'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ color: '#475569', fontSize: 12 }}>{e.tipo_cliente === 'recurrente' ? 'Recurrente' : 'Nuevo'}</span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    {dias === null ? <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                      : dias > 0 ? <span style={{ color: dias <= 7 ? '#d97706' : '#64748b', fontSize: 12, fontWeight: 600 }}>{dias} días</span>
                      : <span style={{ color: '#dc2626', fontSize: 12, fontWeight: 600 }}>Vencida</span>}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: e.activo ? '#f0fdf4' : '#fef2f2', color: e.activo ? '#059669' : '#dc2626', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {e.activo ? '● Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <button onClick={() => setDetalle(e)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Ver</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal detalle empresa con credenciales */}
      {detalle && (
        <div style={overlayStyle} onClick={() => setDetalle(null)}>
          <div style={{ ...modalStyle, width: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                {detalle.id_empresa && <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{detalle.id_empresa}</code>}
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 8 }}>{detalle.nombre}</h3>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {/* Credenciales de acceso */}
            <div style={{ background: '#f9f0f0', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ color: '#8B1A1A', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>🔑 Credenciales de acceso al portal</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>ID de empresa</div>
                  <div style={{ color: '#8B1A1A', fontSize: 16, fontWeight: 800 }}>{detalle.id_empresa || '—'}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Contraseña</div>
                  <div style={{ color: '#1e293b', fontSize: 15, fontWeight: 700 }}>{detalle.portal_password || '(no definida)'}</div>
                </div>
              </div>
            </div>

            {/* Datos */}
            {[
              ['Contacto', detalle.contacto_nombre],
              ['Correo', detalle.contacto_email],
              ['WhatsApp', detalle.contacto_whatsapp],
              ['Ciudad', detalle.ciudad],
              ['Cómo llegó', detalle.como_llego],
              ['Registro', detalle.fecha_registro ? new Date(detalle.fecha_registro).toLocaleDateString('es-MX') : null],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>{l}</span>
                <span style={{ color: '#1e293b', fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}

            {/* Controles admin */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>TIPO DE ACCESO</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => cambiarTipoAcceso(detalle, 'invitado')}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${detalle.tipo_acceso === 'invitado' ? '#1d4ed8' : '#e2e8f0'}`, background: detalle.tipo_acceso === 'invitado' ? '#eff6ff' : '#fff', color: detalle.tipo_acceso === 'invitado' ? '#1d4ed8' : '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    Invitado (prueba)
                  </button>
                  <button onClick={() => cambiarTipoAcceso(detalle, 'cliente')}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${detalle.tipo_acceso === 'cliente' ? '#059669' : '#e2e8f0'}`, background: detalle.tipo_acceso === 'cliente' ? '#f0fdf4' : '#fff', color: detalle.tipo_acceso === 'cliente' ? '#059669' : '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    Cliente (permanente)
                  </button>
                </div>
              </div>
              <button onClick={() => toggleActivo(detalle)}
                style={{ background: detalle.activo ? '#fef2f2' : '#f0fdf4', color: detalle.activo ? '#dc2626' : '#059669', border: `1px solid ${detalle.activo ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {detalle.activo ? 'Dar de baja esta empresa' : 'Reactivar empresa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva empresa */}
      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Nueva empresa (cliente directo)</h3>
            <Field label="Nombre de la empresa *" value={form.nombre} onChange={f('nombre')} placeholder="ej. Volkswagen de México" />
            <Field label="Ciudad" value={form.ciudad} onChange={f('ciudad')} placeholder="ej. Puebla" />
            <Field label="Nombre del contacto" value={form.contacto_nombre} onChange={f('contacto_nombre')} placeholder="ej. Juan Pérez" />
            <Field label="Email del contacto" type="email" value={form.contacto_email} onChange={f('contacto_email')} placeholder="contacto@empresa.com" />
            <Field label="WhatsApp del contacto" value={form.contacto_whatsapp} onChange={f('contacto_whatsapp')} placeholder="222 123 4567" />
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
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b' }} />
    </div>
  )
}

const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 500, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }
