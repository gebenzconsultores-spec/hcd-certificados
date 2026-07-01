import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function AdminCursosConfirmados() {
  const [confirmados, setConfirmados] = useState([])
  const [diasCurso, setDiasCurso] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('calendario')
  const [mesActual, setMesActual] = useState(new Date())
  const [detalle, setDetalle] = useState(null)
  const [modalProgramar, setModalProgramar] = useState(false)
  const [modalEditarDias, setModalEditarDias] = useState(null)
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
    const cursos = data || []
    // Calcular el número REAL de asistentes de cada curso (asignaciones vivas)
    const { data: todasAsigs } = await supabase.from('asignaciones').select('id_compra, curso_nombre, fecha_programada')
    const asigs = todasAsigs || []
    const conConteo = cursos.map(c => {
      let real
      if (c.id_compra) {
        real = asigs.filter(a => a.id_compra === c.id_compra).length
      } else {
        real = asigs.filter(a => a.curso_nombre === c.curso_nombre && a.fecha_programada === c.fecha_inicio).length
      }
      return { ...c, num_participantes: real }
    })
    setConfirmados(conConteo)
    // Cargar los días de cada curso (para mostrarlos en el calendario)
    try {
      const { data: dias } = await supabase.from('dias_curso').select('*')
      setDiasCurso(dias || [])
    } catch (_) { setDiasCurso([]) }
    setLoading(false)
  }

  async function verDetalle(curso) {
    setDetalle(curso)
    await cargarAsistentes(curso)
  }

  async function cargarAsistentes(curso) {
    let data = []
    if (curso.id_compra) {
      const r = await supabase.from('asignaciones').select('*').eq('id_compra', curso.id_compra)
      data = r.data || []
    } else {
      // Por curso + fecha (convocatorias y programados manual)
      const r = await supabase.from('asignaciones').select('*').eq('curso_nombre', curso.curso_nombre).eq('fecha_programada', curso.fecha_inicio)
      data = r.data || []
    }
    setAsistentes(data)
  }

  async function cambiarEstado(curso, estado) {
    await supabase.from('cursos_confirmados').update({ estado }).eq('id', curso.id)
    await cargar()
    if (detalle?.id === curso.id) setDetalle({ ...detalle, estado })
  }

  // REPROGRAMAR: cambia la fecha en el calendario, asignaciones e inscripciones
  async function reprogramar(curso, nuevaFecha) {
    if (!nuevaFecha) return
    try {
      // 1. Actualizar el curso en el calendario
      await supabase.from('cursos_confirmados').update({ fecha_inicio: nuevaFecha }).eq('id', curso.id)
      // 2. Actualizar asignaciones (lo que ven los portales)
      if (curso.id_compra) {
        await supabase.from('asignaciones').update({ fecha_programada: nuevaFecha }).eq('id_compra', curso.id_compra)
      } else {
        await supabase.from('asignaciones').update({ fecha_programada: nuevaFecha }).eq('curso_nombre', curso.curso_nombre).eq('fecha_programada', curso.fecha_inicio)
      }
      // 3. Actualizar la convocatoria si existe (por nombre+fecha)
      await supabase.from('proximos_cursos').update({ fecha: nuevaFecha }).eq('curso_nombre', curso.curso_nombre).eq('fecha', curso.fecha_inicio)
      // 4. Actualizar inscripciones
      await supabase.from('inscripciones').update({ fecha: nuevaFecha }).eq('curso_nombre', curso.curso_nombre).eq('fecha', curso.fecha_inicio)
      // 5. Actualizar compras (fecha del curso)
      if (curso.id_compra) await supabase.from('compras').update({ fecha_curso: nuevaFecha }).eq('id_compra', curso.id_compra)
      // 6. Notificar
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'programacion', titulo: 'Curso reprogramado',
          mensaje: `${curso.curso_nombre} se reprogramó al ${new Date(nuevaFecha).toLocaleDateString('es-MX')}`,
          link: '/admin/confirmados'
        })
      } catch (_) {}

      alert(`✅ Curso reprogramado al ${new Date(nuevaFecha).toLocaleDateString('es-MX')}. Se actualizó en todos los portales.`)
      setDetalle(null)
      await cargar()
    } catch (e) {
      alert('Error al reprogramar: ' + (e.message || ''))
    }
  }

  // DAR DE BAJA a un asistente del curso
  async function darDeBaja(curso, asistente) {
    if (!window.confirm(`¿Dar de baja a "${asistente.empleado_nombre}" de este curso?`)) return
    try {
      // 1. Borrar la asignación
      await supabase.from('asignaciones').delete().eq('id', asistente.id)
      // 2. Quitar acceso al examen
      if (asistente.empleado_id) {
        await supabase.from('participantes').update({ acceso_examen: false }).eq('id', asistente.empleado_id)
        // 3. Borrar su inscripción a la convocatoria
        await supabase.from('inscripciones').delete().eq('participante_id', asistente.empleado_id).eq('curso_nombre', curso.curso_nombre)
      }
      // 4. Reducir el contador de participantes y liberar cupo
      const nuevoNum = Math.max(0, (curso.num_participantes || 1) - 1)
      await supabase.from('cursos_confirmados').update({ num_participantes: nuevoNum }).eq('id', curso.id)
      // Liberar cupo en la convocatoria si existe
      const { data: conv } = await supabase.from('proximos_cursos').select('id, cupo_ocupado').eq('curso_nombre', curso.curso_nombre).eq('fecha', curso.fecha_inicio).maybeSingle()
      if (conv) await supabase.from('proximos_cursos').update({ cupo_ocupado: Math.max(0, (conv.cupo_ocupado || 1) - 1) }).eq('id', conv.id)

      await cargarAsistentes({ ...curso, num_participantes: nuevoNum })
      setDetalle(d => d ? { ...d, num_participantes: nuevoNum } : d)
      await cargar()
    } catch (e) {
      alert('Error al dar de baja: ' + (e.message || ''))
    }
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
    const resultado = []
    // 1. Cursos cuyo fecha_inicio es este día (cursos de 1 día o el inicio)
    confirmados.forEach(c => {
      if (c.fecha_inicio === fechaStr) resultado.push(c)
    })
    // 2. Días registrados en dias_curso (para cursos de varios días, incluye los días extra)
    diasCurso.forEach(d => {
      if (d.fecha === fechaStr) {
        // Buscar el curso confirmado al que pertenece
        const curso = confirmados.find(c => c.id === d.curso_confirmado_id)
        if (curso && curso.fecha_inicio !== fechaStr) {
          // Es un día adicional (no el inicio, que ya se agregó arriba)
          resultado.push({ ...curso, _esDiaExtra: true })
        } else if (!curso) {
          resultado.push({ id: d.id, curso_nombre: d.curso_nombre, fecha_inicio: d.fecha, estado: 'confirmado', _esDiaExtra: true })
        }
      }
    })
    return resultado
  }

  const COLORES_ESTADO = {
    confirmado: '#1d4ed8', en_curso: '#d97706', completado: '#059669', cancelado: '#94a3b8'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Calendario de cursos</h1>
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
            </div>

            {/* Días del curso */}
            {(() => {
              const dias = diasCurso.filter(d => d.curso_confirmado_id === detalle.id).sort((a, b) => a.fecha.localeCompare(b.fecha))
              return (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ color: '#1e40af', fontSize: 12, fontWeight: 700 }}>🗓️ DÍAS DEL CURSO ({dias.length || 1})</div>
                    <button onClick={() => setModalEditarDias(detalle)} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✏️ Editar días</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dias.length > 0 ? dias.map(d => (
                      <span key={d.id} style={{ background: '#fff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                        {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    )) : (
                      <span style={{ background: '#fff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                        {new Date(detalle.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} (día único)
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {detalle.id_compra && (
              <div style={{ background: '#f9f0f0', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>ID de compra</div>
                <code style={{ color: '#8B1A1A', fontSize: 14, fontWeight: 700 }}>{detalle.id_compra}</code>
              </div>
            )}

            {/* Lista de asistentes */}
            {asistentes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>👥 Asistentes inscritos ({asistentes.length})</h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {asistentes.map(a => (
                    <div key={a.id} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#1e293b', fontSize: 13, fontWeight: 500, flex: 1 }}>{a.empleado_nombre}</span>
                      <span style={{ background: a.estado === 'completado' ? '#f0fdf4' : '#fef9c3', color: a.estado === 'completado' ? '#059669' : '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{a.estado}</span>
                      <button onClick={() => darDeBaja(detalle, a)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Dar de baja</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reprogramar */}
            <div style={{ marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: '#1e40af', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📅 REPROGRAMAR CURSO</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" id={`reprog-${detalle.id}`} defaultValue={detalle.fecha_inicio}
                  style={{ flex: 1, border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                <button onClick={() => {
                  const val = document.getElementById(`reprog-${detalle.id}`).value
                  reprogramar(detalle, val)
                }} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Reprogramar
                </button>
              </div>
              <p style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>La nueva fecha se actualiza para todos los inscritos y en sus portales.</p>
            </div>

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

      {modalEditarDias && (
        <ModalEditarDias
          curso={modalEditarDias}
          diasActuales={diasCurso.filter(d => d.curso_confirmado_id === modalEditarDias.id)}
          onClose={() => setModalEditarDias(null)}
          onDone={() => { setModalEditarDias(null); setDetalle(null); cargar() }}
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
  const [tipoFechas, setTipoFechas] = useState('continuo') // 'continuo' o 'escalonado'
  const [numDias, setNumDias] = useState(1)
  const [diasEscalonados, setDiasEscalonados] = useState([]) // array de fechas (strings)
  const [nuevoDia, setNuevoDia] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [saving, setSaving] = useState(false)

  // Calcular los días del curso según el tipo
  function calcularDias() {
    if (tipoFechas === 'continuo') {
      if (!fecha) return []
      const dias = []
      const base = new Date(fecha + 'T00:00:00')
      for (let i = 0; i < numDias; i++) {
        const d = new Date(base)
        d.setDate(base.getDate() + i)
        dias.push(d.toISOString().split('T')[0])
      }
      return dias
    } else {
      return [...diasEscalonados].sort()
    }
  }

  function agregarDiaEscalonado() {
    if (!nuevoDia) return
    if (diasEscalonados.includes(nuevoDia)) { alert('Ese día ya está agregado'); return }
    setDiasEscalonados(d => [...d, nuevoDia].sort())
    setNuevoDia('')
  }
  function quitarDiaEscalonado(dia) {
    setDiasEscalonados(d => d.filter(x => x !== dia))
  }

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
    const dias = calcularDias()
    if (dias.length === 0) { alert('Define al menos un día para el curso'); return }
    if (tipo === 'empresa' && !empresaId) { alert('Selecciona la empresa'); return }
    if (seleccionados.length === 0) { alert('Selecciona al menos un alumno'); return }
    setSaving(true)
    try {
      const empresa = empresas.find(e => e.id === empresaId)
      const fechaInicio = dias[0]
      const fechaFin = dias[dias.length - 1]

      // 1. Crear el curso confirmado (con inicio, fin, tipo y num de días)
      const { data: confirmado } = await supabase.from('cursos_confirmados').insert({
        curso_id: curso.id, curso_nombre: curso.nombre,
        empresa_id: tipo === 'empresa' ? empresaId : null,
        empresa_nombre: tipo === 'empresa' ? empresa?.nombre : 'Curso abierto HCD',
        fecha_inicio: fechaInicio, fecha_fin: fechaFin, hora,
        num_participantes: seleccionados.length,
        tipo_fechas: tipoFechas, num_dias: dias.length,
        origen: 'programado_admin',
        modalidad: 'zoom', estado: 'confirmado',
        notas: tipo === 'abierto' ? 'Curso abierto creado por HCD' : null
      }).select().single()

      // 2. Crear un registro por cada DÍA del curso (para el calendario)
      if (confirmado) {
        const diasRows = dias.map(d => ({
          curso_confirmado_id: confirmado.id,
          curso_nombre: curso.nombre,
          fecha: d, hora
        }))
        await supabase.from('dias_curso').insert(diasRows)
      }

      // 3. Crear asignaciones para cada alumno + dar acceso al examen
      const rows = seleccionados.map(pid => {
        const p = participantes.find(x => x.id === pid)
        return {
          empresa_id: p?.empresa_id || p?.registrado_por_empresa || null,
          empleado_id: pid, empleado_nombre: p?.nombre,
          curso_id: curso.id, curso_nombre: curso.nombre, tipo: 'curso',
          modalidad_asignacion: 'zoom', fecha_programada: fechaInicio, fecha_fin: fechaFin,
          estado: 'asignado', notas: 'Inscrito manualmente por admin'
        }
      })
      await supabase.from('asignaciones').insert(rows)
      for (const pid of seleccionados) {
        await supabase.from('participantes').update({ acceso_examen: true }).eq('id', pid)
      }

      const textoFechas = dias.length === 1
        ? new Date(fechaInicio).toLocaleDateString('es-MX')
        : `${dias.length} días (del ${new Date(fechaInicio).toLocaleDateString('es-MX')} al ${new Date(fechaFin).toLocaleDateString('es-MX')})`
      alert(`✅ Curso programado: ${textoFechas} con ${seleccionados.length} alumno(s).`)
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

        {/* Tipo de fechas: continuo o escalonado */}
        <label style={lbl}>¿Cómo son las fechas del curso?</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {[['continuo', '📆 Días continuos', 'ej. 8, 9 y 10 seguidos'], ['escalonado', '🗓️ Fechas escalonadas', 'días sueltos, ej. 8, 15 y 22']].map(([v, l, d]) => (
            <button key={v} type="button" onClick={() => setTipoFechas(v)}
              style={{ flex: 1, padding: '10px', border: `2px solid ${tipoFechas === v ? '#1d4ed8' : '#e2e8f0'}`, borderRadius: 10, background: tipoFechas === v ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tipoFechas === v ? '#1d4ed8' : '#475569' }}>{l}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{d}</div>
            </button>
          ))}
        </div>

        {tipoFechas === 'continuo' ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Fecha de inicio *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>N° de días *</label>
              <input type="number" min={1} max={30} value={numDias} onChange={e => setNumDias(Math.max(1, Number(e.target.value)))} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inp} />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Agregar día</label>
                <input type="date" value={nuevoDia} onChange={e => setNuevoDia(e.target.value)} style={inp} />
              </div>
              <div style={{ width: 110 }}>
                <label style={lbl}>Hora</label>
                <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inp} />
              </div>
              <button type="button" onClick={agregarDiaEscalonado} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', height: 40 }}>+ Día</button>
            </div>
            {diasEscalonados.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {diasEscalonados.map(d => (
                  <span key={d} style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    <button type="button" onClick={() => quitarDiaEscalonado(d)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>Agrega cada día que requiere el curso (aunque estén en distintas semanas). Todos quedan ligados al mismo curso.</p>
          </div>
        )}

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

// ─── Modal: editar los días de un curso existente ─────────────
function ModalEditarDias({ curso, diasActuales, onClose, onDone }) {
  const inicial = diasActuales.length > 0
    ? diasActuales.map(d => d.fecha).sort()
    : (curso.fecha_inicio ? [curso.fecha_inicio] : [])
  const [dias, setDias] = useState(inicial)
  const [nuevoDia, setNuevoDia] = useState('')
  const [hora, setHora] = useState(curso.hora || '10:00')
  const [saving, setSaving] = useState(false)

  function agregar() {
    if (!nuevoDia) return
    if (dias.includes(nuevoDia)) { alert('Ese día ya está'); return }
    setDias(d => [...d, nuevoDia].sort())
    setNuevoDia('')
  }
  function quitar(d) {
    if (dias.length === 1) { alert('Debe quedar al menos un día'); return }
    setDias(arr => arr.filter(x => x !== d))
  }

  async function guardar() {
    if (dias.length === 0) { alert('Agrega al menos un día'); return }
    setSaving(true)
    try {
      const fechaInicio = dias[0]
      const fechaFin = dias[dias.length - 1]

      // 1. Borrar los días anteriores y volver a crearlos
      await supabase.from('dias_curso').delete().eq('curso_confirmado_id', curso.id)
      const diasRows = dias.map(d => ({
        curso_confirmado_id: curso.id,
        curso_nombre: curso.curso_nombre,
        fecha: d, hora
      }))
      await supabase.from('dias_curso').insert(diasRows)

      // 2. Actualizar el curso confirmado (inicio, fin, num días)
      await supabase.from('cursos_confirmados').update({
        fecha_inicio: fechaInicio, fecha_fin: fechaFin,
        num_dias: dias.length,
        tipo_fechas: dias.length > 1 ? 'multiple' : 'continuo'
      }).eq('id', curso.id)

      // 3. Actualizar las asignaciones (inicio y fin que ve la empresa)
      await supabase.from('asignaciones').update({ fecha_programada: fechaInicio, fecha_fin: fechaFin })
        .eq('curso_nombre', curso.curso_nombre).eq('fecha_programada', curso.fecha_inicio)

      alert(`✅ Días actualizados: ${dias.length} día(s), del ${new Date(fechaInicio).toLocaleDateString('es-MX')} al ${new Date(fechaFin).toLocaleDateString('es-MX')}.`)
      onDone()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Editar días del curso</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>{curso.curso_nombre}</p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Agregar día</label>
            <input type="date" value={nuevoDia} onChange={e => setNuevoDia(e.target.value)} style={inp} />
          </div>
          <div style={{ width: 100 }}>
            <label style={lbl}>Hora</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inp} />
          </div>
          <button type="button" onClick={agregar} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', height: 40 }}>+ Día</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {dias.map(d => (
            <span key={d} style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
              <button type="button" onClick={() => quitar(d)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 15, padding: 0 }}>×</button>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Guardando...' : 'Guardar días'}</button>
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

const navBtn = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#475569', cursor: 'pointer', fontWeight: 600 }
