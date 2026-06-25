import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminCompras() {
  const [tab, setTab] = useState('compras')
  const [compras, setCompras] = useState([])
  const [programaciones, setProgramaciones] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [cursos, setCursos] = useState([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ empresa_id: '', empresa_nombre: '', curso_id: '', curso_nombre: '', monto: '', num_personas: 1, notas: '' })
  const [saving, setSaving] = useState(false)
  const [nuevoID, setNuevoID] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: c }, { data: p }, { data: emps }, { data: curs }] = await Promise.all([
      supabase.from('compras').select('*').order('created_at', { ascending: false }),
      supabase.from('programaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('empresas').select('id, nombre').order('nombre'),
      supabase.from('cursos').select('id, nombre, numero_curso').eq('activo', true)
    ])
    setCompras(c || [])
    setProgramaciones(p || [])
    setEmpresas(emps || [])
    setCursos(curs || [])
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function generarCompra() {
    if (!form.empresa_nombre || !form.curso_nombre) return
    setSaving(true)
    try {
      const { count } = await supabase.from('compras').select('id', { count: 'exact', head: true })
      const id_compra = `COMPRA-${String((count || 0) + 1).padStart(4, '0')}`
      await supabase.from('compras').insert({
        id_compra,
        empresa_id: form.empresa_id || null,
        empresa_nombre: form.empresa_nombre,
        curso_id: form.curso_id || null,
        curso_nombre: form.curso_nombre,
        monto: form.monto ? Number(form.monto) : null,
        num_personas: Number(form.num_personas),
        notas: form.notas,
        estado: 'activo'
      })
      await cargar()
      setNuevoID(id_compra)
      setForm({ empresa_id: '', empresa_nombre: '', curso_id: '', curso_nombre: '', monto: '', num_personas: 1, notas: '' })
    } finally { setSaving(false) }
  }

  async function cambiarEstadoProg(id, estado) {
    await supabase.from('programaciones').update({ estado }).eq('id', id)
    await cargar()
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Compras y programaciones</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Genera IDs de compra y gestiona solicitudes de cursos</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
        {[
          { id: 'compras', label: `🎫 IDs de compra (${compras.length})` },
          { id: 'programaciones', label: `📅 Solicitudes de curso (${programaciones.filter(p => p.estado === 'pendiente').length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#8B1A1A' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#8B1A1A' : '#64748b', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* COMPRAS */}
      {tab === 'compras' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ color: '#64748b', fontSize: 13 }}>Genera un ID cuando una empresa confirme su pago</p>
            <button onClick={() => { setModal(true); setNuevoID(null) }} style={btnPrimary}>+ Generar ID de compra</button>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['ID Compra', 'Empresa', 'Curso', 'Monto', 'Personas', 'Estado', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compras.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin IDs de compra generados</td></tr>
                )}
                {compras.map(c => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '11px 16px' }}><code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{c.id_compra}</code></td>
                    <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{c.empresa_nombre}</td>
                    <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{c.curso_nombre}</td>
                    <td style={{ padding: '11px 16px', color: '#1e293b', fontSize: 13 }}>{c.monto ? `$${Number(c.monto).toLocaleString('es-MX')}` : '—'}</td>
                    <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{c.num_personas}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ background: c.estado === 'activo' ? '#f0fdf4' : c.estado === 'usado' ? '#f1f5f9' : '#fef2f2', color: c.estado === 'activo' ? '#059669' : c.estado === 'usado' ? '#64748b' : '#dc2626', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {c.estado === 'activo' ? '● Disponible' : c.estado === 'usado' ? 'Usado' : 'Cancelado'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: 11 }}>{new Date(c.created_at).toLocaleDateString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROGRAMACIONES */}
      {tab === 'programaciones' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                {['Empresa', 'Curso', 'Fecha solicitada', 'Modalidad', 'Personas', 'Estado', 'Acción'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {programaciones.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin solicitudes de curso</td></tr>
              )}
              {programaciones.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{p.empresa_nombre}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{p.curso_nombre}</td>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontSize: 13, fontWeight: 600 }}>{p.fecha_solicitada ? new Date(p.fecha_solicitada).toLocaleDateString('es-MX') : '—'}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 12 }}>{p.modalidad}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{p.num_personas}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: p.estado === 'confirmada' ? '#f0fdf4' : p.estado === 'rechazada' ? '#fef2f2' : p.estado === 'completada' ? '#eff6ff' : '#fef9c3', color: p.estado === 'confirmada' ? '#059669' : p.estado === 'rechazada' ? '#dc2626' : p.estado === 'completada' ? '#1d4ed8' : '#92400e', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {p.estado}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    {p.estado === 'pendiente' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => cambiarEstadoProg(p.id, 'confirmada')} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Confirmar</button>
                        <button onClick={() => cambiarEstadoProg(p.id, 'rechazada')} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Rechazar</button>
                      </div>
                    )}
                    {p.estado === 'confirmada' && (
                      <button onClick={() => cambiarEstadoProg(p.id, 'completada')} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Marcar completada</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal generar compra */}
      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            {nuevoID ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🎫</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>ID de compra generado</h3>
                <div style={{ background: '#f9f0f0', border: '2px solid #8B1A1A', borderRadius: 12, padding: '20px', margin: '16px 0' }}>
                  <div style={{ color: '#8B1A1A', fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>{nuevoID}</div>
                </div>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Compártelo con la empresa para que desbloquee la asignación del curso.</p>
                <button onClick={() => { setModal(false); setNuevoID(null) }} style={btnPrimary}>Listo</button>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Generar ID de compra</h3>
                <label style={lbl}>Empresa *</label>
                <input value={form.empresa_nombre} onChange={e => f('empresa_nombre')(e.target.value)} placeholder="Nombre de la empresa" style={inp} list="emp-list" />
                <datalist id="emp-list">{empresas.map(e => <option key={e.id} value={e.nombre} />)}</datalist>

                <label style={lbl}>Curso *</label>
                <select value={form.curso_nombre} onChange={e => f('curso_nombre')(e.target.value)} style={inp}>
                  <option value="">Selecciona un curso</option>
                  {cursos.map(c => <option key={c.id} value={c.nombre}>#{c.numero_curso} - {c.nombre}</option>)}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Monto pagado ($)</label>
                    <input type="number" value={form.monto} onChange={e => f('monto')(e.target.value)} placeholder="Opcional" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Personas</label>
                    <input type="number" min={1} value={form.num_personas} onChange={e => f('num_personas')(e.target.value)} style={inp} />
                  </div>
                </div>

                <label style={lbl}>Notas</label>
                <textarea value={form.notas} onChange={e => f('notas')(e.target.value)} rows={2} placeholder="Opcional" style={{ ...inp, resize: 'none' }} />

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
                  <button onClick={generarCompra} disabled={saving || !form.empresa_nombre || !form.curso_nombre} style={btnPrimary}>{saving ? 'Generando...' : 'Generar ID'}</button>
                </div>
              </>
            )}
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
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 460, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
