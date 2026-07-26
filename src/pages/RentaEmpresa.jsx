import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const WA = '522223549353'
const money = n => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fLocal = f => f ? new Date(String(f).slice(0, 10) + 'T00:00:00').toLocaleDateString('es-MX') : ''

export default function RentaEmpresa({ empresa }) {
  const [renta, setRenta] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [avisando, setAvisando] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [r, f] = await Promise.all([
      supabase.from('rentas_plataforma').select('*').eq('empresa_id', empresa.id).order('created_at', { ascending: false }),
      supabase.from('facturas_renta').select('*').eq('empresa_id', empresa.id).order('created_at', { ascending: false }),
    ])
    setRenta((r.data || [])[0] || null)
    setFacturas(f.data || [])
    setLoading(false)
  }

  async function avisarPago(factura) {
    setAvisando(factura.id)
    try {
      await supabase.from('facturas_renta').update({ pago_avisado: true, pago_avisado_fecha: new Date().toISOString() }).eq('id', factura.id)
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'pago_renta', titulo: 'Aviso de pago de renta',
          mensaje: `${empresa.nombre} avisó el pago de la factura ${factura.folio || ''}`,
          link: '/admin/renta'
        })
      } catch (_) {}
      await cargar()
      alert('✅ Aviso de pago enviado. Lo revisaremos y confirmaremos tu pago.')
    } catch (e) { alert('Error: ' + (e.message || '')) } finally { setAvisando(null) }
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando tu renta...</div>

  const pendientes = facturas.filter(f => f.estado !== 'pagada')
  const totalPendiente = pendientes.reduce((a, f) => a + (Number(f.total) || 0), 0)

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16, maxWidth: 640 }}>
        Aquí ves tu renta mensual de la plataforma, tus facturas y puedes avisarnos cuando realices un pago.
      </p>

      {/* Renta actual */}
      {!renta ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 30, textAlign: 'center', color: '#94a3b8', marginBottom: 20 }}>
          No tienes una renta de plataforma configurada. Si crees que es un error, contáctanos.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#8B1A1A' }}>{money(renta.precio_mensual)}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Renta mensual {renta.aplica_iva ? '+ IVA' : ''}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{fLocal(renta.fecha_inicio)}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Inicio de renta</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: totalPendiente > 0 ? '#d97706' : '#059669' }}>{money(totalPendiente)}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Total por pagar</div>
          </div>
        </div>
      )}

      {/* Facturas */}
      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Mis facturas de renta</h3>
      {facturas.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Aún no tienes facturas de renta.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {facturas.map(f => {
            const pagada = f.estado === 'pagada'
            return (
              <div key={f.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{f.folio}</code>
                    <span style={{ color: '#475569', fontSize: 13 }}>{f.periodo}</span>
                    <span style={{ color: '#1e293b', fontWeight: 700, fontSize: 14 }}>{money(f.total)}</span>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: pagada ? '#f0fdf4' : '#fef9c3', color: pagada ? '#059669' : '#92400e', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{pagada ? '✓ Pagada' : '⏳ Pendiente'}</span>
                    {!pagada && f.pago_avisado && <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>💰 Pago avisado</span>}
                  </div>
                </div>
                {!pagada && !f.pago_avisado && (
                  <button onClick={() => avisarPago(f)} disabled={avisando === f.id}
                    style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {avisando === f.id ? 'Enviando...' : 'Avisar pago'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <a href={`https://wa.me/${WA}?text=${encodeURIComponent(`Hola, soy ${empresa.nombre} y quiero información sobre mi renta de plataforma.`)}`}
          target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#25D366', color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>💬 Dudas por WhatsApp</a>
      </div>
    </div>
  )
}
