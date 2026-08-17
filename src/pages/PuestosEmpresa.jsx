import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

var BTN = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
var BTN2 = { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }
var INP = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
var LBL = { display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 4, marginTop: 12 }
var CHIP = { background: '#f9f0f0', color: '#8B1A1A', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', fontSize: 11 }

var NIVELES_DEFAULT = ['Dirección', 'Gerencia', 'Jefatura', 'Coordinación', 'Supervisión', 'Operativo']
var CURSOS_DEFAULT = [
  'Sistemas de Gestión de Calidad (ISO 9001)',
  'Sistemas de Gestión Ambiental (ISO 14001)',
  'Seguridad y Salud en el Trabajo (ISO 45001)',
  'Core Tools (APQP, PPAP, AMEF, SPC, MSA)',
  'Auditorías Internas',
  'Control de Documentos y Registros',
  'Análisis de Causa Raíz',
  'Metodología 5S',
  'Lean Manufacturing',
  'Six Sigma (Green Belt / Black Belt)',
  'Metrología y Calibración',
  'Seguridad Industrial y Prevención de Riesgos',
  'Manejo de Materiales Peligrosos',
  'Buenas Prácticas de Manufactura (BPM)',
  'IATF 16949 (Automotriz)',
]

function parseList(t) { try { var r = JSON.parse(t); return Array.isArray(r) ? r : [] } catch(e) { return t ? String(t).split('\n').filter(Boolean) : [] } }

function ListaDinamica(props) {
  var items = props.items, onChange = props.onChange, placeholder = props.placeholder, boton = props.boton
  var s = useState(''), val = s[0], setVal = s[1]
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
          return <span key={i} style={{ background: '#f8f9fb', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {item}
            <button type="button" onClick={function(){ onChange(items.filter(function(x,j){return j!==i})) }}
              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
          </span>
        })}
      </div>
    </div>
  )
}

