import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({ cursos: 0, empresas: 0, participantes: 0, certificados: 0, presencial: 0, online: 0 })
  const [recientes, setRecientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const [c, e, p, cert] = await Promise.all([
        supabase.from('cursos').select('id', { count: 'exact' }),
        supabase.from('empresas').select('id', { count: 'exact' }),
        supabase.from('participantes').select('id', { count: 'exact' }),
        supabase.from('certificados').select('id, modalidad, created_at, id_unico, nombre_participante, nombre_curso', { count: 'exact' }).order('created_at', { ascending: false }).limit(8)
      ])
      const pres = cert.data?.filter(x => x.modalidad === 'presencial').length || 0
      setStats({
        cursos: c.count || 0, empresas: e.count || 0,
        participantes: p.count || 0, certificados: cert.count || 0,
        presencial: pres, online: (cert.count || 0) - pres
      })
      setRecientes(cert.data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const cards = [
    { label: 'Cursos activos', value: stats.cursos, color: '#8B1A1A', bg: '#f9f0f0' },
    { label: 'Empresas', value: stats.empresas, color: '#1d4ed8', bg: '#eff6ff' },
    { label: 'Participantes', value: stats.participantes, color: '#059669', bg: '#f0fdf4' },
    { label: 'Certificados emitidos', value: stats.certificados, color: '#7c3aed', bg: '#f5f3ff' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Resumen general del sistema de certificados</p>
      </div>

      {/* Tarjetas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.color }}>{loading ? '—' : c.value}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4, fontWeight: 500 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Modalidad */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Presencial', value: stats.presencial, color: '#1d4ed8' },
          { label: 'Online', value: stats.online, color: '#059669' }
        ].map(m => (
          <div key={m.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#475569', fontSize: 14 }}>Cursos {m.label}</span>
            <span style={{ color: m.color, fontWeight: 800, fontSize: 22 }}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Certificados recientes */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Certificados recientes</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['ID Único', 'Participante', 'Curso', 'Modalidad', 'Fecha'].map(h => (
                <th key={h} style={{ padding: '10px 18px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recientes.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '11px 18px' }}>
                  <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{r.id_unico}</code>
                </td>
                <td style={{ padding: '11px 18px', color: '#1e293b', fontSize: 14 }}>{r.nombre_participante}</td>
                <td style={{ padding: '11px 18px', color: '#475569', fontSize: 13 }}>{r.nombre_curso}</td>
                <td style={{ padding: '11px 18px' }}>
                  <span style={{ background: r.modalidad === 'presencial' ? '#eff6ff' : '#f0fdf4', color: r.modalidad === 'presencial' ? '#1d4ed8' : '#059669', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {r.modalidad === 'presencial' ? 'Presencial' : 'Online'}
                  </span>
                </td>
                <td style={{ padding: '11px 18px', color: '#94a3b8', fontSize: 12 }}>
                  {new Date(r.created_at).toLocaleDateString('es-MX')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
