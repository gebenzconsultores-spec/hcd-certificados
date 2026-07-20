import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ESTADO_ENVIO = {
  enviado: { l: 'Enviado', bg: '#eff6ff', c: '#1d4ed8' },
  visto: { l: 'Visto', bg: '#f1f5f9', c: '#475569' },
  interesado: { l: 'Interesado', bg: '#f0fdf4', c: '#059669' },
  contratado: { l: 'Contratado', bg: '#ecfdf5', c: '#047857' },
  descartado: { l: 'Descartado', bg: '#fef2f2', c: '#dc2626' },
}

export default function AdminCandidatos() {
  const [tab, setTab] = useState('pool')
  const [candidatos, setCandidatos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [vacantes, setVacantes] = useState([])
  const [envios, setEnvios] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalCand, setModalCand] = useState(null)     // {} nuevo | candidato editar
  const [modalEnviar, setModalEnviar] = useState(null) // { candidato, vacantePre?, empresaPre? }
  const [modalPromover, setModalPromover] = useState(null)
  const [busca, setBusca] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [cand, emp, vac, env, part] = await Promise.all([
      supabase.from('candidatos').select('*').order('created_at', { ascending: false }),
      supabase.from('empresas').select('id, nombre').order('nombre'),
      supabase.from('vacantes').select('*').order('created_at', { ascending: false }),
      supabase.from('candidato_envios').select('*'),
      supabase.from('participantes').select('id, nombre, correo, empresa_id, registrado_por_empresa, disponible_oportunidades, tipo'),
    ])
    setCandidatos(cand.data || [])
    setEmpresas(emp.data || [])
    setVacantes(vac.data || [])
    setEnvios(env.data || [])
    setEmpleados(part.data || [])
    setLoading(false)
  }

  const empresaNombre = id => empresas.find(e => e.id === id)?.nombre || '—'
  const promovidoIds = new Set(candidatos.filter(c => c.participante_id).map(c => c.participante_id))
  const enviosDe = cid => envios.filter(e => e.candidato_id === cid)

  async function eliminarCandidato(c) {
    if (!window.confirm(`¿Eliminar a "${c.nombre}" del pool?`)) return
    const { error } = await supabase.from('candidatos').delete().eq('id', c.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    await cargar()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando...</div>

  // Empleados de empresa (los individuales no aplican para "promover entre empresas")
  const empleadosEmpresa = empleados.filter(e => e.empresa_id || e.registrado_por_empresa)
  const empleadosFiltrados = empleadosEmpresa.filter(e => !busca || (e.nombre || '').toLowerCase().includes(busca.toLowerCase()))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Candidatos y bolsa de talento</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Administra el pool de prospectos, promueve empleados (con consentimiento) y envíalos a las empresas.</p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {[
          { id: 'pool', label: `🧑‍💼 Pool (${candidatos.length})` },
          { id: 'promover', label: '⬆️ Promover empleados' },
          { id: 'vacantes', label: `👔 Vacantes (${vacantes.filter(v => v.estatus === 'abierta').length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#8B1A1A' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#8B1A1A' : '#64748b', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── POOL ─── */}
      {tab === 'pool' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setModalCand({})} style={btnPrimary}>+ Nuevo candidato</button>
          </div>
          {candidatos.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              Pool vacío. Agrega candidatos (de ferias, Facebook, etc.) o promueve empleados.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {candidatos.map(c => {
                const envs = enviosDe(c.id)
                return (
                  <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{c.nombre}</h3>
                          <span style={{ background: c.origen === 'empleado_promovido' ? '#f5f3ff' : '#f1f5f9', color: c.origen === 'empleado_promovido' ? '#7c3aed' : '#64748b', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                            {c.origen === 'empleado_promovido' ? '⬆️ Promovido' : 'Externo'}
                          </span>
                        </div>
                        {c.perfil && <p style={{ color: '#475569', fontSize: 13, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{c.perfil}</p>}
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
                          {c.correo && <span>✉️ {c.correo}</span>}
                          {c.telefono && <span>📞 {c.telefono}</span>}
                          {c.cv_url && <a href={c.cv_url} target="_blank" style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>📎 CV</a>}
                        </div>
                        {envs.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                            {envs.map(en => {
                              const ei = ESTADO_ENVIO[en.estado] || ESTADO_ENVIO.enviado
                              return <span key={en.id} style={{ background: ei.bg, color: ei.c, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{empresaNombre(en.empresa_id)}: {ei.l}</span>
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <button onClick={() => setModalEnviar({ candidato: c })} style={{ ...btnPrimary, fontSize: 12, padding: '7px 14px' }}>📨 Enviar a empresa</button>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setModalCand(c)} style={iconBtn}>✏️</button>
                          <button onClick={() => eliminarCandidato(c)} style={{ ...iconBtn, color: '#dc2626', borderColor: '#fecaca' }}>🗑</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── PROMOVER EMPLEADOS ─── */}
      {tab === 'promover' && (
        <div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
            🔒 Solo promueve empleados que hayan dado su consentimiento. Al promover, se te pedirá confirmarlo y no se revela su empleador actual a otras empresas.
          </div>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar empleado por nombre…" style={{ ...inp, maxWidth: 360, marginBottom: 16 }} />
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Empleado', 'Empresa actual', 'Consentimiento', 'Acción'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleadosFiltrados.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Sin empleados.</td></tr>
                )}
                {empleadosFiltrados.map(e => {
                  const yaPool = promovidoIds.has(e.id)
                  return (
                    <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 16px', color: '#1e293b', fontSize: 13, fontWeight: 600 }}>{e.nombre}</td>
                      <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{empresaNombre(e.empresa_id || e.registrado_por_empresa)}</td>
                      <td style={{ padding: '11px 16px' }}>
                        {e.disponible_oportunidades
                          ? <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>✅ Otorgado</span>
                          : <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Pendiente</span>}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        {yaPool
                          ? <span style={{ color: '#7c3aed', fontSize: 12, fontWeight: 700 }}>Ya en el pool</span>
                          : <button onClick={() => setModalPromover(e)} style={{ ...btnPrimary, fontSize: 12, padding: '6px 12px' }}>Promover</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── VACANTES ─── */}
      {tab === 'vacantes' && (
        <div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Vacantes publicadas por las empresas. Envía candidatos alineados directamente a cada una.</p>
          {vacantes.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Ninguna empresa ha publicado vacantes todavía.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {vacantes.map(v => (
                <div key={v.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', opacity: v.estatus === 'cerrada' ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{v.titulo}</h3>
                        <span style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{empresaNombre(v.empresa_id)}</span>
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>{v.estatus}</span>
                      </div>
                      {v.ubicacion && <div style={{ color: '#64748b', fontSize: 12 }}>📍 {v.ubicacion}</div>}
                      {v.descripcion && <p style={{ color: '#475569', fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{v.descripcion}</p>}
                      {v.requisitos && <p style={{ color: '#64748b', fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap' }}><strong>Requisitos:</strong> {v.requisitos}</p>}
                    </div>
                    {v.estatus !== 'cerrada' && (
                      <button onClick={() => setModalEnviar({ candidato: null, empresaPre: v.empresa_id, vacantePre: v.id })} style={{ ...btnPrimary, fontSize: 12, padding: '7px 14px', whiteSpace: 'nowrap' }}>📨 Enviar candidato</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modalCand && <ModalCandidato editando={modalCand.id ? modalCand : null} onClose={() => setModalCand(null)} onDone={() => { setModalCand(null); cargar() }} />}
      {modalEnviar && <ModalEnviar candidatoPre={modalEnviar.candidato} empresaPre={modalEnviar.empresaPre} vacantePre={modalEnviar.vacantePre} candidatos={candidatos} empresas={empresas} vacantes={vacantes} onClose={() => setModalEnviar(null)} onDone={() => { setModalEnviar(null); cargar() }} />}
      {modalPromover && <ModalPromover empleado={modalPromover} empresaNombre={empresaNombre} onClose={() => setModalPromover(null)} onDone={() => { setModalPromover(null); cargar() }} />}
    </div>
  )
}

// ─── Modal: alta/edición manual de candidato ──────────────────
function ModalCandidato({ editando, onClose, onDone }) {
  const [f, setF] = useState({
    nombre: editando?.nombre || '', correo: editando?.correo || '', telefono: editando?.telefono || '',
    perfil: editando?.perfil || '', habilidades: editando?.habilidades || '', experiencia: editando?.experiencia || '',
    cv_url: editando?.cv_url || '', estatus: editando?.estatus || 'disponible'
  })
  const [saving, setSaving] = useState(false)
  const set = k => v => setF(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!f.nombre.trim()) { alert('Escribe el nombre'); return }
    setSaving(true)
    try {
      const payload = { ...f, nombre: f.nombre.trim() }
      if (editando) {
        const { error } = await supabase.from('candidatos').update(payload).eq('id', editando.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('candidatos').insert({ ...payload, origen: 'externo' })
        if (error) throw error
      }
      onDone()
    } catch (e) { alert('Error: ' + (e.message || '')) } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{editando ? 'Editar candidato' : 'Nuevo candidato'}</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Nombre *</label><input value={f.nombre} onChange={e => set('nombre')(e.target.value)} style={inp} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Teléfono</label><input value={f.telefono} onChange={e => set('telefono')(e.target.value)} style={inp} /></div>
        </div>
        <label style={lbl}>Correo</label><input value={f.correo} onChange={e => set('correo')(e.target.value)} style={inp} />
        <label style={lbl}>Perfil / resumen</label><textarea value={f.perfil} onChange={e => set('perfil')(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
        <label style={lbl}>Habilidades</label><textarea value={f.habilidades} onChange={e => set('habilidades')(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
        <label style={lbl}>Experiencia</label><textarea value={f.experiencia} onChange={e => set('experiencia')(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
        <label style={lbl}>Link del CV (opcional)</label><input value={f.cv_url} onChange={e => set('cv_url')(e.target.value)} placeholder="https://…" style={inp} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving || !f.nombre.trim()} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: enviar candidato a una empresa ────────────────────
function ModalEnviar({ candidatoPre, empresaPre, vacantePre, candidatos, empresas, vacantes, onClose, onDone }) {
  const [candidatoId, setCandidatoId] = useState(candidatoPre?.id || '')
  const [empresaId, setEmpresaId] = useState(empresaPre || '')
  const [vacanteId, setVacanteId] = useState(vacantePre || '')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const vacantesEmpresa = vacantes.filter(v => v.empresa_id === empresaId && v.estatus !== 'cerrada')

  async function enviar() {
    if (!candidatoId) { alert('Elige el candidato'); return }
    if (!empresaId) { alert('Elige la empresa'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('candidato_envios').insert({
        candidato_id: candidatoId, empresa_id: empresaId, vacante_id: vacanteId || null, estado: 'enviado', notas: notas.trim() || null
      })
      if (error) throw error
      const cand = candidatos.find(c => c.id === candidatoId)
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'candidato', titulo: 'Candidato enviado',
          mensaje: `Se envió a ${cand?.nombre || 'un candidato'} a ${empresas.find(e => e.id === empresaId)?.nombre || 'una empresa'}`,
          link: '/admin/candidatos'
        })
      } catch (_) {}
      onDone()
    } catch (e) { alert('Error: ' + (e.message || '')) } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>Enviar candidato a empresa</h3>
        <label style={lbl}>Candidato *</label>
        <select value={candidatoId} onChange={e => setCandidatoId(e.target.value)} style={inp} disabled={!!candidatoPre}>
          <option value="">— Elige —</option>
          {candidatos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <label style={lbl}>Empresa *</label>
        <select value={empresaId} onChange={e => { setEmpresaId(e.target.value); setVacanteId('') }} style={inp}>
          <option value="">— Elige —</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <label style={lbl}>Vacante (opcional)</label>
        <select value={vacanteId} onChange={e => setVacanteId(e.target.value)} style={inp} disabled={!empresaId}>
          <option value="">— Sin vacante específica —</option>
          {vacantesEmpresa.map(v => <option key={v.id} value={v.id}>{v.titulo}</option>)}
        </select>
        <label style={lbl}>Notas (opcional)</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Por qué es un buen match…" style={{ ...inp, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={enviar} disabled={saving} style={btnPrimary}>{saving ? 'Enviando...' : 'Enviar candidato'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: promover empleado (con consentimiento) ────────────
function ModalPromover({ empleado, empresaNombre, onClose, onDone }) {
  const [perfil, setPerfil] = useState('')
  const [habilidades, setHabilidades] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [consentimiento, setConsentimiento] = useState(empleado.disponible_oportunidades || false)
  const [saving, setSaving] = useState(false)

  async function promover() {
    if (!consentimiento) { alert('Debes confirmar el consentimiento del empleado para promoverlo.'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('candidatos').insert({
        nombre: empleado.nombre, correo: empleado.correo || null,
        perfil: perfil.trim() || null, habilidades: habilidades.trim() || null, experiencia: experiencia.trim() || null,
        origen: 'empleado_promovido', participante_id: empleado.id, estatus: 'disponible'
      })
      if (error) throw error
      // Deja registrado el consentimiento en el empleado
      await supabase.from('participantes').update({ disponible_oportunidades: true }).eq('id', empleado.id)
      onDone()
    } catch (e) { alert('Error: ' + (e.message || '')) } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Promover al pool</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}><strong>{empleado.nombre}</strong> · {empresaNombre(empleado.empresa_id || empleado.registrado_por_empresa)}</p>
        <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14 }}>Su empleador actual no se muestra a otras empresas; solo su perfil profesional.</p>

        <label style={lbl}>Perfil / resumen</label><textarea value={perfil} onChange={e => setPerfil(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
        <label style={lbl}>Habilidades</label><textarea value={habilidades} onChange={e => setHabilidades(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
        <label style={lbl}>Experiencia</label><textarea value={experiencia} onChange={e => setExperiencia(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginTop: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px' }}>
          <input type="checkbox" checked={consentimiento} onChange={e => setConsentimiento(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: '#92400e' }}>Confirmo que <strong>{empleado.nombre}</strong> otorgó su consentimiento para ser considerado en nuevas oportunidades laborales.</span>
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={promover} disabled={saving || !consentimiento} style={btnPrimary}>{saving ? 'Promoviendo...' : 'Promover'}</button>
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff', boxSizing: 'border-box' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const iconBtn = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#475569' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
