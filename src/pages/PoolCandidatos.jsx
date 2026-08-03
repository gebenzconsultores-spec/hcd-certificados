import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

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
  const [postulaciones, setPostulaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [vista, setVista] = useState('pool') // pool | postulaciones

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [e, p] = await Promise.all([
      supabase.from('candidato_envios').select('*, candidato:candidatos(*), vacante:vacantes(titulo)').eq('empresa_id', empresa.id).order('created_at', { ascending: false }),
      supabase.from('postulaciones').select('*').eq('empresa_id', empresa.id).order('created_at', { ascending: false }),
    ])
    setEnvios(e.data || [])
    setPostulaciones(p.data || [])
    setLoading(false)
  }

  async function eliminarEnvio(env) {
    if (!window.confirm(`¿Quitar a ${env.candidato?.nombre || 'este candidato'} de tu pool?`)) return
    const { error } = await supabase.from('candidato_envios').delete().eq('id', env.id)
    if (error) { alert('Error: ' + error.message); return }
    await cargar()
  }

  async function eliminarPostulacion(p) {
    if (!window.confirm(`¿Eliminar la postulación de ${p.participante_nombre}?`)) return
    const { error } = await supabase.from('postulaciones').delete().eq('id', p.id)
    if (error) { alert('Error: ' + error.message); return }
    await cargar()
  }

  function exportarExcelPool() {
    if (!envios.length) { alert('No hay candidatos para exportar.'); return }
    const filas = envios.map(e => ({ 'Nombre': e.candidato?.nombre || '', 'Correo': e.candidato?.correo || '', 'Teléfono': e.candidato?.telefono || '', 'Perfil': e.candidato?.perfil || '', 'Vacante': e.vacante?.titulo || '', 'Estado': estadoInfo(e.estado)[1], 'Fecha': e.created_at ? new Date(e.created_at).toLocaleDateString('es-MX') : '' }))
    const ws = XLSX.utils.json_to_sheet(filas); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Pool'); XLSX.writeFile(wb, `pool_candidatos_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportarExcelPostulaciones() {
    if (!postulaciones.length) { alert('No hay postulaciones.'); return }
    const filas = postulaciones.map(p => ({ 'Alumno': p.participante_nombre || '', 'Correo': p.participante_correo || '', 'Vacante': p.vacante_titulo || '', 'Estatus': p.estatus || 'nueva', 'Fecha': p.created_at ? new Date(p.created_at).toLocaleDateString('es-MX') : '' }))
    const ws = XLSX.utils.json_to_sheet(filas); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Postulaciones'); XLSX.writeFile(wb, `postulaciones_${new Date().toISOString().slice(0, 10)}.xlsx`)
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
        Prospectos que te enviamos y postulaciones de alumnos a tus vacantes.
      </p>

      {/* Vista tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['pool', `🧑‍💼 Pool (${envios.length})`], ['postulaciones', `📨 Postulaciones (${postulaciones.length})`]].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)}
            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${vista === v ? '#8B1A1A' : '#e2e8f0'}`, background: vista === v ? '#8B1A1A' : '#fff', color: vista === v ? '#fff' : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {vista === 'pool' && <>
      {/* Filtros + Excel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['todos', `Todos (${envios.length})`], ...ESTADOS.map(([v, l]) => [v, `${l} (${envios.filter(e => e.estado === v).length})`])].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${filtro === v ? '#8B1A1A' : '#e2e8f0'}`, background: filtro === v ? '#8B1A1A' : '#fff', color: filtro === v ? '#fff' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={exportarExcelPool} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇️ Excel</button>
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
                    <button onClick={() => eliminarEnvio(env)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>🗑 Quitar</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>}

      {/* ── POSTULACIONES RECIBIDAS ── */}
      {vista === 'postulaciones' && <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={exportarExcelPostulaciones} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇️ Excel</button>
        </div>
        {postulaciones.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aún no has recibido postulaciones de alumnos.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {postulaciones.map(p => (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{p.participante_nombre}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>👔 {p.vacante_titulo}{p.participante_correo ? ` · ${p.participante_correo}` : ''}</div>
                  <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-MX') : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{p.estatus || 'Nueva'}</span>
                  <button onClick={() => eliminarPostulacion(p)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>}
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
