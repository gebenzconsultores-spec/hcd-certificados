import { useEffect, useState } from 'react'
import { supabase, getEmpresas } from '../lib/supabase'
import * as XLSX from 'xlsx'

// Descarga un arreglo de objetos como archivo .xlsx
function exportarAExcel(filas, archivo, hoja = 'Datos') {
  if (!filas || filas.length === 0) { alert('No hay datos para exportar.'); return }
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, hoja)
  XLSX.writeFile(wb, archivo)
}

export default function Empresas() {
  const [empresas, setEmpresas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [modal, setModal] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [empleadosEmpresa, setEmpleadosEmpresa] = useState([])
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false)
  const [filtro, setFiltro] = useState('todas') // 'todas', 'cliente_nuevo', 'cartera'
  const [form, setForm] = useState({
    nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '',
    estatus: 'cliente_nuevo', clave_vendedor: 'VEND-GERENCIA'
  })
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState(null)
  const [credencialesNuevas, setCredencialesNuevas] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const data = await getEmpresas()
      setEmpresas(data || [])
    } catch (_) {
      const { data } = await supabase.from('empresas').select('*').order('created_at', { ascending: false })
      setEmpresas(data || [])
    }
    try {
      const { data: v } = await supabase.from('vendedores').select('clave, nombre').eq('activo', true).order('nombre')
      setVendedores(v || [])
    } catch (_) { setVendedores([]) }
  }

  // Genera ID de empresa EMP-XXXX sin duplicados
  async function generarIdEmpresa() {
    try {
      const { data } = await supabase.rpc('siguiente_id', { p_prefijo: 'EMP', p_tabla: 'empresas', p_columna: 'id_empresa' })
      if (data) return data
    } catch (_) {}
    const { data: existentes } = await supabase.from('empresas').select('id_empresa').not('id_empresa', 'is', null)
    let maxNum = 0
    ;(existentes || []).forEach(e => {
      const m = (e.id_empresa || '').match(/EMP-(\d+)/)
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    })
    return `EMP-${String(maxNum + 1).padStart(4, '0')}`
  }

  const [cotizacionesEmp, setCotizacionesEmp] = useState([])
  const [cursosEmp, setCursosEmp] = useState([])
  const [evaluacionEmp, setEvaluacionEmp] = useState(null)

  // Al abrir el detalle, cargar todo el dashboard de la empresa
  async function verDetalle(empresa) {
    setDetalle(empresa)
    setCargandoEmpleados(true)
    setEmpleadosEmpresa([]); setCotizacionesEmp([]); setCursosEmp([]); setEvaluacionEmp(null)
    try {
      // Empleados por ambos campos
      let emps = []
      const e1 = await supabase.from('participantes').select('*').eq('registrado_por_empresa', empresa.id)
      emps = e1.data || []
      const e2 = await supabase.from('participantes').select('*').eq('empresa_id', empresa.id)
      ;(e2.data || []).forEach(p => { if (!emps.find(x => x.id === p.id)) emps.push(p) })
      setEmpleadosEmpresa(emps)

      // Cotizaciones de la empresa (para facturación)
      try {
        const { data: cots } = await supabase.from('cotizaciones').select('*').eq('empresa_id', empresa.id)
        setCotizacionesEmp(cots || [])
      } catch (_) {}

      // Cursos tomados (asignaciones de sus empleados)
      try {
        const ids = emps.map(e => e.id)
        let asigs = []
        if (ids.length > 0) {
          const { data: a } = await supabase.from('asignaciones').select('curso_nombre, estado, tipo').in('empleado_id', ids)
          asigs = a || []
        }
        // Por empresa_id también
        const { data: a2 } = await supabase.from('asignaciones').select('curso_nombre, estado, tipo').eq('empresa_id', empresa.id)
        ;(a2 || []).forEach(x => asigs.push(x))
        setCursosEmp(asigs.filter(a => a.tipo !== 'microcurso' && a.curso_nombre))
      } catch (_) {}

      // Evaluación de la empresa hacia HCD
      try {
        const { data: ev } = await supabase.from('evaluaciones_hcd').select('*').eq('empresa_id', empresa.id).order('created_at', { ascending: false }).limit(1)
        setEvaluacionEmp(ev && ev[0] ? ev[0] : null)
      } catch (_) {}
    } catch (_) { setEmpleadosEmpresa([]) }
    setCargandoEmpleados(false)
  }

  // Cálculos de facturación (solo admin)
  function facturacion() {
    const aceptadas = cotizacionesEmp.filter(c => c.estado === 'aceptada')
    const ahora = new Date()
    const mes = aceptadas.filter(c => { const d = new Date(c.created_at); return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear() })
    const anio = aceptadas.filter(c => new Date(c.created_at).getFullYear() === ahora.getFullYear())
    const suma = arr => arr.reduce((acc, c) => acc + (c.total || 0), 0)
    return {
      mensual: suma(mes), anual: suma(anio),
      generadas: cotizacionesEmp.length, aceptadas: aceptadas.length
    }
  }

  const f = k => v => setForm(p => ({ ...p, [k]: v }))

  // Restablecer / cambiar la contraseña del portal de una empresa (admin)
  // Marcar/desmarcar exento de pago (cliente negociado)
  async function toggleExento(empresa) {
    const nuevo = !empresa.exento_pago
    try {
      const { error } = await supabase.from('empresas').update({ exento_pago: nuevo }).eq('id', empresa.id)
      if (error) { alert('No se pudo actualizar: ' + error.message); return }
      await cargar()
      setDetalle(d => d ? { ...d, exento_pago: nuevo } : d)
    } catch (e) { alert('Error: ' + (e.message || '')) }
  }

  // Dar de baja la empresa: sus empleados quedan "sin empresa" (reasignables)
  // Eliminar por completo: borra empresa y TODOS sus registros
  async function eliminarPorCompleto(empresa) {
    // Protección: no eliminar si tiene cotizaciones aceptadas (ventas)
    const aceptadas = cotizacionesEmp.filter(c => c.estado === 'aceptada')
    if (aceptadas.length > 0) {
      alert(`⛔ No se puede eliminar "${empresa.nombre}" por completo.\n\nTiene ${aceptadas.length} cotización(es) aceptada(s) con facturación registrada. Para conservar el historial de ventas, primero dale de baja.`)
      return
    }
    // Doble confirmación: escribir el nombre
    const escrito = window.prompt(`⚠️ ELIMINACIÓN PERMANENTE E IRREVERSIBLE\n\nEsto borrará la empresa "${empresa.nombre}" y TODOS sus registros: empleados, asignaciones, certificados, cotizaciones, compras y evaluación.\n\nPara confirmar, escribe el nombre exacto de la empresa:`)
    if (escrito === null) return
    if (escrito.trim() !== empresa.nombre.trim()) {
      alert('El nombre no coincide. No se eliminó nada.')
      return
    }
    try {
      // IDs de empleados de la empresa
      let emps = []
      const e1 = await supabase.from('participantes').select('id').eq('registrado_por_empresa', empresa.id)
      emps = (e1.data || []).map(x => x.id)
      const e2 = await supabase.from('participantes').select('id').eq('empresa_id', empresa.id)
      ;(e2.data || []).forEach(x => { if (!emps.includes(x.id)) emps.push(x.id) })

      // Borrar registros dependientes de esos empleados
      if (emps.length > 0) {
        await supabase.from('certificados').delete().in('participante_id', emps)
        await supabase.from('resultados_examen').delete().in('participante_id', emps)
        await supabase.from('asignaciones').delete().in('empleado_id', emps)
      }
      // Borrar registros ligados a la empresa
      await supabase.from('certificados').delete().eq('empresa_id', empresa.id)
      await supabase.from('asignaciones').delete().eq('empresa_id', empresa.id)
      await supabase.from('inscripciones').delete().eq('empresa_id', empresa.id)
      await supabase.from('cotizaciones').delete().eq('empresa_id', empresa.id)
      await supabase.from('compras').delete().eq('empresa_id', empresa.id)
      await supabase.from('evaluaciones_hcd').delete().eq('empresa_id', empresa.id)
      // Borrar empleados
      await supabase.from('participantes').delete().eq('registrado_por_empresa', empresa.id)
      await supabase.from('participantes').delete().eq('empresa_id', empresa.id)
      // Borrar la empresa
      await supabase.from('empresas').delete().eq('id', empresa.id)

      await cargar()
      setDetalle(null)
      alert(`✅ Empresa "${empresa.nombre}" y todos sus registros fueron eliminados permanentemente.`)
    } catch (e) {
      alert('Error al eliminar: ' + (e.message || '') + '\n\nAlgunos registros pueden no haberse borrado. Revisa e intenta de nuevo.')
    }
  }

  async function darDeBajaEmpresa(empresa) {
    if (!window.confirm(`¿Dar de baja a "${empresa.nombre}"?\n\nLa empresa se marcará como dada de baja y sus empleados quedarán SIN EMPRESA (podrás reasignarlos a otra empresa después). Los empleados NO se eliminan.`)) return
    try {
      // Empleados quedan sin empresa (empresa_id y registrado_por_empresa en NULL)
      await supabase.from('participantes').update({ empresa_id: null, registrado_por_empresa: null }).eq('registrado_por_empresa', empresa.id)
      await supabase.from('participantes').update({ empresa_id: null }).eq('empresa_id', empresa.id)
      // Marcar la empresa como dada de baja
      await supabase.from('empresas').update({ dada_de_baja: true, activo: false }).eq('id', empresa.id)
      await cargar()
      setDetalle(null)
      alert('✅ Empresa dada de baja. Sus empleados quedaron sin empresa y puedes reasignarlos.')
    } catch (e) { alert('Error: ' + (e.message || '')) }
  }

  async function restablecerPassword(empresa) {
    const nueva = window.prompt(
      `Contraseña del portal para "${empresa.nombre}".\n\nEscribe una nueva contraseña, o deja vacío y da Aceptar para GENERAR una automática:`,
      ''
    )
    if (nueva === null) return // canceló
    const password = nueva.trim() || Math.random().toString(36).substring(2, 8).toUpperCase()
    try {
      const { error } = await supabase.from('empresas').update({ portal_password: password }).eq('id', empresa.id)
      if (error) { alert('No se pudo actualizar: ' + error.message); return }
      await cargar()
      setDetalle(d => d ? { ...d, portal_password: password } : d)
      alert(`✅ Contraseña actualizada.\n\nEmpresa: ${empresa.nombre}\nID: ${empresa.id_empresa}\nNueva contraseña: ${password}\n\nGuárdala y compártela con la empresa.`)
    } catch (e) {
      alert('Error: ' + (e.message || ''))
    }
  }

  function abrirNueva() {
    setEditando(null)
    setForm({ nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '', estatus: 'cliente_nuevo', clave_vendedor: 'VEND-GERENCIA' })
    setModal(true)
  }
  function abrirEditar(empresa) {
    setEditando(empresa)
    setForm({
      nombre: empresa.nombre || '', contacto_nombre: empresa.contacto_nombre || '',
      contacto_email: empresa.contacto_email || '', contacto_whatsapp: empresa.contacto_whatsapp || '',
      ciudad: empresa.ciudad || '', estatus: empresa.estatus || 'cliente_nuevo',
      clave_vendedor: empresa.clave_vendedor || 'VEND-GERENCIA'
    })
    setModal(true)
  }
  function cerrarModal() {
    setModal(false)
    setEditando(null)
  }

  async function guardar() {
    if (!form.nombre) return
    setSaving(true)
    try {
      if (editando) {
        // EDITAR: actualiza datos, conserva credenciales (id_empresa / password)
        const { error } = await supabase.from('empresas').update({
          nombre: form.nombre,
          contacto_nombre: form.contacto_nombre,
          contacto_email: form.contacto_email,
          contacto_whatsapp: form.contacto_whatsapp,
          ciudad: form.ciudad,
          estatus: form.estatus,
          clave_vendedor: form.clave_vendedor || 'VEND-GERENCIA'
        }).eq('id', editando.id)
        if (error) { alert('No se pudo guardar: ' + error.message); setSaving(false); return }
        await cargar()
        cerrarModal()
        setForm({ nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '', estatus: 'cliente_nuevo', clave_vendedor: 'VEND-GERENCIA' })
        setSaving(false)
        return
      }
      const idEmpresa = await generarIdEmpresa()
      const password = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { error } = await supabase.from('empresas').insert({
        id_empresa: idEmpresa,
        portal_password: password,
        nombre: form.nombre,
        contacto_nombre: form.contacto_nombre,
        contacto_email: form.contacto_email,
        contacto_whatsapp: form.contacto_whatsapp,
        ciudad: form.ciudad,
        estatus: form.estatus,
        clave_vendedor: form.clave_vendedor || 'VEND-GERENCIA',
        activo: true
      })
      if (error) { alert('No se pudo guardar: ' + error.message); setSaving(false); return }
      await cargar()
      setModal(false)
      // Mostrar las credenciales generadas
      setCredencialesNuevas({ nombre: form.nombre, id_empresa: idEmpresa, password })
      setForm({ nombre: '', contacto_nombre: '', contacto_email: '', contacto_whatsapp: '', ciudad: '', estatus: 'cliente_nuevo', clave_vendedor: 'VEND-GERENCIA' })
    } catch (e) { alert('Error: ' + (e.message || '')) } finally { setSaving(false) }
  }

  const filtradas = filtro === 'todas' ? empresas : empresas.filter(e => (e.estatus || 'cliente_nuevo') === filtro)
  const nombreVendedor = clave => vendedores.find(v => v.clave === clave)?.nombre || clave || '—'

  function descargarExcel() {
    const filas = filtradas.map(e => ({
      'ID Empresa': e.id_empresa || '',
      'Nombre': e.nombre || '',
      'Ciudad': e.ciudad || '',
      'Contacto': e.contacto_nombre || '',
      'Email': e.contacto_email || '',
      'WhatsApp': e.contacto_whatsapp || '',
      'Estatus': e.estatus || '',
      'Vendedor (clave)': e.clave_vendedor || '',
      'Vendedor (nombre)': nombreVendedor(e.clave_vendedor),
      'Contraseña portal': e.portal_password || '',
      'Exento de pago': e.exento_pago ? 'Sí' : 'No',
      'Activa': e.activo === false ? 'No' : 'Sí',
    }))
    const hoy = new Date().toISOString().slice(0, 10)
    exportarAExcel(filas, `empresas_${hoy}.xlsx`, 'Empresas')
  }

  const conteoNuevos = empresas.filter(e => (e.estatus || 'cliente_nuevo') === 'cliente_nuevo').length
  const conteoCartera = empresas.filter(e => e.estatus === 'cartera').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Empresas</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Clientes corporativos. Solo los "cliente nuevo" cuentan como venta de la plataforma.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={descargarExcel} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>⬇️ Descargar Excel</button>
          <button onClick={abrirNueva} style={btnPrimary}>+ Nueva empresa</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['todas', `Todas (${empresas.length})`], ['cliente_nuevo', `🟢 Cliente nuevo (${conteoNuevos})`], ['cartera', `📁 En cartera (${conteoCartera})`]].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            style={{ background: filtro === v ? '#8B1A1A' : '#fff', color: filtro === v ? '#fff' : '#475569', border: `1px solid ${filtro === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              {['Empresa', 'Estatus', 'Vendedor', 'Ciudad', 'Contacto', 'WhatsApp', ''].map(h => (
                <th key={h} style={{ padding: '11px 18px', textAlign: 'left', color: '#64748b', fontSize: 11, letterSpacing: .5, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay empresas en este filtro</td></tr>
            )}
            {filtradas.map(e => {
              const nuevo = (e.estatus || 'cliente_nuevo') === 'cliente_nuevo'
              return (
                <tr key={e.id} onClick={() => verDetalle(e)} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = '#f8f9fb'}
                  onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: '12px 18px', color: '#1e293b', fontWeight: 600 }}>
                    {e.nombre}
                    <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600, marginTop: 2 }}>👁 Ver dashboard</div>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ background: nuevo ? '#f0fdf4' : '#f1f5f9', color: nuevo ? '#059669' : '#64748b', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {nuevo ? '🟢 Cliente nuevo' : '📁 En cartera'}
                    </span>
                    {e.exento_pago && <div style={{ marginTop: 3 }}><span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>Exento de pago</span></div>}
                    {e.dada_de_baja && <div style={{ marginTop: 3 }}><span style={{ background: '#fef2f2', color: '#dc2626', padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>Dada de baja</span></div>}
                  </td>
                  <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>
                    <code style={{ background: '#f9f0f0', color: '#8B1A1A', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{e.clave_vendedor || 'VEND-GERENCIA'}</code>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{nombreVendedor(e.clave_vendedor)}</div>
                  </td>
                  <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.ciudad || '—'}</td>
                  <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.contacto_nombre || '—'}</td>
                  <td style={{ padding: '12px 18px', color: '#475569', fontSize: 13 }}>{e.contacto_whatsapp || '—'}</td>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={(ev) => { ev.stopPropagation(); abrirEditar(e) }} style={{ background: '#fff', color: '#8B1A1A', border: '1px solid #8B1A1A', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>✏️ Editar</button>
                      <button onClick={(ev) => { ev.stopPropagation(); verDetalle(e) }} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>👁 Ver</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL DETALLE (Ver): información, acceso al portal, alumnos */}
      {detalle && (
        <div style={overlayStyle} onClick={() => setDetalle(null)}>
          <div style={{ ...modalStyle, width: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{detalle.nombre}</h3>
                <span style={{ background: (detalle.estatus || 'cliente_nuevo') === 'cliente_nuevo' ? '#f0fdf4' : '#f1f5f9', color: (detalle.estatus || 'cliente_nuevo') === 'cliente_nuevo' ? '#059669' : '#64748b', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {(detalle.estatus || 'cliente_nuevo') === 'cliente_nuevo' ? '🟢 Cliente nuevo' : '📁 En cartera'}
                </span>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>

            {/* Acceso al portal */}
            <div style={{ background: '#f9f0f0', border: '1px solid #f0d0d0', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ color: '#8B1A1A', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🔑 ACCESO AL PORTAL DE EMPRESA</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>ID de empresa</div>
                  <code style={{ color: '#1e293b', fontSize: 15, fontWeight: 700 }}>{detalle.id_empresa || '—'}</code>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>Contraseña de portal</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ color: '#1e293b', fontSize: 15, fontWeight: 700 }}>{detalle.portal_password || '—'}</code>
                    {detalle.portal_password && (
                      <button onClick={() => { navigator.clipboard?.writeText(`ID: ${detalle.id_empresa}  Contraseña: ${detalle.portal_password}`); alert('Datos de acceso copiados') }}
                        style={{ background: '#fff', border: '1px solid #8B1A1A', color: '#8B1A1A', borderRadius: 5, padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>📋 Copiar</button>
                    )}
                  </div>
                </div>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>La empresa entra en /empresa/acceso con estos datos.</p>
              <button onClick={() => restablecerPassword(detalle)}
                style={{ marginTop: 10, background: '#fff', border: '1px solid #8B1A1A', color: '#8B1A1A', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                🔄 Restablecer / cambiar contraseña
              </button>
            </div>

            {/* Información */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <InfoItem label="Vendedor" value={`${detalle.clave_vendedor || 'VEND-GERENCIA'} · ${nombreVendedor(detalle.clave_vendedor)}`} />
              <InfoItem label="Ciudad" value={detalle.ciudad || '—'} />
              <InfoItem label="Contacto" value={detalle.contacto_nombre || '—'} />
              <InfoItem label="Correo" value={detalle.contacto_email || detalle.correo || '—'} />
              <InfoItem label="WhatsApp" value={detalle.contacto_whatsapp || '—'} />
            </div>

            {/* Métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <Metrica label="Empleados" valor={empleadosEmpresa.length} color="#1d4ed8" />
              <Metrica label="Cursos tomados" valor={cursosEmp.length} color="#059669" />
              <Metrica label="Completados" valor={cursosEmp.filter(c => c.estado === 'completado').length} color="#8B1A1A" />
            </div>

            {/* Facturación (SOLO ADMIN) */}
            {(() => {
              const fac = facturacion()
              return (
                <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>💰 FACTURACIÓN (solo visible para admin)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Este mes</div>
                      <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>${fac.mensual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Este año</div>
                      <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>${fac.anual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 8, borderTop: '1px solid #334155', paddingTop: 8 }}>
                    {fac.generadas} cotización(es) generada(s) · {fac.aceptadas} aceptada(s) con orden de compra
                  </div>
                </div>
              )
            })()}

            {/* Exento de pago + gestión (solo admin) */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ color: '#1e40af', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>⚙️ GESTIÓN (solo admin)</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
                <input type="checkbox" checked={!!detalle.exento_pago} onChange={() => toggleExento(detalle)} style={{ accentColor: '#1d4ed8', width: 18, height: 18 }} />
                <div>
                  <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 600 }}>Exento de pago</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Cliente negociado: usa la plataforma sin cobro de renta ni bloqueo por prueba.</div>
                </div>
              </label>
              {detalle.exento_pago && (
                <div style={{ background: '#f0fdf4', color: '#059669', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                  ✓ Esta empresa está exenta de pago
                </div>
              )}
              <button onClick={() => darDeBajaEmpresa(detalle)}
                style={{ width: '100%', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🗑 Dar de baja esta empresa
              </button>
              <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>Los empleados quedarán sin empresa (reasignables), no se eliminan. El registro de la empresa se conserva.</p>

              <button onClick={() => eliminarPorCompleto(detalle)}
                style={{ width: '100%', marginTop: 12, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ⚠️ Eliminar por completo (borra todos los registros)
              </button>
              <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>Borra la empresa, empleados, asignaciones, certificados, cotizaciones y evaluación. Permanente e irreversible. No disponible si tiene ventas registradas.</p>
            </div>

            {/* Evaluación de la empresa hacia HCD */}
            <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ color: '#92400e', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>⭐ EVALUACIÓN DE LA EMPRESA HACIA HCD</div>
              {evaluacionEmp ? (
                <div>
                  <div style={{ fontSize: 22 }}>{'★'.repeat(evaluacionEmp.calificacion || 0)}{'☆'.repeat(5 - (evaluacionEmp.calificacion || 0))}
                    <span style={{ fontSize: 13, color: '#92400e', marginLeft: 8 }}>{evaluacionEmp.calificacion}/5</span>
                  </div>
                  {evaluacionEmp.sugerencias && (
                    <div style={{ marginTop: 8, background: '#fff', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600 }}>Sugerencias / mejoras solicitadas:</div>
                      <div style={{ color: '#374151', fontSize: 13, marginTop: 3 }}>{evaluacionEmp.sugerencias}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#a16207', fontSize: 13 }}>La empresa aún no ha dejado su evaluación.</div>
              )}
            </div>

            {/* Cursos tomados */}
            {cursosEmp.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📚 Cursos tomados / comprados</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[...new Set(cursosEmp.map(c => c.curso_nombre))].map((nom, i) => {
                    const completado = cursosEmp.some(c => c.curso_nombre === nom && c.estado === 'completado')
                    return (
                      <span key={i} style={{ background: completado ? '#f0fdf4' : '#f1f5f9', color: completado ? '#059669' : '#475569', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {completado ? '✓ ' : ''}{nom}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Alumnos */}
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>👥 Alumnos / empleados ({empleadosEmpresa.length})</div>
              {cargandoEmpleados ? (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: 12 }}>Cargando...</div>
              ) : empleadosEmpresa.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: 12, background: '#f8f9fb', borderRadius: 8 }}>Esta empresa aún no tiene alumnos registrados.</div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fb' }}>
                        {['ID', 'Nombre', 'Correo', 'Examen'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {empleadosEmpresa.map(emp => (
                        <tr key={emp.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}><code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>{emp.id_empleado || '—'}</code></td>
                          <td style={{ padding: '8px 12px', color: '#1e293b', fontSize: 12, fontWeight: 600 }}>{emp.nombre}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>{emp.correo || '—'}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {emp.acceso_examen ? <span style={{ color: '#059669', fontSize: 11, fontWeight: 600 }}>✓ Habilitado</span> : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credenciales generadas al crear empresa */}
      {credencialesNuevas && (
        <div style={overlayStyle} onClick={() => setCredencialesNuevas(null)}>
          <div style={{ ...modalStyle, width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Empresa creada</h3>
              <p style={{ color: '#64748b', fontSize: 13 }}>{credencialesNuevas.nombre}</p>
            </div>
            <div style={{ background: '#f9f0f0', border: '2px dashed #8B1A1A', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ color: '#8B1A1A', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🔑 DATOS DE ACCESO AL PORTAL</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>ID de empresa</div>
                <code style={{ color: '#1e293b', fontSize: 18, fontWeight: 800 }}>{credencialesNuevas.id_empresa}</code>
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>Contraseña</div>
                <code style={{ color: '#1e293b', fontSize: 18, fontWeight: 800 }}>{credencialesNuevas.password}</code>
              </div>
            </div>
            <p style={{ color: '#991b1b', fontSize: 12, marginBottom: 16 }}>⚠️ Guarda estos datos y dáselos a la empresa. Entra en /empresa/acceso.</p>
            <button onClick={() => { navigator.clipboard?.writeText(`ID: ${credencialesNuevas.id_empresa}  Contraseña: ${credencialesNuevas.password}`); alert('Copiado') }}
              style={{ ...btnPrimary, width: '100%', marginBottom: 8 }}>📋 Copiar datos de acceso</button>
            <button onClick={() => setCredencialesNuevas(null)} style={{ ...btnGhost, width: '100%' }}>Cerrar</button>
          </div>
        </div>
      )}

      {modal && (
        <div style={overlayStyle} onClick={cerrarModal}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>{editando ? 'Editar empresa' : 'Nueva empresa'}</h3>

            {/* Estatus */}
            <label style={lbl}>Estatus del cliente *</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {[['cliente_nuevo', '🟢 Cliente nuevo', 'Cuenta como venta'], ['cartera', '📁 En cartera', 'Cliente propio, no cuenta como venta']].map(([v, l, d]) => (
                <button key={v} type="button" onClick={() => f('estatus')(v)}
                  style={{ flex: 1, padding: '12px', border: `2px solid ${form.estatus === v ? '#8B1A1A' : '#e2e8f0'}`, borderRadius: 10, background: form.estatus === v ? '#f9f0f0' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.estatus === v ? '#8B1A1A' : '#475569' }}>{l}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{d}</div>
                </button>
              ))}
            </div>

            {/* Clave de vendedor */}
            <label style={lbl}>Clave de vendedor</label>
            <select value={form.clave_vendedor} onChange={e => f('clave_vendedor')(e.target.value)} style={inp}>
              {vendedores.map(v => <option key={v.clave} value={v.clave}>{v.clave} — {v.nombre}</option>)}
            </select>
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, marginBottom: 14 }}>Si la empresa llegó directo (sin vendedor), deja "Gerencia Comercial".</p>

            <Field label="Nombre de la empresa *" value={form.nombre} onChange={f('nombre')} placeholder="ej. Volkswagen de México" />
            <Field label="Ciudad" value={form.ciudad} onChange={f('ciudad')} placeholder="ej. Puebla" />
            <Field label="Nombre del contacto" value={form.contacto_nombre} onChange={f('contacto_nombre')} placeholder="ej. Juan Pérez" />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Email del contacto" type="email" value={form.contacto_email} onChange={f('contacto_email')} placeholder="contacto@empresa.com" /></div>
              <div style={{ flex: 1 }}><Field label="WhatsApp" value={form.contacto_whatsapp} onChange={f('contacto_whatsapp')} placeholder="222 123 4567" /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={cerrarModal} style={btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.nombre} style={btnPrimary}>{saving ? 'Guardando...' : (editando ? 'Guardar cambios' : 'Guardar empresa')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ color: '#94a3b8', fontSize: 11 }}>{label}</div>
      <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function Metrica({ label, valor, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ color, fontSize: 24, fontWeight: 800 }}>{valor}</div>
      <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{label}</div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inp = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#1e293b', boxSizing: 'border-box' }
const btnPrimary = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, padding: '28px 32px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }
const modalTitle = { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20 }
