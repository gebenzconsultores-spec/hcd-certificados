import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ESTADOS = [
  ['enviado', 'Nuevo', '#eff6ff', '#1d4ed8'],
  ['interesado', 'Me interesa', '#f0fdf4', '#059669'],
  ['contratado', 'Contratado', '#ecfdf5', '#047857'],
  ['descartado', 'Descartado', '#fef2f2', '#dc2626'],
]
const estadoInfo = e => ESTADOS.find(x => x[0] === e) || ESTADOS[0]

// Pool de candidatos: prospectos que HCD envía a la empresa.
export default function PoolCandidatos({ empresa }) {
  const [envios, setEnvios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('candidato_envios')
      .select('*, candidato:candidatos(*), vacante:vacantes(titulo)')
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false })
    setEnvios(data || [])
    setLoading(false)
  }

  async function marcar(envio, estado) {
    const { error } = await supabase.from('candidato_envios').update({ estado }).eq('id', envio.id)
    if (error) { alert('No se pudo actualizar: ' + error.message); return }
    // Aviso al admin cuando la empresa muestra interés o contrata
    if (estado === 'interesado' || estado === 'contratado') {
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'candidato', titulo: `Candidato: ${estado === 'contratado' ? 'contratado' : 'interés'}`,
          mensaje: `${empresa.nombre} marcó "${estado}" al candidato ${envio.candidato?.nombre || ''}`,
          link: '/admin/candidatos'
        })
      } catch (_) {}
    }
    await cargar()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando pool de candidatos...</div>

  const visibles = filtro === 'todos' ? envios : envios.filter(e => e.estado === filtro)

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16, maxWidth: 640 }}>
        Prospectos que te enviamos con base en tus vacantes y tu organigrama. Marca los que te interesen y nosotros damos seguimiento.
      </p>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['todos', `Todos (${envios.length})`], ...ESTADOS.map(([v, l]) => [v, `${l} (${envios.filter(e => e.estado === v).length})`])].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${filtro === v ? '#8B1A1A' : '#e2e8f0'}`, background: filtro === v ? '#8B1A1A' : '#fff', color: filtro === v ? '#fff' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🧑‍💼</div>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            {envios.length === 0 ? 'Aún no tienes candidatos. Publica vacantes en tu Bolsa de trabajo y te enviaremos prospectos alineados.' : 'No hay candidatos con ese filtro.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {visibles.map(env => {
            const c = env.candidato || {}
            const ei = estadoInfo(env.estado)
            return (
              <div key={env.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>{c.nombre}</h3>
                      <span style={{ background: ei[2], color: ei[3], padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{ei[1]}</span>
                      {env.vacante?.titulo && <span style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Para: {env.vacante.titulo}</span>}
                    </div>
                    {c.perfil && <p style={{ color: '#475569', fontSize: 13, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{c.perfil}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, marginTop: 6 }}>
                      {c.habilidades && <Campo label="Habilidades" valor={c.habilidades} />}
                      {c.experiencia && <Campo label="Experiencia" valor={c.experiencia} />}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', fontSize: 12 }}>
                      {c.correo && <span style={{ color: '#475569' }}>✉️ {c.correo}</span>}
                      {c.telefono && <span style={{ color: '#475569' }}>📞 {c.telefono}</span>}
                      {c.cv_url && <a href={c.cv_url} target="_blank" style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>📎 Ver CV</a>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => marcar(env, 'interesado')} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>👍 Me interesa</button>
                    <button onClick={() => marcar(env, 'contratado')} style={{ background: '#fff', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>✅ Contratado</button>
                    <button onClick={() => marcar(env, 'descartado')} style={{ background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Descartar</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>{valor}</div>
    </div>
  )
}
