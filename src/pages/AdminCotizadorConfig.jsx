import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminCotizadorConfig() {
  const [tab, setTab] = useState('cupones')

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Configuración del cotizador</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Cupones, servicios de consultoría y viáticos por zona</p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
        {[
          { id: 'cupones', label: '🎟️ Cupones' },
          { id: 'servicios', label: '🛠️ Servicios / Consultoría' },
          { id: 'viaticos', label: '🚗 Viáticos por zona' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#8B1A1A' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#8B1A1A' : '#64748b', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cupones' && <Cupones />}
      {tab === 'servicios' && <Servicios />}
      {tab === 'viaticos' && <Viaticos />}
    </div>
  )
}

// ─── CUPONES ──────────────────────────────────────────────────
function Cupones() {
  const [cupones, setCupones] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ codigo: '', tipo: 'porcentaje', valor: 10, descripcion: '', usos_maximos: 0, vigencia_hasta: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    const { data } = await supabase.from('cupones').select('*').order('created_at', { ascending: false })
    setCupones(data || [])
  }
  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  function generarCodigo() {
    const random = Math.random().toString(36).substring(2, 7).toUpperCase()
    f('codigo')(`HCD-${random}`)
  }

  async function guardar() {
    if (!form.codigo) return
    setSaving(true)
    try {
      await supabase.from('cupones').insert({
        codigo: form.codigo.toUpperCase().trim(),
        tipo: form.tipo,
        valor: form.tipo === '2x1' ? 50 : Number(form.valor),
        descripcion: form.descripcion,
        usos_maximos: Number(form.usos_maximos),
        vigencia_hasta: form.vigencia_hasta || null,
        activo: true
      })
      await cargar()
      setModal(false)
      setForm({ codigo: '', tipo: 'porcentaje', valor: 10, descripcion: '', usos_maximos: 0, vigencia_hasta: '' })
    } catch (e) {
      alert('Error: ' + (e.message || 'el código ya existe'))
    } finally { setSaving(false) }
  }

  async function toggleActivo(c) {
    await supabase.from('cupones').update({ activo: !c.activo }).eq('id', c.id)
    await cargar()
  }
  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este cupón?')) return
    await supabase.from('cupones').delete().eq('id', id)
    await cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: '#64748b', fontSize: 13 }}>Genera códigos de descuento para tus clientes</p>
        <button onClick={() => { generarCodigo(); setModal(true) }} style={btnPrimary}>+ Generar cupón</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Código', 'Tipo', 'Valor', 'Usos', 'Vigencia', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cupones.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin cupones generados</td></tr>}
            {cupones.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 16px' }}><code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{c.codigo}</code></td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ background: c.tipo === '2x1' ? '#fef3c7' : '#eff6ff', color: c.tipo === '2x1' ? '#92400e' : '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {c.tipo === '2x1' ? '2x1' : 'Porcentaje'}
                  </span>
                </td>
                <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 700, fontSize: 13 }}>{c.tipo === '2x1' ? '50%' : `${c.valor}%`}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{c.usos_actuales}{c.usos_maximos > 0 ? ` / ${c.usos_maximos}` : ' / ∞'}</td>
                <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: 12 }}>{c.vigencia_hasta ? new Date(c.vigencia_hasta).toLocaleDateString('es-MX') : 'Sin límite'}</td>
                <td style={{ padding: '11px 16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={c.activo} onChange={() => toggleActivo(c)} style={{ accentColor: '#8B1A1A', width: 15, height: 15 }} />
                    <span style={{ fontSize: 12, color: c.activo ? '#059669' : '#94a3b8' }}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                  </label>
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <button onClick={() => eliminar(c.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Generar cupón</h3>
            <label style={lbl}>Código del cupón</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={form.codigo} onChange={e => f('codigo')(e.target.value.toUpperCase())} style={{ ...inp, flex: 1 }} />
              <button onClick={generarCodigo} style={{ ...btnSecondary, whiteSpace: 'nowrap' }}>🎲 Aleatorio</button>
            </div>
            <label style={lbl}>Tipo de descuento</label>
            <select value={form.tipo} onChange={e => f('tipo')(e.target.value)} style={inp}>
              <option value="porcentaje">Porcentaje de descuento</option>
              <option value="2x1">2x1 (paga 1, lleva 2 = 50%)</option>
            </select>
            {form.tipo === 'porcentaje' && (
              <>
                <label style={lbl}>Porcentaje (%)</label>
                <input type="number" min={1} max={100} value={form.valor} onChange={e => f('valor')(e.target.value)} style={inp} />
              </>
            )}
            <label style={lbl}>Descripción (opcional)</label>
            <input value={form.descripcion} onChange={e => f('descripcion')(e.target.value)} placeholder="ej. Promoción de marzo" style={inp} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Usos máximos (0 = ilimitado)</label>
                <input type="number" min={0} value={form.usos_maximos} onChange={e => f('usos_maximos')(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Vigencia hasta</label>
                <input type="date" value={form.vigencia_hasta} onChange={e => f('vigencia_hasta')(e.target.value)} style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.codigo} style={btnPrimary}>{saving ? 'Guardando...' : 'Generar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SERVICIOS ────────────────────────────────────────────────
function Servicios() {
  const [servicios, setServicios] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio_hora: 2000, precio_proyecto: '', tipo_cobro: 'hora' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    const { data } = await supabase.from('servicios').select('*').order('orden')
    setServicios(data || [])
  }
  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  function abrir(s = null) {
    if (s) { setForm({ nombre: s.nombre, descripcion: s.descripcion || '', precio_hora: s.precio_hora, precio_proyecto: s.precio_proyecto || '', tipo_cobro: s.tipo_cobro }); setEditando(s) }
    else { setForm({ nombre: '', descripcion: '', precio_hora: 2000, precio_proyecto: '', tipo_cobro: 'hora' }); setEditando(null) }
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre) return
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre, descripcion: form.descripcion,
        precio_hora: Number(form.precio_hora),
        precio_proyecto: form.precio_proyecto ? Number(form.precio_proyecto) : null,
        tipo_cobro: form.tipo_cobro
      }
      if (editando) await supabase.from('servicios').update(payload).eq('id', editando.id)
      else await supabase.from('servicios').insert({ ...payload, orden: servicios.length + 1, activo: true })
      await cargar()
      setModal(false)
    } finally { setSaving(false) }
  }
  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este servicio?')) return
    await supabase.from('servicios').delete().eq('id', id)
    await cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: '#64748b', fontSize: 13 }}>Precios de consultoría conectados al cotizador</p>
        <button onClick={() => abrir()} style={btnPrimary}>+ Nuevo servicio</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {servicios.map(s => (
          <div key={s.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{s.nombre}</h4>
            {s.descripcion && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>{s.descripcion}</p>}
            <div style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
              ${Number(s.tipo_cobro === 'hora' ? s.precio_hora : s.precio_proyecto).toLocaleString('es-MX')}
              <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}> / {s.tipo_cobro === 'hora' ? 'hora' : 'proyecto'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => abrir(s)} style={{ ...btnSecondary, flex: 1 }}>Editar</button>
              <button onClick={() => eliminar(s.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{editando ? 'Editar' : 'Nuevo'} servicio</h3>
            <label style={lbl}>Nombre del servicio</label>
            <input value={form.nombre} onChange={e => f('nombre')(e.target.value)} placeholder="ej. Implementación ISO 9001" style={inp} />
            <label style={lbl}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => f('descripcion')(e.target.value)} rows={2} style={{ ...inp, resize: 'none' }} />
            <label style={lbl}>Tipo de cobro</label>
            <select value={form.tipo_cobro} onChange={e => f('tipo_cobro')(e.target.value)} style={inp}>
              <option value="hora">Por hora</option>
              <option value="proyecto">Por proyecto</option>
            </select>
            {form.tipo_cobro === 'hora' ? (
              <>
                <label style={lbl}>Precio por hora ($)</label>
                <input type="number" value={form.precio_hora} onChange={e => f('precio_hora')(e.target.value)} style={inp} />
              </>
            ) : (
              <>
                <label style={lbl}>Precio por proyecto ($)</label>
                <input type="number" value={form.precio_proyecto} onChange={e => f('precio_proyecto')(e.target.value)} style={inp} />
              </>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.nombre} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── VIÁTICOS ─────────────────────────────────────────────────
function Viaticos() {
  const [zonas, setZonas] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ estado: '', zona: 'nacional', monto: 0, incluye_avion: false, notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    const { data } = await supabase.from('viaticos_zonas').select('*').order('monto')
    setZonas(data || [])
  }
  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  function abrir(z = null) {
    if (z) { setForm({ estado: z.estado, zona: z.zona, monto: z.monto, incluye_avion: z.incluye_avion, notas: z.notas || '' }); setEditando(z) }
    else { setForm({ estado: '', zona: 'nacional', monto: 0, incluye_avion: false, notas: '' }); setEditando(null) }
    setModal(true)
  }

  async function guardar() {
    if (!form.estado) return
    setSaving(true)
    try {
      const payload = { estado: form.estado, zona: form.zona, monto: Number(form.monto), incluye_avion: form.incluye_avion, notas: form.notas }
      if (editando) await supabase.from('viaticos_zonas').update(payload).eq('id', editando.id)
      else await supabase.from('viaticos_zonas').insert({ ...payload, activo: true })
      await cargar()
      setModal(false)
    } finally { setSaving(false) }
  }
  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta zona?')) return
    await supabase.from('viaticos_zonas').delete().eq('id', id)
    await cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: '#64748b', fontSize: 13 }}>Define los viáticos por estado. Aparecerán en el cotizador.</p>
        <button onClick={() => abrir()} style={btnPrimary}>+ Nueva zona</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Estado / Zona', 'Categoría', 'Monto', 'Avión', 'Notas', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zonas.map(z => (
              <tr key={z.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{z.estado}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ background: z.zona === 'local' ? '#f0fdf4' : z.zona === 'regional' ? '#eff6ff' : '#fef3c7', color: z.zona === 'local' ? '#059669' : z.zona === 'regional' ? '#1d4ed8' : '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                    {z.zona}
                  </span>
                </td>
                <td style={{ padding: '11px 16px', color: '#8B1A1A', fontWeight: 700, fontSize: 13 }}>{z.monto === 0 ? 'Incluido' : `$${Number(z.monto).toLocaleString('es-MX')}`}</td>
                <td style={{ padding: '11px 16px', fontSize: 13 }}>{z.incluye_avion ? '✈️ Sí' : '—'}</td>
                <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: 12 }}>{z.notas || '—'}</td>
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => abrir(z)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11 }}>Editar</button>
                    <button onClick={() => eliminar(z.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{editando ? 'Editar' : 'Nueva'} zona de viáticos</h3>
            <label style={lbl}>Estado / Descripción de zona</label>
            <input value={form.estado} onChange={e => f('estado')(e.target.value)} placeholder="ej. San Luis Potosí" style={inp} />
            <label style={lbl}>Categoría</label>
            <select value={form.zona} onChange={e => f('zona')(e.target.value)} style={inp}>
              <option value="local">Local (incluido)</option>
              <option value="regional">Regional</option>
              <option value="nacional">Nacional</option>
            </select>
            <label style={lbl}>Monto de viáticos ($)</label>
            <input type="number" value={form.monto} onChange={e => f('monto')(e.target.value)} style={inp} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
              <input type="checkbox" checked={form.incluye_avion} onChange={e => f('incluye_avion')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#374151' }}>Incluye boleto de avión</span>
            </label>
            <label style={lbl}>Notas</label>
            <input value={form.notas} onChange={e => f('notas')(e.target.value)} placeholder="ej. Gasolina, hospedaje 1 noche" style={inp} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.estado} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
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
const btnSecondary = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
