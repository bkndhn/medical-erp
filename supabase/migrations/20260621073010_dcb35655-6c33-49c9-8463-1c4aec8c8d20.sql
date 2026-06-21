ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS rx_image_url text,
  ADD COLUMN IF NOT EXISTS doctor_name text,
  ADD COLUMN IF NOT EXISTS rx_required boolean NOT NULL DEFAULT false;