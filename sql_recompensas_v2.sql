-- ═══════════════════════════════════════════════════════════════
-- Recompensas y Membresías v2: agrega beneficios extra a cada plan
-- y actualiza los textos con la info detallada de "HCD Academy Pass".
-- Seguro de re-ejecutar. Corre esto DESPUÉS de sql_recompensas_membresias.sql
-- (si ya corriste ese primero) o en cualquier momento (usa IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════

-- Por si sql_recompensas_membresias.sql todavía no se corrió: crea todo lo base primero.
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS codigo_referido TEXT UNIQUE;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS referido_por UUID REFERENCES participantes(id) ON DELETE SET NULL;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS tokens_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS tokens_referido_otorgado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS referido_codigo TEXT;

CREATE TABLE IF NOT EXISTS tokens_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ganado','canjeado','ajuste')),
  monto INTEGER NOT NULL,
  concepto TEXT,
  referido_id UUID REFERENCES participantes(id) ON DELETE SET NULL,
  canje_id UUID,
  creado_por TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogo_canje (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL CHECK (categoria IN ('merchandising','estilo_vida','formacion')),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  costo_tokens INTEGER NOT NULL,
  costo_real_mxn NUMERIC,
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canjes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE,
  item_id UUID REFERENCES catalogo_canje(id) ON DELETE SET NULL,
  item_nombre TEXT NOT NULL,
  costo_tokens INTEGER NOT NULL,
  estado TEXT DEFAULT 'solicitado' CHECK (estado IN ('solicitado','en_proceso','entregado','cancelado')),
  notas_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membresias_planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  precio_mxn NUMERIC NOT NULL,
  cursos_tipo_a INTEGER DEFAULT 0,
  cursos_tipo_b INTEGER DEFAULT 0,
  cursos_tipo_c INTEGER DEFAULT 0,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS membresias_alumno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE,
  plan_clave TEXT REFERENCES membresias_planes(clave),
  estado TEXT DEFAULT 'pendiente_pago' CHECK (estado IN ('pendiente_pago','activa','vencida','cancelada')),
  comprobante_url TEXT,
  periodo_inicio DATE,
  periodo_fin DATE,
  creditos_a_usados INTEGER DEFAULT 0,
  creditos_b_usados INTEGER DEFAULT 0,
  creditos_c_usados INTEGER DEFAULT 0,
  notas_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes-membresia', 'comprobantes-membresia', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='comprobantes-membresia insert publico') THEN
    CREATE POLICY "comprobantes-membresia insert publico" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'comprobantes-membresia');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='comprobantes-membresia select publico') THEN
    CREATE POLICY "comprobantes-membresia select publico" ON storage.objects FOR SELECT TO public USING (bucket_id = 'comprobantes-membresia');
  END IF;
END $$;

-- ── Semilla catálogo de canje (por si aún no existía ninguna fila) ──
INSERT INTO catalogo_canje (categoria, nombre, descripcion, costo_tokens, costo_real_mxn, orden)
SELECT * FROM (VALUES
  ('merchandising', 'Termo de Acero Inoxidable Grabado HCD', 'Termo de acero inoxidable grabado con el logo de Hablando con Datos', 150, 120, 1),
  ('merchandising', 'Playera Polo + Libreta Ejecutiva HCD', 'Playera polo bordada + libreta ejecutiva de Hablando con Datos', 200, 180, 2),
  ('estilo_vida', 'Boleto Doble de Cine (Cinépolis VIP)', 'Dos boletos para sala VIP en Cinépolis', 250, 220, 3),
  ('estilo_vida', 'Gift Card Amazon / Starbucks ($500)', 'Tarjeta de regalo digital por $500 MXN', 500, 500, 4),
  ('formacion', 'Beca 100% Curso Tipo C', 'Curso completo de Habilidades Blandas/Liderazgo sin costo', 600, 0, 5),
  ('formacion', 'Beca 100% Curso Tipo B', 'Curso completo Tipo B (Six Sigma White Belt, IATF Intro) sin costo', 1200, 0, 6),
  ('formacion', 'Beca 100% Curso Tipo A (Core Tools)', 'Curso completo Tipo A (Core Tools, APQP, AMEF, GD&T) sin costo', 2000, 0, 7)
) AS v(categoria, nombre, descripcion, costo_tokens, costo_real_mxn, orden)
WHERE NOT EXISTS (SELECT 1 FROM catalogo_canje WHERE catalogo_canje.nombre = v.nombre);

-- ── Semilla planes (por si aún no existía ninguna fila) ──
INSERT INTO membresias_planes (clave, nombre, precio_mxn, cursos_tipo_a, cursos_tipo_b, cursos_tipo_c, descripcion, orden)
SELECT * FROM (VALUES
  ('lite', 'Membresía C (Lite)', 1000, 0, 0, 1, '1 Curso al mes Tipo C (Liderazgo, 5S, Trabajo en Equipo, Comunicación Efectiva)', 1),
  ('pro', 'Membresía B (Pro)', 1500, 0, 1, 1, '1 Curso al mes Tipo B (White Belt Six Sigma, Introducción a IATF 16949, MESP) + 1 Curso Tipo C', 2),
  ('master', 'Membresía A (Master)', 2500, 3, 1, 1, 'Acceso a cualquier curso del calendario: hasta 3 Cursos Tipo A al mes (Core Tools, APQP, PPAP, AMEF, GD&T, ISO 14001) + 1 Curso Tipo B + 1 Curso Tipo C al mes', 3)
) AS v(clave, nombre, precio_mxn, cursos_tipo_a, cursos_tipo_b, cursos_tipo_c, descripcion, orden)
WHERE NOT EXISTS (SELECT 1 FROM membresias_planes WHERE membresias_planes.clave = v.clave);

-- ── v2: nueva columna de beneficios extra (no académicos) + textos actualizados ──
ALTER TABLE membresias_planes ADD COLUMN IF NOT EXISTS beneficios_extra TEXT;

UPDATE membresias_planes SET
  nombre = 'Membresía C (Lite)',
  descripcion = '1 Curso al mes Tipo C (Liderazgo, 5S, Trabajo en Equipo, Comunicación Efectiva)',
  beneficios_extra = '• Acceso a la bolsa de trabajo prioritaria.' || E'\n' || '• Descarga de constancias digitales.',
  cursos_tipo_c = 1, cursos_tipo_b = 0, cursos_tipo_a = 0
WHERE clave = 'lite';

UPDATE membresias_planes SET
  nombre = 'Membresía B (Pro)',
  descripcion = '1 Curso al mes Tipo B (White Belt Six Sigma, Introducción a IATF 16949, MESP) + 1 Curso Tipo C',
  beneficios_extra = '• Descarga de plantillas de trabajo (formatos A3, 8Ds).',
  cursos_tipo_c = 1, cursos_tipo_b = 1, cursos_tipo_a = 0
WHERE clave = 'pro';

UPDATE membresias_planes SET
  nombre = 'Membresía A (Master)',
  descripcion = 'Acceso a cualquier curso del calendario: hasta 3 Cursos Tipo A al mes (Core Tools, APQP, PPAP, AMEF, GD&T, ISO 14001) + 1 Curso Tipo B + 1 Curso Tipo C al mes',
  beneficios_extra = '• 10% de descuento en consultorías o auditorías para su empresa.',
  cursos_tipo_c = 1, cursos_tipo_b = 1, cursos_tipo_a = 3
WHERE clave = 'master';
