import * as XLSX from 'xlsx'

// Convierte letra (A,B,C,D) o texto (Verdadero/Falso) a índice numérico
function respuestaAIndice(tipo, respuesta, opciones) {
  if (!respuesta) return 0
  const r = String(respuesta).trim().toUpperCase()

  if (tipo === 'verdadero_falso') {
    return r.startsWith('V') ? 0 : 1
  }

  // Opción múltiple: A=0, B=1, C=2, D=3
  const mapa = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
  if (mapa[r] !== undefined) return mapa[r]

  // Si escribió el texto completo de la respuesta, buscarlo en opciones
  const idx = opciones.findIndex(o => o && o.trim().toUpperCase() === r)
  return idx >= 0 ? idx : 0
}

export async function parsearExcelPreguntas(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  // Buscar la hoja "Preguntas" o usar la primera
  const nombreHoja = wb.SheetNames.find(n => /pregunta/i.test(n)) || wb.SheetNames[0]
  const hoja = wb.Sheets[nombreHoja]
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' })

  if (filas.length < 2) return { preguntas: [], errores: ['El archivo está vacío o no tiene preguntas'] }

  // Detectar columnas por encabezado
  const encabezados = filas[0].map(h => String(h).toLowerCase().trim())
  const col = {
    pregunta: encabezados.findIndex(h => /pregunta/i.test(h)),
    tipo: encabezados.findIndex(h => /tipo/i.test(h)),
    a: encabezados.findIndex(h => /opci[oó]n\s*a|opcion a/i.test(h)),
    b: encabezados.findIndex(h => /opci[oó]n\s*b|opcion b/i.test(h)),
    c: encabezados.findIndex(h => /opci[oó]n\s*c|opcion c/i.test(h)),
    d: encabezados.findIndex(h => /opci[oó]n\s*d|opcion d/i.test(h)),
    correcta: encabezados.findIndex(h => /correct/i.test(h)),
  }

  if (col.pregunta < 0) {
    return { preguntas: [], errores: ['No se encontró la columna "Pregunta". Verifica que uses la plantilla correcta.'] }
  }

  const preguntas = []
  const errores = []

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i]
    const textoPregunta = String(fila[col.pregunta] || '').trim()
    if (!textoPregunta) continue // saltar filas vacías

    const tipo = col.tipo >= 0 && /verdadero|falso|v_f|vf/i.test(String(fila[col.tipo]))
      ? 'verdadero_falso'
      : 'opcion_multiple'

    let opciones, respuesta_correcta

    if (tipo === 'verdadero_falso') {
      opciones = null
      respuesta_correcta = respuestaAIndice('verdadero_falso', fila[col.correcta], [])
    } else {
      opciones = [
        String(fila[col.a] || '').trim(),
        String(fila[col.b] || '').trim(),
        String(fila[col.c] || '').trim(),
        String(fila[col.d] || '').trim(),
      ]
      // Validar que tenga al menos 2 opciones
      const llenas = opciones.filter(o => o).length
      if (llenas < 2) {
        errores.push(`Fila ${i + 1}: "${textoPregunta.slice(0, 30)}..." tiene menos de 2 opciones`)
        continue
      }
      respuesta_correcta = respuestaAIndice('opcion_multiple', fila[col.correcta], opciones)
    }

    preguntas.push({ pregunta: textoPregunta, tipo, opciones, respuesta_correcta })
  }

  return { preguntas, errores }
}
