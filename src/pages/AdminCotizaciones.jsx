import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

// Descarga un arreglo de objetos como archivo .xlsx
function exportarAExcel(filas, archivo, hoja = 'Datos') {
  if (!filas || filas.length === 0) { alert('No hay datos para exportar.'); return }
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, hoja)
  XLSX.writeFile(wb, archivo)
}

export default function AdminCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('cotizaciones').select('*').order('created_at', { ascending: false })
    setCotizaciones(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('cotizaciones').update({ estado }).eq('id', id)
    await cargar()
    if (detalle?.id === id) setDetalle(d => ({ ...d, estado }))
  }

  async function eliminar(c) {
    if (!window.confirm(`¿ELIMINAR PERMANENTEMENTE la cotización ${c.folio}?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await supabase.from('cotizaciones').delete().eq('id', c.id)
      setDetalle(null)
      await cargar()
    } catch (e) {
      alert('No se pudo eliminar: ' + (e.message || 'error'))
    }
  }

  // ── ORDEN DE COMPRA ──
  async function subirOrdenCompra(cot, file) {
    if (!file) return
    if (file.type !== 'application/pdf') { alert('Solo se permiten archivos PDF'); return }
    setSubiendo(true)
    try {
      const nombreArchivo = `${cot.folio}_${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage.from('ordenes-compra').upload(nombreArchivo, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('ordenes-compra').getPublicUrl(nombreArchivo)
      await supabase.from('cotizaciones').update({
        orden_compra_url: urlData.publicUrl,
        orden_compra_nombre: file.name
      }).eq('id', cot.id)
      await cargar()
      setDetalle(d => ({ ...d, orden_compra_url: urlData.publicUrl, orden_compra_nombre: file.name }))
    } catch (e) {
      alert('Error al subir: ' + (e.message || 'verifica el bucket en Supabase Storage'))
    } finally { setSubiendo(false) }
  }

  async function eliminarOrdenCompra(cot) {
    if (!window.confirm('¿Eliminar la orden de compra adjunta?')) return
    try {
      // Extraer nombre del archivo de la URL
      const partes = cot.orden_compra_url.split('/ordenes-compra/')
      if (partes[1]) await supabase.storage.from('ordenes-compra').remove([partes[1]])
      await supabase.from('cotizaciones').update({ orden_compra_url: null, orden_compra_nombre: null }).eq('id', cot.id)
      await cargar()
      setDetalle(d => ({ ...d, orden_compra_url: null, orden_compra_nombre: null }))
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    }
  }

  const filtradas = cotizaciones
    .filter(c => filtro === 'todas' || c.estado === filtro)
    .filter(c => `${c.empresa_nombre} ${c.folio} ${c.curso_nombre} ${c.contacto_nombre}`.toLowerCase().includes(busqueda.toLowerCase()))

  const totalComisiones = cotizaciones.filter(c => c.estado === 'aceptada').reduce((acc, c) => acc + (c.comision_monto || 0), 0)

  const ESTADOS = {
    enviada: { label: 'Enviada', color: '#1d4ed8', bg: '#eff6ff' },
    aceptada: { label: 'Aceptada', color: '#059669', bg: '#f0fdf4' },
    rechazada: { label: 'Rechazada', color: '#dc2626', bg: '#fef2f2' },
    borrador: { label: 'Borrador', color: '#64748b', bg: '#f1f5f9' },
    cancelada: { label: 'Cancelada', color: '#64748b', bg: '#f1f5f9' },
  }

  function descargarExcel() {
    const filas = filtradas.map(c => ({
      'Folio': c.folio || '',
      'Fecha': c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX') : '',
      'Empresa': c.empresa_nombre || '',
      'Registro': c.empresa_id ? 'Con registro' : 'Sin registro',
      'Contacto': c.contacto_nombre || '',
      'Email': c.contacto_email || '',
      'Curso': c.curso_nombre || '',
      'Total': c.total || 0,
      'Comisión': c.comision_monto || 0,
      '% Comisión': c.comision_porcentaje || 0,
      'Estado': (ESTADOS[c.estado] || ESTADOS.enviada).label,
      'Orden de compra': c.orden_compra_nombre || (c.orden_compra_url ? 'Adjunta' : ''),
    }))
    const hoy = new Date().toISOString().slice(0, 10)
    exportarAExcel(filas, `cotizaciones_${hoy}.xlsx`, 'Cotizaciones')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Cotizaciones generadas</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Seguimiento comercial y órdenes de compra</p>
        </div>
        <button onClick={descargarExcel} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>⬇️ Descargar Excel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total cotizaciones', value: cotizaciones.length, color: '#1e293b' },
          { label: 'Enviadas', value: cotizaciones.filter(c => c.estado === 'enviada').length, color: '#1d4ed8' },
          { label: 'Aceptadas', value: cotizaciones.filter(c => c.estado === 'aceptada').length, color: '#059669' },
          { label: 'Mis comisiones (aceptadas)', value: `$${totalComisiones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: '#8B1A1A' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: s.label.includes('comision') ? 18 : 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todas', 'enviada', 'aceptada', 'cancelada'].map(fil => (
          <button key={fil} onClick={() => setFiltro(fil)}
            style={{ padding: '6px 16px', borderRadius: 20, border: `2px solid ${filtro === fil ? '#8B1A1A' : '#e2e8f0'}`, background: filtro === fil ? '#f9f0f0' : '#fff', color: filtro === fil ? '#8B1A1A' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {fil === 'todas' ? 'Todas' : ESTADOS[fil]?.label}
          </button>
        ))}
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar empresa, folio, curso..."
          style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 13, outline: 'none', minWidth: 260 }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Folio', 'Fecha', 'Empresa', 'Registro', 'Curso', 'Total', 'Comisión', 'OC', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay cotizaciones</td></tr>
            )}
            {filtradas.map(c => {
              const est = ESTADOS[c.estado] || ESTADOS.enviada
              return (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 14px' }}><code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>{c.folio}</code></td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{c.empresa_nombre}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: c.empresa_id ? '#f0fdf4' : '#fef9c3', color: c.empresa_id ? '#059669' : '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                      {c.empresa_id ? '✓ Con registro' : 'Sin registro'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontSize: 12 }}>{c.curso_nombre}</td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 700, fontSize: 13 }}>${c.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '11px 14px', color: '#059669', fontWeight: 700, fontSize: 13 }}>${c.comision_monto?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {c.orden_compra_url ? <span style={{ color: '#059669', fontSize: 16 }} title="Tiene orden de compra">📎</span> : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: est.bg, color: est.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{est.label}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => setDetalle(c)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#475569' }}>Ver</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }} onClick={() => setDetalle(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{detalle.folio}</code>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 8 }}>{detalle.empresa_nombre}</h3>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {[
              ['Contacto', detalle.contacto_nombre],
              ['Email', detalle.contacto_email],
              ['Curso', detalle.curso_nombre],
              ['Total', `$${detalle.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
              ['Comisión', `$${detalle.comision_monto?.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${detalle.comision_porcentaje}%)`],
            ].filter(Boolean).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>{l}</span>
                <span style={{ color: l === 'Total' ? '#8B1A1A' : l === 'Comisión' ? '#059669' : '#1e293b', fontSize: 13, fontWeight: (l === 'Total' || l === 'Comisión') ? 800 : 400 }}>{v}</span>
              </div>
            ))}

            {/* ORDEN DE COMPRA */}
            <div style={{ marginTop: 20, background: '#f8f9fb', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📎 ORDEN DE COMPRA</div>
              {detalle.orden_compra_url ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <a href={detalle.orden_compra_url} target="_blank" style={{ color: '#1d4ed8', fontSize: 13, fontWeight: 600, textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📄 {detalle.orden_compra_nombre || 'Ver orden de compra'}
                  </a>
                  <button onClick={() => eliminarOrdenCompra(detalle)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Eliminar OC</button>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>No hay orden de compra adjunta</p>
                  <label style={{ display: 'inline-block', background: '#8B1A1A', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: subiendo ? 'wait' : 'pointer' }}>
                    {subiendo ? 'Subiendo...' : '⬆️ Adjuntar orden de compra (PDF)'}
                    <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={subiendo}
                      onChange={e => subirOrdenCompra(detalle, e.target.files[0])} />
                  </label>
                </div>
              )}
            </div>

            {/* Cambiar estado */}
            <div style={{ marginTop: 20 }}>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>CAMBIAR ESTADO</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['enviada', 'aceptada', 'rechazada'].map(est => (
                  <button key={est} onClick={() => cambiarEstado(detalle.id, est)}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${detalle.estado === est ? '#8B1A1A' : '#e2e8f0'}`, background: detalle.estado === est ? '#f9f0f0' : '#fff', color: detalle.estado === est ? '#8B1A1A' : '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>
                    {est}
                  </button>
                ))}
              </div>
            </div>

            {/* Eliminar permanente */}
            <button onClick={() => eliminar(detalle)}
              style={{ width: '100%', marginTop: 16, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🗑 Eliminar cotización permanentemente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
