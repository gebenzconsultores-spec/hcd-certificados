import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ESTATUS = {
  enviar_factura: { label: 'Enviar factura', color: '#92400e', bg: '#fef9c3', icon: '📄' },
  en_proceso: { label: 'En proceso de pago', color: '#1d4ed8', bg: '#eff6ff', icon: '⏳' },
  pagado: { label: 'Pagado', color: '#059669', bg: '#f0fdf4', icon: '✓' },
}

export default function AdminVentas() {
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('ventas').select('*').order('created_at', { ascending: false })
    setVentas(data || [])
    setLoading(false)
  }

  async function cambiarEstatus(venta, estatus) {
    await supabase.from('ventas').update({ estatus_cobro: estatus }).eq('id', venta.id)
    await cargar()
  }

  async function eliminar(venta) {
    if (!window.confirm('¿Eliminar este registro de venta?')) return
    await supabase.from('ventas').delete().eq('id', venta.id)
    await cargar()
  }

  const filtradas = ventas
    .filter(v => filtro === 'todas' || v.estatus_cobro === filtro)
    .filter(v => `${v.empresa_nombre} ${v.curso_nombre} ${v.id_compra || ''}`.toLowerCase().includes(busqueda.toLowerCase()))

  const totalVendido = ventas.reduce((acc, v) => acc + (v.monto || 0), 0)
  const totalPagado = ventas.filter(v => v.estatus_cobro === 'pagado').reduce((acc, v) => acc + (v.monto || 0), 0)
  const porCobrar = totalVendido - totalPagado

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Ventas y cobranza</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Ventas registradas al subir órdenes de compra</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Ventas totales', value: ventas.length, color: '#1e293b' },
          { label: 'Monto vendido', value: `$${totalVendido.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: '#8B1A1A' },
          { label: 'Cobrado', value: `$${totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: '#059669' },
          { label: 'Por cobrar', value: `$${porCobrar.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: '#92400e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: s.label.includes('Ventas') ? 28 : 17, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todas', 'enviar_factura', 'en_proceso', 'pagado'].map(fil => (
          <button key={fil} onClick={() => setFiltro(fil)}
            style={{ padding: '6px 16px', borderRadius: 20, border: `2px solid ${filtro === fil ? '#8B1A1A' : '#e2e8f0'}`, background: filtro === fil ? '#f9f0f0' : '#fff', color: filtro === fil ? '#8B1A1A' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {fil === 'todas' ? 'Todas' : ESTATUS[fil]?.label}
          </button>
        ))}
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar empresa, curso, ID compra..."
          style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 13, outline: 'none', minWidth: 260 }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Fecha', 'Empresa', 'Registro', 'Curso', 'ID Compra', 'Personas', 'Monto', 'Estatus de cobro', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</td></tr>}
            {!loading && filtradas.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay ventas registradas. Se registran cuando una empresa sube su orden de compra.</td></tr>
            )}
            {filtradas.map(v => {
              const est = ESTATUS[v.estatus_cobro] || ESTATUS.enviar_factura
              return (
                <tr key={v.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{new Date(v.created_at).toLocaleDateString('es-MX')}</td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{v.empresa_nombre}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: v.empresa_registrada ? '#f0fdf4' : '#fef9c3', color: v.empresa_registrada ? '#059669' : '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                      {v.empresa_registrada ? '✓ Con registro' : 'Sin registro'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontSize: 12 }}>{v.curso_nombre}</td>
                  <td style={{ padding: '11px 14px' }}>{v.id_compra ? <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>{v.id_compra}</code> : '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontSize: 13 }}>{v.num_personas || 1}</td>
                  <td style={{ padding: '11px 14px', color: '#8B1A1A', fontWeight: 700, fontSize: 13 }}>${v.monto?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <select value={v.estatus_cobro || 'enviar_factura'} onChange={e => cambiarEstatus(v, e.target.value)}
                      style={{ border: `1px solid ${est.color}33`, background: est.bg, color: est.color, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                      <option value="enviar_factura">📄 Enviar factura</option>
                      <option value="en_proceso">⏳ En proceso de pago</option>
                      <option value="pagado">✓ Pagado</option>
                    </select>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {v.orden_compra_url && <a href={v.orden_compra_url} target="_blank" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 8px', fontSize: 11, textDecoration: 'none' }}>📎 OC</a>}
                      <button onClick={() => eliminar(v)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
