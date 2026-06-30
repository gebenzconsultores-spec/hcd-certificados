import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminProximosCursos() {
  const [proximos, setProximos] = useState([])
  const [cursos, setCursos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [modal, setModal] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [modalInscribir, setModalInscribir] = useState(null)
  const [participantes, setParticipantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    curso_id: '', curso_nombre: '', temario: '', fecha: '', hora: '10:00',
    tipo_costo: 'sin_costo', precio: 0, cupo_maximo: 10, link_zoom: '', notas: '', codigo_promo: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargar()
    supabase.from('participantes').select('id, nombre, id_empleado, correo, empresa_id, registrado_por_empresa, tipo').then(({ data }) => setParticipantes(data || []))
  }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: prox }, { data: curs }, { data: insc }] = await Promise.all([
      supabase.from('proximos_cursos').select('*').order('fecha', { ascending: true }),
      supabase.from('cursos').select('id, nombre, temario, duracion').eq('activo', true),
      supabase.from('inscripciones').select('*').order('created_at', { ascending: false })
    ])
    setProximos(prox || [])
    setCursos(curs || [])
    setInscripciones(insc || [])
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  function seleccionarCurso(cursoId) {
    const curso = cursos.find(c => c.id === cursoId)
    setForm(p => ({
      ...p, curso_id: cursoId,
      curso_nombre: curso?.nombre || '',
      temario: curso?.temario || ''
    }))
  }

  function abrirNuevo() {
    setForm({ curso_id: '', curso_nombre: '', temario: '', fecha: '', hora: '10:00', tipo_costo: 'sin_costo', precio: 0, cupo_maximo: 10, link_zoom: '', notas: '', codigo_promo: '' })
    setModal(true)
  }

  // Al cambiar tipo costo, ajustar cupo default (gratis=10, costo=20)
  function cambiarTipoCosto(tipo) {
    setForm(p => ({ ...p, tipo_costo: tipo, cupo_maximo: tipo === 'sin_costo' ? 10 : 20 }))
  }

  // Genera el número de certificado: empieza en 499, siempre máximo + 1 (nunca se reutiliza)
  async function generarNumeroCertificado() {
    const { data } = await supabase.from('proximos_cursos').select('numero_certificado').not('numero_certificado', 'is', null)
    let max = 498 // para que el primero sea 499
    ;(data || []).forEach(c => {
      if (c.numero_certificado && c.numero_certificado > max) max = c.numero_certificado
    })
    return max + 1
  }

  async function guardar() {
    if (!form.curso_nombre || !form.fecha) return
    setSaving(true)
    try {
      // Generar número de certificado consecutivo (empieza en 499, nunca se reutiliza)
      const numeroCert = await generarNumeroCertificado()
      await supabase.from('proximos_cursos').insert({
        curso_id: form.curso_id || null,
        curso_nombre: form.curso_nombre,
        temario: form.temario,
        fecha: form.fecha,
        hora: form.hora,
        modalidad: 'zoom',
        numero_certificado: numeroCert,
        tipo_costo: form.tipo_costo,
        precio: form.tipo_costo === 'con_costo' ? Number(form.precio) : 0,
        codigo_promo: form.codigo_promo || null,
        cupo_maximo: Number(form.cupo_maximo),
        cupo_ocupado: 0,
        link_zoom: form.link_zoom,
        notas: form.notas,
        estado: 'abierto'
      })
      await cargar()
      setModal(false)
    } finally { setSaving(false) }
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('proximos_cursos').update({ estado }).eq('id', id)
    await cargar()
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este próximo curso? Se borrarán también sus inscripciones.')) return
    await supabase.from('proximos_cursos').delete().eq('id', id)
    await cargar()
  }

  async function verInscritos(prox) {
    const inscritos = inscripciones.filter(i => i.proximo_curso_id === prox.id)
    setDetalle({ ...prox, inscritos })
  }

  function fmtFecha(f) {
    return new Date(f + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Próximos cursos</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Programa cursos por Zoom; empresas e individuales se inscriben</p>
        </div>
        <button onClick={abrirNuevo} style={btnPrimary}>+ Programar curso</button>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : proximos.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          No hay cursos programados. Crea el primero con "Programar curso".
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
          {proximos.map(p => {
            const lleno = p.cupo_ocupado >= p.cupo_maximo
            const numInscritos = inscripciones.filter(i => i.proximo_curso_id === p.id).length
            return (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px', borderTop: `4px solid ${p.tipo_costo === 'sin_costo' ? '#059669' : '#8B1A1A'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ background: p.tipo_costo === 'sin_costo' ? '#f0fdf4' : '#f9f0f0', color: p.tipo_costo === 'sin_costo' ? '#059669' : '#8B1A1A', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {p.tipo_costo === 'sin_costo' ? '🎁 Gratis' : `$${Number(p.precio).toLocaleString('es-MX')}`}
                    </span>
                    <span style={{ background: p.estado === 'abierto' ? '#eff6ff' : '#f1f5f9', color: p.estado === 'abierto' ? '#1d4ed8' : '#64748b', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {p.estado}
                    </span>
                  </div>
                  <button onClick={() => eliminar(p.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {p.numero_certificado && <span style={{ background: '#8B1A1A', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>Curso N° {p.numero_certificado}</span>}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>{p.curso_nombre}</h3>
                <div style={{ color: '#475569', fontSize: 13, marginBottom: 4 }}>📅 {fmtFecha(p.fecha)}</div>
                <div style={{ color: '#475569', fontSize: 13, marginBottom: 12 }}>🕐 {p.hora} · 🎥 Zoom</div>

                {/* Barra de cupo */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#64748b' }}>Cupo</span>
                    <span style={{ color: lleno ? '#dc2626' : '#059669', fontWeight: 700 }}>{numInscritos} / {p.cupo_maximo}</span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (numInscritos / p.cupo_maximo) * 100)}%`, height: '100%', background: lleno ? '#dc2626' : '#059669', borderRadius: 20 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setModalInscribir(p)} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 1 }}>➕ Inscribir participantes</button>
                  <button onClick={() => verInscritos(p)} style={{ ...btnSecondary, flex: 1 }}>Ver inscritos ({numInscritos})</button>
                  {p.estado === 'abierto' ? (
                    <button onClick={() => cambiarEstado(p.id, 'cerrado')} style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>Cerrar</button>
                  ) : (
                    <button onClick={() => cambiarEstado(p.id, 'abierto')} style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>Abrir</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo próximo curso */}
      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={{ ...modalStyle, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Programar próximo curso</h3>

            <label style={lbl}>Curso del catálogo</label>
            <select value={form.curso_id} onChange={e => seleccionarCurso(e.target.value)} style={inp}>
              <option value="">— Selecciona un curso —</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>

            <label style={lbl}>Nombre del curso (editable)</label>
            <input value={form.curso_nombre} onChange={e => f('curso_nombre')(e.target.value)} placeholder="Nombre del curso" style={inp} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Fecha *</label>
                <input type="date" value={form.fecha} onChange={e => f('fecha')(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Hora</label>
                <input type="time" value={form.hora} onChange={e => f('hora')(e.target.value)} style={inp} />
              </div>
            </div>

            <label style={lbl}>Tipo</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              {[['sin_costo', '🎁 Sin costo', 'Máx. 10'], ['con_costo', '💰 Con costo', 'Máx. 20']].map(([v, l, d]) => (
                <button key={v} onClick={() => cambiarTipoCosto(v)}
                  style={{ flex: 1, padding: '10px', border: `2px solid ${form.tipo_costo === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 8, background: form.tipo_costo === v ? '#f9f0f0' : '#fff', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.tipo_costo === v ? '#8B1A1A' : '#475569' }}>{l}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{d}</div>
                </button>
              ))}
            </div>

            {form.tipo_costo === 'con_costo' && (
              <>
                <label style={lbl}>Precio por persona ($)</label>
                <input type="number" value={form.precio} onChange={e => f('precio')(e.target.value)} placeholder="Tú defines el precio" style={inp} />
              </>
            )}

            <label style={lbl}>Cupo máximo</label>
            <input type="number" value={form.cupo_maximo} onChange={e => f('cupo_maximo')(e.target.value)} style={inp} />

            <label style={lbl}>Link de Zoom (opcional)</label>
            <input value={form.link_zoom} onChange={e => f('link_zoom')(e.target.value)} placeholder="https://zoom.us/j/..." style={inp} />

            <label style={lbl}>Código promocional (opcional, ej. 2x1)</label>
            <input value={form.codigo_promo} onChange={e => f('codigo_promo')(e.target.value.toUpperCase())} placeholder="ej. 2X1JULIO o PROMO50" style={inp} />
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, marginBottom: 8 }}>Se mostrará en la convocatoria que ven empresas y estudiantes.</p>

            <label style={lbl}>Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => f('notas')(e.target.value)} rows={2} style={{ ...inp, resize: 'none' }} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.curso_nombre || !form.fecha} style={btnPrimary}>{saving ? 'Guardando...' : 'Programar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ver inscritos */}
      {detalle && (
        <div style={overlay} onClick={() => setDetalle(null)}>
          <div style={{ ...modalStyle, width: 560, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{detalle.curso_nombre}</h3>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{fmtFecha(detalle.fecha)} · {detalle.hora}</p>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ color: '#64748b', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>INSCRITOS ({detalle.inscritos.length} / {detalle.cupo_maximo})</div>
            {detalle.inscritos.length === 0 ? (
              <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin inscritos aún</div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {detalle.inscritos.map(ins => (
                  <div key={ins.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{ins.participante_nombre}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>
                        {ins.origen === 'empresa' ? `🏢 ${ins.empresa_nombre}` : '👤 Individual'} · {ins.participante_correo}
                      </div>
                    </div>
                    <span style={{ background: ins.estado === 'completado' ? '#f0fdf4' : '#eff6ff', color: ins.estado === 'completado' ? '#059669' : '#1d4ed8', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {ins.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {detalle.link_zoom && (
              <div style={{ marginTop: 16, background: '#eff6ff', borderRadius: 8, padding: '12px 14px' }}>
                <span style={{ color: '#64748b', fontSize: 12 }}>Link Zoom: </span>
                <a href={detalle.link_zoom} target="_blank" style={{ color: '#1d4ed8', fontSize: 12 }}>{detalle.link_zoom}</a>
              </div>
            )}
          </div>
        </div>
      )}

      {modalInscribir && (
        <ModalInscribirParticipantes
          convocatoria={modalInscribir}
          participantes={participantes}
          onClose={() => setModalInscribir(null)}
          onDone={() => { setModalInscribir(null); cargar() }}
        />
      )}
    </div>
  )
}

// ─── Modal: inscribir participantes a una convocatoria ────────
function ModalInscribirParticipantes({ convocatoria, participantes, onClose, onDone }) {
  const [seleccionados, setSeleccionados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [saving, setSaving] = useState(false)

  const cupoDisponible = (convocatoria.cupo_maximo || 10) - (convocatoria.cupo_ocupado || 0)

  const filtrados = participantes.filter(p =>
    `${p.nombre} ${p.id_empleado || ''} ${p.correo || ''}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  function toggle(id) {
    setSeleccionados(s => {
      if (s.includes(id)) return s.filter(x => x !== id)
      if (s.length >= cupoDisponible) {
        alert(`Solo quedan ${cupoDisponible} lugar(es) disponibles en esta convocatoria.`)
        return s
      }
      return [...s, id]
    })
  }

  async function inscribir() {
    if (seleccionados.length === 0) { alert('Selecciona al menos un participante'); return }
    setSaving(true)
    try {
      const rows = seleccionados.map(pid => {
        const p = participantes.find(x => x.id === pid)
        const esEmpresa = !!(p?.empresa_id || p?.registrado_por_empresa)
        return {
          proximo_curso_id: convocatoria.id,
          curso_nombre: convocatoria.curso_nombre,
          fecha: convocatoria.fecha,
          participante_id: pid,
          participante_nombre: p?.nombre,
          participante_correo: p?.correo,
          empresa_id: p?.empresa_id || p?.registrado_por_empresa || null,
          origen: esEmpresa ? 'empresa' : 'individual',
          estado: 'inscrito'
        }
      })
      const { error: errIns } = await supabase.from('inscripciones').insert(rows)
      if (errIns) {
        alert('No se pudo inscribir: ' + errIns.message + '\n\nVerifica que ejecutaste el SQL de inscripciones.')
        setSaving(false)
        return
      }
      // Actualizar cupo
      await supabase.from('proximos_cursos').update({ cupo_ocupado: (convocatoria.cupo_ocupado || 0) + seleccionados.length }).eq('id', convocatoria.id)
      // Dar acceso al examen
      for (const pid of seleccionados) {
        await supabase.from('participantes').update({ acceso_examen: true }).eq('id', pid)
      }
      // Registrar/actualizar en calendario de confirmados
      try {
        const { data: existe } = await supabase.from('cursos_confirmados')
          .select('id, num_participantes').eq('curso_nombre', convocatoria.curso_nombre).eq('fecha_inicio', convocatoria.fecha).maybeSingle()
        if (existe) {
          await supabase.from('cursos_confirmados').update({ num_participantes: (existe.num_participantes || 0) + seleccionados.length }).eq('id', existe.id)
        } else {
          await supabase.from('cursos_confirmados').insert({
            curso_id: convocatoria.curso_id, curso_nombre: convocatoria.curso_nombre,
            fecha_inicio: convocatoria.fecha, hora: convocatoria.hora, num_participantes: seleccionados.length,
            origen: 'proximo_curso', modalidad: 'zoom', estado: 'confirmado', notas: 'Convocatoria HCD'
          })
        }
      } catch (_) {}

      // Crear ASIGNACIONES para que se refleje en los portales (empresa e individual)
      try {
        const asigs = seleccionados.map(pid => {
          const p = participantes.find(x => x.id === pid)
          return {
            empresa_id: p?.empresa_id || p?.registrado_por_empresa || null,
            empleado_id: pid, empleado_nombre: p?.nombre,
            curso_id: convocatoria.curso_id, curso_nombre: convocatoria.curso_nombre, tipo: 'curso',
            modalidad_asignacion: 'zoom', fecha_programada: convocatoria.fecha,
            estado: 'asignado', notas: 'Inscrito a convocatoria HCD'
          }
        })
        await supabase.from('asignaciones').insert(asigs)
      } catch (_) {}

      alert(`✅ ${seleccionados.length} participante(s) inscrito(s) en la convocatoria.`)
      onDone()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Inscribir participantes</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>{convocatoria.curso_nombre} · {new Date(convocatoria.fecha).toLocaleDateString('es-MX')}</p>
        <p style={{ color: '#059669', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>Lugares disponibles: {cupoDisponible} · Seleccionados: {seleccionados.length}</p>

        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, ID o correo..."
          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 320, overflowY: 'auto' }}>
          {filtrados.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, padding: 16, textAlign: 'center' }}>No hay participantes.</p>
          ) : (
            filtrados.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: seleccionados.includes(p.id) ? '#f9f0f0' : '#fff' }}>
                <input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.id_empleado} · {p.correo} · {(p.empresa_id || p.registrado_por_empresa) ? 'Empresa' : 'Individual'}</div>
                </div>
              </label>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={inscribir} disabled={saving} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Inscribiendo...' : `Inscribir (${seleccionados.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
