import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getEmpresas } from '../lib/supabase'

const IVA = 0.16

export default function RentaPlataforma() {
  const [rentas, setRentas] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [facturas, setFacturas] = useState([])
  const [modal, setModal] = useState(false)
  const [modalFactura, setModalFactura] = useState(null)
  const [form, setForm] = useState({ empresa_id: '', precio_mensual: '', aplica_iva: true, fecha_inicio: new Date().toISOString().slice(0, 10), notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargar()
    getEmpresas().then(setEmpresas)
  }, [])

  async function cargar() {
    const { data: r } = await supabase.from('rentas_plataforma').select('*, empresa:empresas(nombre)').order('created_at', { ascending: false })
    const { data: f } = await supabase.from('facturas_renta').select('*, empresa:empresas(nombre), renta:rentas_plataforma(precio_mensual)').order('created_at', { ascending: false })
    setRentas(r || [])
    setFacturas(f || [])
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  async function guardar() {
    if (!form.empresa_id || !form.precio_mensual) return
    setSaving(true)
    try {
      await supabase.from('rentas_plataforma').insert({ ...form, precio_mensual: Number(form.precio_mensual) })
      await cargar()
      setModal(false)
      setForm({ empresa_id: '', precio_mensual: '', aplica_iva: true, fecha_inicio: new Date().toISOString().slice(0, 10), notas: '' })
    } finally { setSaving(false) }
  }

  async function generarFactura(renta) {
    const empresa = empresas.find(e => e.id === renta.empresa_id)
    const ahora = new Date()
    const mes = ahora.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    const subtotal = renta.precio_mensual
    const iva = renta.aplica_iva ? subtotal * IVA : 0
    const total = subtotal + iva
    const folio = `HCD-RNT-${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}-${renta.empresa_id.slice(0, 4).toUpperCase()}`

    setSaving(true)
    try {
      const { data: factura } = await supabase.from('facturas_renta').insert({
        renta_id: renta.id,
        empresa_id: renta.empresa_id,
        folio,
        periodo: mes,
        subtotal,
        iva,
        total,
        estado: 'pendiente'
      }).select().single()

      // Abrir PDF
      abrirFacturaPDF({ factura: { ...factura, empresa: empresa }, renta, mes, folio, subtotal, iva, total })
      await cargar()
    } finally { setSaving(false) }
  }

  async function toggleEstadoFactura(id, estado) {
    await supabase.from('facturas_renta').update({ estado }).eq('id', id)
    await cargar()
  }

  function abrirFacturaPDF({ factura, renta, mes, folio, subtotal, iva, total }) {
    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const ventana = window.open('', '_blank')
    ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Factura ${folio}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',sans-serif;color:#1e293b;background:#fff;}
.page{max-width:720px;margin:0 auto;padding:40px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #8B1A1A;}
.company{font-size:20px;font-weight:800;color:#8B1A1A;}
.sub{font-size:11px;color:#64748b;margin-top:2px;}
.folio-val{font-size:18px;font-weight:800;color:#8B1A1A;text-align:right;}
table{width:100%;border-collapse:collapse;margin-top:16px;}
th{background:#f8f9fb;padding:10px 14px;text-align:left;font-size:11px;color:#64748b;}
td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}
.total-row td{font-weight:800;font-size:16px;color:#8B1A1A;border-top:2px solid #8B1A1A;}
.badge{display:inline-block;background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;}
@media print{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
</style></head><body><div class="page">
<div class="header">
  <div>
    <div class="company">● Hablando con Datos</div>
    <div class="sub">Consultoría y Capacitación en Sistemas de Gestión</div>
    <div class="sub">www.hablandocondatos.com.mx · 222 354 9353</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#64748b;letter-spacing:1px;text-transform:uppercase">Factura de renta</div>
    <div class="folio-val">${folio}</div>
    <div class="sub">Fecha: ${fecha}</div>
  </div>
</div>
<div style="margin-bottom:24px">
  <div style="font-size:11px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Facturar a</div>
  <div style="font-size:16px;font-weight:700">${factura.empresa?.nombre}</div>
  <div style="font-size:13px;color:#64748b;margin-top:4px">Periodo: ${mes}</div>
</div>
<table>
  <thead><tr><th>Concepto</th><th>Periodo</th><th style="text-align:right">Importe</th></tr></thead>
  <tbody>
    <tr><td><strong>Renta mensual — Plataforma HCD Certificados</strong><br/><span style="color:#64748b;font-size:11px">Acceso al portal de gestión de capacitación, certificados y dashboard</span></td><td>${mes}</td><td style="text-align:right">$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
    ${iva > 0 ? `<tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">IVA (16%)</td><td style="text-align:right">$${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
    <tr class="total-row"><td colspan="2" style="text-align:right">TOTAL A PAGAR</td><td style="text-align:right">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</td></tr>
  </tbody>
</table>
<div style="margin-top:32px;background:#f8f9fb;border-radius:8px;padding:16px;font-size:12px;color:#475569;line-height:1.8">
  <strong>Datos bancarios para transferencia:</strong><br/>
  Banco: [Tu banco] · Cuenta: [Tu cuenta] · CLABE: [Tu CLABE]<br/>
  Beneficiario: Hablando con Datos · Concepto: ${folio}<br/><br/>
  Para dudas o aclaraciones: ness@hablandocondatos.com.mx · 222 354 9353
</div>
</div><script>window.onload=()=>{window.print();}</script></body></html>`)
    ventana.document.close()
  }

  const totalRentasActivas = rentas.filter(r => r.activo).reduce((acc, r) => {
    const sub = r.precio_mensual
    return acc + sub + (r.aplica_iva ? sub * IVA : 0)
  }, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Renta de plataforma</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Gestiona las suscripciones mensuales por empresa</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>+ Nueva renta</button>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Empresas con renta activa', value: rentas.filter(r => r.activo).length, color: '#8B1A1A' },
          { label: 'Ingreso mensual estimado', value: `$${totalRentasActivas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: '#059669' },
          { label: 'Facturas pendientes', value: facturas.filter(f => f.estado === 'pendiente').length, color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 22px' }}>
            <div style={{ fontSize: typeof s.value === 'string' ? 18 : 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Rentas activas */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>Rentas configuradas</h2>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Empresa', 'Precio mensual', 'IVA', 'Total mensual', 'Desde', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rentas.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin rentas configuradas</td></tr>}
            {rentas.map(r => {
              const total = r.precio_mensual + (r.aplica_iva ? r.precio_mensual * IVA : 0)
              return (
                <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{r.empresa?.nombre}</td>
                  <td style={{ padding: '11px 16px', color: '#1e293b', fontSize: 13 }}>${r.precio_mensual?.toLocaleString('es-MX')}</td>
                  <td style={{ padding: '11px 16px' }}><span style={{ background: r.aplica_iva ? '#f0fdf4' : '#f1f5f9', color: r.aplica_iva ? '#059669' : '#64748b', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{r.aplica_iva ? 'Con IVA' : 'Sin IVA'}</span></td>
                  <td style={{ padding: '11px 16px', color: '#8B1A1A', fontWeight: 700, fontSize: 14 }}>${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '11px 16px', color: '#64748b', fontSize: 12 }}>{new Date(r.fecha_inicio).toLocaleDateString('es-MX')}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: r.activo ? '#f0fdf4' : '#f1f5f9', color: r.activo ? '#059669' : '#64748b', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {r.activo ? '● Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <button onClick={() => generarFactura(r)} disabled={saving}
                      style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      📄 Generar factura
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Historial facturas */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>Historial de facturas</h2>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Folio', 'Empresa', 'Periodo', 'Total', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {facturas.length === 0 && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Sin facturas generadas</td></tr>}
            {facturas.map(f => (
              <tr key={f.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 16px' }}>
                  <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>{f.folio}</code>
                </td>
                <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{f.empresa?.nombre}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: 13 }}>{f.periodo}</td>
                <td style={{ padding: '11px 16px', color: '#8B1A1A', fontWeight: 700, fontSize: 13 }}>${f.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ background: f.estado === 'pagada' ? '#f0fdf4' : '#fef9c3', color: f.estado === 'pagada' ? '#059669' : '#92400e', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {f.estado === 'pagada' ? '✓ Pagada' : '⏳ Pendiente'}
                  </span>
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <button onClick={() => toggleEstadoFactura(f.id, f.estado === 'pagada' ? 'pendiente' : 'pagada')}
                    style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#475569' }}>
                    {f.estado === 'pagada' ? 'Marcar pendiente' : 'Marcar pagada'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nueva renta */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }} onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Nueva renta de plataforma</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Empresa *</label>
              <select value={form.empresa_id} onChange={e => f('empresa_id')(e.target.value)} style={inp}>
                <option value="">— Selecciona empresa —</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Precio mensual ($) *</label>
              <input type="number" value={form.precio_mensual} onChange={e => f('precio_mensual')(e.target.value)} placeholder="ej. 1500" style={inp} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Fecha de inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => f('fecha_inicio')(e.target.value)} style={inp} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
              <input type="checkbox" checked={form.aplica_iva} onChange={e => f('aplica_iva')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#374151' }}>Aplica IVA (16%)</span>
            </label>
            {form.precio_mensual && (
              <div style={{ background: '#f9f0f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                Total mensual: <strong style={{ color: '#8B1A1A' }}>
                  ${(Number(form.precio_mensual) * (form.aplica_iva ? 1.16 : 1)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Notas</label>
              <textarea value={form.notas} onChange={e => f('notas')(e.target.value)} rows={2} placeholder="Condiciones especiales, descuentos, etc." style={{ ...inp, resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.empresa_id || !form.precio_mensual} style={btnPrimary}>
                {saving ? 'Guardando...' : 'Configurar renta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
