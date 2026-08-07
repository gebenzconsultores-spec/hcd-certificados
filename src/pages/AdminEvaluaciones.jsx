import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

function exportarAExcel(filas, archivo, hoja = 'Datos') {
  if (!filas || filas.length === 0) { alert('No hay datos para exportar.'); return }
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, hoja)
  XLSX.writeFile(wb, archivo)
}
const estrellas = n => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))

export default function AdminEvaluaciones() {
  const [evals, setEvals] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursoFiltro, setCursoFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('evaluaciones_curso').select('*').order('created_at', { ascending: false })
    setEvals(data || [])
    setLoading(false)
  }

  async function eliminar(e) {
    if (!window.confirm(`¿Eliminar la evaluación de ${e.participante_nombre || 'este alumno'}?`)) return
    await supabase.from('evaluaciones_curso').delete().eq('id', e.id)
    await cargar()
  }

  if (loading) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Cargando evaluaciones...</div>

  const cursos = [...new Set(evals.map(e => e.curso_nombre).filter(Boolean))]
  const visibles = evals
    .filter(e => cursoFiltro === 'todos' || e.curso_nombre === cursoFiltro)
    .filter(e => `${e.participante_nombre || ''} ${e.curso_nombre || ''} ${e.mejoras || ''}`.toLowerCase().includes(busqueda.toLowerCase()))

  const promedio = evals.length ? (evals.reduce((a, e) => a + (Number(e.calificacion) || 0), 0) / evals.length).toFixed(1) : '—'
  const conSugerencia = evals.filter(e => e.mejoras && e.mejoras.trim()).length

  function descargarExcel() {
    const filas = visibles.map(e => ({
      'Fecha': e.created_at ? new Date(e.created_at).toLocaleDateString('es-MX') : '',
      'Alumno': e.participante_nombre || '',
      'Curso': e.curso_nombre || '',
      'Calificación': e.calificacion || 0,
      'Contenido': e.cal_contenido || '', 'Instructor': e.cal_instructor || '',
      'Expectativas': e.cal_expectativas || '', 'Material': e.cal_material || '',
      'Recomendaría': e.cal_recomendaria || '',
      'Sugerencias de mejora': e.mejoras || '',
      'Curso deseado': e.curso_deseado || '',
      'Conoce plataforma': e.conoce_plataforma || '',
    }))
    exportarAExcel(filas, `evaluaciones_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Evaluaciones')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Evaluaciones de cursos</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Calificaciones y sugerencias de mejora que dejan los alumnos y empresas.</p>
        </div>
        <button onClick={descargarExcel} style={{ background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>⬇️ Descargar Excel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Calificación promedio', value: `${promedio} ★`, color: '#f59e0b' },
          { label: 'Evaluaciones totales', value: evals.length, color: '#1e293b' },
          { label: 'Con sugerencias', value: conSugerencia, color: '#8B1A1A' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={cursoFiltro} onChange={e => setCursoFiltro(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }}>
          <option value="todos">Todos los cursos ({evals.length})</option>
          {cursos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar alumno, curso o sugerencia..."
          style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 14px', fontSize: 13, outline: 'none', minWidth: 260 }} />
      </div>

      {visibles.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          Aún no hay evaluaciones. Aparecen cuando los alumnos califican sus cursos desde su portal.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {visibles.map(e => (
            <div key={e.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ color: '#f59e0b', fontSize: 16, letterSpacing: 2 }}>{estrellas(e.calificacion)}</span>
                    <span style={{ color: '#1e293b', fontWeight: 700, fontSize: 14 }}>{e.curso_nombre}</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>👤 {e.participante_nombre || 'Alumno'} · {e.created_at ? new Date(e.created_at).toLocaleDateString('es-MX') : ''}</div>
                  {(e.cal_contenido || e.cal_instructor) && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: '#475569' }}>
                      {e.cal_contenido > 0 && <span>Contenido: {estrellas(e.cal_contenido)}</span>}
                      {e.cal_instructor > 0 && <span>Instructor: {estrellas(e.cal_instructor)}</span>}
                      {e.cal_expectativas > 0 && <span>Expectativas: {estrellas(e.cal_expectativas)}</span>}
                      {e.cal_material > 0 && <span>Material: {estrellas(e.cal_material)}</span>}
                      {e.cal_recomendaria > 0 && <span>Recomendaría: {estrellas(e.cal_recomendaria)}</span>}
                    </div>
                  )}
                  {e.mejoras && <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 14px', marginTop: 8, color: '#475569', fontSize: 13 }}>💡 {e.mejoras}</div>}
                  {e.curso_deseado && <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 14px', marginTop: 6, color: '#1d4ed8', fontSize: 13 }}>🎯 Curso deseado: {e.curso_deseado}</div>}
                  {e.conoce_plataforma && <div style={{ background: '#faf5ff', borderRadius: 8, padding: '10px 14px', marginTop: 6, color: '#7c3aed', fontSize: 13 }}>🖥 Plataforma: {e.conoce_plataforma}</div>}
                </div>
                <button onClick={() => eliminar(e)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
