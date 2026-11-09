-- Fase 3 · Planificación: presupuestos mensuales por categoría, huchas (objetivos de ahorro)
-- y pagos recurrentes. Importes en céntimos.

-- ---------------------------------------------------------------------------
-- budgets: límite mensual de gasto para una categoría principal
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents < 1000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create index budgets_category_id_idx on public.budgets (category_id);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- savings_goals: huchas. El ahorro es el saldo de la cuenta enlazada o un importe a mano.
-- ---------------------------------------------------------------------------
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  target_cents bigint not null check (target_cents > 0 and target_cents < 100000000000),
  saved_cents bigint not null default 0 check (saved_cents >= 0),
  account_id uuid references public.accounts (id) on delete set null,
  target_date date,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index savings_goals_user_id_idx on public.savings_goals (user_id);
create index savings_goals_account_id_idx on public.savings_goals (account_id);

create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- recurring_payments: suscripciones, recibos y nóminas.
-- amount_cents: negativo = pago, positivo = cobro. match_pattern sirve para
-- reconocer el cargo en los movimientos y dar el pago del periodo por hecho.
-- ---------------------------------------------------------------------------
create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount_cents bigint not null check (amount_cents <> 0 and abs(amount_cents) < 1000000000),
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_due date not null,
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  match_pattern text check (char_length(match_pattern) between 2 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_payments_user_due_idx on public.recurring_payments (user_id, next_due);
create index recurring_payments_category_id_idx on public.recurring_payments (category_id);
create index recurring_payments_account_id_idx on public.recurring_payments (account_id);

create trigger recurring_payments_set_updated_at
  before update on public.recurring_payments
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: solo lo propio, y las referencias también deben ser propias
-- ---------------------------------------------------------------------------
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.recurring_payments enable row level security;

create policy "budgets: propios" on public.budgets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid()))
  );

create policy "savings_goals: propias" on public.savings_goals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (account_id is null
      or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid())))
  );

create policy "recurring_payments: propios" on public.recurring_payments for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (category_id is null
      or exists (select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())))
    and (account_id is null
      or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid())))
  );

revoke all on public.budgets, public.savings_goals, public.recurring_payments from anon;
