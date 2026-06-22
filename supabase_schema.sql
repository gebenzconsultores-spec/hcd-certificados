-- ═══════════════════════════════════════════════════════════
--  HABLANDO CON DATOS — Schema completo Supabase
--  Ejecutar en: Supabase > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- ── CONSECUTIVOS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consecutivos (
  clave TEXT PRIMARY KEY,
  valor INTEGER NOT NULL DEFAULT 0
);

-- Valores iniciales (último folio fue 3026, último curso fue 496)
INSERT INTO consecutivos (clave, valor) VALUES ('global', 3026) ON CONFLICT DO NOTHING;
INSERT INTO consecutivos (clave, valor) VALUES ('curso', 496) ON CONFLICT DO NOTHING;

-- ── EMPRESAS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  ciudad TEXT,
  contacto_nombre TEXT,
  contacto_email TEXT,
  contacto_whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PARTICIPANTES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  whatsapp TEXT,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  empresa_manual TEXT,
  tipo TEXT DEFAULT 'empresa' CHECK (tipo IN ('empresa','individual')),
  es_universitario BOOLEAN DEFAULT FALSE,
  universidad TEXT,
  carrera TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participantes_correo ON participantes(correo);
CREATE INDEX IF NOT EXISTS idx_participantes_empresa ON participantes(empresa_id);

-- ── CURSOS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_curso INTEGER NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  duracion INTEGER NOT NULL,
  modalidad TEXT DEFAULT 'presencial' CHECK (modalidad IN ('presencial','online')),
  lugar_online TEXT DEFAULT 'Puebla, Pue.',
  aval_institucion BOOLEAN DEFAULT FALSE,
  nombre_aval TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cursos_numero ON cursos(numero_curso);

-- ── PREGUNTAS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS preguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  tipo TEXT DEFAULT 'opcion_multiple' CHECK (tipo IN ('opcion_multiple','verdadero_falso')),
  opciones JSONB,
  respuesta_correcta INTEGER NOT NULL,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_curso ON preguntas(curso_id);

-- ── CERTIFICADOS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_unico TEXT NOT NULL UNIQUE,
  participante_id UUID REFERENCES participantes(id) ON DELETE SET NULL,
  curso_id UUID REFERENCES cursos(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  nombre_participante TEXT NOT NULL,
  nombre_curso TEXT NOT NULL,
  lugar TEXT NOT NULL,
  duracion INTEGER NOT NULL,
  modalidad TEXT NOT NULL,
  instructor_nombre TEXT DEFAULT 'Néstor Daniel Reyes Díaz',
  instructor_rfc TEXT DEFAULT 'REDN-770428-433-0005',
  director_nombre TEXT DEFAULT 'Mirna Rosas Delgado',
  fecha_emision TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificados_id_unico ON certificados(id_unico);
CREATE INDEX IF NOT EXISTS idx_certificados_empresa ON certificados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_certificados_curso ON certificados(curso_id);
CREATE INDEX IF NOT EXISTS idx_certificados_participante ON certificados(participante_id);

-- ── RESULTADOS DE EXAMEN ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS resultados_examen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID REFERENCES participantes(id) ON DELETE SET NULL,
  curso_id UUID REFERENCES cursos(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  calificacion INTEGER NOT NULL,
  aprobado BOOLEAN NOT NULL,
  respuestas_json JSONB,
  intento INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resultados_curso ON resultados_examen(curso_id);
CREATE INDEX IF NOT EXISTS idx_resultados_participante ON resultados_examen(participante_id);

-- ═══════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
ALTER TABLE consecutivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_examen ENABLE ROW LEVEL SECURITY;

-- ── POLÍTICAS PARA ADMIN (usuarios autenticados) ─────────────
-- Admin puede hacer todo
CREATE POLICY "admin_all_consecutivos" ON consecutivos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_empresas" ON empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_participantes" ON participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_cursos" ON cursos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_preguntas" ON preguntas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_certificados" ON certificados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_resultados" ON resultados_examen FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── POLÍTICAS PÚBLICAS (anon — para exámenes y verificación) ──
-- Cursos: solo lectura pública (para el examen)
CREATE POLICY "public_read_cursos" ON cursos FOR SELECT TO anon USING (activo = true);

-- Preguntas: solo lectura pública (para el examen)
CREATE POLICY "public_read_preguntas" ON preguntas FOR SELECT TO anon USING (true);

-- Participantes: insertar y leer propio (para registro en examen)
CREATE POLICY "public_insert_participantes" ON participantes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "public_read_participantes" ON participantes FOR SELECT TO anon USING (true);

-- Certificados: leer para verificación pública por QR
CREATE POLICY "public_read_certificados" ON certificados FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_certificados" ON certificados FOR INSERT TO anon WITH CHECK (true);

-- Resultados: insertar desde examen público
CREATE POLICY "public_insert_resultados" ON resultados_examen FOR INSERT TO anon WITH CHECK (true);

-- Consecutivos: actualizar desde examen público (para generar ID único)
CREATE POLICY "public_update_consecutivos" ON consecutivos FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_read_consecutivos" ON consecutivos FOR SELECT TO anon USING (true);
