-- Cotizador Especial: soporta cotizar SERVICIOS además de cursos.
-- Corre esto en Supabase antes de desplegar el JSX.
ALTER TABLE cotizaciones_especiales ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'curso';
ALTER TABLE cotizaciones_especiales ADD COLUMN IF NOT EXISTS detalle_servicio TEXT;
ALTER TABLE cotizaciones_especiales ADD COLUMN IF NOT EXISTS condiciones_manual TEXT;
