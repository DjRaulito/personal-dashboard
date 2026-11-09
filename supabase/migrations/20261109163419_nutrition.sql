-- Fase 5 · Nutrición: alimentos con macros, plan por intercambios (comidas → grupos → opciones),
-- registro diario, checklist de comidas, cheat meals y revisiones con la nutricionista.
-- Macros por 100 g (o 100 ml). Cantidades en gramos.

-- ---------------------------------------------------------------------------
-- nutrition_foods
-- ---------------------------------------------------------------------------
create table public.nutrition_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kcal numeric(6, 1) not null check (kcal between 0 and 1000),
  protein_g numeric(5, 1) not null default 0 check (protein_g between 0 and 100),
  carbs_g numeric(5, 1) not null default 0 check (carbs_g between 0 and 100),
  fat_g numeric(5, 1) not null default 0 check (fat_g between 0 and 100),
  -- Para alimentos que se cuentan por unidades (huevo, pieza de fruta, lata, bolsa…)
  unit_label text check (char_length(unit_label) <= 30),
  unit_grams numeric(6, 1) check (unit_grams > 0 and unit_grams < 10000),
  source text not null default 'manual' check (source in ('manual', 'ai', 'seed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create trigger nutrition_foods_set_updated_at
  before update on public.nutrition_foods
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Plan: nutrition_plans → nutrition_plan_meals → nutrition_plan_groups → nutrition_plan_options
-- ---------------------------------------------------------------------------
create table public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  active boolean not null default true,
  starts_on date,
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index nutrition_plans_user_id_idx on public.nutrition_plans (user_id);
-- Un solo plan activo por usuario
create unique index nutrition_plans_one_active on public.nutrition_plans (user_id) where active;

create trigger nutrition_plans_set_updated_at
  before update on public.nutrition_plans
  for each row execute function private.set_updated_at();

create table public.nutrition_plan_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.nutrition_plans (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position smallint not null default 0,
  notes text check (char_length(notes) <= 1000)
);

create index nutrition_plan_meals_plan_id_idx on public.nutrition_plan_meals (plan_id, position);

-- kind decide el macro con el que se comparan alimentos del grupo:
-- protein → proteína, carbs/fruit → hidratos, fat → grasa, dairy/other → kcal, veg → libre
create table public.nutrition_plan_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_id uuid not null references public.nutrition_plan_meals (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('protein', 'carbs', 'fat', 'fruit', 'dairy', 'veg', 'supplement', 'other')),
  position smallint not null default 0,
  notes text check (char_length(notes) <= 1000)
);

create index nutrition_plan_groups_meal_id_idx on public.nutrition_plan_groups (meal_id, position);

create table public.nutrition_plan_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null references public.nutrition_plan_groups (id) on delete cascade,
  food_id uuid not null references public.nutrition_foods (id) on delete cascade,
  -- Cantidad de una ración: gramos/ml, o unidades si unit = 'ud'
  amount numeric(7, 2) not null check (amount > 0),
  unit text not null default 'g' check (unit in ('g', 'ml', 'ud')),
  position smallint not null default 0
);

create index nutrition_plan_options_group_id_idx on public.nutrition_plan_options (group_id, position);
create index nutrition_plan_options_food_id_idx on public.nutrition_plan_options (food_id);

-- ---------------------------------------------------------------------------
-- Registro diario
-- ---------------------------------------------------------------------------
create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on date not null,
  meal_id uuid references public.nutrition_plan_meals (id) on delete set null,
  group_id uuid references public.nutrition_plan_groups (id) on delete set null,
  food_id uuid not null references public.nutrition_foods (id) on delete cascade,
  grams numeric(7, 1) not null check (grams > 0 and grams < 10000),
  created_at timestamptz not null default now()
);

create index nutrition_logs_user_day_idx on public.nutrition_logs (user_id, eaten_on);
create index nutrition_logs_meal_id_idx on public.nutrition_logs (meal_id);
create index nutrition_logs_group_id_idx on public.nutrition_logs (group_id);
create index nutrition_logs_food_id_idx on public.nutrition_logs (food_id);

