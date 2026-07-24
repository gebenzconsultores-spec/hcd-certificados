import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SERVICIOS = [
  'Implementación de Sistemas de Gestión',
  'Solución de Problemas',
  'Auditorías Internas',
  'Otro servicio',
]
const WA = '522223549353'
const ESTADO = { pendiente: { l: 'Pendiente', bg: '#fef9c3', c: '#92400e' }, confirmada: { l: 'En proceso', bg: '#eff6ff', c: '#1d4ed8' }, completada: { l: 'Atendida', bg: '#f0fdf4', c: '#059669' }, rechazada: { l: 'Cerrada', bg: '#fef2f2', c: '#dc2626' } }

export default function ConsultoriaEmpresa({ empresa }) {
  const [tipo, setTipo] = useState(SERVICIOS[0])
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState('')
  const [alcance, setAlcance] = useState('')
  const [saving, setSaving] = useState(false)
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('programaciones').select('*').eq('empresa_id', empresa.id).order('created_at', { ascending: false })
    setSolicitudes((data || []).filter(p => p.modalidad === 'consultoria'))
    setLoading(false)
  }

  async function enviar() {
    setSaving(true)
    try {
      const { error } = await supabase.from('programaciones').insert({
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
        curso_nombre: `Consultoría — ${tipo}`,
        modalidad: 'consultoria',
        num_personas: alcance ? Number(alcance) : null,
        fecha_solicitada: fecha || null,
        notas: descripcion.trim() || null,
        estado: 'pendiente',
      })
      if (error) throw error
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'consultoria', titulo: 'Solicitud de consultoría/auditoría',
          mensaje: `${empresa.nombre} solicita: ${tipo}`,
          link: '/admin/compras'
        })
      } catch (_) {}
      setDescripcion(''); setFecha(''); setAlcance('')
      await cargar()
      alert('✅ Solicitud enviada. Te contactaremos para dar seguimiento.')
    } catch (e) {
      alert('Error al enviar: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  const waLink = `https://wa.me/${WA}?text=${encodeURIComponent(`Hola, soy ${empresa.nombre} y quiero información sobre el servicio de "${tipo}".`)}`

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16, maxWidth: 640 }}>
        Solicita nuestros servicios de consultoría y auditoría. Cuéntanos qué necesitas y te contactamos con una propuesta.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Formulario */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '22px 24px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>Nueva solicitud</h3>

          <label style={lbl}>Servicio</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={inp}>
            {SERVICIOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <label style={lbl}>¿Qué necesitas? (descripción)</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={4} placeholder="Norma, alcance, contexto, objetivo…" style={{ ...inp, resize: 'vertical' }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Fecha deseada</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Alcance (personas/sitios)</label>
              <input type="number" value={alcance} onChange={e => setAlcance(e.target.value)} placeholder="Opcional" style={inp} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={enviar} disabled={saving} style={{ flex: 1, background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button>
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ background: '#25D366', color: '#fff', borderRadius: 8, padding: '11px 18px', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>💬 WhatsApp</a>
          </div>
        </div>

        {/* Historial */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Mis solicitudes</h3>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: 13, padding: 20 }}>Cargando...</div>
          ) : solicitudes.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Aún no has solicitado servicios.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {solicitudes.map(s => {
                const est = ESTADO[s.estado] || ESTADO.pendiente
                return (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{(s.curso_nombre || '').replace('Consultoría — ', '')}</div>
                      <span style={{ background: est.bg, color: est.c, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{est.l}</span>
                    </div>
                    {s.notas && <p style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>{s.notas}</p>}
                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
                      {s.fecha_solicitada && `📅 ${new Date(String(s.fecha_solicitada).slice(0, 10) + 'T00:00:00').toLocaleDateString('es-MX')} · `}
                      Enviada {s.created_at ? new Date(s.created_at).toLocaleDateString('es-MX') : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 12 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff', boxSizing: 'border-box' }
