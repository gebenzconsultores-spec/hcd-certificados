import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── CURSOS ──────────────────────────────────────────────────────────────────
export async function getCursos() {
  const { data, error } = await supabase
    .from('cursos')
    .select('*')
    .order('numero_curso', { ascending: false })
  if (error) throw error
  return data
}

export async function crearCurso(curso) {
  const { data, error } = await supabase
    .from('cursos')
    .insert(curso)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarCurso(id, datos) {
  const { data, error } = await supabase
    .from('cursos')
    .update(datos)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── EMPRESAS ─────────────────────────────────────────────────────────────────
export async function getEmpresas() {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data
}

export async function crearEmpresa(empresa) {
  const { data, error } = await supabase
    .from('empresas')
    .insert(empresa)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── PARTICIPANTES ─────────────────────────────────────────────────────────────
export async function getParticipantes(filtros = {}) {
  let query = supabase
    .from('participantes')
    .select(`*, empresa:empresas(nombre)`)
    .order('created_at', { ascending: false })
  if (filtros.empresa_id) query = query.eq('empresa_id', filtros.empresa_id)
  if (filtros.busqueda) query = query.ilike('nombre', `%${filtros.busqueda}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function crearParticipante(participante) {
  const { data, error } = await supabase
    .from('participantes')
    .insert(participante)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── CERTIFICADOS ──────────────────────────────────────────────────────────────
export async function getCertificados(filtros = {}) {
  let query = supabase
    .from('certificados')
    .select(`
      *,
      participante:participantes(nombre, correo, whatsapp),
      curso:cursos(nombre, numero_curso, duracion, lugar_online, aval_institucion),
      empresa:empresas(nombre)
    `)
    .order('created_at', { ascending: false })
  if (filtros.empresa_id) query = query.eq('empresa_id', filtros.empresa_id)
  if (filtros.curso_id) query = query.eq('curso_id', filtros.curso_id)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getCertificadoPorCodigo(codigo) {
  const { data, error } = await supabase
    .from('certificados')
    .select(`
      *,
      participante:participantes(nombre, correo),
      curso:cursos(nombre, numero_curso, duracion, lugar_online, aval_institucion, nombre_aval),
      empresa:empresas(nombre)
    `)
    .eq('id_unico', codigo)
    .single()
  if (error) throw error
  return data
}

export async function crearCertificado(cert) {
  const { data, error } = await supabase
    .from('certificados')
    .insert(cert)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── CONSECUTIVO ───────────────────────────────────────────────────────────────
export async function siguienteConsecutivo() {
  const { data, error } = await supabase
    .from('consecutivos')
    .select('valor')
    .eq('clave', 'global')
    .single()
  if (error) throw error
  const siguiente = data.valor + 1
  await supabase
    .from('consecutivos')
    .update({ valor: siguiente })
    .eq('clave', 'global')
  return siguiente
}

export async function siguienteNumeroCurso() {
  const { data, error } = await supabase
    .from('consecutivos')
    .select('valor')
    .eq('clave', 'curso')
    .single()
  if (error) throw error
  const siguiente = data.valor + 1
  await supabase
    .from('consecutivos')
    .update({ valor: siguiente })
    .eq('clave', 'curso')
  return siguiente
}

// ── EXAMENES ──────────────────────────────────────────────────────────────────
export async function getExamenPorCurso(curso_id) {
  const { data, error } = await supabase
    .from('preguntas')
    .select('*')
    .eq('curso_id', curso_id)
    .order('orden')
  if (error) throw error
  return data
}

export async function guardarPreguntas(curso_id, preguntas) {
  // Borrar existentes y reinsertar
  await supabase.from('preguntas').delete().eq('curso_id', curso_id)
  if (preguntas.length === 0) return
  const rows = preguntas.map((p, i) => ({ ...p, curso_id, orden: i + 1 }))
  const { error } = await supabase.from('preguntas').insert(rows)
  if (error) throw error
}

export async function guardarResultadoExamen(resultado) {
  const { data, error } = await supabase
    .from('resultados_examen')
    .insert(resultado)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getResultadosPorCursoEmpresa(curso_id, empresa_id) {
  const { data, error } = await supabase
    .from('resultados_examen')
    .select(`
      *,
      participante:participantes(nombre, correo, whatsapp),
      certificado:certificados(id_unico)
    `)
    .eq('curso_id', curso_id)
    .eq('empresa_id', empresa_id)
  if (error) throw error
  return data
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
export async function loginAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function logout() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