export default function PuestosEmpresa(props) {
  var empresa = props.empresa
  var s1=useState([]),puestos=s1[0],setPuestos=s1[1]
  var s2=useState([]),relaciones=s2[0],setRelaciones=s2[1]
  var s3=useState([]),cursosCat=s3[0],setCursosCat=s3[1]
  var s4=useState([]),puestoCursos=s4[0],setPuestoCursos=s4[1]
  var s5=useState([]),diagnosticos=s5[0],setDiagnosticos=s5[1]
  var s6=useState([]),empleados=s6[0],setEmpleados=s6[1]
  var s7=useState(true),loading=s7[0],setLoading=s7[1]
  var s8=useState('puestos'),vista=s8[0],setVista=s8[1]
  var s9=useState(null),modal=s9[0],setModal=s9[1]
  var s10=useState('datos'),tabForm=s10[0],setTabForm=s10[1]
  var s11=useState(NIVELES_DEFAULT),niveles=s11[0],setNiveles=s11[1]

  var s20=useState(''),fNombre=s20[0],setFNombre=s20[1]
  var s21=useState(''),fArea=s21[0],setFArea=s21[1]
  var s22=useState('Operativo'),fNivel=s22[0],setFNivel=s22[1]
  var s23=useState([]),fConocimientos=s23[0],setFConocimientos=s23[1]
  var s24=useState([]),fHabilidades=s24[0],setFHabilidades=s24[1]
  var s25=useState([]),fExperiencia=s25[0],setFExperiencia=s25[1]
  var s26=useState(0),fAnios=s26[0],setFAnios=s26[1]
  var s27=useState([]),fCerts=s27[0],setFCerts=s27[1]
  var s28=useState(''),nuevoNivel=s28[0],setNuevoNivel=s28[1]

  useEffect(function(){ cargar() }, [])

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
      setPuestos(res[0].data||[]); setRelaciones(res[1].data||[]); setCursosCat(res[2].data||[])
      setPuestoCursos(res[3].data||[]); setDiagnosticos(res[4].data||[]); setEmpleados(res[5].data||[])
      setLoading(false)
    }).catch(function(){ setLoading(false) })
  }

  function resetForm(){ setFNombre('');setFArea('');setFNivel('Operativo');setFConocimientos([]);setFHabilidades([]);setFExperiencia([]);setFAnios(0);setFCerts([]) }
  function abrirNuevo(){ resetForm();setTabForm('datos');setModal({tipo:'nuevo'}) }
  function abrirEditar(p){
    setFNombre(p.nombre||'');setFArea(p.area||'');setFNivel(p.nivel||'Operativo')
    setFConocimientos(parseList(p.conocimientos));setFHabilidades(parseList(p.habilidades))
    setFExperiencia(parseList(p.experiencia));setFAnios(p.experiencia_anios||0);setFCerts(parseList(p.certificaciones))
    setTabForm('datos');setModal({tipo:'editar',id:p.id})
  }
  function guardarPuesto(){
    if(!fNombre.trim()){alert('Escribe el nombre del puesto.');return}
    var payload={empresa_id:empresa.id,nombre:fNombre.trim(),area:fArea.trim(),nivel:fNivel,conocimientos:JSON.stringify(fConocimientos),habilidades:JSON.stringify(fHabilidades),experiencia:JSON.stringify(fExperiencia),experiencia_anios:Number(fAnios)||0,certificaciones:JSON.stringify(fCerts)}
    var prom=modal.tipo==='nuevo'?supabase.from('puestos').insert(payload):supabase.from('puestos').update(payload).eq('id',modal.id)
    prom.then(function(r){if(r.error){alert('Error: '+r.error.message);return};setModal(null);cargar()})
  }
  function eliminarPuesto(p){
    if(!window.confirm('¿Eliminar "'+p.nombre+'"?'))return
    supabase.from('puesto_relaciones').delete().or('puesto_id.eq.'+p.id+',puesto_padre_id.eq.'+p.id).then(function(){})
    supabase.from('puesto_cursos').delete().eq('puesto_id',p.id).then(function(){})
    supabase.from('diagnostico_empleado').delete().eq('puesto_id',p.id).then(function(){})
    supabase.from('puestos').delete().eq('id',p.id).then(function(){cargar()})
  }
  function agregarNivelCustom(){
    if(!nuevoNivel.trim())return
    if(!niveles.includes(nuevoNivel.trim())){setNiveles(function(p){return[].concat(p,[nuevoNivel.trim()])})}
    setFNivel(nuevoNivel.trim());setNuevoNivel('')
  }

  // Relaciones
  function agregarRelacion(){
    var h=document.getElementById('rel-hijo'),p=document.getElementById('rel-padre')
    if(!h||!p||!h.value||!p.value||h.value===p.value)return
    if(relaciones.find(function(r){return r.puesto_id===h.value&&r.puesto_padre_id===p.value}))return
    supabase.from('puesto_relaciones').insert({empresa_id:empresa.id,puesto_id:h.value,puesto_padre_id:p.value,tipo:'reporta'}).then(function(){cargar()})
  }
  function quitarRelacion(id){supabase.from('puesto_relaciones').delete().eq('id',id).then(function(){cargar()})}

  // Diagnóstico
  function toggleCurso(pid,curso){
    var existe=puestoCursos.find(function(pc){return pc.puesto_id===pid&&pc.curso_id===curso.id})
    if(existe){supabase.from('puesto_cursos').delete().eq('id',existe.id).then(function(){cargar()})}
    else{supabase.from('puesto_cursos').insert({empresa_id:empresa.id,puesto_id:pid,curso_id:curso.id,curso_nombre:curso.nombre}).then(function(){cargar()})}
  }
  function toggleCursoManual(pid,nombre){
    var existe=puestoCursos.find(function(pc){return pc.puesto_id===pid&&pc.curso_nombre===nombre})
    if(existe){supabase.from('puesto_cursos').delete().eq('id',existe.id).then(function(){cargar()})}
    else{supabase.from('puesto_cursos').insert({empresa_id:empresa.id,puesto_id:pid,curso_nombre:nombre}).then(function(){cargar()})}
  }
  function toggleCapacitado(pid,emp,curso){
    var existe=diagnosticos.find(function(d){return d.puesto_id===pid&&d.empleado_id===emp.id&&d.curso_id===(curso.id||null)&&d.curso_nombre===curso.nombre})
    if(existe){supabase.from('diagnostico_empleado').update({capacitado:!existe.capacitado}).eq('id',existe.id).then(function(){cargar()})}
    else{supabase.from('diagnostico_empleado').insert({empresa_id:empresa.id,puesto_id:pid,empleado_id:emp.id,empleado_nombre:emp.nombre,curso_id:curso.id||null,curso_nombre:curso.nombre,capacitado:true}).then(function(){cargar()})}
  }

  // Excel
  function exportarExcel(){
    if(!puestos.length){alert('No hay puestos.');return}
    var filas=puestos.map(function(p){return{Nombre:p.nombre,Area:p.area,Nivel:p.nivel,Conocimientos:parseList(p.conocimientos).join(', '),Habilidades:parseList(p.habilidades).join(', '),Experiencia:parseList(p.experiencia).join(', '),Anios:p.experiencia_anios,Certificaciones:parseList(p.certificaciones).join(', ')}})
    var ws=XLSX.utils.json_to_sheet(filas);var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Puestos')
    XLSX.writeFile(wb,'puestos_'+new Date().toISOString().slice(0,10)+'.xlsx')
  }
  function importarExcel(file){
    if(!file)return;var reader=new FileReader()
    reader.onload=function(e){var wb=XLSX.read(e.target.result,{type:'array'});var filas=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});var n=0,chain=Promise.resolve()
      filas.forEach(function(f){var nom=String(f.Nombre||f.nombre||'').trim();if(!nom)return;chain=chain.then(function(){return supabase.from('puestos').insert({empresa_id:empresa.id,nombre:nom,area:String(f.Area||f.area||'').trim(),nivel:String(f.Nivel||f.nivel||'Operativo').trim(),conocimientos:JSON.stringify(String(f.Conocimientos||'').split(',').map(function(s){return s.trim()}).filter(Boolean)),habilidades:JSON.stringify(String(f.Habilidades||'').split(',').map(function(s){return s.trim()}).filter(Boolean)),experiencia:JSON.stringify(String(f.Experiencia||'').split(',').map(function(s){return s.trim()}).filter(Boolean)),experiencia_anios:Number(f.Anios||0)||0,certificaciones:JSON.stringify(String(f.Certificaciones||'').split(',').map(function(s){return s.trim()}).filter(Boolean))}).then(function(r){if(!r.error)n++})})})
      chain.then(function(){cargar();alert('✅ Puestos importados: '+n)})}
    reader.readAsArrayBuffer(file)
  }

  // Organigrama PDF
  function imprimirOrganigrama(){
    function buildNode(p,depth){
      var hijos=relaciones.filter(function(r){return r.puesto_padre_id===p.id}).map(function(r){return puestos.find(function(x){return x.id===r.puesto_id})}).filter(Boolean)
      var bg=depth===0?'#8B1A1A':'#fff',fg=depth===0?'#fff':'#1e293b',fg2=depth===0?'#f9d0d0':'#64748b'
      var html='<div style="margin-left:'+depth*40+'px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">'
      if(depth>0)html+='<div style="width:20px;border-top:2px solid #8B1A1A;"></div>'
      html+='<div style="display:inline-block;background:'+bg+';color:'+fg+';border:2px solid #8B1A1A;border-radius:12px;padding:12px 20px;min-width:160px;"><div style="font-weight:700;font-size:14px;">'+p.nombre+'</div><div style="font-size:11px;color:'+fg2+';">'+(p.area||'')+' · '+(p.nivel||'')+'</div></div></div>'
      hijos.forEach(function(h){html+=buildNode(h,depth+1)})
      return html
    }
    var raices=puestos.filter(function(p){return !relaciones.find(function(r){return r.puesto_id===p.id})})
    var sinConexion=puestos.filter(function(p){return !relaciones.find(function(r){return r.puesto_id===p.id})&&!relaciones.find(function(r){return r.puesto_padre_id===p.id})})
    var conHijos=raices.filter(function(p){return relaciones.find(function(r){return r.puesto_padre_id===p.id})})
    var body='';(conHijos.length?conHijos:raices).forEach(function(p){body+=buildNode(p,0)})
    if(sinConexion.length>0&&conHijos.length>0){body+='<h3 style="color:#64748b;font-size:13px;margin-top:20px;">Sin conexión:</h3>';sinConexion.forEach(function(p){body+=buildNode(p,0)})}
    var w=window.open('','_blank')
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Organigrama</title><style>@page{size:landscape;margin:15mm}body{font-family:Segoe UI,sans-serif;padding:24px}</style></head><body><h1 style="color:#8B1A1A;font-size:24px;">Organigrama — '+empresa.nombre+'</h1><p style="color:#64748b;font-size:13px;margin-bottom:20px;">'+new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})+'</p>'+(body||'<p style="color:#94a3b8;">No hay puestos.</p>')+'<div style="margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center;font-size:10px;color:#94a3b8;">Hablando con Datos — Consultoría y Capacitación</div><script>window.onload=function(){window.print()}<\/script></body></html>')
    w.document.close()
  }

  if(loading)return <div style={{color:'#64748b',padding:40,textAlign:'center'}}>Cargando...</div>

  return (
    <div>
      <p style={{color:'#64748b',fontSize:14,marginBottom:16}}>Define puestos, diagnostica capacitación y construye tu organigrama.</p>
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {[['puestos','📋 Puestos ('+puestos.length+')'],['diagnostico','🎯 Diagnóstico'],['organigrama','🏗 Organigrama']].map(function(t){
          return <button key={t[0]} onClick={function(){setVista(t[0])}} style={{padding:'9px 18px',borderRadius:10,border:'1px solid '+(vista===t[0]?'#8B1A1A':'#e2e8f0'),background:vista===t[0]?'#8B1A1A':'#fff',color:vista===t[0]?'#fff':'#475569',fontSize:13,fontWeight:600,cursor:'pointer'}}>{t[1]}</button>
        })}
      </div>

      {/* PUESTOS */}
      {vista==='puestos'&&<div>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14,gap:8,flexWrap:'wrap'}}>
          <button onClick={exportarExcel} style={{background:'#fff',color:'#059669',border:'1px solid #a7f3d0',borderRadius:8,padding:'9px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>⬇️ Excel</button>
          <label style={{background:'#fff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:8,padding:'9px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>⬆️ Importar<input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={function(e){importarExcel(e.target.files[0]);e.target.value=''}}/></label>
          <button onClick={abrirNuevo} style={BTN}>+ Agregar puesto</button>
        </div>
        {puestos.length===0?<div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:40,textAlign:'center',color:'#94a3b8'}}>Aún no hay puestos.</div>:
          <div style={{display:'grid',gap:10}}>{puestos.map(function(p){
            var con=parseList(p.conocimientos),hab=parseList(p.habilidades)
            return <div key={p.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,color:'#1e293b',fontSize:15}}>{p.nombre}</div>
                <div style={{color:'#64748b',fontSize:12,marginTop:2}}>{p.area||'Sin área'} · {p.nivel||'Operativo'}</div>
                {con.length>0&&<div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6}}>{con.map(function(c,i){return <span key={i} style={CHIP}>📚 {c}</span>})}</div>}
                {hab.length>0&&<div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>{hab.map(function(h,i){return <span key={i} style={Object.assign({},CHIP,{background:'#eff6ff',color:'#1d4ed8',borderColor:'#bfdbfe'})}>🛠 {h}</span>})}</div>}
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={function(){abrirEditar(p)}} style={BTN2}>✏️</button>
                <button onClick={function(){eliminarPuesto(p)}} style={Object.assign({},BTN2,{color:'#dc2626',borderColor:'#fecaca'})}>🗑</button>
              </div>
            </div>
          })}</div>}
      </div>}

      {/* DIAGNÓSTICO */}
      {vista==='diagnostico'&&<div>
        <p style={{color:'#64748b',fontSize:13,marginBottom:14}}>Marca los cursos requeridos por puesto. Incluye cursos industriales por defecto + los de tu catálogo HCD. Puedes agregar manualmente cualquier otro.</p>
        {puestos.length===0?<div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:40,textAlign:'center',color:'#94a3b8'}}>Primero define tus puestos.</div>:
          puestos.map(function(puesto){
            var curs=puestoCursos.filter(function(pc){return pc.puesto_id===puesto.id})
            var nuevoReqState=useState('');var nuevoReq=nuevoReqState[0],setNuevoReq=nuevoReqState[1]
            return <div key={puesto.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 18px',marginBottom:16}}>
              <div style={{fontWeight:800,color:'#8B1A1A',fontSize:15,marginBottom:10}}>🎯 {puesto.nombre}</div>

              {/* Cursos default industriales */}
              <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Cursos industriales sugeridos:</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                {CURSOS_DEFAULT.map(function(nombre){var act=curs.find(function(pc){return pc.curso_nombre===nombre});return <button key={nombre} onClick={function(){toggleCursoManual(puesto.id,nombre)}} style={{padding:'5px 12px',borderRadius:20,border:'1px solid '+(act?'#059669':'#e2e8f0'),background:act?'#f0fdf4':'#fff',color:act?'#059669':'#475569',fontSize:11,fontWeight:act?700:400,cursor:'pointer'}}>{act?'✓ ':''}{nombre}</button>})}
              </div>

              {/* Cursos HCD */}
              {cursosCat.length>0&&<div>
                <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Cursos HCD disponibles:</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                  {cursosCat.map(function(c){var act=curs.find(function(pc){return pc.curso_id===c.id});return <button key={c.id} onClick={function(){toggleCurso(puesto.id,c)}} style={{padding:'5px 12px',borderRadius:20,border:'1px solid '+(act?'#1d4ed8':'#e2e8f0'),background:act?'#eff6ff':'#fff',color:act?'#1d4ed8':'#475569',fontSize:11,fontWeight:act?700:400,cursor:'pointer'}}>{act?'✓ ':''}{c.nombre}</button>})}
                </div>
              </div>}

              {/* Agregar manual */}
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <input value={nuevoReq} onChange={function(e){setNuevoReq(e.target.value)}} placeholder="Agregar otro requisito (cualquier curso)" onKeyDown={function(e){if(e.key==='Enter'&&nuevoReq.trim()){toggleCursoManual(puesto.id,nuevoReq.trim());setNuevoReq('')}}} style={Object.assign({},INP,{flex:1})}/>
                <button onClick={function(){if(nuevoReq.trim()){toggleCursoManual(puesto.id,nuevoReq.trim());setNuevoReq('')}}} style={Object.assign({},BTN,{padding:'8px 14px',fontSize:12})}>+ Agregar</button>
              </div>

              {/* Tabla diagnóstico */}
              {curs.length>0&&empleados.length>0&&<div>
                <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Estado de capacitación:</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{background:'#f8f9fb'}}><th style={{padding:'8px 10px',textAlign:'left',borderBottom:'1px solid #e2e8f0',fontSize:11}}>Empleado</th>{curs.map(function(pc){return <th key={pc.id} style={{padding:'8px 10px',textAlign:'left',borderBottom:'1px solid #e2e8f0',fontSize:11}}>{pc.curso_nombre}</th>})}</tr></thead>
                    <tbody>{empleados.map(function(emp){return <tr key={emp.id}><td style={{padding:'8px 10px',borderBottom:'1px solid #f1f5f9'}}>{emp.nombre}</td>{curs.map(function(pc){var d=diagnosticos.find(function(x){return x.puesto_id===puesto.id&&x.empleado_id===emp.id&&x.curso_nombre===pc.curso_nombre});return <td key={pc.id} style={{padding:'8px 10px',borderBottom:'1px solid #f1f5f9',textAlign:'center'}}><button onClick={function(){toggleCapacitado(puesto.id,emp,{id:pc.curso_id,nombre:pc.curso_nombre})}} style={{background:d&&d.capacitado?'#f0fdf4':'#fef2f2',color:d&&d.capacitado?'#059669':'#dc2626',border:'none',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',fontWeight:700}}>{d&&d.capacitado?'✓ Sí':'✗ No'}</button></td>})}</tr>})}</tbody>
                  </table>
                </div>
                {(function(){var tot=curs.length*empleados.length;var cap=diagnosticos.filter(function(d){return d.puesto_id===puesto.id&&d.capacitado}).length;var pct=tot>0?Math.round(cap/tot*100):0;return <div style={{marginTop:10,background:'#f8f9fb',borderRadius:8,padding:'10px 14px',fontSize:12}}><strong>Cobertura:</strong> {cap}/{tot} ({pct}%) — {pct>=80?'🟢 Bien capacitado':pct>=50?'🟡 Necesita refuerzo':'🔴 Requiere capacitación'}</div>})()}
              </div>}
            </div>
          })
        }
      </div>}

      {/* ORGANIGRAMA */}
      {vista==='organigrama'&&<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
          <p style={{color:'#64748b',fontSize:13}}>Conecta puestos para construir tu organigrama.</p>
          <button onClick={imprimirOrganigrama} style={BTN}>📄 Imprimir PDF</button>
        </div>
        {puestos.length<2?<div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:40,textAlign:'center',color:'#94a3b8'}}>Necesitas al menos 2 puestos.</div>:<div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 18px',marginBottom:20}}>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <select id="rel-hijo" style={INP}><option value="">— Puesto —</option>{puestos.map(function(p){return <option key={p.id} value={p.id}>{p.nombre}</option>})}</select>
              <span style={{color:'#64748b',fontSize:13}}>reporta a →</span>
              <select id="rel-padre" style={INP}><option value="">— Superior —</option>{puestos.map(function(p){return <option key={p.id} value={p.id}>{p.nombre}</option>})}</select>
              <button onClick={agregarRelacion} style={BTN}>Conectar</button>
            </div>
          </div>

          {/* Árbol visual */}
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:20,marginBottom:14}}>
            {(function(){
              var raices=puestos.filter(function(p){return !relaciones.find(function(r){return r.puesto_id===p.id})})
              var conHijos=raices.filter(function(p){return relaciones.find(function(r){return r.puesto_padre_id===p.id})})
              var sinConexion=puestos.filter(function(p){return !relaciones.find(function(r){return r.puesto_id===p.id})&&!relaciones.find(function(r){return r.puesto_padre_id===p.id})})
              function Nodo(props2){var pu=props2.puesto,depth=props2.depth||0
                var hijos=relaciones.filter(function(r){return r.puesto_padre_id===pu.id}).map(function(r){return puestos.find(function(x){return x.id===r.puesto_id})}).filter(Boolean)
                return <div style={{marginLeft:depth*32,marginBottom:8}}>
                  <div style={{display:'inline-flex',alignItems:'center',gap:8,background:depth===0?'#8B1A1A':'#fff',color:depth===0?'#fff':'#1e293b',border:'2px solid #8B1A1A',borderRadius:10,padding:'8px 16px'}}>
                    <div><div style={{fontWeight:700,fontSize:13}}>{pu.nombre}</div><div style={{fontSize:10,color:depth===0?'#f9d0d0':'#64748b'}}>{pu.area||''} · {pu.nivel||''}</div></div>
                  </div>
                  {depth>0&&(function(){var rel=relaciones.find(function(r){return r.puesto_id===pu.id});return rel?<button onClick={function(){quitarRelacion(rel.id)}} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:10,marginLeft:4}}>×</button>:null})()}
                  {hijos.map(function(h){return <Nodo key={h.id} puesto={h} depth={depth+1}/>})}
                </div>
              }
              return <div>
                {conHijos.map(function(p){return <Nodo key={p.id} puesto={p} depth={0}/>})}
                {sinConexion.length>0&&conHijos.length>0&&<div style={{marginTop:16}}><div style={{color:'#94a3b8',fontSize:11,marginBottom:6}}>Sin conexión:</div>{sinConexion.map(function(p){return <Nodo key={p.id} puesto={p} depth={0}/>})}</div>}
                {conHijos.length===0&&sinConexion.length>0&&<div>{sinConexion.map(function(p){return <Nodo key={p.id} puesto={p} depth={0}/>})}</div>}
                {puestos.length===0&&<div style={{color:'#94a3b8'}}>No hay puestos.</div>}
              </div>
            })()}
          </div>

          {relaciones.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {relaciones.map(function(r){var h=puestos.find(function(p){return p.id===r.puesto_id});var pa=puestos.find(function(p){return p.id===r.puesto_padre_id});return h&&pa?<span key={r.id} style={{background:'#f8f9fb',border:'1px solid #e2e8f0',borderRadius:8,padding:'4px 10px',fontSize:11,display:'inline-flex',alignItems:'center',gap:4}}>{h.nombre} → {pa.nombre}<button onClick={function(){quitarRelacion(r.id)}} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:12,padding:0}}>×</button></span>:null})}
          </div>}
        </div>}
      </div>}

      {/* MODAL */}
      {modal&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={function(){setModal(null)}}>
        <div style={{background:'#fff',borderRadius:16,padding:'24px',width:'min(520px,94vw)',maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.15)'}} onClick={function(e){e.stopPropagation()}}>
          <h3 style={{fontSize:18,fontWeight:800,color:'#1e293b',marginBottom:16}}>{modal.tipo==='nuevo'?'+ Agregar puesto':'✏️ Editar puesto'}</h3>
          <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
            {[['datos','📋 Datos'],['conocimientos','📚 Conocimientos'],['habilidades','🛠 Habilidades'],['experiencia','🎓 Experiencia']].map(function(t){
              return <button key={t[0]} onClick={function(){setTabForm(t[0])}} style={{padding:'7px 14px',borderRadius:8,border:'1px solid '+(tabForm===t[0]?'#8B1A1A':'#e2e8f0'),background:tabForm===t[0]?'#8B1A1A':'#fff',color:tabForm===t[0]?'#fff':'#475569',fontSize:12,fontWeight:600,cursor:'pointer'}}>{t[1]}</button>
            })}
          </div>

          {tabForm==='datos'&&<div>
            <label style={LBL}>Nombre del puesto *</label>
            <input value={fNombre} onChange={function(e){setFNombre(e.target.value)}} placeholder="Ej: Gerente de Calidad" style={INP}/>
            <label style={LBL}>Área / Departamento</label>
            <input value={fArea} onChange={function(e){setFArea(e.target.value)}} placeholder="Ej: Calidad" style={INP}/>
            <label style={LBL}>Jefatura / Rango</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              {niveles.map(function(n){return <button key={n} type="button" onClick={function(){setFNivel(n)}} style={{padding:'7px 14px',borderRadius:8,border:'2px solid '+(fNivel===n?'#8B1A1A':'#e2e8f0'),background:fNivel===n?'#f9f0f0':'#fff',color:fNivel===n?'#8B1A1A':'#475569',fontSize:12,fontWeight:600,cursor:'pointer'}}>{n}</button>})}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input value={nuevoNivel} onChange={function(e){setNuevoNivel(e.target.value)}} placeholder="Agregar otro rango" onKeyDown={function(e){if(e.key==='Enter'){e.preventDefault();agregarNivelCustom()}}} style={Object.assign({},INP,{flex:1})}/>
              <button type="button" onClick={agregarNivelCustom} style={Object.assign({},BTN,{padding:'8px 14px',fontSize:12})}>+ Agregar</button>
            </div>
          </div>}

          {tabForm==='conocimientos'&&<div>
            <label style={LBL}>Conocimientos requeridos</label>
            <ListaDinamica items={fConocimientos} onChange={setFConocimientos} placeholder="Ej: Normas ISO 9001" boton="Agregar"/>
          </div>}
          {tabForm==='habilidades'&&<div>
            <label style={LBL}>Habilidades requeridas</label>
            <ListaDinamica items={fHabilidades} onChange={setFHabilidades} placeholder="Ej: Auditorías internas" boton="Agregar"/>
          </div>}
          {tabForm==='experiencia'&&<div>
            <label style={LBL}>Años mínimos</label>
            <input type="number" min="0" value={fAnios} onChange={function(e){setFAnios(e.target.value)}} style={Object.assign({},INP,{width:120})}/>
            <label style={LBL}>Experiencia</label>
            <ListaDinamica items={fExperiencia} onChange={setFExperiencia} placeholder="Ej: 3 años en automotriz" boton="Agregar"/>
            <label style={Object.assign({},LBL,{marginTop:16})}>Certificaciones</label>
            <ListaDinamica items={fCerts} onChange={setFCerts} placeholder="Ej: Green Belt" boton="Agregar"/>
          </div>}

          <div style={{display:'flex',gap:10,marginTop:20}}>
            <button onClick={guardarPuesto} style={BTN}>💾 Guardar puesto</button>
            <button onClick={function(){setModal(null)}} style={Object.assign({},BTN2,{padding:'9px 20px'})}>Cancelar</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
