import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Bienvenida() {
  const navigate = useNavigate()
  const [convocatorias, setConvocatorias] = useState([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    (async () => {
      const hoy = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('proximos_cursos').select('*').gte('fecha', hoy).order('fecha', { ascending: true })
      // El cintillo público solo muestra convocatorias ABIERTAS de HCD (no las cerradas/de una empresa específica)
      setConvocatorias((data || []).filter(c => c.estado !== 'en_curso' && c.estado !== 'cerrado' && c.tipo_curso !== 'empresa' && c.mostrar_en !== 'empresa' && !c.empresa_id))
    })()
  }, [])

  useEffect(() => {
    if (convocatorias.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % convocatorias.length), 4000)
    return () => clearInterval(t)
  }, [convocatorias])

  const opciones = [
    {
      id: 'empresa',
      icono: '🏢',
      titulo: 'Soy Empresa',
      desc: 'Gestiona la capacitación de tu personal, cotiza cursos, descarga certificados y reportes de auditoría.',
      color: '#8B1A1A',
      bg: '#f9f0f0',
      accion: () => navigate('/empresa/acceso'),
      cta: 'Acceder o registrarme'
    },
    {
      id: 'estudiante',
      icono: '🎓',
      titulo: 'Soy Estudiante',
      desc: 'Presenta tus exámenes, obtén tus certificados y consulta tu historial de capacitación.',
      color: '#1d4ed8',
      bg: '#eff6ff',
      accion: () => navigate('/estudiante/acceso'),
      cta: 'Entrar'
    },
    {
      id: 'cotizar',
      icono: '💼',
      titulo: 'Cotizar un curso',
      desc: 'Obtén una cotización inmediata de nuestros cursos y servicios de consultoría sin necesidad de registrarte.',
      color: '#059669',
      bg: '#f0fdf4',
      accion: () => navigate('/cotizar'),
      cta: 'Cotizar ahora'
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fff 0%,#fef5f5 100%)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: 'clamp(16px,4vw,24px) clamp(16px,4vw,32px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#8B1A1A', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 12, height: 12, background: '#fff', borderRadius: '50%' }} />
          </div>
          <div>
            <div style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 16 }}>Hablando con Datos</div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Consultoría y Capacitación en Sistemas de Gestión</div>
          </div>
        </div>
        <button onClick={() => navigate('/login')}
          style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 18px', fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
          Acceso administrador
        </button>
      </header>

      {/* Cintillo de convocatorias abiertas */}
      {convocatorias.length > 0 && (() => {
        const c = convocatorias[idx]
        return (
          <div onClick={() => navigate('/empresa/acceso')}
            style={{ background: 'linear-gradient(90deg,#8B1A1A,#a52a2a)', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,.2)', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: .5 }}>📣 CONVOCATORIA ABIERTA</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{c.curso_nombre}</span>
            <span style={{ fontSize: 13, opacity: .95 }}>📅 {new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}{c.hora ? ` · ${c.hora}` : ''}</span>
            {c.tipo_costo === 'sin_costo' && <span style={{ background: '#fff', color: '#8B1A1A', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>🎁 Sin costo</span>}
            {c.codigo_promo && <span style={{ background: 'rgba(255,255,255,.2)', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🎟️ {c.codigo_promo}</span>}
            <span style={{ fontSize: 12, textDecoration: 'underline', opacity: .9 }}>Inscríbete →</span>
          </div>
        )
      })()}

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 680 }}>
          <h1 style={{ fontSize: 'clamp(26px,7vw,38px)', fontWeight: 800, color: '#1e293b', lineHeight: 1.15, marginBottom: 16 }}>
            Plataforma de capacitación y<br /><span style={{ color: '#8B1A1A' }}>certificación profesional</span>
          </h1>
          <p style={{ fontSize: 'clamp(14px,3.5vw,16px)', color: '#64748b', lineHeight: 1.6 }}>
            Gestiona cursos, certificados verificables con QR, exámenes en línea y todo el proceso de capacitación de tu organización en un solo lugar.
          </p>
        </div>

        {/* Tarjetas de acceso */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20, maxWidth: 980, width: '100%' }}>
          {opciones.map(o => (
            <div key={o.id} onClick={o.accion}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '32px 28px', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,.1)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ width: 56, height: 56, background: o.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 20 }}>
                {o.icono}
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>{o.titulo}</h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24, flex: 1 }}>{o.desc}</p>
              <button style={{ background: o.color, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                {o.cta} →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ padding: 'clamp(16px,4vw,20px) clamp(16px,4vw,32px)', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: 12 }}>
          Hablando con Datos · Puebla, México · Tel: 222 354 9353 · www.hablandocondatos.com.mx
        </p>
      </footer>
    </div>
  )
}
