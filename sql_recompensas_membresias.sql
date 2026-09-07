-- ═══════════════════════════════════════════════════════════════
-- Sistema de Recompensas (Tokens HCD + Referidos) y Membresías
-- Fase 1: pago manual (igual que órdenes de compra ya existentes),
-- sin pasarela de pagos automática. Corre esto ANTES del JSX.
-- Seguro de re-ejecutar (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════

-- 1. Código de referido + saldo cacheado de tokens en el propio participante
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS codigo_referido TEXT UNIQUE;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS referido_por UUID REFERENCES participantes(id) ON DELETE SET NULL;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS tokens_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS tokens_referido_otorgado BOOLEAN NOT NULL DEFAULT FALSE;

-- Código de referido también capturable en cotizaciones públicas (antes de que exista la cuenta)
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS referido_codigo TEXT;

CREATE INDEX IF NOT EXISTS idx_participantes_codigo_referido ON participantes(codigo_referido);
CREATE INDEX IF NOT EXISTS idx_participantes_referido_por ON participantes(referido_por);

-- 2. Bitácora de movimientos de tokens (fuente de verdad; tokens_balance es un caché)
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
CREATE INDEX IF NOT EXISTS idx_tokens_mov_participante ON tokens_movimientos(participante_id);

-- 3. Catálogo de canje
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

-- 4. Canjes realizados por los alumnos
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
CREATE INDEX IF NOT EXISTS idx_canjes_participante ON canjes(participante_id);

-- 5. Planes de membresía (catálogo, editable por admin)
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

-- 6. Suscripción del alumno a un plan (un periodo = un mes; se renueva subiendo comprobante de nuevo)
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
CREATE INDEX IF NOT EXISTS idx_membresias_alumno_participante ON membresias_alumno(participante_id);

-- ── Semilla: catálogo de canje (tabla que diste) ──
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

-- ── Semilla: planes de membresía ──
INSERT INTO membresias_planes (clave, nombre, precio_mxn, cursos_tipo_a, cursos_tipo_b, cursos_tipo_c, descripcion, orden)
SELECT * FROM (VALUES
  ('lite', 'Lite', 1000, 0, 0, 1, '1 curso al mes Tipo C (Liderazgo, Habilidades Blandas)', 1),
  ('pro', 'Pro', 1500, 0, 1, 1, '1 curso al mes Tipo B (Six Sigma White Belt, IATF Intro) + 1 Tipo C', 2),
  ('master', 'Master', 2500, 3, 99, 99, 'Hasta 3 cursos Tipo A online al mes (Core Tools, APQP, AMEF, GD&T) + acceso a B y C', 3)
) AS v(clave, nombre, precio_mxn, cursos_tipo_a, cursos_tipo_b, cursos_tipo_c, descripcion, orden)
WHERE NOT EXISTS (SELECT 1 FROM membresias_planes WHERE membresias_planes.clave = v.clave);

-- Bucket para comprobantes de pago de membresía (igual patrón que 'ordenes-compra')
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
