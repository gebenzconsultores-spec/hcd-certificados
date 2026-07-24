import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const WA = '522223549353'
const fLocal = f => f ? new Date(String(f).slice(0, 10) + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function PromocionesEmpresa({ empresa, irACotizaciones }) {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const hoy = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('proximos_cursos').select('*').gte('fecha', hoy).order('fecha', { ascending: true })
    // Solo convocatorias con Precio Preventa vigente (descuento > 0 y aún no inicia)
    setPromos((data || []).filter(c => Number(c.descuento_promo) > 0 && c.estado !== 'en_curso'))
    setLoading(false)
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando promociones...</div>

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16, maxWidth: 640 }}>
        Aprovecha el <strong>Precio Preventa</strong>: descuentos por inscribirte antes de que inicie el curso. La promoción vence el día que arranca la capacitación.
      </p>

      {promos.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏷️</div>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Por ahora no hay promociones de Precio Preventa activas. ¡Vuelve pronto!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {promos.map(p => (
            <div key={p.id} style={{ background: '#fff', border: '2px solid #8B1A1A', borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 14, right: -30, background: '#8B1A1A', color: '#fff', padding: '4px 36px', transform: 'rotate(45deg)', fontSize: 11, fontWeight: 800 }}>PREVENTA</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: '#8B1A1A', lineHeight: 1 }}>-{Number(p.descuento_promo)}%</div>
              <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Precio Preventa</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>{p.curso_nombre}</h3>
              <div style={{ color: '#475569', fontSize: 13, marginBottom: 4 }}>📅 Inicia: {fLocal(p.fecha)}{p.hora ? ` · ${p.hora}` : ''}</div>
              <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>⏳ Válido hasta el {fLocal(p.fecha)}</div>
              {p.codigo_promo && <div style={{ display: 'inline-block', background: '#f9f0f0', color: '#8B1A1A', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>🎟️ {p.codigo_promo}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {irACotizaciones && <button onClick={irACotizaciones} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cotizar con esta promo</button>}
                <a href={`https://wa.me/${WA}?text=${encodeURIComponent(`Hola, soy ${empresa.nombre} y quiero aprovechar el Precio Preventa (-${p.descuento_promo}%) del curso "${p.curso_nombre}".`)}`}
                  target="_blank" rel="noopener noreferrer" style={{ background: '#25D366', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>💬 WhatsApp</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
