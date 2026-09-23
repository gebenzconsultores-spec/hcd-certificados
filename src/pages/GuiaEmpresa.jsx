import { useState } from 'react'

// Guía interactiva del portal de empresa: explica cada función y cómo usarla,
// con navegación por temas y acceso directo a la pestaña correspondiente.
const TEMAS = [
  {
    id: 'resumen', icon: '📊', titulo: 'Resumen', tab: 'resumen',
    resumen: 'Vista general del estado de la capacitación de tu personal.',
    pasos: [
      'Aquí ves de un vistazo cuántos empleados tienes registrados, cuántos certificados se han emitido y cómo van tus asignaciones.',
      'Úsalo como punto de partida cada vez que entres al portal, antes de ir a una sección específica.',
    ],
  },
  {
    id: 'empleados', icon: '👥', titulo: 'Empleados', tab: 'empleados',
    resumen: 'Da de alta, edita o elimina a tu personal y activa su acceso al portal de alumno.',
    pasos: [
      'Da clic en "+ Nuevo empleado" y captura nombre, correo y WhatsApp.',
      'Al guardar, el sistema genera automáticamente su acceso al portal de alumno (ahí ven sus cursos, certificados y exámenes).',
      'Desde la lista puedes editar los datos de cualquier empleado o eliminarlo si ya no trabaja contigo.',
      'Puedes reenviarle sus datos de acceso si los perdió.',
    ],
  },
  {
    id: 'cursos', icon: '📚', titulo: 'Catálogo de cursos', tab: 'cursos',
    resumen: 'Explora todos los cursos disponibles de Hablando con Datos y asígnalos a tu equipo.',
    pasos: [
      'Navega el catálogo por familia o categoría, o busca por nombre.',
      'Da clic en un curso para ver su temario, duración y precio.',
      'Usa "Asignar" para asignarlo a uno o varios empleados (el curso debe estar pagado o activo para tu empresa).',
    ],
  },
  {
    id: 'asignaciones', icon: '📋', titulo: 'Asignaciones', tab: 'asignaciones',
    resumen: 'Da seguimiento a qué curso tiene cada empleado y en qué estatus va.',
    pasos: [
      'Aquí ves cada asignación con su estatus: pendiente, en curso o aprobado.',
      'Puedes filtrar por empleado o por curso para revisar avances específicos.',
      'Si un empleado no ha iniciado, puedes recordarle desde aquí que active su curso en su portal.',
    ],
  },
  {
    id: 'promociones', icon: '🏷️', titulo: 'Promociones', tab: 'promociones',
    resumen: 'Consulta las promociones y descuentos vigentes de HCD para tu empresa.',
    pasos: [
      'Revisa esta sección periódicamente: aquí aparecen las promociones activas.',
      'Si una promoción te interesa, da clic para que te lleve directo a generar tu cotización con el descuento aplicado.',
    ],
  },
  {
    id: 'renta', icon: '💳', titulo: 'Renta de plataforma', tab: 'renta',
    resumen: 'Información sobre rentar la plataforma HCD Certificados para uso interno de tu empresa.',
    pasos: [
      'Consulta los planes disponibles de renta de plataforma.',
      'Si te interesa, contáctanos por WhatsApp desde el botón de soporte para cotizarlo.',
    ],
  },
  {
    id: 'consultoria', icon: '🧩', titulo: 'Consultoría y auditoría', tab: 'consultoria',
    resumen: 'Solicita servicios de consultoría o auditoría especializados con HCD.',
    pasos: [
      'Describe la necesidad de tu empresa (auditoría de calidad, consultoría en procesos, etc.).',
      'Envía tu solicitud: nuestro equipo te contactará para armar una propuesta.',
    ],
  },
  {
    id: 'cotizaciones', icon: '💼', titulo: 'Mis cotizaciones', tab: 'cotizaciones',
    resumen: 'Consulta y da seguimiento a todas tus cotizaciones generadas.',
    pasos: [
      'Aquí aparece el historial completo de cotizaciones que has solicitado.',
      'Puedes subir tu comprobante de pago directamente sobre la cotización correspondiente.',
      'Revisa el estatus de cada una: enviada, pagada o vencida.',
    ],
  },
  {
    id: 'auditoria', icon: '📦', titulo: 'Constancias y auditoría', tab: 'auditoria',
    resumen: 'Descarga en un solo ZIP las constancias y resultados de examen de tu personal.',
    pasos: [
      'Elige un curso específico en el selector, o deja "Todo mi historial" para traer todo.',
      'Da clic en "Ver" para previsualizar cuántos certificados y exámenes hay para esa selección.',
      'Da clic en "Descargar ZIP": incluye constancias en HTML (listas para guardar como PDF), un CSV de resultados de examen y otro de certificados con su link de verificación.',
    ],
  },
  {
    id: 'puestos', icon: '📊', titulo: 'Puestos y capacitación', tab: 'puestos',
    resumen: 'Define tu organigrama, diagnostica necesidades de capacitación por puesto y arma tu ruta de capacitación.',
    pasos: [
      'En "Puestos": da de alta cada puesto con su área, nivel y conocimientos requeridos (a mano o importando un Excel).',
      'En "Diagnóstico": el sistema te sugiere cursos según el área del puesto (Operaciones, Calidad, RH, etc.). Da clic en una sugerencia para activarla como requisito, o en la "×" de la burbuja para quitarla si no aplica a tu operación — puedes restaurarlas después con el link "↺ Restaurar".',
      'Agrega tus propios requisitos con el campo de texto libre o importando tu propio Excel de cursos requeridos.',
      'Marca qué empleados ya están capacitados en cada requisito para ver el avance real de tu equipo.',
      'En "Organigrama" y "Ruta de capacitación" visualizas la jerarquía y el plan de formación completo, exportable en PDF.',
    ],
  },
  {
    id: 'bolsa', icon: '👔', titulo: 'Bolsa de trabajo', tab: 'bolsa',
    resumen: 'Publica vacantes internas y recibe postulaciones de alumnos certificados por HCD.',
    pasos: [
      'Da clic en "+ Nueva vacante" y describe el puesto, requisitos y ubicación.',
      'Los alumnos que marcaron "disponible para oportunidades" en su portal podrán ver y postularse.',
      'Revisa las postulaciones recibidas directamente desde esta sección.',
    ],
  },
  {
    id: 'candidatos', icon: '🧑‍💼', titulo: 'Pool de candidatos', tab: 'candidatos',
    resumen: 'Consulta el perfil de candidatos que HCD ha promovido para procesos de reclutamiento.',
    pasos: [
      'Explora los perfiles: incluyen resumen profesional, habilidades, experiencia, CV y LinkedIn (cuando el candidato lo compartió).',
      'Usa esta sección cuando tengas una vacante y quieras encontrar talento ya certificado con HCD.',
    ],
  },
]

