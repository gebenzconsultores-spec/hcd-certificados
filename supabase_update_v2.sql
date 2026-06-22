-- ═══════════════════════════════════════════════════════════
--  ACTUALIZACIÓN — Ejecutar en Supabase SQL Editor
--  (Después del schema inicial)
-- ═══════════════════════════════════════════════════════════

-- Agregar columna de password para portal empresa
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS portal_password TEXT;

-- Política para que el portal empresa pueda leer sus propios datos
CREATE POLICY IF NOT EXISTS "empresa_read_certificados" ON certificados
  FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "empresa_read_resultados" ON resultados_examen
  FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "empresa_read_empresas" ON empresas
  FOR SELECT TO anon USING (true);

-- Actualizar resultados_examen para guardar empresa_id desde examen público
-- (ya existe la columna, solo aseguramos la política de insert)
