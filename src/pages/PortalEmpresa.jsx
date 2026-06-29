import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const WA_SOPORTE = '522223549353'

export function EmpresaDashboard() {
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState(null)
  const [tab, setTab] = useState('resumen')
  const [empleados, setEmpleados] = useState([])
  const [cursos, setCursos] = useState([])
  const [microcursos, setMicrocursos] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [certificados, setCertificados] = useState([])
  const [loading, setLoading] = useState(true)

  // Días restantes de prueba
  const [diasRestantes, setDiasRestantes] = useState(null)
  const [pruebaVencida, setPruebaVencida] = useState(false)

  useEffect(() => {
    const data = sessionStorage.getItem('empresa_portal')
    if (!data) { navigate('/empresa/acceso'); return }
    const emp = JSON.parse(data)
    setEmpresa(emp)
    calcularPrueba(emp)
    cargar(emp)
  }, [])

  function calcularPrueba(emp) {
    if (emp.tipo_acceso === 'cliente') { setDiasRestantes(null); return }
    if (emp.fecha_fin_prueba) {
      const fin = new Date(emp.fecha_fin_prueba)
      const hoy = new Date()
      const dias = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
      setDiasRestantes(dias)
      setPruebaVencida(dias <= 0)
    }
  }

  async function cargar(emp) {
    setLoading(true)
    const [{ data: emps }, { data: curs }, { data: mc }, { data: asig }, { data: certs }] = await Promise.all([
      supabase.from('participantes').select('*').eq('registrado_por_empresa', emp.id).order('created_at', { ascending: false }),
      supabase.from('cursos').select('*, familia:familias(nombre,color,icono)').eq('activo', true).order('numero_curso', { ascending: false }),
      supabase.from('microcursos').select('*').eq('activo', true).order('orden'),
      supabase.from('asignaciones').select('*').eq('empresa_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('certificados').select('*').eq('empresa_id', emp.id)
    ])
    setEmpleados(emps || [])
    setCursos(curs || [])
    setMicrocursos(mc || [])
    setAsignaciones(asig || [])
    setCertificados(certs || [])
    setLoading(false)
  }

  function salir() {
    sessionStorage.removeItem('empresa_portal')
    navigate('/empresa/acceso')
  }

  if (!empresa) return null

  // Si la prueba venció y es invitado → solo cotizador
  const soloLectura = pruebaVencida && empresa.tipo_acceso === 'invitado'

  const TABS = [
    { id: 'resumen', label: '📊 Resumen' },
    { id: 'empleados', label: '👥 Empleados' },
    { id: 'cursos', label: '🎓 Cursos y microcredenciales' },
    { id: 'asignaciones', label: '📋 Asignaciones' },
    { id: 'proximos', label: '📣 Convocatorias HCD' },
    { id: 'cotizaciones', label: '💼 Mis cotizaciones' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, background: '#8B1A1A', borderRadius: '50%' }} />
            <span style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 15 }}>Hablando con Datos</span>
            <span style={{ color: '#d1d5db' }}>|</span>
            <span style={{ color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{empresa.nombre}</span>
            {empresa.id_empresa && <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{empresa.id_empresa}</code>}
          </div>
          <button onClick={salir} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

        {/* Banner de prueba */}
        {empresa.tipo_acceso === 'invitado' && diasRestantes !== null && (
          <div style={{
            background: pruebaVencida ? '#fef2f2' : diasRestantes <= 7 ? '#fef9c3' : '#eff6ff',
            border: `1px solid ${pruebaVencida ? '#fecaca' : diasRestantes <= 7 ? '#fde047' : '#bfdbfe'}`,
            borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ color: pruebaVencida ? '#991b1b' : diasRestantes <= 7 ? '#713f12' : '#1e40af', fontSize: 14 }}>
              {pruebaVencida
                ? '⏳ Tu periodo de prueba terminó. Contrata para seguir gestionando a tu personal.'
                : `🎁 Periodo de prueba: te quedan ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} con acceso completo.`}
            </div>
            <a href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent('Hola, soy ' + empresa.nombre + ' (' + empresa.id_empresa + ') y quiero contratar la plataforma')}`}
              target="_blank"
              style={{ background: '#25d366', color: '#fff', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              💬 Contratar
            </a>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Portal de gestión</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Administra la capacitación de tu personal</p>
        </div>

        {/* Si prueba vencida, solo mostrar cotizador */}
        {soloLectura ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Tu periodo de prueba terminó</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, maxWidth: 480, margin: '0 auto 24px' }}>
              Sigues teniendo acceso al cotizador. Para volver a gestionar empleados, asignar cursos y descargar certificados, contrata la plataforma.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href={`/cotizar?empresa=${empresa.id}`} target="_blank" style={{ background: '#8B1A1A', color: '#fff', padding: '12px 24px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                Ir al cotizador
              </a>
              <a href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent('Hola, quiero contratar la plataforma. Mi empresa es ' + empresa.nombre + ' (' + empresa.id_empresa + ')')}`}
                target="_blank" style={{ background: '#25d366', color: '#fff', padding: '12px 24px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                💬 Contratar
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 24, flexWrap: 'wrap' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#8B1A1A' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#8B1A1A' : '#64748b', cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>

            <BannerConvocatoria onIr={() => setTab('proximos')} />

            {tab === 'resumen' && <TabResumen empresa={empresa} empleados={empleados} asignaciones={asignaciones} certificados={certificados} cursos={cursos} />}
            {tab === 'empleados' && <TabEmpleados empresa={empresa} empleados={empleados} recargar={() => cargar(empresa)} />}
            {tab === 'cursos' && <TabCursos empresa={empresa} cursos={cursos} microcursos={microcursos} empleados={empleados} recargar={() => cargar(empresa)} />}
            {tab === 'asignaciones' && <TabAsignaciones asignaciones={asignaciones} empleados={empleados} />}
            {tab === 'proximos' && <TabProximos empresa={empresa} empleados={empleados} recargar={() => cargar(empresa)} />}
            {tab === 'cotizaciones' && <TabCotizaciones empresa={empresa} />}
          </>
        )}
      </div>
    </div>
  )
}

