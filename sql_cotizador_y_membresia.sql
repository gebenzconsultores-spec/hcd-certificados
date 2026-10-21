-- Cotizador Especial: condiciones de pago y enlace al PDF enviado
ALTER TABLE cotizaciones_especiales ADD COLUMN IF NOT EXISTS condiciones_pago TEXT;
ALTER TABLE cotizaciones_especiales ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Bucket público para los PDF de cotizaciones que se mandan por WhatsApp / correo
-- (cada archivo lleva un nombre aleatorio, solo lo abre quien recibe el enlace)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cotizaciones', 'cotizaciones', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "cotizaciones pdf: admin sube" ON storage.objects;
CREATE POLICY "cotizaciones pdf: admin sube" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cotizaciones');
DROP POLICY IF EXISTS "cotizaciones pdf: admin actualiza" ON storage.objects;
CREATE POLICY "cotizaciones pdf: admin actualiza" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'cotizaciones');
DROP POLICY IF EXISTS "cotizaciones pdf: lectura" ON storage.objects;
CREATE POLICY "cotizaciones pdf: lectura" ON storage.objects
  FOR SELECT USING (bucket_id = 'cotizaciones');
