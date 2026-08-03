import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMAIL = 'ventas@hablandocondatos.com.mx'
const money = n => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

export default function CotizadorEspecial() {
  const [cursos, setCursos] = useState([])

  const [form, setForm] = useState({
    empresa_nombre: '', contacto_nombre: '', contacto_correo: '', contacto_tel: '',
    curso_nombre: '', num_personas: 1, modalidad: 'online', precio_total: 0,
    aplica_iva: true, notas: '', incluye_viaticos: false, viaticos: 0
  })
  const f = k => v => setForm(p => ({ ...p, [k]: typeof v === 'object' && v.target ? v.target.value : v }))

  useEffect(() => {
    supabase.from('cursos').select('id, nombre, duracion').eq('activo', true).order('nombre')
      .then(({ data }) => setCursos(data || []))
  }, [])

  const subtotal = (Number(form.precio_total) || 0) + (form.incluye_viaticos ? Number(form.viaticos) || 0 : 0)
  const iva = form.aplica_iva ? subtotal * 0.16 : 0
  const total = subtotal + iva
  const folio = `HCD-ESP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`

  function generarPDF() {
    if (!form.empresa_nombre || !form.curso_nombre) { alert('Escribe empresa y curso.'); return }
    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotización ${folio}</title>
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
  <h3>${form.empresa_nombre}</h3>
  ${form.contacto_nombre ? `<p>Contacto: ${form.contacto_nombre}</p>` : ''}
  ${form.contacto_correo ? `<p>Correo: ${form.contacto_correo}</p>` : ''}
  ${form.contacto_tel ? `<p>Teléfono: ${form.contacto_tel}</p>` : ''}
</div>
<table>
  <thead><tr><th>Concepto</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
  <tbody>
    <tr><td><strong>${form.curso_nombre}</strong></td><td>${form.num_personas} persona(s) · ${form.modalidad}</td><td style="text-align:right">${money(form.precio_total)}</td></tr>
    ${form.incluye_viaticos && Number(form.viaticos) > 0 ? `<tr><td>Viáticos</td><td>Estimado</td><td style="text-align:right">${money(form.viaticos)}</td></tr>` : ''}
  </tbody>
</table>
<table class="totales">
  <tr><td>Subtotal</td><td>${money(subtotal)}</td></tr>
  ${form.aplica_iva ? `<tr><td>IVA (16%)</td><td>${money(iva)}</td></tr>` : ''}
  <tr class="gran"><td>Total</td><td>${money(total)}</td></tr>
</table>
${form.notas ? `<div style="margin-bottom:16px;padding:12px;background:#fffbeb;border-radius:8px;font-size:12px;color:#92400e"><strong>Notas:</strong> ${form.notas}</div>` : ''}
<div class="condiciones">
  <h3 style="margin-bottom:8px;color:#1e293b">Condiciones</h3>
  • Cotización válida por 90 días naturales.<br/>
  • Precios en pesos mexicanos (MXN). ${form.aplica_iva ? 'IVA del 16% incluido.' : 'Precio sin IVA.'}<br/>
  • Incluye material didáctico y constancias con folio único verificable.<br/>
  • La empresa deberá proporcionar y/o gestionar: aula de capacitación, pizarrón, proyector, conexión eléctrica y de preferencia acceso a internet (opcional, de acuerdo a los protocolos de seguridad de la empresa).<br/>
  • Contacto: WhatsApp 222 354 9353 · ${EMAIL}
</div>
<div class="footer">
  <p>Hablando con Datos — Consultoría y Capacitación · Puebla, México</p>
  <p>Folio: ${folio} · Gerencia de Ventas: 222 354 9353 · ${EMAIL}</p>
</div>
<script>window.onload=()=>{window.print();}</script></body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Cotizador Especial</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Genera cotizaciones personalizadas con precio libre para cualquier empresa. Imprime o guarda como PDF para enviar por correo.</p>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 'clamp(18px,4vw,28px)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#8B1A1A', marginBottom: 16 }}>Nueva cotización</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>Empresa</label><input value={form.empresa_nombre} onChange={f('empresa_nombre')} placeholder="Nombre de la empresa" style={inp} /></div>
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
        <div style={{ marginBottom: 14 }}><label style={lbl}>Notas (aparecen en el PDF)</label><textarea value={form.notas} onChange={f('notas')} placeholder="Ej: La capacitación se confirma contra anticipo del 20%." rows={3} style={{ ...inp, resize: 'vertical' }} /></div>

        <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 22px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Precio: {money(form.precio_total)}{form.incluye_viaticos ? ` + Viáticos: ${money(form.viaticos)}` : ''}{form.aplica_iva ? ` + IVA: ${money(iva)}` : ''}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Total: {money(total)}</div>
        </div>
        <button onClick={generarPDF} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>📄 Generar PDF</button>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 4 }
const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
