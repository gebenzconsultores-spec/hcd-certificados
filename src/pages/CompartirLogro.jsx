import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── "Comparte tu logro" ────────────────────────────────────────────────
// Arma una imagen (1080×1350, formato vertical de Instagram/Facebook) con la
// foto grupal que el admin sube en el Calendario de cursos, "HABLANDO CON
// DATOS" en grande, el nombre del curso y una frase editable. El alumno la
// publica en Facebook, Instagram o X.

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin
const ANCHO = 1080, ALTO = 1350

export function fraseDefault(cursoNombre) {
  return `¡Lo logré! 🎓 Concluí el curso "${cursoNombre}" con Hablando con Datos. ` +
    'Fue una experiencia que cambió mi forma de ver los procesos y los datos, y lo mejor: lo aprendí con mi equipo. ' +
    '¡Se los recomiendo muchísimo! 💪'
}

// Foto y frase del grupo: primero la corrida del curso del alumno (misma fecha),
// si no, la corrida más reciente de ese curso que tenga foto.
export async function obtenerFotoCurso(cursoId, fechaCurso) {
  if (!cursoId) return null
  try {
    const { data } = await supabase.from('cursos_confirmados')
      .select('fecha_inicio, foto_grupal_url, frase_compartir')
      .eq('curso_id', cursoId).not('foto_grupal_url', 'is', null)
      .order('fecha_inicio', { ascending: false })
    const lista = data || []
    const f = fechaCurso ? String(fechaCurso).slice(0, 10) : null
    return (f && lista.find(r => String(r.fecha_inicio).slice(0, 10) === f)) || lista[0] || null
  } catch (_) { return null }
}

function cargarImagen(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url + (url.includes('?') ? '&' : '?') + 'v=1'
  })
}

function partirLineas(ctx, texto, anchoMax) {
  const lineas = []
  for (const parrafo of String(texto).split('\n')) {
    let linea = ''
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? linea + ' ' + palabra : palabra
      if (ctx.measureText(prueba).width > anchoMax && linea) { lineas.push(linea); linea = palabra }
      else linea = prueba
    }
    if (linea) lineas.push(linea)
  }
  return lineas
}

// Quita emojis para dibujar en la imagen (en canvas se ven como cuadros en algunos equipos)
const sinEmojis = t => String(t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s{2,}/g, ' ').trim()

