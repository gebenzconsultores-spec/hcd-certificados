import { useState } from 'react'

const TERMINOS = `TÉRMINOS Y CONDICIONES DE USO

1. Aceptación de los Términos
Al acceder y utilizar el sitio web y el software operado por Hablando con Datos, el usuario (ya sea en representación de una empresa o como empleado/candidato) acepta cumplir de manera vinculante con los presentes Términos y Condiciones.

2. Descripción del Servicio y Uso de IA
Hablando con Datos provee una plataforma web basada en Inteligencia Artificial que conecta perfiles laborales con vacantes e información de plantillas empresariales. El usuario reconoce que la IA funciona únicamente como una herramienta de optimización y organización de datos, y no realiza perfilamientos automatizados, evaluaciones de rendimiento ni toma decisiones definitivas de contratación por sí misma.

3. Registro y Cuentas de Usuario
El acceso a la plataforma se realiza mediante dos modalidades:
• Alta por la Empresa: Las empresas pueden registrar a sus plantillas bajo su estricta responsabilidad de contar con las autorizaciones laborales correspondientes.
• Registro Directo: Los empleados pueden crear su propia cuenta de forma voluntaria.
Ambos perfiles son responsables de mantener la confidencialidad de sus credenciales de acceso.

4. Propiedad Intelectual del Software
Todo el código fuente, la interfaz gráfica, los algoritmos de Inteligencia Artificial, las bases de datos y las marcas comerciales asociadas a Hablando con Datos son propiedad exclusiva de la plataforma. Queda estrictamente prohibido cualquier intento de ingeniería inversa, extracción masiva de datos (scraping) o uso no autorizado del software.

5. Reglas de Transferencia y Contratos de Confidencialidad (NDA)
Las empresas que tengan acceso a la visualización de plantillas o perfiles de candidatos se obligan, por el simple uso de la plataforma, a no utilizar dicha información para fines distintos al reclutamiento genuino.
Se establece que cualquier uso indebido de los datos transferidos activará las penalizaciones legales correspondientes, deslindando a Hablando con Datos de la mala praxis de terceros.

6. Limitación de Responsabilidad
Hablando con Datos no garantiza la contratación final de ningún candidato ni la veracidad absoluta de la información subida por las empresas o empleados. El servicio se presta "tal cual está" disponible en internet.

AVISO DE PRIVACIDAD

En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), Hablando con Datos informa:

• Los datos personales recabados (nombre, correo, teléfono, información laboral) se utilizan exclusivamente para la prestación del servicio de capacitación, certificación y vinculación laboral.
• No se comparten datos personales con terceros sin consentimiento previo del titular, salvo los casos previstos por la ley.
• El titular puede ejercer sus derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) contactando a: ventas@hablandocondatos.com.mx
• Los datos se almacenan en servidores seguros con cifrado y controles de acceso.
• Al utilizar la plataforma, el usuario otorga su consentimiento para el tratamiento de sus datos conforme a este aviso.

Contacto: ventas@hablandocondatos.com.mx · WhatsApp: 222 354 9353
Última actualización: ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`

export function ModalTerminos({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(640px,94vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={function(e){e.stopPropagation()}}>
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#8B1A1A', margin: 0 }}>Términos, Condiciones y Aviso de Privacidad</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#94a3b8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Segoe UI, sans-serif', fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>{TERMINOS}</pre>
        </div>
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
          <button onClick={onClose} style={{ background: '#8B1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Entendido</button>
        </div>
      </div>
    </div>
  )
}

export function LinkTerminos() {
  const [ver, setVer] = useState(false)
  return (
    <>
      <button onClick={function(){setVer(true)}} style={{ background: 'none', border: 'none', color: '#8B1A1A', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
        📜 Términos, Condiciones y Aviso de Privacidad
      </button>
      {ver && <ModalTerminos onClose={function(){setVer(false)}} />}
    </>
  )
}

export function CasillaTerminos({ aceptado, onChange }) {
  const [ver, setVer] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
      <input type="checkbox" checked={aceptado} onChange={function(e){onChange(e.target.checked)}} style={{ marginTop: 3, cursor: 'pointer' }} />
      <span style={{ fontSize: 12, color: '#475569' }}>
        He leído y acepto los{' '}
        <button onClick={function(){setVer(true)}} style={{ background: 'none', border: 'none', color: '#8B1A1A', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          Términos, Condiciones y Aviso de Privacidad
        </button>
      </span>
      {ver && <ModalTerminos onClose={function(){setVer(false)}} />}
    </div>
  )
}
