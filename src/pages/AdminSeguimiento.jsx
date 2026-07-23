import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

function exportarAExcel(filas, archivo, hoja = 'Datos') {
  if (!filas || filas.length === 0) { alert('No hay datos para exportar.'); return }
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, hoja)
  XLSX.writeFile(wb, archivo)
}
const money = n => n == null ? '—' : `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fecha = f => f ? new Date(f).toLocaleDateString('es-MX') : '—'

const ETAPA = {
  cotizada: { label: 'Cotizada', color: '#64748b', bg: '#f1f5f9', paso: 0 },
  aceptada: { label: 'Aceptada', color: '#1d4ed8', bg: '#eff6ff', paso: 1 },
  oc: { label: 'OC recibida', color: '#92400e', bg: '#fef9c3', paso: 1 },
  compra: { label: 'Compra generada', color: '#7c3aed', bg: '#f5f3ff', paso: 2 },
  vendido: { label: 'Vendido (por cobrar)', color: '#0891b2', bg: '#ecfeff', paso: 3 },
  cobrado: { label: 'Cobrado', color: '#059669', bg: '#f0fdf4', paso: 4 },
  cancelada: { label: 'Cancelada', color: '#64748b', bg: '#f1f5f9', paso: -1 },
  rechazada: { label: 'Rechazada', color: '#dc2626', bg: '#fef2f2', paso: -1 },
  compra_manual: { label: 'Compra directa', color: '#7c3aed', bg: '#f5f3ff', paso: 2 },
  solicitud: { label: 'Solicitud', color: '#92400e', bg: '#fff7ed', paso: 0 },
}
const PASOS = ['Cotizada', 'Aceptada / OC', 'Compra', 'Vendido', 'Cobrado']

export default function AdminSeguimiento() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [compras, setCompras] = useState([])
  const [programaciones, setProgramaciones] = useState([])
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [cot, com, prog, ven] = await Promise.all([
      supabase.from('cotizaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('compras').select('*').order('created_at', { ascending: false }),
      supabase.from('programaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('ventas').select('*').order('created_at', { ascending: false }),
    ])
    setCotizaciones(cot.data || [])
    setCompras(com.data || [])
    setProgramaciones(prog.data || [])
    setVentas(ven.data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando seguimiento...</div>

  const comprasPorCot = {}; compras.forEach(c => { if (c.cotizacion_id) comprasPorCot[c.cotizacion_id] = c })
  const ventasPorCot = {}; ventas.forEach(v => { if (v.cotizacion_id) ventasPorCot[v.cotizacion_id] = v })

  function etapaCot(cot, compra, venta) {
    if (cot.estado === 'cancelada') return 'cancelada'
    if (cot.estado === 'rechazada') return 'rechazada'
    if (venta && venta.estatus_cobro === 'pagado') return 'cobrado'
    if (venta) return 'vendido'
    if (cot.id_compra_generado || compra) return 'compra'
    if (cot.orden_compra_url) return 'oc'
    if (cot.estado === 'aceptada' || cot.estado === 'aceptada_cliente') return 'aceptada'
    return 'cotizada'
  }

  const filas = []
  cotizaciones.forEach(cot => {
    const compra = comprasPorCot[cot.id]
    const venta = ventasPorCot[cot.id]
    filas.push({
      tipo: 'cotizacion', id: 'cot-' + cot.id,
      empresa: cot.empresa_nombre, curso: cot.curso_nombre, monto: cot.total,
      origen: cot.folio, id_compra: cot.id_compra_generado || compra?.id_compra || null,
      oc_url: cot.orden_compra_url, cobro: venta?.estatus_cobro || null,
      fecha: cot.created_at, etapa: etapaCot(cot, compra, venta), compra, venta,
    })
  })
  compras.filter(c => !c.cotizacion_id).forEach(c => {
    filas.push({
      tipo: 'compra', id: 'com-' + c.id,
      empresa: c.empresa_nombre, curso: c.curso_nombre, monto: c.monto,
      origen: c.id_compra, id_compra: c.id_compra, oc_url: null, cobro: null,
      fecha: c.created_at, etapa: 'compra_manual',
    })
  })
  programaciones.forEach(p => {
    filas.push({
      tipo: 'solicitud', id: 'prog-' + p.id,
      empresa: p.empresa_nombre, curso: p.curso_nombre, monto: null,
      origen: 'Solicitud', id_compra: null, oc_url: null, cobro: null,
      fecha: p.created_at, etapa: 'solicitud', estadoSolicitud: p.estado,
    })
  })
  filas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const visibles = filas
    .filter(f => filtro === 'todas' || f.etapa === filtro)
    .filter(f => `${f.empresa} ${f.curso} ${f.origen || ''} ${f.id_compra || ''}`.toLowerCase().includes(busqueda.toLowerCase()))

  const cuenta = k => filas.filter(f => f.etapa === k).length
  const montoVendido = filas.filter(f => ['vendido', 'cobrado'].includes(f.etapa)).reduce((a, f) => a + (Number(f.monto) || 0), 0)
  const montoCobrado = filas.filter(f => f.etapa === 'cobrado').reduce((a, f) => a + (Number(f.monto) || 0), 0)

  function descargarExcel() {
    const fl = visibles.map(f => ({
      'Fecha': fecha(f.fecha),
      'Empresa': f.empresa || '',
      'Curso': f.curso || '',
      'Origen': f.origen || '',
      'Monto': f.monto || 0,
      'Etapa': (ETAPA[f.etapa] || {}).label || f.etapa,
      'ID Compra': f.id_compra || '',
      'OC': f.oc_url ? 'Sí' : 'No',
      'Cobro': f.cobro || '',
    }))
    exportarAExcel(fl, `seguimiento_comercial_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Seguimiento')
  }

  const chips = [['todas', `Todas (${filas.length})`], ['cotizada', `Cotizada (${cuenta('cotizada')})`], ['aceptada', `Aceptada (${cuenta('aceptada')})`], ['oc', `OC (${cuenta('oc')})`], ['compra', `Compra (${cuenta('compra')})`], ['vendido', `Vendido (${cuenta('vendido')})`], ['cobrado', `Cobrado (${cuenta('cobrado')})`], ['solicitud', `Solicitudes (${cuenta('solicitud')})`]]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Seguimiento comercial</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Cotizaciones, compras, ventas y solicitudes en una sola vista, por etapa.</p>
        </div>
        <button onClick={descargarExcel} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>⬇️ Descargar Excel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Oportunidades', value: filas.length, color: '#1e293b' },
          { label: 'Vendido (por cobrar + cobrado)', value: money(montoVendido), color: '#0891b2' },
          { label: 'Cobrado', value: money(montoCobrado), color: '#059669' },
          { label: 'Solicitudes de curso', value: cuenta('solicitud'), color: '#92400e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {chips.map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filtro === v ? '#8B1A1A' : '#e2e8f0'}`, background: filtro === v ? '#8B1A1A' : '#fff', color: filtro === v ? '#fff' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar empresa, curso, folio, ID..."
          style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 13, outline: 'none', minWidth: 240 }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Fecha', 'Empresa', 'Curso', 'Origen', 'Monto', 'Etapa', 'OC', 'ID Compra', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Sin registros para este filtro.</td></tr>}
            {visibles.map(f => {
              const et = ETAPA[f.etapa] || ETAPA.cotizada
              return (
                <tr key={f.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{fecha(f.fecha)}</td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{f.empresa}</td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontSize: 12 }}>{f.curso}</td>
                  <td style={{ padding: '11px 14px' }}><code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>{f.origen}</code></td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{money(f.monto)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: et.bg, color: et.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{et.label}{f.tipo === 'solicitud' && f.estadoSolicitud ? `: ${f.estadoSolicitud}` : ''}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>{f.oc_url ? <a href={f.oc_url} target="_blank" style={{ color: '#059669', fontSize: 14, textDecoration: 'none' }}>📎</a> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontSize: 12 }}>{f.id_compra || '—'}</td>
                  <td style={{ padding: '11px 14px' }}><button onClick={() => setDetalle(f)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Ver</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }} onClick={() => setDetalle(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 620, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{detalle.empresa}</h3>
                <p style={{ color: '#64748b', fontSize: 13 }}>{detalle.curso} · {detalle.origen}</p>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {(ETAPA[detalle.etapa]?.paso ?? -1) >= 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
                {PASOS.map((p, i) => {
                  const activo = i <= (ETAPA[detalle.etapa]?.paso ?? 0)
                  return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: activo ? '#8B1A1A' : '#e2e8f0', color: activo ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{activo ? '✓' : i + 1}</div>
                        <span style={{ fontSize: 9, color: activo ? '#8B1A1A' : '#94a3b8', fontWeight: 600, textAlign: 'center', maxWidth: 64 }}>{p}</span>
                      </div>
                      {i < PASOS.length - 1 && <div style={{ width: 26, height: 2, background: i < (ETAPA[detalle.etapa]?.paso ?? 0) ? '#8B1A1A' : '#e2e8f0' }} />}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ background: ETAPA[detalle.etapa]?.bg, color: ETAPA[detalle.etapa]?.color, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 20 }}>{ETAPA[detalle.etapa]?.label}</div>
            )}

            {[
              ['Monto', money(detalle.monto)],
              ['Etapa actual', ETAPA[detalle.etapa]?.label],
              ['ID de compra', detalle.id_compra || '—'],
              ['Orden de compra', detalle.oc_url ? 'Adjunta' : 'No adjunta'],
              ['Estatus de cobro', detalle.cobro || '—'],
              detalle.venta ? ['Venta registrada', money(detalle.venta.monto)] : null,
            ].filter(Boolean).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>{l}</span>
                <span style={{ color: '#1e293b', fontSize: 13, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {detalle.oc_url && (
              <a href={detalle.oc_url} target="_blank" style={{ display: 'inline-block', marginTop: 16, background: '#f0fdf4', color: '#059669', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid #bbf7d0' }}>📎 Ver orden de compra</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
