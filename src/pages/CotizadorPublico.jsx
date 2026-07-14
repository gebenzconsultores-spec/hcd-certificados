import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const WA_NUMBER = '522223549353'
const EMAIL_CONTACTO = 'luisgomez@hablandocondatos.com.mx'
const IVA = 0.16
const MIN_GRUPO = 10
const DESC_GRUPO = 0.20

// Días equivalentes según duración del curso:
// 8h = 1 día, 16h = 2 días, más de 16h = 3 días
function diasPorHoras(horas) {
  const h = Number(horas) || 8
  if (h <= 8) return 1
  if (h <= 16) return 2
  return 3
}

// Días del curso: usa el campo guardado; si no existe, lo calcula por horas
function diasDelCurso(curso) {
  if (curso && curso.dias) return curso.dias
  return diasPorHoras(curso?.duracion)
}

// Precio por persona según los días equivalentes del curso
function precioPorDias(curso, dias) {
  if (dias === 1) return curso.precio_persona_1dia || 2830
  if (dias === 2) return curso.precio_persona_2dias || 5660
  return curso.precio_persona_3dias || 8090
}

// Bloque de participantes (nuevo modelo de precios por categoría × bloque)
function bloqueDePersonas(n) {
  const num = Number(n) || 0
  if (num <= 4) return '1-4'
  if (num <= 10) return '5-10'
  if (num <= 15) return '11-15'
  return 'especial' // 16 o más → cotización especial
}

