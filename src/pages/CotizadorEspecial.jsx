import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const EMAIL = 'ventas@hablandocondatos.com.mx'
const money = function(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }

export default function CotizadorEspecial() {
  var [cursos, setCursos] = useState([])
  var [historial, setHistorial] = useState([])
  var [loading, setLoading] = useState(true)
  var [saving, setSaving] = useState(false)
  var [editandoId, setEditandoId] = useState(null)

  var [folio, setFolio] = useState('')
  var [empresa, setEmpresa] = useState('')
  var [contacto, setContacto] = useState('')
  var [correo, setCorreo] = useState('')
  var [telefono, setTelefono] = useState('')
  var [tipo, setTipo] = useState('curso') // 'curso' | 'servicio'
  var [curso, setCurso] = useState('')
  var [participantes, setParticipantes] = useState(1)
  var [modalidad, setModalidad] = useState('online')
  var [detalleServicio, setDetalleServicio] = useState('')
  var [condicionesManual, setCondicionesManual] = useState('')
  var [precio, setPrecio] = useState(0)
  var [aplicaIva, setAplicaIva] = useState(true)
  var [viaticos, setViaticos] = useState(0)
  var [notas, setNotas] = useState('')

  var subtotal = (Number(precio) || 0) + (Number(viaticos) || 0)
  var iva = aplicaIva ? subtotal * 0.16 : 0
  var total = subtotal + iva

  useEffect(function() { cargar() }, [])

  function cargar() {
    setLoading(true)
    Promise.all([
      supabase.from('cursos').select('id, nombre, duracion').eq('activo', true).order('nombre'),
      supabase.from('cotizaciones_especiales').select('*').order('created_at', { ascending: false }),
    ]).then(function(res) {
      setCursos(res[0].data || [])
      setHistorial(res[1].data || [])
      setLoading(false)
    }).catch(function() { setLoading(false) })
  }

  function nuevoFolio() {
    var nums = historial.map(function(c) { var m = (c.folio || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0 })
    var max = Math.max(52, Math.max.apply(null, nums.length ? nums : [52]))
    var yr = String(new Date().getFullYear()).slice(-2)
    return yr + '-' + String(max + 1).padStart(3, '0')
  }

  function limpiarForm() {
    setEditandoId(null); setFolio(nuevoFolio()); setEmpresa(''); setContacto(''); setCorreo(''); setTelefono('')
    setTipo('curso'); setCurso(''); setParticipantes(1); setModalidad('online')
    setDetalleServicio(''); setCondicionesManual('')
    setPrecio(0); setAplicaIva(true); setViaticos(0); setNotas('')
  }

  function cargarEnForm(c) {
    setEditandoId(c.id); setFolio(c.folio || ''); setEmpresa(c.empresa || ''); setContacto(c.contacto || '')
    setCorreo(c.correo || ''); setTelefono(c.telefono || ''); setTipo(c.tipo || 'curso'); setCurso(c.curso || '')
    setParticipantes(c.participantes || 1); setModalidad(c.modalidad || 'online')
    setDetalleServicio(c.detalle_servicio || ''); setCondicionesManual(c.condiciones_manual || '')
    setPrecio(c.precio || 0); setAplicaIva(c.aplica_iva !== false); setViaticos(c.viaticos || 0); setNotas(c.notas || '')
  }

  function guardar() {
    if (!empresa.trim() || !curso.trim()) { alert(tipo === 'servicio' ? 'Escribe empresa y servicio.' : 'Escribe empresa y curso.'); return }
    setSaving(true)
    var payload = {
      folio: folio.trim() || nuevoFolio(), empresa: empresa.trim(), contacto: contacto.trim(),
      correo: correo.trim(), telefono: telefono.trim(), tipo: tipo, curso: curso.trim(),
      participantes: tipo === 'servicio' ? null : (Number(participantes) || 1),
      modalidad: tipo === 'servicio' ? null : modalidad,
      detalle_servicio: tipo === 'servicio' ? detalleServicio.trim() : null,
      condiciones_manual: tipo === 'servicio' ? condicionesManual.trim() : null,
      precio: Number(precio) || 0, aplica_iva: aplicaIva, viaticos: Number(viaticos) || 0,
      notas: notas.trim(), subtotal: subtotal, iva: iva, total: total,
      estado: 'guardada'
    }
    var prom = editandoId
      ? supabase.from('cotizaciones_especiales').update(payload).eq('id', editandoId)
      : supabase.from('cotizaciones_especiales').insert(payload)
    prom.then(function(r) {
      if (r.error) { alert('Error: ' + r.error.message); setSaving(false); return }
      setSaving(false); limpiarForm(); cargar()
      alert(editandoId ? '✅ Cotización actualizada.' : '✅ Cotización guardada.')
    }).catch(function() { setSaving(false) })
  }

  function duplicar(c) {
    setEditandoId(null); setFolio(nuevoFolio()); setEmpresa(c.empresa || ''); setContacto(c.contacto || '')
    setCorreo(c.correo || ''); setTelefono(c.telefono || ''); setTipo(c.tipo || 'curso'); setCurso(c.curso || '')
    setParticipantes(c.participantes || 1); setModalidad(c.modalidad || 'online')
    setDetalleServicio(c.detalle_servicio || ''); setCondicionesManual(c.condiciones_manual || '')
    setPrecio(c.precio || 0); setAplicaIva(c.aplica_iva !== false); setViaticos(c.viaticos || 0); setNotas(c.notas || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function eliminar(c) {
    if (!window.confirm('¿Eliminar la cotización ' + (c.folio || '') + '?')) return
    supabase.from('cotizaciones_especiales').delete().eq('id', c.id).then(function() { cargar() })
  }

  function generarPDF(c) {
    var d = c || { folio: folio, empresa: empresa, contacto: contacto, correo: correo, telefono: telefono, tipo: tipo, curso: curso, participantes: participantes, modalidad: modalidad, detalle_servicio: detalleServicio, condiciones_manual: condicionesManual, precio: precio, aplica_iva: aplicaIva, viaticos: viaticos, notas: notas, subtotal: subtotal, iva: iva, total: total }
    var esServicio = d.tipo === 'servicio'
    var fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    var st = (Number(d.precio)||0) + (Number(d.viaticos)||0)
    var iv = d.aplica_iva ? st * 0.16 : 0
    var tot = st + iv
    var detalleCol = esServicio ? (d.detalle_servicio || '') : ((d.participantes||1) + ' persona(s) · ' + (d.modalidad||''))
    // Condiciones: en cursos se imprimen fijas; en servicios solo si se escribieron a mano (si no, se omite la sección completa)
    var condicionesHtml = ''
    if (esServicio) {
      if (d.condiciones_manual && d.condiciones_manual.trim()) {
        condicionesHtml = '<div class="condiciones"><h3 style="margin-bottom:8px;color:#1e293b">Condiciones</h3>' +
          String(d.condiciones_manual).replace(/\n/g, '<br/>') + '</div>'
      }
    } else {
      condicionesHtml = '<div class="condiciones"><h3 style="margin-bottom:8px;color:#1e293b">Condiciones</h3>' +
        '• Cotización válida por 90 días naturales.<br/>' +
        '• Precios en pesos mexicanos (MXN). ' + (d.aplica_iva ? 'IVA del 16% incluido.' : 'Precio sin IVA.') + '<br/>' +
        '• Incluye constancias con folio único verificable.<br/>' +
        (d.modalidad === 'online'
          ? '• El monto total deberá liquidarse un día antes de que comience el curso.<br/>'
          : '• Incluye material didáctico.<br/>• La empresa deberá proporcionar y/o gestionar: aula de capacitación, pizarrón, proyector, conexión eléctrica y de preferencia acceso a internet (opcional, de acuerdo a los protocolos de seguridad de la empresa).<br/>') +
        '• Contacto: WhatsApp 222 354 9353 · ' + EMAIL + '</div>'
    }
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotización ' + d.folio + '</title>' +
      '<style>@page{size:letter;margin:20mm}body{font-family:Segoe UI,sans-serif;font-size:13px;color:#1e293b;line-height:1.5}' +
      '.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #8B1A1A}' +
      '.logo{font-size:22px;font-weight:800;color:#8B1A1A}.folio{text-align:right;font-size:12px;color:#475569}' +
      '.cliente{background:#f8f9fb;border-radius:8px;padding:16px;margin-bottom:20px}' +
      '.cliente h3{margin:0 0 8px;font-size:14px;color:#8B1A1A}.cliente p{margin:2px 0;font-size:12px;color:#475569}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#8B1A1A;color:#fff;padding:10px 12px;font-size:12px;text-align:left}' +
      'td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}' +
      '.totales{text-align:right;margin-bottom:20px}.totales td{border:none;padding:4px 12px}.totales .gran{font-size:18px;font-weight:800;color:#8B1A1A}' +
      '.condiciones{background:#f8f9fb;border-radius:8px;padding:16px;font-size:11px;color:#475569;line-height:1.8}' +
      '</style></head><body>' +
      '<div class="header"><div class="logo">Hablando con Datos<br/><span style="font-size:11px;font-weight:400;color:#64748b">Consultoría y Capacitación</span></div>' +
      '<div class="folio"><strong>Cotización Especial</strong><br/>' + d.folio + '<br/>' + fecha + '</div></div>' +
      '<div class="cliente"><h3>' + (d.empresa||'') + '</h3>' +
      (d.contacto ? '<p>Contacto: ' + d.contacto + '</p>' : '') +
      (d.correo ? '<p>Correo: ' + d.correo + '</p>' : '') +
      (d.telefono ? '<p>Teléfono: ' + d.telefono + '</p>' : '') + '</div>' +
      '<table><thead><tr><th>Concepto</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead><tbody>' +
      '<tr><td><strong>' + (d.curso||'') + '</strong></td><td>' + detalleCol + '</td><td style="text-align:right">' + money(d.precio) + '</td></tr>' +
      (Number(d.viaticos) > 0 ? '<tr><td>Viáticos</td><td>Estimado</td><td style="text-align:right">' + money(d.viaticos) + '</td></tr>' : '') +
      '</tbody></table>' +
      '<table class="totales"><tr><td>Subtotal</td><td>' + money(st) + '</td></tr>' +
      (d.aplica_iva ? '<tr><td>IVA (16%)</td><td>' + money(iv) + '</td></tr>' : '') +
      '<tr class="gran"><td>Total</td><td>' + money(tot) + '</td></tr></table>' +
      (d.notas ? '<div style="margin-bottom:16px;padding:12px;background:#fffbeb;border-radius:8px;font-size:12px;color:#92400e"><strong>Notas:</strong> ' + d.notas + '</div>' : '') +
      condicionesHtml +
      '<div style="text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8">' +
      '<p>Hablando con Datos — Consultoría y Capacitación · Puebla, México</p>' +
      '<p>Folio: ' + d.folio + ' · 222 354 9353 · ' + EMAIL + '</p></div>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>'
    var w = window.open('', '_blank'); w.document.write(html); w.document.close()
  }

  function exportarExcel() {
    if (!historial.length) { alert('No hay cotizaciones.'); return }
    var filas = historial.map(function(c) { return { Folio: c.folio, Tipo: c.tipo === 'servicio' ? 'Servicio' : 'Curso', Empresa: c.empresa, Contacto: c.contacto, Correo: c.correo, 'Curso/Servicio': c.curso, 'Detalle servicio': c.detalle_servicio || '', Participantes: c.participantes || '', Modalidad: c.modalidad || '', Precio: c.precio, IVA: c.iva, Total: c.total, Estado: c.estado, Notas: c.notas, Fecha: c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX') : '' } })
    var ws = XLSX.utils.json_to_sheet(filas); var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Cotizaciones')
    XLSX.writeFile(wb, 'cotizaciones_especiales_' + new Date().toISOString().slice(0, 10) + '.xlsx')
  }

  // Init folio on first load
  useEffect(function() { if (!loading && !folio) setFolio(nuevoFolio()) }, [loading])

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando...</div>

  var EST = { borrador: { l: 'Borrador', bg: '#f1f5f9', c: '#64748b' }, guardada: { l: 'Guardada', bg: '#eff6ff', c: '#1d4ed8' }, enviada: { l: 'Enviada', bg: '#fef9c3', c: '#92400e' }, aceptada: { l: 'Aceptada', bg: '#f0fdf4', c: '#059669' } }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Cotizador Especial</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Genera cotizaciones, guárdalas y decide después si generas el PDF. Puedes editar, duplicar o crear nuevas sobre las existentes.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button onClick={limpiarForm} style={Object.assign({}, BTN, { background: editandoId ? '#059669' : '#8B1A1A' })}>
          {editandoId ? '+ Nueva cotización (limpia el form)' : '📝 Nueva cotización'}
        </button>
      </div>

      {/* ═══ FORMULARIO ═══ */}
      <div style={{ background: '#fff', border: editandoId ? '2px solid #1d4ed8' : '1px solid #e2e8f0', borderRadius: 16, padding: 'clamp(18px,4vw,28px)', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: editandoId ? '#1d4ed8' : '#8B1A1A' }}>{editandoId ? '✏️ Editando cotización' : '📝 Nueva cotización'}</h2>
          {editandoId && <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Editando existente</span>}
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <label style={LBL}>Folio (editable)</label>
            <input value={folio} onChange={function(e){setFolio(e.target.value)}} style={Object.assign({}, INP, { width: 140, fontWeight: 700, fontSize: 16, color: '#8B1A1A', textAlign: 'center' })} />
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11, paddingBottom: 10 }}>Se sugiere el siguiente. Puedes editarlo.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
          <div><label style={LBL}>Empresa</label><input value={empresa} onChange={function(e){setEmpresa(e.target.value)}} placeholder="Nombre de la empresa" style={INP} /></div>
          <div><label style={LBL}>Contacto</label><input value={contacto} onChange={function(e){setContacto(e.target.value)}} placeholder="Nombre del contacto" style={INP} /></div>
          <div><label style={LBL}>Correo</label><input value={correo} onChange={function(e){setCorreo(e.target.value)}} placeholder="correo@empresa.com" style={INP} /></div>
          <div><label style={LBL}>Teléfono</label><input value={telefono} onChange={function(e){setTelefono(e.target.value)}} placeholder="WhatsApp o teléfono" style={INP} /></div>
        </div>
        <label style={LBL}>¿Qué se cotiza?</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[['curso', '🎓 Curso'], ['servicio', '🧰 Servicio']].map(function(t) {
            return <button key={t[0]} type="button" onClick={function(){setTipo(t[0])}}
              style={{ flex: 1, maxWidth: 220, padding: '9px', border: '2px solid ' + (tipo === t[0] ? '#8B1A1A' : '#e2e8f0'), borderRadius: 8, background: tipo === t[0] ? '#f9f0f0' : '#fff', color: tipo === t[0] ? '#8B1A1A' : '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{t[1]}</button>
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={LBL}>{tipo === 'servicio' ? 'Servicio' : 'Curso'}</label>
            {tipo === 'servicio' ? (
              <input value={curso} onChange={function(e){setCurso(e.target.value)}} placeholder="Ej: Consultoría de implementación ISO 9001" style={INP} />
            ) : (
              <>
                <input list="cursos-esp" value={curso} onChange={function(e){setCurso(e.target.value)}} placeholder="Escribe o selecciona" style={INP} />
                <datalist id="cursos-esp">{cursos.map(function(c){return <option key={c.id} value={c.nombre} />})}</datalist>
              </>
            )}
          </div>
          {tipo === 'curso' && <>
            <div><label style={LBL}>Participantes</label><input type="number" min="1" value={participantes} onChange={function(e){setParticipantes(e.target.value)}} style={INP} /></div>
            <div><label style={LBL}>Modalidad</label><select value={modalidad} onChange={function(e){setModalidad(e.target.value)}} style={INP}><option value="online">Online</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option></select></div>
          </>}
          <div><label style={LBL}>Precio total (MXN)</label><input type="number" min="0" step="100" value={precio} onChange={function(e){setPrecio(e.target.value)}} style={INP} /></div>
        </div>

        {tipo === 'servicio' && (
          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Detalle del servicio</label>
            <textarea value={detalleServicio} onChange={function(e){setDetalleServicio(e.target.value)}} placeholder="Describe aquí lo que incluye: alcance, participantes, modalidad, entregables, etc." rows={3} style={Object.assign({}, INP, { resize: 'vertical' })} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}><input type="checkbox" checked={aplicaIva} onChange={function(e){setAplicaIva(e.target.checked)}} /> Aplica IVA (16%)</label>
          <div><label style={LBL}>Viáticos</label><input type="number" min="0" step="100" value={viaticos} onChange={function(e){setViaticos(e.target.value)}} style={Object.assign({}, INP, { width: 140 })} /></div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={LBL}>Notas</label><textarea value={notas} onChange={function(e){setNotas(e.target.value)}} placeholder="Notas para el cliente o internas" rows={2} style={Object.assign({}, INP, { resize: 'vertical' })} /></div>

        {tipo === 'servicio' && (
          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Condiciones (opcional — se imprimen tal cual las escribas; si lo dejas vacío, el PDF no lleva sección de condiciones)</label>
            <textarea value={condicionesManual} onChange={function(e){setCondicionesManual(e.target.value)}} placeholder={'Ej:\n• Vigencia de la cotización: 30 días.\n• Forma de pago: 50% anticipo, 50% contra entrega.'} rows={3} style={Object.assign({}, INP, { resize: 'vertical' })} />
          </div>
        )}

        <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 22px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Precio: {money(precio)}{Number(viaticos)>0 ? ' + Viáticos: '+money(viaticos) : ''}{aplicaIva ? ' + IVA: '+money(iva) : ''}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Total: {money(total)}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={guardar} disabled={saving} style={BTN}>{saving ? 'Guardando...' : editandoId ? '💾 Actualizar cotización' : '💾 Guardar cotización'}</button>
          <button onClick={function(){guardar(); setTimeout(function(){}, 500)}} disabled={saving} style={Object.assign({}, BTN, { background: '#1e293b' })}>{saving ? 'Guardando...' : '💾📄 Guardar + PDF'}</button>
          <button onClick={function(){generarPDF(null)}} style={Object.assign({}, BTN, { background: '#fff', color: '#475569', border: '1px solid #e2e8f0' })}>📄 Solo PDF (sin guardar)</button>
        </div>
      </div>

      {/* ═══ HISTORIAL ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Historial de cotizaciones ({historial.length})</h2>
        <button onClick={exportarExcel} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇️ Excel</button>
      </div>

      {historial.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aún no has generado cotizaciones.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {historial.map(function(c) {
            var est = EST[c.estado] || EST.guardada
            return (
              <div key={c.id} style={{ background: '#fff', border: editandoId === c.id ? '2px solid #1d4ed8' : '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{c.folio}</code>
                    {c.tipo === 'servicio' && <span style={{ marginLeft: 8, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>🧰 Servicio</span>}
                    <span style={{ marginLeft: 10, fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{c.empresa}</span>
                    <span style={{ marginLeft: 8, color: '#64748b', fontSize: 12 }}>{c.curso}{c.tipo === 'servicio' ? '' : ' · ' + c.participantes + 'p · ' + c.modalidad}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#8B1A1A', fontSize: 15 }}>{money(c.total)}</span>
                    <span style={{ background: est.bg, color: est.c, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{est.l}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button onClick={function(){cargarEnForm(c)}} style={BTN2}>✏️ Editar</button>
                  <button onClick={function(){duplicar(c)}} style={BTN2}>📋 Duplicar (nueva)</button>
                  <button onClick={function(){generarPDF(c)}} style={Object.assign({}, BTN2, { color: '#1e293b', fontWeight: 700 })}>📄 PDF</button>
                  <select value={c.estado} onChange={function(e){supabase.from('cotizaciones_especiales').update({estado:e.target.value}).eq('id',c.id).then(function(){cargar()})}} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}>
                    <option value="borrador">Borrador</option><option value="guardada">Guardada</option><option value="enviada">Enviada</option><option value="aceptada">Aceptada</option>
                  </select>
                  <button onClick={function(){eliminar(c)}} style={Object.assign({}, BTN2, { color: '#dc2626', borderColor: '#fecaca' })}>🗑</button>
                </div>
                {c.notas && <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>📝 {c.notas}</div>}
                <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8' }}>{c.correo || ''} · {c.telefono || ''} · {c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX') : ''}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

var BTN = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
var BTN2 = { background: '#f8f9fb', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }
var INP = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
var LBL = { display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 4, marginTop: 12 }
