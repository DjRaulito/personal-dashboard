-- Fase 2 · Finanzas (núcleo): cuentas, categorías, movimientos, reglas y perfiles de importación.
-- Importes en céntimos (bigint). Gasto = negativo, ingreso = positivo.

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('bank', 'savings', 'card', 'cash', 'broker')),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  initial_balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (con subcategorías vía parent_id)
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, parent_id, name)
);

create index categories_parent_id_idx on public.categories (parent_id);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  booked_on date not null,
  description text not null check (char_length(description) <= 300),
  amount_cents bigint not null,
  category_id uuid references public.categories (id) on delete set null,
  notes text check (char_length(notes) <= 1000),
  source text not null default 'manual' check (source in ('manual', 'import')),
  -- Huella del movimiento importado para no duplicarlo al reimportar
  import_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id, import_hash)
);

create index transactions_user_booked_idx on public.transactions (user_id, booked_on desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- rules: autocategorización por concepto.
-- 'contains' busca la palabra o frase completa (sin tildes ni mayúsculas).
-- ---------------------------------------------------------------------------
create table public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern text not null check (char_length(pattern) between 1 and 100),
  match_type text not null default 'contains' check (match_type in ('contains', 'starts_with', 'equals')),
  amount_sign text not null default 'any' check (amount_sign in ('any', 'expense', 'income')),
  category_id uuid not null references public.categories (id) on delete cascade,
  -- Menor número = se evalúa antes
  priority integer not null default 100,
  created_at timestamptz not null default now()
);

create index rules_user_id_idx on public.rules (user_id);
create index rules_category_id_idx on public.rules (category_id);

-- ---------------------------------------------------------------------------
-- import_profiles: mapeo de columnas guardado por banco
-- ---------------------------------------------------------------------------
create table public.import_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  account_id uuid references public.accounts (id) on delete set null,
  mapping jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index import_profiles_account_id_idx on public.import_profiles (account_id);

create trigger import_profiles_set_updated_at
  before update on public.import_profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: cada usuario solo ve y toca lo suyo. Las referencias a cuentas y
-- categorías también deben ser suyas.
-- ---------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.rules enable row level security;
alter table public.import_profiles enable row level security;

-- accounts
create policy "accounts: propias" on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- categories
create policy "categories: propias" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (parent_id is null or exists (select 1 from public.categories c where c.id = categories.parent_id and c.user_id = (select auth.uid()))));

-- transactions
create policy "transactions: propias" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid()))
    and (category_id is null or exists (select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())))
  );

-- rules
create policy "rules: propias" on public.rules for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (category_id is null or exists (select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid()))));

-- import_profiles
create policy "import_profiles: propios" on public.import_profiles for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid()))));

revoke all on public.accounts, public.categories, public.transactions, public.rules, public.import_profiles from anon;
revoke truncate, references, trigger
  on public.accounts, public.categories, public.transactions, public.rules, public.import_profiles
  from authenticated;

-- ---------------------------------------------------------------------------
-- Funciones de resumen (security invoker: respetan RLS)
-- ---------------------------------------------------------------------------