export default function CotizadorPublico() {
  const [familias, setFamilias] = useState([])
  const [cursos, setCursos] = useState([])
  const [matriz, setMatriz] = useState([])
  const [servicios, setServicios] = useState([])
  const [viaticosZonas, setViaticosZonas] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState(null)
  const [paso, setPaso] = useState(1)
  const [cursoSel, setCursoSel] = useState(null)
  const [config, setConfig] = useState({
    tipo: 'persona', num_personas: 1, dias: 1,
    cupon_codigo: '', cupon_validado: null, cupon_error: '',
    requiere_viaticos: false, zona_viaticos_id: '', monto_viaticos: 0,
    aplica_iva: true, es_cliente_nuevo: true,
    incluye_consultoria: false, servicio_id: '', horas_consultoria: 1, precio_consultoria: 0, descripcion_consultoria: '',
    fecha_deseada: '', notas: ''
  })
  const [contacto, setContacto] = useState({ empresa_nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '' })
  const [saving, setSaving] = useState(false)
  const [folioCot, setFolioCot] = useState(null)
  const [cotizacionId, setCotizacionId] = useState(null)
  const [ocSubida, setOcSubida] = useState(null)
  const [subiendoOC, setSubiendoOC] = useState(false)
  const [empresaPortal, setEmpresaPortal] = useState(null)

  useEffect(() => {
    supabase.from('familias').select('*').order('orden').then(({ data }) => setFamilias(data || []))
    supabase.from('servicios').select('*').eq('activo', true).order('orden').then(({ data }) => setServicios(data || []))
    supabase.from('viaticos_zonas').select('*').eq('activo', true).order('monto').then(({ data }) => setViaticosZonas(data || []))
    supabase.from('precios_categoria').select('*').then(({ data }) => setMatriz(data || []))

    const params = new URLSearchParams(window.location.search)
    const cursoId = params.get('curso')
    const empresaId = params.get('empresa')

    // Cargar cursos y, si viene ?curso=ID, preseleccionarlo
    supabase.from('cursos').select('*, familia:familias(nombre,color,icono,clave)').eq('activo', true).eq('es_publico', true).then(({ data }) => {
      setCursos(data || [])
      if (cursoId && data) {
        const curso = data.find(co => co.id === cursoId)
        if (curso) { setCursoSel(curso); setPaso(2) }
      }
    })

    // Cargar datos de la empresa: primero por URL (funciona entre pestañas), luego sessionStorage
    async function cargarEmpresa() {
      let emp = null
      if (empresaId) {
        const { data } = await supabase.from('empresas').select('*').eq('id', empresaId).maybeSingle()
        emp = data
      }
      if (!emp) {
        const empData = sessionStorage.getItem('empresa_portal')
        if (empData) { try { emp = JSON.parse(empData) } catch (_) {} }
      }
      if (emp) {
        setEmpresaPortal(emp)
        setContacto({
          empresa_nombre: emp.nombre || '',
          contacto_nombre: emp.contacto_nombre || '',
          contacto_email: emp.contacto_email || '',
          contacto_whatsapp: emp.contacto_whatsapp || ''
        })
        setConfig(p => ({ ...p, es_cliente_nuevo: emp.tipo_acceso !== 'cliente' }))
      }
    }
    cargarEmpresa()
  }, [])

  const c = k => v => setConfig(p => ({ ...p, [k]: v }))
  const ct = k => v => setContacto(p => ({ ...p, [k]: v }))

  // ── VALIDAR CUPÓN contra BD ──
  async function validarCupon() {
    if (!config.cupon_codigo) return
    setConfig(p => ({ ...p, cupon_error: '', cupon_validado: null }))
    try {
      const { data: cup } = await supabase.from('cupones').select('*')
        .eq('codigo', config.cupon_codigo.toUpperCase().trim())
        .eq('activo', true).single()
      if (!cup) throw new Error('no existe')
      // Verificar vigencia
      if (cup.vigencia_hasta && new Date(cup.vigencia_hasta) < new Date()) throw new Error('vencido')
      // Verificar usos
      if (cup.usos_maximos > 0 && cup.usos_actuales >= cup.usos_maximos) throw new Error('agotado')
      setConfig(p => ({ ...p, cupon_validado: cup, cupon_error: '' }))
    } catch (e) {
      const msg = e.message === 'vencido' ? 'Este cupón ya venció' : e.message === 'agotado' ? 'Este cupón ya alcanzó su límite de usos' : 'Cupón no válido'
      setConfig(p => ({ ...p, cupon_validado: null, cupon_error: msg }))
    }
  }

  // Precio por hora de la matriz (categoría del curso × bloque de participantes)
  function precioHora(categoria, bloque) {
    const r = matriz.find(x => x.categoria === (categoria || 'B') && x.bloque === bloque)
    return r ? Number(r.precio_hora) || 0 : 0
  }

  // ── CÁLCULOS ──
  function calcular() {
    if (!cursoSel) return { subtotal: 0, iva_monto: 0, total: 0, comision: 0, precio_base: 0, desc: 0, dias_curso: 1 }

    // Días automáticos según las horas del curso (Opción B)
    const dias_curso = cursoSel.id ? diasDelCurso(cursoSel) : 1
    let precio_base = 0
    let desc_grupo = 0

    // NUEVO MODELO: precio por hora (categoría del curso × bloque de participantes) × horas
    const bloque = bloqueDePersonas(config.num_personas)
    const especial = bloque === 'especial'
    if (!especial) {
      precio_base = precioHora(cursoSel.categoria, bloque) * (Number(cursoSel.duracion) || 0)
    }

    // Descuento configurado en el catálogo (Admin → Precios)
    let desc_catalogo = 0
    if (cursoSel.descuento_activo && cursoSel.descuento_porcentaje > 0) {
      desc_catalogo = precio_base * (cursoSel.descuento_porcentaje / 100)
    }

    // Descuento de cupón
    let desc_cupon = 0
    if (config.cupon_validado) {
      if (config.cupon_validado.tipo === '2x1') desc_cupon = precio_base * 0.5
      else desc_cupon = precio_base * (config.cupon_validado.valor / 100)
    }

    const desc = desc_grupo + desc_catalogo + desc_cupon
    const precio_con_desc = precio_base - desc

    // Consultoría: precio_hora × número de horas (exacto)
    let cons = 0
    if (config.incluye_consultoria && config.servicio_id) {
      const serv = servicios.find(s => s.id === config.servicio_id)
      if (serv) {
        if (serv.tipo_cobro === 'hora') {
          cons = Number(serv.precio_hora) * Number(config.horas_consultoria)
        } else {
          cons = Number(serv.precio_proyecto) || 0
        }
      }
    }

    // Viáticos desde BD
    let viat = 0
    if (config.requiere_viaticos && config.zona_viaticos_id) {
      const zona = viaticosZonas.find(z => z.id === config.zona_viaticos_id)
      viat = zona ? Number(zona.monto) : 0
    }

    const subtotal = precio_con_desc + cons + viat
    const iva_monto = config.aplica_iva ? subtotal * IVA : 0
    const total = subtotal + iva_monto
    const comision = total * (config.es_cliente_nuevo ? 0.15 : 0.10)

    return { precio_base, desc_grupo, desc_catalogo, desc_cupon, desc, precio_con_desc, cons, viat, subtotal, iva_monto, total, comision, dias_curso, especial, bloque }
  }

  const nums = calcular()
  const totalTexto = nums.especial ? 'Cotización especial' : `$${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  async function guardarCotizacion() {
    setSaving(true)
    try {
      // Generar folio único buscando el número más alto existente (no por conteo)
      const year = new Date().getFullYear()
      const { data: foliosExist } = await supabase.from('cotizaciones').select('folio').like('folio', `HCD-COT-${year}-%`)
      let maxNum = 0
      ;(foliosExist || []).forEach(c => {
        const m = (c.folio || '').match(/HCD-COT-\d+-(\d+)/)
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
      })
      const folio = `HCD-COT-${year}-${String(maxNum + 1).padStart(4, '0')}`
      const serv = servicios.find(s => s.id === config.servicio_id)
      const zona = viaticosZonas.find(z => z.id === config.zona_viaticos_id)

      const payload = {
        folio,
        empresa_nombre: contacto.empresa_nombre,
        contacto_nombre: contacto.contacto_nombre,
        contacto_email: contacto.contacto_email,
        contacto_whatsapp: contacto.contacto_whatsapp,
        curso_id: cursoSel.id,
        curso_nombre: cursoSel.nombre,
        tipo_precio: nums.especial ? 'especial' : config.tipo,
        num_personas: Number(config.num_personas) || 1,
        dias: nums.dias_curso,
        precio_base: nums.precio_base,
        descuento_tipo: config.cupon_validado ? config.cupon_validado.tipo : (nums.desc_grupo > 0 ? 'grupo' : null),
        descuento_valor: nums.desc,
        requiere_viaticos: config.requiere_viaticos,
        zona_viaticos: zona?.estado || null,
        monto_viaticos: nums.viat,
        aplica_iva: config.aplica_iva,
        subtotal: nums.subtotal,
        iva: nums.iva_monto,
        total: nums.total,
        es_cliente_nuevo: config.es_cliente_nuevo,
        comision_porcentaje: config.es_cliente_nuevo ? 15 : 10,
        comision_monto: nums.comision,
        incluye_consultoria: config.incluye_consultoria,
        descripcion_consultoria: serv?.nombre || config.descripcion_consultoria || null,
        precio_consultoria: nums.cons,
        cupon_codigo: config.cupon_validado?.codigo || null,
        notas: ((nums.especial ? '[COTIZACIÓN ESPECIAL 16+ personas] ' : '') + (config.notas || '')) || null,
        fecha_deseada: config.fecha_deseada || null,
        empresa_id: empresaPortal?.id || null,
        empresa_registrada: !!empresaPortal,
        estado: 'enviada'
      }
      let { data: cotCreada, error: errCot } = await supabase.from('cotizaciones').insert(payload).select('id').single()

      // Si el folio chocó (otra cotización simultánea), reintentar con sufijo
      if (errCot && (errCot.message || '').includes('duplicate')) {
        payload.folio = `HCD-COT-${year}-${String(maxNum + 1).padStart(4, '0')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
        const reintento = await supabase.from('cotizaciones').insert(payload).select('id').single()
        cotCreada = reintento.data
        errCot = reintento.error
      }

      if (errCot) {
        console.error('Error al guardar cotización:', errCot)
        alert('No se pudo guardar la cotización: ' + (errCot.message || 'error') + '\n\nVerifica que ejecutaste los SQL más recientes en Supabase.')
        setSaving(false)
        return
      }
      if (cotCreada) setCotizacionId(cotCreada.id)

      // Notificación para el admin
      try {
        await supabase.from('notificaciones').insert({
          tipo: 'cotizacion',
          titulo: nums.especial ? 'Cotización especial (16+ personas)' : 'Nueva cotización generada',
          mensaje: nums.especial
            ? `${contacto.empresa_nombre} solicitó cotización especial de ${cursoSel.nombre} para ${config.num_personas} personas`
            : `${contacto.empresa_nombre} cotizó ${cursoSel.nombre} por $${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          link: '/admin/cotizaciones'
        })
      } catch (_) {}

      // Incrementar uso de cupón
      if (config.cupon_validado) {
        await supabase.from('cupones').update({ usos_actuales: (config.cupon_validado.usos_actuales || 0) + 1 }).eq('id', config.cupon_validado.id)
      }

      setFolioCot(folio)
      setPaso(5)
    } catch (e) {
      console.error(e)
      const folio = `HCD-COT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
      setFolioCot(folio)
      setPaso(5)
    } finally { setSaving(false) }
  }

  function imprimirCotizacion() {
    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const serv = servicios.find(s => s.id === config.servicio_id)
    const zona = viaticosZonas.find(z => z.id === config.zona_viaticos_id)
    const ventana = window.open('', '_blank', 'width=900,height=700')
    ventana.document.write(htmlCotizacion({ contacto, cursoSel, config, nums, folio: folioCot, fecha, serv, zona }))
    ventana.document.close()
  }

  function enviarWhatsApp() {
    const msg = nums.especial
      ? `Hola, soy ${contacto.contacto_nombre} de ${contacto.empresa_nombre}. Solicité una cotización especial (16+ personas) en la plataforma HCD con folio *${folioCot}* para el curso ${cursoSel?.nombre}. ¿Podemos continuar?`
      : `Hola, soy ${contacto.contacto_nombre} de ${contacto.empresa_nombre}. Generé una cotización en la plataforma HCD con folio *${folioCot}* por un total de *$${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}*. ¿Podemos continuar?`
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function subirOrdenCompra(file) {
    if (!file) return
    if (file.type !== 'application/pdf') { alert('Solo se permiten archivos PDF'); return }
    if (!cotizacionId) { alert('Espera a que se genere la cotización'); return }
    setSubiendoOC(true)
    try {
      const nombreArchivo = `${folioCot}_${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage.from('ordenes-compra').upload(nombreArchivo, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('ordenes-compra').getPublicUrl(nombreArchivo)
      await supabase.from('cotizaciones').update({
        orden_compra_url: urlData.publicUrl,
        orden_compra_nombre: file.name,
        estado: 'aceptada'
      }).eq('id', cotizacionId)
      setOcSubida(file.name)
    } catch (e) {
      alert('Error al subir: ' + (e.message || 'verifica el bucket en Supabase'))
    } finally { setSubiendoOC(false) }
  }

  const cursosFamilia = familiaActiva ? cursos.filter(co => co.familia_id === familiaActiva) : cursos

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      <div style={{ background: '#8B1A1A', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} />
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Hablando con Datos</span>
        <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 13 }}>— Cotizador en línea</span>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {[[1, 'Seleccionar curso'], [2, 'Configurar'], [3, 'Tus datos'], [4, 'Resumen']].map(([n, label], i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: paso >= n ? '#8B1A1A' : '#e2e8f0', color: paso >= n ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{n}</div>
              <span style={{ fontSize: 12, color: paso >= n ? '#8B1A1A' : '#94a3b8', fontWeight: paso === n ? 700 : 400 }}>{label}</span>
              {i < 3 && <div style={{ width: 24, height: 1, background: '#e2e8f0', margin: '0 4px' }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* PASO 1 */}
        {paso === 1 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>¿Qué curso te interesa?</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Filtra por familia o navega por todos los cursos</p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              <button onClick={() => setFamiliaActiva(null)}
                style={{ padding: '7px 16px', borderRadius: 20, border: `2px solid ${!familiaActiva ? '#8B1A1A' : '#e2e8f0'}`, background: !familiaActiva ? '#f9f0f0' : '#fff', color: !familiaActiva ? '#8B1A1A' : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Todos
              </button>
              {familias.map(fa => (
                <button key={fa.id} onClick={() => setFamiliaActiva(fa.id)}
                  style={{ padding: '7px 16px', borderRadius: 20, border: `2px solid ${familiaActiva === fa.id ? fa.color : '#e2e8f0'}`, background: familiaActiva === fa.id ? `${fa.color}15` : '#fff', color: familiaActiva === fa.id ? fa.color : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {fa.icono} {fa.clave ? `${fa.clave} · ` : ''}{fa.nombre}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {cursosFamilia.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay cursos en esta categoría</div>
              )}
              {cursosFamilia.map(co => (
                <div key={co.id} onClick={() => { setCursoSel(co); setConfig(p => ({ ...p, dias: co.dias_grupo || 1 })); setPaso(2) }}
                  style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ background: `${co.familia?.color || '#8B1A1A'}15`, color: co.familia?.color || '#8B1A1A', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                      {co.familia?.icono} {co.familia?.clave ? `${co.familia.clave} · ` : ''}{co.familia?.nombre}
                    </span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>{co.duracion} hrs · {diasDelCurso(co)} día{diasDelCurso(co) > 1 ? 's' : ''}</span>
                  </div>
                  {co.clave_interna && <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>🔑 {co.clave_interna}</div>}
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{co.nombre}</h3>
                  {co.descripcion && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{co.descripcion}</p>}
                  <div style={{ color: '#8B1A1A', fontWeight: 700, fontSize: 13 }}>Desde ${(co.precio_persona_1dia || 2830).toLocaleString('es-MX')} p/persona</div>
                </div>
              ))}
            </div>

            {/* Consultoría */}
            {servicios.length > 0 && (
              <div style={{ background: '#f9f0f0', border: '1px solid #fecaca', borderRadius: 14, padding: '20px 24px', marginTop: 24 }}>
                <h3 style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 15, marginBottom: 6 }}>¿Necesitas consultoría?</h3>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>{servicios.map(s => s.nombre).join(' · ')}</p>
                <button onClick={() => { setCursoSel({ id: null, nombre: 'Servicio de Consultoría', precio_persona_1dia: 0 }); setConfig(p => ({ ...p, incluye_consultoria: true, tipo: 'grupo', servicio_id: servicios[0]?.id || '' })); setPaso(2) }}
                  style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Cotizar consultoría →
                </button>
              </div>
            )}
          </div>
        )}

        {/* PASO 2 */}
        {paso === 2 && cursoSel && (
          <div>
            <button onClick={() => setPaso(1)} style={btnBack}>← Cambiar curso</button>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Configura tu cotización</h2>
            <p style={{ color: '#8B1A1A', fontWeight: 600, marginBottom: 24 }}>{cursoSel.nombre}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Tipo */}
              {cursoSel.id && (
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

                  <label style={lbl}>Número de personas</label>
                  <input type="number" min={1} value={config.num_personas} onChange={e => c('num_personas')(e.target.value)} style={inp} />

                  {/* Duración automática según horas del curso */}
                  <div style={{ marginTop: 12, background: '#f8f9fb', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>Duración del curso</div>
                    <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 700 }}>
                      {cursoSel.duracion} horas — equivale a {nums.dias_curso} día{nums.dias_curso > 1 ? 's' : ''}
                    </div>
                    {nums.especial && (
                      <div style={{ color: '#8B1A1A', fontSize: 13, fontWeight: 700, marginTop: 6 }}>
                        16+ personas → Cotización especial. Envía tus datos y HCD te hará llegar el precio.
                      </div>
                    )}
                  </div>

                  <label style={lbl}>📅 Fecha deseada del curso</label>
                  <input type="date" value={config.fecha_deseada} onChange={e => c('fecha_deseada')(e.target.value)} style={inp} />
                  <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Propón una fecha; HCD confirmará disponibilidad.</p>
                </div>
              )}

              {/* Consultoría */}
              <div style={card}>
                <h3 style={cardTitle}>Consultoría</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                  <input type="checkbox" checked={config.incluye_consultoria} onChange={e => c('incluye_consultoria')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{cursoSel.id ? 'Agregar servicio de consultoría' : 'Servicio de consultoría'}</span>
                </label>
                {config.incluye_consultoria && (
                  <>
                    <label style={lbl}>Servicio</label>
                    <select value={config.servicio_id} onChange={e => c('servicio_id')(e.target.value)} style={inp}>
                      <option value="">Selecciona un servicio</option>
                      {servicios.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} — ${Number(s.tipo_cobro === 'hora' ? s.precio_hora : s.precio_proyecto).toLocaleString('es-MX')}/{s.tipo_cobro === 'hora' ? 'hr' : 'proyecto'}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const serv = servicios.find(s => s.id === config.servicio_id)
                      if (serv?.tipo_cobro === 'hora') {
                        return (
                          <>
                            <label style={lbl}>Número de horas</label>
                            <input type="number" min={1} value={config.horas_consultoria} onChange={e => c('horas_consultoria')(e.target.value)} style={inp} />
                          </>
                        )
                      }
                      return null
                    })()}
                    {config.servicio_id && (
                      <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>{servicios.find(s => s.id === config.servicio_id)?.descripcion}</div>
                    )}
                  </>
                )}
              </div>

              {/* Cupón */}
              <div style={card}>
                <h3 style={cardTitle}>¿Tienes un cupón?</h3>
                <label style={lbl}>Código de cupón</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={config.cupon_codigo} onChange={e => c('cupon_codigo')(e.target.value.toUpperCase())} placeholder="HCD-XXXXX" style={{ ...inp, flex: 1 }} />
                  <button onClick={validarCupon} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '0 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Aplicar</button>
                </div>
                {config.cupon_error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>✗ {config.cupon_error}</div>}
                {config.cupon_validado && (
                  <div style={{ marginTop: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ color: '#15803d', fontWeight: 700, fontSize: 13 }}>✓ Cupón aplicado</div>
                    <div style={{ color: '#15803d', fontSize: 12 }}>{config.cupon_validado.tipo === '2x1' ? '2x1 — 50% de descuento' : `${config.cupon_validado.valor}% de descuento`}</div>
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={config.aplica_iva} onChange={e => c('aplica_iva')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>Precio con IVA (16%)</span>
                  </label>
                </div>
              </div>

              {/* Viáticos */}
              <div style={card}>
                <h3 style={cardTitle}>Viáticos y traslado</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                  <input type="checkbox" checked={config.requiere_viaticos} onChange={e => c('requiere_viaticos')(e.target.checked)} style={{ accentColor: '#8B1A1A', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>¿Requiere traslado del instructor?</span>
                </label>
                {config.requiere_viaticos && (
                  <>
                    <label style={lbl}>Estado / Zona</label>
                    <select value={config.zona_viaticos_id} onChange={e => c('zona_viaticos_id')(e.target.value)} style={inp}>
                      <option value="">Selecciona tu estado</option>
                      {viaticosZonas.map(z => (
                        <option key={z.id} value={z.id}>{z.estado} {z.monto === 0 ? '(incluido)' : `— $${Number(z.monto).toLocaleString('es-MX')}`}</option>
                      ))}
                    </select>
                    {config.zona_viaticos_id && (() => {
                      const zona = viaticosZonas.find(z => z.id === config.zona_viaticos_id)
                      return zona?.notas ? <p style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>Incluye: {zona.notas}</p> : null
                    })()}
                    <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>HCD confirma el monto final de viáticos.</p>
                  </>
                )}
                <div style={{ marginTop: 12 }}>
                  <label style={lbl}>Notas adicionales</label>
                  <textarea value={config.notas} onChange={e => c('notas')(e.target.value)} placeholder="Requerimientos especiales..." rows={2} style={{ ...inp, resize: 'none' }} />
                </div>
              </div>
            </div>

            {/* Preview precio */}
            <div style={{ background: '#1e293b', borderRadius: 14, padding: '20px 28px', marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{nums.especial ? 'COTIZACIÓN' : 'TOTAL ESTIMADO'}</div>
                <div style={{ color: '#fff', fontSize: nums.especial ? 20 : 28, fontWeight: 800 }}>
                  {nums.especial ? 'Especial (16+ personas)' : <>${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}<span style={{ color: '#64748b', fontSize: 13, fontWeight: 400 }}> {config.aplica_iva ? '(IVA incl.)' : '(sin IVA)'}</span></>}
                </div>
                {nums.especial && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>HCD te enviará el precio con las condiciones.</div>}
                {!nums.especial && nums.desc_catalogo > 0 && <div style={{ color: '#4de8a0', fontSize: 13 }}>🏷️ Promoción {cursoSel.descuento_porcentaje}%: -${nums.desc_catalogo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>}
                {nums.desc_grupo > 0 && <div style={{ color: '#4de8a0', fontSize: 13 }}>👥 Grupo cerrado 20%: -${nums.desc_grupo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>}
                {nums.desc_cupon > 0 && <div style={{ color: '#4de8a0', fontSize: 13 }}>🎟️ Cupón: -${nums.desc_cupon.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>}
              </div>
              <button onClick={() => setPaso(3)} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Continuar →</button>
            </div>
          </div>
        )}

        {/* PASO 3 */}
        {paso === 3 && (
          <div>
            <button onClick={() => setPaso(2)} style={btnBack}>← Volver</button>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Tus datos de contacto</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Para enviarte la cotización formal</p>
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
                <label style={lbl}>WhatsApp {!empresaPortal && <span style={{ color: '#dc2626' }}>*</span>}</label>
                <input value={contacto.contacto_whatsapp} onChange={e => ct('contacto_whatsapp')(e.target.value)} placeholder="222 123 4567" style={inp} />
                {!empresaPortal && <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Obligatorio para darte seguimiento por WhatsApp</p>}
              </div>
              <div>
                <label style={lbl}>¿Eres cliente de HCD?</label>
                <select value={config.es_cliente_nuevo ? 'nuevo' : 'existente'} onChange={e => c('es_cliente_nuevo')(e.target.value === 'nuevo')} style={inp}>
                  <option value="nuevo">No, es primera vez</option>
                  <option value="existente">Sí, ya hemos trabajado juntos</option>
                </select>
              </div>
            </div>
            <button onClick={() => setPaso(4)} disabled={!contacto.empresa_nombre || !contacto.contacto_nombre || !contacto.contacto_email || (!empresaPortal && !contacto.contacto_whatsapp)} style={{ ...btnPrimary, marginTop: 24 }}>Ver resumen →</button>
          </div>
        )}

        {/* PASO 4 */}
        {paso === 4 && (
          <div>
            <button onClick={() => setPaso(3)} style={btnBack}>← Volver</button>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 24 }}>Resumen de tu cotización</h2>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '28px 32px', maxWidth: 600 }}>
              <Row label="Empresa" value={contacto.empresa_nombre} />
              <Row label="Contacto" value={contacto.contacto_nombre} />
              <Row label="Curso" value={cursoSel?.nombre} bold />
              <Row label="Participantes" value={`${config.num_personas} persona${config.num_personas > 1 ? 's' : ''}${nums.especial ? ' — Cotización especial (16+)' : ` · Bloque ${nums.bloque}`}`} />
              {config.requiere_viaticos && <Row label="Viáticos" value={viaticosZonas.find(z => z.id === config.zona_viaticos_id)?.estado || '—'} />}
              {config.incluye_consultoria && <Row label="Consultoría" value={servicios.find(s => s.id === config.servicio_id)?.nombre} />}
              <div style={{ borderTop: '2px solid #e2e8f0', marginTop: 16, paddingTop: 16 }}>
                <Row label="Subtotal" value={`$${nums.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />
                {nums.desc > 0 && <Row label="Descuento" value={`-$${nums.desc.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} color="#059669" />}
                {config.aplica_iva && <Row label="IVA (16%)" value={`$${nums.iva_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />}
                <Row label="TOTAL" value={totalTexto} bold big />
              </div>
              {nums.especial && <div style={{ marginTop: 12, color: '#8B1A1A', fontSize: 12, fontWeight: 600 }}>Al ser 16+ personas, HCD te enviará el precio con las fechas y condiciones.</div>}
            </div>
            <button onClick={guardarCotizacion} disabled={saving} style={{ ...btnPrimary, marginTop: 20 }}>{saving ? 'Generando...' : '✅ Generar cotización oficial'}</button>
          </div>
        )}

        {/* PASO 5 */}
        {paso === 5 && (
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>¡Cotización generada!</h2>
            <div style={{ background: '#f9f0f0', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 24px', marginBottom: 24 }}>
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Folio de cotización</div>
              <div style={{ color: '#8B1A1A', fontSize: 22, fontWeight: 800 }}>{folioCot}</div>
              <div style={{ color: '#1e293b', fontSize: 18, fontWeight: 700, marginTop: 8 }}>Total: {totalTexto}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={imprimirCotizacion} style={btnPrimary}>📄 Descargar cotización PDF</button>
              <button onClick={enviarWhatsApp} style={{ ...btnPrimary, background: '#25d366' }}>💬 Enviar por WhatsApp</button>
            </div>

            {/* Adjuntar orden de compra */}
            <div style={{ background: '#f8f9fb', borderRadius: 12, padding: '20px 24px', marginTop: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>¿Ya tienes tu orden de compra?</h3>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>Adjúntala aquí (PDF) y agilizaremos la confirmación de tu curso.</p>
              {ocSubida ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', color: '#15803d', fontSize: 13, fontWeight: 600 }}>
                  ✅ Orden de compra adjuntada: {ocSubida}
                </div>
              ) : (
                <label style={{ display: 'inline-block', background: '#1e293b', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: subiendoOC ? 'wait' : 'pointer' }}>
                  {subiendoOC ? 'Subiendo...' : '⬆️ Adjuntar orden de compra (PDF)'}
                  <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={subiendoOC}
                    onChange={e => subirOrdenCompra(e.target.files[0])} />
                </label>
              )}
            </div>

            <p style={{ color: '#64748b', fontSize: 13, marginTop: 20 }}>Un ejecutivo de Hablando con Datos te contactará para confirmar disponibilidad y fechas.</p>

            {/* Invitación a registrarse (solo si no es empresa logueada) */}
            {!empresaPortal && (
              <div style={{ background: 'linear-gradient(135deg,#8B1A1A,#a52222)', borderRadius: 14, padding: '24px 28px', marginTop: 24, textAlign: 'left' }}>
                <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 800, marginBottom: 8 }}>🚀 Agiliza tu proceso de compra</h3>
                <p style={{ color: 'rgba(255,255,255,.9)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  Regístrate gratis en nuestra plataforma y obtén: seguimiento de tus cotizaciones, gestión de la capacitación de tu personal, certificados digitales verificables y 30 días de prueba con todo incluido.
                </p>
                <a href="/empresa/acceso" style={{ display: 'inline-block', background: '#fff', color: '#8B1A1A', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                  Crear mi cuenta gratis →
                </a>
              </div>
            )}
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

function htmlCotizacion({ contacto, cursoSel, config, nums, folio, fecha, serv, zona }) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Cotización ${folio}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',sans-serif;color:#1e293b;background:#fff;}
.page{max-width:800px;margin:0 auto;padding:40px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #8B1A1A;}
.company{font-size:22px;font-weight:800;color:#8B1A1A;}
.sub{font-size:11px;color:#64748b;margin-top:2px;}
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
  <div>
    <div class="company">● Hablando con Datos</div>
    <div class="sub">Consultoría y Capacitación en Sistemas de Gestión</div>
    <div class="sub" style="margin-top:4px">Gerencia de Ventas</div>
    <div class="sub">WhatsApp: 222 354 9353 · ${EMAIL_CONTACTO}</div>
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
      <tr><td><strong>${cursoSel?.nombre}</strong></td><td>${config.num_personas} persona(s)${nums.especial ? ' — Cotización especial (16+)' : ` · Bloque ${nums.bloque} · ${cursoSel?.duracion}h`}</td><td style="text-align:right">${nums.especial ? 'A cotizar' : `$${nums.precio_base.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}</td></tr>
      ${nums.desc_grupo > 0 ? `<tr><td>Descuento grupo cerrado (20%)</td><td>Mínimo ${MIN_GRUPO} participantes</td><td style="text-align:right;color:#059669">-$${nums.desc_grupo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${nums.desc_catalogo > 0 ? `<tr><td>Descuento promocional (${cursoSel.descuento_porcentaje}%)</td><td>Precio especial</td><td style="text-align:right;color:#059669">-$${nums.desc_catalogo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${nums.desc_cupon > 0 ? `<tr><td>Cupón ${config.cupon_validado?.codigo}</td><td>${config.cupon_validado?.tipo === '2x1' ? '2x1' : config.cupon_validado?.valor + '%'}</td><td style="text-align:right;color:#059669">-$${nums.desc_cupon.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${config.incluye_consultoria && nums.cons > 0 ? `<tr><td>Consultoría</td><td>${serv?.nombre || ''}</td><td style="text-align:right">$${nums.cons.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${config.requiere_viaticos && nums.viat > 0 ? `<tr><td>Viáticos / Traslado</td><td>${zona?.estado || ''}</td><td style="text-align:right">$${nums.viat.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      <tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">Subtotal</td><td style="text-align:right">$${nums.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>
      ${config.aplica_iva ? `<tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">IVA (16%)</td><td style="text-align:right">$${nums.iva_monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      <tr class="total-row"><td colspan="2" style="text-align:right">TOTAL</td><td style="text-align:right">${nums.especial ? 'Cotización especial — HCD te enviará el precio' : `$${nums.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${config.aplica_iva ? 'MXN (IVA incl.)' : 'MXN (sin IVA)'}`}</td></tr>
    </tbody>
  </table>
</div>
${config.notas ? `<div class="seccion"><h3>Notas</h3><p style="font-size:13px;color:#475569">${config.notas}</p></div>` : ''}
<div class="seccion" style="background:#f8f9fb;border-radius:8px;padding:16px;">
  <h3 style="margin-bottom:8px">Condiciones</h3>
  <p style="font-size:12px;color:#475569;line-height:1.8">
    • Cotización válida por 30 días naturales.<br/>
    • Precios en pesos mexicanos (MXN). ${config.aplica_iva ? 'IVA del 16% incluido.' : 'Precio sin IVA.'}<br/>
    • La capacitación se confirma contra anticipo del 50%.<br/>
    • Incluye material didáctico y constancias con folio único verificable.<br/>
    ${config.requiere_viaticos ? '• Los viáticos son estimados y quedan sujetos a confirmación por HCD.<br/>' : ''}
    • Contacto: WhatsApp 222 354 9353 · ${EMAIL_CONTACTO}
  </p>
</div>
<div class="footer">
  <p>Hablando con Datos — Consultoría y Capacitación en Sistemas de Gestión · Puebla, México</p>
  <p style="margin-top:4px">Folio: ${folio} · Gerencia de Ventas: 222 354 9353 · ${EMAIL_CONTACTO}</p>
</div>
</div><script>window.onload=()=>{window.print();}</script></body></html>`
}

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px' }
const cardTitle = { fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14, letterSpacing: .3 }
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, marginTop: 10 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', background: '#fff' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const btnBack = { background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }
