import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── RUTAS DE CAPACITACIÓN ────────────────────────────────────
// Sub-pestañas: Organigrama (puestos/requisitos/asignar) · Diagnóstico
// (necesidades por curso + solicitar capacitación) · Empleados (cumplimiento).
export default function RutasCapacitacion({ empresa, irACotizaciones }) {
  const [vista, setVista] = useState('organigrama')
  const [puestos, setPuestos] = useState([])
  const [requisitos, setRequisitos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [cursos, setCursos] = useState([])
  const [certificados, setCertificados] = useState([])
  const [matriz, setMatriz] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalPuesto, setModalPuesto] = useState(null)
  const [modalReq, setModalReq] = useState(null)
  const [modalSolicitar, setModalSolicitar] = useState(null) // { curso, empleados: [] }

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data: pts } = await supabase.from('puestos').select('*').eq('empresa_id', empresa.id).order('orden').order('created_at')
    const listaPuestos = pts || []

    let reqs = []
    if (listaPuestos.length > 0) {
      const { data: rq } = await supabase.from('puesto_requisitos').select('*').in('puesto_id', listaPuestos.map(p => p.id))
      reqs = rq || []
    }

    const e1 = await supabase.from('participantes').select('id, nombre, correo, id_empleado, puesto_id, empresa_id, registrado_por_empresa').eq('registrado_por_empresa', empresa.id)
    const e2 = await supabase.from('participantes').select('id, nombre, correo, id_empleado, puesto_id, empresa_id, registrado_por_empresa').eq('empresa_id', empresa.id)
    const mapEmp = new Map()
    ;[...(e1.data || []), ...(e2.data || [])].forEach(e => mapEmp.set(e.id, e))
    const listaEmpleados = [...mapEmp.values()]

    const { data: cur } = await supabase.from('cursos').select('id, nombre, categoria, duracion').eq('activo', true).order('nombre')

    // Certificados de estos empleados (para el cumplimiento por certificado)
    let certs = []
    if (listaEmpleados.length > 0) {
      const { data: ce } = await supabase.from('certificados').select('participante_id, curso_id').in('participante_id', listaEmpleados.map(e => e.id))
      certs = ce || []
    }

    const { data: mat } = await supabase.from('precios_categoria').select('*')

    // Solicitudes de capacitación (para marcar "ya solicitado")
    const { data: sol } = await supabase.from('solicitudes_capacitacion').select('curso_id, estado').eq('empresa_id', empresa.id)

    setPuestos(listaPuestos)
    setRequisitos(reqs)
    setEmpleados(listaEmpleados)
    setCursos(cur || [])
    setCertificados(certs)
    setMatriz(mat || [])
    setSolicitudes(sol || [])
    setLoading(false)
  }

  // ── Helpers ──
  function reqsDePuesto(pid) { return requisitos.filter(r => r.puesto_id === pid) }
  function empleadosDePuesto(pid) { return empleados.filter(e => e.puesto_id === pid) }
  function nombrePuesto(pid) { return puestos.find(p => p.id === pid)?.nombre || '—' }
  function tieneCurso(empId, cursoId) { return certificados.some(c => c.participante_id === empId && c.curso_id === cursoId) }
  function cursoYaSolicitado(cursoId) { return solicitudes.some(s => s.curso_id === cursoId && s.estado !== 'atendida') }
  const sinPuesto = empleados.filter(e => !e.puesto_id)

  // Diagnóstico por empleado
  function diagnosticoEmpleado(emp) {
    if (!emp.puesto_id) return { asignado: false }
    const reqsCurso = requisitos.filter(r => r.puesto_id === emp.puesto_id && r.tipo === 'curso' && r.curso_id)
    const obligatorios = reqsCurso.filter(r => r.obligatorio)
    const faltantesOblig = obligatorios.filter(r => !tieneCurso(emp.id, r.curso_id))
    const cumplidos = reqsCurso.filter(r => tieneCurso(emp.id, r.curso_id))
    return {
      asignado: true,
      total: reqsCurso.length,
      totalOblig: obligatorios.length,
      cumplidos: cumplidos.length,
      faltantesOblig,
      cumple: faltantesOblig.length === 0
    }
  }

  // Necesidades agregadas por curso (para el diagnóstico/venta)
  function calcularNecesidades() {
    const map = {}
    puestos.forEach(pto => {
      const reqsCurso = requisitos.filter(r => r.puesto_id === pto.id && r.tipo === 'curso' && r.curso_id)
      const emps = empleados.filter(e => e.puesto_id === pto.id)
      reqsCurso.forEach(r => {
        emps.forEach(e => {
          if (!tieneCurso(e.id, r.curso_id)) {
            if (!map[r.curso_id]) map[r.curso_id] = { curso_id: r.curso_id, empleados: new Map(), obligatorio: false }
            map[r.curso_id].empleados.set(e.id, e)
            if (r.obligatorio) map[r.curso_id].obligatorio = true
          }
        })
      })
    })
    return Object.values(map).map(n => ({
      curso: cursos.find(c => c.id === n.curso_id) || { id: n.curso_id, nombre: 'Curso' },
      empleados: [...n.empleados.values()],
      obligatorio: n.obligatorio
    })).sort((a, b) => b.empleados.length - a.empleados.length)
  }

  // ── Acciones CRUD ──
  async function eliminarPuesto(p) {
    if (!window.confirm(`¿Eliminar el puesto "${p.nombre}"? Los empleados quedarán sin puesto y se borrarán sus requisitos.`)) return
    const { error } = await supabase.from('puestos').delete().eq('id', p.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    await cargar()
  }
  async function eliminarReq(r) {
    const { error } = await supabase.from('puesto_requisitos').delete().eq('id', r.id)
    if (error) { alert('No se pudo quitar: ' + error.message); return }
    await cargar()
  }
  async function asignarEmpleado(empId, puestoId) {
    if (!empId) return
    const { error } = await supabase.from('participantes').update({ puesto_id: puestoId }).eq('id', empId)
    if (error) { alert('No se pudo asignar: ' + error.message); return }
    await cargar()
  }
  async function quitarEmpleado(empId) {
    const { error } = await supabase.from('participantes').update({ puesto_id: null }).eq('id', empId)
    if (error) { alert('No se pudo quitar: ' + error.message); return }
    await cargar()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando rutas de capacitación...</div>

  const necesidades = calcularNecesidades()
  const totalFaltantes = necesidades.reduce((s, n) => s + n.empleados.length, 0)

  return (
    <div>
      {/* Sub-pestañas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          ['organigrama', '🗂️ Puestos'],
          ['arbol', '🌳 Organigrama'],
          ['diagnostico', `📈 Diagnóstico${totalFaltantes ? ` (${totalFaltantes})` : ''}`],
          ['empleados', '👥 Empleados'],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${vista === v ? '#8B1A1A' : '#e2e8f0'}`, background: vista === v ? '#8B1A1A' : '#fff', color: vista === v ? '#fff' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ─────────── ORGANIGRAMA ─────────── */}
      {vista === 'organigrama' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <p style={{ color: '#64748b', fontSize: 14, maxWidth: 620 }}>
              Crea los puestos de tu empresa, describe qué conocimientos y cursos requiere cada uno, y asigna a tus empleados.
            </p>
            <button onClick={() => setModalPuesto({})} style={btnPrimary}>+ Nuevo puesto</button>
          </div>

          {sinPuesto.length > 0 && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#713f12' }}>
              ⚠️ Tienes <strong>{sinPuesto.length}</strong> empleado(s) sin puesto asignado.
            </div>
          )}

          {puestos.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              Aún no has creado puestos. Empieza con "+ Nuevo puesto".
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {puestos.map(p => {
                const reqs = reqsDePuesto(p.id)
                const emps = empleadosDePuesto(p.id)
                const disponibles = empleados.filter(e => e.puesto_id !== p.id)
                return (
                  <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>{p.nombre}</h3>
                        {p.puesto_padre_id && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>↳ Reporta a: {nombrePuesto(p.puesto_padre_id)}</div>}
                        {p.descripcion && <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>{p.descripcion}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setModalPuesto(p)} style={iconBtn}>✏️ Editar</button>
                        <button onClick={() => eliminarPuesto(p)} style={{ ...iconBtn, color: '#dc2626', borderColor: '#fecaca' }}>🗑</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5 }}>Requisitos de capacitación</span>
                        <button onClick={() => setModalReq(p)} style={{ ...iconBtn, fontSize: 12 }}>+ Agregar requisito</button>
                      </div>
                      {reqs.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: 12 }}>Sin requisitos. Agrega los conocimientos o cursos que exige este puesto.</p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {reqs.map(r => (
                            <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: r.tipo === 'curso' ? '#eff6ff' : '#f1f5f9', color: r.tipo === 'curso' ? '#1d4ed8' : '#475569', border: `1px solid ${r.tipo === 'curso' ? '#bfdbfe' : '#e2e8f0'}` }}>
                              {r.tipo === 'curso' ? '🎓' : '📌'} {r.descripcion}
                              {r.obligatorio ? <span title="Obligatorio" style={{ color: '#8B1A1A' }}>★</span> : <span title="Deseable" style={{ color: '#94a3b8' }}>☆</span>}
                              <button onClick={() => eliminarReq(r)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Empleados en este puesto ({emps.length})</div>
                      {emps.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                          {emps.map(e => (
                            <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, fontSize: 12, background: '#f8f9fb', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                              {e.nombre}
                              <button onClick={() => quitarEmpleado(e.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <select value="" onChange={e => asignarEmpleado(e.target.value, p.id)} style={{ ...inp, maxWidth: 320 }}>
                        <option value="">+ Asignar empleado a este puesto…</option>
                        {disponibles.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.puesto_id ? ` (mover desde: ${nombrePuesto(e.puesto_id)})` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────── ORGANIGRAMA (ÁRBOL) ─────────── */}
      {vista === 'arbol' && (
        <div>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
            Organigrama de tu empresa según el "reporta a" de cada puesto. Haz clic en un puesto para editarlo.
          </p>
          {puestos.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              Aún no hay puestos. Créalos en la pestaña "🗂️ Puestos".
            </div>
          ) : (
            <ArbolOrganigrama puestos={puestos} empleados={empleados} requisitos={requisitos} onEditar={p => setModalPuesto(p)} />
          )}
        </div>
      )}

      {/* ─────────── DIAGNÓSTICO ─────────── */}
      {vista === 'diagnostico' && (
        <div>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16, maxWidth: 640 }}>
            Necesidades de capacitación detectadas: empleados cuyo puesto exige un curso que <strong>aún no tienen certificado</strong>.
            Agrupados por curso para que aproveches el mejor precio por volumen.
          </p>
          {necesidades.length === 0 ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#15803d' }}>
              🎉 ¡Todo en orden! No hay huecos de capacitación en cursos requeridos, o aún no has definido requisitos de tipo curso.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {necesidades.map(n => {
                const yaSol = cursoYaSolicitado(n.curso.id)
                return (
                <div key={n.curso.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px', borderLeft: `4px solid ${n.obligatorio ? '#8B1A1A' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>🎓 {n.curso.nombre}</h3>
                        <span style={{ background: n.obligatorio ? '#f9f0f0' : '#fef9c3', color: n.obligatorio ? '#8B1A1A' : '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                          {n.obligatorio ? 'Obligatorio' : 'Deseable'}
                        </span>
                        {yaSol && (
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: '1px solid #bfdbfe' }}>⏳ Ya solicitado</span>
                        )}
                      </div>
                      <p style={{ color: '#64748b', fontSize: 13 }}>
                        <strong style={{ color: '#8B1A1A' }}>{n.empleados.length}</strong> empleado(s) lo necesitan:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {n.empleados.map(e => (
                          <span key={e.id} style={{ padding: '3px 9px', borderRadius: 8, fontSize: 12, background: '#f8f9fb', border: '1px solid #e2e8f0', color: '#475569' }}>{e.nombre}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => {
                        if (yaSol && !window.confirm('Ya existe una solicitud de este curso pendiente. ¿Generar otra cotización de todos modos?')) return
                        setModalSolicitar({ curso: n.curso, empleados: n.empleados })
                      }}
                      style={{ ...(yaSol ? btnGhost : btnPrimary), whiteSpace: 'nowrap' }}>
                      {yaSol ? '↻ Solicitar de nuevo' : '💼 Solicitar capacitación'}
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────── EMPLEADOS (cumplimiento) ─────────── */}
      {vista === 'empleados' && (
        <div>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>Estado de capacitación de cada empleado según los requisitos (por curso) de su puesto.</p>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Empleado', 'Puesto', 'Cursos requeridos', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleados.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No hay empleados registrados.</td></tr>
                )}
                {empleados.map(e => {
                  const d = diagnosticoEmpleado(e)
                  return (
                    <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 16px', color: '#1e293b', fontSize: 13, fontWeight: 600 }}>{e.nombre}</td>
                      <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{e.puesto_id ? nombrePuesto(e.puesto_id) : <span style={{ color: '#94a3b8' }}>Sin puesto</span>}</td>
                      <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>
                        {!d.asignado ? '—' : d.total === 0 ? <span style={{ color: '#94a3b8' }}>Sin cursos requeridos</span> : `${d.cumplidos} de ${d.total} con certificado`}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        {!d.asignado ? (
                          <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Sin puesto</span>
                        ) : d.totalOblig === 0 ? (
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Sin obligatorios</span>
                        ) : d.cumple ? (
                          <span style={{ background: '#f0fdf4', color: '#059669', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>✅ Cumple</span>
                        ) : (
                          <span style={{ background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }} title={d.faltantesOblig.map(r => r.descripcion).join(', ')}>
                            ⚠️ Le falta{d.faltantesOblig.length > 1 ? `n ${d.faltantesOblig.length}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {modalPuesto && (
        <ModalPuesto empresa={empresa} puestos={puestos} editando={modalPuesto.id ? modalPuesto : null}
          onClose={() => setModalPuesto(null)} onDone={() => { setModalPuesto(null); cargar() }} />
      )}
      {modalReq && (
        <ModalRequisito puesto={modalReq} cursos={cursos}
          onClose={() => setModalReq(null)} onDone={() => { setModalReq(null); cargar() }} />
      )}
      {modalSolicitar && (
        <ModalSolicitar empresa={empresa} curso={modalSolicitar.curso} empleadosSel={modalSolicitar.empleados} matriz={matriz}
          onClose={() => setModalSolicitar(null)}
          onDone={() => { setModalSolicitar(null); cargar(); irACotizaciones && irACotizaciones() }} />
      )}
    </div>
  )
}

// ─── Árbol de organigrama (SVG + nodos, sin librerías) ────────
// Orientaciones: vertical (arriba→abajo), horizontal (izq→der) y mixto
// (vertical, pero los hijos que son hoja se apilan en columna).
function ArbolOrganigrama({ puestos, empleados, requisitos, onEditar }) {
  const [orientacion, setOrientacion] = useState('vertical')
  const NODO_W = 224, NODO_H = 104, GAP_X = 30, GAP_Y = 52, GAP_STACK = 16, INDENT = 36

  const byId = new Map(puestos.map(p => [p.id, p]))
  const children = new Map()
  puestos.forEach(p => {
    const parent = (p.puesto_padre_id && byId.has(p.puesto_padre_id)) ? p.puesto_padre_id : null
    if (parent) { if (!children.has(parent)) children.set(parent, []); children.get(parent).push(p) }
  })
  const kidsOf = id => children.get(id) || []
  const roots = puestos.filter(p => !(p.puesto_padre_id && byId.has(p.puesto_padre_id)))

  const pos = {}
  const stacked = new Set()
  const visitados = new Set()
  let maxRight = 0, maxBottom = 0
  const track = id => { maxRight = Math.max(maxRight, pos[id].left + NODO_W); maxBottom = Math.max(maxBottom, pos[id].top + NODO_H) }

  // Vertical: hijos en fila, padre centrado arriba
  function placeV(node, x, y, depth) {
    if (visitados.has(node.id)) { pos[node.id] = { left: x, top: y, depth }; track(node.id); return NODO_W }
    visitados.add(node.id)
    const kids = kidsOf(node.id)
    if (kids.length === 0) { pos[node.id] = { left: x, top: y, depth }; track(node.id); return NODO_W }
    let cursorX = x, first = null, last = null
    const cy = y + NODO_H + GAP_Y
    kids.forEach(k => {
      const w = placeV(k, cursorX, cy, depth + 1)
      const c = pos[k.id].left + NODO_W / 2
      if (first === null) first = c; last = c
      cursorX += w + GAP_X
    })
    pos[node.id] = { left: (first + last) / 2 - NODO_W / 2, top: y, depth }
    track(node.id)
    return Math.max((cursorX - GAP_X) - x, NODO_W)
  }

  // Horizontal: hijos en columna, padre centrado a la izquierda
  function placeH(node, x, y, depth) {
    if (visitados.has(node.id)) { pos[node.id] = { left: x, top: y, depth }; track(node.id); return NODO_H }
    visitados.add(node.id)
    const kids = kidsOf(node.id)
    if (kids.length === 0) { pos[node.id] = { left: x, top: y, depth }; track(node.id); return NODO_H }
    let cursorY = y, first = null, last = null
    const cx = x + NODO_W + GAP_X + 20
    kids.forEach(k => {
      const h = placeH(k, cx, cursorY, depth + 1)
      const c = pos[k.id].top + NODO_H / 2
      if (first === null) first = c; last = c
      cursorY += h + GAP_Y
    })
    pos[node.id] = { left: x, top: (first + last) / 2 - NODO_H / 2, depth }
    track(node.id)
    return Math.max((cursorY - GAP_Y) - y, NODO_H)
  }

  // Mixto: vertical, pero si TODOS los hijos son hoja, se apilan en columna
  function placeM(node, x, y, depth) {
    if (visitados.has(node.id)) { pos[node.id] = { left: x, top: y, depth }; track(node.id); return { w: NODO_W, h: NODO_H } }
    visitados.add(node.id)
    const kids = kidsOf(node.id)
    if (kids.length === 0) { pos[node.id] = { left: x, top: y, depth }; track(node.id); return { w: NODO_W, h: NODO_H } }
    const allLeaves = kids.every(k => kidsOf(k.id).length === 0)
    if (allLeaves && kids.length > 1) {
      pos[node.id] = { left: x, top: y, depth }; track(node.id)
      let cy = y + NODO_H + GAP_Y
      kids.forEach(k => { pos[k.id] = { left: x + INDENT, top: cy, depth: depth + 1 }; track(k.id); cy += NODO_H + GAP_STACK })
      stacked.add(node.id)
      return { w: INDENT + NODO_W, h: cy - y }
    }
    let cursorX = x, first = null, last = null, maxH = 0
    const cy = y + NODO_H + GAP_Y
    kids.forEach(k => {
      const r = placeM(k, cursorX, cy, depth + 1)
      const c = pos[k.id].left + NODO_W / 2
      if (first === null) first = c; last = c
      cursorX += r.w + GAP_X; maxH = Math.max(maxH, r.h)
    })
    pos[node.id] = { left: (first + last) / 2 - NODO_W / 2, top: y, depth }; track(node.id)
    return { w: Math.max((cursorX - GAP_X) - x, NODO_W), h: NODO_H + GAP_Y + maxH }
  }

  if (orientacion === 'horizontal') {
    let cy = 10
    roots.forEach(r => { const h = placeH(r, 10, cy, 0); cy += h + GAP_Y * 1.4 })
  } else if (orientacion === 'mixto') {
    let cx = 10
    roots.forEach(r => { const res = placeM(r, cx, 10, 0); cx += res.w + GAP_X * 2 })
  } else {
    let cx = 10
    roots.forEach(r => { const w = placeV(r, cx, 10, 0); cx += w + GAP_X * 2 })
  }

  const width = maxRight + 20
  const height = maxBottom + 20

  // Conectores
  const lineas = []
  puestos.forEach(p => {
    const parent = (p.puesto_padre_id && byId.has(p.puesto_padre_id)) ? p.puesto_padre_id : null
    if (!parent || !pos[parent] || !pos[p.id]) return
    const P = pos[parent], C = pos[p.id]
    if (orientacion === 'horizontal') {
      const x1 = P.left + NODO_W, y1 = P.top + NODO_H / 2, x2 = C.left, y2 = C.top + NODO_H / 2, mid = (x1 + x2) / 2
      lineas.push(`M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`)
    } else if (orientacion === 'mixto' && stacked.has(parent)) {
      const x1 = P.left + 18, y1 = P.top + NODO_H, x2 = C.left, y2 = C.top + NODO_H / 2
      lineas.push(`M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`)
    } else {
      const x1 = P.left + NODO_W / 2, y1 = P.top + NODO_H, x2 = C.left + NODO_W / 2, y2 = C.top, mid = (y1 + y2) / 2
      lineas.push(`M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`)
    }
  })

  const NIVEL = [
    { border: '#8B1A1A', head: '#f9f0f0', text: '#8B1A1A' },
    { border: '#1d4ed8', head: '#eff6ff', text: '#1d4ed8' },
    { border: '#059669', head: '#f0fdf4', text: '#059669' },
    { border: '#b45309', head: '#fffbeb', text: '#b45309' },
    { border: '#7c3aed', head: '#f5f3ff', text: '#7c3aed' },
  ]
  function titular(pid) {
    const emps = empleados.filter(e => e.puesto_id === pid)
    if (emps.length === 0) return { nombre: null, extra: 0 }
    return { nombre: emps[0].nombre, extra: emps.length - 1 }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 2 }}>Vista:</span>
        {[['vertical', '↕ Vertical'], ['horizontal', '↔ Horizontal'], ['mixto', '⌥ Mixto']].map(([v, l]) => (
          <button key={v} onClick={() => setOrientacion(v)}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${orientacion === v ? '#8B1A1A' : '#e2e8f0'}`, background: orientacion === v ? '#8B1A1A' : '#fff', color: orientacion === v ? '#fff' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 14, background: '#fafbfc', padding: 10, maxHeight: '72vh' }}>
        <div style={{ position: 'relative', width, height, minWidth: '100%' }}>
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {lineas.map((d, i) => <path key={i} d={d} fill="none" stroke="#cbd5e1" strokeWidth={2} />)}
          </svg>
          {puestos.map(p => {
            if (!pos[p.id]) return null
            const col = NIVEL[(pos[p.id].depth || 0) % NIVEL.length]
            const nEmp = empleados.filter(e => e.puesto_id === p.id).length
            const nReq = requisitos.filter(r => r.puesto_id === p.id).length
            const t = titular(p.id)
            return (
              <div key={p.id} onClick={() => onEditar(p)} title="Clic para editar"
                style={{ position: 'absolute', left: pos[p.id].left, top: pos[p.id].top, width: NODO_W, height: NODO_H, background: '#fff', border: `2px solid ${col.border}`, borderRadius: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.08)', boxSizing: 'border-box', overflow: 'hidden' }}>
                <div style={{ background: col.head, padding: '8px 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: col.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.nombre}</div>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ fontSize: 12, color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.nombre ? <>👤 {t.nombre}{t.extra > 0 ? <span style={{ color: '#94a3b8', fontWeight: 500 }}> +{t.extra}</span> : ''}</> : <span style={{ color: '#94a3b8', fontWeight: 500 }}>Vacante</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b', marginTop: 5 }}>
                    <span>👥 {nEmp}</span><span>🎓 {nReq} req</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Modal: crear / editar puesto ─────────────────────────────
function ModalPuesto({ empresa, puestos, editando, onClose, onDone }) {
  const [nombre, setNombre] = useState(editando?.nombre || '')
  const [descripcion, setDescripcion] = useState(editando?.descripcion || '')
  const [padre, setPadre] = useState(editando?.puesto_padre_id || '')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!nombre.trim()) { alert('Escribe el nombre del puesto'); return }
    setSaving(true)
    try {
      const payload = { empresa_id: empresa.id, nombre: nombre.trim(), descripcion: descripcion.trim() || null, puesto_padre_id: padre || null }
      if (editando) {
        const { error } = await supabase.from('puestos').update(payload).eq('id', editando.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('puestos').insert({ ...payload, orden: puestos.length })
        if (error) throw error
      }
      onDone()
    } catch (e) {
      alert('Error al guardar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  const opcionesPadre = puestos.filter(p => !editando || p.id !== editando.id)

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{editando ? 'Editar puesto' : 'Nuevo puesto'}</h3>
        <label style={lbl}>Nombre del puesto *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej. Gerente de Calidad" style={inp} />
        <label style={lbl}>Descripción del puesto</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} placeholder="Responsabilidades y perfil general…" style={{ ...inp, resize: 'vertical' }} />
        <label style={lbl}>Reporta a (opcional)</label>
        <select value={padre} onChange={e => setPadre(e.target.value)} style={inp}>
          <option value="">— Sin jefe directo (nivel superior) —</option>
          {opcionesPadre.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving || !nombre.trim()} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar puesto'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: agregar requisito ─────────────────────────────────
function ModalRequisito({ puesto, cursos, onClose, onDone }) {
  const [tipo, setTipo] = useState('texto')
  const [descripcion, setDescripcion] = useState('')
  const [cursoId, setCursoId] = useState('')
  const [obligatorio, setObligatorio] = useState(true)
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (tipo === 'texto' && !descripcion.trim()) { alert('Escribe el conocimiento requerido'); return }
    if (tipo === 'curso' && !cursoId) { alert('Elige el curso requerido'); return }
    setSaving(true)
    try {
      const curso = cursos.find(c => c.id === cursoId)
      const payload = { puesto_id: puesto.id, tipo, descripcion: tipo === 'curso' ? (curso?.nombre || 'Curso') : descripcion.trim(), curso_id: tipo === 'curso' ? cursoId : null, obligatorio }
      const { error } = await supabase.from('puesto_requisitos').insert(payload)
      if (error) throw error
      onDone()
    } catch (e) {
      alert('Error al guardar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Agregar requisito</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Puesto: <strong>{puesto.nombre}</strong></p>
        <label style={lbl}>Tipo de requisito</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          {[['texto', '📌 Conocimiento', 'Texto libre'], ['curso', '🎓 Curso HCD', 'De nuestro catálogo']].map(([v, l, d]) => (
            <button key={v} type="button" onClick={() => setTipo(v)}
              style={{ flex: 1, padding: '10px', border: `2px solid ${tipo === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 10, background: tipo === v ? '#f9f0f0' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tipo === v ? '#8B1A1A' : '#475569' }}>{l}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{d}</div>
            </button>
          ))}
        </div>
        {tipo === 'texto' ? (
          <>
            <label style={lbl}>Conocimiento requerido</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="ej. Manejo de montacargas, Excel avanzado…" style={inp} />
          </>
        ) : (
          <>
            <label style={lbl}>Curso requerido</label>
            <select value={cursoId} onChange={e => setCursoId(e.target.value)} style={inp}>
              <option value="">— Elige un curso —</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Ej. "El puesto requiere dominio de ISO 9001". Se usará en el diagnóstico y la ruta sugerida.</p>
          </>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14 }}>
          <input type="checkbox" checked={obligatorio} onChange={e => setObligatorio(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
          <span style={{ fontSize: 13, color: '#374151' }}>Obligatorio <span style={{ color: '#94a3b8' }}>(si se desmarca, cuenta como deseable)</span></span>
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Agregar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: solicitar capacitación (genera cotización) ────────
function ModalSolicitar({ empresa, curso, empleadosSel, matriz, onClose, onDone }) {
  const [saving, setSaving] = useState(false)
  const horas = Number(curso?.duracion) || 0
  const num = empleadosSel.length
  const bloque = bloqueDePersonasRuta(num)
  const esEspecial = bloque === 'especial'
  const precioBase = (!esEspecial && horas > 0) ? precioHoraRuta(matriz, curso.categoria, bloque, tierDuracionRuta(horas)) * horas : 0
  const subtotal = precioBase
  const ivaMonto = subtotal * IVA_RUTA
  const total = subtotal + ivaMonto

  async function generar() {
    if (esEspecial) { alert('16+ participantes: cotización especial. Contacta a HCD por WhatsApp.'); return }
    if (precioBase <= 0) { alert('No se encontró precio en Precios y Catálogo para este curso. Revisa su categoría/duración o contacta a HCD.'); return }
    setSaving(true)
    try {
      const year = new Date().getFullYear()
      const { data: foliosExist } = await supabase.from('cotizaciones').select('folio').like('folio', `HCD-COT-${year}-%`)
      let maxNum = 0
      ;(foliosExist || []).forEach(c => { const m = (c.folio || '').match(/HCD-COT-\d+-(\d+)/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)) })
      const folio = `HCD-COT-${year}-${String(maxNum + 1).padStart(4, '0')}`

      const nombres = empleadosSel.map(e => e.nombre).filter(Boolean)
      const esClienteNuevo = empresa.tipo_acceso !== 'cliente'

      const payload = {
        folio, empresa_nombre: empresa.nombre,
        contacto_nombre: empresa.contacto_nombre || '', contacto_email: empresa.contacto_email || '', contacto_whatsapp: empresa.contacto_whatsapp || '',
        curso_id: curso.id, curso_nombre: curso.nombre, tipo_precio: 'persona', modalidad: 'online',
        num_personas: num, dias: horas <= 8 ? 1 : horas <= 16 ? 2 : 3,
        precio_base: precioBase, descuento_tipo: null, descuento_valor: 0,
        requiere_viaticos: false, monto_viaticos: 0, aplica_iva: true,
        subtotal, iva: ivaMonto, total,
        es_cliente_nuevo: esClienteNuevo, comision_porcentaje: esClienteNuevo ? 15 : 10, comision_monto: total * (esClienteNuevo ? 0.15 : 0.10),
        incluye_consultoria: false, cupon_codigo: null,
        notas: `[Ruta de capacitación] ${curso.nombre} · ${num} empleado(s): ${nombres.join(', ')}`,
        empresa_id: empresa.id, empresa_registrada: true, estado: 'enviada'
      }
      const { error: errCot } = await supabase.from('cotizaciones').insert(payload)
      if (errCot) { alert('No se pudo guardar la cotización: ' + (errCot.message || '')); setSaving(false); return }

      // Registrar solicitudes (una por empleado) para tu seguimiento
      try {
        const rows = empleadosSel.map(e => ({
          empresa_id: empresa.id, empresa_nombre: empresa.nombre,
          participante_id: e.id, participante_nombre: e.nombre,
          puesto_id: e.puesto_id || null, curso_id: curso.id, curso_nombre: curso.nombre,
          estado: 'cotizada'
        }))
        await supabase.from('solicitudes_capacitacion').insert(rows)
      } catch (_) {}

      try {
        await supabase.from('notificaciones').insert({
          tipo: 'cotizacion', titulo: 'Solicitud de capacitación (ruta)',
          mensaje: `${empresa.nombre} solicitó ${curso.nombre} para ${num} empleado(s) — $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          link: '/admin/cotizaciones'
        })
      } catch (_) {}

      const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
      const ventana = window.open('', '_blank', 'width=900,height=700')
      if (ventana) {
        ventana.document.write(htmlCotizacionRuta({ empresa, curso_nombre: curso.nombre, num_personas: num, bloque, horas, subtotal, iva_monto: ivaMonto, total, folio, fecha, alumnos: nombres }))
        ventana.document.close()
      }

      alert(`✅ Cotización ${folio} generada para ${num} empleado(s).\n\nLa encuentras en "Mis cotizaciones". Adjunta ahí tu orden de compra para confirmar.`)
      onDone()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Solicitar capacitación</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Curso: <strong>{curso.nombre}</strong></p>

        <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '12px 14px', marginBottom: 16, maxHeight: 140, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{num} empleado(s) a capacitar:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {empleadosSel.map(e => <span key={e.id} style={{ padding: '3px 9px', borderRadius: 8, fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', color: '#475569' }}>{e.nombre}</span>)}
          </div>
        </div>

        <div style={{ background: '#f9f0f0', border: '1px solid #f3d9d9', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          {esEspecial ? (
            <p style={{ color: '#92400e', fontSize: 13 }}>16+ participantes: cotización especial. Contacta a HCD por WhatsApp.</p>
          ) : precioBase <= 0 ? (
            <p style={{ color: '#92400e', fontSize: 13 }}>No se encontró precio para este curso. Contacta a HCD.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 4 }}>
                <span>Bloque {bloque} · {num} persona(s) · {horas}h</span>
                <span>Subtotal ${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                <span>IVA (16%)</span><span>${ivaMonto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#8B1A1A', fontWeight: 800, borderTop: '1px solid #f3d9d9', paddingTop: 6 }}>
                <span>Total</span><span>${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
        </div>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>Se genera tu cotización, se descarga en PDF y queda en "Mis cotizaciones" para que adjuntes tu orden de compra.</p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={generar} disabled={saving || esEspecial || precioBase <= 0} style={btnPrimary}>{saving ? 'Generando...' : 'Generar cotización'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Precio (mismo modelo que el cotizador) ───────────────────
const IVA_RUTA = 0.16
const EMAIL_RUTA = 'luisgomez@hablandocondatos.com.mx'
function bloqueDePersonasRuta(n) {
  const num = Number(n) || 0
  if (num <= 5) return '1-5'
  if (num <= 10) return '6-10'
  if (num <= 15) return '11-15'
  return 'especial'
}
function tierDuracionRuta(horas) {
  const h = Number(horas) || 0
  if (h <= 8) return '1'
  if (h <= 16) return '2'
  if (h <= 24) return '3'
  return '4'
}
function precioHoraRuta(matriz, categoria, bloque, tier) {
  const r = (matriz || []).find(x => x.categoria === (categoria || 'B') && x.bloque === bloque && (x.duracion_tier || '1') === tier)
  return r ? Number(r.precio_hora) || 0 : 0
}

function htmlCotizacionRuta({ empresa, curso_nombre, num_personas, bloque, horas, subtotal, iva_monto, total, folio, fecha, alumnos }) {
  const lista = (alumnos && alumnos.length) ? `<div class="seccion"><h3>Empleados a capacitar (${alumnos.length})</h3><p style="font-size:13px;color:#475569;line-height:1.7">${alumnos.join(' · ')}</p></div>` : ''
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Cotización ${folio}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',sans-serif;color:#1e293b;background:#fff;}
.page{max-width:800px;margin:0 auto;padding:40px;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #8B1A1A;}
.company{font-size:22px;font-weight:800;color:#8B1A1A;}.sub{font-size:11px;color:#64748b;margin-top:2px;}.folio-area{text-align:right;}
.folio-label{font-size:11px;color:#64748b;letter-spacing:1px;text-transform:uppercase;}.folio-val{font-size:18px;font-weight:800;color:#8B1A1A;}
.fecha{color:#64748b;font-size:12px;margin-top:4px;}.seccion{margin-bottom:24px;}
.seccion h3{font-size:13px;font-weight:700;color:#8B1A1A;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}.dato label{font-size:11px;color:#64748b;display:block;margin-bottom:2px;}.dato span{font-size:14px;color:#1e293b;font-weight:500;}
table{width:100%;border-collapse:collapse;margin-top:8px;}th{background:#f8f9fb;padding:10px 14px;text-align:left;font-size:11px;color:#64748b;letter-spacing:.5px;text-transform:uppercase;}
td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}.total-row td{font-weight:800;font-size:15px;color:#8B1A1A;border-top:2px solid #8B1A1A;border-bottom:none;}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:11px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="page">
<div class="header"><div><div class="company">● Hablando con Datos</div><div class="sub">Consultoría y Capacitación en Sistemas de Gestión</div>
<div class="sub" style="margin-top:4px">Gerencia de Ventas</div><div class="sub">WhatsApp: 222 354 9353 · ${EMAIL_RUTA}</div></div>
<div class="folio-area"><div class="folio-label">Cotización</div><div class="folio-val">${folio}</div><div class="fecha">Fecha: ${fecha}</div><div class="fecha">Vigencia: 30 días naturales</div></div></div>
<div class="seccion"><h3>Datos del cliente</h3><div class="grid2">
<div class="dato"><label>Empresa</label><span>${empresa.nombre || ''}</span></div><div class="dato"><label>Contacto</label><span>${empresa.contacto_nombre || ''}</span></div>
<div class="dato"><label>Correo</label><span>${empresa.contacto_email || ''}</span></div><div class="dato"><label>WhatsApp</label><span>${empresa.contacto_whatsapp || '—'}</span></div></div></div>
<div class="seccion"><h3>Detalle de la cotización</h3><table><thead><tr><th>Concepto</th><th>Detalle</th><th style="text-align:right">Importe</th></tr></thead><tbody>
<tr><td><strong>${curso_nombre}</strong></td><td>${num_personas} persona(s) · Bloque ${bloque} · ${horas}h</td><td style="text-align:right">$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
<tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">Subtotal</td><td style="text-align:right">$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
<tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">IVA (16%)</td><td style="text-align:right">$${iva_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
<tr class="total-row"><td colspan="2" style="text-align:right">TOTAL</td><td style="text-align:right">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (IVA incl.)</td></tr></tbody></table></div>
${lista}
<div class="seccion" style="background:#f8f9fb;border-radius:8px;padding:16px;"><h3 style="margin-bottom:8px">Condiciones</h3>
<p style="font-size:12px;color:#475569;line-height:1.8">• Cotización válida por 30 días naturales.<br/>• Precios en pesos mexicanos (MXN). IVA del 16% incluido.<br/>
• La inscripción se confirma al adjuntar la orden de compra en el portal.<br/>• Incluye material didáctico y constancias con folio único verificable.<br/>
• Contacto: WhatsApp 222 354 9353 · ${EMAIL_RUTA}</p></div>
<div class="footer"><p>Hablando con Datos — Consultoría y Capacitación en Sistemas de Gestión · Puebla, México</p>
<p style="margin-top:4px">Folio: ${folio} · Gerencia de Ventas: 222 354 9353 · ${EMAIL_RUTA}</p></div>
</div><script>window.onload=()=>{window.print();}</script></body></html>`
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const iconBtn = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: '#475569', fontWeight: 600 }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 500, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
