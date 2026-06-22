import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getCertificadoPorCodigo } from '../lib/supabase'

export default function Verificar() {
  const { idUnico } = useParams()
  const [cert, setCert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    getCertificadoPorCodigo(idUnico)
      .then(setCert)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [idUnico])

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e2e8f0', padding: '10px 20px', borderRadius: 50, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, background: '#8B1A1A', borderRadius: '50%' }} />
            <span style={{ color: '#8B1A1A', fontWeight: 800, fontSize: 15 }}>Hablando con Datos</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Verificación de certificado</h1>
        </div>

        {loading && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 40, textAlign: 'center', color: '#64748b' }}>
            Verificando...
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <h2 style={{ color: '#991b1b', fontWeight: 800, marginBottom: 8 }}>Certificado no encontrado</h2>
            <p style={{ color: '#ef4444', fontSize: 14 }}>El ID <strong>{idUnico}</strong> no corresponde a ningún certificado registrado.</p>
          </div>
        )}

        {cert && (
          <div style={{ background: '#fff', border: '2px solid #16a34a', borderRadius: 16, overflow: 'hidden' }}>
            {/* Banda verde de válido */}
            <div style={{ background: '#16a34a', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Certificado válido y auténtico</div>
                <div style={{ color: '#bbf7d0', fontSize: 12 }}>Verificado en tiempo real — {new Date().toLocaleDateString('es-MX')}</div>
              </div>
            </div>

            {/* Datos */}
            <div style={{ padding: '28px 32px' }}>
              <Row label="ID Único" value={<code style={{ color: '#8B1A1A', fontWeight: 700, fontSize: 15 }}>{cert.id_unico}</code>} />
              <Row label="Participante" value={<strong style={{ fontSize: 16 }}>{cert.nombre_participante}</strong>} />
              <Row label="Curso" value={cert.nombre_curso} />
              <Row label="Impartido en" value={cert.lugar} />
              <Row label="Duración" value={`${cert.duracion} horas`} />
              <Row label="Modalidad" value={cert.modalidad === 'presencial' ? 'Presencial' : 'Online'} />
              {cert.empresa && <Row label="Empresa" value={cert.empresa.nombre} />}
              <Row label="Fecha de emisión" value={new Date(cert.fecha_emision).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} />

              {/* Aval — solo en verificación */}
              {cert.curso?.aval_institucion && cert.curso?.nombre_aval && (
                <div style={{ marginTop: 20, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '14px 18px' }}>
                  <div style={{ color: '#7c3aed', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🏛 Avalado por</div>
                  <div style={{ color: '#4c1d95', fontSize: 15, fontWeight: 600 }}>{cert.curso.nombre_aval}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20 }}>
          Sistema de verificación de Hablando con Datos — Consultoría y Capacitación en Sistemas de Gestión
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#1e293b', fontSize: 14, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}
