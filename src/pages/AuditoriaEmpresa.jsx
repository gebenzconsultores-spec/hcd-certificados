import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { generarQRBase64, construirHTMLCertificado } from '../lib/certificado'
import JSZip from 'jszip'

const APP_URL = import.meta.env.VITE_APP_URL || 'https://hcd-certificados.vercel.app'

// Auditoría descargable por la empresa desde su portal.
// Siempre filtrada a la empresa; permite descargar por curso o todo el historial.
export default function AuditoriaEmpresa({ empresa }) {
  const [cursosDados, setCursosDados] = useState([])
  const [cursoId, setCursoId] = useState('')      // '' = todo el historial
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generando, setGenerando] = useState(false)

  useEffect(() => { cargarCursosDados() }, [])

  async function cargarCursosDados() {
    try {
      const { data } = await supabase.from('cursos_confirmados')
        .select('id, curso_id, curso_nombre, numero_curso, fecha_inicio')
        .eq('empresa_id', empresa.id)
        .order('fecha_inicio', { ascending: false })
      const vistos = new Set()
      const unicos = []
      ;(data || []).forEach(cc => {
        if (cc.curso_id && !vistos.has(cc.curso_id)) { vistos.add(cc.curso_id); unicos.push(cc) }
      })
      setCursosDados(unicos)
    } catch (_) { setCursosDados([]) }
  }

  async function buscar() {
    setLoading(true)
    setDatos(null)
    try {
      let q = supabase
        .from('certificados')
        .select(`*, participante:participantes(nombre, correo, whatsapp), curso:cursos(nombre, numero_curso, duracion)`)
        .eq('empresa_id', empresa.id)
        .order('created_at', { ascending: false })
      if (cursoId) q = q.eq('curso_id', cursoId)
      const { data: certs } = await q

      let q2 = supabase
        .from('resultados_examen')
        .select(`*, participante:participantes(nombre, correo), curso:cursos(nombre, numero_curso)`)
        .eq('empresa_id', empresa.id)
        .order('created_at', { ascending: false })
      if (cursoId) q2 = q2.eq('curso_id', cursoId)
      const { data: resultados } = await q2

      setDatos({ certs: certs || [], resultados: resultados || [] })
    } finally { setLoading(false) }
  }

  async function generarZIP() {
    if (!datos) return
    setGenerando(true)
    try {
      const cursoSel = cursosDados.find(c => c.curso_id === cursoId)
      const zip = new JSZip()
      const nombreBase = (empresa?.nombre || 'Empresa').replace(/\s+/g, '_')
      const sufijoCurso = cursoSel ? '_' + (cursoSel.curso_nombre || '').replace(/\s+/g, '_') : '_historial_completo'
      const carpeta = zip.folder(`Auditoría_${nombreBase}${sufijoCurso}`)

      // ── CSV de resultados de exámenes ──
      const headerRes = ['Participante', 'Correo', 'WhatsApp', 'Curso', 'Calificación', 'Aprobado', 'Intento', 'Fecha']
      const rowsRes = datos.resultados.map(r => [
        r.participante?.nombre || '',
        r.participante?.correo || '',
        r.participante?.whatsapp || '',
        r.curso?.nombre || '',
        `${r.calificacion}%`,
        r.aprobado ? 'SÍ' : 'NO',
        r.intento || 1,
        new Date(r.created_at).toLocaleDateString('es-MX')
      ].map(v => `"${v}"`).join(','))
      const csvResultados = [headerRes.join(','), ...rowsRes].join('\n')
      carpeta.file('resultados_examenes.csv', '\uFEFF' + csvResultados)

      // ── Respuestas detalladas de cada examen (una por alumno) ──
      const respFolder = carpeta.folder('respuestas_examenes')
      const cursoIds = [...new Set(datos.resultados.map(r => r.curso_id).filter(Boolean))]
      const preguntasPorCurso = {}
      for (const cid of cursoIds) {
        const { data: pregs } = await supabase.from('preguntas').select('*').eq('curso_id', cid).order('orden')
        preguntasPorCurso[cid] = pregs || []
      }
      for (const r of datos.resultados) {
        const pregs = preguntasPorCurso[r.curso_id] || []
        const html = htmlRespuestasExamen(r, pregs)
        const nombreArch = `${(r.participante?.nombre || 'alumno').replace(/\s+/g, '_')}_${(r.curso?.nombre || 'curso').replace(/\s+/g, '_')}_intento${r.intento || 1}.html`
        respFolder.file(nombreArch, html)
      }

      // ── CSV de certificados ──
      const headerCert = ['ID Único', 'Participante', 'Correo', 'Curso', 'Modalidad', 'Lugar', 'Duración (hrs)', 'Fecha emisión', 'URL Verificación']
      const rowsCert = datos.certs.map(c => [
        c.id_unico,
        c.nombre_participante,
        c.participante?.correo || '',
        c.nombre_curso,
        c.modalidad === 'presencial' ? 'Presencial' : 'Online',
        c.lugar,
        c.duracion,
        new Date(c.fecha_emision).toLocaleDateString('es-MX'),
        `${APP_URL}/verificar/${c.id_unico}`
      ].map(v => `"${v}"`).join(','))
      const csvCerts = [headerCert.join(','), ...rowsCert].join('\n')
      carpeta.file('certificados_emitidos.csv', '\uFEFF' + csvCerts)

      // ── HTML de certificados individuales (uno por participante) ──
      const certFolder = carpeta.folder('certificados_pdf')
      for (const cert of datos.certs) {
        const qr = await generarQRBase64(cert.id_unico)
        const html = construirHTMLCertificado({ cert, qrBase64: qr })
        const nombre = `${cert.id_unico}_${cert.nombre_participante.replace(/\s+/g, '_')}.html`
        certFolder.file(nombre, html)
      }

      // ── README de instrucciones ──
      const readme = `ENTREGABLE DE AUDITORÍA — HABLANDO CON DATOS
Empresa: ${empresa?.nombre || ''}
Alcance: ${cursoSel ? 'Curso: ' + cursoSel.curso_nombre : 'Historial completo de la empresa'}
Generado: ${new Date().toLocaleDateString('es-MX')}

CONTENIDO:
- resultados_examenes.csv → Resultados detallados de todos los exámenes
- respuestas_examenes/ → Respuestas de cada alumno (qué contestó y cuál era la correcta)
- certificados_emitidos.csv → Lista de certificados con links de verificación
- certificados_pdf/ → Archivos HTML individuales por participante
  (Abre cada archivo en el navegador y usa Ctrl+P para guardar como PDF)

VERIFICACIÓN EN LÍNEA:
Cada certificado tiene un QR que redirige a ${APP_URL}/verificar/[ID]
donde cualquier reclutador o auditor puede validar su autenticidad.`
      carpeta.file('LEEME.txt', readme)

      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Auditoria_${nombreBase}${sufijoCurso}_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
    } finally { setGenerando(false) }
  }

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
        Descarga el paquete con las constancias y resultados de examen de tu personal. Elige un curso o descarga todo tu historial.
      </p>

      {/* Filtro */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Curso</label>
            <select value={cursoId} onChange={e => { setCursoId(e.target.value); setDatos(null) }} style={inp}>
              <option value="">— Todo mi historial —</option>
              {cursosDados.map(cc => (
                <option key={cc.id} value={cc.curso_id}>
                  {cc.numero_curso ? `#${cc.numero_curso} — ` : ''}{cc.curso_nombre}{cc.fecha_inicio ? ` · ${new Date(cc.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX')}` : ''}
                </option>
              ))}
            </select>
          </div>
          <button onClick={buscar} disabled={loading}
            style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {loading ? 'Buscando...' : '🔍 Ver'}
          </button>
        </div>
        {cursosDados.length === 0 && (
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>Aún no tienes cursos registrados. Puedes intentar "Todo mi historial".</p>
        )}
      </div>

      {/* Resultados */}
      {datos && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Certificados', value: datos.certs.length, color: '#8B1A1A' },
              { label: 'Exámenes', value: datos.resultados.length, color: '#1d4ed8' },
              { label: 'Aprobados', value: datos.resultados.filter(r => r.aprobado).length, color: '#059669' },
              { label: 'No aprobados', value: datos.resultados.filter(r => !r.aprobado).length, color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabla certificados (preview) */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Certificados</h3>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fb' }}>
                    {['ID Único', 'Participante', 'Curso', 'Fecha'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, position: 'sticky', top: 0, background: '#f8f9fb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.certs.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Sin certificados para esta selección</td></tr>
                  )}
                  {datos.certs.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>{c.id_unico}</code>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#1e293b', fontSize: 13 }}>{c.nombre_participante}</td>
                      <td style={{ padding: '10px 16px', color: '#475569', fontSize: 13 }}>{c.nombre_curso}</td>
                      <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{new Date(c.fecha_emision).toLocaleDateString('es-MX')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botón ZIP */}
          <div style={{ background: '#f9f0f0', border: '1px solid #fecaca', borderRadius: 14, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ color: '#8B1A1A', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📦 Descargar paquete ZIP</div>
              <div style={{ color: '#991b1b', fontSize: 13 }}>
                {cursoId ? 'Curso seleccionado' : 'Todo tu historial'} · {datos.certs.length} certificados + {datos.resultados.length} exámenes + resúmenes CSV
              </div>
            </div>
            <button onClick={generarZIP} disabled={generando || (datos.certs.length === 0 && datos.resultados.length === 0)}
              style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {generando ? 'Generando ZIP...' : '⬇️ Descargar ZIP'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function htmlRespuestasExamen(r, preguntas) {
  const resp = typeof r.respuestas_json === 'string'
    ? (() => { try { return JSON.parse(r.respuestas_json) } catch { return {} } })()
    : (r.respuestas_json || {})
  const filas = (preguntas || []).map((q, i) => {
    const elegida = resp[q.id]
    const ops = (q.opciones || []).map((op, oidx) => {
      const esCorrecta = q.respuesta_correcta === oidx
      const esElegida = Number(elegida) === oidx
      const bg = esCorrecta ? '#e8f7ee' : (esElegida ? '#fdecec' : '#f7f7f9')
      const mark = esCorrecta ? '&#10003;' : (esElegida ? '&#10007;' : String.fromCharCode(65 + oidx))
      const eligio = esElegida ? ' <b>(eligi&oacute;)</b>' : ''
      return `<div style="padding:6px 10px;border-radius:6px;margin-bottom:4px;background:${bg};">${mark} ${escapeHtml(op)}${eligio}</div>`
    }).join('')
    const noResp = elegida === undefined ? '<div style="color:#b8860b;font-size:12px;">No respondi&oacute; esta pregunta</div>' : ''
    return `<div style="border:1px solid #e2e2e2;border-radius:8px;padding:12px;margin-bottom:10px;"><div style="font-weight:700;margin-bottom:6px;">${i + 1}. ${escapeHtml(q.pregunta)}</div>${ops}${noResp}</div>`
  }).join('')
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Respuestas ${escapeHtml(r.participante?.nombre || '')}</title></head>
<body style="font-family:Arial,sans-serif;max-width:820px;margin:24px auto;color:#1e293b;padding:0 16px;">
<h2>Respuestas del examen</h2>
<p><b>Participante:</b> ${escapeHtml(r.participante?.nombre || '')} — ${escapeHtml(r.participante?.correo || '')}<br>
<b>Curso:</b> ${escapeHtml(r.curso?.nombre || '')}<br>
<b>Calificaci&oacute;n:</b> ${r.calificacion}% — ${r.aprobado ? 'APROBADO' : 'NO APROBADO'} — Intento #${r.intento || 1}<br>
<b>Fecha:</b> ${new Date(r.created_at).toLocaleDateString('es-MX')}</p>
<hr style="margin:14px 0;">${filas}</body></html>`
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
