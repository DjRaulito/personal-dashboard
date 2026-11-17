-- Nutrición, segunda versión: apartado por alimento, precio aproximado para la lista de la
-- compra, alimentos elegidos para la semana y la hoja de control de la nutricionista.

-- ---------------------------------------------------------------------------
-- Alimentos: apartado y precio
-- ---------------------------------------------------------------------------
alter table public.nutrition_foods
  add column category text not null default 'other'
    check (category in ('protein', 'carbs', 'fat', 'fruit', 'dairy', 'veg', 'other')),
  add column price_cents_per_kg integer check (price_cents_per_kg between 0 and 100000),
  add column price_source text check (price_source in ('manual', 'ai'));

-- Apartado inicial: el grupo del plan donde más aparece el alimento (o su versión en crudo)…
with used as (
  select f.id, mode() within group (order by g.kind) as kind
  from public.nutrition_foods f
  join public.nutrition_plan_options o on o.food_id in (f.id, f.cooked_from)
  join public.nutrition_plan_groups g on g.id = o.group_id
  group by f.id
)
update public.nutrition_foods f
set category = case when u.kind = 'supplement' then 'other' else u.kind end
from used u
where u.id = f.id;

-- …y, si no está en el plan, el macro que más calorías le aporta
update public.nutrition_foods f
set category = case
  when f.protein_g * 4 >= f.carbs_g * 4 and f.protein_g * 4 >= f.fat_g * 9 and f.protein_g > 0 then 'protein'
  when f.carbs_g * 4 >= f.fat_g * 9 and f.carbs_g > 0 then 'carbs'
  when f.fat_g > 0 then 'fat'
  else 'other'
end
where f.category = 'other'
  and not exists (select 1 from public.nutrition_plan_options o where o.food_id in (f.id, f.cooked_from));

-- ---------------------------------------------------------------------------
-- Lista de la compra: qué opciones del plan se comen en una semana normal y cuántos días
-- ---------------------------------------------------------------------------
create table public.nutrition_shopping_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  option_id uuid not null references public.nutrition_plan_options (id) on delete cascade,
  days_per_week smallint not null check (days_per_week between 1 and 7),
  updated_at timestamptz not null default now(),
  unique (user_id, option_id)
);

create index nutrition_shopping_picks_option_id_idx on public.nutrition_shopping_picks (option_id);

create trigger nutrition_shopping_picks_set_updated_at
  before update on public.nutrition_shopping_picks
  for each row execute function private.set_updated_at();

alter table public.nutrition_shopping_picks enable row level security;

create policy "nutrition_shopping_picks: propias" on public.nutrition_shopping_picks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.nutrition_plan_options o
      where o.id = option_id and o.user_id = (select auth.uid())));

revoke all on public.nutrition_shopping_picks from anon;

-- ---------------------------------------------------------------------------
-- Ajustes: la hoja de cálculo de control (peso y perímetros) que rellena la nutricionista
-- ---------------------------------------------------------------------------
create table public.nutrition_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  review_sheet_id text check (review_sheet_id ~ '^[A-Za-z0-9_-]{20,120}$'),
  reviews_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger nutrition_settings_set_updated_at
  before update on public.nutrition_settings
  for each row execute function private.set_updated_at();

alter table public.nutrition_settings enable row level security;

create policy "nutrition_settings: propios" on public.nutrition_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.nutrition_settings from anon;
