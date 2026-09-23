import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

var BTN = { background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
var BTN2 = { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }
var INP = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
var LBL = { display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 4, marginTop: 12 }
var CHIP = { background: '#f9f0f0', color: '#8B1A1A', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', fontSize: 11 }

var NIVELES_DEFAULT = ['Dirección', 'Gerencia', 'Jefatura', 'Coordinación', 'Supervisión', 'Operativo']

// Cursos que aplican a CUALQUIER puesto, sin importar el área (piso mínimo industrial)
var CURSOS_GENERALES = [
  'Inducción a la empresa',
  'Seguridad y Salud en el Trabajo (ISO 45001)',
  'Metodología 5S',
  'Manejo de Materiales Peligrosos',
  'Plan de Emergencia y Evacuación',
]

// Cursos sugeridos según el área/departamento del puesto (gestión organizacional estándar de industria)
var AREAS_CURSOS = {
  'operaciones': ['Buenas Prácticas de Manufactura (BPM)', 'Lean Manufacturing', 'Control de Documentos y Registros', 'Metrología y Calibración', 'Análisis de Causa Raíz'],
  'produccion': ['Buenas Prácticas de Manufactura (BPM)', 'Lean Manufacturing', 'Control de Documentos y Registros', 'Metrología y Calibración', 'Análisis de Causa Raíz'],
  'calidad': ['Sistemas de Gestión de Calidad (ISO 9001)', 'Core Tools (APQP, PPAP, AMEF, SPC, MSA)', 'Auditorías Internas', 'IATF 16949 (Automotriz)', 'Six Sigma (Green Belt / Black Belt)'],
  'finanzas': ['Análisis Financiero', 'Control Presupuestal', 'Costos y Presupuestos', 'Normatividad Fiscal', 'Excel Avanzado para Finanzas'],
  'administracion': ['Análisis Financiero', 'Control Presupuestal', 'Excel Avanzado', 'Redacción de Documentos Ejecutivos'],
  'recursos humanos': ['Reclutamiento y Selección', 'Legislación Laboral', 'Desarrollo Organizacional', 'Clima Laboral', 'Capacitación de Capacitadores'],
  'rh': ['Reclutamiento y Selección', 'Legislación Laboral', 'Desarrollo Organizacional', 'Clima Laboral', 'Capacitación de Capacitadores'],
  'mantenimiento': ['Mantenimiento Preventivo y Predictivo', 'Seguridad Industrial y Prevención de Riesgos', 'Metrología y Calibración', 'Manejo de Materiales Peligrosos'],
  'logistica': ['Gestión de Almacenes e Inventarios', 'Manejo de Materiales Peligrosos', 'Optimización de Rutas y Distribución', 'Comercio Exterior'],
  'almacen': ['Gestión de Almacenes e Inventarios', 'Manejo de Materiales Peligrosos', 'Control de Inventarios'],
  'ventas': ['Técnicas de Venta Consultiva', 'Servicio al Cliente', 'Negociación Comercial'],
  'comercial': ['Técnicas de Venta Consultiva', 'Servicio al Cliente', 'Negociación Comercial'],
  'sistemas': ['Seguridad de la Información', 'Gestión de Proyectos de TI', 'Protección de Datos Personales'],
  'ti': ['Seguridad de la Información', 'Gestión de Proyectos de TI', 'Protección de Datos Personales'],
  'direccion': ['Sistemas de Gestión de Calidad (ISO 9001)', 'Liderazgo y Alta Dirección', 'Sistemas de Gestión Ambiental (ISO 14001)'],
  'gerencia general': ['Sistemas de Gestión de Calidad (ISO 9001)', 'Liderazgo y Alta Dirección', 'Sistemas de Gestión Ambiental (ISO 14001)'],
  'ambiental': ['Sistemas de Gestión Ambiental (ISO 14001)', 'Manejo de Residuos', 'Auditorías Internas'],
  'seguridad': ['Seguridad y Salud en el Trabajo (ISO 45001)', 'Seguridad Industrial y Prevención de Riesgos', 'Manejo de Materiales Peligrosos', 'Plan de Emergencia y Evacuación'],
}

// Sugiere cursos según el texto libre del área capturada en el puesto: matchea por palabra clave
// (sin acentos ni mayúsculas) y siempre agrega los generales que aplican a cualquier puesto.
function normalizarTexto(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}
function cursosSugeridosPorArea(area) {
  var a = normalizarTexto(area)
  var especificos = []
  if (a) {
    Object.keys(AREAS_CURSOS).forEach(function (clave) {
      if (a.indexOf(clave) !== -1 || clave.indexOf(a) !== -1) {
        AREAS_CURSOS[clave].forEach(function (c) { if (especificos.indexOf(c) === -1) especificos.push(c) })
      }
    })
  }
  var todos = especificos.concat(CURSOS_GENERALES.filter(function (c) { return especificos.indexOf(c) === -1 }))
  return todos
}

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
  var s12=useState({}),nuevoReqPorPuesto=s12[0],setNuevoReqPorPuesto=s12[1] // {puestoId: texto} - evita useState dentro de un .map
  var s13=useState([]),matriz=s13[0],setMatriz=s13[1]
  var s14=useState(null),modalSolicitar=s14[0],setModalSolicitar=s14[1] // {puesto,curso,empleados}

  var s20=useState(''),fNombre=s20[0],setFNombre=s20[1]
  var s21=useState(''),fArea=s21[0],setFArea=s21[1]
  var s22=useState('Operativo'),fNivel=s22[0],setFNivel=s22[1]
  var s23=useState([]),fConocimientos=s23[0],setFConocimientos=s23[1]
  var s24=useState([]),fHabilidades=s24[0],setFHabilidades=s24[1]
  var s25=useState([]),fExperiencia=s25[0],setFExperiencia=s25[1]
  var s26=useState(0),fAnios=s26[0],setFAnios=s26[1]
  var s27=useState([]),fCerts=s27[0],setFCerts=s27[1]
  var s28=useState(''),nuevoNivel=s28[0],setNuevoNivel=s28[1]
  var s29=useState(''),fReportaA=s29[0],setFReportaA=s29[1]
  var s30=useState('reporta'),fTipoRelacion=s30[0],setFTipoRelacion=s30[1]

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
      supabase.from('precios_categoria').select('*'),
    ]).then(function(res) {
      setPuestos(res[0].data||[]); setRelaciones(res[1].data||[]); setCursosCat(res[2].data||[])
      setPuestoCursos(res[3].data||[]); setDiagnosticos(res[4].data||[]); setEmpleados(res[5].data||[])
      setMatriz(res[6].data||[])
      setLoading(false)
    }).catch(function(){ setLoading(false) })
  }

  function resetForm(){ setFNombre('');setFArea('');setFNivel('Operativo');setFConocimientos([]);setFHabilidades([]);setFExperiencia([]);setFAnios(0);setFCerts([]);setFReportaA('');setFTipoRelacion('reporta') }
  function abrirNuevo(){ resetForm();setTabForm('datos');setModal({tipo:'nuevo'}) }
  function abrirEditar(p){
    setFNombre(p.nombre||'');setFArea(p.area||'');setFNivel(p.nivel||'Operativo')
    setFConocimientos(parseList(p.conocimientos));setFHabilidades(parseList(p.habilidades))
    setFExperiencia(parseList(p.experiencia));setFAnios(p.experiencia_anios||0);setFCerts(parseList(p.certificaciones))
    setFReportaA('');setFTipoRelacion('reporta')
    setTabForm('datos');setModal({tipo:'editar',id:p.id})
  }
  function guardarPuesto(){
    if(!fNombre.trim()){alert('Escribe el nombre del puesto.');return}
    var payload={empresa_id:empresa.id,nombre:fNombre.trim(),area:fArea.trim(),nivel:fNivel,conocimientos:JSON.stringify(fConocimientos),habilidades:JSON.stringify(fHabilidades),experiencia:JSON.stringify(fExperiencia),experiencia_anios:Number(fAnios)||0,certificaciones:JSON.stringify(fCerts)}
    if(modal.tipo==='nuevo'){
      supabase.from('puestos').insert(payload).select().single().then(function(r){
        if(r.error){alert('Error: '+r.error.message);return}
        var nuevoId=r.data&&r.data.id
        if(nuevoId&&fReportaA){
          supabase.from('puesto_relaciones').insert({empresa_id:empresa.id,puesto_id:nuevoId,puesto_padre_id:fReportaA,tipo:fTipoRelacion}).then(function(){setModal(null);cargar()})
        } else { setModal(null);cargar() }
      })
    } else {
      supabase.from('puestos').update(payload).eq('id',modal.id).then(function(r){if(r.error){alert('Error: '+r.error.message);return};setModal(null);cargar()})
    }
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
    var h=document.getElementById('rel-hijo'),p=document.getElementById('rel-padre'),t=document.getElementById('rel-tipo')
    if(!h||!p||!h.value||!p.value||h.value===p.value)return
    var tipo=(t&&t.value)||'reporta'
    if(relaciones.find(function(r){return r.puesto_id===h.value&&r.puesto_padre_id===p.value}))return
    supabase.from('puesto_relaciones').insert({empresa_id:empresa.id,puesto_id:h.value,puesto_padre_id:p.value,tipo:tipo}).then(function(){cargar()})
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
  // Oculta una sugerencia del área para este puesto (la empresa decide que no aplica y sube las suyas)
  function ocultarSugerido(puesto,nombre){
    if(!confirm('¿Quitar "'+nombre+'" de las sugerencias para este puesto? No se borra ningún requisito ya asignado, solo deja de sugerirse.'))return
    var actuales=parseList(puesto.sugeridos_ocultos)
    if(actuales.indexOf(nombre)!==-1)return
    var nuevos=actuales.concat([nombre])
    supabase.from('puestos').update({sugeridos_ocultos:JSON.stringify(nuevos)}).eq('id',puesto.id).then(function(r){if(r.error){alert('Error: '+r.error.message);return}cargar()})
  }
  function restaurarSugeridos(puesto){
    supabase.from('puestos').update({sugeridos_ocultos:JSON.stringify([])}).eq('id',puesto.id).then(function(r){if(r.error){alert('Error: '+r.error.message);return}cargar()})
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

  // Excel de CURSOS REQUERIDOS por puesto (Diagnóstico): columnas "Puesto" y "Curso"
  // (una fila por cada curso requerido; el puesto debe existir ya, por nombre)
  function exportarPlantillaCursos(){
    var filas=puestos.length?puestos.map(function(p){return{Puesto:p.nombre,Curso:''}}):[{Puesto:'Ej: Operador de línea',Curso:'Ej: Seguridad Industrial'}]
    var ws=XLSX.utils.json_to_sheet(filas);var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Cursos requeridos')
    XLSX.writeFile(wb,'plantilla_cursos_requeridos.xlsx')
  }
  function importarCursosExcel(file){
    if(!file)return;var reader=new FileReader()
    reader.onload=function(e){
      var wb=XLSX.read(e.target.result,{type:'array'});var filas=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})
      var n=0,noEncontrados=[],chain=Promise.resolve()
      filas.forEach(function(f){
        var nomPuesto=String(f.Puesto||f.puesto||'').trim(),nomCurso=String(f.Curso||f.curso||'').trim()
        if(!nomPuesto||!nomCurso)return
        var puesto=puestos.find(function(p){return normalizarTexto(p.nombre)===normalizarTexto(nomPuesto)})
        if(!puesto){if(noEncontrados.indexOf(nomPuesto)===-1)noEncontrados.push(nomPuesto);return}
        var yaExiste=puestoCursos.find(function(pc){return pc.puesto_id===puesto.id&&normalizarTexto(pc.curso_nombre)===normalizarTexto(nomCurso)})
        if(yaExiste)return
        var cursoCat=cursosCat.find(function(c){return normalizarTexto(c.nombre)===normalizarTexto(nomCurso)})
        chain=chain.then(function(){return supabase.from('puesto_cursos').insert({empresa_id:empresa.id,puesto_id:puesto.id,curso_id:cursoCat?cursoCat.id:null,curso_nombre:nomCurso}).then(function(r){if(!r.error)n++})})
      })
      chain.then(function(){
        cargar()
        var msg='✅ Cursos requeridos importados: '+n
        if(noEncontrados.length)msg+='\n⚠️ Puestos no encontrados (revisa el nombre exacto): '+noEncontrados.join(', ')
        alert(msg)
      })
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Ruta de capacitación: necesidades agregadas (curso → empleados sin marcar "capacitado") ──
  function necesidadesDePuesto(puesto){
    var curs=puestoCursos.filter(function(pc){return pc.puesto_id===puesto.id})
    return curs.map(function(pc){
      var faltantes=empleados.filter(function(emp){
        var d=diagnosticos.find(function(x){return x.puesto_id===puesto.id&&x.empleado_id===emp.id&&x.curso_nombre===pc.curso_nombre})
        return !(d&&d.capacitado)
      })
      return {puestoCurso:pc,faltantes:faltantes}
    }).filter(function(n){return n.faltantes.length>0})
  }
  function bloqueDePersonasPto(n){var num=Number(n)||0;if(num<=5)return'1-5';if(num<=10)return'6-10';if(num<=15)return'11-15';return'especial'}
  function tierDuracionPto(h){var horas=Number(h)||0;if(horas<=8)return'1';if(horas<=16)return'2';if(horas<=24)return'3';return'4'}
  function precioHoraPto(categoria,bloque,tier){var r=matriz.find(function(x){return x.categoria===(categoria||'B')&&x.bloque===bloque&&(x.duracion_tier||'1')===tier});return r?(Number(r.precio_hora)||0):0}
  function linkWhatsAppSolicitud(curso,empleadosSel){
    var nombres=empleadosSel.map(function(e){return e.nombre}).join(', ')
    var msg='Hola, soy de '+empresa.nombre+'. Quiero solicitar cotización del curso "'+curso.curso_nombre+'" para '+empleadosSel.length+' persona(s): '+nombres+'.'
    return 'https://wa.me/522223549353?text='+encodeURIComponent(msg)
  }

  // Genera la cotización en grupo (misma lógica de precio que el Cotizador público) y la guarda en 'cotizaciones'
  function cotizarEnGrupo(puesto,puestoCurso,empleadosSel,onDone){
    var cursoCat=cursosCat.find(function(c){return c.id===puestoCurso.curso_id})
    if(!cursoCat){alert('Este curso no está en el catálogo HCD, así que no se puede cotizar automáticamente. Usa la opción de WhatsApp.');return}
    var horas=Number(cursoCat.duracion)||0
    var num=empleadosSel.length
    var bloque=bloqueDePersonasPto(num)
    if(bloque==='especial'){alert('16+ participantes: cotización especial. Usa la opción de WhatsApp para que HCD te envíe el precio.');return}
    var precioBase=horas>0?precioHoraPto(cursoCat.categoria,bloque,tierDuracionPto(horas))*horas:0
    if(precioBase<=0){alert('No se encontró precio en Precios y Catálogo para este curso. Usa la opción de WhatsApp.');return}
    var iva=precioBase*0.16,total=precioBase+iva
    var year=new Date().getFullYear()
    supabase.from('cotizaciones').select('folio').like('folio','HCD-COT-'+year+'-%').then(function(fr){
      var maxNum=0
      ;(fr.data||[]).forEach(function(c){var m=(c.folio||'').match(/HCD-COT-\d+-(\d+)/);if(m)maxNum=Math.max(maxNum,parseInt(m[1],10))})
      var folio='HCD-COT-'+year+'-'+String(maxNum+1).padStart(4,'0')
      var nombres=empleadosSel.map(function(e){return e.nombre}).filter(Boolean)
      var payload={folio:folio,empresa_nombre:empresa.nombre,contacto_nombre:empresa.contacto_nombre||'',contacto_email:empresa.contacto_email||'',contacto_whatsapp:empresa.contacto_whatsapp||'',curso_id:cursoCat.id,curso_nombre:cursoCat.nombre,tipo_precio:'persona',modalidad:'online',num_personas:num,dias:horas<=8?1:horas<=16?2:3,precio_base:precioBase,descuento_tipo:null,descuento_valor:0,requiere_viaticos:false,monto_viaticos:0,aplica_iva:true,subtotal:precioBase,iva:iva,total:total,es_cliente_nuevo:empresa.tipo_acceso!=='cliente',comision_porcentaje:empresa.tipo_acceso!=='cliente'?15:10,comision_monto:total*(empresa.tipo_acceso!=='cliente'?0.15:0.10),incluye_consultoria:false,cupon_codigo:null,notas:'[Ruta de capacitación] Puesto: '+puesto.nombre+' · '+cursoCat.nombre+' · '+num+' empleado(s): '+nombres.join(', '),empresa_id:empresa.id,empresa_registrada:true,estado:'enviada'}
      supabase.from('cotizaciones').insert(payload).then(function(r){
        if(r.error){alert('No se pudo guardar la cotización: '+r.error.message);return}
        var fecha=new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})
        var w=window.open('','_blank','width=900,height=700')
        if(w){w.document.write(htmlCotizacionGrupo({empresa:empresa,curso_nombre:cursoCat.nombre,num_personas:num,bloque:bloque,horas:horas,subtotal:precioBase,iva_monto:iva,total:total,folio:folio,fecha:fecha,alumnos:nombres}));w.document.close()}
        alert('✅ Cotización '+folio+' generada para '+num+' empleado(s). La encuentras en "Mis cotizaciones".')
        if(onDone)onDone()
      })
    })
  }
  function htmlCotizacionGrupo(d){
    var lista=(d.alumnos&&d.alumnos.length)?'<div class="seccion"><h3>Empleados a capacitar ('+d.alumnos.length+')</h3><p style="font-size:13px;color:#475569;line-height:1.7">'+d.alumnos.join(' · ')+'</p></div>':''
    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Cotización '+d.folio+'</title>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Segoe UI,sans-serif;color:#1e293b;background:#fff;}'+
    '.page{max-width:800px;margin:0 auto;padding:40px;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #8B1A1A;}'+
    '.company{font-size:22px;font-weight:800;color:#8B1A1A;}.sub{font-size:11px;color:#64748b;margin-top:2px;}.folio-area{text-align:right;}'+
    '.folio-label{font-size:11px;color:#64748b;letter-spacing:1px;text-transform:uppercase;}.folio-val{font-size:18px;font-weight:800;color:#8B1A1A;}'+
    '.fecha{color:#64748b;font-size:12px;margin-top:4px;}.seccion{margin-bottom:24px;}'+
    '.seccion h3{font-size:13px;font-weight:700;color:#8B1A1A;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;}'+
    'table{width:100%;border-collapse:collapse;margin-top:8px;}th{background:#f8f9fb;padding:10px 14px;text-align:left;font-size:11px;color:#64748b;letter-spacing:.5px;text-transform:uppercase;}'+
    'td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}.total-row td{font-weight:800;font-size:15px;color:#8B1A1A;border-top:2px solid #8B1A1A;border-bottom:none;}'+
    '.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:11px;}'+
    '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="page">'+
    '<div class="header"><div><div class="company">● Hablando con Datos</div><div class="sub">Consultoría y Capacitación en Sistemas de Gestión</div>'+
    '<div class="sub" style="margin-top:4px">Gerencia de Ventas</div><div class="sub">WhatsApp: 222 354 9353</div></div>'+
    '<div class="folio-area"><div class="folio-label">Cotización</div><div class="folio-val">'+d.folio+'</div><div class="fecha">Fecha: '+d.fecha+'</div><div class="fecha">Vigencia: 30 días naturales</div></div></div>'+
    '<div class="seccion"><h3>Datos del cliente</h3><p style="font-size:14px;font-weight:600">'+(d.empresa.nombre||'')+'</p></div>'+
    '<div class="seccion"><h3>Detalle de la cotización</h3><table><thead><tr><th>Concepto</th><th>Detalle</th><th style="text-align:right">Importe</th></tr></thead><tbody>'+
    '<tr><td><strong>'+d.curso_nombre+'</strong></td><td>'+d.num_personas+' persona(s) · Bloque '+d.bloque+' · '+d.horas+'h</td><td style="text-align:right">$'+d.subtotal.toLocaleString('es-MX',{minimumFractionDigits:2})+'</td></tr>'+
    '<tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">Subtotal</td><td style="text-align:right">$'+d.subtotal.toLocaleString('es-MX',{minimumFractionDigits:2})+'</td></tr>'+
    '<tr><td colspan="2" style="text-align:right;color:#64748b;font-size:12px">IVA (16%)</td><td style="text-align:right">$'+d.iva_monto.toLocaleString('es-MX',{minimumFractionDigits:2})+'</td></tr>'+
    '<tr class="total-row"><td colspan="2" style="text-align:right">TOTAL</td><td style="text-align:right">$'+d.total.toLocaleString('es-MX',{minimumFractionDigits:2})+' MXN (IVA incl.)</td></tr></tbody></table></div>'+
    lista+
    '<div class="seccion" style="background:#f8f9fb;border-radius:8px;padding:16px;"><h3 style="margin-bottom:8px">Condiciones</h3>'+
    '<p style="font-size:12px;color:#475569;line-height:1.8">• Cotización válida por 30 días naturales.<br/>• Precios en pesos mexicanos (MXN). IVA del 16% incluido.<br/>'+
    '• La inscripción se confirma al adjuntar la orden de compra en el portal.<br/>• Incluye material didáctico y constancias con folio único verificable.<br/>'+
    '• Contacto: WhatsApp 222 354 9353</p></div>'+
    '<div class="footer"><p>Hablando con Datos — Consultoría y Capacitación en Sistemas de Gestión · Puebla, México</p>'+
    '<p style="margin-top:4px">Folio: '+d.folio+' · Gerencia de Ventas: 222 354 9353</p></div>'+
    '</div><script>window.onload=function(){window.print();}<\/script></body></html>'
  }

  // Organigrama PDF
  function imprimirOrganigrama(){
    function buildNode(p,depth,relPropia){
      var esAnexo=relPropia&&relPropia.tipo==='anexo'
      var hijos=relaciones.filter(function(r){return r.puesto_padre_id===p.id}).map(function(r){return{puesto:puestos.find(function(x){return x.id===r.puesto_id}),rel:r}}).filter(function(x){return x.puesto})
      var bg=depth===0?'#8B1A1A':'#fff',fg=depth===0?'#fff':'#1e293b',fg2=depth===0?'#f9d0d0':'#64748b'
      var borde=esAnexo?'2px dashed #94a3b8':'2px solid #8B1A1A'
      var html='<div style="margin-left:'+depth*40+'px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">'
      if(depth>0)html+='<div style="width:20px;border-top:'+borde+';"></div>'
      html+='<div style="display:inline-block;background:'+bg+';color:'+fg+';border:'+borde+';border-radius:12px;padding:12px 20px;min-width:160px;"><div style="font-weight:700;font-size:14px;">'+p.nombre+(esAnexo?' <span style="font-size:9px;color:#94a3b8;">(ANEXO)</span>':'')+'</div><div style="font-size:11px;color:'+fg2+';">'+(p.area||'')+' · '+(p.nivel||'')+'</div></div></div>'
      hijos.forEach(function(h){html+=buildNode(h.puesto,depth+1,h.rel)})
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
        {[['puestos','📋 Puestos ('+puestos.length+')'],['diagnostico','🎯 Diagnóstico'],['ruta','🧭 Ruta de capacitación'],['organigrama','🏗 Organigrama']].map(function(t){
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
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
          <p style={{color:'#64748b',fontSize:13,maxWidth:520}}>Los cursos sugeridos se calculan según el área de cada puesto (Operaciones, Calidad, Finanzas, RH, etc.) + un mínimo general que aplica a cualquier puesto. Puedes agregar cualquier otro manualmente o por Excel.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button onClick={exportarPlantillaCursos} style={BTN2}>⬇️ Plantilla Excel</button>
            <label style={{background:'#fff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer'}}>⬆️ Importar cursos (Excel)<input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={function(e){importarCursosExcel(e.target.files[0]);e.target.value=''}}/></label>
          </div>
        </div>
        {puestos.length===0?<div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:40,textAlign:'center',color:'#94a3b8'}}>Primero define tus puestos.</div>:
          puestos.map(function(puesto){
            var curs=puestoCursos.filter(function(pc){return pc.puesto_id===puesto.id})
            var sugeridosOcultos=parseList(puesto.sugeridos_ocultos)
            var sugeridos=cursosSugeridosPorArea(puesto.area).filter(function(n){return sugeridosOcultos.indexOf(n)===-1})
            var nuevoReq=nuevoReqPorPuesto[puesto.id]||''
            function setNuevoReq(v){setNuevoReqPorPuesto(function(prev){var next=Object.assign({},prev);next[puesto.id]=v;return next})}
            return <div key={puesto.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 18px',marginBottom:16}}>
              <div style={{fontWeight:800,color:'#8B1A1A',fontSize:15,marginBottom:10}}>🎯 {puesto.nombre} <span style={{fontWeight:400,fontSize:12,color:'#94a3b8'}}>({puesto.area||'sin área'})</span></div>

              {/* Cursos sugeridos según el área + generales */}
              <div style={{fontSize:12,fontWeight:700,marginBottom:6,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span>Cursos sugeridos para esta área:</span>
                {sugeridosOcultos.length>0&&<button onClick={function(){restaurarSugeridos(puesto)}} style={{background:'none',border:'none',color:'#1d4ed8',fontSize:11,fontWeight:600,cursor:'pointer',padding:0}}>↺ Restaurar {sugeridosOcultos.length} sugerencia{sugeridosOcultos.length!==1?'s':''} oculta{sugeridosOcultos.length!==1?'s':''}</button>}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                {sugeridos.length===0&&<span style={{fontSize:11,color:'#94a3b8'}}>Sin sugerencias (las quitaste todas). Agrega las tuyas abajo.</span>}
                {sugeridos.map(function(nombre){var act=curs.find(function(pc){return pc.curso_nombre===nombre});return <span key={nombre} style={{display:'inline-flex',alignItems:'center',borderRadius:20,border:'1px solid '+(act?'#059669':'#e2e8f0'),background:act?'#f0fdf4':'#fff',overflow:'hidden'}}>
                  <button onClick={function(){toggleCursoManual(puesto.id,nombre)}} style={{padding:'5px 4px 5px 12px',border:'none',background:'none',color:act?'#059669':'#475569',fontSize:11,fontWeight:act?700:400,cursor:'pointer'}}>{act?'✓ ':''}{nombre}</button>
                  <button onClick={function(){ocultarSugerido(puesto,nombre)}} title="Quitar esta sugerencia" style={{padding:'5px 10px 5px 4px',border:'none',background:'none',color:'#cbd5e1',fontSize:12,fontWeight:700,cursor:'pointer',lineHeight:1}}>×</button>
                </span>})}
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

      {/* RUTA DE CAPACITACIÓN */}
      {vista==='ruta'&&<div>
        <p style={{color:'#64748b',fontSize:13,marginBottom:14,maxWidth:640}}>Por cada curso requerido que aún le falta a tus empleados (marcado "✗ No" en Diagnóstico), puedes solicitar la capacitación: cotizarla en grupo al instante o pedirle a HCD una cotización por WhatsApp.</p>
        {puestos.length===0?<div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:40,textAlign:'center',color:'#94a3b8'}}>Primero define tus puestos.</div>:
          (function(){
            var conNecesidad=puestos.map(function(p){return{puesto:p,necesidades:necesidadesDePuesto(p)}}).filter(function(x){return x.necesidades.length>0})
            if(conNecesidad.length===0)return <div style={{background:'#f0fdf4',border:'1px solid #a7f3d0',borderRadius:14,padding:40,textAlign:'center',color:'#059669'}}>🎉 Todos los empleados están capacitados en los cursos requeridos de sus puestos.</div>
            return conNecesidad.map(function(x){
              return <div key={x.puesto.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 18px',marginBottom:14}}>
                <div style={{fontWeight:800,color:'#8B1A1A',fontSize:15,marginBottom:10}}>🎯 {x.puesto.nombre}</div>
                <div style={{display:'grid',gap:8}}>
                  {x.necesidades.map(function(n){
                    return <div key={n.puestoCurso.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',background:'#f8f9fb',borderRadius:8,padding:'10px 14px'}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:'#1e293b'}}>{n.puestoCurso.curso_nombre}</div>
                        <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{n.faltantes.length} empleado(s) sin capacitar: {n.faltantes.map(function(e){return e.nombre}).join(', ')}</div>
                      </div>
                      <button onClick={function(){setModalSolicitar({puesto:x.puesto,curso:n.puestoCurso,empleados:n.faltantes})}} style={BTN}>💼 Solicitar capacitación</button>
                    </div>
                  })}
                </div>
              </div>
            })
          })()
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
              <select id="rel-tipo" style={INP} defaultValue="reporta"><option value="reporta">🔗 Jerárquico</option><option value="anexo">🔸 Anexo (externo/staff)</option></select>
              <button onClick={agregarRelacion} style={BTN}>Conectar</button>
            </div>
          </div>

          {/* Árbol visual */}
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:20,marginBottom:14}}>
            {(function(){
              var raices=puestos.filter(function(p){return !relaciones.find(function(r){return r.puesto_id===p.id})})
              var conHijos=raices.filter(function(p){return relaciones.find(function(r){return r.puesto_padre_id===p.id})})
              var sinConexion=puestos.filter(function(p){return !relaciones.find(function(r){return r.puesto_id===p.id})&&!relaciones.find(function(r){return r.puesto_padre_id===p.id})})
              function Nodo(props2){var pu=props2.puesto,depth=props2.depth||0,relPropia=props2.rel
                var esAnexo=relPropia&&relPropia.tipo==='anexo'
                var hijos=relaciones.filter(function(r){return r.puesto_padre_id===pu.id}).map(function(r){return{puesto:puestos.find(function(x){return x.id===r.puesto_id}),rel:r}}).filter(function(x){return x.puesto})
                return <div style={{marginLeft:depth*32,marginBottom:8,position:'relative',paddingLeft:depth>0?16:0}}>
                  {depth>0&&<div style={{position:'absolute',left:0,top:14,width:14,borderTop:esAnexo?'2px dashed #94a3b8':'2px solid #8B1A1A'}}></div>}
                  <div style={{display:'inline-flex',alignItems:'center',gap:8,background:depth===0?'#8B1A1A':'#fff',color:depth===0?'#fff':'#1e293b',border:'2px '+(esAnexo?'dashed #94a3b8':'solid #8B1A1A'),borderRadius:10,padding:'8px 16px'}}>
                    <div><div style={{fontWeight:700,fontSize:13}}>{pu.nombre}{esAnexo&&<span style={{fontSize:9,fontWeight:700,color:'#94a3b8',marginLeft:6}}>ANEXO</span>}</div><div style={{fontSize:10,color:depth===0?'#f9d0d0':'#64748b'}}>{pu.area||''} · {pu.nivel||''}</div></div>
                  </div>
                  {depth>0&&relPropia&&<button onClick={function(){quitarRelacion(relPropia.id)}} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:10,marginLeft:4}}>×</button>}
                  <div style={{borderLeft:hijos.length>0?'2px solid #f1f5f9':'none',marginLeft:6}}>
                    {hijos.map(function(h){return <Nodo key={h.puesto.id} puesto={h.puesto} depth={depth+1} rel={h.rel}/>})}
                  </div>
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

          {modal.tipo==='nuevo'&&puestos.length>0&&<div>
            <label style={LBL}>🏗 Jerarquía (opcional)</label>
            <p style={{fontSize:11,color:'#94a3b8',marginBottom:8}}>Si este puesto reporta a otro, defínelo aquí y aparecerá conectado de una vez en el Organigrama.</p>
            <select value={fReportaA} onChange={function(e){setFReportaA(e.target.value)}} style={INP}>
              <option value="">— No reporta a nadie por ahora —</option>
              {puestos.filter(function(p){return p.id!==modal.id}).map(function(p){return <option key={p.id} value={p.id}>{p.nombre}</option>})}
            </select>
            {fReportaA&&<div style={{display:'flex',gap:6,marginTop:8}}>
              {[['reporta','🔗 Jerárquico (reporta directo)'],['anexo','🔸 Anexo (línea punteada, ej. externo/staff)']].map(function(t){
                return <button key={t[0]} type="button" onClick={function(){setFTipoRelacion(t[0])}} style={{flex:1,padding:'7px',borderRadius:8,border:'2px solid '+(fTipoRelacion===t[0]?'#8B1A1A':'#e2e8f0'),background:fTipoRelacion===t[0]?'#f9f0f0':'#fff',color:fTipoRelacion===t[0]?'#8B1A1A':'#475569',fontSize:11,fontWeight:600,cursor:'pointer'}}>{t[1]}</button>
              })}
            </div>}
          </div>}

          <div style={{display:'flex',gap:10,marginTop:20}}>
            <button onClick={guardarPuesto} style={BTN}>💾 Guardar puesto</button>
            <button onClick={function(){setModal(null)}} style={Object.assign({},BTN2,{padding:'9px 20px'})}>Cancelar</button>
          </div>
        </div>
      </div>}

      {/* MODAL: Solicitar capacitación (Ruta de capacitación) */}
      {modalSolicitar&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={function(){setModalSolicitar(null)}}>
        <div style={{background:'#fff',borderRadius:16,padding:24,width:'min(520px,94vw)',maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.15)'}} onClick={function(e){e.stopPropagation()}}>
          <h3 style={{fontSize:18,fontWeight:800,color:'#1e293b',marginBottom:4}}>Solicitar capacitación</h3>
          <p style={{color:'#64748b',fontSize:13,marginBottom:16}}>Curso: <strong>{modalSolicitar.curso.curso_nombre}</strong> · Puesto: {modalSolicitar.puesto.nombre}</p>

          <div style={{background:'#f8f9fb',borderRadius:10,padding:'12px 14px',marginBottom:16,maxHeight:160,overflowY:'auto'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Empleados a capacitar ({modalSolicitar.empleados.length}):</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {modalSolicitar.empleados.map(function(e){return <span key={e.id} style={{padding:'3px 9px',borderRadius:8,fontSize:12,background:'#fff',border:'1px solid #e2e8f0',color:'#475569'}}>{e.nombre}</span>})}
            </div>
          </div>

          <p style={{color:'#64748b',fontSize:12,marginBottom:16}}>Elige cómo quieres solicitar la cotización:</p>
          <div style={{display:'grid',gap:10}}>
            <button onClick={function(){cotizarEnGrupo(modalSolicitar.puesto,modalSolicitar.curso,modalSolicitar.empleados,function(){setModalSolicitar(null)})}} style={Object.assign({},BTN,{padding:'12px',fontSize:13})}>📄 Cotizar en grupo (automático)</button>
            <a href={linkWhatsAppSolicitud(modalSolicitar.curso,modalSolicitar.empleados)} target="_blank" rel="noreferrer" onClick={function(){setModalSolicitar(null)}}
              style={{display:'block',textAlign:'center',padding:'12px',borderRadius:8,background:'#f0fdf4',color:'#059669',border:'1px solid #a7f3d0',fontSize:13,fontWeight:700,textDecoration:'none'}}>📲 Enviar WhatsApp a HCD</a>
          </div>
          <p style={{color:'#94a3b8',fontSize:11,marginTop:12}}>"Cotizar en grupo" solo funciona si el curso está en el catálogo HCD con precio definido; si es un requisito personalizado, usa WhatsApp.</p>

          <button onClick={function(){setModalSolicitar(null)}} style={Object.assign({},BTN2,{marginTop:14,width:'100%',padding:'9px'})}>Cancelar</button>
        </div>
      </div>}
    </div>
  )
}
