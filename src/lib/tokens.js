import { supabase } from './supabase'

// ── Sistema de Recompensas (Tokens HCD) ──────────────────────────────────────
// Patrón: tokens_movimientos es la fuente de verdad (bitácora), y
// participantes.tokens_balance es un caché denormalizado que se actualiza
// junto con cada movimiento (misma lógica que otros contadores del sistema).

export const TOKENS_REFERIDO_PRIMERA_COMPRA = 150

function generarCodigo(nombre) {
  const base = (nombre || 'HCD')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'HCD'
  const suf = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}${suf}`
}

// Devuelve el código de referido del participante; si no tiene, lo genera y guarda.
export async function asegurarCodigoReferido(participante) {
  if (participante.codigo_referido) return participante.codigo_referido
  for (let intento = 0; intento < 5; intento++) {
    const candidato = generarCodigo(participante.nombre)
    const { error } = await supabase.from('participantes').update({ codigo_referido: candidato }).eq('id', participante.id)
    if (!error) return candidato
    // si choca el UNIQUE, reintenta con otro código
  }
  throw new Error('No se pudo generar un código de referido único, intenta de nuevo.')
}

export function linkReferido(codigo) {
  return `${window.location.origin}/cotizar?ref=${encodeURIComponent(codigo)}`
}

// Registra un movimiento de tokens y actualiza el saldo cacheado.
export async function registrarMovimientoTokens({ participanteId, tipo, monto, concepto, referidoId = null, canjeId = null, creadoPor = 'admin' }) {
  const { data: part, error: e1 } = await supabase.from('participantes').select('tokens_balance').eq('id', participanteId).single()
  if (e1) throw e1
  const saldoActual = part?.tokens_balance || 0
  const delta = tipo === 'canjeado' ? -Math.abs(monto) : Math.abs(monto)
  const nuevoSaldo = saldoActual + delta
  if (nuevoSaldo < 0) throw new Error('Saldo de tokens insuficiente.')

  const { error: e2 } = await supabase.from('tokens_movimientos').insert({
    participante_id: participanteId, tipo, monto: Math.abs(monto), concepto,
    referido_id: referidoId, canje_id: canjeId, creado_por: creadoPor,
  })
  if (e2) throw e2

  const { error: e3 } = await supabase.from('participantes').update({ tokens_balance: nuevoSaldo }).eq('id', participanteId)
  if (e3) throw e3

  return nuevoSaldo
}

// Otorga tokens (ganado) — usado para: primera compra de un referido, ajustes manuales, promociones.
export async function otorgarTokens(participanteId, monto, concepto, referidoId = null, creadoPor = 'admin') {
  return registrarMovimientoTokens({ participanteId, tipo: 'ganado', monto, concepto, referidoId, creadoPor })
}

// Otorga los tokens de referido al recomendante cuando su referido paga su primer curso.
export async function otorgarTokensPorReferidoPrimeraCompra(participanteReferidoId) {
  const { data: referido, error } = await supabase.from('participantes').select('id, nombre, referido_por, tokens_referido_otorgado').eq('id', participanteReferidoId).single()
  if (error) throw error
  if (!referido?.referido_por) throw new Error('Este alumno no tiene un referente registrado.')
  if (referido.tokens_referido_otorgado) throw new Error('Ya se otorgaron los tokens de referido para este alumno.')

  await otorgarTokens(referido.referido_por, TOKENS_REFERIDO_PRIMERA_COMPRA, `Referido: ${referido.nombre} pagó su primer curso`, referido.id, 'admin')
  await supabase.from('participantes').update({ tokens_referido_otorgado: true }).eq('id', referido.id)
}

// Canjea un ítem del catálogo: descuenta tokens y crea el registro de canje.
export async function canjearItem(participanteId, item) {
  const { data: canje, error: e1 } = await supabase.from('canjes').insert({
    participante_id: participanteId, item_id: item.id, item_nombre: item.nombre, costo_tokens: item.costo_tokens, estado: 'solicitado',
  }).select().single()
  if (e1) throw e1

  try {
    await registrarMovimientoTokens({ participanteId, tipo: 'canjeado', monto: item.costo_tokens, concepto: `Canje: ${item.nombre}`, canjeId: canje.id, creadoPor: 'alumno' })
  } catch (err) {
    await supabase.from('canjes').delete().eq('id', canje.id)
    throw err
  }
  return canje
}

export const CATEGORIAS_CANJE = {
  merchandising: 'Merchandising',
  estilo_vida: 'Estilo de vida',
  formacion: 'Formación HCD',
}

export const ESTADOS_CANJE = {
  solicitado: { label: 'Solicitado', color: '#d97706', bg: '#fffbeb' },
  en_proceso: { label: 'En proceso', color: '#1d4ed8', bg: '#eff6ff' },
  entregado: { label: 'Entregado', color: '#059669', bg: '#ecfdf5' },
  cancelado: { label: 'Cancelado', color: '#dc2626', bg: '#fef2f2' },
}

export const ESTADOS_MEMBRESIA = {
  pendiente_pago: { label: 'Pendiente de pago', color: '#d97706', bg: '#fffbeb' },
  activa: { label: 'Activa', color: '#059669', bg: '#ecfdf5' },
  vencida: { label: 'Vencida', color: '#dc2626', bg: '#fef2f2' },
  cancelada: { label: 'Cancelada', color: '#64748b', bg: '#f1f5f9' },
}
