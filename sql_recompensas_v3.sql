-- ═══════════════════════════════════════════════════════════════
-- Recompensas y Membresías v3:
-- - tokens de regalo mensuales automáticos por nivel (25/50/75)
-- - notas generales editables (se muestran en el portal de alumno)
-- - textos de beneficios de Pro y Master actualizados (incluye lo del
--   nivel anterior + lo nuevo que pediste)
-- - columna para no duplicar el regalo de tokens en la misma activación
-- Seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE membresias_planes ADD COLUMN IF NOT EXISTS tokens_mensuales INTEGER DEFAULT 0;
ALTER TABLE membresias_alumno ADD COLUMN IF NOT EXISTS tokens_regalo_otorgados BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS membresias_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  notas_generales TEXT,
  CONSTRAINT membresias_config_solo_una_fila CHECK (id = 1)
);
ALTER TABLE membresias_config DISABLE ROW LEVEL SECURITY;

INSERT INTO membresias_config (id, notas_generales) VALUES (
  1,
  '• Solo se tiene acceso a los cursos que estén calendarizados. Si requieres un curso aparte, debe cotizarse por separado.' || E'\n' ||
  '• Las membresías incluyen constancia de participación (entrega manual por nuestro equipo).' || E'\n' ||
  '• Cada mes, al activarse tu membresía, recibes tokens de regalo automáticamente según tu nivel.'
) ON CONFLICT (id) DO NOTHING;

-- ── Tokens de regalo mensuales por nivel ──
UPDATE membresias_planes SET tokens_mensuales = 25 WHERE clave = 'lite';
UPDATE membresias_planes SET tokens_mensuales = 50 WHERE clave = 'pro';
UPDATE membresias_planes SET tokens_mensuales = 75 WHERE clave = 'master';

-- ── Beneficios extra actualizados: Pro incluye lo de Lite, Master incluye lo de Pro ──
UPDATE membresias_planes SET
  beneficios_extra = '• Acceso a la bolsa de trabajo prioritaria.' || E'\n' ||
                      '• Descarga de constancias digitales.' || E'\n' ||
                      '• 25 tokens de regalo cada mes.'
WHERE clave = 'lite';

UPDATE membresias_planes SET
  beneficios_extra = '• Incluye todos los beneficios de la Membresía C (Lite).' || E'\n' ||
                      '• Descarga de plantillas de trabajo (formatos A3, 8Ds).' || E'\n' ||
                      '• 50 tokens de regalo cada mes.'
WHERE clave = 'pro';

UPDATE membresias_planes SET
  beneficios_extra = '• Incluye todos los beneficios de la Membresía B (Pro).' || E'\n' ||
                      '• 40 minutos de consultoría personalizada al mes para aclarar dudas.' || E'\n' ||
                      '• 75 tokens de regalo cada mes.'
WHERE clave = 'master';

-- Verificación
SELECT clave, nombre, tokens_mensuales, beneficios_extra FROM membresias_planes ORDER BY orden;
