import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const COMO_LLEGO = ['Redes sociales', 'Visita comercial', 'LinkedIn', 'Campaña de correo', 'Búsqueda en Google', 'Recomendación', 'Otro']

export default function AdminVentas() {
  const [ventas, setVentas] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState('todos')
  const [form, setForm] = useState({
    empresa_nombre: '', curso_nombre: '', monto_total: '',
    es_cliente_nuevo: true, como_llego: '', fecha_venta: new Date().toISOString().slice(0, 10), notas: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargar()
    supabase.from('empresas').select('id, nombre, tipo_cliente').then(({ data }) => setEmpresas(data || []))
  }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('ventas').select('*').order('fecha_venta', { ascending: false })
    setVentas(data || [])
    setLoading(false)
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  const comisionCalculada = () => {
    const monto = Number(form.monto_total) || 0
    const pct = form.es_cliente_nuevo ? 15 : 10
    return { pct, monto: monto * (pct / 100) }
  }

  async function guardar() {
    if (!form.empresa_nombre || !form.curso_nombre || !form.monto_total) return
    setSaving(true)
    try {
      const { data: seq } = await supabase.rpc('nextval', { seq_name: 'venta_folio_seq' }).single().catch(() => ({ data: null }))
      const num = seq?.nextval || Date.now() % 100000
      const folio = `HCD-V-${new Date().getFullYear()}-${String(num).padStart(4, '0')}`
      const com = comisionCalculada()

      await supabase.from('ventas').insert({
        folio,
        empresa_nombre: form.empresa_nombre,
        curso_nombre: form.curso_nombre,
        monto_total: Number(form.monto_total),
        es_cliente_nuevo: form.es_cliente_nuevo,
        comision_porcentaje: com.pct,
        comision_monto: com.monto,
        como_llego: form.como_llego,
        fecha_venta: form.fecha_venta,
        notas: form.notas,
        estado: 'cerrada'
      })
      await cargar()
      setModal(false)
      setForm({ empresa_nombre: '', curso_nombre: '', monto_total: '', es_cliente_nuevo: true, como_llego: '', fecha_venta: new Date().toISOString().slice(0, 10), notas: '' })
    } finally { setSaving(false) }
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('ventas').update({ estado }).eq('id', id)
    await cargar()
  }

  // Filtro por mes
  const ventasFiltradas = filtroMes === 'todos' ? ventas : ventas.filter(v => v.fecha_venta?.slice(0, 7) === filtroMes)

  // Stats
  const totalVendido = ventasFiltradas.reduce((a, v) => a + Number(v.monto_total), 0)
  const totalComision = ventasFiltradas.reduce((a, v) => a + Number(v.comision_monto), 0)
  const cobradas = ventasFiltradas.filter(v => v.estado === 'cobrada').length

  // Análisis por canal
  const porCanal = {}
  ventasFiltradas.forEach(v => {
    const canal = v.como_llego || 'Sin especificar'
    porCanal[canal] = (porCanal[canal] || 0) + Number(v.monto_total)
  })

  // Meses disponibles
  const meses = [...new Set(ventas.map(v => v.fecha_venta?.slice(0, 7)))].filter(Boolean).sort().reverse()

  function exportarCSV() {
    const headers = ['Folio', 'Empresa', 'Curso', 'Monto', 'Cliente', 'Comision %', 'Comision $', 'Canal', 'Fecha', 'Estado']
    const rows = ventasFiltradas.map(v => [
      v.folio, v.empresa_nombre, v.curso_nombre, v.monto_total,
      v.es_cliente_nuevo ? 'Nuevo' : 'Recurrente', v.comision_porcentaje, v.comision_monto,
      v.como_llego || '', v.fecha_venta, v.estado
    ].map(x => `"${x}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ventas_HCD_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Gestión de ventas</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Cursos vendidos, comisiones y canales de adquisición</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportarCSV} style={btnSecondary}>⬇️ Exportar CSV</button>
          <button onClick={() => setModal(true)} style={btnPrimary}>+ Registrar venta</button>
        </div>
      </div>

      {/* Filtro mes */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>Periodo:</span>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 13, outline: 'none' }}>
          <option value="todos">Todos los meses</option>
          {meses.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Ventas registradas', value: ventasFiltradas.length, color: '#1e293b' },
          { label: 'Monto total vendido', value: `$${totalVendido.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: '#8B1A1A', small: true },
          { label: 'Mis comisiones', value: `$${totalComision.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: '#059669', small: true },
          { label: 'Cobradas', value: cobradas, color: '#1d4ed8' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: s.small ? 18 : 28, fontWeight: 800, color: s.color }}>{loading ? '—' : s.value}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Análisis por canal */}
      {Object.keys(porCanal).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>📊 Ventas por canal de adquisición</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(porCanal).sort((a, b) => b[1] - a[1]).map(([canal, monto]) => {
              const pct = (monto / totalVendido) * 100
              return (
                <div key={canal} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 140, fontSize: 13, color: '#475569' }}>{canal}</span>
                  <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 20, height: 24, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#8B1A1A', borderRadius: 20 }} />
                  </div>
                  <span style={{ width: 110, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>${monto.toLocaleString('es-MX')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Folio', 'Empresa', 'Curso', 'Monto', 'Comisión', 'Canal', 'Fecha', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ventasFiltradas.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay ventas registradas</td></tr>
            )}
            {ventasFiltradas.map(v => (
              <tr key={v.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 14px' }}>
                  <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{v.folio}</code>
                </td>
                <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{v.empresa_nombre}</td>
                <td style={{ padding: '11px 14px', color: '#475569', fontSize: 12 }}>{v.curso_nombre}</td>
                <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 700, fontSize: 13 }}>${Number(v.monto_total).toLocaleString('es-MX')}</td>
                <td style={{ padding: '11px 14px', color: '#059669', fontWeight: 700, fontSize: 13 }}>
                  ${Number(v.comision_monto).toLocaleString('es-MX')}<span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 10 }}> ({v.comision_porcentaje}%)</span>
                </td>
                <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{v.como_llego || '—'}</td>
                <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 11 }}>{new Date(v.fecha_venta).toLocaleDateString('es-MX')}</td>
                <td style={{ padding: '11px 14px' }}>
                  <select value={v.estado} onChange={e => cambiarEstado(v.id, e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', fontSize: 11, outline: 'none',
                      background: v.estado === 'cobrada' ? '#f0fdf4' : v.estado === 'cancelada' ? '#fef2f2' : '#fff',
                      color: v.estado === 'cobrada' ? '#059669' : v.estado === 'cancelada' ? '#dc2626' : '#475569' }}>
                    <option value="cerrada">Cerrada</option>
                    <option value="cobrada">Cobrada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Registrar venta</h3>
            <label style={lbl}>Empresa *</label>
            <input value={form.empresa_nombre} onChange={e => f('empresa_nombre')(e.target.value)} placeholder="Nombre de la empresa" style={inp} list="empresas-list" />
            <datalist id="empresas-list">
              {empresas.map(e => <option key={e.id} value={e.nombre} />)}
            </datalist>

            <label style={lbl}>Curso o servicio *</label>
            <input value={form.curso_nombre} onChange={e => f('curso_nombre')(e.target.value)} placeholder="ej. Core Tools, Consultoría ISO 9001" style={inp} />

            <label style={lbl}>Monto total ($) *</label>
            <input type="number" value={form.monto_total} onChange={e => f('monto_total')(e.target.value)} placeholder="ej. 38000" style={inp} />

            <label style={lbl}>Tipo de cliente</label>
            <select value={form.es_cliente_nuevo ? 'nuevo' : 'recurrente'} onChange={e => f('es_cliente_nuevo')(e.target.value === 'nuevo')} style={inp}>
              <option value="nuevo">Cliente nuevo (comisión 15%)</option>
              <option value="recurrente">Recompra cliente mío (comisión 10%)</option>
            </select>

            <label style={lbl}>¿Cómo se obtuvo el cliente?</label>
            <select value={form.como_llego} onChange={e => f('como_llego')(e.target.value)} style={inp}>
              <option value="">Selecciona</option>
              {COMO_LLEGO.map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            <label style={lbl}>Fecha de venta</label>
            <input type="date" value={form.fecha_venta} onChange={e => f('fecha_venta')(e.target.value)} style={inp} />

            {form.monto_total && (
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px', marginTop: 14, marginBottom: 8 }}>
                <span style={{ color: '#15803d', fontSize: 13 }}>Tu comisión: </span>
                <strong style={{ color: '#059669', fontSize: 16 }}>${comisionCalculada().monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                <span style={{ color: '#64748b', fontSize: 12 }}> ({comisionCalculada().pct}%)</span>
              </div>
            )}

            <label style={lbl}>Notas</label>
            <textarea value={form.notas} onChange={e => f('notas')(e.target.value)} rows={2} placeholder="Opcional" style={{ ...inp, resize: 'none' }} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.empresa_nombre || !form.curso_nombre || !form.monto_total} style={btnPrimary}>
                {saving ? 'Guardando...' : 'Registrar venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
