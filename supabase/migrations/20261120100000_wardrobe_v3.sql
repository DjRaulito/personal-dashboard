-- Armario v3: la IA nombra los colores (nombre, familia, tono y hex), se apunta lo que te pones
-- y los outfits pueden ser favoritos.

alter table public.wardrobe_garments
  add column color_details jsonb not null default '[]'::jsonb
    check (jsonb_typeof(color_details) = 'array' and jsonb_array_length(color_details) <= 4),
  add column pattern text not null default 'plain'
    check (pattern in ('plain', 'stripes', 'checks', 'print', 'other')),
  add column fabric text check (char_length(fabric) <= 40),
  add column formality smallint not null default 2 check (formality between 1 and 5),
  -- La IA y el color medido en la foto no coinciden: revisar con luz natural
  add column needs_review boolean not null default false;

alter table public.wardrobe_outfits add column favorite boolean not null default false;

-- «Me lo pongo»: una fila por prenda y día
create table public.wardrobe_wears (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  garment_id uuid not null references public.wardrobe_garments (id) on delete cascade,
  worn_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, garment_id, worn_on)
);

create index wardrobe_wears_garment_idx on public.wardrobe_wears (garment_id);

alter table public.wardrobe_wears enable row level security;

create policy "wardrobe_wears: propias" on public.wardrobe_wears for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.wardrobe_garments g where g.id = garment_id and g.user_id = (select auth.uid()))
  );

revoke all on public.wardrobe_wears from anon;
