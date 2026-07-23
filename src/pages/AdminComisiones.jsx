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
const money = n => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fLocal = f => f ? new Date(String(f).slice(0, 10) + 'T00:00:00').toLocaleDateString('es-MX') : ''

export default function AdminComisiones() {
  const [ventas, setVentas] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState(null) // vendedor seleccionado

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [ven, emp, vend] = await Promise.all([
      supabase.from('ventas').select('*').order('created_at', { ascending: true }),
      supabase.from('empresas').select('id, nombre, clave_vendedor, estatus'),
      supabase.from('vendedores').select('*').order('created_at', { ascending: true }),
    ])
    setVentas(ven.data || [])
    setEmpresas(emp.data || [])
    setVendedores(vend.data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando comisiones...</div>

  // empresa_id -> clave_vendedor
  const claveDeEmpresa = {}
  empresas.forEach(e => { claveDeEmpresa[e.id] = e.clave_vendedor || 'VEND-GERENCIA' })

  // Primera venta por empresa = cliente nuevo (el resto, recompra)
  const primeraPorEmpresa = {}
  ;[...ventas].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(v => {
    const k = v.empresa_id || v.empresa_nombre
    if (k && !(k in primeraPorEmpresa)) primeraPorEmpresa[k] = v.id
  })
  const esNuevo = v => primeraPorEmpresa[v.empresa_id || v.empresa_nombre] === v.id

  // Tasas por vendedor
  const vendedorDeClave = {}
  vendedores.forEach(v => { vendedorDeClave[v.clave] = v })
  const tasaNuevo = clave => Number(vendedorDeClave[clave]?.comision) || 0
  const tasaRecompra = clave => Number(vendedorDeClave[clave]?.comision_recompra) || 0

  // Comisión de cada venta
  function comisionVenta(v) {
    const clave = claveDeEmpresa[v.empresa_id] || 'VEND-GERENCIA'
    const nuevo = esNuevo(v)
    const tasa = nuevo ? tasaNuevo(clave) : tasaRecompra(clave)
    const monto = Number(v.monto) || 0
    return { clave, nuevo, tasa, monto, comision: monto * tasa / 100 }
  }

  // Agrupar por vendedor (incluye vendedores sin ventas)
  const resumen = vendedores.map(vd => {
    const suyas = ventas.filter(v => (claveDeEmpresa[v.empresa_id] || 'VEND-GERENCIA') === vd.clave)
    let montoVendido = 0, comNuevo = 0, comRecompra = 0, nVentas = suyas.length, nNuevos = 0, nRecompras = 0
    suyas.forEach(v => {
      const c = comisionVenta(v)
      montoVendido += c.monto
      if (c.nuevo) { comNuevo += c.comision; nNuevos++ } else { comRecompra += c.comision; nRecompras++ }
    })
    return { vd, nVentas, nNuevos, nRecompras, montoVendido, comNuevo, comRecompra, comTotal: comNuevo + comRecompra }
  })

  const totalComisiones = resumen.reduce((a, r) => a + r.comTotal, 0)
  const totalVendido = resumen.reduce((a, r) => a + r.montoVendido, 0)

  function descargarExcel() {
    const filas = resumen.map(r => ({
      'Clave': r.vd.clave,
      'Vendedor': r.vd.nombre,
      '% Nuevo': r.vd.comision || 0,
      '% Recompra': r.vd.comision_recompra || 0,
      'Ventas': r.nVentas,
      'Clientes nuevos': r.nNuevos,
      'Recompras': r.nRecompras,
      'Monto vendido': r.montoVendido,
      'Comisión nuevo': r.comNuevo,
      'Comisión recompra': r.comRecompra,
      'Comisión total': r.comTotal,
    }))
    const hoy = new Date().toISOString().slice(0, 10)
    exportarAExcel(filas, `comisiones_vendedor_${hoy}.xlsx`, 'Comisiones')
  }

  // Detalle de ventas de un vendedor
  const ventasDetalle = detalle
    ? ventas.filter(v => (claveDeEmpresa[v.empresa_id] || 'VEND-GERENCIA') === detalle.clave)
        .map(v => ({ v, ...comisionVenta(v) }))
        .sort((a, b) => new Date(b.v.created_at) - new Date(a.v.created_at))
    : []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Comisiones por vendedor</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Comisión por venta según cliente nuevo (primera compra) o recompra.</p>
        </div>
        <button onClick={descargarExcel} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>⬇️ Descargar Excel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Monto vendido (total)', value: money(totalVendido), color: '#1e293b' },
          { label: 'Comisiones generadas', value: money(totalComisiones), color: '#8B1A1A' },
          { label: 'Vendedores activos', value: vendedores.length, color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Vendedor', '% N / R', 'Ventas', 'Monto vendido', 'Com. nuevo', 'Com. recompra', 'Com. total', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumen.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay vendedores.</td></tr>}
            {resumen.map(r => (
              <tr key={r.vd.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ color: '#1e293b', fontWeight: 700, fontSize: 13 }}>{r.vd.nombre}</div>
                  <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>{r.vd.clave}</code>
                </td>
                <td style={{ padding: '11px 14px', color: '#475569', fontSize: 12 }}>{r.vd.comision || 0}% / {r.vd.comision_recompra || 0}%</td>
                <td style={{ padding: '11px 14px', color: '#475569', fontSize: 13 }}>
                  {r.nVentas}
                  <div style={{ color: '#94a3b8', fontSize: 10 }}>{r.nNuevos} nuevo · {r.nRecompras} recompra</div>
                </td>
                <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{money(r.montoVendido)}</td>
                <td style={{ padding: '11px 14px', color: '#059669', fontSize: 13 }}>{money(r.comNuevo)}</td>
                <td style={{ padding: '11px 14px', color: '#1d4ed8', fontSize: 13 }}>{money(r.comRecompra)}</td>
                <td style={{ padding: '11px 14px', color: '#8B1A1A', fontWeight: 800, fontSize: 14 }}>{money(r.comTotal)}</td>
                <td style={{ padding: '11px 14px' }}>
                  <button onClick={() => setDetalle(r.vd)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Ver ventas</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }} onClick={() => setDetalle(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 720, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{detalle.nombre}</h3>
                <span style={{ color: '#64748b', fontSize: 12 }}>Nuevo {detalle.comision || 0}% · Recompra {detalle.comision_recompra || 0}%</span>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            {ventasDetalle.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13, padding: 20, textAlign: 'center' }}>Este vendedor no tiene ventas registradas.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fb' }}>
                    {['Fecha', 'Empresa', 'Curso', 'Tipo', 'Monto', 'Tasa', 'Comisión'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventasDetalle.map(({ v, nuevo, tasa, monto, comision }) => (
                    <tr key={v.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{v.created_at ? new Date(v.created_at).toLocaleDateString('es-MX') : fLocal(v.fecha_curso)}</td>
                      <td style={{ padding: '9px 12px', color: '#1e293b', fontSize: 12, fontWeight: 600 }}>{v.empresa_nombre}</td>
                      <td style={{ padding: '9px 12px', color: '#475569', fontSize: 12 }}>{v.curso_nombre}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: nuevo ? '#f0fdf4' : '#eff6ff', color: nuevo ? '#059669' : '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{nuevo ? 'Nuevo' : 'Recompra'}</span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#1e293b', fontSize: 12 }}>{money(monto)}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{tasa}%</td>
                      <td style={{ padding: '9px 12px', color: '#8B1A1A', fontWeight: 700, fontSize: 12 }}>{money(comision)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
