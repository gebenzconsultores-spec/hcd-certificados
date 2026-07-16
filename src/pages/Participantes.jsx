import { useEffect, useState } from 'react'
import { supabase, crearParticipante, getEmpresas } from '../lib/supabase'

export default function Participantes() {
  const [participantes, setParticipantes] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [cursosPorParticipante, setCursosPorParticipante] = useState({})
  const [modal, setModal] = useState(false)
  const [modalEstatus, setModalEstatus] = useState(null)
  const [modalAsignar, setModalAsignar] = useState(null)
  const [cursosDisponibles, setCursosDisponibles] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [form, setForm] = useState({
    nombre: '', correo: '', whatsapp: '', puesto: '', empresa_id: '',
    empresa_manual: '', tipo: 'empresa', es_universitario: false, universidad: '', carrera: ''
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalEditar, setModalEditar] = useState(null)

  useEffect(() => {
    cargar()
    getEmpresas().then(setEmpresas)
    // Cargar SOLO los cursos de Próximos cursos (convocatorias abiertas con su número 499+)
    supabase.from('proximos_cursos').select('*').order('fecha', { ascending: false }).then(({ data }) => setCursosDisponibles(data || []))
  }, [])

  async function cargar() {
    setLoading(true)
    // Traer TODOS los participantes (sin depender del join, que puede fallar)
    let parts = []
    const conJoin = await supabase
      .from('participantes')
      .select('*, empresa:empresas(nombre)')
      .order('created_at', { ascending: false })

    if (conJoin.error || !conJoin.data) {
      // Si el join falla, cargar sin join
      const sinJoin = await supabase
        .from('participantes')
        .select('*')
        .order('created_at', { ascending: false })
      parts = sinJoin.data || []
      // Traer nombres de empresas por separado
      const { data: emps } = await supabase.from('empresas').select('id, nombre')
      const mapaEmp = {}
      ;(emps || []).forEach(e => { mapaEmp[e.id] = e.nombre })
      parts = parts.map(p => ({ ...p, empresa: p.empresa_id ? { nombre: mapaEmp[p.empresa_id] } : (p.registrado_por_empresa ? { nombre: mapaEmp[p.registrado_por_empresa] } : null) }))
    } else {
      parts = conJoin.data
    }

    setParticipantes(parts || [])

    // Traer certificados y asignaciones para contar cursos por participante
    const [{ data: certs }, { data: asigs }] = await Promise.all([
      supabase.from('certificados').select('participante_id, nombre_curso'),
      supabase.from('asignaciones').select('empleado_id, curso_nombre, microcurso_titulo, estado, fecha_programada')
    ])

    const mapa = {}
    ;(certs || []).forEach(c => {
      if (!c.participante_id) return
      if (!mapa[c.participante_id]) mapa[c.participante_id] = { tomados: [], asignados: [] }
      mapa[c.participante_id].tomados.push(c.nombre_curso)
    })
    ;(asigs || []).forEach(a => {
      if (!a.empleado_id) return
      if (!mapa[a.empleado_id]) mapa[a.empleado_id] = { tomados: [], asignados: [] }
      const nombre = a.curso_nombre || a.microcurso_titulo
      // Si ya está en tomados, no duplicar; si está completado, va a tomados
      if (a.estado === 'completado') {
        if (!mapa[a.empleado_id].tomados.includes(nombre)) mapa[a.empleado_id].tomados.push(nombre)
      } else {
        mapa[a.empleado_id].asignados.push({ nombre, fecha: a.fecha_programada })
      }
    })
    setCursosPorParticipante(mapa)
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function verOGenerarPassword(p) {
    if (p.portal_password) {
      const nueva = window.confirm(`${p.nombre}\nID: ${p.id_empleado || '—'}\nContraseña actual: ${p.portal_password}\n\n¿Generar una NUEVA contraseña? (la anterior dejará de servir)`)
      if (!nueva) return
    }
    const pass = `HCD-${Math.floor(1000 + Math.random() * 9000)}`
    const { error } = await supabase.from('participantes').update({ portal_password: pass }).eq('id', p.id)
    if (error) { alert('No se pudo generar la contraseña: ' + error.message); return }
    await cargar()
    window.prompt(`Comparte estos datos con ${p.nombre} para entrar al portal de estudiante:\n\nID: ${p.id_empleado || ''}\nContraseña (cópiala):`, pass)
  }

  async function guardar() {
    if (!form.nombre || !form.correo) return
    setSaving(true)
    try {
      // Generar ID de empleado sin duplicados (función de BD o máximo)
      let id_empleado
      try {
        const { data: idData } = await supabase.rpc('siguiente_id', { p_prefijo: 'ALU', p_tabla: 'participantes', p_columna: 'id_empleado' })
        id_empleado = idData
      } catch (_) {}
      if (!id_empleado) {
        const { data: existentes } = await supabase.from('participantes').select('id_empleado').not('id_empleado', 'is', null)
        let maxNum = 0
        ;(existentes || []).forEach(e => {
          const m = (e.id_empleado || '').match(/ALU-(\d+)/)
          if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
        })
        id_empleado = `ALU-${String(maxNum + 1).padStart(4, '0')}`
      }
      const datosParticipante = {
        nombre: form.nombre,
        correo: form.correo,
        whatsapp: form.whatsapp,
        puesto: form.puesto,
        id_empleado,
        empresa_id: form.tipo === 'empresa' ? form.empresa_id || null : null,
        registrado_por_empresa: form.tipo === 'empresa' ? form.empresa_id || null : null,
        empresa_manual: form.tipo === 'individual' ? form.empresa_manual : null,
        tipo: form.tipo,
        es_universitario: form.es_universitario,
        universidad: form.es_universitario ? form.universidad : null,
        carrera: form.es_universitario ? form.carrera : null,
      }
      let { error: errIns } = await supabase.from('participantes').insert(datosParticipante)
      // Si el ID chocó, reintentar con el siguiente número
      if (errIns && (errIns.message || '').includes('duplicate')) {
        const m = id_empleado.match(/ALU-(\d+)/)
        const siguiente = `ALU-${String((m ? parseInt(m[1], 10) : 0) + 1).padStart(4, '0')}`
        datosParticipante.id_empleado = siguiente
        const reintento = await supabase.from('participantes').insert(datosParticipante)
        errIns = reintento.error
      }
      if (errIns) { alert('No se pudo registrar: ' + errIns.message); setSaving(false); return }
      await cargar()
      setModal(false)
      setForm({ nombre: '', correo: '', whatsapp: '', puesto: '', empresa_id: '', empresa_manual: '', tipo: 'empresa', es_universitario: false, universidad: '', carrera: '' })
    } catch (e) {
      alert('No se pudo registrar: ' + (e.message || 'error'))
    } finally { setSaving(false) }
  }

  async function eliminar(p) {
    if (!window.confirm(`¿ELIMINAR PERMANENTEMENTE a "${p.nombre}"?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await supabase.from('participantes').delete().eq('id', p.id)
      await cargar()
    } catch (e) {
      alert('No se pudo eliminar: ' + (e.message || 'tiene registros vinculados'))
    }
  }

  const filtrados = participantes
    .filter(p => {
      if (filtro === 'empresa') return p.tipo === 'empresa' || p.registrado_por_empresa
      if (filtro === 'individual') return p.tipo === 'individual' || p.tipo === 'individual'
      return true
    })
    .filter(p => `${p.nombre} ${p.correo} ${p.id_empleado || ''} ${p.empresa?.nombre || ''}`.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Participantes</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Personas registradas, incluidos empleados dados de alta por empresas</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Nuevo participante</button>
      </div>

      {/* Filtros y búsqueda */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['todos', 'Todos'], ['empresa', 'De empresa'], ['individual', 'Individuales']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            style={{ padding: '6px 16px', borderRadius: 20, border: `2px solid ${filtro === v ? '#8B1A1A' : '#e2e8f0'}`, background: filtro === v ? '#f9f0f0' : '#fff', color: filtro === v ? '#8B1A1A' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔍 Buscar nombre, correo, ID, empresa..."
          style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 14px', fontSize: 13, outline: 'none', minWidth: 280 }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['ID', 'Nombre', 'Empresa', 'Estatus', 'Tipo', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</td></tr>}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay participantes</td></tr>
            )}
            {filtrados.map(p => {
              const cursos = cursosPorParticipante[p.id] || { tomados: [], asignados: [] }
              const totalCursos = cursos.tomados.length + cursos.asignados.length
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px' }}>
                    {p.id_empleado ? <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{p.id_empleado}</code> : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{p.nombre}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>{p.correo}{p.puesto ? ` · ${p.puesto}` : ''}</div>
                  </td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>
                    {p.empresa?.nombre || p.empresa_manual || (p.es_universitario ? p.universidad : '—')}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    {totalCursos === 0 ? (
                      <span style={{ color: '#cbd5e1', fontSize: 12 }}>Ninguno</span>
                    ) : (
                      <button onClick={() => setModalEstatus({ participante: p, cursos })}
                        style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {cursos.tomados.length} tomado{cursos.tomados.length !== 1 ? 's' : ''} · {cursos.asignados.length} por tomar
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{
                      background: (p.tipo === 'empresa' || p.registrado_por_empresa) ? '#eff6ff' : p.es_universitario ? '#f5f3ff' : '#f0fdf4',
                      color: (p.tipo === 'empresa' || p.registrado_por_empresa) ? '#1d4ed8' : p.es_universitario ? '#7c3aed' : '#059669',
                      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600
                    }}>
                      {(p.tipo === 'empresa' || p.registrado_por_empresa) ? 'Empresa' : p.es_universitario ? 'Universitario' : 'Individual'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModalAsignar(p)} style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>➕ Asignar curso</button>
                      <button onClick={() => verOGenerarPassword(p)} style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde047', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>🔑 {p.portal_password ? 'Contraseña' : 'Generar clave'}</button>
                      <button onClick={() => setModalEditar({ ...p })} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>✏️ Editar</button>
                      <button onClick={() => eliminar(p)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal estatus de cursos */}
      {modalEditar && (
        <ModalEditarParticipante
          participante={modalEditar}
          empresas={empresas}
          onClose={() => setModalEditar(null)}
          onDone={() => { setModalEditar(null); cargar() }}
        />
      )}

      {modalAsignar && (
        <ModalAsignarCurso
          participante={modalAsignar}
          cursos={cursosDisponibles}
          onClose={() => setModalAsignar(null)}
          onDone={() => { setModalAsignar(null); cargar() }}
        />
      )}

      {modalEstatus && (
        <div style={overlayStyle} onClick={() => setModalEstatus(null)}>
          <div style={{ ...modalStyle, width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{modalEstatus.participante.nombre}</h3>
                {modalEstatus.participante.id_empleado && <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{modalEstatus.participante.id_empleado}</code>}
              </div>
              <button onClick={() => setModalEstatus(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginBottom: 8 }}>✓ Cursos tomados ({modalEstatus.cursos.tomados.length})</h4>
              {modalEstatus.cursos.tomados.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Ninguno</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modalEstatus.cursos.tomados.map((c, i) => (
                    <div key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', color: '#15803d', fontSize: 13 }}>{c}</div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>⏳ Cursos por tomar ({modalEstatus.cursos.asignados.length})</h4>
              {modalEstatus.cursos.asignados.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Ninguno</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modalEstatus.cursos.asignados.map((c, i) => (
                    <div key={i} style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', color: '#92400e', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{typeof c === 'string' ? c : c.nombre}</span>
                      {typeof c === 'object' && c.fecha && <span style={{ fontSize: 11 }}>📅 {new Date(c.fecha).toLocaleDateString('es-MX')}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setModalEstatus(null)} style={{ ...btnGhost, width: '100%', marginTop: 20 }}>Cerrar</button>
          </div>
        </div>
      )}

      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={{ ...modalStyle, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Nuevo participante</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[['empresa', 'De empresa'], ['individual', 'Individual']].map(([v, l]) => (
                <button key={v} onClick={() => f('tipo')(v)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${form.tipo === v ? '#8B1A1A' : '#e2e8f0'}`, background: form.tipo === v ? '#f9f0f0' : '#fff', color: form.tipo === v ? '#8B1A1A' : '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {l}
                </button>
              ))}
            </div>

            <Field label="Nombre completo *" value={form.nombre} onChange={f('nombre')} placeholder="Nombre completo" />
            <Field label="Correo electrónico *" type="email" value={form.correo} onChange={f('correo')} placeholder="correo@ejemplo.com" />
            <Field label="WhatsApp" value={form.whatsapp} onChange={f('whatsapp')} placeholder="222 123 4567" />

            {form.tipo === 'empresa' && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Empresa</label>
                <select value={form.empresa_id} onChange={e => f('empresa_id')(e.target.value)} style={inputStyle}>
                  <option value="">— Selecciona empresa —</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            )}
            {form.tipo === 'individual' && (
              <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Se le generará un ID de acceso (ALU-XXXX) para el portal de estudiante.</p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.nombre || !form.correo} style={btnPrimary}>{saving ? 'Guardando...' : 'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}

// ─── Modal: asignar curso (de Próximos cursos) a un participante ───
function ModalAsignarCurso({ participante, cursos, onClose, onDone }) {
  const [proximoId, setProximoId] = useState('')
  const [saving, setSaving] = useState(false)

  const proximo = cursos.find(c => c.id === proximoId)

  async function guardar() {
    if (!proximo) { alert('Selecciona un curso de la lista'); return }
    setSaving(true)
    try {
      const empresaId = participante.empresa_id || participante.registrado_por_empresa || null
      const esEmpresa = !!empresaId

      // 0. VALIDAR que no esté ya inscrito en este curso (evitar duplicados)
      const { data: yaAsig } = await supabase.from('asignaciones')
        .select('id').eq('empleado_id', participante.id).eq('curso_nombre', proximo.curso_nombre)
      if (yaAsig && yaAsig.length > 0) {
        alert(`${participante.nombre} ya está inscrito en "${proximo.curso_nombre}".`)
        setSaving(false)
        return
      }

      // 1. Inscribir en la convocatoria (tabla inscripciones)
      await supabase.from('inscripciones').insert({
        proximo_curso_id: proximo.id,
        curso_nombre: proximo.curso_nombre,
        fecha: proximo.fecha,
        participante_id: participante.id,
        participante_nombre: participante.nombre,
        participante_correo: participante.correo,
        empresa_id: empresaId,
        origen: esEmpresa ? 'empresa' : 'individual',
        estado: 'inscrito'
      })

      // 2. Crear la asignación (para que aparezca en su portal)
      await supabase.from('asignaciones').insert({
        empresa_id: empresaId,
        empleado_id: participante.id,
        empleado_nombre: participante.nombre,
        curso_id: proximo.curso_id, curso_nombre: proximo.curso_nombre, tipo: 'curso',
        modalidad_asignacion: 'zoom', fecha_programada: proximo.fecha,
        estado: 'asignado', notas: `Inscrito a convocatoria (Curso N° ${proximo.numero_certificado || ''})`
      })

      // 3. Dar acceso al examen
      await supabase.from('participantes').update({ acceso_examen: true }).eq('id', participante.id)

      // 4. Actualizar cupo de la convocatoria
      await supabase.from('proximos_cursos').update({ cupo_ocupado: (proximo.cupo_ocupado || 0) + 1 }).eq('id', proximo.id)

      // 5. Registrar/actualizar en el calendario de cursos
      try {
        const { data: existe } = await supabase.from('cursos_confirmados')
          .select('id, num_participantes').eq('curso_nombre', proximo.curso_nombre).eq('fecha_inicio', proximo.fecha).maybeSingle()
        if (existe) {
          await supabase.from('cursos_confirmados').update({ num_participantes: (existe.num_participantes || 0) + 1 }).eq('id', existe.id)
        } else {
          await supabase.from('cursos_confirmados').insert({
            curso_id: proximo.curso_id, curso_nombre: proximo.curso_nombre,
            empresa_id: empresaId,
            empresa_nombre: esEmpresa ? 'Empresa' : 'Individual',
            fecha_inicio: proximo.fecha, hora: proximo.hora, num_participantes: 1,
            origen: 'proximo_curso', modalidad: 'zoom', estado: 'confirmado', notas: 'Convocatoria HCD'
          })
        }
      } catch (_) {}

      alert(`✅ ${participante.nombre} inscrito en "${proximo.curso_nombre}" (Curso N° ${proximo.numero_certificado || ''}) para el ${new Date(proximo.fecha).toLocaleDateString('es-MX')}.`)
      onDone()
    } catch (e) {
      alert('Error al asignar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Inscribir a un curso</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
          A: <strong>{participante.nombre}</strong> {participante.id_empleado && `(${participante.id_empleado})`}
        </p>

        <label style={labelStyle}>Curso programado</label>
        {cursos.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>No hay cursos en Próximos cursos. Crea uno primero en Convocatorias.</p>
        ) : (
          <select value={proximoId} onChange={e => setProximoId(e.target.value)} style={inputStyle}>
            <option value="">— Selecciona un curso programado —</option>
            {cursos.map(c => (
              <option key={c.id} value={c.id}>
                {c.numero_certificado ? `N° ${c.numero_certificado} · ` : ''}{c.curso_nombre} — {new Date(c.fecha).toLocaleDateString('es-MX')}
              </option>
            ))}
          </select>
        )}

        {proximo && (
          <div style={{ background: '#f9f0f0', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
            <div style={{ fontSize: 13, color: '#8B1A1A', fontWeight: 700 }}>{proximo.numero_certificado ? `Curso N° ${proximo.numero_certificado}` : 'Curso'}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📅 {new Date(proximo.fecha).toLocaleDateString('es-MX')} · 🕐 {proximo.hora || '—'} · 🎥 Zoom</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving || !proximoId} style={btnPrimary}>{saving ? 'Inscribiendo...' : 'Inscribir'}</button>
        </div>
      </div>
    </div>
  )
}

function ModalAsignarCursoVIEJO({ participante, cursos, onClose, onDone }) {
  const [cursoId, setCursoId] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('10:00')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    const curso = cursos.find(c => c.id === cursoId)
    if (!curso) { alert('Selecciona un curso'); return }
    if (!fecha) { alert('Selecciona la fecha del curso'); return }
    setSaving(true)
    try {
      const empresaId = participante.empresa_id || participante.registrado_por_empresa || null
      await supabase.from('asignaciones').insert({
        empresa_id: empresaId,
        empleado_id: participante.id,
        empleado_nombre: participante.nombre,
        curso_id: curso.id, curso_nombre: curso.nombre, tipo: 'curso',
        modalidad_asignacion: 'zoom', fecha_programada: fecha,
        estado: 'asignado', notas: 'Asignado manualmente por admin'
      })
      await supabase.from('participantes').update({ acceso_examen: true }).eq('id', participante.id)
      alert('asignado')
      onDone()
    } catch (e) {
      alert('Error al asignar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Asignar curso</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
          A: <strong>{participante.nombre}</strong> {participante.id_empleado && `(${participante.id_empleado})`}
        </p>

        <label style={labelStyle}>Curso</label>
        <select value={cursoId} onChange={e => setCursoId(e.target.value)} style={inputStyle}>
          <option value="">— Selecciona un curso —</option>
          {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Fecha *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Hora</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={btnPrimary}>{saving ? 'Asignando...' : 'Asignar curso'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: editar datos de un participante ───────────────────
function ModalEditarParticipante({ participante, empresas, onClose, onDone }) {
  const [datos, setDatos] = useState({
    nombre: participante.nombre || '',
    correo: participante.correo || '',
    whatsapp: participante.whatsapp || '',
    puesto: participante.puesto || '',
    empresa_id: participante.empresa_id || participante.registrado_por_empresa || '',
    empresa_manual: participante.empresa_manual || '',
    universidad: participante.universidad || '',
    carrera: participante.carrera || '',
  })
  const [saving, setSaving] = useState(false)
  const esEmpresa = participante.tipo === 'empresa' || !!(participante.empresa_id || participante.registrado_por_empresa)

  const d = k => v => setDatos(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!datos.nombre) { alert('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const payload = {
        nombre: datos.nombre,
        correo: datos.correo,
        whatsapp: datos.whatsapp,
        puesto: datos.puesto,
        universidad: datos.universidad || null,
        carrera: datos.carrera || null,
      }
      // Permitir cambiar empresa (solo admin)
      if (esEmpresa && datos.empresa_id) {
        payload.empresa_id = datos.empresa_id
        payload.registrado_por_empresa = datos.empresa_id
      }
      if (!esEmpresa) payload.empresa_manual = datos.empresa_manual || null

      const { error } = await supabase.from('participantes').update(payload).eq('id', participante.id)
      if (error) { alert('No se pudo guardar: ' + error.message); setSaving(false); return }
      alert('✅ Datos actualizados. El cambio se refleja en el portal de la empresa o del estudiante.')
      onDone()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Editar participante</h3>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
          {participante.id_empleado && <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4 }}>{participante.id_empleado}</code>}
          {' '}· El ID y el tipo no se modifican.
        </p>

        <label style={labelStyle}>Nombre completo *</label>
        <input value={datos.nombre} onChange={e => d('nombre')(e.target.value)} style={inputStyle} />

        <label style={{ ...labelStyle, marginTop: 12 }}>Correo</label>
        <input value={datos.correo} onChange={e => d('correo')(e.target.value)} placeholder="correo@ejemplo.com" style={inputStyle} />

        <label style={{ ...labelStyle, marginTop: 12 }}>WhatsApp</label>
        <input value={datos.whatsapp} onChange={e => d('whatsapp')(e.target.value)} placeholder="2221234567" style={inputStyle} />

        <label style={{ ...labelStyle, marginTop: 12 }}>Puesto</label>
        <input value={datos.puesto} onChange={e => d('puesto')(e.target.value)} style={inputStyle} />

        {esEmpresa ? (
          <>
            <label style={{ ...labelStyle, marginTop: 12 }}>Empresa</label>
            <select value={datos.empresa_id} onChange={e => d('empresa_id')(e.target.value)} style={inputStyle}>
              <option value="">— Sin empresa —</option>
              {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
            </select>
          </>
        ) : (
          <>
            <label style={{ ...labelStyle, marginTop: 12 }}>Universidad (si aplica)</label>
            <input value={datos.universidad} onChange={e => d('universidad')(e.target.value)} style={inputStyle} />
            <label style={{ ...labelStyle, marginTop: 12 }}>Carrera (si aplica)</label>
            <input value={datos.carrera} onChange={e => d('carrera')(e.target.value)} style={inputStyle} />
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  )
}
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 520, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }
