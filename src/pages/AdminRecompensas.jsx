import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { otorgarTokens, otorgarTokensPorReferidoPrimeraCompra, TOKENS_REFERIDO_PRIMERA_COMPRA, CATEGORIAS_CANJE, ESTADOS_CANJE, ESTADOS_MEMBRESIA } from '../lib/tokens'

const TABS = [
  { id: 'referidos', label: '🤝 Referidos y tokens' },
  { id: 'canjes', label: '🎁 Canjes' },
  { id: 'membresias', label: '💳 Membresías' },
  { id: 'catalogo', label: '📋 Catálogo' },
]

export default function AdminRecompensas() {
  const [tab, setTab] = useState('referidos')
  // Participante a preseleccionar en "Referidos y tokens" cuando llegamos
  // ahí desde el botón "🎁 Otorgar tokens" de otra pestaña (ej. Membresías).
  const [participantePreseleccionado, setParticipantePreseleccionado] = useState(null)

  function irAOtorgarTokens(participante) {
    setParticipantePreseleccionado(participante)
    setTab('referidos')
  }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Recompensas y Membresías</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Tokens HCD, referidos, canjes y membresías recurrentes (pago manual)</p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#8B1A1A' : 'transparent'}`, padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#8B1A1A' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'referidos' && <TabReferidos preseleccionado={participantePreseleccionado} onConsumirPreseleccion={() => setParticipantePreseleccionado(null)} />}
      {tab === 'canjes' && <TabCanjes />}
      {tab === 'membresias' && <TabMembresias onOtorgarTokens={irAOtorgarTokens} />}
      {tab === 'catalogo' && <TabCatalogo />}
    </div>
  )
}

