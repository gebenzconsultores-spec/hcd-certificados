-- 1) Examen: opción por curso para mostrar las preguntas en orden aleatorio
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS preguntas_aleatorias BOOLEAN DEFAULT FALSE;

-- 2) "Comparte tu logro": foto grupal y frase por curso programado (Calendario de cursos)
ALTER TABLE cursos_confirmados ADD COLUMN IF NOT EXISTS foto_grupal_url TEXT;
ALTER TABLE cursos_confirmados ADD COLUMN IF NOT EXISTS frase_compartir TEXT;

-- 3) Bucket público para las fotos grupales (se ven sin iniciar sesión)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-grupales', 'fotos-grupales', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Solo el panel admin (usuario con sesión) puede subir / cambiar / borrar fotos
DROP POLICY IF EXISTS "fotos grupales: admin sube" ON storage.objects;
CREATE POLICY "fotos grupales: admin sube" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-grupales');
DROP POLICY IF EXISTS "fotos grupales: admin actualiza" ON storage.objects;
CREATE POLICY "fotos grupales: admin actualiza" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'fotos-grupales');
DROP POLICY IF EXISTS "fotos grupales: admin borra" ON storage.objects;
CREATE POLICY "fotos grupales: admin borra" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'fotos-grupales');
DROP POLICY IF EXISTS "fotos grupales: lectura" ON storage.objects;
CREATE POLICY "fotos grupales: lectura" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos-grupales');
