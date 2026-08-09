import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const NIVELES = [
  { v: 'direccion', l: '🏛 Dirección' },
  { v: 'gerencia', l: '👔 Gerencia' },
  { v: 'supervision', l: '📋 Supervisión/Coordinación' },
  { v: 'operativo', l: '⚙️ Operativo' },
]

const nivelLabel = v => (NIVELES.find(n => n.v === v) || NIVELES[3]).l

export default function PuestosEmpresa({ empresa }) {
  const [puestos, setPuestos] = useState([])
  const [relaciones, setRelaciones] = useState([])
  const [cursos, setCursos] = useState([])
  const [puestoCursos, setPuestoCursos] = useState([])
  const [diagnosticos, setDiagnosticos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('puestos')
  const [modal, setModal] = useState(null)
  const [tabForm, setTabForm] = useState('datos')
  const [form, setForm] = useState({ nombre: '', area: '', nivel: 'operativo', conocimientos: '', habilidades: '', experiencia: '', experiencia_anios: 0, certificaciones: '' })
  const f = k => e => setForm(p => ({ ...p, [k]: e.target ? e.target.value : e }))

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [p, r, c, pc, d, e] = await Promise.all([
      supabase.from('puestos').select('*').eq('empresa_id', empresa.id).order('nombre'),
      supabase.from('puesto_relaciones').select('*').eq('empresa_id', empresa.id),
      supabase.from('cursos').select('id, nombre, duracion, categoria').eq('activo', true).order('nombre'),
      supabase.from('puesto_cursos').select('*').eq('empresa_id', empresa.id),
      supabase.from('diagnostico_empleado').select('*').eq('empresa_id', empresa.id),
      supabase.from('participantes').select('id, nombre, correo').eq('empresa_id', empresa.id),
    ])
    setPuestos(p.data || [])
    setRelaciones(r.data || [])
    setCursos(c.data || [])
    setPuestoCursos(pc.data || [])
    setDiagnosticos(d.data || [])
    setEmpleados(e.data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setForm({ nombre: '', area: '', nivel: 'operativo', conocimientos: '', habilidades: '', experiencia: '', experiencia_anios: 0, certificaciones: '' })
    setTabForm('datos')
    setModal({ tipo: 'nuevo' })
  }
  function abrirEditar(p) {
    setForm({ nombre: p.nombre || '', area: p.area || '', nivel: p.nivel || 'operativo', conocimientos: p.conocimientos || '', habilidades: p.habilidades || '', experiencia: p.experiencia || '', experiencia_anios: p.experiencia_anios || 0, certificaciones: p.certificaciones || '' })
    setTabForm('datos')
    setModal({ tipo: 'editar', id: p.id })
  }

  async function guardarPuesto() {
    if (!form.nombre.trim()) { alert('Escribe el nombre del puesto.'); return }
    const payload = { ...form, empresa_id: empresa.id }
    if (modal.tipo === 'nuevo') {
      const { error } = await supabase.from('puestos').insert(payload)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('puestos').update(payload).eq('id', modal.id)
      if (error) { alert('Error: ' + error.message); return }
    }
    setModal(null)
    await cargar()
  }

  async function eliminarPuesto(p) {
    if (!window.confirm(`¿Eliminar el puesto "${p.nombre}"? También se quitarán sus relaciones y diagnósticos.`)) return
    try { await supabase.from('puesto_relaciones').delete().or(`puesto_id.eq.${p.id},puesto_padre_id.eq.${p.id}`).eq('empresa_id', empresa.id) } catch (_) {}
    try { await supabase.from('puesto_cursos').delete().eq('puesto_id', p.id) } catch (_) {}
    try { await supabase.from('diagnostico_empleado').delete().eq('puesto_id', p.id) } catch (_) {}
    await supabase.from('puestos').delete().eq('id', p.id)
    await cargar()
  }

  // ── Relaciones (organigrama) ──
  async function agregarRelacion(puestoId, padreId) {
    if (!puestoId || !padreId || puestoId === padreId) return
    const existe = relaciones.find(r => r.puesto_id === puestoId && r.puesto_padre_id === padreId)
    if (existe) return
    await supabase.from('puesto_relaciones').insert({ empresa_id: empresa.id, puesto_id: puestoId, puesto_padre_id: padreId, tipo: 'reporta' })
    await cargar()
  }
  async function quitarRelacion(relId) {
    await supabase.from('puesto_relaciones').delete().eq('id', relId)
    await cargar()
  }

  // ── Diagnóstico ──
  async function toggleCurso(puestoId, curso) {
    const existe = puestoCursos.find(pc => pc.puesto_id === puestoId && pc.curso_id === curso.id)
    if (existe) {
      await supabase.from('puesto_cursos').delete().eq('id', existe.id)
      try { await supabase.from('diagnostico_empleado').delete().eq('puesto_id', puestoId).eq('curso_id', curso.id) } catch (_) {}
    } else {
      await supabase.from('puesto_cursos').insert({ empresa_id: empresa.id, puesto_id: puestoId, curso_id: curso.id, curso_nombre: curso.nombre })
    }
    await cargar()
  }
  async function toggleCapacitado(puestoId, empleado, curso) {
    const existe = diagnosticos.find(d => d.puesto_id === puestoId && d.empleado_id === empleado.id && d.curso_id === curso.id)
    if (existe) {
      await supabase.from('diagnostico_empleado').update({ capacitado: !existe.capacitado }).eq('id', existe.id)
    } else {
      await supabase.from('diagnostico_empleado').insert({ empresa_id: empresa.id, puesto_id: puestoId, empleado_id: empleado.id, empleado_nombre: empleado.nombre, curso_id: curso.id, curso_nombre: curso.nombre, capacitado: true })
    }
    await cargar()
  }

  // ── Organigrama PDF ──
  function imprimirOrganigrama() {
    const raices = puestos.filter(p => !relaciones.find(r => r.puesto_id === p.id))
    function buildTree(puesto, depth = 0) {
      const hijos = relaciones.filter(r => r.puesto_padre_id === puesto.id).map(r => puestos.find(p => p.id === r.puesto_id)).filter(Boolean)
      const indent = depth * 40
      let html = `<div style="margin-left:${indent}px;margin-bottom:8px;">
        <div style="display:inline-block;background:${depth === 0 ? '#8B1A1A' : '#fff'};color:${depth === 0 ? '#fff' : '#1e293b'};border:2px solid #8B1A1A;border-radius:10px;padding:10px 18px;font-weight:700;font-size:13px;position:relative;">
          ${puesto.nombre}
          <div style="font-size:10px;font-weight:400;color:${depth === 0 ? '#f9d0d0' : '#64748b'}">${puesto.area || ''} · ${nivelLabel(puesto.nivel)}</div>
        </div>
      </div>`
      hijos.forEach(h => { html += buildTree(h, depth + 1) })
      return html
    }
    let body = ''
    if (raices.length === 0 && puestos.length > 0) {
      puestos.forEach(p => { body += buildTree(p, 0) })
    } else {
      raices.forEach(p => { body += buildTree(p, 0) })
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Organigrama - ${empresa.nombre}</title>
<style>@page{size:landscape;margin:15mm}body{font-family:'Segoe UI',sans-serif;padding:20px;}
h1{color:#8B1A1A;font-size:22px;margin-bottom:4px;}h2{color:#64748b;font-size:14px;font-weight:400;margin-bottom:20px;}
.footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;text-align:center;}
</style></head><body>
<h1>Organigrama — ${empresa.nombre}</h1>
<h2>Generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</h2>
${body || '<p style="color:#94a3b8">No hay puestos registrados.</p>'}
<div class="footer">Hablando con Datos — Consultoría y Capacitación en Sistemas de Gestión · hcd-certificados.vercel.app</div>
<script>window.onload=()=>{window.print();}</script></body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando puestos...</div>

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
        Define los puestos de tu organización, diagnostica necesidades de capacitación y construye tu organigrama.
      </p>

      {/* Vista tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['puestos', `📋 Puestos (${puestos.length})`], ['diagnostico', '🎯 Diagnóstico'], ['organigrama', '🏗 Organigrama']].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)}
            style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${vista === v ? '#8B1A1A' : '#e2e8f0'}`, background: vista === v ? '#8B1A1A' : '#fff', color: vista === v ? '#fff' : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ═══ PUESTOS ═══ */}
      {vista === 'puestos' && <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button onClick={abrirNuevo} style={btnPrimary}>+ Agregar puesto</button>
        </div>
        {puestos.length === 0 ? (
          <div style={emptyBox}>Aún no has definido puestos. Empieza con "Agregar puesto".</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {puestos.map(p => (
              <div key={p.id} style={card}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 15 }}>{p.nombre}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{p.area || 'Sin área'} · {nivelLabel(p.nivel)}</div>
                  {p.conocimientos && <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>📚 {p.conocimientos.slice(0, 80)}{p.conocimientos.length > 80 ? '...' : ''}</div>}
                  {p.habilidades && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>🛠 {p.habilidades.slice(0, 80)}{p.habilidades.length > 80 ? '...' : ''}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => abrirEditar(p)} style={btnSmall}>✏️</button>
                  <button onClick={() => eliminarPuesto(p)} style={{ ...btnSmall, color: '#dc2626', borderColor: '#fecaca' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>}

      {/* ═══ DIAGNÓSTICO ═══ */}
      {vista === 'diagnostico' && <>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>Selecciona un puesto para ver los cursos sugeridos y el estado de capacitación de tus empleados.</p>
        {puestos.length === 0 ? (
          <div style={emptyBox}>Primero define tus puestos en la pestaña "Puestos".</div>
        ) : puestos.map(puesto => {
          const cursosDelPuesto = puestoCursos.filter(pc => pc.puesto_id === puesto.id)
          return (
            <div key={puesto.id} style={{ ...card, flexDirection: 'column', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: '#8B1A1A', fontSize: 15, marginBottom: 10 }}>🎯 {puesto.nombre}</div>

              {/* Cursos sugeridos */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Cursos requeridos (marca los que aplican):</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cursos.map(c => {
                    const activo = cursosDelPuesto.find(pc => pc.curso_id === c.id)
                    return (
                      <button key={c.id} onClick={() => toggleCurso(puesto.id, c)}
                        style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${activo ? '#059669' : '#e2e8f0'}`, background: activo ? '#f0fdf4' : '#fff', color: activo ? '#059669' : '#475569', fontSize: 11, fontWeight: activo ? 700 : 400, cursor: 'pointer' }}>
                        {activo ? '✓ ' : ''}{c.nombre}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Diagnóstico por empleado */}
              {cursosDelPuesto.length > 0 && empleados.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Estado de capacitación por empleado:</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8f9fb' }}>
                          <th style={thStyle}>Empleado</th>
                          {cursosDelPuesto.map(pc => <th key={pc.id} style={thStyle}>{pc.curso_nombre}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {empleados.map(emp => (
                          <tr key={emp.id}>
                            <td style={tdStyle}>{emp.nombre}</td>
                            {cursosDelPuesto.map(pc => {
                              const diag = diagnosticos.find(d => d.puesto_id === puesto.id && d.empleado_id === emp.id && d.curso_id === pc.curso_id)
                              const cap = diag?.capacitado
                              return (
                                <td key={pc.id} style={{ ...tdStyle, textAlign: 'center' }}>
                                  <button onClick={() => toggleCapacitado(puesto.id, emp, { id: pc.curso_id, nombre: pc.curso_nombre })}
                                    style={{ background: cap ? '#f0fdf4' : '#fef2f2', color: cap ? '#059669' : '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                                    {cap ? '✓ Sí' : '✗ No'}
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Resumen */}
                  {(() => {
                    const totalCeldas = cursosDelPuesto.length * empleados.length
                    const capacitados = diagnosticos.filter(d => d.puesto_id === puesto.id && d.capacitado).length
                    const pct = totalCeldas > 0 ? Math.round((capacitados / totalCeldas) * 100) : 0
                    return (
                      <div style={{ marginTop: 10, background: '#f8f9fb', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                        <strong>Cobertura:</strong> {capacitados}/{totalCeldas} ({pct}%) — {pct >= 80 ? '🟢 Bien capacitado' : pct >= 50 ? '🟡 Necesita refuerzo' : '🔴 Requiere capacitación urgente'}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </>}

      {/* ═══ ORGANIGRAMA ═══ */}
      {vista === 'organigrama' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <p style={{ color: '#64748b', fontSize: 13 }}>Define quién reporta a quién. El organigrama se construye solo.</p>
          <button onClick={imprimirOrganigrama} style={btnPrimary}>📄 Imprimir organigrama (PDF)</button>
        </div>

        {puestos.length < 2 ? (
          <div style={emptyBox}>Necesitas al menos 2 puestos para construir el organigrama.</div>
        ) : <>
          {/* Agregar relación */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Agregar relación</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select id="rel-hijo" style={inp}><option value="">— Puesto —</option>{puestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
              <span style={{ color: '#64748b', fontSize: 13 }}>reporta a →</span>
              <select id="rel-padre" style={inp}><option value="">— Superior —</option>{puestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
              <button onClick={() => {
                const h = document.getElementById('rel-hijo').value
                const p = document.getElementById('rel-padre').value
                agregarRelacion(h, p)
              }} style={btnPrimary}>Conectar</button>
            </div>
          </div>

          {/* Vista del organigrama */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px' }}>
            <OrgTree puestos={puestos} relaciones={relaciones} quitarRelacion={quitarRelacion} />
          </div>
        </>}
      </>}

      {/* ═══ MODAL PUESTO ═══ */}
      {modal && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{modal.tipo === 'nuevo' ? '+ Agregar puesto' : '✏️ Editar puesto'}</h3>

            {/* Tabs del formulario */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {[['datos', '📋 Datos'], ['conocimientos', '📚 Conocimientos'], ['habilidades', '🛠 Habilidades'], ['experiencia', '🎓 Experiencia']].map(([v, l]) => (
                <button key={v} onClick={() => setTabForm(v)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${tabForm === v ? '#8B1A1A' : '#e2e8f0'}`, background: tabForm === v ? '#8B1A1A' : '#fff', color: tabForm === v ? '#fff' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {l}
                </button>
              ))}
            </div>

            {tabForm === 'datos' && <>
              <label style={lbl}>Nombre del puesto *</label>
              <input value={form.nombre} onChange={f('nombre')} placeholder="Ej: Gerente de Calidad" style={inp} />
              <label style={lbl}>Área / Departamento</label>
              <input value={form.area} onChange={f('area')} placeholder="Ej: Calidad, Producción, RH" style={inp} />
              <label style={lbl}>Nivel organizacional</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {NIVELES.map(n => (
                  <button key={n.v} onClick={() => f('nivel')(n.v)}
                    style={{ padding: '7px 14px', borderRadius: 8, border: `2px solid ${form.nivel === n.v ? '#8B1A1A' : '#e2e8f0'}`, background: form.nivel === n.v ? '#f9f0f0' : '#fff', color: form.nivel === n.v ? '#8B1A1A' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {n.l}
                  </button>
                ))}
              </div>
            </>}
            {tabForm === 'conocimientos' && <>
              <label style={lbl}>¿Qué debe saber esta persona?</label>
              <textarea value={form.conocimientos} onChange={f('conocimientos')} rows={5} placeholder="Ej: Normas ISO 9001, ISO 14001. Herramientas estadísticas. Legislación laboral. Core Tools (APQP, PPAP, AMEF, SPC, MSA)." style={{ ...inp, resize: 'vertical' }} />
              <p style={{ color: '#94a3b8', fontSize: 11 }}>Describe los conocimientos técnicos y normativos que requiere el puesto.</p>
            </>}
            {tabForm === 'habilidades' && <>
              <label style={lbl}>¿Qué debe saber hacer?</label>
              <textarea value={form.habilidades} onChange={f('habilidades')} rows={5} placeholder="Ej: Realizar auditorías internas. Análisis de causa raíz. Liderazgo de equipos. Manejo de indicadores. Presentaciones ejecutivas." style={{ ...inp, resize: 'vertical' }} />
              <p style={{ color: '#94a3b8', fontSize: 11 }}>Describe las competencias y habilidades prácticas del puesto.</p>
            </>}
            {tabForm === 'experiencia' && <>
              <label style={lbl}>Años de experiencia mínimos</label>
              <input type="number" min={0} value={form.experiencia_anios} onChange={f('experiencia_anios')} style={{ ...inp, width: 120 }} />
              <label style={lbl}>Experiencia requerida</label>
              <textarea value={form.experiencia} onChange={f('experiencia')} rows={3} placeholder="Ej: 3 años en puestos similares en industria automotriz." style={{ ...inp, resize: 'vertical' }} />
              <label style={lbl}>Certificaciones previas</label>
              <textarea value={form.certificaciones} onChange={f('certificaciones')} rows={3} placeholder="Ej: Auditor líder ISO 9001, Green Belt Six Sigma, IATF 16949." style={{ ...inp, resize: 'vertical' }} />
            </>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={guardarPuesto} style={btnPrimary}>💾 Guardar puesto</button>
              <button onClick={() => setModal(null)} style={{ ...btnSmall, padding: '9px 20px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente del árbol visual ──
function OrgTree({ puestos, relaciones, quitarRelacion }) {
  const raices = puestos.filter(p => !relaciones.find(r => r.puesto_id === p.id))
  const huerfanos = puestos.filter(p => !relaciones.find(r => r.puesto_id === p.id) && !relaciones.find(r => r.puesto_padre_id === p.id))

  function Nodo({ puesto, depth = 0 }) {
    const hijos = relaciones.filter(r => r.puesto_padre_id === puesto.id)
    return (
      <div style={{ marginLeft: depth * 32, marginBottom: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: depth === 0 ? '#8B1A1A' : '#fff', color: depth === 0 ? '#fff' : '#1e293b', border: '2px solid #8B1A1A', borderRadius: 10, padding: '8px 16px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{puesto.nombre}</div>
            <div style={{ fontSize: 10, color: depth === 0 ? '#f9d0d0' : '#64748b' }}>{puesto.area || ''} · {nivelLabel(puesto.nivel)}</div>
          </div>
        </div>
        {depth > 0 && (() => {
          const rel = relaciones.find(r => r.puesto_id === puesto.id)
          return rel ? <button onClick={() => quitarRelacion(rel.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 10, marginLeft: 4 }} title="Quitar relación">✕</button> : null
        })()}
        {hijos.map(r => {
          const hijo = puestos.find(p => p.id === r.puesto_id)
          return hijo ? <Nodo key={r.id} puesto={hijo} depth={depth + 1} /> : null
        })}
      </div>
    )
  }

  const conPadre = raices.filter(p => relaciones.find(r => r.puesto_padre_id === p.id))
  return (
    <div>
      {conPadre.length > 0 ? conPadre.map(p => <Nodo key={p.id} puesto={p} depth={0} />) : null}
      {huerfanos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>Puestos sin conexión:</div>
          {huerfanos.map(p => <Nodo key={p.id} puesto={p} depth={0} />)}
        </div>
      )}
      {puestos.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>No hay puestos.</div>}
    </div>
  )
}

const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnSmall = { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
const emptyBox = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalBox = { background: '#fff', borderRadius: 16, padding: 'clamp(20px,5vw,28px)', width: 'min(520px,94vw)', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const lbl = { display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 4, marginTop: 12 }
const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
const thStyle = { padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', fontWeight: 700 }
const tdStyle = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#1e293b' }