export async function generarImagenLogro({ fotoUrl, cursoNombre, frase, nombre }) {
  try { await document.fonts?.load('800 80px Inter') } catch (_) {}
  const cv = document.createElement('canvas')
  cv.width = ANCHO; cv.height = ALTO
  const ctx = cv.getContext('2d')
  const FUENTE = "Inter, 'Segoe UI', Arial, sans-serif"
  const M = 64 // margen

  // Fondo
  ctx.fillStyle = '#0B132B'; ctx.fillRect(0, 0, ANCHO, ALTO)
  const ALTO_FOTO = 820
  const foto = await cargarImagen(fotoUrl)
  if (foto) {
    const esc = Math.max(ANCHO / foto.width, ALTO_FOTO / foto.height)
    const w = foto.width * esc, h = foto.height * esc
    ctx.drawImage(foto, (ANCHO - w) / 2, (ALTO_FOTO - h) / 2, w, h)
  } else {
    const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO_FOTO)
    g.addColorStop(0, '#8B1A1A'); g.addColorStop(1, '#0B132B')
    ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO_FOTO)
    ctx.fillStyle = 'rgba(255,255,255,.12)'
    ctx.font = `800 300px ${FUENTE}`; ctx.textAlign = 'center'
    ctx.fillText('HCD', ANCHO / 2, ALTO_FOTO / 2 + 100); ctx.textAlign = 'left'
  }
  // Degradado para que el texto se lea sobre la foto
  const gr = ctx.createLinearGradient(0, ALTO_FOTO - 340, 0, ALTO_FOTO)
  gr.addColorStop(0, 'rgba(11,19,43,0)'); gr.addColorStop(1, 'rgba(11,19,43,1)')
  ctx.fillStyle = gr; ctx.fillRect(0, ALTO_FOTO - 340, ANCHO, 340)

  // Etiqueta arriba
  ctx.font = `700 26px ${FUENTE}`
  const etiqueta = 'LOGRO ALCANZADO'
  const anchoEt = ctx.measureText(etiqueta).width + 44
  ctx.fillStyle = '#D2321A'
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(M, M, anchoEt, 54, 27) : ctx.rect(M, M, anchoEt, 54); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.fillText(etiqueta, M + 22, M + 37)

  // "HABLANDO CON DATOS" en grande (ajusta el tamaño al ancho)
  let y = ALTO_FOTO - 40
  let tam = 104
  ctx.font = `800 ${tam}px ${FUENTE}`
  while (ctx.measureText('HABLANDO CON DATOS').width > ANCHO - M * 2 && tam > 50) { tam -= 2; ctx.font = `800 ${tam}px ${FUENTE}` }
  ctx.fillStyle = '#D2321A'; ctx.fillRect(M, y - tam - 18, 110, 9)
  ctx.fillStyle = '#FFFFFF'; ctx.fillText('HABLANDO CON DATOS', M, y)

  // Nombre del curso
  y += 70
  ctx.font = `700 46px ${FUENTE}`; ctx.fillStyle = '#FCA5A5'
  const lineasCurso = partirLineas(ctx, cursoNombre || '', ANCHO - M * 2).slice(0, 2)
  lineasCurso.forEach(l => { ctx.fillText(l, M, y); y += 56 })

  // Frase (se achica para que quepa)
  y += 14
  const limite = ALTO - 110
  let tf = 36, lineasFrase
  do {
    ctx.font = `400 ${tf}px ${FUENTE}`
    lineasFrase = partirLineas(ctx, '“' + sinEmojis(frase) + '”', ANCHO - M * 2)
    if (y + lineasFrase.length * tf * 1.35 <= limite || tf <= 24) break
    tf -= 2
  } while (true)
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  for (const l of lineasFrase) { if (y > limite) break; ctx.fillText(l, M, y); y += tf * 1.35 }

  // Pie
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(M, ALTO - 92, ANCHO - M * 2, 2)
  ctx.font = `600 28px ${FUENTE}`; ctx.fillStyle = '#E2E8F0'
  ctx.fillText(sinEmojis(nombre || ''), M, ALTO - 44)
  ctx.font = `400 24px ${FUENTE}`; ctx.fillStyle = '#94A3B8'; ctx.textAlign = 'right'
  ctx.fillText('certificados.hablandocondatos.com', ANCHO - M, ALTO - 44); ctx.textAlign = 'left'

  return new Promise(res => cv.toBlob(b => res({ blob: b, url: b ? URL.createObjectURL(b) : cv.toDataURL('image/png'), conFoto: !!foto }), 'image/png'))
}

