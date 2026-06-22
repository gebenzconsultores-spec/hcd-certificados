import { useEffect, useState } from 'react'
import { getEmpresas, getCursos, supabase } from '../lib/supabase'
import { generarQRBase64 } from '../lib/certificado'
import JSZip from 'jszip'

const APP_URL = import.meta.env.VITE_APP_URL || 'https://hcd-certificados.vercel.app'

export default function Auditoria() {
  const [empresas, setEmpresas] = useState([])
  const [cursos, setCursos] = useState([])
  const [empresaId, setEmpresaId] = useState('')
  const [cursoId, setCursoId] = useState('')
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    getEmpresas().then(setEmpresas)
    getCursos().then(setCursos)
  }, [])

  async function buscar() {
    if (!empresaId) return
    setLoading(true)
    setDatos(null)
    try {
      let q = supabase
        .from('certificados')
        .select(`*, participante:participantes(nombre, correo, whatsapp), curso:cursos(nombre, numero_curso, duracion)`)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (cursoId) q = q.eq('curso_id', cursoId)
      const { data: certs } = await q

      let q2 = supabase
        .from('resultados_examen')
        .select(`*, participante:participantes(nombre, correo), curso:cursos(nombre, numero_curso)`)
        .eq('empresa_id', empresaId)
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
      const empresa = empresas.find(e => e.id === empresaId)
      const zip = new JSZip()
      const nombreEmpresa = empresa?.nombre?.replace(/\s+/g, '_') || 'Empresa'
      const carpeta = zip.folder(`Auditoría_${nombreEmpresa}`)

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
        const fecha = new Date(cert.fecha_emision).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
        const html = generarHTMLCertificado(cert, qr, fecha)
        const nombre = `${cert.id_unico}_${cert.nombre_participante.replace(/\s+/g, '_')}.html`
        certFolder.file(nombre, html)
      }

      // ── README de instrucciones ──
      const readme = `ENTREGABLE DE AUDITORÍA — HABLANDO CON DATOS
Empresa: ${empresa?.nombre || ''}
Generado: ${new Date().toLocaleDateString('es-MX')}

CONTENIDO:
- resultados_examenes.csv → Resultados detallados de todos los exámenes
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
      a.download = `Auditoria_${nombreEmpresa}_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
    } finally { setGenerando(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Auditoría y entregables</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Genera el paquete ZIP con certificados y resultados de examen por empresa</p>
      </div>

      {/* Filtros */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Empresa *</label>
            <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} style={inputStyle}>
              <option value="">— Selecciona empresa —</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Curso (opcional — todos si no seleccionas)</label>
            <select value={cursoId} onChange={e => setCursoId(e.target.value)} style={inputStyle}>
              <option value="">— Todos los cursos —</option>
              {cursos.map(c => <option key={c.id} value={c.id}>#{c.numero_curso} — {c.nombre}</option>)}
            </select>
          </div>
          <button onClick={buscar} disabled={!empresaId || loading}
            style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {loading ? 'Buscando...' : '🔍 Buscar'}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {datos && (
        <>
          {/* Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Certificados', value: datos.certs.length, color: '#8B1A1A' },
              { label: 'Exámenes aplicados', value: datos.resultados.length, color: '#1d4ed8' },
              { label: 'Aprobados', value: datos.resultados.filter(r => r.aprobado).length, color: '#059669' },
              { label: 'No aprobados', value: datos.resultados.filter(r => !r.aprobado).length, color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabla certificados */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Certificados emitidos</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['ID Único', 'Participante', 'Curso', 'Modalidad', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.certs.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Sin certificados para esta selección</td></tr>
                )}
                {datos.certs.map(c => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>{c.id_unico}</code>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#1e293b', fontSize: 13 }}>{c.nombre_participante}</td>
                    <td style={{ padding: '10px 16px', color: '#475569', fontSize: 13 }}>{c.nombre_curso}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: c.modalidad === 'presencial' ? '#eff6ff' : '#f0fdf4', color: c.modalidad === 'presencial' ? '#1d4ed8' : '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                        {c.modalidad === 'presencial' ? 'Presencial' : 'Online'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{new Date(c.fecha_emision).toLocaleDateString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabla resultados */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Resultados de exámenes</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Participante', 'Curso', 'Calificación', 'Resultado', 'Intento', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.resultados.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Sin resultados para esta selección</td></tr>
                )}
                {datos.resultados.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 16px', color: '#1e293b', fontSize: 13 }}>{r.participante?.nombre}</td>
                    <td style={{ padding: '10px 16px', color: '#475569', fontSize: 13 }}>{r.curso?.nombre}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: r.aprobado ? '#059669' : '#dc2626', fontSize: 14 }}>{r.calificacion}%</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: r.aprobado ? '#f0fdf4' : '#fef2f2', color: r.aprobado ? '#059669' : '#dc2626', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {r.aprobado ? '✓ Aprobado' : '✗ No aprobado'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#64748b', fontSize: 13 }}>#{r.intento || 1}</td>
                    <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botón ZIP */}
          <div style={{ background: '#f9f0f0', border: '1px solid #fecaca', borderRadius: 14, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#8B1A1A', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📦 Generar paquete ZIP de auditoría</div>
              <div style={{ color: '#991b1b', fontSize: 13 }}>
                Incluye: {datos.certs.length} certificados (HTML → PDF) + {datos.resultados.length} resultados de examen + resumen CSV
              </div>
            </div>
            <button onClick={generarZIP} disabled={generando || datos.certs.length === 0}
              style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {generando ? 'Generando ZIP...' : '⬇️ Descargar ZIP'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function generarHTMLCertificado(cert, qrBase64, fecha) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Certificado ${cert.id_unico}</title>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,600;1,400&family=Special+Elite&family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
@page{size:landscape;margin:0;}
body{width:279mm;height:216mm;overflow:hidden;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:'Inter',sans-serif;}
.cert{width:279mm;height:216mm;position:relative;background:#fff;padding:14mm 18mm 10mm 18mm;display:flex;flex-direction:column;}
.lineas-top{position:absolute;top:8mm;right:18mm;display:flex;flex-direction:column;gap:2mm;}
.linea-dec{height:2.5px;background:#8B1A1A;width:100mm;}
.header{display:flex;align-items:center;margin-bottom:8mm;}
.cuerpo{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;}
.empresa{font-size:15pt;font-weight:700;color:#8B1A1A;margin-bottom:1.5mm;}
.subtitulo{font-size:10pt;color:#444;margin-bottom:5mm;}
.nombre{font-family:'Crimson Text',serif;font-style:italic;font-size:28pt;color:#1a1a1a;margin-bottom:6mm;}
.por{font-size:9pt;color:#555;margin-bottom:1mm;}
.participar{font-size:11pt;font-weight:700;margin-bottom:1mm;}
.el-curso{font-size:9pt;color:#555;margin-bottom:2mm;}
.curso{font-family:'Special Elite',monospace;font-size:18pt;}
.qr{position:absolute;right:18mm;top:55mm;width:22mm;height:22mm;}
.firmas{display:flex;gap:20mm;margin-top:8mm;}
.firma{display:flex;flex-direction:column;align-items:center;min-width:50mm;}
.linea-firma{width:50mm;height:1px;background:#1a1a1a;margin-bottom:1.5mm;}
.fnombre{font-size:8.5pt;font-weight:700;}
.fcargo{font-size:7.5pt;color:#555;}
.frfc{font-size:7pt;color:#888;}
.datos{position:absolute;right:18mm;bottom:30mm;text-align:right;}
.dato{display:flex;justify-content:flex-end;align-items:baseline;gap:3mm;margin-bottom:1.5mm;}
.dlabel{font-size:8pt;color:#666;}
.dval{font-size:8.5pt;font-weight:700;}
.pie{position:absolute;bottom:6mm;left:18mm;font-size:7pt;color:#aaa;}
</style>
</head>
<body>
<div class="cert">
  <div class="lineas-top"><div class="linea-dec"></div><div class="linea-dec"></div></div>
  <div class="header">
    <span style="font-weight:800;color:#8B1A1A;font-size:16pt;">Hablando con Datos</span>
  </div>
  <div class="cuerpo">
    <div class="empresa">Hablando con Datos</div>
    <div class="subtitulo">Otorga el presente reconocimiento a:</div>
    <div class="nombre">${cert.nombre_participante}</div>
    <div class="por">Por</div>
    <div class="participar">Participar y Aprobar</div>
    <div class="el-curso">el curso:</div>
    <div class="curso">${cert.nombre_curso}</div>
  </div>
  ${qrBase64 ? `<img src="${qrBase64}" class="qr"/>` : ''}
  <div class="firmas">
    <div class="firma">
      <div class="linea-firma"></div>
      <div class="fnombre">${cert.instructor_nombre || 'Néstor Daniel Reyes Díaz'}</div>
      <div class="fcargo">Instructor</div>
      <div class="frfc">${cert.instructor_rfc || 'REDN-770428-433-0005'}</div>
    </div>
    <div class="firma">
      <div class="linea-firma"></div>
      <div class="fnombre">${cert.director_nombre || 'Mirna Rosas Delgado'}</div>
      <div class="fcargo">Dirección</div>
    </div>
  </div>
  <div class="datos">
    <div class="dato"><span class="dlabel">IDúnico*:</span><span class="dval">${cert.id_unico}</span></div>
    <div class="dato"><span class="dlabel">Impartido en:</span><span class="dval">${cert.lugar}</span></div>
    <div class="dato"><span class="dlabel">Duración (equivalente):</span><span class="dval">${cert.duracion} Hrs</span></div>
    <div class="dato"><span class="dlabel">Fecha:</span><span class="dval">${fecha}</span></div>
  </div>
  <div class="pie">HCD-F-16 Rev2024</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body>
</html>`
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
