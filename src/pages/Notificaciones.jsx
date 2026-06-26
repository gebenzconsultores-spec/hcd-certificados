import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Notificaciones() {
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  useEffect(() => {
    cargar()
    // Recargar cada 60 segundos
    const interval = setInterval(cargar, 60000)
    // Cerrar al hacer clic fuera
    const handleClick = e => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handleClick)
    return () => { clearInterval(interval); document.removeEventListener('mousedown', handleClick) }
  }, [])

  async function cargar() {
    try {
      const { data } = await supabase.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(30)
      setNotifs(data || [])
    } catch (_) {}
    setLoading(false)
  }

  const noLeidas = notifs.filter(n => !n.leida).length

  async function marcarLeida(n) {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', n.id)
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x))
    if (n.link) { navigate(n.link); setAbierto(false) }
  }

  async function marcarTodasLeidas() {
    await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
    setNotifs(prev => prev.map(x => ({ ...x, leida: true })))
  }

  function iconoTipo(tipo) {
    if (tipo === 'cotizacion') return '💼'
    if (tipo === 'empresa_registro') return '🏢'
    if (tipo === 'programacion') return '📅'
    if (tipo === 'empleado') return '👤'
    if (tipo === 'orden_compra') return '📎'
    return '🔔'
  }

  function tiempoRelativo(fecha) {
    const diff = Math.floor((new Date() - new Date(fecha)) / 1000)
    if (diff < 60) return 'hace un momento'
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
    return `hace ${Math.floor(diff / 86400)} días`
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setAbierto(!abierto)}
        style={{ position: 'relative', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, width: 40, height: 40, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        🔔
        {noLeidas > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: '#fff', borderRadius: '50%', minWidth: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{ position: 'absolute', top: 48, right: 0, width: 360, maxHeight: 480, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.15)', zIndex: 1000, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>Notificaciones</h3>
            {noLeidas > 0 && (
              <button onClick={marcarTodasLeidas} style={{ background: 'none', border: 'none', color: '#8B1A1A', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Marcar todas leídas
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Cargando...</div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 13 }}>No hay notificaciones</div>
              </div>
            ) : (
              notifs.map(n => (
                <div key={n.id} onClick={() => marcarLeida(n)}
                  style={{ padding: '14px 18px', borderBottom: '1px solid #f8f9fb', cursor: 'pointer', background: n.leida ? '#fff' : '#f9f0f0', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 20 }}>{iconoTipo(n.tipo)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: n.leida ? 500 : 700, color: '#1e293b' }}>{n.titulo}</div>
                    {n.mensaje && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{n.mensaje}</div>}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{tiempoRelativo(n.created_at)}</div>
                  </div>
                  {!n.leida && <div style={{ width: 8, height: 8, background: '#8B1A1A', borderRadius: '50%', marginTop: 4 }} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
