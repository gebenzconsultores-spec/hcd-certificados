import QRCode from 'qrcode'

const APP_URL = import.meta.env.VITE_APP_URL || 'https://hcd-certificados.vercel.app'

export async function generarQRBase64(idUnico) {
  const url = `${APP_URL}/verificar/${idUnico}`
  const qr = await QRCode.toDataURL(url, {
    width: 120,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' }
  })
  return qr
}

export function abrirCertificadoParaImprimir({ cert, qrBase64 }) {
  const {
    id_unico,
    nombre_participante,
    nombre_curso,
    lugar,
    duracion,
    fecha_emision,
    instructor_nombre,
    instructor_rfc,
    director_nombre,
  } = cert

  const fechaFormateada = new Date(fecha_emision).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const ventana = window.open('', '_blank', 'width=1122,height=794')
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Certificado ${id_unico}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,600;1,400&family=Special+Elite&family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
@page{size:landscape;margin:0;}
body{width:279mm;height:216mm;overflow:hidden;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.cert{width:279mm;height:216mm;position:relative;background:#fff;padding:14mm 18mm 10mm 18mm;display:flex;flex-direction:column;}

/* LÍNEAS SUPERIORES DECORATIVAS */
.lineas-top{position:absolute;top:8mm;right:18mm;display:flex;flex-direction:column;gap:2mm;}
.linea-dec{height:2.5px;background:#8B1A1A;}
.linea-dec:first-child{width:100mm;}
.linea-dec:last-child{width:100mm;}

/* HEADER */
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8mm;}
.logo-area{display:flex;align-items:center;gap:3mm;}
.logo-img{height:16mm;}
.header-right{width:110mm;display:flex;flex-direction:column;gap:1.5mm;align-items:flex-end;}

/* CUERPO */
.cuerpo{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;}
.otorga-empresa{font-family:'Inter',sans-serif;font-size:15pt;font-weight:700;color:#8B1A1A;letter-spacing:.5px;margin-bottom:1.5mm;}
.otorga-subtitulo{font-family:'Inter',sans-serif;font-size:10pt;color:#444;margin-bottom:5mm;}
.nombre-participante{font-family:'Crimson Text',serif;font-style:italic;font-size:28pt;color:#1a1a1a;margin-bottom:6mm;line-height:1.1;}
.por-texto{font-family:'Inter',sans-serif;font-size:9pt;color:#555;margin-bottom:1mm;}
.participar-texto{font-family:'Inter',sans-serif;font-size:11pt;font-weight:700;color:#1a1a1a;margin-bottom:1mm;}
.el-curso{font-family:'Inter',sans-serif;font-size:9pt;color:#555;margin-bottom:2mm;}
.nombre-curso{font-family:'Special Elite',monospace;font-size:18pt;color:#1a1a1a;letter-spacing:1px;}

/* QR */
.qr-area{position:absolute;right:18mm;top:55mm;}
.qr-img{width:22mm;height:22mm;}

/* FIRMAS */
.firmas-row{display:flex;justify-content:flex-start;gap:20mm;margin-top:8mm;width:100%;}
.firma-item{display:flex;flex-direction:column;align-items:center;min-width:50mm;}
.firma-linea{width:50mm;height:1px;background:#1a1a1a;margin-bottom:1.5mm;}
.firma-nombre{font-family:'Inter',sans-serif;font-size:8.5pt;font-weight:700;color:#1a1a1a;text-align:center;}
.firma-cargo{font-family:'Inter',sans-serif;font-size:7.5pt;color:#555;text-align:center;}
.firma-rfc{font-family:'Inter',sans-serif;font-size:7pt;color:#888;text-align:center;}

/* DATOS DERECHA */
.datos-right{position:absolute;right:18mm;bottom:30mm;text-align:right;}
.dato-row{display:flex;justify-content:flex-end;align-items:baseline;gap:3mm;margin-bottom:1.5mm;}
.dato-label{font-family:'Inter',sans-serif;font-size:8pt;color:#666;}
.dato-valor{font-family:'Inter',sans-serif;font-size:8.5pt;font-weight:700;color:#1a1a1a;}

/* PIE */
.pie{position:absolute;bottom:6mm;left:18mm;font-family:'Inter',sans-serif;font-size:7pt;color:#aaa;}

@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style>
</head>
<body>
<div class="cert">
  <div class="lineas-top">
    <div class="linea-dec"></div>
    <div class="linea-dec"></div>
  </div>

  <div class="header">
    <div class="logo-area">
      <img src="${APP_URL}/logo-hcd.png" class="logo-img" onerror="this.style.display='none'"/>
    </div>
    <div class="header-right"></div>
  </div>

  <div class="cuerpo">
    <div class="otorga-empresa">Hablando con Datos</div>
    <div class="otorga-subtitulo">Otorga el presente reconocimiento a:</div>
    <div class="nombre-participante">${nombre_participante}</div>
    <div class="por-texto">Por</div>
    <div class="participar-texto">Participar y Aprobar</div>
    <div class="el-curso">el curso:</div>
    <div class="nombre-curso">${nombre_curso}</div>
  </div>

  ${qrBase64 ? `<div class="qr-area"><img src="${qrBase64}" class="qr-img"/></div>` : ''}

  <div class="firmas-row">
    <div class="firma-item">
      <div class="firma-linea"></div>
      <div class="firma-nombre">${instructor_nombre || 'Néstor Daniel Reyes Díaz'}</div>
      <div class="firma-cargo">Instructor</div>
      <div class="firma-rfc">${instructor_rfc || 'REDN-770428-433-0005'}</div>
    </div>
    <div class="firma-item">
      <div class="firma-linea"></div>
      <div class="firma-nombre">${director_nombre || 'Mirna Rosas Delgado'}</div>
      <div class="firma-cargo">Dirección</div>
    </div>
  </div>

  <div class="datos-right">
    <div class="dato-row">
      <span class="dato-label">IDúnico*:</span>
      <span class="dato-valor">${id_unico}</span>
    </div>
    <div class="dato-row">
      <span class="dato-label">Impartido en:</span>
      <span class="dato-valor">${lugar}</span>
    </div>
    <div class="dato-row">
      <span class="dato-label">Duración (equivalente):</span>
      <span class="dato-valor">${duracion}&nbsp;Hrs</span>
    </div>
    <div class="dato-row">
      <span class="dato-label">Fecha:</span>
      <span class="dato-valor">${fechaFormateada}</span>
    </div>
  </div>

  <div class="pie">HCD-F-16 Rev2024</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body>
</html>`

  ventana.document.write(html)
  ventana.document.close()
}

export async function generarYAbrirCertificado(cert) {
  const qr = await generarQRBase64(cert.id_unico)
  abrirCertificadoParaImprimir({ cert, qrBase64: qr })
}