export default function GuiaEmpresa({ onIrATab }) {
  const [activo, setActivo] = useState(TEMAS[0].id)
  const [busqueda, setBusqueda] = useState('')

  const filtrados = TEMAS.filter(t =>
    !busqueda.trim() ||
    t.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    t.resumen.toLowerCase().includes(busqueda.toLowerCase())
  )
  const temaActivo = TEMAS.find(t => t.id === activo) || TEMAS[0]

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg,#8B1A1A,#b91c1c)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, color: '#fff' }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>❓ Guía del Portal de gestión</div>
        <div style={{ fontSize: 13, opacity: .9 }}>Elige una función de la izquierda para ver cómo usarla, paso a paso. Puedes saltar directo a esa pestaña con el botón "Ir a esta sección".</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,260px) 1fr', gap: 18 }}>
        {/* Lista de temas */}
        <div>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar función..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 480, overflowY: 'auto' }}>
            {filtrados.map(t => (
              <button key={t.id} onClick={() => setActivo(t.id)}
                style={{
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                  background: activo === t.id ? '#fef2f2' : '#fff',
                  border: `1px solid ${activo === t.id ? '#8B1A1A' : '#e2e8f0'}`,
                  borderRadius: 10, padding: '9px 12px', fontSize: 13,
                  fontWeight: activo === t.id ? 700 : 500,
                  color: activo === t.id ? '#8B1A1A' : '#475569',
                  cursor: 'pointer',
                }}>
                <span>{t.icon}</span> {t.titulo}
              </button>
            ))}
            {filtrados.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: 12, padding: '10px 4px' }}>Sin resultados para "{busqueda}".</div>
            )}
          </div>
        </div>

        {/* Detalle del tema */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '22px 26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{temaActivo.icon} {temaActivo.titulo}</div>
            {onIrATab && (
              <button onClick={() => onIrATab(temaActivo.tab)}
                style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Ir a esta sección →
              </button>
            )}
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>{temaActivo.resumen}</p>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Cómo usarlo:</div>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {temaActivo.pasos.map((paso, i) => (
              <li key={i} style={{ color: '#475569', fontSize: 13, lineHeight: 1.5 }}>{paso}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
