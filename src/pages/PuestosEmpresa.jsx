import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const BTN = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const BTN2 = { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }
const INP = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
const LBL = { display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 4, marginTop: 12 }
const CHIP = { background: '#f9f0f0', color: '#8B1A1A', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', fontSize: 11 }
const NIVELES = ['Dirección', 'Gerencia', 'Jefatura', 'Supervisión', 'Operativo']

function parseList(t) { try { const r = JSON.parse(t); return Array.isArray(r) ? r : [] } catch (e) { return t ? String(t).split('\n').filter(Boolean) : [] } }

function ListaDinamica({ items, onChange, placeholder, boton }) {
  const [val, setVal] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input value={val} onChange={function(e){setVal(e.target.value)}} placeholder={placeholder}
          onKeyDown={function(e){ if(e.key==='Enter'){e.preventDefault(); if(val.trim()){onChange([].concat(items,[val.trim()])); setVal('')}} }}
          style={Object.assign({}, INP, { flex: 1 })} />
        <button type="button" onClick={function(){ if(val.trim()){onChange([].concat(items,[val.trim()])); setVal('')} }}
          style={Object.assign({}, BTN, { padding: '8px 14px', fontSize: 12 })}>+ {boton}</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(function(item, i) {
          return (
            <span key={i} style={{ background: '#f8f9fb', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {item}
              <button type="button" onClick={function(){ onChange(items.filter(function(x,j){return j!==i})) }}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function PuestosEmpresa({ empresa }) {
  var _a = useState([]), puestos = _a[0], setPuestos = _a[1]
  var _b = useState([]), relaciones = _b[0], setRelaciones = _b[1]
  var _c = useState([]), cursosCat = _c[0], setCursosCat = _c[1]
  var _d = useState([]), puestoCursos = _d[0], setPuestoCursos = _d[1]
  var _e = useState([]), diagnosticos = _e[0], setDiagnosticos = _e[1]
  var _f = useState([]), empleados = _f[0], setEmpleados = _f[1]
  var _g = useState(true), loading = _g[0], setLoading = _g[1]
  var _h = useState('puestos'), vista = _h[0], setVista = _h[1]
  var _i = useState(null), modal = _i[0], setModal = _i[1]
  var _j = useState('datos'), tabForm = _j[0], setTabForm = _j[1]

  var _k = useState(''), fNombre = _k[0], setFNombre = _k[1]
  var _l = useState(''), fArea = _l[0], setFArea = _l[1]
  var _m = useState('Operativo'), fNivel = _m[0], setFNivel = _m[1]
  var _n = useState([]), fConocimientos = _n[0], setFConocimientos = _n[1]
  var _o = useState([]), fHabilidades = _o[0], setFHabilidades = _o[1]
  var _p = useState([]), fExperiencia = _p[0], setFExperiencia = _p[1]
  var _q = useState(0), fAnios = _q[0], setFAnios = _q[1]
  var _r = useState([]), fCerts = _r[0], setFCerts = _r[1]

  useEffect(function() { cargar() }, [])

  function cargar() {
    setLoading(true)
    Promise.all([
      supabase.from('puestos').select('*').eq('empresa_id', empresa.id).order('nombre'),
      supabase.from('puesto_relaciones').select('*').eq('empresa_id', empresa.id),
      supabase.from('cursos').select('id, nombre, duracion').eq('activo', true).order('nombre'),
      supabase.from('puesto_cursos').select('*').eq('empresa_id', empresa.id),
      supabase.from('diagnostico_empleado').select('*').eq('empresa_id', empresa.id),
      supabase.from('participantes').select('id, nombre').eq('empresa_id', empresa.id),
    ]).then(function(res) {
      setPuestos((res[0].data) || [])
      setRelaciones((res[1].data) || [])
      setCursosCat((res[2].data) || [])
      setPuestoCursos((res[3].data) || [])
      setDiagnosticos((res[4].data) || [])
      setEmpleados((res[5].data) || [])
      setLoading(false)
    }).catch(function() { setLoading(false) })
  }

  function resetForm() { setFNombre(''); setFArea(''); setFNivel('Operativo'); setFConocimientos([]); setFHabilidades([]); setFExperiencia([]); setFAnios(0); setFCerts([]) }
  function abrirNuevo() { resetForm(); setTabForm('datos'); setModal({ tipo: 'nuevo' }) }
  function abrirEditar(p) {
    setFNombre(p.nombre||''); setFArea(p.area||''); setFNivel(p.nivel||'Operativo')
    setFConocimientos(parseList(p.conocimientos)); setFHabilidades(parseList(p.habilidades))
    setFExperiencia(parseList(p.experiencia)); setFAnios(p.experiencia_anios||0); setFCerts(parseList(p.certificaciones))
    setTabForm('datos'); setModal({ tipo: 'editar', id: p.id })
  }

  function guardarPuesto() {
    if (!fNombre.trim()) { alert('Escribe el nombre del puesto.'); return }
    var payload = { empresa_id: empresa.id, nombre: fNombre.trim(), area: fArea.trim(), nivel: fNivel, conocimientos: JSON.stringify(fConocimientos), habilidades: JSON.stringify(fHabilidades), experiencia: JSON.stringify(fExperiencia), experiencia_anios: Number(fAnios)||0, certificaciones: JSON.stringify(fCerts) }
    var prom = modal.tipo === 'nuevo' ? supabase.from('puestos').insert(payload) : supabase.from('puestos').update(payload).eq('id', modal.id)
    prom.then(function(r) { if(r.error){alert('Error: '+r.error.message);return}; setModal(null); cargar() })
  }

  function exportarExcelPuestos() {
    if (!puestos.length) { alert('No hay puestos.'); return }
    var filas = puestos.map(function(p) { return { Nombre: p.nombre, Area: p.area, Nivel: p.nivel, Conocimientos: parseList(p.conocimientos).join(', '), Habilidades: parseList(p.habilidades).join(', '), Experiencia: parseList(p.experiencia).join(', '), Anios: p.experiencia_anios, Certificaciones: parseList(p.certificaciones).join(', ') } })
    var ws = XLSX.utils.json_to_sheet(filas); var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Puestos')
    XLSX.writeFile(wb, 'puestos_' + new Date().toISOString().slice(0,10) + '.xlsx')
  }

  function importarExcelPuestos(file) {
    if (!file) return
    var reader = new FileReader()
    reader.onload = function(e) {
      var wb = XLSX.read(e.target.result, { type: 'array' })
      var filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      var creados = 0, chain = Promise.resolve()
      filas.forEach(function(f) {
        var nombre = String(f.Nombre || f.nombre || '').trim()
        if (!nombre) return
        chain = chain.then(function() {
          return supabase.from('puestos').insert({
            empresa_id: empresa.id, nombre: nombre, area: String(f.Area || f.area || '').trim(),
            nivel: String(f.Nivel || f.nivel || 'Operativo').trim(),
            conocimientos: JSON.stringify(String(f.Conocimientos || f.conocimientos || '').split(',').map(function(s){return s.trim()}).filter(Boolean)),
            habilidades: JSON.stringify(String(f.Habilidades || f.habilidades || '').split(',').map(function(s){return s.trim()}).filter(Boolean)),
            experiencia: JSON.stringify(String(f.Experiencia || f.experiencia || '').split(',').map(function(s){return s.trim()}).filter(Boolean)),
            experiencia_anios: Number(f.Anios || f.anios || 0) || 0,
            certificaciones: JSON.stringify(String(f.Certificaciones || f.certificaciones || '').split(',').map(function(s){return s.trim()}).filter(Boolean)),
          }).then(function(r) { if(!r.error) creados++ })
        })
      })
      chain.then(function() { cargar(); alert('✅ Puestos importados: ' + creados) })
    }
    reader.readAsArrayBuffer(file)
  }

  function eliminarPuesto(p) {
    if (!window.confirm('¿Eliminar "'+p.nombre+'"?')) return
    supabase.from('puesto_relaciones').delete().or('puesto_id.eq.'+p.id+',puesto_padre_id.eq.'+p.id).then(function(){})
    supabase.from('puesto_cursos').delete().eq('puesto_id', p.id).then(function(){})
    supabase.from('diagnostico_empleado').delete().eq('puesto_id', p.id).then(function(){})
    supabase.from('puestos').delete().eq('id', p.id).then(function(){ cargar() })
  }

  function agregarRelacion() {
    var h = document.getElementById('rel-hijo')
    var p = document.getElementById('rel-padre')
    if(!h||!p||!h.value||!p.value||h.value===p.value) return
    if(relaciones.find(function(r){return r.puesto_id===h.value && r.puesto_padre_id===p.value})) return
    supabase.from('puesto_relaciones').insert({ empresa_id: empresa.id, puesto_id: h.value, puesto_padre_id: p.value, tipo: 'reporta' }).then(function(){ cargar() })
  }
  function quitarRelacion(id) { supabase.from('puesto_relaciones').delete().eq('id', id).then(function(){ cargar() }) }

  function toggleCurso(puestoId, curso) {
    var existe = puestoCursos.find(function(pc){return pc.puesto_id===puestoId && pc.curso_id===curso.id})
    if (existe) { supabase.from('puesto_cursos').delete().eq('id', existe.id).then(function(){ cargar() }) }
    else { supabase.from('puesto_cursos').insert({ empresa_id: empresa.id, puesto_id: puestoId, curso_id: curso.id, curso_nombre: curso.nombre }).then(function(){ cargar() }) }
  }
  function toggleCapacitado(puestoId, emp, curso) {
    var existe = diagnosticos.find(function(d){return d.puesto_id===puestoId && d.empleado_id===emp.id && d.curso_id===curso.id})
    if (existe) { supabase.from('diagnostico_empleado').update({ capacitado: !existe.capacitado }).eq('id', existe.id).then(function(){ cargar() }) }
    else { supabase.from('diagnostico_empleado').insert({ empresa_id: empresa.id, puesto_id: puestoId, empleado_id: emp.id, empleado_nombre: emp.nombre, curso_id: curso.id, curso_nombre: curso.nombre, capacitado: true }).then(function(){ cargar() }) }
  }

  function imprimirOrganigrama() {
    function buildTree(puesto, depth) {
      var hijos = relaciones.filter(function(r){return r.puesto_padre_id===puesto.id}).map(function(r){return puestos.find(function(p){return p.id===r.puesto_id})}).filter(Boolean)
      var html = '<div style="margin-left:'+depth*40+'px;margin-bottom:8px;"><div style="display:inline-block;background:'+(depth===0?'#8B1A1A':'#fff')+';color:'+(depth===0?'#fff':'#1e293b')+';border:2px solid #8B1A1A;border-radius:10px;padding:10px 18px;font-weight:700;font-size:13px;">'+puesto.nombre+'<div style="font-size:10px;font-weight:400;color:'+(depth===0?'#f9d0d0':'#64748b')+'">'+( puesto.area||'')+' · '+(puesto.nivel||'')+'</div></div></div>'
      hijos.forEach(function(h){ html += buildTree(h, depth+1) })
      return html
    }
    var raices = puestos.filter(function(p){return !relaciones.find(function(r){return r.puesto_id===p.id})})
    var body = ''; (raices.length ? raices : puestos).forEach(function(p){ body += buildTree(p, 0) })
    var w = window.open('','_blank')
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Organigrama</title><style>@page{size:landscape;margin:15mm}body{font-family:Segoe UI,sans-serif;padding:20px}</style></head><body><h1 style="color:#8B1A1A">Organigrama — '+empresa.nombre+'</h1><h2 style="color:#64748b;font-size:14px;font-weight:400">'+new Date().toLocaleDateString('es-MX')+'</h2>'+(body||'<p>No hay puestos.</p>')+'<script>window.onload=function(){window.print()}<\/script></body></html>')
    w.document.close()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando puestos...</div>

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>Define los puestos, diagnostica capacitación y construye tu organigrama.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['puestos','📋 Puestos ('+puestos.length+')'],['diagnostico','🎯 Diagnóstico'],['organigrama','🏗 Organigrama']].map(function(t){
          return <button key={t[0]} onClick={function(){setVista(t[0])}} style={{ padding:'9px 18px', borderRadius:10, border:'1px solid '+(vista===t[0]?'#8B1A1A':'#e2e8f0'), background:vista===t[0]?'#8B1A1A':'#fff', color:vista===t[0]?'#fff':'#475569', fontSize:13, fontWeight:600, cursor:'pointer' }}>{t[1]}</button>
        })}
      </div>

      {vista === 'puestos' && <div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14, gap:8, flexWrap:'wrap' }}>
          <button onClick={exportarExcelPuestos} style={{ background:'#fff', color:'#059669', border:'1px solid #a7f3d0', borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>⬇️ Excel</button>
          <label style={{ background:'#fff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>⬆️ Importar Excel<input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={function(e){importarExcelPuestos(e.target.files[0]);e.target.value=''}} /></label>
          <button onClick={abrirNuevo} style={BTN}>+ Agregar puesto</button>
        </div>
        {puestos.length === 0 ? <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:40, textAlign:'center', color:'#94a3b8' }}>Aún no has definido puestos.</div> :
          <div style={{ display:'grid', gap:10 }}>{puestos.map(function(p){
            var con = parseList(p.conocimientos), hab = parseList(p.habilidades)
            return <div key={p.id} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, color:'#1e293b', fontSize:15 }}>{p.nombre}</div>
                <div style={{ color:'#64748b', fontSize:12, marginTop:2 }}>{p.area||'Sin área'} · {p.nivel||'Operativo'}</div>
                {con.length > 0 && <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>{con.map(function(c,i){return <span key={i} style={CHIP}>📚 {c}</span>})}</div>}
                {hab.length > 0 && <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>{hab.map(function(h,i){return <span key={i} style={Object.assign({},CHIP,{background:'#eff6ff',color:'#1d4ed8',borderColor:'#bfdbfe'})}>🛠 {h}</span>})}</div>}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={function(){abrirEditar(p)}} style={BTN2}>✏️</button>
                <button onClick={function(){eliminarPuesto(p)}} style={Object.assign({},BTN2,{color:'#dc2626',borderColor:'#fecaca'})}>🗑</button>
              </div>
            </div>
          })}</div>
        }
      </div>}

      {vista === 'diagnostico' && <div>
        {puestos.length === 0 ? <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:40, textAlign:'center', color:'#94a3b8' }}>Primero define tus puestos.</div> :
          puestos.map(function(puesto){
            var curs = puestoCursos.filter(function(pc){return pc.puesto_id===puesto.id})
            return <div key={puesto.id} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
              <div style={{ fontWeight:800, color:'#8B1A1A', fontSize:15, marginBottom:10 }}>🎯 {puesto.nombre}</div>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Cursos requeridos:</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                {cursosCat.map(function(c){ var act=curs.find(function(pc){return pc.curso_id===c.id}); return <button key={c.id} onClick={function(){toggleCurso(puesto.id,c)}} style={{ padding:'5px 12px', borderRadius:20, border:'1px solid '+(act?'#059669':'#e2e8f0'), background:act?'#f0fdf4':'#fff', color:act?'#059669':'#475569', fontSize:11, fontWeight:act?700:400, cursor:'pointer' }}>{act?'✓ ':''}{c.nombre}</button> })}
              </div>
              {curs.length > 0 && empleados.length > 0 && <div>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Estado:</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead><tr style={{ background:'#f8f9fb' }}><th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e2e8f0', fontSize:11 }}>Empleado</th>{curs.map(function(pc){return <th key={pc.id} style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e2e8f0', fontSize:11 }}>{pc.curso_nombre}</th>})}</tr></thead>
                    <tbody>{empleados.map(function(emp){return <tr key={emp.id}><td style={{ padding:'8px 10px', borderBottom:'1px solid #f1f5f9' }}>{emp.nombre}</td>{curs.map(function(pc){ var d=diagnosticos.find(function(x){return x.puesto_id===puesto.id&&x.empleado_id===emp.id&&x.curso_id===pc.curso_id}); return <td key={pc.id} style={{ padding:'8px 10px', borderBottom:'1px solid #f1f5f9', textAlign:'center' }}><button onClick={function(){toggleCapacitado(puesto.id,emp,{id:pc.curso_id,nombre:pc.curso_nombre})}} style={{ background:d&&d.capacitado?'#f0fdf4':'#fef2f2', color:d&&d.capacitado?'#059669':'#dc2626', border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontWeight:700 }}>{d&&d.capacitado?'✓ Sí':'✗ No'}</button></td> })}</tr>})}</tbody>
                  </table>
                </div>
              </div>}
            </div>
          })
        }
      </div>}

      {vista === 'organigrama' && <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
          <p style={{ color:'#64748b', fontSize:13 }}>Define quién reporta a quién.</p>
          <button onClick={imprimirOrganigrama} style={BTN}>📄 Imprimir PDF</button>
        </div>
        {puestos.length < 2 ? <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:40, textAlign:'center', color:'#94a3b8' }}>Necesitas al menos 2 puestos.</div> : <div>
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <select id="rel-hijo" style={INP}><option value="">— Puesto —</option>{puestos.map(function(p){return <option key={p.id} value={p.id}>{p.nombre}</option>})}</select>
              <span style={{ color:'#64748b', fontSize:13 }}>reporta a →</span>
              <select id="rel-padre" style={INP}><option value="">— Superior —</option>{puestos.map(function(p){return <option key={p.id} value={p.id}>{p.nombre}</option>})}</select>
              <button onClick={agregarRelacion} style={BTN}>Conectar</button>
            </div>
          </div>
          {relaciones.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {relaciones.map(function(r){ var h=puestos.find(function(p){return p.id===r.puesto_id}); var pa=puestos.find(function(p){return p.id===r.puesto_padre_id}); return h&&pa ? <span key={r.id} style={{ background:'#f8f9fb', border:'1px solid #e2e8f0', borderRadius:8, padding:'4px 10px', fontSize:11, display:'inline-flex', alignItems:'center', gap:4 }}>{h.nombre} → {pa.nombre} <button onClick={function(){quitarRelacion(r.id)}} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:12, padding:0 }}>×</button></span> : null })}
          </div>}
        </div>}
      </div>}

      {modal && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={function(){setModal(null)}}>
        <div style={{ background:'#fff', borderRadius:16, padding:'24px', width:'min(520px,94vw)', maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.15)' }} onClick={function(e){e.stopPropagation()}}>
          <h3 style={{ fontSize:18, fontWeight:800, color:'#1e293b', marginBottom:16 }}>{modal.tipo==='nuevo' ? '+ Agregar puesto' : '✏️ Editar puesto'}</h3>
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            {[['datos','📋 Datos'],['conocimientos','📚 Conocimientos'],['habilidades','🛠 Habilidades'],['experiencia','🎓 Experiencia']].map(function(t){
              return <button key={t[0]} onClick={function(){setTabForm(t[0])}} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid '+(tabForm===t[0]?'#8B1A1A':'#e2e8f0'), background:tabForm===t[0]?'#8B1A1A':'#fff', color:tabForm===t[0]?'#fff':'#475569', fontSize:12, fontWeight:600, cursor:'pointer' }}>{t[1]}</button>
            })}
          </div>

          {tabForm === 'datos' && <div>
            <label style={LBL}>Nombre del puesto *</label>
            <input value={fNombre} onChange={function(e){setFNombre(e.target.value)}} placeholder="Ej: Gerente de Calidad" style={INP} />
            <label style={LBL}>Área / Departamento</label>
            <input value={fArea} onChange={function(e){setFArea(e.target.value)}} placeholder="Ej: Calidad" style={INP} />
            <label style={LBL}>Jefatura</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {NIVELES.map(function(n){ return <button key={n} type="button" onClick={function(){setFNivel(n)}} style={{ padding:'7px 14px', borderRadius:8, border:'2px solid '+(fNivel===n?'#8B1A1A':'#e2e8f0'), background:fNivel===n?'#f9f0f0':'#fff', color:fNivel===n?'#8B1A1A':'#475569', fontSize:12, fontWeight:600, cursor:'pointer' }}>{n}</button> })}
            </div>
          </div>}

          {tabForm === 'conocimientos' && <div>
            <label style={LBL}>Conocimientos requeridos</label>
            <p style={{ color:'#94a3b8', fontSize:11, marginBottom:8 }}>Agrega uno por uno.</p>
            <ListaDinamica items={fConocimientos} onChange={setFConocimientos} placeholder="Ej: Normas ISO 9001" boton="Agregar conocimiento" />
          </div>}

          {tabForm === 'habilidades' && <div>
            <label style={LBL}>Habilidades requeridas</label>
            <p style={{ color:'#94a3b8', fontSize:11, marginBottom:8 }}>Agrega una por una.</p>
            <ListaDinamica items={fHabilidades} onChange={setFHabilidades} placeholder="Ej: Auditorías internas" boton="Agregar habilidad" />
          </div>}

          {tabForm === 'experiencia' && <div>
            <label style={LBL}>Años de experiencia mínimos</label>
            <input type="number" min="0" value={fAnios} onChange={function(e){setFAnios(e.target.value)}} style={Object.assign({},INP,{width:120})} />
            <label style={LBL}>Experiencia requerida</label>
            <ListaDinamica items={fExperiencia} onChange={setFExperiencia} placeholder="Ej: 3 años en automotriz" boton="Agregar experiencia" />
            <label style={Object.assign({},LBL,{marginTop:16})}>Certificaciones previas</label>
            <ListaDinamica items={fCerts} onChange={setFCerts} placeholder="Ej: Green Belt Six Sigma" boton="Agregar certificación" />
          </div>}

          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            <button onClick={guardarPuesto} style={BTN}>💾 Guardar puesto</button>
            <button onClick={function(){setModal(null)}} style={Object.assign({},BTN2,{padding:'9px 20px'})}>Cancelar</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
