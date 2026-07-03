import { useEffect, useState } from 'react'
import { supabase, getEmpresas } from '../lib/supabase'

export default function Empresas() {
  const [empresas, setEmpresas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [modal, setModal] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [empleadosEmpresa, setEmpleadosEmpresa] = useState([])
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false)
  const [filtro, setFiltro] = useState('todas') // 'todas', 'cliente_nuevo', 'cartera'
  const [form, setForm] = useState({
    nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '',
    estatus: 'cliente_nuevo', clave_vendedor: 'VEND-GERENCIA'
  })
  const [saving, setSaving] = useState(false)
  const [credencialesNuevas, setCredencialesNuevas] = useState(null)

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

  // Genera ID de empresa EMP-XXXX sin duplicados
  async function generarIdEmpresa() {
    try {
      const { data } = await supabase.rpc('siguiente_id', { p_prefijo: 'EMP', p_tabla: 'empresas', p_columna: 'id_empresa' })
      if (data) return data
    } catch (_) {}
    const { data: existentes } = await supabase.from('empresas').select('id_empresa').not('id_empresa', 'is', null)
    let maxNum = 0
    ;(existentes || []).forEach(e => {
      const m = (e.id_empresa || '').match(/EMP-(\d+)/)
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    })
    return `EMP-${String(maxNum + 1).padStart(4, '0')}`
  }

  // Al abrir el detalle, cargar los alumnos/empleados de esa empresa
  async function verDetalle(empresa) {
    setDetalle(empresa)
    setCargandoEmpleados(true)
    setEmpleadosEmpresa([])
    try {
      // Empleados por ambos campos (registrado_por_empresa o empresa_id)
      let emps = []
      const e1 = await supabase.from('participantes').select('*').eq('registrado_por_empresa', empresa.id)
      emps = e1.data || []
      const e2 = await supabase.from('participantes').select('*').eq('empresa_id', empresa.id)
      ;(e2.data || []).forEach(p => { if (!emps.find(x => x.id === p.id)) emps.push(p) })
      setEmpleadosEmpresa(emps)
    } catch (_) { setEmpleadosEmpresa([]) }
    setCargandoEmpleados(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  // Restablecer / cambiar la contraseña del portal de una empresa (admin)
  async function restablecerPassword(empresa) {
    const nueva = window.prompt(
      `Contraseña del portal para "${empresa.nombre}".\n\nEscribe una nueva contraseña, o deja vacío y da Aceptar para GENERAR una automática:`,
      ''
    )
    if (nueva === null) return // canceló
    const password = nueva.trim() || Math.random().toString(36).substring(2, 8).toUpperCase()
    try {
      const { error } = await supabase.from('empresas').update({ portal_password: password }).eq('id', empresa.id)
      if (error) { alert('No se pudo actualizar: ' + error.message); return }
      await cargar()
      setDetalle(d => d ? { ...d, portal_password: password } : d)
      alert(`✅ Contraseña actualizada.\n\nEmpresa: ${empresa.nombre}\nID: ${empresa.id_empresa}\nNueva contraseña: ${password}\n\nGuárdala y compártela con la empresa.`)
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    }
  }

  async function guardar() {
    if (!form.nombre) return
    setSaving(true)
    try {
      const idEmpresa = await generarIdEmpresa()
      const password = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { error } = await supabase.from('empresas').insert({
        id_empresa: idEmpresa,
        portal_password: password,
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
      // Mostrar las credenciales generadas
      setCredencialesNuevas({ nombre: form.nombre, id_empresa: idEmpresa, password })
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
              {['Empresa', 'Estatus', 'Vendedor', 'Ciudad', 'Contacto', 'WhatsApp', ''].map(h => (
                <th key={h} style={{ padding: '11px 18px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay empresas en este filtro</td></tr>
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
                  <td style={{ padding: '12px 18px' }}>
                    <button onClick={() => verDetalle(e)} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>👁 Ver</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL DETALLE (Ver): información, acceso al portal, alumnos */}
      {detalle && (
        <div style={overlayStyle} onClick={() => setDetalle(null)}>
          <div style={{ ...modalStyle, width: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{detalle.nombre}</h3>
                <span style={{ background: (detalle.estatus || 'cliente_nuevo') === 'cliente_nuevo' ? '#f0fdf4' : '#f1f5f9', color: (detalle.estatus || 'cliente_nuevo') === 'cliente_nuevo' ? '#059669' : '#64748b', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {(detalle.estatus || 'cliente_nuevo') === 'cliente_nuevo' ? '🟢 Cliente nuevo' : '📁 En cartera'}
                </span>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>

            {/* Acceso al portal */}
            <div style={{ background: '#f9f0f0', border: '1px solid #f0d0d0', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ color: '#8B1A1A', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🔑 ACCESO AL PORTAL DE EMPRESA</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>ID de empresa</div>
                  <code style={{ color: '#1e293b', fontSize: 15, fontWeight: 700 }}>{detalle.id_empresa || '—'}</code>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>Contraseña de portal</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ color: '#1e293b', fontSize: 15, fontWeight: 700 }}>{detalle.portal_password || '—'}</code>
                    {detalle.portal_password && (
                      <button onClick={() => { navigator.clipboard?.writeText(`ID: ${detalle.id_empresa}  Contraseña: ${detalle.portal_password}`); alert('Datos de acceso copiados') }}
                        style={{ background: '#fff', border: '1px solid #8B1A1A', color: '#8B1A1A', borderRadius: 5, padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>📋 Copiar</button>
                    )}
                  </div>
                </div>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>La empresa entra en /empresa/acceso con estos datos.</p>
              <button onClick={() => restablecerPassword(detalle)}
                style={{ marginTop: 10, background: '#fff', border: '1px solid #8B1A1A', color: '#8B1A1A', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                🔄 Restablecer / cambiar contraseña
              </button>
            </div>

            {/* Información */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <InfoItem label="Vendedor" value={`${detalle.clave_vendedor || 'VEND-GERENCIA'} · ${nombreVendedor(detalle.clave_vendedor)}`} />
              <InfoItem label="Ciudad" value={detalle.ciudad || '—'} />
              <InfoItem label="Contacto" value={detalle.contacto_nombre || '—'} />
              <InfoItem label="Correo" value={detalle.contacto_email || detalle.correo || '—'} />
              <InfoItem label="WhatsApp" value={detalle.contacto_whatsapp || '—'} />
            </div>

            {/* Alumnos */}
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>👥 Alumnos / empleados ({empleadosEmpresa.length})</div>
              {cargandoEmpleados ? (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: 12 }}>Cargando...</div>
              ) : empleadosEmpresa.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: 12, background: '#f8f9fb', borderRadius: 8 }}>Esta empresa aún no tiene alumnos registrados.</div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fb' }}>
                        {['ID', 'Nombre', 'Correo', 'Examen'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {empleadosEmpresa.map(emp => (
                        <tr key={emp.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}><code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>{emp.id_empleado || '—'}</code></td>
                          <td style={{ padding: '8px 12px', color: '#1e293b', fontSize: 12, fontWeight: 600 }}>{emp.nombre}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>{emp.correo || '—'}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {emp.acceso_examen ? <span style={{ color: '#059669', fontSize: 11, fontWeight: 600 }}>✓ Habilitado</span> : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credenciales generadas al crear empresa */}
      {credencialesNuevas && (
        <div style={overlayStyle} onClick={() => setCredencialesNuevas(null)}>
          <div style={{ ...modalStyle, width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Empresa creada</h3>
              <p style={{ color: '#64748b', fontSize: 13 }}>{credencialesNuevas.nombre}</p>
            </div>
            <div style={{ background: '#f9f0f0', border: '2px dashed #8B1A1A', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ color: '#8B1A1A', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🔑 DATOS DE ACCESO AL PORTAL</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>ID de empresa</div>
                <code style={{ color: '#1e293b', fontSize: 18, fontWeight: 800 }}>{credencialesNuevas.id_empresa}</code>
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>Contraseña</div>
                <code style={{ color: '#1e293b', fontSize: 18, fontWeight: 800 }}>{credencialesNuevas.password}</code>
              </div>
            </div>
            <p style={{ color: '#991b1b', fontSize: 12, marginBottom: 16 }}>⚠️ Guarda estos datos y dáselos a la empresa. Entra en /empresa/acceso.</p>
            <button onClick={() => { navigator.clipboard?.writeText(`ID: ${credencialesNuevas.id_empresa}  Contraseña: ${credencialesNuevas.password}`); alert('Copiado') }}
              style={{ ...btnPrimary, width: '100%', marginBottom: 8 }}>📋 Copiar datos de acceso</button>
            <button onClick={() => setCredencialesNuevas(null)} style={{ ...btnGhost, width: '100%' }}>Cerrar</button>
          </div>
        </div>
      )}

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

function InfoItem({ label, value }) {
  return (
    <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ color: '#94a3b8', fontSize: 11 }}>{label}</div>
      <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>{value}</div>
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
