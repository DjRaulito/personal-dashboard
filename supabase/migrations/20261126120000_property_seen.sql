-- «Visto» en el radar de inmuebles, aparte del estado de decisión (nuevo, investigar…):
-- permite marcar como leídos los anuncios sin cambiar su estado.
alter table public.property_listings add column if not exists seen_at timestamptz;