-- Saldo actual de cada cuenta
create function public.account_balances()
returns table (account_id uuid, balance_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.initial_balance_cents + coalesce(sum(t.amount_cents), 0)::bigint
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  group by a.id;
$$;

-- Ingresos y gastos por mes (las transferencias no cuentan)
create function public.monthly_cashflow(p_from date, p_to date)
returns table (month date, income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    date_trunc('month', t.booked_on)::date,
    coalesce(sum(t.amount_cents) filter (where t.amount_cents > 0), 0)::bigint,
    coalesce(-sum(t.amount_cents) filter (where t.amount_cents < 0), 0)::bigint
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.booked_on >= p_from and t.booked_on < p_to
    and (c.kind is null or c.kind <> 'transfer')
  group by 1
  order by 1;
$$;

-- Gasto neto por categoría principal en un periodo (sin categoría = null)
create function public.category_spending(p_from date, p_to date)
returns table (category_id uuid, spent_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(c.parent_id, c.id), (-sum(t.amount_cents))::bigint
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.booked_on >= p_from and t.booked_on < p_to
    and (c.kind is null or c.kind = 'expense')
  group by 1
  having sum(t.amount_cents) < 0
  order by 2 desc;
$$;

-- Patrimonio al cierre de cada mes
create function public.net_worth_by_month(p_from date, p_to date)
returns table (month date, net_worth_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month')::date as m
  )
  select
    m.m,
    ((select coalesce(sum(a.initial_balance_cents), 0) from public.accounts a)
      + (select coalesce(sum(t.amount_cents), 0) from public.transactions t
         where t.booked_on < (m.m + interval '1 month')::date))::bigint
  from months m
  order by 1;
$$;

revoke all on function public.account_balances() from public, anon;
revoke all on function public.monthly_cashflow(date, date) from public, anon;
revoke all on function public.category_spending(date, date) from public, anon;
revoke all on function public.net_worth_by_month(date, date) from public, anon;
grant execute on function public.account_balances() to authenticated;
grant execute on function public.monthly_cashflow(date, date) to authenticated;
grant execute on function public.category_spending(date, date) to authenticated;
grant execute on function public.net_worth_by_month(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Datos iniciales: categorías en español y reglas para comercios habituales
-- ---------------------------------------------------------------------------
create function private.seed_finance_defaults(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent uuid;
  item record;
  sub text;
begin
  for item in
    select * from (values
      (1, 'Vivienda', 'expense', array['Alquiler o hipoteca', 'Luz', 'Agua', 'Gas', 'Internet y móvil', 'Comunidad']),
      (2, 'Alimentación', 'expense', array['Supermercado', 'Restaurantes', 'Cafés y bares', 'Comida a domicilio']),
      (3, 'Transporte', 'expense', array['Combustible', 'Transporte público', 'Taxi y VTC', 'Parking y peajes', 'Mantenimiento del coche']),
      (4, 'Salud', 'expense', array['Farmacia', 'Médico', 'Gimnasio']),
      (5, 'Ocio', 'expense', array['Suscripciones', 'Viajes', 'Eventos', 'Hobbies']),
      (6, 'Compras', 'expense', array['Ropa', 'Tecnología', 'Hogar']),
      (7, 'Educación', 'expense', array[]::text[]),
      (8, 'Seguros', 'expense', array[]::text[]),
      (9, 'Impuestos y comisiones', 'expense', array[]::text[]),
      (10, 'Regalos y donaciones', 'expense', array[]::text[]),
      (11, 'Otros gastos', 'expense', array[]::text[]),
      (12, 'Nómina', 'income', array[]::text[]),
      (13, 'Ingresos extra', 'income', array['Freelance', 'Contenido']),
      (14, 'Intereses y dividendos', 'income', array[]::text[]),
      (15, 'Devoluciones', 'income', array[]::text[]),
      (16, 'Otros ingresos', 'income', array[]::text[]),
      (17, 'Transferencias internas', 'transfer', array[]::text[]),
      (18, 'Aportaciones a inversión', 'transfer', array[]::text[])
    ) as v(ord, name, kind, subs)
    order by ord
  loop
    v_parent := null;
    insert into public.categories (user_id, name, kind)
    values (p_user, item.name, item.kind)
    on conflict do nothing
    returning id into v_parent;

    if v_parent is null then
      select c.id into v_parent from public.categories c
      where c.user_id = p_user and c.parent_id is null and c.name = item.name;
    end if;

    foreach sub in array item.subs loop
      insert into public.categories (user_id, parent_id, name, kind)
      values (p_user, v_parent, sub, item.kind)
      on conflict do nothing;
    end loop;
  end loop;

  -- Reglas: (patrón, categoría, signo, prioridad). Las más específicas primero.
  insert into public.rules (user_id, pattern, match_type, amount_sign, category_id, priority)
  select p_user, r.pattern, 'contains', r.sign, c.id, r.priority
  from (values
    ('UBER EATS', 'Comida a domicilio', 'expense', 10),
    ('GLOVO', 'Comida a domicilio', 'expense', 50),
    ('JUST EAT', 'Comida a domicilio', 'expense', 50),
    ('MERCADONA', 'Supermercado', 'expense', 50),
    ('CARREFOUR', 'Supermercado', 'expense', 50),
    ('LIDL', 'Supermercado', 'expense', 50),
    ('ALDI', 'Supermercado', 'expense', 50),
    ('ALCAMPO', 'Supermercado', 'expense', 50),
    ('EROSKI', 'Supermercado', 'expense', 50),
    ('CONSUM', 'Supermercado', 'expense', 50),
    ('SUPERMERCADO', 'Supermercado', 'expense', 60),
    ('NETFLIX', 'Suscripciones', 'expense', 50),
    ('SPOTIFY', 'Suscripciones', 'expense', 50),
    ('DISNEY', 'Suscripciones', 'expense', 50),
    ('HBO', 'Suscripciones', 'expense', 50),
    ('PRIME VIDEO', 'Suscripciones', 'expense', 50),
    ('YOUTUBE', 'Suscripciones', 'expense', 50),
    ('APPLE.COM/BILL', 'Suscripciones', 'expense', 50),
    ('REPSOL', 'Combustible', 'expense', 50),
    ('CEPSA', 'Combustible', 'expense', 50),
    ('GALP', 'Combustible', 'expense', 50),
    ('PLENOIL', 'Combustible', 'expense', 50),
    ('BALLENOIL', 'Combustible', 'expense', 50),
    ('GASOLINERA', 'Combustible', 'expense', 60),
    ('UBER', 'Taxi y VTC', 'expense', 60),
    ('CABIFY', 'Taxi y VTC', 'expense', 50),
    ('BOLT', 'Taxi y VTC', 'expense', 50),
    ('RENFE', 'Transporte público', 'expense', 50),
    ('METRO', 'Transporte público', 'expense', 60),
    ('EMT', 'Transporte público', 'expense', 60),
    ('FARMACIA', 'Farmacia', 'expense', 50),
    ('PARKING', 'Parking y peajes', 'expense', 60),
    ('AUTOPISTA', 'Parking y peajes', 'expense', 60),
    ('IBERDROLA', 'Luz', 'expense', 50),
    ('ENDESA', 'Luz', 'expense', 50),
    ('NATURGY', 'Gas', 'expense', 50),
    ('MOVISTAR', 'Internet y móvil', 'expense', 50),
    ('VODAFONE', 'Internet y móvil', 'expense', 50),
    ('ORANGE', 'Internet y móvil', 'expense', 50),
    ('DIGI MOBIL', 'Internet y móvil', 'expense', 50),
    ('AMAZON', 'Compras', 'expense', 80),
    ('ZARA', 'Ropa', 'expense', 50),
    ('PRIMARK', 'Ropa', 'expense', 50),
    ('DECATHLON', 'Compras', 'expense', 50),
    ('IKEA', 'Hogar', 'expense', 50),
    ('MEDIA MARKT', 'Tecnología', 'expense', 50),
    ('COMISION', 'Impuestos y comisiones', 'expense', 70),
    ('AEAT', 'Impuestos y comisiones', 'any', 50),
    ('NOMINA', 'Nómina', 'income', 10),
    ('INTERESES', 'Intereses y dividendos', 'income', 50),
    ('DIVIDENDO', 'Intereses y dividendos', 'income', 50),
    ('DEVOLUCION', 'Devoluciones', 'income', 60),
    ('MYINVESTOR', 'Aportaciones a inversión', 'any', 70),
    ('TRASPASO', 'Transferencias internas', 'any', 80)
  ) as r(pattern, category, sign, priority)
  join public.categories c on c.user_id = p_user and c.name = r.category
  where not exists (
    select 1 from public.rules x where x.user_id = p_user and x.pattern = r.pattern
  );
end;
$$;

revoke all on function private.seed_finance_defaults(uuid) from public, anon, authenticated;

-- El alta de usuario ahora también crea las categorías y reglas iniciales
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from private.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'Email no autorizado' using errcode = '42501';
  end if;

  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  perform private.seed_finance_defaults(new.id);

  return new;
end;
$$;

-- Usuarios ya existentes
select private.seed_finance_defaults(id) from auth.users;