// ── Referidos y tokens ──────────────────────────────────────────
function TabReferidos({ preseleccionado, onConsumirPreseleccion }) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [referidos, setReferidos] = useState([])
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (preseleccionado) {
      seleccionar(preseleccionado)
      onConsumirPreseleccion && onConsumirPreseleccion()
    }
  }, [preseleccionado])

  async function buscar(q) {
    setBusqueda(q)
    if (q.trim().length < 2) { setResultados([]); return }
    const { data } = await supabase.from('participantes').select('id, nombre, correo, codigo_referido, tokens_balance, referido_por')
      .or(`nombre.ilike.%${q}%,correo.ilike.%${q}%,codigo_referido.ilike.%${q}%`).limit(15)
    setResultados(data || [])
  }

  async function seleccionar(p) {
    setSeleccionado(p)
    const { data: movs } = await supabase.from('tokens_movimientos').select('*').eq('participante_id', p.id).order('created_at', { ascending: false }).limit(30)
    setMovimientos(movs || [])
    const { data: refs } = await supabase.from('participantes').select('id, nombre, correo, tokens_referido_otorgado, created_at').eq('referido_por', p.id).order('created_at', { ascending: false })
    setReferidos(refs || [])
  }

  async function otorgar() {
    const m = parseInt(monto, 10)
    if (!m || m <= 0) { alert('Ingresa un monto válido de tokens.'); return }
    if (!concepto.trim()) { alert('Escribe un concepto para el movimiento.'); return }
    setGuardando(true)
    try {
      await otorgarTokens(seleccionado.id, m, concepto.trim(), null, 'admin')
      setMonto(''); setConcepto('')
      const nuevoSaldo = (seleccionado.tokens_balance || 0) + m
      setSeleccionado(s => ({ ...s, tokens_balance: nuevoSaldo }))
      seleccionar({ ...seleccionado, tokens_balance: nuevoSaldo })
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarPrimeraCompra(referidoId, nombre) {
    if (!confirm(`¿Confirmas que "${nombre}" pagó su primer curso? Se otorgarán ${TOKENS_REFERIDO_PRIMERA_COMPRA} tokens a quien lo refirió.`)) return
    try {
      await otorgarTokensPorReferidoPrimeraCompra(referidoId)
      alert('¡Tokens otorgados!')
      seleccionar(seleccionado)
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: seleccionado ? '320px 1fr' : '1fr', gap: 18 }}>
      <div>
        <input value={busqueda} onChange={e => buscar(e.target.value)} placeholder="Buscar por nombre, correo o código de referido..."
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 10 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
          {resultados.map(p => (
            <div key={p.id} onClick={() => seleccionar(p)}
              style={{ background: seleccionado?.id === p.id ? '#fef2f2' : '#fff', border: `1px solid ${seleccionado?.id === p.id ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{p.nombre}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{p.correo}</div>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                <span style={{ background: '#fef2f2', color: '#8B1A1A', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>{p.tokens_balance || 0} tokens</span>
                {p.codigo_referido && <code style={{ marginLeft: 6, color: '#94a3b8' }}>{p.codigo_referido}</code>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {seleccionado && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{seleccionado.nombre}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{seleccionado.correo} · Código: <code>{seleccionado.codigo_referido || '—'}</code></div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#8B1A1A' }}>{seleccionado.tokens_balance || 0} tokens</div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Otorgar / ajustar tokens</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Monto" style={{ width: 100, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Concepto (ej. Promoción lanzamiento)" style={{ flex: 1, minWidth: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <button onClick={otorgar} disabled={guardando} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {guardando ? 'Guardando...' : 'Otorgar'}
              </button>
            </div>
          </div>

          {referidos.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Personas que refirió ({referidos.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {referidos.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>{r.nombre}</span>
                    {r.tokens_referido_otorgado ? (
                      <span style={{ color: '#059669', fontWeight: 700, fontSize: 11 }}>✓ {TOKENS_REFERIDO_PRIMERA_COMPRA} tokens otorgados</span>
                    ) : (
                      <button onClick={() => confirmarPrimeraCompra(r.id, r.nombre)} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Confirmar primera compra pagada
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Movimientos</div>
            {movimientos.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 12 }}>Sin movimientos.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {movimientos.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>{m.concepto || m.tipo} <span style={{ color: '#cbd5e1' }}>· {new Date(m.created_at).toLocaleDateString('es-MX')}</span></span>
                    <span style={{ fontWeight: 700, color: m.tipo === 'canjeado' ? '#dc2626' : '#059669' }}>{m.tipo === 'canjeado' ? '−' : '+'}{m.monto}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Canjes ──────────────────────────────────────────
function TabCanjes() {
  const [canjes, setCanjes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('canjes').select('*, participante:participantes(nombre, correo, whatsapp)').order('created_at', { ascending: false })
    setCanjes(data || [])
    setLoading(false)
  }

  async function cambiarEstado(canje, estado) {
    const notas = estado === 'cancelado' ? prompt('Nota (opcional) sobre la cancelación:') || '' : canje.notas_admin
    const { error } = await supabase.from('canjes').update({ estado, notas_admin: notas }).eq('id', canje.id)
    if (error) { alert('Error: ' + error.message); return }
    cargar()
  }

  const lista = filtro === 'todos' ? canjes : canjes.filter(c => c.estado === filtro)

  if (loading) return <div style={{ color: '#94a3b8', padding: 20 }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['todos', ...Object.keys(ESTADOS_CANJE)].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ background: filtro === f ? '#8B1A1A' : '#f1f5f9', color: filtro === f ? '#fff' : '#475569', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {f === 'todos' ? 'Todos' : ESTADOS_CANJE[f].label}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px 6px' }}>Alumno</th>
              <th style={{ padding: '8px 6px' }}>Ítem</th>
              <th style={{ padding: '8px 6px' }}>Tokens</th>
              <th style={{ padding: '8px 6px' }}>Fecha</th>
              <th style={{ padding: '8px 6px' }}>Estado</th>
              <th style={{ padding: '8px 6px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(c => {
              const est = ESTADOS_CANJE[c.estado] || ESTADOS_CANJE.solicitado
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{c.participante?.nombre || '—'}</div>
                    <div style={{ color: '#94a3b8' }}>{c.participante?.correo}{c.participante?.whatsapp ? ` · ${c.participante.whatsapp}` : ''}</div>
                  </td>
                  <td style={{ padding: '8px 6px' }}>{c.item_nombre}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#8B1A1A' }}>{c.costo_tokens}</td>
                  <td style={{ padding: '8px 6px', color: '#64748b' }}>{new Date(c.created_at).toLocaleDateString('es-MX')}</td>
                  <td style={{ padding: '8px 6px' }}><span style={{ background: est.bg, color: est.color, padding: '2px 10px', borderRadius: 20, fontWeight: 700, fontSize: 10 }}>{est.label}</span></td>
                  <td style={{ padding: '8px 6px' }}>
                    <select value={c.estado} onChange={e => cambiarEstado(c, e.target.value)} style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      {Object.entries(ESTADOS_CANJE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
            {lista.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Sin canjes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Membresías ──────────────────────────────────────────
function TabMembresias({ onOtorgarTokens }) {
  const [membresias, setMembresias] = useState([])
  const [planesPorClave, setPlanesPorClave] = useState({})
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [modalActivar, setModalActivar] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data }, { data: pl }] = await Promise.all([
      supabase.from('membresias_alumno').select('*, participante:participantes(id, nombre, correo, whatsapp, codigo_referido, tokens_balance)').order('created_at', { ascending: false }),
      supabase.from('membresias_planes').select('clave, nombre, tokens_mensuales'),
    ])
    setMembresias(data || [])
    const mapa = {}
    ;(pl || []).forEach(p => { mapa[p.clave] = p })
    setPlanesPorClave(mapa)
    setLoading(false)
  }

  async function cambiarEstado(m, estado) {
    const { error } = await supabase.from('membresias_alumno').update({ estado }).eq('id', m.id)
    if (error) { alert('Error: ' + error.message); return }
    cargar()
  }

  const lista = filtro === 'todos' ? membresias : membresias.filter(m => m.estado === filtro)

  if (loading) return <div style={{ color: '#94a3b8', padding: 20 }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['todos', ...Object.keys(ESTADOS_MEMBRESIA)].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ background: filtro === f ? '#8B1A1A' : '#f1f5f9', color: filtro === f ? '#fff' : '#475569', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {f === 'todos' ? 'Todos' : ESTADOS_MEMBRESIA[f].label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map(m => {
          const est = ESTADOS_MEMBRESIA[m.estado] || ESTADOS_MEMBRESIA.pendiente_pago
          return (
            <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>{m.participante?.nombre || '—'} <span style={{ color: '#8B1A1A', fontWeight: 800 }}>· {m.plan_clave}</span></div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.participante?.correo} · Solicitado: {new Date(m.created_at).toLocaleDateString('es-MX')}</div>
                {m.comprobante_url && <a href={m.comprobante_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#1d4ed8' }}>Ver comprobante de pago →</a>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ background: est.bg, color: est.color, padding: '3px 12px', borderRadius: 20, fontWeight: 700, fontSize: 10 }}>{est.label}</span>
                {m.estado === 'pendiente_pago' && (
                  <button onClick={() => setModalActivar(m)} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Activar</button>
                )}
                {m.tokens_regalo_otorgados && (
                  <span style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>✓ tokens regalados</span>
                )}
                {m.participante && onOtorgarTokens && (
                  <button onClick={() => onOtorgarTokens(m.participante)} title="Otorgar o ajustar tokens manualmente a este participante"
                    style={{ background: '#fef2f2', color: '#8B1A1A', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    🎁 Otorgar tokens
                  </button>
                )}
                {m.estado === 'activa' && (
                  <button onClick={() => cambiarEstado(m, 'vencida')} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Marcar vencida</button>
                )}
                {m.estado !== 'cancelada' && (
                  <button onClick={() => cambiarEstado(m, 'cancelada')} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                )}
              </div>
            </div>
          )
        })}
        {lista.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Sin membresías.</div>}
      </div>

      {modalActivar && (
        <ModalActivarMembresia membresia={modalActivar} plan={planesPorClave[modalActivar.plan_clave]} onClose={() => setModalActivar(null)} onDone={() => { setModalActivar(null); cargar() }} />
      )}
    </div>
  )
}

function ModalActivarMembresia({ membresia, plan, onClose, onDone }) {
  const hoy = new Date()
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate())
  const [inicio, setInicio] = useState(hoy.toISOString().slice(0, 10))
  const [fin, setFin] = useState(finMes.toISOString().slice(0, 10))
  const [guardando, setGuardando] = useState(false)
  const tokensRegalo = plan?.tokens_mensuales || 0

  async function activar() {
    setGuardando(true)
    const { error } = await supabase.from('membresias_alumno').update({ estado: 'activa', periodo_inicio: inicio, periodo_fin: fin }).eq('id', membresia.id)
    if (error) { setGuardando(false); alert('Error: ' + error.message); return }

    if (tokensRegalo > 0) {
      try {
        await otorgarTokens(membresia.participante_id, tokensRegalo, `Regalo mensual por membresía ${plan?.nombre || membresia.plan_clave}`, null, 'admin')
        await supabase.from('membresias_alumno').update({ tokens_regalo_otorgados: true }).eq('id', membresia.id)
      } catch (e) {
        alert('La membresía se activó, pero no se pudieron otorgar los tokens de regalo automáticamente: ' + (e.message || ''))
      }
    }
    setGuardando(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>Activar membresía {plan?.nombre || membresia.plan_clave}</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Inicio del periodo</label>
        <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 10, marginTop: 4 }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Fin del periodo</label>
        <input type="date" value={fin} onChange={e => setFin(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 14, marginTop: 4 }} />
        {tokensRegalo > 0 && (
          <div style={{ background: '#fef2f2', color: '#8B1A1A', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            🎁 Al activar se otorgarán automáticamente {tokensRegalo} tokens de regalo de este mes.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancelar</button>
          <button onClick={activar} disabled={guardando} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {guardando ? 'Activando...' : 'Activar membresía'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Catálogo (canje + planes) ──────────────────────────────────────────
const ITEM_VACIO = { categoria: 'merchandising', nombre: '', descripcion: '', costo_tokens: '', costo_real_mxn: '' }

function TabCatalogo() {
  const [items, setItems] = useState([])
  const [planes, setPlanes] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nuevoItem, setNuevoItem] = useState(null)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: it }, { data: pl }, { data: cfg }] = await Promise.all([
      supabase.from('catalogo_canje').select('*').order('orden'),
      supabase.from('membresias_planes').select('*').order('orden'),
      supabase.from('membresias_config').select('*').eq('id', 1).maybeSingle(),
    ])
    setItems(it || [])
    setPlanes(pl || [])
    setConfig(cfg || { id: 1, notas_generales: '' })
    setLoading(false)
  }

  async function guardarNotasGenerales(valor) {
    const { error } = await supabase.from('membresias_config').upsert({ id: 1, notas_generales: valor })
    if (error) { alert('Error: ' + error.message); return }
    setConfig(prev => ({ ...(prev || { id: 1 }), notas_generales: valor }))
  }

  async function guardarItem(item, campo, valor) {
    const { error } = await supabase.from('catalogo_canje').update({ [campo]: valor }).eq('id', item.id)
    if (error) { alert('Error: ' + error.message); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, [campo]: valor } : i))
  }

  async function eliminarItem(item) {
    if (!confirm(`¿Eliminar "${item.nombre}" del catálogo de canje? Los canjes ya realizados con este ítem no se ven afectados.`)) return
    const { error } = await supabase.from('catalogo_canje').delete().eq('id', item.id)
    if (error) { alert('Error: ' + error.message); return }
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  async function crearItem() {
    if (!nuevoItem.nombre.trim()) { alert('Ponle un nombre al ítem.'); return }
    const costo = parseInt(nuevoItem.costo_tokens, 10)
    if (!costo || costo <= 0) { alert('El costo en tokens debe ser mayor a 0.'); return }
    setGuardandoNuevo(true)
    const { data, error } = await supabase.from('catalogo_canje').insert({
      categoria: nuevoItem.categoria,
      nombre: nuevoItem.nombre.trim(),
      descripcion: nuevoItem.descripcion.trim() || null,
      costo_tokens: costo,
      costo_real_mxn: nuevoItem.costo_real_mxn ? parseFloat(nuevoItem.costo_real_mxn) : null,
      orden: items.length + 1,
    }).select().single()
    setGuardandoNuevo(false)
    if (error) { alert('Error: ' + error.message); return }
    setItems(prev => [...prev, data])
    setNuevoItem(null)
  }

  async function guardarPlan(plan, campo, valor) {
    const { error } = await supabase.from('membresias_planes').update({ [campo]: valor }).eq('id', plan.id)
    if (error) { alert('Error: ' + error.message); return }
    setPlanes(prev => prev.map(p => p.id === plan.id ? { ...p, [campo]: valor } : p))
  }

  async function eliminarPlan(plan) {
    if (!confirm(`¿Eliminar el plan "${plan.nombre}"? Si ya tiene alumnos suscritos, en su lugar se recomienda solo desactivarlo (checkbox "Activo").`)) return
    const { error } = await supabase.from('membresias_planes').delete().eq('id', plan.id)
    if (error) {
      alert('No se pudo eliminar (probablemente porque ya hay alumnos suscritos a este plan). Desactívalo en su lugar con el checkbox "Activo".\n\nDetalle: ' + error.message)
      return
    }
    setPlanes(prev => prev.filter(p => p.id !== plan.id))
  }

  if (loading) return <div style={{ color: '#94a3b8', padding: 20 }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Catálogo de canje</div>
        {!nuevoItem && (
          <button onClick={() => setNuevoItem(ITEM_VACIO)} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            + Nuevo ítem
          </button>
        )}
      </div>

      {nuevoItem && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Categoría</label><br />
            <select value={nuevoItem.categoria} onChange={e => setNuevoItem({ ...nuevoItem, categoria: e.target.value })} style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
              {Object.entries(CATEGORIAS_CANJE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Nombre</label><br />
            <input value={nuevoItem.nombre} onChange={e => setNuevoItem({ ...nuevoItem, nombre: e.target.value })} style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Descripción (opcional)</label><br />
            <input value={nuevoItem.descripcion} onChange={e => setNuevoItem({ ...nuevoItem, descripcion: e.target.value })} style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Costo tokens</label><br />
            <input type="number" value={nuevoItem.costo_tokens} onChange={e => setNuevoItem({ ...nuevoItem, costo_tokens: e.target.value })} style={{ width: 80, padding: '7px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Costo real MXN</label><br />
            <input type="number" value={nuevoItem.costo_real_mxn} onChange={e => setNuevoItem({ ...nuevoItem, costo_real_mxn: e.target.value })} style={{ width: 90, padding: '7px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }} />
          </div>
          <button onClick={crearItem} disabled={guardandoNuevo} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {guardandoNuevo ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={() => setNuevoItem(null)} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px 6px' }}>Categoría</th>
              <th style={{ padding: '8px 6px' }}>Ítem</th>
              <th style={{ padding: '8px 6px' }}>Descripción</th>
              <th style={{ padding: '8px 6px' }}>Costo tokens</th>
              <th style={{ padding: '8px 6px' }}>Costo real MXN</th>
              <th style={{ padding: '8px 6px' }}>Activo</th>
              <th style={{ padding: '8px 6px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 6px' }}>
                  <select defaultValue={i.categoria} onChange={e => guardarItem(i, 'categoria', e.target.value)} style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                    {Object.entries(CATEGORIAS_CANJE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <input type="text" defaultValue={i.nombre} onBlur={e => { const v = e.target.value.trim(); if (v && v !== i.nombre) guardarItem(i, 'nombre', v) }} style={{ width: 140, padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0', fontWeight: 700, color: '#1e293b' }} />
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <input type="text" defaultValue={i.descripcion || ''} onBlur={e => { const v = e.target.value.trim(); if (v !== (i.descripcion || '')) guardarItem(i, 'descripcion', v || null) }} style={{ width: 180, padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <input type="number" defaultValue={i.costo_tokens} onBlur={e => { const v = parseInt(e.target.value, 10); if (v !== i.costo_tokens && v > 0) guardarItem(i, 'costo_tokens', v) }} style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <input type="number" defaultValue={i.costo_real_mxn} onBlur={e => { const v = parseFloat(e.target.value); if (v !== i.costo_real_mxn) guardarItem(i, 'costo_real_mxn', v) }} style={{ width: 80, padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <input type="checkbox" checked={i.activo} onChange={e => guardarItem(i, 'activo', e.target.checked)} />
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <button onClick={() => eliminarItem(i)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑 Eliminar</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Sin ítems todavía. Corre el SQL de recompensas o agrega uno con "+ Nuevo ítem".</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Planes de membresía</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {planes.map(p => (
          <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 800, color: '#8B1A1A', fontSize: 14 }}>{p.nombre} <code style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>({p.clave})</code></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={p.activo} onChange={e => guardarPlan(p, 'activo', e.target.checked)} /> Activo
                </label>
                <button onClick={() => eliminarPlan(p)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑 Eliminar</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Precio MXN/mes</label>
                <input type="number" defaultValue={p.precio_mxn} onBlur={e => { const v = parseFloat(e.target.value); if (v !== p.precio_mxn) guardarPlan(p, 'precio_mxn', v) }} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Cursos Tipo A/mes</label>
                <input type="number" defaultValue={p.cursos_tipo_a} onBlur={e => { const v = parseInt(e.target.value, 10); if (v !== p.cursos_tipo_a) guardarPlan(p, 'cursos_tipo_a', v) }} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Cursos Tipo B/mes</label>
                <input type="number" defaultValue={p.cursos_tipo_b} onBlur={e => { const v = parseInt(e.target.value, 10); if (v !== p.cursos_tipo_b) guardarPlan(p, 'cursos_tipo_b', v) }} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Cursos Tipo C/mes</label>
                <input type="number" defaultValue={p.cursos_tipo_c} onBlur={e => { const v = parseInt(e.target.value, 10); if (v !== p.cursos_tipo_c) guardarPlan(p, 'cursos_tipo_c', v) }} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>🎁 Tokens de regalo/mes</label>
                <input type="number" defaultValue={p.tokens_mensuales} onBlur={e => { const v = parseInt(e.target.value, 10); if (v !== p.tokens_mensuales && v >= 0) guardarPlan(p, 'tokens_mensuales', v) }} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 3 }} />
              </div>
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Descripción (cursos incluidos)</label>
            <textarea defaultValue={p.descripcion || ''} onBlur={e => { if (e.target.value !== p.descripcion) guardarPlan(p, 'descripcion', e.target.value) }} rows={2} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, marginTop: 3, marginBottom: 10, fontFamily: 'inherit', resize: 'vertical' }} />
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Beneficios extra (uno por línea, ej. "• Acceso a bolsa de trabajo prioritaria.")</label>
            <textarea defaultValue={p.beneficios_extra || ''} onBlur={e => { if (e.target.value !== p.beneficios_extra) guardarPlan(p, 'beneficios_extra', e.target.value) }} rows={3} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, marginTop: 3, fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
        ))}
        {planes.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Sin planes todavía. Corre el SQL de recompensas para sembrar Lite/Pro/Master.</div>}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Notas generales de membresías</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Este texto se muestra a todos los alumnos arriba de las membresías en su portal.</div>
        <textarea
          defaultValue={config?.notas_generales || ''}
          onBlur={e => { if (e.target.value !== config?.notas_generales) guardarNotasGenerales(e.target.value) }}
          rows={4}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </div>
    </div>
  )
}