export default function ModalCompartirLogro({ datos, onClose }) {
  // datos: { cursoId, cursoNombre, nombre, idCertificado, fechaCurso }
  const [frase, setFrase] = useState(fraseDefault(datos.cursoNombre))
  const [fotoUrl, setFotoUrl] = useState(undefined) // undefined = buscando
  const [img, setImg] = useState(null)
  const [generando, setGenerando] = useState(true)
  const [aviso, setAviso] = useState('')
  const urlPrevia = useRef(null)

  const verificar = datos.idCertificado ? `${APP_URL}/verificar/${datos.idCertificado}` : APP_URL
  const textoPost = `${frase}\n\n📜 Mi certificado: ${verificar}\n#HablandoConDatos #Capacitación #MejoraContinua`
  const puedeCompartirArchivos = typeof navigator !== 'undefined' && !!navigator.canShare

  useEffect(() => {
    obtenerFotoCurso(datos.cursoId, datos.fechaCurso).then(r => {
      setFotoUrl(r?.foto_grupal_url || null)
      if (r?.frase_compartir) setFrase(r.frase_compartir.replace(/\{curso\}/gi, datos.cursoNombre))
    })
  }, [])

  // Regenera la imagen cuando cambia la frase (con pequeña espera mientras escribe)
  useEffect(() => {
    if (fotoUrl === undefined) return
    setGenerando(true)
    const t = setTimeout(async () => {
      const r = await generarImagenLogro({ fotoUrl, cursoNombre: datos.cursoNombre, frase, nombre: datos.nombre })
      if (urlPrevia.current && urlPrevia.current.startsWith('blob:')) URL.revokeObjectURL(urlPrevia.current)
      urlPrevia.current = r.url
      setImg(r); setGenerando(false)
    }, 350)
    return () => clearTimeout(t)
  }, [frase, fotoUrl])

  function descargar() {
    if (!img) return
    const a = document.createElement('a')
    a.href = img.url; a.download = 'mi-logro-hablando-con-datos.png'
    document.body.appendChild(a); a.click(); a.remove()
  }
  async function copiarTexto() {
    try { await navigator.clipboard.writeText(textoPost); return true } catch (_) { return false }
  }

  async function compartirNativo() {
    if (!img?.blob) return
    const file = new File([img.blob], 'mi-logro-hablando-con-datos.png', { type: 'image/png' })
    await copiarTexto() // Instagram/Facebook ignoran el texto: lo dejamos copiado
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: textoPost, title: 'Mi logro con Hablando con Datos' })
        setAviso('¡Listo! Si la app no puso el texto, ya está copiado: solo pégalo en tu publicación.')
        return
      }
    } catch (e) { if (e && e.name === 'AbortError') return }
    descargar()
    setAviso('Descargamos tu imagen y copiamos el texto. Súbela en tu red social y pega el texto.')
  }

  function abrirRed(red) {
    // Abrimos la red primero (para que el navegador no bloquee la ventana) y luego bajamos la imagen
    const urls = {
      facebook: 'https://www.facebook.com/',
      instagram: 'https://www.instagram.com/',
      x: 'https://x.com/intent/post?text=' + encodeURIComponent(textoPost),
    }
    window.open(urls[red], '_blank', 'noopener')
    descargar()
    copiarTexto()
    const nombres = { facebook: 'Facebook', instagram: 'Instagram', x: 'X' }
    setAviso(red === 'x'
      ? 'Se abrió X con tu texto listo. Adjunta la imagen que se acaba de descargar y publica.'
      : `Descargamos tu imagen y copiamos el texto. En ${nombres[red]} crea una publicación, sube la imagen y pega el texto.`)
  }

  const btnRed = (bg) => ({ flex: 1, minWidth: 110, background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 10px', fontSize: 14, fontWeight: 700, cursor: 'pointer' })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 'clamp(16px,4vw,26px)', width: 'min(560px,100%)', maxHeight: '92vh', overflowY: 'auto', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>🎉 Comparte tu logro</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#64748b', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#0B132B', aspectRatio: '4 / 5', marginBottom: 12 }}>
          {img && <img src={img.url} alt="Imagen para compartir" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: generando ? .6 : 1 }} />}
          {(!img || generando) && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13 }}>Preparando tu imagen...</div>}
        </div>
        {img && !img.conFoto && (
          <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Aún no hay foto del grupo para este curso; se usa el diseño de Hablando con Datos.</p>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Tu frase (puedes editarla)</label>
        <textarea value={frase} onChange={e => setFrase(e.target.value)} rows={4} maxLength={400}
          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 14 }} />

        {puedeCompartirArchivos && (
          <button onClick={compartirNativo} disabled={!img}
            style={{ width: '100%', background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 10 }}>
            📲 Compartir (Facebook, Instagram, X…)
          </button>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button onClick={() => abrirRed('facebook')} disabled={!img} style={btnRed('#1877F2')}>Facebook</button>
          <button onClick={() => abrirRed('instagram')} disabled={!img} style={btnRed('linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)')}>Instagram</button>
          <button onClick={() => abrirRed('x')} disabled={!img} style={btnRed('#000')}>X</button>
        </div>
        <button onClick={descargar} disabled={!img}
          style={{ width: '100%', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ⬇️ Descargar imagen
        </button>
        {aviso && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginTop: 12 }}>{aviso}</div>}
      </div>
    </div>
  )
}
