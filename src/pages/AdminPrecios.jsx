import { useEffect, useState } from 'react'
import { supabase, getCursos } from '../lib/supabase'

// Categorías y bloques del nuevo motor de precios (Paso 2)
const CATEGORIAS = [
  { id: 'A', label: 'A — Especializado', color: '#8B1A1A', bg: '#f9f0f0' },
  { id: 'B', label: 'B — Regular', color: '#1d4ed8', bg: '#eff6ff' },
  { id: 'C', label: 'C — Común', color: '#059669', bg: '#f0fdf4' },
]
const BLOQUES = [
  { id: '1-5', label: '1 a 5 personas' },
  { id: '6-10', label: '6 a 10 personas' },
  { id: '11-15', label: '11 a 15 personas' },
]
const DURACIONES = [
  { id: '1', label: '1 día', sub: '8 h o menos' },
  { id: '2', label: '2 días', sub: 'más de 8 y hasta 16 h' },
  { id: '3', label: '3 días', sub: 'más de 16 y hasta 24 h' },
  { id: '4', label: '4+ días', sub: 'más de 24 h' },
]
const CAT_COLOR = {
  A: { bg: '#f9f0f0', fg: '#8B1A1A' },
  B: { bg: '#eff6ff', fg: '#1d4ed8' },
  C: { bg: '#f0fdf4', fg: '#059669' },
}

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

  async function toggleVisible(curso) {
    await supabase.from('cursos').update({ es_publico: !(curso.es_publico !== false) }).eq('id', curso.id)
    await cargar()
  }

  const cursosFiltrados = cursos.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  if (loading) return <div style={{ color: '#64748b', padding: 40 }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Precios y catálogo público</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Los precios salen de la matriz por hora (categoría × bloque × duración). Aquí solo defines la categoría del curso y su visibilidad en el cotizador.</p>
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
              {['Clave', 'Curso', 'Familia', 'Categoría', 'En cotizador'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cursosFiltrados.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay cursos. Créalos primero en la sección Cursos.</td></tr>
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
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: (CAT_COLOR[c.categoria] || CAT_COLOR.B).bg, color: (CAT_COLOR[c.categoria] || CAT_COLOR.B).fg, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>Cat. {c.categoria || 'B'}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => toggleVisible(c)}
                      style={{ cursor: 'pointer', border: 'none', background: c.es_publico !== false ? '#f0fdf4' : '#f1f5f9', color: c.es_publico !== false ? '#059669' : '#94a3b8', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {c.es_publico !== false ? '✓ Visible' : 'Oculto'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}


function MatrizPreciosHora() {
  const [rows, setRows] = useState([])
  const [tier, setTier] = useState('1')
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

  function valor(cat, bloque, t) {
    const r = rows.find(x => x.categoria === cat && x.bloque === bloque && (x.duracion_tier || '1') === t)
    return r ? r.precio_hora : ''
  }
  function setValor(cat, bloque, t, v) {
    setRows(prev => {
      const existe = prev.some(x => x.categoria === cat && x.bloque === bloque && (x.duracion_tier || '1') === t)
      if (existe) return prev.map(r => (r.categoria === cat && r.bloque === bloque && (r.duracion_tier || '1') === t ? { ...r, precio_hora: v } : r))
      return [...prev, { categoria: cat, bloque, duracion_tier: t, precio_hora: v }]
    })
  }

  async function guardar() {
    setSaving(true)
    try {
      // Actualiza por id las filas existentes; inserta las que falten
      for (const cat of CATEGORIAS) for (const b of BLOQUES) for (const d of DURACIONES) {
        const r = rows.find(x => x.categoria === cat.id && x.bloque === b.id && (x.duracion_tier || '1') === d.id)
        const precio = Number(valor(cat.id, b.id, d.id)) || 0
        if (r && r.id) {
          await supabase.from('precios_categoria').update({ precio_hora: precio }).eq('id', r.id)
        } else {
          await supabase.from('precios_categoria').insert({ categoria: cat.id, bloque: b.id, duracion_tier: d.id, precio_hora: precio })
        }
      }
      await cargar()
      setOk(true); setTimeout(() => setOk(false), 3000)
    } catch (e) {
      alert('No se pudo guardar la matriz: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  const durActiva = DURACIONES.find(d => d.id === tier)

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Precio por hora (categoría × bloque × duración)</h2>
          <p style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>El cotizador calcula: <strong>precio por hora × horas del curso</strong>. 16 o más personas → cotización especial.</p>
        </div>
        <button onClick={guardar} disabled={saving || loading} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar matriz'}</button>
      </div>

      {/* Pestañas de duración */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {DURACIONES.map(d => (
          <button key={d.id} onClick={() => setTier(d.id)}
            style={{ padding: '8px 14px', borderRadius: 10, border: `2px solid ${tier === d.id ? '#8B1A1A' : '#e2e8f0'}`, background: tier === d.id ? '#f9f0f0' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: tier === d.id ? '#8B1A1A' : '#475569' }}>{d.label}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{d.sub}</div>
          </button>
        ))}
      </div>

      {ok && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', margin: '8px 0', color: '#15803d', fontSize: 13 }}>✅ Matriz guardada. El cotizador ya la usa.</div>}

      {loading ? (
        <div style={{ color: '#94a3b8', padding: 20 }}>Cargando matriz...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Mostrando precios por hora para cursos de <strong>{durActiva?.label}</strong> ({durActiva?.sub})</div>
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
                        <input type="number" min={0} value={valor(cat.id, b.id, tier)} onChange={e => setValor(cat.id, b.id, tier, e.target.value)}
                          placeholder="0" style={{ width: 110, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14, outline: 'none', color: '#1e293b' }} />
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>/h</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 10 }}>Ejemplo: si A · 1-4 (duración {durActiva?.label}) = $500/h, un curso categoría A de esa duración con 8 h para 3 personas costará $4,000 (500 × 8). El botón "Guardar matriz" guarda las 4 duraciones.</p>
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
