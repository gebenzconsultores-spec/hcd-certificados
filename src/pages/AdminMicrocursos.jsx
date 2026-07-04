import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminMicrocursos() {
  const [microcursos, setMicrocursos] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [tab, setTab] = useState('catalogo')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ titulo: '', descripcion: '', duracion_min: 20, link_externo: '', es_gratuito: false, activo: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: mc }, { data: sol }] = await Promise.all([
      supabase.from('microcursos').select('*').order('orden'),
      supabase.from('solicitudes_microcursos').select('*').order('created_at', { ascending: false })
    ])
    setMicrocursos(mc || [])
    setSolicitudes(sol || [])
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  function abrirNuevo() {
    setForm({ titulo: '', descripcion: '', duracion_min: 20, link_externo: '', es_gratuito: false, activo: true })
    setEditando(null)
    setModal(true)
  }

  function abrirEditar(mc) {
    setForm({ titulo: mc.titulo, descripcion: mc.descripcion || '', duracion_min: mc.duracion_min || 20, link_externo: mc.link_externo || '', es_gratuito: mc.es_gratuito, activo: mc.activo })
    setEditando(mc)
    setModal(true)
  }

  async function guardar() {
    if (!form.titulo) return
    setSaving(true)
    try {
      if (editando) {
        await supabase.from('microcursos').update(form).eq('id', editando.id)
      } else {
        await supabase.from('microcursos').insert({ ...form, orden: microcursos.length + 1 })
      }
      await cargar()
      setModal(false)
    } finally { setSaving(false) }
  }

  async function toggleActivo(mc) {
    await supabase.from('microcursos').update({ activo: !mc.activo }).eq('id', mc.id)
    await cargar()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta microcredencial?')) return
    await supabase.from('microcursos').delete().eq('id', id)
    await cargar()
  }

  async function cambiarEstadoSolicitud(id, estado) {
    await supabase.from('solicitudes_microcursos').update({ estado }).eq('id', id)
    await cargar()
  }

  async function eliminarSolicitud(id) {
    if (!window.confirm('¿Eliminar esta solicitud?')) return
    await supabase.from('solicitudes_microcursos').delete().eq('id', id)
    await cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Microcredenciales</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Cápsulas de 20 min que las empresas asignan a sus empleados</p>
        </div>
        <button onClick={abrirNuevo} style={btnPrimary}>+ Nueva microcredencial</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {[
          { id: 'catalogo', label: `📚 Catálogo (${microcursos.length})` },
          { id: 'solicitudes', label: `📩 Solicitudes (${solicitudes.filter(s => s.estado === 'pendiente').length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#8B1A1A' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#8B1A1A' : '#64748b', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CATÁLOGO */}
      {tab === 'catalogo' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {microcursos.map(mc => (
            <div key={mc.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px', opacity: mc.activo ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {mc.es_gratuito && <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>🎁 Obsequio</span>}
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{mc.duracion_min} min</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => abrirEditar(mc)} style={iconBtn}>✏️</button>
                  <button onClick={() => eliminar(mc.id)} style={{ ...iconBtn, color: '#dc2626' }}>🗑</button>
                </div>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{mc.titulo}</h3>
              {mc.descripcion && <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>{mc.descripcion}</p>}
              {mc.link_externo ? (
                <a href={mc.link_externo} target="_blank" style={{ color: '#1d4ed8', fontSize: 12, textDecoration: 'none' }}>🔗 Ver enlace</a>
              ) : (
                <span style={{ color: '#f59e0b', fontSize: 12 }}>⚠️ Sin enlace configurado</span>
              )}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={mc.activo} onChange={() => toggleActivo(mc)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: mc.activo ? '#059669' : '#94a3b8', fontWeight: 600 }}>{mc.activo ? 'Activo' : 'Inactivo'}</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SOLICITUDES */}
      {tab === 'solicitudes' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                {['Empresa', 'Microcredencial', 'Empleados asignados', 'Sesión Zoom', 'Estado', 'Fecha', 'Acción'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {solicitudes.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin solicitudes</td></tr>
              )}
              {solicitudes.map(s => (
                <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{s.empresa_nombre}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{s.microcurso_titulo}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 12, maxWidth: 240 }}>
                    {s.empleados_nombres ? (
                      <div>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{s.num_empleados}</span>
                        <div style={{ marginTop: 4, color: '#475569', fontSize: 12, lineHeight: 1.4 }}>{s.empleados_nombres}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>{s.num_empleados} empleado{s.num_empleados !== 1 ? 's' : ''}</span>
                    )}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 12 }}>
                    {s.fecha_sesion ? (
                      <span style={{ color: '#1d4ed8', fontWeight: 600 }}>📅 {new Date(s.fecha_sesion).toLocaleDateString('es-MX')}{s.hora_sesion ? ` · ${s.hora_sesion}` : ''}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: s.estado === 'aprobada' ? '#f0fdf4' : s.estado === 'rechazada' ? '#fef2f2' : '#fef9c3', color: s.estado === 'aprobada' ? '#059669' : s.estado === 'rechazada' ? '#dc2626' : '#92400e', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {s.estado}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: 11 }}>{new Date(s.created_at).toLocaleDateString('es-MX')}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {s.estado === 'pendiente' && (
                        <>
                          <button onClick={() => cambiarEstadoSolicitud(s.id, 'aprobada')} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Aprobar</button>
                          <button onClick={() => cambiarEstadoSolicitud(s.id, 'rechazada')} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Rechazar</button>
                        </>
                      )}
                      <button onClick={() => eliminarSolicitud(s.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{editando ? 'Editar' : 'Nueva'} microcredencial</h3>
            <label style={lbl}>Título *</label>
            <input value={form.titulo} onChange={e => f('titulo')(e.target.value)} placeholder="ej. Principios de Calidad" style={inp} />
            <label style={lbl}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => f('descripcion')(e.target.value)} rows={2} placeholder="Breve descripción de la microcredencial" style={{ ...inp, resize: 'none' }} />
            <label style={lbl}>Duración (minutos)</label>
            <input type="number" value={form.duracion_min} onChange={e => f('duracion_min')(Number(e.target.value))} style={inp} />
            <label style={lbl}>Link del microcampus (donde está el curso)</label>
            <input value={form.link_externo} onChange={e => f('link_externo')(e.target.value)} placeholder="https://tumicrocampus.com/curso" style={inp} />
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Aquí pegarás el link cuando tengas listo tu microcampus</p>
            <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.es_gratuito} onChange={e => f('es_gratuito')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: '#374151' }}>De obsequio</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.activo} onChange={e => f('activo')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: '#374151' }}>Activo</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.titulo} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
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
const iconBtn = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, color: '#475569' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
