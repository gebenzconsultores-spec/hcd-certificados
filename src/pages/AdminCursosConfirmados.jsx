import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function AdminCursosConfirmados() {
  const [confirmados, setConfirmados] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('calendario')
  const [mesActual, setMesActual] = useState(new Date())
  const [detalle, setDetalle] = useState(null)
  const [modalProgramar, setModalProgramar] = useState(false)
  const [cursos, setCursos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [participantes, setParticipantes] = useState([])
  const [asistentes, setAsistentes] = useState([])

  useEffect(() => {
    cargar()
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const [{ data: cur }, { data: emp }, { data: part }] = await Promise.all([
      supabase.from('cursos').select('id, nombre, numero_curso').eq('activo', true),
      supabase.from('empresas').select('id, nombre'),
      supabase.from('participantes').select('id, nombre, id_empleado, correo, empresa_id, registrado_por_empresa, tipo')
    ])
    setCursos(cur || [])
    setEmpresas(emp || [])
    setParticipantes(part || [])
  }

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('cursos_confirmados').select('*').order('fecha_inicio', { ascending: true })
    setConfirmados(data || [])
    setLoading(false)
  }

  async function verDetalle(curso) {
    setDetalle(curso)
    if (curso.id_compra) {
      const { data } = await supabase.from('asignaciones').select('*').eq('id_compra', curso.id_compra)
      setAsistentes(data || [])
    } else {
      setAsistentes([])
    }
  }

  async function cambiarEstado(curso, estado) {
    await supabase.from('cursos_confirmados').update({ estado }).eq('id', curso.id)
    await cargar()
    if (detalle?.id === curso.id) setDetalle({ ...detalle, estado })
  }

  async function eliminar(curso) {
    if (!window.confirm('¿Eliminar este curso confirmado del calendario?')) return
    await supabase.from('cursos_confirmados').delete().eq('id', curso.id)
    setDetalle(null)
    await cargar()
  }

  // Calendario
  const year = mesActual.getFullYear()
  const month = mesActual.getMonth()
  const primerDia = new Date(year, month, 1).getDay()
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const celdas = []
  for (let i = 0; i < primerDia; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)

  function cursosDelDia(dia) {
    if (!dia) return []
    const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return confirmados.filter(c => c.fecha_inicio === fechaStr)
  }

  const COLORES_ESTADO = {
    confirmado: '#1d4ed8', en_curso: '#d97706', completado: '#059669', cancelado: '#94a3b8'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Cursos confirmados</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Calendario de cursos agendados (con orden de compra o programados por ti)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setVista('calendario')} style={{ background: vista === 'calendario' ? '#8B1A1A' : '#f1f5f9', color: vista === 'calendario' ? '#fff' : '#475569', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📅 Calendario</button>
          <button onClick={() => setVista('lista')} style={{ background: vista === 'lista' ? '#8B1A1A' : '#f1f5f9', color: vista === 'lista' ? '#fff' : '#475569', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📋 Lista</button>
          <button onClick={() => setModalProgramar(true)} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Programar curso</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>
      ) : vista === 'calendario' ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24 }}>
          {/* Navegación de mes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button onClick={() => setMesActual(new Date(year, month - 1))} style={navBtn}>← Anterior</button>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{MESES[month]} {year}</h2>
            <button onClick={() => setMesActual(new Date(year, month + 1))} style={navBtn}>Siguiente →</button>
          </div>

          {/* Días de la semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, marginBottom: 8 }}>
            {DIAS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', padding: '8px 0' }}>{d}</div>)}
          </div>

          {/* Celdas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
            {celdas.map((dia, i) => {
              const cursos = cursosDelDia(dia)
              const esHoy = dia && new Date().toDateString() === new Date(year, month, dia).toDateString()
              return (
                <div key={i} style={{ minHeight: 90, borderRadius: 10, border: `1px solid ${esHoy ? '#8B1A1A' : '#f1f5f9'}`, background: dia ? '#fff' : '#fafbfc', padding: 8 }}>
                  {dia && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: esHoy ? 800 : 600, color: esHoy ? '#8B1A1A' : '#475569', marginBottom: 4 }}>{dia}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {cursos.slice(0, 3).map(c => (
                          <button key={c.id} onClick={() => verDetalle(c)}
                            style={{ background: `${COLORES_ESTADO[c.estado]}15`, color: COLORES_ESTADO[c.estado], border: 'none', borderRadius: 5, padding: '3px 6px', fontSize: 10, fontWeight: 600, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.curso_nombre}
                          </button>
                        ))}
                        {cursos.length > 3 && <span style={{ fontSize: 10, color: '#94a3b8' }}>+{cursos.length - 3} más</span>}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                {['Fecha', 'Curso', 'Empresa / Cliente', 'Asistentes', 'Origen', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {confirmados.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay cursos confirmados aún</td></tr>
              )}
              {confirmados.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{new Date(c.fecha_inicio).toLocaleDateString('es-MX')}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{c.curso_nombre}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{c.empresa_nombre || c.participante_nombre || '—'}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{c.num_participantes}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                      {c.origen === 'orden_compra' ? 'Orden de compra' : c.origen === 'proximo_curso' ? 'Próximo curso' : 'Programado'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: `${COLORES_ESTADO[c.estado]}15`, color: COLORES_ESTADO[c.estado], padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{c.estado}</span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <button onClick={() => verDetalle(c)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }} onClick={() => setDetalle(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{detalle.curso_nombre}</h3>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{detalle.empresa_nombre || detalle.participante_nombre}</p>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Fecha de inicio</div>
                <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 700 }}>{new Date(detalle.fecha_inicio).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              </div>
              <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Asistentes</div>
                <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 700 }}>{detalle.num_participantes} persona(s)</div>
              </div>
              {detalle.id_compra && (
                <div style={{ background: '#f9f0f0', borderRadius: 8, padding: '12px 14px', gridColumn: '1/-1' }}>
                  <div style={{ color: '#64748b', fontSize: 11 }}>ID de compra</div>
                  <code style={{ color: '#8B1A1A', fontSize: 14, fontWeight: 700 }}>{detalle.id_compra}</code>
                </div>
              )}
            </div>

            {/* Lista de asistentes */}
            {asistentes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>👥 Asistentes inscritos</h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {asistentes.map(a => (
                    <div key={a.id} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#1e293b', fontSize: 13, fontWeight: 500 }}>{a.empleado_nombre}</span>
                      <span style={{ background: a.estado === 'completado' ? '#f0fdf4' : '#fef9c3', color: a.estado === 'completado' ? '#059669' : '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{a.estado}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cambiar estado */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>CAMBIAR ESTADO</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['confirmado', 'en_curso', 'completado', 'cancelado'].map(est => (
                  <button key={est} onClick={() => cambiarEstado(detalle, est)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: `2px solid ${detalle.estado === est ? '#8B1A1A' : '#e2e8f0'}`, background: detalle.estado === est ? '#f9f0f0' : '#fff', color: detalle.estado === est ? '#8B1A1A' : '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>
                    {est.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => eliminar(detalle)} style={{ width: '100%', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🗑 Eliminar del calendario
            </button>
          </div>
        </div>
      )}

      {modalProgramar && (
        <ModalProgramarCurso
          cursos={cursos} empresas={empresas} participantes={participantes}
          onClose={() => setModalProgramar(false)}
          onDone={() => { setModalProgramar(false); cargar() }}
        />
      )}
    </div>
  )
}

// ─── Modal: programar curso manualmente ───────────────────────
function ModalProgramarCurso({ cursos, empresas, participantes, onClose, onDone }) {
  const [tipo, setTipo] = useState('empresa') // 'empresa' o 'abierto'
  const [cursoId, setCursoId] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('10:00')
  const [seleccionados, setSeleccionados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [saving, setSaving] = useState(false)

  // Lista de alumnos a mostrar según tipo
  let alumnosDisponibles = participantes
  if (tipo === 'empresa' && empresaId) {
    alumnosDisponibles = participantes.filter(p => p.empresa_id === empresaId || p.registrado_por_empresa === empresaId)
  }
  alumnosDisponibles = alumnosDisponibles.filter(p =>
    `${p.nombre} ${p.id_empleado || ''} ${p.correo || ''}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  function toggle(id) {
    setSeleccionados(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  async function guardar() {
    const curso = cursos.find(c => c.id === cursoId)
    if (!curso) { alert('Selecciona un curso'); return }
    if (!fecha) { alert('Selecciona la fecha del curso'); return }
    if (tipo === 'empresa' && !empresaId) { alert('Selecciona la empresa'); return }
    if (seleccionados.length === 0) { alert('Selecciona al menos un alumno'); return }
    setSaving(true)
    try {
      const empresa = empresas.find(e => e.id === empresaId)
      // 1. Crear el curso confirmado
      await supabase.from('cursos_confirmados').insert({
        curso_id: curso.id, curso_nombre: curso.nombre,
        empresa_id: tipo === 'empresa' ? empresaId : null,
        empresa_nombre: tipo === 'empresa' ? empresa?.nombre : 'Curso abierto HCD',
        fecha_inicio: fecha, hora,
        num_participantes: seleccionados.length,
        origen: tipo === 'empresa' ? 'programado_admin' : 'programado_admin',
        modalidad: 'zoom', estado: 'confirmado',
        notas: tipo === 'abierto' ? 'Curso abierto creado por HCD' : null
      })

      // 2. Crear asignaciones para cada alumno + dar acceso al examen
      const rows = seleccionados.map(pid => {
        const p = participantes.find(x => x.id === pid)
        return {
          empresa_id: p?.empresa_id || p?.registrado_por_empresa || null,
          empleado_id: pid, empleado_nombre: p?.nombre,
          curso_id: curso.id, curso_nombre: curso.nombre, tipo: 'curso',
          modalidad_asignacion: 'zoom', fecha_programada: fecha,
          estado: 'asignado', notas: 'Inscrito manualmente por admin'
        }
      })
      await supabase.from('asignaciones').insert(rows)
      for (const pid of seleccionados) {
        await supabase.from('participantes').update({ acceso_examen: true }).eq('id', pid)
      }

      alert(`✅ Curso programado para ${new Date(fecha).toLocaleDateString('es-MX')} con ${seleccionados.length} alumno(s).`)
      onDone()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 600, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Programar curso</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Da de alta un curso y selecciona quiénes asistirán</p>

        {/* Tipo de curso */}
        <label style={lbl}>¿Qué tipo de curso es?</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[['empresa', '🏢 Para una empresa', 'Le impartes a una empresa específica'], ['abierto', '🌐 Curso abierto HCD', 'Inscribes a cualquier alumno']].map(([v, l, d]) => (
            <button key={v} onClick={() => { setTipo(v); setSeleccionados([]); setEmpresaId('') }}
              style={{ flex: 1, padding: '12px', border: `2px solid ${tipo === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 10, background: tipo === v ? '#f9f0f0' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: tipo === v ? '#8B1A1A' : '#475569' }}>{l}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{d}</div>
            </button>
          ))}
        </div>

        {/* Curso */}
        <label style={lbl}>Curso</label>
        <select value={cursoId} onChange={e => setCursoId(e.target.value)} style={inp}>
          <option value="">— Selecciona un curso —</option>
          {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        {/* Empresa (solo si tipo empresa) */}
        {tipo === 'empresa' && (
          <>
            <label style={lbl}>Empresa</label>
            <select value={empresaId} onChange={e => { setEmpresaId(e.target.value); setSeleccionados([]) }} style={inp}>
              <option value="">— Selecciona la empresa —</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </>
        )}

        {/* Fecha y hora */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Fecha del curso *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Hora</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inp} />
          </div>
        </div>

        {/* Selección de alumnos */}
        <label style={lbl}>Inscribir alumnos ({seleccionados.length} seleccionados)</label>
        {tipo === 'empresa' && !empresaId ? (
          <p style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>Primero selecciona una empresa para ver sus empleados.</p>
        ) : (
          <>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar alumno por nombre, ID o correo..."
              style={{ ...inp, marginBottom: 8 }} />
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 240, overflowY: 'auto' }}>
              {alumnosDisponibles.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13, padding: 16, textAlign: 'center' }}>No hay alumnos {tipo === 'empresa' ? 'en esta empresa' : 'registrados'}.</p>
              ) : (
                alumnosDisponibles.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: seleccionados.includes(p.id) ? '#f9f0f0' : '#fff' }}>
                    <input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.nombre}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {p.id_empleado} · {p.correo} · {(p.empresa_id || p.registrado_por_empresa) ? 'Empresa' : 'Individual'}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Programando...' : 'Programar curso'}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

const navBtn = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#475569', cursor: 'pointer', fontWeight: 600 }
