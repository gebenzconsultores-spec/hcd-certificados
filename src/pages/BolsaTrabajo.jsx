import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const JORNADAS = [
  ['tiempo_completo', 'Tiempo completo'],
  ['medio_tiempo', 'Medio tiempo'],
  ['por_proyecto', 'Por proyecto'],
  ['practicas', 'Prácticas'],
]
const ESTATUS = { abierta: { l: 'Abierta', bg: '#f0fdf4', c: '#059669' }, pausada: { l: 'Pausada', bg: '#fef9c3', c: '#92400e' }, cerrada: { l: 'Cerrada', bg: '#f1f5f9', c: '#64748b' } }

// Bolsa de trabajo: la empresa publica y administra sus vacantes.
export default function BolsaTrabajo({ empresa }) {
  const [vacantes, setVacantes] = useState([])
  const [puestos, setPuestos] = useState([])
  const [requisitos, setRequisitos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // {} nueva | vacante editar

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data: vac } = await supabase.from('vacantes').select('*').eq('empresa_id', empresa.id).order('created_at', { ascending: false })
    const { data: pts } = await supabase.from('puestos').select('id, nombre, descripcion').eq('empresa_id', empresa.id).order('nombre')
    let reqs = []
    if ((pts || []).length > 0) {
      const { data: rq } = await supabase.from('puesto_requisitos').select('puesto_id, descripcion, tipo').in('puesto_id', pts.map(p => p.id))
      reqs = rq || []
    }
    setVacantes(vac || [])
    setPuestos(pts || [])
    setRequisitos(reqs)
    setLoading(false)
  }

  async function eliminar(v) {
    if (!window.confirm(`¿Eliminar la vacante "${v.titulo}"?`)) return
    const { error } = await supabase.from('vacantes').delete().eq('id', v.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    await cargar()
  }
  async function cambiarEstatus(v, estatus) {
    const { error } = await supabase.from('vacantes').update({ estatus }).eq('id', v.id)
    if (error) { alert('No se pudo actualizar: ' + error.message); return }
    await cargar()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando bolsa de trabajo...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <p style={{ color: '#64748b', fontSize: 14, maxWidth: 620 }}>
          Publica tus vacantes. Puedes partir de un puesto de tu organigrama para prellenar la descripción y los requisitos.
          Con base en ellas te enviaremos candidatos alineados en tu <strong>Pool de candidatos</strong>.
        </p>
        <button onClick={() => setModal({})} style={btnPrimary}>+ Nueva vacante</button>
      </div>

      {vacantes.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          Aún no has publicado vacantes. Empieza con "+ Nueva vacante".
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {vacantes.map(v => {
            const est = ESTATUS[v.estatus] || ESTATUS.abierta
            return (
              <div key={v.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>{v.titulo}</h3>
                      <span style={{ background: est.bg, color: est.c, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{est.l}</span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {v.ubicacion && <span>📍 {v.ubicacion}</span>}
                      {v.tipo_jornada && <span>🕐 {(JORNADAS.find(j => j[0] === v.tipo_jornada) || [])[1]}</span>}
                    </div>
                    {v.descripcion && <p style={{ color: '#475569', fontSize: 13, marginTop: 8, whiteSpace: 'pre-wrap' }}>{v.descripcion}</p>}
                    {v.requisitos && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Requisitos</div>
                        <p style={{ color: '#64748b', fontSize: 13, whiteSpace: 'pre-wrap' }}>{v.requisitos}</p>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModal(v)} style={iconBtn}>✏️ Editar</button>
                      <button onClick={() => eliminar(v)} style={{ ...iconBtn, color: '#dc2626', borderColor: '#fecaca' }}>🗑</button>
                    </div>
                    <select value={v.estatus} onChange={e => cambiarEstatus(v, e.target.value)} style={{ ...inp, padding: '5px 8px', fontSize: 12, width: 'auto' }}>
                      <option value="abierta">Abierta</option>
                      <option value="pausada">Pausada</option>
                      <option value="cerrada">Cerrada</option>
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <ModalVacante empresa={empresa} puestos={puestos} requisitos={requisitos} editando={modal.id ? modal : null}
          onClose={() => setModal(null)} onDone={() => { setModal(null); cargar() }} />
      )}
    </div>
  )
}

function ModalVacante({ empresa, puestos, requisitos, editando, onClose, onDone }) {
  const [titulo, setTitulo] = useState(editando?.titulo || '')
  const [puestoId, setPuestoId] = useState(editando?.puesto_id || '')
  const [descripcion, setDescripcion] = useState(editando?.descripcion || '')
  const [reqs, setReqs] = useState(editando?.requisitos || '')
  const [ubicacion, setUbicacion] = useState(editando?.ubicacion || '')
  const [jornada, setJornada] = useState(editando?.tipo_jornada || 'tiempo_completo')
  const [saving, setSaving] = useState(false)

  // Al elegir un puesto del organigrama, prellenar descripción y requisitos
  function elegirPuesto(pid) {
    setPuestoId(pid)
    if (!pid) return
    const p = puestos.find(x => x.id === pid)
    if (p && !descripcion.trim()) setDescripcion(p.descripcion || '')
    const rq = requisitos.filter(r => r.puesto_id === pid).map(r => `• ${r.descripcion}`).join('\n')
    if (rq && !reqs.trim()) setReqs(rq)
    if (!titulo.trim() && p) setTitulo(p.nombre)
  }

  async function guardar() {
    if (!titulo.trim()) { alert('Escribe el título de la vacante'); return }
    setSaving(true)
    try {
      const payload = {
        empresa_id: empresa.id, puesto_id: puestoId || null, titulo: titulo.trim(),
        descripcion: descripcion.trim() || null, requisitos: reqs.trim() || null,
        ubicacion: ubicacion.trim() || null, tipo_jornada: jornada
      }
      if (editando) {
        const { error } = await supabase.from('vacantes').update(payload).eq('id', editando.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('vacantes').insert({ ...payload, estatus: 'abierta' })
        if (error) throw error
      }
      onDone()
    } catch (e) {
      alert('Error al guardar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{editando ? 'Editar vacante' : 'Nueva vacante'}</h3>

        {puestos.length > 0 && (
          <>
            <label style={lbl}>Partir de un puesto de tu organigrama (opcional)</label>
            <select value={puestoId} onChange={e => elegirPuesto(e.target.value)} style={inp}>
              <option value="">— No usar puesto —</option>
              {puestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Prellena título, descripción y requisitos con lo que ya definiste en Rutas de capacitación.</p>
          </>
        )}

        <label style={lbl}>Título de la vacante *</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="ej. Supervisor de Producción" style={inp} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Ubicación</label>
            <input value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="ej. Puebla, presencial" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Jornada</label>
            <select value={jornada} onChange={e => setJornada(e.target.value)} style={inp}>
              {JORNADAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <label style={lbl}>Descripción del puesto</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={4} placeholder="Responsabilidades, objetivos, a quién reporta…" style={{ ...inp, resize: 'vertical' }} />

        <label style={lbl}>Requisitos / conocimientos</label>
        <textarea value={reqs} onChange={e => setReqs(e.target.value)} rows={4} placeholder="Escolaridad, experiencia, certificaciones, habilidades…" style={{ ...inp, resize: 'vertical' }} />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving || !titulo.trim()} style={btnPrimary}>{saving ? 'Guardando...' : 'Publicar vacante'}</button>
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff', boxSizing: 'border-box' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const iconBtn = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: '#475569', fontWeight: 600 }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 540, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
