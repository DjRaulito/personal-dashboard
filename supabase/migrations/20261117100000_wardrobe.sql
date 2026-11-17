-- Armario: prendas con foto, outfits guardados y la ciudad para el tiempo.
-- Las fotos van a un bucket privado de Storage (carpeta = id del usuario), nunca al repo.

-- ---------------------------------------------------------------------------
-- Prendas
-- ---------------------------------------------------------------------------
create table public.wardrobe_garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (category in ('top', 'bottom', 'outerwear', 'shoes', 'accessory')),
  colors text[] not null default '{}'
    check (cardinality(colors) <= 4 and colors <@ array[
      'black', 'white', 'grey', 'beige', 'brown', 'navy', 'blue', 'green',
      'red', 'pink', 'yellow', 'orange', 'purple'
    ]::text[]),
  -- 1 ligera (calor), 2 entretiempo, 3 abrigada (frío)
  warmth smallint not null default 2 check (warmth between 1 and 3),
  occasions text[] not null default '{}'
    check (occasions <@ array['daily', 'work', 'sport', 'night', 'formal']::text[]),
  -- Ruta dentro del bucket «wardrobe»: «<user_id>/<archivo>»
  image_path text not null check (char_length(image_path) between 10 and 200),
  -- true si la foto ya tiene el fondo quitado (se puede vestir en el maniquí)
  cutout boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wardrobe_garments_user_idx on public.wardrobe_garments (user_id, category);

create trigger wardrobe_garments_set_updated_at
  before update on public.wardrobe_garments
  for each row execute function private.set_updated_at();

alter table public.wardrobe_garments enable row level security;

create policy "wardrobe_garments: propias" on public.wardrobe_garments for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and (storage.foldername(image_path))[1] = (select auth.uid())::text);

revoke all on public.wardrobe_garments from anon;

-- ---------------------------------------------------------------------------
-- Outfits guardados
-- ---------------------------------------------------------------------------
create table public.wardrobe_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  occasion text check (occasion in ('daily', 'work', 'sport', 'night', 'formal')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create index wardrobe_outfits_user_idx on public.wardrobe_outfits (user_id, created_at desc);

alter table public.wardrobe_outfits enable row level security;

create policy "wardrobe_outfits: propios" on public.wardrobe_outfits for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.wardrobe_outfits from anon;

create table public.wardrobe_outfit_items (
  outfit_id uuid not null references public.wardrobe_outfits (id) on delete cascade,
  garment_id uuid not null references public.wardrobe_garments (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (outfit_id, garment_id)
);

create index wardrobe_outfit_items_garment_idx on public.wardrobe_outfit_items (garment_id);
create index wardrobe_outfit_items_user_idx on public.wardrobe_outfit_items (user_id);

alter table public.wardrobe_outfit_items enable row level security;

create policy "wardrobe_outfit_items: propios" on public.wardrobe_outfit_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.wardrobe_outfits o
      where o.id = outfit_id and o.user_id = (select auth.uid()))
    and exists (select 1 from public.wardrobe_garments g
      where g.id = garment_id and g.user_id = (select auth.uid())));

revoke all on public.wardrobe_outfit_items from anon;

-- ---------------------------------------------------------------------------
-- Ajustes: la ciudad para consultar el tiempo
-- ---------------------------------------------------------------------------
create table public.wardrobe_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  city text check (char_length(city) between 1 and 80),
  latitude numeric(7, 4) check (latitude between -90 and 90),
  longitude numeric(7, 4) check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

create trigger wardrobe_settings_set_updated_at
  before update on public.wardrobe_settings
  for each row execute function private.set_updated_at();

alter table public.wardrobe_settings enable row level security;

create policy "wardrobe_settings: propios" on public.wardrobe_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.wardrobe_settings from anon;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para las fotos de las prendas (carpeta = id del usuario)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "wardrobe: propias" on storage.objects for all to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