// ─── TAB RESUMEN ──────────────────────────────────────────────
function BannerConvocatoria({ onIr }) {
  const [convocatoria, setConvocatoria] = useState(null)

  useEffect(() => {
    cargarConvocatoria()
  }, [])

  async function cargarConvocatoria() {
    try {
      const hoy = new Date().toISOString().split('T')[0]
      // Traer todas las convocatorias con fecha futura, ordenadas por fecha
      const { data } = await supabase.from('proximos_cursos')
        .select('*')
        .gte('fecha', hoy)
        .order('fecha', { ascending: true })
      if (!data || data.length === 0) return
      // Tomar la primera que esté abierta (o cualquiera si no hay estado)
      const abierta = data.find(c => !c.estado || c.estado === 'abierto') || data[0]
      setConvocatoria(abierta)
    } catch (_) {}
  }

  if (!convocatoria) return null

  return (
    <div style={{ background: 'linear-gradient(135deg,#8B1A1A,#a52222)', borderRadius: 14, padding: '20px 26px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>📣 Convocatoria HCD</div>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
          Hablando con Datos te invita a su siguiente curso
        </h3>
        <p style={{ color: 'rgba(255,255,255,.92)', fontSize: 14 }}>
          <strong>{convocatoria.curso_nombre}</strong> · 📅 {new Date(convocatoria.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}{convocatoria.hora ? ` · ${convocatoria.hora}` : ''} · vía Zoom
        </p>
        <p style={{ color: 'rgba(255,255,255,.85)', fontSize: 13, marginTop: 4 }}>
          {convocatoria.tipo_costo === 'sin_costo' ? '🎁 Sin costo — inscribe a tus empleados' : '💰 Inscribe a tus empleados'}
        </p>
        {convocatoria.codigo_promo && <div style={{ display: 'inline-block', background: 'rgba(255,255,255,.2)', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginTop: 6 }}>🎟️ Código promo: {convocatoria.codigo_promo}</div>}
      </div>
      <button onClick={onIr} style={{ background: '#fff', color: '#8B1A1A', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Inscribir empleados →
      </button>
    </div>
  )
}

function TabResumen({ empresa, empleados, asignaciones, certificados, cursos }) {
  const completados = asignaciones.filter(a => a.estado === 'completado').length
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Empleados registrados', value: empleados.length, color: '#8B1A1A' },
          { label: 'Cursos asignados', value: asignaciones.length, color: '#1d4ed8' },
          { label: 'Capacitaciones completadas', value: completados, color: '#059669' },
          { label: 'Certificados obtenidos', value: certificados.length, color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 22px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {empleados.length === 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: '24px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>¡Empieza registrando a tu personal!</h3>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
            Ve a la pestaña <strong>Empleados</strong>, regístralos, y luego asígnales el microcurso gratuito de <strong>Principios de Calidad</strong> para que veas cómo funciona.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── TAB EMPLEADOS ────────────────────────────────────────────
function TabEmpleados({ empresa, empleados, recargar }) {
  const [modal, setModal] = useState(false)
  const [cursosPorEmpleado, setCursosPorEmpleado] = useState({})
  const [modalEstatus, setModalEstatus] = useState(null)

  useEffect(() => {
    cargarCursos()
  }, [empleados])

  async function cargarCursos() {
    if (!empleados || empleados.length === 0) return
    const ids = empleados.map(e => e.id)
    const [{ data: asigs }, { data: certs }] = await Promise.all([
      supabase.from('asignaciones').select('empleado_id, curso_nombre, microcurso_titulo, estado, fecha_programada').in('empleado_id', ids),
      supabase.from('certificados').select('participante_id, nombre_curso').in('participante_id', ids)
    ])
    const mapa = {}
    empleados.forEach(e => { mapa[e.id] = { tomados: [], porTomar: [] } })
    ;(certs || []).forEach(cert => {
      if (mapa[cert.participante_id]) mapa[cert.participante_id].tomados.push(cert.nombre_curso)
    })
    ;(asigs || []).forEach(a => {
      const nombre = a.curso_nombre || a.microcurso_titulo
      if (!mapa[a.empleado_id]) return
      // Si está completado o ya tiene certificado, es "tomado"; si no, "por tomar"
      const yaTomado = mapa[a.empleado_id].tomados.includes(nombre) || a.estado === 'completado'
      if (yaTomado) {
        if (!mapa[a.empleado_id].tomados.includes(nombre)) mapa[a.empleado_id].tomados.push(nombre)
      } else {
        mapa[a.empleado_id].porTomar.push({ nombre, fecha: a.fecha_programada })
      }
    })
    setCursosPorEmpleado(mapa)
  }
  const [modalExcel, setModalExcel] = useState(false)
  const [form, setForm] = useState({ nombre: '', correo: '', whatsapp: '', puesto: '' })
  const [saving, setSaving] = useState(false)
  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!form.nombre || !form.correo) return
    setSaving(true)
    try {
      const id_empleado = await generarIdEmpleado()
      await supabase.from('participantes').insert({
        nombre: form.nombre, correo: form.correo, whatsapp: form.whatsapp, puesto: form.puesto,
        id_empleado, empresa_id: empresa.id, registrado_por_empresa: empresa.id, tipo: 'empresa'
      })
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'empleado', titulo: 'Nuevo empleado registrado',
          mensaje: `${empresa.nombre} registró a ${form.nombre}`,
          link: '/admin/participantes'
        })
      } catch (_) {}
      await recargar()
      setModal(false)
      setForm({ nombre: '', correo: '', whatsapp: '', puesto: '' })
    } catch (e) {
      alert('No se pudo registrar: ' + (e.message || 'error'))
    } finally { setSaving(false) }
  }

  async function toggleAcceso(emp) {
    try {
      await supabase.from('participantes').update({ acceso_examen: !emp.acceso_examen }).eq('id', emp.id)
      await recargar()
    } catch (e) {
      alert('No se pudo cambiar el acceso: ' + (e.message || 'error'))
    }
  }

  async function eliminarEmpleado(emp) {
    if (!window.confirm(`¿Eliminar a "${emp.nombre}"? Perderá su acceso y registros.`)) return
    try {
      await supabase.from('participantes').delete().eq('id', emp.id)
      await recargar()
    } catch (e) {
      alert('No se pudo eliminar: ' + (e.message || 'error'))
    }
  }

  // Genera ID de empleado sin duplicados (busca el máximo)
  async function generarIdEmpleado() {
    try {
      const { data: idData } = await supabase.rpc('siguiente_id', { p_prefijo: 'ALU', p_tabla: 'participantes', p_columna: 'id_empleado' })
      if (idData) return idData
    } catch (_) {}
    // Fallback
    const { data: existentes } = await supabase.from('participantes').select('id_empleado').not('id_empleado', 'is', null)
    let maxNum = 0
    ;(existentes || []).forEach(e => {
      const m = (e.id_empleado || '').match(/ALU-(\d+)/)
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    })
    return `ALU-${String(maxNum + 1).padStart(4, '0')}`
  }

  // Importar empleados desde CSV
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState(null)

  async function importarCSV(file) {
    if (!file) return
    setImportando(true)
    setResultadoImport(null)
    try {
      const texto = await file.text()
      const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
      if (lineas.length < 2) throw new Error('El archivo está vacío o no tiene datos')

      // Detectar separador (coma o punto y coma)
      const sep = lineas[0].includes(';') ? ';' : ','
      const headers = lineas[0].split(sep).map(h => h.trim().toLowerCase())

      // Mapear columnas
      const idxNombre = headers.findIndex(h => h.includes('nombre'))
      const idxCorreo = headers.findIndex(h => h.includes('correo') || h.includes('email') || h.includes('mail'))
      const idxPuesto = headers.findIndex(h => h.includes('puesto') || h.includes('cargo'))
      const idxWhats = headers.findIndex(h => h.includes('whats') || h.includes('tel') || h.includes('cel'))

      if (idxNombre === -1 || idxCorreo === -1) {
        throw new Error('El archivo debe tener al menos columnas "nombre" y "correo"')
      }

      let exitosos = 0
      let errores = 0
      const filas = lineas.slice(1)
      for (const fila of filas) {
        const cols = fila.split(sep).map(c => c.trim())
        const nombre = cols[idxNombre]
        const correo = cols[idxCorreo]
        if (!nombre || !correo) { errores++; continue }
        try {
          const id_empleado = await generarIdEmpleado()
          await supabase.from('participantes').insert({
            nombre, correo,
            puesto: idxPuesto >= 0 ? cols[idxPuesto] : null,
            whatsapp: idxWhats >= 0 ? cols[idxWhats] : null,
            id_empleado, empresa_id: empresa.id, registrado_por_empresa: empresa.id, tipo: 'empresa'
          })
          exitosos++
        } catch (_) { errores++ }
      }
      setResultadoImport({ exitosos, errores })
      await recargar()
    } catch (e) {
      setResultadoImport({ error: e.message })
    } finally { setImportando(false) }
  }

  function descargarPlantilla() {
    const csv = 'nombre,correo,puesto,whatsapp\nJuan Pérez,juan@empresa.com,Supervisor de Calidad,2221234567\nMaría López,maria@empresa.com,Ingeniera de Procesos,2229876543'
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'plantilla_empleados_HCD.csv'
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ color: '#64748b', fontSize: 14 }}>{empleados.length} empleados registrados</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setModalExcel(true)} style={btnSecondary}>📄 Importar Excel/CSV</button>
          <button onClick={() => setModal(true)} style={btnPrimary}>+ Registrar empleado</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['ID Empleado', 'Nombre', 'Puesto', 'Correo', 'Estatus', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empleados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aún no has registrado empleados</td></tr>
            )}
            {empleados.map(e => {
              const cursos = cursosPorEmpleado[e.id] || { tomados: [], porTomar: [] }
              const totalTomados = cursos.tomados.length
              const totalPorTomar = cursos.porTomar.length
              const resumen = (totalTomados === 0 && totalPorTomar === 0)
                ? 'Ninguno'
                : `${totalTomados} tomado${totalTomados !== 1 ? 's' : ''} · ${totalPorTomar} por tomar`
              return (
                <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px' }}><code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{e.id_empleado}</code></td>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{e.nombre}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{e.puesto || '—'}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{e.correo}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <button onClick={() => setModalEstatus({ empleado: e, cursos })}
                      style={{ background: resumen === 'Ninguno' ? '#f1f5f9' : '#f0fdf4', color: resumen === 'Ninguno' ? '#94a3b8' : '#059669', border: `1px solid ${resumen === 'Ninguno' ? '#e2e8f0' : '#bbf7d0'}`, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {resumen}
                    </button>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <button onClick={() => eliminarEmpleado(e)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal importar CSV */}
      {/* Modal de estatus de cursos del empleado */}
      {modalEstatus && (
        <div style={overlay} onClick={() => setModalEstatus(null)}>
          <div style={{ ...modalStyle, width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{modalEstatus.empleado.nombre}</h3>
                <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{modalEstatus.empleado.id_empleado}</code>
              </div>
              <button onClick={() => setModalEstatus(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {/* Cursos tomados */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginBottom: 8 }}>✓ Cursos tomados ({modalEstatus.cursos.tomados.length})</h4>
              {modalEstatus.cursos.tomados.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Ninguno</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modalEstatus.cursos.tomados.map((c, i) => (
                    <div key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', color: '#15803d', fontSize: 13, fontWeight: 500 }}>{c}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Cursos por tomar */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>⏳ Cursos por tomar ({modalEstatus.cursos.porTomar.length})</h4>
              {modalEstatus.cursos.porTomar.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Ninguno</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modalEstatus.cursos.porTomar.map((c, i) => (
                    <div key={i} style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', color: '#92400e', fontSize: 13, fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.nombre}</span>
                      {c.fecha && <span style={{ fontSize: 11 }}>📅 {new Date(c.fecha).toLocaleDateString('es-MX')}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setModalEstatus(null)} style={{ ...btnGhost, width: '100%', marginTop: 20 }}>Cerrar</button>
          </div>
        </div>
      )}

      {modalExcel && (
        <div style={overlay} onClick={() => { setModalExcel(false); setResultadoImport(null) }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Importar empleados</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Sube un archivo CSV o Excel (guardado como CSV) con tus empleados.</p>

            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ color: '#1e40af', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                El archivo debe tener columnas: <strong>nombre, correo</strong> (obligatorias) y opcionalmente <strong>puesto, whatsapp</strong>.
              </p>
              <button onClick={descargarPlantilla} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ⬇️ Descargar plantilla de ejemplo
              </button>
            </div>

            {resultadoImport ? (
              resultadoImport.error ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#991b1b', fontSize: 13 }}>
                  ⚠️ {resultadoImport.error}
                </div>
              ) : (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ color: '#15803d', fontWeight: 700, fontSize: 14 }}>✅ Importación completada</div>
                  <div style={{ color: '#15803d', fontSize: 13, marginTop: 4 }}>
                    {resultadoImport.exitosos} empleados registrados
                    {resultadoImport.errores > 0 && ` · ${resultadoImport.errores} con error (filas incompletas)`}
                  </div>
                </div>
              )
            ) : (
              <label style={{ display: 'block', border: '2px dashed #cbd5e1', borderRadius: 12, padding: '32px', textAlign: 'center', cursor: importando ? 'wait' : 'pointer', background: '#f8f9fb' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>{importando ? 'Importando...' : 'Haz clic para seleccionar tu archivo CSV'}</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>o arrastra el archivo aquí</div>
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} disabled={importando}
                  onChange={e => importarCSV(e.target.files[0])} />
              </label>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => { setModalExcel(false); setResultadoImport(null) }} style={btnGhost}>
                {resultadoImport && !resultadoImport.error ? 'Listo' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Registrar empleado</h3>
            <label style={lbl}>Nombre completo *</label>
            <input value={form.nombre} onChange={e => f('nombre')(e.target.value)} placeholder="Nombre del empleado" style={inp} />
            <label style={lbl}>Puesto</label>
            <input value={form.puesto} onChange={e => f('puesto')(e.target.value)} placeholder="ej. Supervisor de Calidad" style={inp} />
            <label style={lbl}>Correo electrónico *</label>
            <input type="email" value={form.correo} onChange={e => f('correo')(e.target.value)} placeholder="correo@empresa.com" style={inp} />
            <label style={lbl}>WhatsApp</label>
            <input value={form.whatsapp} onChange={e => f('whatsapp')(e.target.value)} placeholder="222 123 4567" style={inp} />
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 12, color: '#1e40af' }}>
              Se le generará un ID de empleado para que acceda a sus cursos asignados.
            </div>
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

// ─── TAB CURSOS Y MICROCREDENCIALES ───────────────────────────
function TabCursos({ empresa, cursos, microcursos, empleados, recargar }) {
  const [modalAsignar, setModalAsignar] = useState(null) // {item, tipo}
  const [modalCompra, setModalCompra] = useState(null)

  return (
    <div>
      {/* MICROCREDENCIALES */}
      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>⚡ Microcredenciales</h3>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Cápsulas de 20 min que tus empleados toman desde su teléfono</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14, marginBottom: 32 }}>
        {microcursos.map(mc => (
          <div key={mc.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {mc.es_gratuito && <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>🎁 Gratis</span>}
              <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{mc.duracion_min} min</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{mc.titulo}</h4>
            {mc.descripcion && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>{mc.descripcion}</p>}
            <button onClick={() => setModalAsignar({ item: mc, tipo: 'microcurso' })}
              style={{ ...btnPrimary, width: '100%', padding: '8px' }}>Asignar a empleados</button>
          </div>
        ))}
      </div>

      {/* CURSOS */}
      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>🎓 Cursos</h3>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Capacitaciones formales con certificado</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {cursos.map(c => (
          <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>#{c.numero_curso}</span>
              <span style={{ color: '#64748b', fontSize: 11 }}>{c.duracion} hrs</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{c.nombre}</h4>
            {c.temario && (
              <details style={{ marginBottom: 12 }}>
                <summary style={{ color: '#1d4ed8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Ver temario</summary>
                <p style={{ color: '#64748b', fontSize: 12, marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.temario}</p>
              </details>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a href={`/cotizar?curso=${c.id}&empresa=${empresa.id}`} target="_blank"
                style={{ ...btnPrimary, width: '100%', padding: '9px', textAlign: 'center', textDecoration: 'none', display: 'block', boxSizing: 'border-box' }}>
                💰 Cotizar este curso
              </a>
              <button onClick={() => setModalCompra(c)} style={{ ...btnSecondary, width: '100%', padding: '8px', fontSize: 12 }}>
                Ya pagué — Asignar con ID de compra
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modales */}
      {modalAsignar && <ModalAsignar empresa={empresa} item={modalAsignar.item} tipo={modalAsignar.tipo} empleados={empleados} onClose={() => setModalAsignar(null)} onDone={() => { setModalAsignar(null); recargar() }} />}
      {modalCompra && <ModalCompra empresa={empresa} curso={modalCompra} empleados={empleados} onClose={() => setModalCompra(null)} onDone={() => { setModalCompra(null); recargar() }} />}
    </div>
  )
}

// Modal asignar microcurso (gratis = directo)
function ModalAsignar({ empresa, item, tipo, empleados, onClose, onDone }) {
  const [seleccionados, setSeleccionados] = useState([])
  const [modalidad, setModalidad] = useState('zoom')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [saving, setSaving] = useState(false)

  function toggle(id) {
    setSeleccionados(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  async function asignar() {
    if (seleccionados.length === 0) return
    setSaving(true)
    try {
      const rows = seleccionados.map(empId => {
        const emp = empleados.find(e => e.id === empId)
        return {
          empresa_id: empresa.id,
          empleado_id: empId,
          empleado_nombre: emp?.nombre,
          microcurso_id: item.id,
          microcurso_titulo: item.titulo,
          tipo: 'microcurso',
          modalidad_asignacion: 'zoom',
          fecha_programada: fecha,
          hora_programada: hora,
          estado: 'asignado'
        }
      })
      await supabase.from('asignaciones').insert(rows)

      // Crear solicitud para que el admin la vea conectada
      try {
        const nombresEmpleados = seleccionados.map(id => empleados.find(e => e.id === id)?.nombre).filter(Boolean)
        await supabase.from('solicitudes_microcursos').insert({
          empresa_id: empresa.id,
          empresa_nombre: empresa.nombre,
          microcurso_id: item.id,
          microcurso_titulo: item.titulo,
          num_empleados: seleccionados.length,
          empleados_nombres: nombresEmpleados.join(', '),
          fecha_sesion: fecha || null,
          hora_sesion: hora || null,
          estado: 'aprobada',
          notas: `Sesión Zoom${fecha ? ' para ' + fecha : ''}${hora ? ' a las ' + hora : ''}`
        })
      } catch (_) { /* no bloquear si falla */ }

      onDone()
    } catch (e) {
      alert('Error al asignar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modalStyle, width: 520, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Asignar: {item.titulo}</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Selecciona empleados y la fecha de la sesión por Zoom</p>

        {/* Solo Zoom: fecha y hora */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <span style={{ color: '#1e40af', fontSize: 13, fontWeight: 600 }}>🎥 Sesión por Zoom</span>
          <span style={{ color: '#64748b', fontSize: 12 }}> — se impartirá en la fecha y hora que programes</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Hora</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inp} />
          </div>
        </div>

        {false && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inp} />
            </div>
          </div>
        )}

        {/* Empleados */}
        <label style={lbl}>Empleados ({seleccionados.length} seleccionados)</label>
        {empleados.length === 0 ? (
          <div style={{ background: '#fef9c3', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#713f12' }}>
            Primero registra empleados en la pestaña "Empleados"
          </div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            {empleados.map(e => (
              <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <input type="checkbox" checked={seleccionados.includes(e.id)} onChange={() => toggle(e.id)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                <div>
                  <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{e.nombre}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{e.puesto || 'Sin puesto'} · {e.id_empleado}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={asignar} disabled={saving || seleccionados.length === 0 || !fecha} style={btnPrimary}>
            {saving ? 'Asignando...' : `Asignar a ${seleccionados.length}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal programar curso (manda solicitud)
function ModalProgramar({ empresa, curso, onClose }) {
  const [fecha, setFecha] = useState('')
  const [modalidad, setModalidad] = useState('presencial')
  const [numPersonas, setNumPersonas] = useState(1)
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [exito, setExito] = useState(false)

  async function programar() {
    if (!fecha) return
    setSaving(true)
    try {
      await supabase.from('programaciones').insert({
        empresa_id: empresa.id, empresa_nombre: empresa.nombre,
        curso_id: curso.id, curso_nombre: curso.nombre,
        fecha_solicitada: fecha, modalidad, num_personas: numPersonas, notas,
        estado: 'pendiente'
      })
      // Notificar admin
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'programacion', titulo: 'Nueva solicitud de curso',
          mensaje: `${empresa.nombre} solicitó ${curso.nombre} para el ${fecha}`,
          link: '/admin/programaciones'
        })
      } catch (_) {}
      setExito(true)
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {exito ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Solicitud enviada</h3>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Hablando con Datos revisará tu solicitud y te confirmará la fecha del curso <strong>{curso.nombre}</strong>.</p>
            <button onClick={onClose} style={btnPrimary}>Entendido</button>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Programar: {curso.nombre}</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Propón una fecha y te confirmaremos disponibilidad</p>
            <label style={lbl}>Fecha deseada *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
            <label style={lbl}>Modalidad</label>
            <select value={modalidad} onChange={e => setModalidad(e.target.value)} style={inp}>
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
            </select>
            <label style={lbl}>Número de personas</label>
            <input type="number" min={1} value={numPersonas} onChange={e => setNumPersonas(Number(e.target.value))} style={inp} />
            <label style={lbl}>Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Requerimientos especiales" style={{ ...inp, resize: 'none' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={onClose} style={btnGhost}>Cancelar</button>
              <button onClick={programar} disabled={saving || !fecha} style={btnPrimary}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Modal asignar con ID de compra
function ModalCompra({ empresa, curso, empleados, onClose, onDone }) {
  const [idCompra, setIdCompra] = useState('')
  const [validado, setValidado] = useState(false)
  const [compraData, setCompraData] = useState(null)
  const [error, setError] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [fecha, setFecha] = useState('')
  const [saving, setSaving] = useState(false)

  const limite = compraData?.num_personas || 1
  const [yaInscritos, setYaInscritos] = useState([])
  const fechaCurso = compraData?.fecha_curso
  const fechaPasada = fechaCurso && new Date(fechaCurso) < new Date(new Date().toDateString())
  const cupoLleno = yaInscritos.length >= limite && seleccionados.length >= limite

  async function validar() {
    if (!idCompra) return
    setError('')
    try {
      // Buscar la compra (activa o usada — sigue sirviendo mientras haya cupo y no pase la fecha)
      const { data: compra } = await supabase.from('compras').select('*')
        .eq('id_compra', idCompra.toUpperCase().trim())
        .in('estado', ['activo', 'usado']).maybeSingle()
      if (!compra) { setError('ID de compra no válido. Verifica con Hablando con Datos.'); return }

      // Verificar que sea para este curso
      if (compra.curso_id && curso.id && compra.curso_id !== curso.id) {
        setError('Este ID de compra es para otro curso.'); return
      }
      // Verificar fecha
      if (compra.fecha_curso && new Date(compra.fecha_curso) < new Date(new Date().toDateString())) {
        setError('La fecha de este curso ya pasó. El ID de compra está vencido.'); return
      }

      // Cargar quiénes ya están inscritos con este ID
      const { data: asigsPrevias } = await supabase.from('asignaciones').select('empleado_id')
        .eq('id_compra', idCompra.toUpperCase().trim())
      const idsInscritos = (asigsPrevias || []).map(a => a.empleado_id)
      setYaInscritos(idsInscritos)
      setSeleccionados(idsInscritos) // precargar la selección actual

      setCompraData(compra)
      setFecha(compra.fecha_curso || '')
      setValidado(true)
    } catch (e) {
      setError('Error al validar: ' + (e.message || ''))
    }
  }

  function toggle(id) {
    setSeleccionados(s => {
      if (s.includes(id)) return s.filter(x => x !== id)
      if (s.length >= limite) {
        alert(`Tu ID de compra es para ${limite} persona(s). Si necesitas agregar a alguien más, contacta a Hablando con Datos.`)
        return s
      }
      return [...s, id]
    })
  }

  async function asignar() {
    if (fechaPasada) { alert('La fecha del curso ya pasó.'); return }
    if (!fecha) { alert('Debes programar la fecha de inicio del curso.'); return }
    if (seleccionados.length === 0) { alert('Selecciona al menos un empleado.'); return }
    setSaving(true)
    try {
      const idC = idCompra.toUpperCase().trim()
      // 1. Borrar asignaciones previas de este ID (para regenerar la lista actual)
      const { data: previas } = await supabase.from('asignaciones').select('empleado_id').eq('id_compra', idC)
      const idsPrevios = (previas || []).map(a => a.empleado_id)
      await supabase.from('asignaciones').delete().eq('id_compra', idC)

      // 2. Quitar acceso a los que estaban antes pero ya no están seleccionados
      const removidos = idsPrevios.filter(id => !seleccionados.includes(id))
      for (const empId of removidos) {
        await supabase.from('participantes').update({ acceso_examen: false }).eq('id', empId)
      }

      // 3. Insertar la selección actual
      const rows = seleccionados.map(empId => {
        const emp = empleados.find(e => e.id === empId)
        return {
          empresa_id: empresa.id, empleado_id: empId, empleado_nombre: emp?.nombre,
          curso_id: curso.id, curso_nombre: curso.nombre, tipo: 'curso',
          modalidad_asignacion: 'zoom', fecha_programada: fecha,
          id_compra: idC, estado: 'asignado'
        }
      })
      await supabase.from('asignaciones').insert(rows)
      // Dar acceso a los seleccionados
      for (const empId of seleccionados) {
        await supabase.from('participantes').update({ acceso_examen: true }).eq('id', empId)
      }

      // 4. Marcar la compra: 'usado' si se llenó, 'activo' si aún hay cupo
      const nuevoEstado = seleccionados.length >= limite ? 'usado' : 'activo'
      await supabase.from('compras').update({ estado: nuevoEstado, fecha_curso: fecha }).eq('id_compra', idC)

      // 5. Registrar/actualizar en CURSOS CONFIRMADOS (calendario admin)
      let errorConfirmado = null
      try {
        const { data: existente } = await supabase.from('cursos_confirmados')
          .select('id').eq('id_compra', idC).maybeSingle()
        const payload = {
          curso_id: curso.id, curso_nombre: curso.nombre,
          empresa_id: empresa.id, empresa_nombre: empresa.nombre,
          fecha_inicio: fecha, num_participantes: seleccionados.length,
          id_compra: idC, origen: 'orden_compra', estado: 'confirmado'
        }
        if (existente) {
          const { error } = await supabase.from('cursos_confirmados').update(payload).eq('id', existente.id)
          if (error) errorConfirmado = error
        } else {
          const { error } = await supabase.from('cursos_confirmados').insert(payload)
          if (error) errorConfirmado = error
        }
      } catch (e) { errorConfirmado = e }

      if (errorConfirmado) {
        // No bloquea la asignación, pero avisa
        console.error('Error al guardar en calendario:', errorConfirmado)
        alert('Los empleados se asignaron correctamente, pero hubo un problema al guardar en el calendario del admin. Verifica que ejecutaste el SQL de cursos_confirmados. Detalle: ' + (errorConfirmado.message || ''))
      }

      // 6. Notificar al admin
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'programacion', titulo: 'Curso programado',
          mensaje: `${empresa.nombre} programó ${curso.nombre} para ${new Date(fecha).toLocaleDateString('es-MX')} (${seleccionados.length} asistentes)`,
          link: '/admin/confirmados'
        })
      } catch (_) {}

      onDone()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modalStyle, width: 520, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Asignar curso: {curso.nombre}</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Este curso tiene costo. Ingresa tu ID de compra.</p>

        {!validado ? (
          <>
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <label style={lbl}>ID de compra</label>
            <input value={idCompra} onChange={e => setIdCompra(e.target.value)} placeholder="COMPRA-0001" style={inp} />
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '12px 14px', marginTop: 12, fontSize: 12, color: '#1e40af' }}>
              ¿No tienes ID de compra? Cotiza este curso y al confirmar tu pago, Hablando con Datos te lo proporcionará.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={onClose} style={btnGhost}>Cancelar</button>
              <a href={`/cotizar?empresa=${empresa.id}`} target="_blank" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Cotizar</a>
              <button onClick={validar} disabled={!idCompra} style={btnPrimary}>Validar ID</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#15803d', fontSize: 13 }}>
              ✅ ID válido para <strong>{limite} persona(s)</strong>. Seleccionados: {seleccionados.length}/{limite}.
              {seleccionados.length >= limite && <div style={{ marginTop: 4, fontSize: 12 }}>Cupo lleno. Para agregar a alguien más, contacta a Hablando con Datos.</div>}
            </div>
            {compraData?.fecha_curso && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: '#1e40af', fontSize: 12 }}>
                📅 Fecha del curso: {new Date(compraData.fecha_curso).toLocaleDateString('es-MX')}. Puedes ajustar tu selección hasta esta fecha.
              </div>
            )}
            <label style={lbl}>Fecha de inicio del curso <span style={{ color: '#dc2626' }}>*</span></label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
            <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 12px', marginTop: 8, marginBottom: 8 }}>
              <p style={{ color: '#92400e', fontSize: 12, lineHeight: 1.5 }}>
                📅 Programa la fecha de inicio del curso. Si deseas <strong>fechas discontinuas</strong> o un <strong>cambio de fecha</strong>, contacta con Hablando con Datos.
              </p>
            </div>
            <label style={lbl}>Empleados ({seleccionados.length})</label>
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {empleados.map(e => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                  <input type="checkbox" checked={seleccionados.includes(e.id)} onChange={() => toggle(e.id)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: '#1e293b' }}>{e.nombre} <span style={{ color: '#94a3b8' }}>· {e.puesto || 'Sin puesto'}</span></span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={onClose} style={btnGhost}>Cancelar</button>
              <button onClick={asignar} disabled={saving || fechaPasada || !fecha || seleccionados.length === 0} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar selección'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── TAB ASIGNACIONES ─────────────────────────────────────────
function TabAsignaciones({ asignaciones, empleados }) {
  // Mapa de empleado_id -> id_empleado (clave)
  const claveEmpleado = {}
  ;(empleados || []).forEach(e => { claveEmpleado[e.id] = e.id_empleado })
  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>{asignaciones.length} asignaciones registradas</p>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Clave', 'Empleado', 'Curso / Microcurso', 'Tipo', 'Modalidad', 'Fecha', 'Estado'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {asignaciones.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin asignaciones. Asigna cursos desde la pestaña anterior.</td></tr>
            )}
            {asignaciones.map(a => (
              <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 16px' }}>
                  {claveEmpleado[a.empleado_id] ? <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{claveEmpleado[a.empleado_id]}</code> : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                </td>
                <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{a.empleado_nombre}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{a.curso_nombre || a.microcurso_titulo}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ background: a.tipo === 'microcurso' ? '#eff6ff' : '#f9f0f0', color: a.tipo === 'microcurso' ? '#1d4ed8' : '#8B1A1A', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                    {a.tipo === 'microcurso' ? 'Microcurso' : 'Curso'}
                  </span>
                </td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: 12 }}>{a.modalidad_asignacion === 'autogestivo' ? '📱 Autogestivo' : '🎥 Zoom'}</td>
                <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: 12 }}>{a.fecha_programada ? new Date(a.fecha_programada).toLocaleDateString('es-MX') : '—'}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ background: a.estado === 'completado' ? '#f0fdf4' : '#fef9c3', color: a.estado === 'completado' ? '#059669' : '#92400e', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {a.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── TAB COTIZACIONES (empresa) ───────────────────────────────
function TabCotizaciones({ empresa }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    // Cotizaciones de esta empresa: por empresa_id primero (más confiable)
    let resultado = []
    const porId = await supabase.from('cotizaciones').select('*').eq('empresa_id', empresa.id).order('created_at', { ascending: false })
    resultado = porId.data || []

    // También por nombre (para cotizaciones viejas sin empresa_id)
    const porNombre = await supabase.from('cotizaciones').select('*').eq('empresa_nombre', empresa.nombre).order('created_at', { ascending: false })
    ;(porNombre.data || []).forEach(cot => {
      if (!resultado.find(r => r.id === cot.id)) resultado.push(cot)
    })

    // Ordenar por fecha
    resultado.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setCotizaciones(resultado)
    setLoading(false)
  }

  // Vencimiento visual a 30 días
  function estaVencida(cot) {
    if (cot.estado === 'aceptada' || cot.estado === 'aceptada_cliente' || cot.orden_compra_url) return false
    const dias = Math.floor((new Date() - new Date(cot.created_at)) / (1000 * 60 * 60 * 24))
    return dias > 30
  }
  function diasRestantes(cot) {
    const dias = 30 - Math.floor((new Date() - new Date(cot.created_at)) / (1000 * 60 * 60 * 24))
    return dias
  }

  async function generarIdCompra() {
    try {
      const { data: idData } = await supabase.rpc('siguiente_id', { p_prefijo: 'COMPRA', p_tabla: 'compras', p_columna: 'id_compra' })
      if (idData) return idData
    } catch (_) {}
    const { data: existentes } = await supabase.from('compras').select('id_compra').not('id_compra', 'is', null)
    let maxNum = 0
    ;(existentes || []).forEach(e => {
      const m = (e.id_compra || '').match(/COMPRA-(\d+)/)
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    })
    return `COMPRA-${String(maxNum + 1).padStart(4, '0')}`
  }

  async function subirOC(cot, file) {
    if (!file) return
    if (file.type !== 'application/pdf') { alert('Solo se permiten archivos PDF'); return }
    setSubiendo(cot.id)
    try {
      // 1. Subir el PDF
      const nombreArchivo = `${cot.folio}_${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage.from('ordenes-compra').upload(nombreArchivo, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('ordenes-compra').getPublicUrl(nombreArchivo)

      // 2. Generar ID de compra automático (con el # de empleados cotizados)
      const idCompra = await generarIdCompra()
      const numPersonas = cot.num_personas || 1

      await supabase.from('compras').insert({
        id_compra: idCompra,
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
        curso_id: cot.curso_id,
        curso_nombre: cot.curso_nombre,
        monto: cot.total,
        num_personas: numPersonas,
        estado: 'activo',
        cotizacion_id: cot.id,
        fecha_curso: cot.fecha_deseada || null,
        tipo_comprador: 'empresa'
      })

      // 3. Actualizar la cotización: ACEPTADA POR EL CLIENTE + ID generado
      await supabase.from('cotizaciones').update({
        orden_compra_url: urlData.publicUrl, orden_compra_nombre: file.name,
        estado: 'aceptada_cliente', id_compra_generado: idCompra
      }).eq('id', cot.id)

      // 4. Registrar como VENTA (estatus de cobro: enviar factura)
      await supabase.from('ventas').insert({
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
        curso_nombre: cot.curso_nombre,
        monto: cot.total,
        cotizacion_id: cot.id,
        id_compra: idCompra,
        orden_compra_url: urlData.publicUrl,
        empresa_registrada: true,
        num_personas: numPersonas,
        fecha_curso: cot.fecha_deseada || null,
        estatus_cobro: 'enviar_factura'
      })

      // 5. Notificar al admin
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'orden_compra', titulo: 'Orden de compra recibida',
          mensaje: `${empresa.nombre} subió OC para ${cot.curso_nombre}. Venta registrada (${idCompra})`,
          link: '/admin/ventas'
        })
      } catch (_) {}

      await cargar()
    } catch (e) {
      alert('Error al subir: ' + (e.message || 'verifica el bucket en Supabase'))
    } finally { setSubiendo(null) }
  }

  async function cancelar(cot) {
    if (!window.confirm('¿Cancelar esta cotización?')) return
    await supabase.from('cotizaciones').update({ estado: 'cancelada' }).eq('id', cot.id)
    await cargar()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando cotizaciones...</div>

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>Tus cotizaciones solicitadas. Adjunta tu orden de compra para confirmar.</p>

      {cotizaciones.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💼</div>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>Aún no tienes cotizaciones. Cotiza un curso desde la pestaña "Cursos".</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {cotizaciones.map(cot => {
            const vencida = estaVencida(cot)
            const dias = diasRestantes(cot)
            const aceptada = cot.estado === 'aceptada' || cot.estado === 'aceptada_cliente'
            const cancelada = cot.estado === 'cancelada'
            return (
              <div key={cot.id} style={{ background: '#fff', border: `1px solid ${aceptada ? '#bbf7d0' : cancelada ? '#e2e8f0' : vencida ? '#fecaca' : '#e2e8f0'}`, borderRadius: 14, padding: '20px 24px', opacity: cancelada ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{cot.folio}</code>
                      {aceptada ? (
                        <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>✓ Aceptada</span>
                      ) : cancelada ? (
                        <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Cancelada</span>
                      ) : vencida ? (
                        <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>⏳ Vencida</span>
                      ) : (
                        <span style={{ background: '#fef9c3', color: '#92400e', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Vence en {dias} días</span>
                      )}
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{cot.curso_nombre}</h3>
                    <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                      {cot.num_personas} empleado(s) solicitado(s) · Total: <strong style={{ color: '#8B1A1A' }}>${cot.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                    </p>
                    {cot.fecha_deseada && <p style={{ color: '#1d4ed8', fontSize: 12, marginTop: 4 }}>📅 Fecha deseada: {new Date(cot.fecha_deseada).toLocaleDateString('es-MX')}</p>}
                    <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Generada: {new Date(cot.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    {!aceptada && !cancelada && !vencida && (
                      <>
                        <label style={{ background: '#8B1A1A', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: subiendo === cot.id ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                          {subiendo === cot.id ? 'Procesando...' : '⬆️ Adjuntar orden de compra'}
                          <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={subiendo === cot.id}
                            onChange={e => subirOC(cot, e.target.files[0])} />
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a href={`/cotizar?curso=${cot.curso_id}&empresa=${empresa.id}`} target="_blank" onClick={() => cancelar(cot)}
                            style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: 8, fontSize: 11, textDecoration: 'none', border: '1px solid #e2e8f0' }}>
                            Generar nueva
                          </a>
                          <button onClick={() => cancelar(cot)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                      </>
                    )}
                    {vencida && !aceptada && !cancelada && (
                      <a href={`/cotizar?curso=${cot.curso_id}&empresa=${empresa.id}`} target="_blank" style={{ background: '#8B1A1A', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                        Volver a cotizar
                      </a>
                    )}
                    {cot.orden_compra_url && (
                      <a href={cot.orden_compra_url} target="_blank" style={{ background: '#f0fdf4', color: '#059669', padding: '6px 14px', borderRadius: 8, fontSize: 11, textDecoration: 'none', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                        📎 Ver OC
                      </a>
                    )}
                  </div>
                </div>

                {/* ID de compra generado (instrucciones) */}
                {aceptada && cot.id_compra_generado && (
                  <div style={{ marginTop: 16, background: '#f9f0f0', border: '2px dashed #8B1A1A', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>TU ID DE COMPRA (uso único)</div>
                        <div style={{ color: '#8B1A1A', fontSize: 22, fontWeight: 800 }}>{cot.id_compra_generado}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ color: '#7c2d2d', fontSize: 12, lineHeight: 1.5 }}>
                          📋 <strong>Siguiente paso:</strong> ve a la pestaña <strong>"Cursos"</strong>, busca <strong>{cot.curso_nombre}</strong>, haz clic en "Ya pagué — Asignar con ID de compra", ingresa este ID y selecciona los <strong>{cot.num_personas} empleado(s)</strong> que asistirán.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── TAB PRÓXIMOS CURSOS (empresa) ────────────────────────────
function TabProximos({ empresa, empleados, recargar }) {
  const [proximos, setProximos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalInscribir, setModalInscribir] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: prox }, { data: insc }] = await Promise.all([
      supabase.from('proximos_cursos').select('*').eq('estado', 'abierto').order('fecha', { ascending: true }),
      supabase.from('inscripciones').select('*')
    ])
    setProximos(prox || [])
    setInscripciones(insc || [])
    setLoading(false)
  }

  function fmtFecha(f) {
    return new Date(f + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function cuposDisponibles(p) {
    const ocupados = inscripciones.filter(i => i.proximo_curso_id === p.id).length
    return p.cupo_maximo - ocupados
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando próximos cursos...</div>

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>Cursos programados por Hablando con Datos. Inscribe a tus empleados.</p>

      {proximos.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          No hay próximos cursos programados por ahora. ¡Vuelve pronto!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
          {proximos.map(p => {
            const disp = cuposDisponibles(p)
            const lleno = disp <= 0
            return (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px', borderTop: `4px solid ${p.tipo_costo === 'sin_costo' ? '#059669' : '#8B1A1A'}` }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <span style={{ background: p.tipo_costo === 'sin_costo' ? '#f0fdf4' : '#f9f0f0', color: p.tipo_costo === 'sin_costo' ? '#059669' : '#8B1A1A', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {p.tipo_costo === 'sin_costo' ? '🎁 Gratis' : `$${Number(p.precio).toLocaleString('es-MX')} p/persona`}
                  </span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>{p.curso_nombre}</h3>
                <div style={{ color: '#475569', fontSize: 13, marginBottom: 4 }}>📅 {fmtFecha(p.fecha)}</div>
                <div style={{ color: '#475569', fontSize: 13, marginBottom: 12 }}>🕐 {p.hora} · 🎥 Por Zoom</div>
                {p.temario && (
                  <details style={{ marginBottom: 12 }}>
                    <summary style={{ color: '#1d4ed8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Ver temario</summary>
                    <p style={{ color: '#64748b', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{p.temario}</p>
                  </details>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: lleno ? '#dc2626' : '#059669', fontSize: 12, fontWeight: 700 }}>
                    {lleno ? '🔴 Cupo lleno' : `${disp} lugar${disp !== 1 ? 'es' : ''} disponible${disp !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {lleno ? (
                  <button disabled style={{ width: '100%', background: '#f1f5f9', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}>
                    Cupo lleno
                  </button>
                ) : (
                  <button onClick={() => setModalInscribir(p)} style={{ width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {p.tipo_costo === 'sin_costo' ? 'Inscribir empleados (gratis)' : 'Inscribir (con orden de compra)'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalInscribir && (
        <ModalInscribirProximo
          empresa={empresa} empleados={empleados} proximo={modalInscribir}
          cuposDisponibles={cuposDisponibles(modalInscribir)}
          onClose={() => setModalInscribir(null)}
          onDone={() => { setModalInscribir(null); cargar(); recargar() }}
        />
      )}
    </div>
  )
}

function ModalInscribirProximo({ empresa, empleados, proximo, cuposDisponibles, onClose, onDone }) {
  const [seleccionados, setSeleccionados] = useState([])
  const [idCompra, setIdCompra] = useState('')
  const [compraValidada, setCompraValidada] = useState(false)
  const [errorCompra, setErrorCompra] = useState('')
  const [saving, setSaving] = useState(false)

  const esConCosto = proximo.tipo_costo === 'con_costo'

  function toggle(id) {
    setSeleccionados(s => {
      if (s.includes(id)) return s.filter(x => x !== id)
      if (s.length >= cuposDisponibles) { alert(`Solo quedan ${cuposDisponibles} lugares`); return s }
      return [...s, id]
    })
  }

  async function validarCompra() {
    if (!idCompra) return
    setErrorCompra('')
    try {
      const { data: compra } = await supabase.from('compras').select('*').eq('id_compra', idCompra.toUpperCase().trim()).eq('estado', 'activo').single()
      if (!compra) throw new Error('no')
      setCompraValidada(true)
    } catch {
      setErrorCompra('ID de compra no válido o ya usado.')
    }
  }

  async function inscribir() {
    if (seleccionados.length === 0) return
    if (esConCosto && !compraValidada) { setErrorCompra('Valida tu ID de compra primero'); return }
    setSaving(true)
    try {
      const rows = seleccionados.map(empId => {
        const emp = empleados.find(e => e.id === empId)
        return {
          proximo_curso_id: proximo.id,
          curso_nombre: proximo.curso_nombre,
          fecha: proximo.fecha,
          participante_id: empId,
          participante_nombre: emp?.nombre,
          participante_correo: emp?.correo,
          empresa_id: empresa.id,
          empresa_nombre: empresa.nombre,
          origen: 'empresa',
          id_compra: esConCosto ? idCompra.toUpperCase().trim() : null,
          estado: 'inscrito'
        }
      })
      await supabase.from('inscripciones').insert(rows)
      // Actualizar cupo ocupado
      await supabase.from('proximos_cursos').update({ cupo_ocupado: (proximo.cupo_ocupado || 0) + seleccionados.length }).eq('id', proximo.id)
      // Si con costo, marcar compra usada
      if (esConCosto) await supabase.from('compras').update({ estado: 'usado' }).eq('id_compra', idCompra.toUpperCase().trim())

      // Dar acceso al examen a los inscritos
      for (const empId of seleccionados) {
        await supabase.from('participantes').update({ acceso_examen: true }).eq('id', empId)
      }

      // Registrar/actualizar en CURSOS CONFIRMADOS (calendario admin)
      try {
        const { data: existe } = await supabase.from('cursos_confirmados')
          .select('id, num_participantes').eq('curso_nombre', proximo.curso_nombre).eq('fecha_inicio', proximo.fecha).maybeSingle()
        if (existe) {
          await supabase.from('cursos_confirmados').update({ num_participantes: (existe.num_participantes || 0) + seleccionados.length }).eq('id', existe.id)
        } else {
          await supabase.from('cursos_confirmados').insert({
            curso_id: proximo.curso_id, curso_nombre: proximo.curso_nombre,
            fecha_inicio: proximo.fecha, hora: proximo.hora,
            num_participantes: seleccionados.length,
            origen: 'proximo_curso', modalidad: 'zoom', estado: 'confirmado',
            notas: 'Convocatoria HCD'
          })
        }
      } catch (_) {}
      // Notificar admin
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'programacion', titulo: 'Inscripción a próximo curso',
          mensaje: `${empresa.nombre} inscribió ${seleccionados.length} empleado(s) a ${proximo.curso_nombre}`,
          link: '/admin/proximos'
        })
      } catch (_) {}
      onDone()
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modalStyle, width: 520, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Inscribir a: {proximo.curso_nombre}</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
          {new Date(proximo.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} · {proximo.hora} · {cuposDisponibles} lugares disponibles
        </p>

        {esConCosto && !compraValidada && (
          <div style={{ background: '#fef9e7', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
            <p style={{ color: '#92400e', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Este curso tiene costo (${Number(proximo.precio).toLocaleString('es-MX')} p/persona)</p>
            {errorCompra && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>✗ {errorCompra}</div>}
            <label style={lbl}>ID de compra</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={idCompra} onChange={e => setIdCompra(e.target.value)} placeholder="COMPRA-0001" style={{ ...inp, flex: 1 }} />
              <button onClick={validarCompra} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Validar</button>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>¿No tienes ID? Cotiza este curso o contacta a HCD para tu orden de compra.</p>
          </div>
        )}

        {esConCosto && compraValidada && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#15803d', fontSize: 13 }}>
            ✅ ID de compra válido. Selecciona los empleados.
          </div>
        )}

        {(!esConCosto || compraValidada) && (
          <>
            <label style={lbl}>Empleados ({seleccionados.length} de {cuposDisponibles})</label>
            {empleados.length === 0 ? (
              <div style={{ background: '#fef9c3', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#713f12' }}>
                Primero registra empleados en la pestaña "Empleados"
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {empleados.map(e => (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                    <input type="checkbox" checked={seleccionados.includes(e.id)} onChange={() => toggle(e.id)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{e.nombre}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{e.puesto || 'Sin puesto'} · {e.id_empleado}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          {(!esConCosto || compraValidada) && (
            <button onClick={inscribir} disabled={saving || seleccionados.length === 0} style={btnPrimary}>
              {saving ? 'Inscribiendo...' : `Inscribir a ${seleccionados.length}`}
            </button>
          )}
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
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 460, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
