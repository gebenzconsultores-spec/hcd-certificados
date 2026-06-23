import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('cotizaciones')
      .select('*')
      .order('created_at', { ascending: false })
    setCotizaciones(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('cotizaciones').update({ estado }).eq('id', id)
    await cargar()
    if (detalle?.id === id) setDetalle(d => ({ ...d, estado }))
  }

  const filtradas = cotizaciones
    .filter(c => filtro === 'todas' || c.estado === filtro)
    .filter(c => `${c.empresa_nombre} ${c.folio} ${c.curso_nombre} ${c.contacto_nombre}`.toLowerCase().includes(busqueda.toLowerCase()))

  const totalComisiones = cotizaciones
    .filter(c => c.estado === 'aceptada')
    .reduce((acc, c) => acc + (c.comision_monto || 0), 0)

  const ESTADOS = {
    enviada: { label: 'Enviada', color: '#1d4ed8', bg: '#eff6ff' },
    aceptada: { label: 'Aceptada', color: '#059669', bg: '#f0fdf4' },
    rechazada: { label: 'Rechazada', color: '#dc2626', bg: '#fef2f2' },
    borrador: { label: 'Borrador', color: '#64748b', bg: '#f1f5f9' },
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Cotizaciones</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Gestión de cotizaciones y seguimiento comercial</p>
      </div>

      {/* Resumen comisiones */}
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

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todas', 'enviada', 'aceptada', 'rechazada'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ padding: '6px 16px', borderRadius: 20, border: `2px solid ${filtro === f ? '#8B1A1A' : '#e2e8f0'}`, background: filtro === f ? '#f9f0f0' : '#fff', color: filtro === f ? '#8B1A1A' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
            {f === 'todas' ? 'Todas' : ESTADOS[f]?.label}
          </button>
        ))}
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar empresa, folio, curso..."
          style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 13, outline: 'none', minWidth: 260 }} />
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Folio', 'Empresa', 'Curso', 'Total', 'Comisión', 'Tipo cliente', 'Estado', 'Fecha', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay cotizaciones</td></tr>
            )}
            {filtradas.map(c => {
              const est = ESTADOS[c.estado] || ESTADOS.enviada
              return (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>{c.folio}</code>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{c.empresa_nombre}</td>
                  <td style={{ padding: '11px 14px', color: '#475569', fontSize: 12 }}>{c.curso_nombre}</td>
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 700, fontSize: 13 }}>
                    ${c.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#059669', fontWeight: 700, fontSize: 13 }}>
                    ${c.comision_monto?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 11 }}> ({c.comision_porcentaje}%)</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: c.es_cliente_nuevo ? '#f0fdf4' : '#eff6ff', color: c.es_cliente_nuevo ? '#059669' : '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                      {c.es_cliente_nuevo ? '★ Nuevo' : 'Recompra'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ background: est.bg, color: est.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {est.label}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 11 }}>
                    {new Date(c.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => setDetalle(c)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#475569' }}>
                      Ver
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
          onClick={() => setDetalle(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}
            onClick={e => e.stopPropagation()}>
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
              ['WhatsApp', detalle.contacto_whatsapp || '—'],
              ['Curso', detalle.curso_nombre],
              ['Tipo', detalle.tipo_precio === 'persona' ? `Por persona (${detalle.num_personas} personas, ${detalle.dias} día${detalle.dias > 1 ? 's' : ''})` : 'Grupo cerrado'],
              ['Precio base', `$${detalle.precio_base?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
              detalle.descuento_valor > 0 ? ['Descuento', `${detalle.descuento_tipo === '2x1' ? '2x1' : detalle.descuento_valor + '%'}`] : null,
              detalle.requiere_viaticos ? ['Viáticos', `$${detalle.monto_viaticos?.toLocaleString('es-MX')}`] : null,
              detalle.incluye_consultoria ? ['Consultoría', detalle.descripcion_consultoria] : null,
              ['Subtotal', `$${detalle.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
              detalle.aplica_iva ? ['IVA', `$${detalle.iva?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`] : null,
              ['TOTAL', `$${detalle.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
              ['Cliente', detalle.es_cliente_nuevo ? 'Nuevo ★' : 'Recompra'],
              ['Comisión', `$${detalle.comision_monto?.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${detalle.comision_porcentaje}%)`],
            ].filter(Boolean).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>{l}</span>
                <span style={{ color: '#1e293b', fontSize: 13, fontWeight: l === 'TOTAL' || l === 'Comisión' ? 800 : 400, color: l === 'TOTAL' ? '#8B1A1A' : l === 'Comisión' ? '#059669' : '#1e293b' }}>{v}</span>
              </div>
            ))}

            {detalle.notas && (
              <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 14px', marginTop: 16 }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>NOTAS</div>
                <div style={{ color: '#475569', fontSize: 13 }}>{detalle.notas}</div>
              </div>
            )}

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

            {/* WhatsApp follow up */}
            <a href={`https://wa.me/52${detalle.contacto_whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${detalle.contacto_nombre}, te contactamos de Hablando con Datos con respecto a tu cotización *${detalle.folio}*. ¿Tienes alguna duda o deseas proceder?`)}`}
              target="_blank"
              style={{ display: 'block', marginTop: 16, background: '#25d366', color: '#fff', textAlign: 'center', padding: '10px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
              💬 Dar seguimiento por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
