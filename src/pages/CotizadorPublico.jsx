import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const WA_NUMBER = '522223549353'
const IVA = 0.16

const FAMILIAS_COLOR = {
  'Sistemas de Gestión': '#1d4ed8',
  'Herramientas Automotrices': '#8B1A1A',
  'Lean Six Sigma': '#059669',
  'Estadística y Software': '#7c3aed',
}

export default function CotizadorPublico() {
  const [familias, setFamilias] = useState([])
  const [cursos, setCursos] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState(null)
  const [paso, setPaso] = useState(1) // 1=seleccionar curso, 2=configurar, 3=datos, 4=resumen
  const [cursoSel, setCursoSel] = useState(null)
  const [config, setConfig] = useState({
    tipo: 'persona', num_personas: 1, dias: 1,
    descuento_tipo: '', descuento_valor: 0,
    requiere_viaticos: false, zona_viaticos: 'zona1', monto_viaticos: 0,
    aplica_iva: true, es_cliente_nuevo: true,
    incluye_consultoria: false, descripcion_consultoria: '', precio_consultoria: 0,
    notas: ''
  })
  const [contacto, setContacto] = useState({
    empresa_nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: ''
  })
  const [saving, setSaving] = useState(false)
  const [folioCot, setFolioCot] = useState(null)
  const [cotGuardada, setCotGuardada] = useState(null)

  useEffect(() => {
    supabase.from('familias').select('*').order('orden').then(({ data }) => setFamilias(data || []))
    supabase.from('cursos').select('*, familia:familias(nombre,color,icono)').eq('activo', true).eq('es_publico', true).order('orden').then(({ data }) => setCursos(data || []))
  }, [])

  const c = k => v => setConfig(p => ({ ...p, [k]: v }))
  const ct = k => v => setContacto(p => ({ ...p, [k]: v }))

  // ── CÁLCULOS ──────────────────────────────────────────────────
  function calcular() {
    if (!cursoSel) return { subtotal: 0, iva: 0, total: 0, comision: 0, precio_base: 0 }
    let precio_base = 0
    if (config.tipo === 'persona') {
      const p = config.dias === 1 ? (cursoSel.precio_persona_1dia || 2830)
        : config.dias === 2 ? (cursoSel.precio_persona_2dias || 5660)
        : (cursoSel.precio_persona_3dias || 8090)
      precio_base = p * config.num_personas
    } else {
      precio_base = cursoSel.precio_grupo || 0
    }

    // Descuento
    let desc = 0
    if (config.descuento_tipo === 'porcentaje') {
      desc = precio_base * (config.descuento_valor / 100)
    } else if (config.descuento_tipo === '2x1') {
      desc = precio_base * 0.5
    }
    const precio_con_desc = precio_base - desc

    // Consultoría
    const cons = config.incluye_consultoria ? Number(config.precio_consultoria) : 0

    // Viáticos
    const viat = config.requiere_viaticos ? Number(config.monto_viaticos) : 0

    const subtotal = precio_con_desc + cons + viat
    const iva_monto = config.aplica_iva ? subtotal * IVA : 0
    const total = subtotal + iva_monto
    const comision = total * (config.es_cliente_nuevo ? 0.15 : 0.10)

    return { precio_base, desc, precio_con_desc, cons, viat, subtotal, iva_monto, total, comision }
  }

  const nums = calcular()

  async function guardarCotizacion() {
    setSaving(true)
    try {
      const { data: seq } = await supabase.rpc('nextval', { seq_name: 'cotizacion_folio_seq' }).single()
      const folio = `HCD-COT-${new Date().getFullYear()}-${String(seq?.nextval || Date.now()).slice(-4).padStart(4, '0')}`
      const payload = {
        folio,
        empresa_nombre: contacto.empresa_nombre,
        contacto_nombre: contacto.contacto_nombre,
        contacto_email: contacto.contacto_email,
        contacto_whatsapp: contacto.contacto_whatsapp,
        curso_id: cursoSel.id,
        curso_nombre: cursoSel.nombre,
        tipo_precio: config.tipo,
        num_personas: config.num_personas,
        dias: config.dias,
        precio_base: nums.precio_base,
        descuento_tipo: config.descuento_tipo || null,
        descuento_valor: config.descuento_valor,
        requiere_viaticos: config.requiere_viaticos,
        zona_viaticos: config.requiere_viaticos ? config.zona_viaticos : null,
        monto_viaticos: nums.viat,
        aplica_iva: config.aplica_iva,
        subtotal: nums.subtotal,
        iva: nums.iva_monto,
        total: nums.total,
        es_cliente_nuevo: config.es_cliente_nuevo,
        comision_porcentaje: config.es_cliente_nuevo ? 15 : 10,
        comision_monto: nums.comision,
        incluye_consultoria: config.incluye_consultoria,
        descripcion_consultoria: config.descripcion_consultoria || null,
        precio_consultoria: nums.cons,
        notas: config.notas || null,
        estado: 'enviada'
      }
      const { data } = await supabase.from('cotizaciones').insert(payload).select().single()
      setFolioCot(folio)
      setCotGuardada(data)
      setPaso(5)
    } catch (e) {
      console.error(e)
      // Fallback folio local
      const folio = `HCD-COT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
      setFolioCot(folio)
      setPaso(5)
    } finally { setSaving(false) }
  }

  function imprimirCotizacion() {
    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const ventana = window.open('', '_blank', 'width=900,height=700')
    ventana.document.write(htmlCotizacion({ contacto, cursoSel, config, nums, folio: folioCot, fecha }))
    ventana.document.close()
  }

  function enviarWhatsApp() {
    const msg = `Hola, soy ${contacto.contacto_nombre} de ${contacto.empresa_nombre}. Acabo de generar una cotización en la plataforma HCD con folio *${folioCot}* por un total de *$${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}*. ¿Podemos continuar con el proceso?`
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const cursosFamilia = familiaActiva ? cursos.filter(c => c.familia_id === familiaActiva) : cursos

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      {/* Header */}
      <div style={{ background: '#8B1A1A', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} />
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Hablando con Datos</span>
        <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 13 }}>— Cotizador en línea</span>
      </div>

      {/* Pasos */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {[
            [1, 'Seleccionar curso'],
            [2, 'Configurar'],
            [3, 'Tus datos'],
            [4, 'Resumen'],
          ].map(([n, label], i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: paso >= n ? '#8B1A1A' : '#e2e8f0', color: paso >= n ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{n}</div>
              <span style={{ fontSize: 12, color: paso >= n ? '#8B1A1A' : '#94a3b8', fontWeight: paso === n ? 700 : 400 }}>{label}</span>
              {i < 3 && <div style={{ width: 24, height: 1, background: '#e2e8f0', margin: '0 4px' }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* PASO 1: SELECCIONAR CURSO */}
        {paso === 1 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>¿Qué curso te interesa?</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Selecciona una familia para filtrar o navega por todos los cursos disponibles</p>

            {/* Filtro familias */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              <button onClick={() => setFamiliaActiva(null)}
                style={{ padding: '7px 16px', borderRadius: 20, border: `2px solid ${!familiaActiva ? '#8B1A1A' : '#e2e8f0'}`, background: !familiaActiva ? '#f9f0f0' : '#fff', color: !familiaActiva ? '#8B1A1A' : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Todos
              </button>
              {familias.map(f => (
                <button key={f.id} onClick={() => setFamiliaActiva(f.id)}
                  style={{ padding: '7px 16px', borderRadius: 20, border: `2px solid ${familiaActiva === f.id ? f.color : '#e2e8f0'}`, background: familiaActiva === f.id ? `${f.color}15` : '#fff', color: familiaActiva === f.id ? f.color : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {f.icono} {f.nombre}
                </button>
              ))}
            </div>

            {/* Lista cursos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {cursosFamilia.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  No hay cursos disponibles en esta categoría por el momento
                </div>
              )}
              {cursosFamilia.map(c => (
                <div key={c.id} onClick={() => { setCursoSel(c); setConfig(p => ({ ...p, dias: c.dias || 1 })); setPaso(2) }}
                  style={{ background: '#fff', border: `2px solid ${cursoSel?.id === c.id ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'border-color .15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ background: `${c.familia?.color || '#8B1A1A'}15`, color: c.familia?.color || '#8B1A1A', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                      {c.familia?.icono} {c.familia?.nombre}
                    </span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>{c.duracion} hrs</span>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{c.nombre}</h3>
                  {c.descripcion && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{c.descripcion}</p>}
                  <div style={{ color: '#8B1A1A', fontWeight: 700, fontSize: 13 }}>
                    Desde ${(c.precio_persona_1dia || 2830).toLocaleString('es-MX')} p/persona
                  </div>
                </div>
              ))}
            </div>

            {/* También consultoría */}
            <div style={{ background: '#f9f0f0', border: '1px solid #fecaca', borderRadius: 14, padding: '20px 24px', marginTop: 24 }}>
              <h3 style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 15, marginBottom: 6 }}>¿Necesitas consultoría?</h3>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>Implementación de Sistemas de Gestión, Solución de Problemas, Auditorías Internas</p>
              <button onClick={() => { setCursoSel({ id: null, nombre: 'Consultoría', precio_persona_1dia: 0 }); setConfig(p => ({ ...p, incluye_consultoria: true, tipo: 'grupo' })); setPaso(2) }}
                style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cotizar consultoría →
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: CONFIGURAR */}
        {paso === 2 && cursoSel && (
          <div>
            <button onClick={() => setPaso(1)} style={btnBack}>← Cambiar curso</button>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Configura tu cotización</h2>
            <p style={{ color: '#8B1A1A', fontWeight: 600, marginBottom: 24 }}>{cursoSel.nombre}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={card}>
                <h3 style={cardTitle}>Tipo de cotización</h3>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {[['persona', 'Por persona'], ['grupo', 'Grupo cerrado']].map(([v, l]) => (
                    <button key={v} onClick={() => c('tipo')(v)}
                      style={{ flex: 1, padding: '10px', border: `2px solid ${config.tipo === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 8, background: config.tipo === v ? '#f9f0f0' : '#fff', color: config.tipo === v ? '#8B1A1A' : '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                      {l}
                    </button>
                  ))}
                </div>

                {config.tipo === 'persona' && (
                  <>
                    <label style={lbl}>Número de personas</label>
                    <input type="number" min={1} max={cursoSel.personas_max || 15} value={config.num_personas}
                      onChange={e => c('num_personas')(Number(e.target.value))} style={inp} />
                    <label style={lbl}>Duración del curso</label>
                    <select value={config.dias} onChange={e => c('dias')(Number(e.target.value))} style={inp}>
                      <option value={1}>1 día — ${(cursoSel.precio_persona_1dia || 2830).toLocaleString('es-MX')} p/persona</option>
                      <option value={2}>2 días — ${(cursoSel.precio_persona_2dias || 5660).toLocaleString('es-MX')} p/persona</option>
                      <option value={3}>3 días — ${(cursoSel.precio_persona_3dias || 8090).toLocaleString('es-MX')} p/persona</option>
                    </select>
                  </>
                )}

                {config.tipo === 'grupo' && cursoSel.precio_grupo && (
                  <div style={{ background: '#f9f0f0', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ color: '#8B1A1A', fontWeight: 700 }}>Precio grupo cerrado</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#8B1A1A' }}>${cursoSel.precio_grupo?.toLocaleString('es-MX')}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>Hasta {cursoSel.personas_max || 15} personas</div>
                  </div>
                )}
              </div>

              <div style={card}>
                <h3 style={cardTitle}>Descuentos</h3>
                <label style={lbl}>Tipo de descuento</label>
                <select value={config.descuento_tipo} onChange={e => c('descuento_tipo')(e.target.value)} style={inp}>
                  <option value="">Sin descuento</option>
                  <option value="porcentaje">Porcentaje</option>
                  <option value="2x1">Cupón 2x1 (50%)</option>
                </select>
                {config.descuento_tipo === 'porcentaje' && (
                  <>
                    <label style={lbl}>Porcentaje de descuento</label>
                    <input type="number" min={0} max={25} value={config.descuento_valor}
                      onChange={e => c('descuento_valor')(Number(e.target.value))} style={inp} placeholder="ej. 20" />
                  </>
                )}

                <div style={{ marginTop: 16 }}>
                  <h3 style={cardTitle}>IVA y facturación</h3>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                    <input type="checkbox" checked={config.aplica_iva} onChange={e => c('aplica_iva')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>Precio con IVA (16%)</span>
                  </label>
                  {!config.aplica_iva && (
                    <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#713f12' }}>
                      Sin IVA — aplica descuento hasta 20-25% adicional
                    </div>
                  )}
                </div>
              </div>

              <div style={card}>
                <h3 style={cardTitle}>Viáticos y traslado</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                  <input type="checkbox" checked={config.requiere_viaticos} onChange={e => c('requiere_viaticos')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>¿Requiere traslado del instructor?</span>
                </label>
                {config.requiere_viaticos && (
                  <>
                    <label style={lbl}>Zona de traslado</label>
                    <select value={config.zona_viaticos} onChange={e => c('zona_viaticos')(e.target.value)} style={inp}>
                      <option value="zona1">Zona 1 — Puebla ciudad, Tlaxcala, Huejotzingo, Atlixco (incluido)</option>
                      <option value="otra">Otra ciudad / estado (especificar monto)</option>
                    </select>
                    {config.zona_viaticos === 'otra' && (
                      <>
                        <label style={lbl}>Monto de viáticos estimado ($)</label>
                        <input type="number" min={0} value={config.monto_viaticos}
                          onChange={e => c('monto_viaticos')(Number(e.target.value))} style={inp}
                          placeholder="ej. 3500 para San Luis Potosí (gasolina+hospedaje)" />
                        <p style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>Incluye: gasolina, hospedaje, avión según destino. HCD confirma el monto final.</p>
                      </>
                    )}
                  </>
                )}
              </div>

              <div style={card}>
                <h3 style={cardTitle}>Consultoría adicional</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                  <input type="checkbox" checked={config.incluye_consultoria} onChange={e => c('incluye_consultoria')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>¿Incluir servicio de consultoría?</span>
                </label>
                {config.incluye_consultoria && (
                  <>
                    <label style={lbl}>Descripción del servicio</label>
                    <textarea value={config.descripcion_consultoria} onChange={e => c('descripcion_consultoria')(e.target.value)}
                      placeholder="ej. Implementación ISO 9001, acompañamiento 3 meses" rows={2}
                      style={{ ...inp, resize: 'none' }} />
                    <label style={lbl}>Precio de consultoría ($)</label>
                    <input type="number" min={0} value={config.precio_consultoria}
                      onChange={e => c('precio_consultoria')(Number(e.target.value))} style={inp} />
                  </>
                )}
                <div style={{ marginTop: 12 }}>
                  <label style={lbl}>Notas adicionales</label>
                  <textarea value={config.notas} onChange={e => c('notas')(e.target.value)}
                    placeholder="Requerimientos especiales, fechas tentativas, etc." rows={2}
                    style={{ ...inp, resize: 'none' }} />
                </div>
              </div>
            </div>

            {/* Preview precio */}
            <div style={{ background: '#1e293b', borderRadius: 14, padding: '20px 28px', marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>TOTAL ESTIMADO</div>
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>
                  ${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  <span style={{ color: '#64748b', fontSize: 13, fontWeight: 400 }}> {config.aplica_iva ? '(IVA incluido)' : '(sin IVA)'}</span>
                </div>
                {nums.desc > 0 && <div style={{ color: '#4de8a0', fontSize: 13 }}>Ahorro: ${nums.desc.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>}
              </div>
              <button onClick={() => setPaso(3)} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: DATOS DE CONTACTO */}
        {paso === 3 && (
          <div>
            <button onClick={() => setPaso(2)} style={btnBack}>← Volver</button>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Tus datos de contacto</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Para enviarte la cotización formal y dar seguimiento</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Empresa *</label>
                <input value={contacto.empresa_nombre} onChange={e => ct('empresa_nombre')(e.target.value)} placeholder="Nombre de tu empresa" style={inp} />
              </div>
              <div>
                <label style={lbl}>Nombre de contacto *</label>
                <input value={contacto.contacto_nombre} onChange={e => ct('contacto_nombre')(e.target.value)} placeholder="Tu nombre" style={inp} />
              </div>
              <div>
                <label style={lbl}>Correo electrónico *</label>
                <input type="email" value={contacto.contacto_email} onChange={e => ct('contacto_email')(e.target.value)} placeholder="correo@empresa.com" style={inp} />
              </div>
              <div>
                <label style={lbl}>WhatsApp</label>
                <input value={contacto.contacto_whatsapp} onChange={e => ct('contacto_whatsapp')(e.target.value)} placeholder="222 123 4567" style={inp} />
              </div>
              <div>
                <label style={lbl}>¿Eres cliente de HCD?</label>
                <select value={config.es_cliente_nuevo ? 'nuevo' : 'existente'} onChange={e => c('es_cliente_nuevo')(e.target.value === 'nuevo')} style={inp}>
                  <option value="nuevo">No, es primera vez</option>
                  <option value="existente">Sí, ya hemos trabajado juntos</option>
                </select>
              </div>
            </div>
            <button onClick={() => setPaso(4)}
              disabled={!contacto.empresa_nombre || !contacto.contacto_nombre || !contacto.contacto_email}
              style={{ ...btnPrimary, marginTop: 24 }}>
              Ver resumen →
            </button>
          </div>
        )}

        {/* PASO 4: RESUMEN */}
        {paso === 4 && (
          <div>
            <button onClick={() => setPaso(3)} style={btnBack}>← Volver</button>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 24 }}>Resumen de tu cotización</h2>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '28px 32px', maxWidth: 600 }}>
              <Row label="Empresa" value={contacto.empresa_nombre} />
              <Row label="Contacto" value={contacto.contacto_nombre} />
              <Row label="Curso" value={cursoSel?.nombre} bold />
              <Row label="Tipo" value={config.tipo === 'persona' ? `Por persona (${config.num_personas} personas, ${config.dias} día${config.dias > 1 ? 's' : ''})` : 'Grupo cerrado'} />
              {config.requiere_viaticos && <Row label="Viáticos" value={config.zona_viaticos === 'zona1' ? 'Zona 1 (incluido)' : `$${Number(config.monto_viaticos).toLocaleString('es-MX')}`} />}
              {config.incluye_consultoria && <Row label="Consultoría" value={config.descripcion_consultoria} />}
              <div style={{ borderTop: '2px solid #e2e8f0', marginTop: 16, paddingTop: 16 }}>
                <Row label="Subtotal" value={`$${nums.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />
                {nums.desc > 0 && <Row label="Descuento" value={`-$${nums.desc.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} color="#059669" />}
                {config.aplica_iva && <Row label="IVA (16%)" value={`$${nums.iva_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />}
                <Row label="TOTAL" value={`$${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} bold big />
              </div>
            </div>
            <button onClick={guardarCotizacion} disabled={saving} style={{ ...btnPrimary, marginTop: 20 }}>
              {saving ? 'Generando cotización...' : '✅ Generar cotización oficial'}
            </button>
          </div>
        )}

        {/* PASO 5: ÉXITO */}
        {paso === 5 && (
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>¡Cotización generada!</h2>
            <div style={{ background: '#f9f0f0', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 24px', marginBottom: 24 }}>
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Folio de cotización</div>
              <div style={{ color: '#8B1A1A', fontSize: 22, fontWeight: 800 }}>{folioCot}</div>
              <div style={{ color: '#1e293b', fontSize: 18, fontWeight: 700, marginTop: 8 }}>
                Total: ${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={imprimirCotizacion} style={btnPrimary}>📄 Descargar cotización PDF</button>
              <button onClick={enviarWhatsApp} style={{ ...btnPrimary, background: '#25d366' }}>💬 Enviar por WhatsApp</button>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 20 }}>
              Un ejecutivo de Hablando con Datos te contactará a la brevedad para confirmar disponibilidad y fechas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, bold, big, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
      <span style={{ color: color || '#1e293b', fontSize: big ? 16 : 14, fontWeight: bold ? 800 : 400 }}>{value}</span>
    </div>
  )
}

function htmlCotizacion({ contacto, cursoSel, config, nums, folio, fecha }) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Cotización ${folio}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',sans-serif;color:#1e293b;background:#fff;}
.page{max-width:800px;margin:0 auto;padding:40px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #8B1A1A;}
.logo-area .company{font-size:22px;font-weight:800;color:#8B1A1A;}
.logo-area .sub{font-size:11px;color:#64748b;margin-top:2px;}
.folio-area{text-align:right;}
.folio-label{font-size:11px;color:#64748b;letter-spacing:1px;text-transform:uppercase;}
.folio-val{font-size:18px;font-weight:800;color:#8B1A1A;}
.fecha{color:#64748b;font-size:12px;margin-top:4px;}
.seccion{margin-bottom:24px;}
.seccion h3{font-size:13px;font-weight:700;color:#8B1A1A;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.dato label{font-size:11px;color:#64748b;display:block;margin-bottom:2px;}
.dato span{font-size:14px;color:#1e293b;font-weight:500;}
table{width:100%;border-collapse:collapse;margin-top:8px;}
th{background:#f8f9fb;padding:10px 14px;text-align:left;font-size:11px;color:#64748b;letter-spacing:.5px;text-transform:uppercase;}
td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}
.total-row td{font-weight:800;font-size:15px;color:#8B1A1A;border-top:2px solid #8B1A1A;border-bottom:none;}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:11px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body><div class="page">
<div class="header">
  <div class="logo-area">
    <div class="company">● Hablando con Datos</div>
    <div class="sub">Consultoría y Capacitación en Sistemas de Gestión</div>
    <div class="sub" style="margin-top:4px">www.hablandocondatos.com.mx · ness@hablandocondatos.com.mx</div>
    <div class="sub">Tel: 222 354 9353</div>
  </div>
  <div class="folio-area">
    <div class="folio-label">Cotización</div>
    <div class="folio-val">${folio}</div>
    <div class="fecha">Fecha: ${fecha}</div>
    <div class="fecha">Vigencia: 30 días naturales</div>
  </div>
</div>
<div class="seccion">
  <h3>Datos del cliente</h3>
  <div class="grid2">
    <div class="dato"><label>Empresa</label><span>${contacto.empresa_nombre}</span></div>
    <div class="dato"><label>Contacto</label><span>${contacto.contacto_nombre}</span></div>
    <div class="dato"><label>Correo</label><span>${contacto.contacto_email}</span></div>
    <div class="dato"><label>WhatsApp</label><span>${contacto.contacto_whatsapp || '—'}</span></div>
  </div>
</div>
<div class="seccion">
  <h3>Detalle de la cotización</h3>
  <table>
    <thead><tr><th>Concepto</th><th>Detalle</th><th style="text-align:right">Importe</th></tr></thead>
    <tbody>
      <tr><td><strong>${cursoSel?.nombre}</strong></td><td>${config.tipo === 'persona' ? `${config.num_personas} persona(s) · ${config.dias} día(s)` : 'Grupo cerrado'}</td><td style="text-align:right">$${nums.precio_base.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
      ${nums.desc > 0 ? `<tr><td>Descuento ${config.descuento_tipo === '2x1' ? '2x1' : config.descuento_valor + '%'}</td><td></td><td style="text-align:right;color:#059669">-$${nums.desc.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${config.incluye_consultoria && nums.cons > 0 ? `<tr><td>Consultoría</td><td>${config.descripcion_consultoria}</td><td style="text-align:right">$${nums.cons.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${config.requiere_viaticos && nums.viat > 0 ? `<tr><td>Viáticos / Traslado</td><td>${config.zona_viaticos === 'zona1' ? 'Zona 1' : 'Foráneo'}</td><td style="text-align:right">$${nums.viat.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      <tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">Subtotal</td><td style="text-align:right">$${nums.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
      ${config.aplica_iva ? `<tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">IVA (16%)</td><td style="text-align:right">$${nums.iva_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      <tr class="total-row"><td colspan="2" style="text-align:right">TOTAL</td><td style="text-align:right">$${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${config.aplica_iva ? 'MXN (IVA incluido)' : 'MXN (sin IVA)'}</td></tr>
    </tbody>
  </table>
</div>
${config.notas ? `<div class="seccion"><h3>Notas</h3><p style="font-size:13px;color:#475569">${config.notas}</p></div>` : ''}
<div class="seccion" style="background:#f8f9fb;border-radius:8px;padding:16px;">
  <h3 style="margin-bottom:8px">Condiciones</h3>
  <p style="font-size:12px;color:#475569;line-height:1.8">
    • Cotización válida por 30 días naturales a partir de la fecha de emisión.<br/>
    • Precios en pesos mexicanos (MXN). ${config.aplica_iva ? 'IVA del 16% incluido.' : 'Precio sin IVA.'}<br/>
    • La capacitación se confirma contra anticipo del 50% del total.<br/>
    • Incluye: material didáctico, constancias/certificados con folio único verificable.<br/>
    ${config.requiere_viaticos && config.zona_viaticos === 'otra' ? '• Los viáticos indicados son estimados y quedan sujetos a confirmación por HCD.<br/>' : ''}
    • Para más información: ness@hablandocondatos.com.mx · 222 354 9353
  </p>
</div>
<div class="footer">
  <p>Hablando con Datos — Consultoría y Capacitación en Sistemas de Gestión · Puebla, México · @Hablandocondatos</p>
  <p style="margin-top:4px">Folio: ${folio}</p>
</div>
</div><script>window.onload=()=>{window.print();}</script></body></html>`
}

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px' }
const cardTitle = { fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14, letterSpacing: .3 }
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 10 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const btnBack = { background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }
