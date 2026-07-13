import { useEffect, useState } from 'react'
import { supabase, getCursos } from '../lib/supabase'

// Categorías y bloques del nuevo motor de precios (Paso 2)
const CATEGORIAS = [
  { id: 'A', label: 'A — Especializado', color: '#8B1A1A', bg: '#f9f0f0' },
  { id: 'B', label: 'B — Regular', color: '#1d4ed8', bg: '#eff6ff' },
  { id: 'C', label: 'C — Común', color: '#059669', bg: '#f0fdf4' },
]
const BLOQUES = [
  { id: '1-4', label: '1 a 4 personas' },
  { id: '5-10', label: '5 a 10 personas' },
  { id: '11-15', label: '11 a 15 personas' },
]

export default function AdminPrecios() {
  const [cursos, setCursos] = useState([])
  const [familias, setFamilias] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargar()
    supabase.from('familias').select('*').order('orden').then(({ data }) => setFamilias(data || []))
  }, [])

  async function cargar() {
    setLoading(true)
    const data = await getCursos()
    setCursos(data)
    setLoading(false)
  }

  function abrirEditar(curso) {
    setForm({
      precio_persona_1dia: curso.precio_persona_1dia || 2830,
      precio_persona_2dias: curso.precio_persona_2dias || 5660,
      precio_persona_3dias: curso.precio_persona_3dias || 8090,
      precio_grupo: curso.precio_grupo || '',
      dias_grupo: curso.dias_grupo || 1,
      personas_max: curso.personas_max || 15,
      descuento_porcentaje: curso.descuento_porcentaje || 0,
      descuento_activo: curso.descuento_activo || false,
      familia_id: curso.familia_id || '',
      descripcion: curso.descripcion || '',
      es_publico: curso.es_publico !== false,
    })
    setEditando(curso)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!editando) return
    setSaving(true)
    try {
      await supabase.from('cursos').update({
        precio_persona_1dia: Number(form.precio_persona_1dia),
        precio_persona_2dias: Number(form.precio_persona_2dias),
        precio_persona_3dias: Number(form.precio_persona_3dias),
        precio_grupo: form.precio_grupo ? Number(form.precio_grupo) : null,
        dias_grupo: Number(form.dias_grupo),
        personas_max: Number(form.personas_max),
        descuento_porcentaje: Number(form.descuento_porcentaje),
        descuento_activo: form.descuento_activo,
        familia_id: form.familia_id || null,
        descripcion: form.descripcion,
        es_publico: form.es_publico,
      }).eq('id', editando.id)
      await cargar()
      setEditando(null)
      setMsg('✅ Precios actualizados. Ya están disponibles en el cotizador.')
      setTimeout(() => setMsg(null), 3000)
    } finally { setSaving(false) }
  }

  const cursosFiltrados = cursos.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  if (loading) return <div style={{ color: '#64748b', padding: 40 }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Precios y catálogo público</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Configura precios, descuentos y visibilidad. Se conectan al cotizador en tiempo real.</p>
      </div>

      <MatrizPreciosHora />

      {msg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: '#15803d' }}>{msg}</div>
      )}

      <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔍 Buscar curso por nombre..."
        style={{ width: '100%', maxWidth: 400, border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 14px', fontSize: 14, outline: 'none', marginBottom: 16 }} />

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Clave', 'Curso', 'Familia', '1 día', '2 días', '3 días', 'Grupo', 'Descuento', 'En cotizador', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cursosFiltrados.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay cursos. Créalos primero en la sección Cursos.</td></tr>
            )}
            {cursosFiltrados.map(c => {
              const fam = familias.find(x => x.id === c.familia_id)
              return (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{c.clave_interna || '—'}</code>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{c.nombre}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>{c.duracion}h · {c.dias || 1} día{(c.dias || 1) > 1 ? 's' : ''}</div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {fam ? <span style={{ background: `${fam.color}15`, color: fam.color, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{fam.clave ? `${fam.clave} · ` : ''}{fam.nombre}</span> : <span style={{ color: '#cbd5e1', fontSize: 11 }}>Sin familia</span>}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontSize: 13 }}>${(c.precio_persona_1dia || 2830).toLocaleString('es-MX')}</td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontSize: 13 }}>${(c.precio_persona_2dias || 5660).toLocaleString('es-MX')}</td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontSize: 13 }}>${(c.precio_persona_3dias || 8090).toLocaleString('es-MX')}</td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontSize: 13 }}>{c.precio_grupo ? `$${c.precio_grupo.toLocaleString('es-MX')}` : '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {c.descuento_activo && c.descuento_porcentaje > 0
                      ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>-{c.descuento_porcentaje}%</span>
                      : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: c.es_publico !== false ? '#f0fdf4' : '#f1f5f9', color: c.es_publico !== false ? '#059669' : '#94a3b8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                      {c.es_publico !== false ? 'Visible' : 'Oculto'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => abrirEditar(c)} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Editar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal editar precios */}
      {editando && (
        <div style={overlay} onClick={() => setEditando(null)}>
          <div style={{ ...modalStyle, width: 560, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Precios: {editando.nombre}</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{editando.clave_interna || 'Sin clave'} · {editando.duracion}h · {editando.dias || 1} día{(editando.dias || 1) > 1 ? 's' : ''}</p>

            <label style={lbl}>Familia (para el cotizador)</label>
            <select value={form.familia_id} onChange={e => f('familia_id')(e.target.value)} style={inp}>
              <option value="">— Sin familia —</option>
              {familias.map(fam => <option key={fam.id} value={fam.id}>{fam.icono} {fam.nombre}</option>)}
            </select>

            <label style={lbl}>Descripción (aparece en el cotizador)</label>
            <textarea value={form.descripcion} onChange={e => f('descripcion')(e.target.value)} rows={2} placeholder="Breve descripción del curso" style={{ ...inp, resize: 'none' }} />

            <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 16, marginTop: 16 }}>
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, marginBottom: 12 }}>Precios por persona <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>(+ IVA)</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lblSm}>1 día</label>
                  <input type="number" value={form.precio_persona_1dia} onChange={e => f('precio_persona_1dia')(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lblSm}>2 días</label>
                  <input type="number" value={form.precio_persona_2dias} onChange={e => f('precio_persona_2dias')(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lblSm}>3 días</label>
                  <input type="number" value={form.precio_persona_3dias} onChange={e => f('precio_persona_3dias')(e.target.value)} style={inp} />
                </div>
              </div>
            </div>

            <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 16, marginTop: 12 }}>
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, marginBottom: 12 }}>Precio grupo cerrado</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lblSm}>Precio grupo</label>
                  <input type="number" value={form.precio_grupo} onChange={e => f('precio_grupo')(e.target.value)} placeholder="ej. 38000" style={inp} />
                </div>
                <div>
                  <label style={lblSm}>Días</label>
                  <input type="number" value={form.dias_grupo} onChange={e => f('dias_grupo')(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lblSm}>Máx. personas</label>
                  <input type="number" value={form.personas_max} onChange={e => f('personas_max')(e.target.value)} style={inp} />
                </div>
              </div>
            </div>

            <div style={{ background: '#fef9e7', borderRadius: 10, padding: 16, marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                <input type="checkbox" checked={form.descuento_activo} onChange={e => f('descuento_activo')(e.target.checked)} style={{ accentColor: '#d97706', width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>Activar descuento promocional</span>
              </label>
              {form.descuento_activo && (
                <div>
                  <label style={lblSm}>Porcentaje de descuento (%)</label>
                  <input type="number" value={form.descuento_porcentaje} onChange={e => f('descuento_porcentaje')(e.target.value)} placeholder="ej. 20" style={inp} />
                </div>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 16 }}>
              <input type="checkbox" checked={form.es_publico} onChange={e => f('es_publico')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#374151' }}>Mostrar en el cotizador público</span>
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setEditando(null)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar precios'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MatrizPreciosHora() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data } = await supabase.from('precios_categoria').select('*')
      setRows(data || [])
    } catch (_) { setRows([]) }
    setLoading(false)
  }

  function valor(cat, bloque) {
    const r = rows.find(x => x.categoria === cat && x.bloque === bloque)
    return r ? r.precio_hora : ''
  }
  function setValor(cat, bloque, v) {
    setRows(prev => {
      const existe = prev.some(x => x.categoria === cat && x.bloque === bloque)
      if (existe) return prev.map(r => (r.categoria === cat && r.bloque === bloque ? { ...r, precio_hora: v } : r))
      return [...prev, { categoria: cat, bloque, precio_hora: v }]
    })
  }

  async function guardar() {
    setSaving(true)
    try {
      const payload = []
      for (const cat of CATEGORIAS) for (const b of BLOQUES) {
        payload.push({ categoria: cat.id, bloque: b.id, precio_hora: Number(valor(cat.id, b.id)) || 0 })
      }
      const { error } = await supabase.from('precios_categoria').upsert(payload, { onConflict: 'categoria,bloque' })
      if (error) { alert('No se pudo guardar la matriz: ' + error.message); setSaving(false); return }
      await cargar()
      setOk(true); setTimeout(() => setOk(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Precio por hora (categoría × bloque)</h2>
          <p style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>El cotizador calcula: <strong>precio por hora × horas del curso</strong>. 16 o más personas → cotización especial.</p>
        </div>
        <button onClick={guardar} disabled={saving || loading} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar matriz'}</button>
      </div>

      {ok && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', margin: '8px 0', color: '#15803d', fontSize: 13 }}>✅ Matriz guardada. El cotizador ya la usa.</div>}

      {loading ? (
        <div style={{ color: '#94a3b8', padding: 20 }}>Cargando matriz...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#64748b' }}>Categoría</th>
                {BLOQUES.map(b => <th key={b.id} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#64748b' }}>{b.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {CATEGORIAS.map(cat => (
                <tr key={cat.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ background: cat.bg, color: cat.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{cat.label}</span>
                  </td>
                  {BLOQUES.map(b => (
                    <td key={b.id} style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>$</span>
                        <input type="number" min={0} value={valor(cat.id, b.id)} onChange={e => setValor(cat.id, b.id, e.target.value)}
                          placeholder="0" style={{ width: 110, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14, outline: 'none', color: '#1e293b' }} />
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>/h</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 10 }}>Ejemplo: si A · 1-4 = $500/h, un curso categoría A de 8 h para 3 personas costará $4,000 (500 × 8).</p>
        </div>
      )}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const lblSm = { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
