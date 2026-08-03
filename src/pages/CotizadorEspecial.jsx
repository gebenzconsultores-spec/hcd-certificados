import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const EMAIL = 'ventas@hablandocondatos.com.mx'
const money = n => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fLocal = f => f ? new Date(String(f).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX') : ''

export default function CotizadorEspecial() {
  const [cursos, setCursos] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [subiendoOC, setSubiendoOC] = useState(false)

  const [form, setForm] = useState({
    empresa_nombre: '', contacto_nombre: '', contacto_correo: '', contacto_tel: '',
    curso_nombre: '', num_personas: 1, modalidad: 'online', precio_total: 0,
    aplica_iva: true, notas: '', incluye_viaticos: false, viaticos: 0
  })
  const f = k => v => setForm(p => ({ ...p, [k]: typeof v === 'object' && v.target ? v.target.value : v }))

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [c, q] = await Promise.all([
      supabase.from('cursos').select('id, nombre, duracion, categoria').eq('activo', true).order('nombre'),
      supabase.from('cotizaciones').select('*').eq('es_especial', true).order('created_at', { ascending: false }),
    ])
    setCursos(c.data || [])
    setCotizaciones(q.data || [])
    setLoading(false)
  }

  const subtotal = (Number(form.precio_total) || 0) + (form.incluye_viaticos ? Number(form.viaticos) || 0 : 0)
  const iva = form.aplica_iva ? subtotal * 0.16 : 0
  const total = subtotal + iva

  function nuevoFolio() {
    const y = new Date().getFullYear()
    const nums = cotizaciones.map(c => { const m = (c.folio || '').match(/HCD-ESP-\d{4}-(\d+)/); return m ? parseInt(m[1], 10) : 0 })
    return `HCD-ESP-${y}-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`
  }

  function limpiarForm() {
    setForm({ empresa_nombre: '', contacto_nombre: '', contacto_correo: '', contacto_tel: '', curso_nombre: '', num_personas: 1, modalidad: 'online', precio_total: 0, aplica_iva: true, notas: '', incluye_viaticos: false, viaticos: 0 })
  }

  function buildHTML(folio, datos) {
    const d = datos || form
    const st = (Number(d.precio_total) || 0) + (d.incluye_viaticos ? Number(d.viaticos) || 0 : 0)
    const iv = d.aplica_iva ? st * 0.16 : 0
    const tot = st + iv
    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotización ${folio}</title>
<style>@page{size:letter;margin:20mm}body{font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#1e293b;line-height:1.5}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #8B1A1A}
.logo{font-size:22px;font-weight:800;color:#8B1A1A}.folio{text-align:right;font-size:12px;color:#475569}
.cliente{background:#f8f9fb;border-radius:8px;padding:16px;margin-bottom:20px}
.cliente h3{margin:0 0 8px;font-size:14px;color:#8B1A1A}.cliente p{margin:2px 0;font-size:12px;color:#475569}
table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#8B1A1A;color:#fff;padding:10px 12px;font-size:12px;text-align:left}
td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
.totales{text-align:right;margin-bottom:20px}.totales td{border:none;padding:4px 12px}.totales .gran{font-size:18px;font-weight:800;color:#8B1A1A}
.condiciones{background:#f8f9fb;border-radius:8px;padding:16px;font-size:11px;color:#475569;line-height:1.8}
.footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
</style></head><body>
<div class="header">
  <div class="logo">Hablando con Datos<br/><span style="font-size:11px;font-weight:400;color:#64748b">Consultoría y Capacitación</span></div>
  <div class="folio"><strong>Cotización Especial</strong><br/>${folio}<br/>${fecha}</div>
</div>
<div class="cliente">
  <h3>${d.empresa_nombre || 'Cliente'}</h3>
  ${d.contacto_nombre ? `<p>Contacto: ${d.contacto_nombre}</p>` : ''}
  ${d.contacto_correo ? `<p>Correo: ${d.contacto_correo}</p>` : ''}
  ${d.contacto_tel ? `<p>Teléfono: ${d.contacto_tel}</p>` : ''}
</div>
<table>
  <thead><tr><th>Concepto</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
  <tbody>
    <tr><td><strong>${d.curso_nombre || 'Capacitación'}</strong></td><td>${d.num_personas || 1} persona(s) · ${d.modalidad || 'online'}</td><td style="text-align:right">${money(d.precio_total)}</td></tr>
    ${d.incluye_viaticos && Number(d.viaticos) > 0 ? `<tr><td>Viáticos</td><td>Estimado</td><td style="text-align:right">${money(d.viaticos)}</td></tr>` : ''}
  </tbody>
</table>
<table class="totales">
  <tr><td>Subtotal</td><td>${money(st)}</td></tr>
  ${d.aplica_iva ? `<tr><td>IVA (16%)</td><td>${money(iv)}</td></tr>` : ''}
  <tr class="gran"><td>Total</td><td>${money(tot)}</td></tr>
</table>
${d.notas ? `<div style="margin-bottom:16px;padding:12px;background:#fffbeb;border-radius:8px;font-size:12px;color:#92400e"><strong>Notas:</strong> ${d.notas}</div>` : ''}
<div class="condiciones">
  <h3 style="margin-bottom:8px;color:#1e293b">Condiciones</h3>
  • Cotización válida por 90 días naturales.<br/>
  • Precios en pesos mexicanos (MXN). ${d.aplica_iva ? 'IVA del 16% incluido.' : 'Precio sin IVA.'}<br/>
  • La capacitación se confirma contra anticipo del 20%.<br/>
  • Contactar con ventas para renegociar precio especial por uso de plataforma.<br/>
  • Incluye material didáctico y constancias con folio único verificable.<br/>
  • Contacto: WhatsApp 222 354 9353 · ${EMAIL}
</div>
<div class="footer">
  <p>Hablando con Datos — Consultoría y Capacitación · Puebla, México</p>
  <p>Folio: ${folio} · Gerencia de Ventas: 222 354 9353 · ${EMAIL}</p>
</div>
<script>window.onload=()=>{window.print();}</script></body></html>`
  }

  function abrirPDF(folio, datos) {
    const w = window.open('', '_blank')
    w.document.write(buildHTML(folio, datos))
    w.document.close()
  }

  async function guardar() {
    if (!form.empresa_nombre || !form.curso_nombre) { alert('Escribe empresa y curso.'); return }
    setSaving(true)
    const folio = nuevoFolio()
    try {
      const { error } = await supabase.from('cotizaciones').insert({
        folio, empresa_nombre: form.empresa_nombre,
        contacto_nombre: form.contacto_nombre, contacto_correo: form.contacto_correo, contacto_telefono: form.contacto_tel,
        curso_nombre: form.curso_nombre, num_personas: Number(form.num_personas) || 1, modalidad: form.modalidad,
        subtotal, iva, total, aplica_iva: form.aplica_iva, notas: form.notas,
        estado: 'enviada', es_especial: true, es_cliente_nuevo: false,
      })
      if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
      alert(`✅ Cotización ${folio} guardada.`)
      limpiarForm()
      await cargar()
    } catch (e) { alert('Error: ' + (e.message || '')) }
    setSaving(false)
  }

  async function guardarYPDF() {
    if (!form.empresa_nombre || !form.curso_nombre) { alert('Escribe empresa y curso.'); return }
    setSaving(true)
    const folio = nuevoFolio()
    try {
      const { error } = await supabase.from('cotizaciones').insert({
        folio, empresa_nombre: form.empresa_nombre,
        contacto_nombre: form.contacto_nombre, contacto_correo: form.contacto_correo, contacto_telefono: form.contacto_tel,
        curso_nombre: form.curso_nombre, num_personas: Number(form.num_personas) || 1, modalidad: form.modalidad,
        subtotal, iva, total, aplica_iva: form.aplica_iva, notas: form.notas,
        estado: 'enviada', es_especial: true, es_cliente_nuevo: false,
      })
      if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
      abrirPDF(folio)
      limpiarForm()
      await cargar()
    } catch (e) { alert('Error: ' + (e.message || '')) }
    setSaving(false)
  }

  function soloPDF() {
    if (!form.empresa_nombre || !form.curso_nombre) { alert('Escribe empresa y curso.'); return }
    abrirPDF(`BORRADOR-${Date.now()}`)
  }

  async function eliminar(c) {
    if (!window.confirm(`¿Eliminar la cotización ${c.folio}?`)) return
    const { error } = await supabase.from('cotizaciones').delete().eq('id', c.id)
    if (error) { alert('Error: ' + error.message); return }
    if (detalle?.id === c.id) setDetalle(null)
    await cargar()
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('cotizaciones').update({ estado }).eq('id', id)
    setCotizaciones(prev => prev.map(c => c.id === id ? { ...c, estado } : c))
  }

  async function subirOC(cot, file) {
    if (!file || file.type !== 'application/pdf') { alert('Solo archivos PDF.'); return }
    setSubiendoOC(true)
    try {
      const nombreArchivo = `oc_esp_${cot.folio}_${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage.from('ordenes-compra').upload(nombreArchivo, file, { upsert: true })
      if (upErr) { alert('Error al subir: ' + upErr.message); setSubiendoOC(false); return }
      const { data: urlData } = supabase.storage.from('ordenes-compra').getPublicUrl(nombreArchivo)
      await supabase.from('cotizaciones').update({ orden_compra_url: urlData.publicUrl, estado: 'aceptada' }).eq('id', cot.id)
      try {
        await supabase.from('ventas').insert({
          empresa_nombre: cot.empresa_nombre, empresa_registrada: false,
          curso_nombre: cot.curso_nombre, monto: cot.total, num_personas: cot.num_personas || 1,
          cotizacion_id: cot.id, orden_compra_url: urlData.publicUrl, estatus_cobro: 'pendiente',
        })
      } catch (_) {}
      await cargar()
      alert('✅ OC subida y venta registrada.')
    } catch (e) { alert('Error: ' + (e.message || '')) }
    setSubiendoOC(false)
  }

  function exportarExcel() {
    if (!cotizaciones.length) { alert('No hay datos.'); return }
    const filas = cotizaciones.map(c => ({ 'Folio': c.folio || '', 'Empresa': c.empresa_nombre || '', 'Curso': c.curso_nombre || '', 'Personas': c.num_personas || 0, 'Subtotal': c.subtotal || 0, 'IVA': c.iva || 0, 'Total': c.total || 0, 'Estado': c.estado || '', 'OC': c.orden_compra_url ? 'Sí' : 'No', 'Fecha': c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX') : '' }))
    const ws = XLSX.utils.json_to_sheet(filas); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Cotizaciones'); XLSX.writeFile(wb, `cotizaciones_especiales_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando...</div>
  const EST = { enviada: { l: 'Enviada', bg: '#eff6ff', c: '#1d4ed8' }, aceptada: { l: 'Aceptada', bg: '#f0fdf4', c: '#059669' }, rechazada: { l: 'Rechazada', bg: '#fef2f2', c: '#dc2626' }, cancelada: { l: 'Cancelada', bg: '#f1f5f9', c: '#64748b' } }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Cotizador Especial</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Genera cotizaciones personalizadas con precio libre para cualquier empresa. Guarda, genera PDF o ambos.</p>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 'clamp(18px,4vw,28px)', marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#8B1A1A', marginBottom: 16 }}>Nueva cotización</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>Empresa (escribe cualquiera)</label><input value={form.empresa_nombre} onChange={f('empresa_nombre')} placeholder="Nombre de la empresa" style={inp} /></div>
          <div><label style={lbl}>Contacto</label><input value={form.contacto_nombre} onChange={f('contacto_nombre')} placeholder="Nombre del contacto" style={inp} /></div>
          <div><label style={lbl}>Correo</label><input value={form.contacto_correo} onChange={f('contacto_correo')} placeholder="correo@empresa.com" style={inp} /></div>
          <div><label style={lbl}>Teléfono</label><input value={form.contacto_tel} onChange={f('contacto_tel')} placeholder="WhatsApp o teléfono" style={inp} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Curso</label>
            <input list="cursos-list" value={form.curso_nombre} onChange={f('curso_nombre')} placeholder="Escribe o selecciona un curso" style={inp} />
            <datalist id="cursos-list">{cursos.map(c => <option key={c.id} value={c.nombre}>{c.nombre} ({c.duracion}h)</option>)}</datalist>
          </div>
          <div><label style={lbl}>Participantes</label><input type="number" min={1} value={form.num_personas} onChange={f('num_personas')} style={inp} /></div>
          <div>
            <label style={lbl}>Modalidad</label>
            <select value={form.modalidad} onChange={f('modalidad')} style={inp}>
              <option value="online">Online</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option>
            </select>
          </div>
          <div><label style={lbl}>Precio total (MXN)</label><input type="number" min={0} step={100} value={form.precio_total} onChange={f('precio_total')} placeholder="Precio final por todo el grupo" style={inp} /></div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}><input type="checkbox" checked={form.aplica_iva} onChange={e => f('aplica_iva')(e.target.checked)} /> Aplica IVA (16%)</label>
          <label style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}><input type="checkbox" checked={form.incluye_viaticos} onChange={e => f('incluye_viaticos')(e.target.checked)} /> Incluir viáticos</label>
          {form.incluye_viaticos && <div><label style={lbl}>Monto viáticos</label><input type="number" min={0} step={100} value={form.viaticos} onChange={f('viaticos')} style={{ ...inp, width: 140 }} /></div>}
        </div>
        <div style={{ marginBottom: 14 }}><label style={lbl}>Notas</label><textarea value={form.notas} onChange={f('notas')} placeholder="Notas internas o para el cliente" rows={2} style={{ ...inp, resize: 'vertical' }} /></div>

        <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 22px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Precio: {money(form.precio_total)}{form.incluye_viaticos ? ` + Viáticos: ${money(form.viaticos)}` : ''}{form.aplica_iva ? ` + IVA: ${money(iva)}` : ''}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Total: {money(total)}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={guardar} disabled={saving} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Guardando...' : '💾 Guardar'}</button>
          <button onClick={guardarYPDF} disabled={saving} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Guardando...' : '💾📄 Guardar + PDF'}</button>
          <button onClick={soloPDF} style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>📄 Solo PDF (sin guardar)</button>
        </div>
      </div>

      {/* ── HISTORIAL ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Historial ({cotizaciones.length})</h2>
        <button onClick={exportarExcel} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇️ Excel</button>
      </div>
      {cotizaciones.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aún no has generado cotizaciones especiales.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {cotizaciones.map(c => {
            const est = EST[c.estado] || EST.enviada
            return (
              <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', cursor: 'pointer' }} onClick={() => setDetalle(detalle?.id === c.id ? null : c)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{c.folio}</code>
                    <span style={{ marginLeft: 10, fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{c.empresa_nombre}</span>
                    <span style={{ marginLeft: 8, color: '#64748b', fontSize: 12 }}>{c.curso_nombre}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: '#8B1A1A', fontSize: 15 }}>{money(c.total)}</span>
                    <span style={{ background: est.bg, color: est.c, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{est.l}</span>
                    {c.orden_compra_url && <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>📎 OC</span>}
                  </div>
                </div>
                {detalle?.id === c.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, fontSize: 12, color: '#475569', marginBottom: 12 }}>
                      <div>Contacto: {c.contacto_nombre || '—'}</div>
                      <div>Correo: {c.contacto_correo || '—'}</div>
                      <div>Personas: {c.num_personas || 1}</div>
                      <div>Fecha: {fLocal(c.created_at)}</div>
                      {c.notas && <div style={{ gridColumn: '1/-1' }}>Notas: {c.notas}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select value={c.estado} onChange={e => cambiarEstado(c.id, e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
                        <option value="enviada">Enviada</option><option value="aceptada">Aceptada</option><option value="rechazada">Rechazada</option><option value="cancelada">Cancelada</option>
                      </select>
                      <button onClick={() => abrirPDF(c.folio, { empresa_nombre: c.empresa_nombre, contacto_nombre: c.contacto_nombre, contacto_correo: c.contacto_correo, contacto_tel: c.contacto_telefono, curso_nombre: c.curso_nombre, num_personas: c.num_personas, modalidad: c.modalidad, precio_total: c.subtotal, aplica_iva: c.aplica_iva !== false, notas: c.notas, incluye_viaticos: false, viaticos: 0 })}
                        style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📄 PDF</button>
                      <label style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: subiendoOC ? 'wait' : 'pointer' }}>
                        {subiendoOC ? 'Subiendo...' : '📎 Subir OC'}
                        <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={subiendoOC} onChange={e => { subirOC(c, e.target.files[0]); e.target.value = '' }} />
                      </label>
                      {c.orden_compra_url && <a href={c.orden_compra_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1d4ed8' }}>Ver OC ↗</a>}
                      <button onClick={() => eliminar(c)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>🗑</button>
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

const lbl = { display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 4 }
const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