-- Checklist: cómo fue cada comida del plan ese día
create table public.nutrition_meal_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  meal_id uuid not null references public.nutrition_plan_meals (id) on delete cascade,
  status text not null check (status in ('done', 'less', 'more', 'skipped', 'cheat')),
  note text check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  unique (user_id, day, meal_id)
);

create index nutrition_meal_checks_meal_id_idx on public.nutrition_meal_checks (meal_id);

create trigger nutrition_meal_checks_set_updated_at
  before update on public.nutrition_meal_checks
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Cheat meals
-- ---------------------------------------------------------------------------
create table public.nutrition_cheats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on date not null,
  description text not null check (char_length(description) between 1 and 1000),
  kcal integer check (kcal between 0 and 20000),
  protein_g integer check (protein_g between 0 and 2000),
  carbs_g integer check (carbs_g between 0 and 2000),
  fat_g integer check (fat_g between 0 and 2000),
  estimated_by text not null default 'manual' check (estimated_by in ('manual', 'ai')),
  ai_notes text check (char_length(ai_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index nutrition_cheats_user_day_idx on public.nutrition_cheats (user_id, eaten_on desc);

create trigger nutrition_cheats_set_updated_at
  before update on public.nutrition_cheats
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Revisiones con la nutricionista (peso y perímetros viven en body_measurements)
-- ---------------------------------------------------------------------------
create table public.nutrition_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  review_on date not null,
  phase text check (char_length(phase) <= 60),
  adherence smallint check (adherence between 1 and 5),
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, review_on)
);

create trigger nutrition_reviews_set_updated_at
  before update on public.nutrition_reviews
  for each row execute function private.set_updated_at();

-- Perímetros de la hoja de control que faltaban
alter table public.body_measurements
  add column shoulder_cm numeric(5, 1) check (shoulder_cm between 50 and 250),
  add column abdomen_cm numeric(5, 1) check (abdomen_cm between 30 and 250),
  add column hip_cm numeric(5, 1) check (hip_cm between 30 and 250),
  add column calf_cm numeric(4, 1) check (calf_cm between 15 and 80);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.nutrition_foods enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.nutrition_plan_meals enable row level security;
alter table public.nutrition_plan_groups enable row level security;
alter table public.nutrition_plan_options enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.nutrition_meal_checks enable row level security;
alter table public.nutrition_cheats enable row level security;
alter table public.nutrition_reviews enable row level security;

create policy "nutrition_foods: propios" on public.nutrition_foods for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "nutrition_plans: propios" on public.nutrition_plans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "nutrition_plan_meals: propias" on public.nutrition_plan_meals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.nutrition_plans p where p.id = plan_id and p.user_id = (select auth.uid())));

create policy "nutrition_plan_groups: propios" on public.nutrition_plan_groups for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.nutrition_plan_meals m where m.id = meal_id and m.user_id = (select auth.uid())));

create policy "nutrition_plan_options: propias" on public.nutrition_plan_options for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.nutrition_plan_groups g where g.id = group_id and g.user_id = (select auth.uid()))
    and exists (select 1 from public.nutrition_foods f where f.id = food_id and f.user_id = (select auth.uid())));

create policy "nutrition_logs: propios" on public.nutrition_logs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.nutrition_foods f where f.id = food_id and f.user_id = (select auth.uid()))
    and (meal_id is null
      or exists (select 1 from public.nutrition_plan_meals m where m.id = meal_id and m.user_id = (select auth.uid())))
    and (group_id is null
      or exists (select 1 from public.nutrition_plan_groups g where g.id = group_id and g.user_id = (select auth.uid()))));

create policy "nutrition_meal_checks: propios" on public.nutrition_meal_checks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.nutrition_plan_meals m where m.id = meal_id and m.user_id = (select auth.uid())));

create policy "nutrition_cheats: propios" on public.nutrition_cheats for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "nutrition_reviews: propias" on public.nutrition_reviews for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.nutrition_foods, public.nutrition_plans, public.nutrition_plan_meals,
  public.nutrition_plan_groups, public.nutrition_plan_options, public.nutrition_logs,
  public.nutrition_meal_checks, public.nutrition_cheats, public.nutrition_reviews from anon;
