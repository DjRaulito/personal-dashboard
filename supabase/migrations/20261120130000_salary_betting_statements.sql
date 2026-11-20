-- Finanzas: salario de respaldo, casas de apuestas con saldo a mano y extractos sincronizados.

-- Casas de apuestas: cuenta de tipo «betting» cuyo saldo se apunta a mano
alter table public.accounts drop constraint accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type = any (array['bank', 'savings', 'card', 'cash', 'broker', 'betting']));
alter table public.accounts
  add column manual_balance_cents bigint,
  add column manual_balance_on date;

-- El saldo apuntado a mano manda sobre la suma de movimientos
create or replace function public.account_balances()
returns table (account_id uuid, balance_cents bigint)
language sql
stable
set search_path = ''
as $$
  select a.id, coalesce(a.manual_balance_cents, a.initial_balance_cents + coalesce(sum(t.amount_cents), 0)::bigint)
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  group by a.id;
$$;

-- Salario neto de respaldo para los meses sin extracto todavía
alter table public.profiles
  add column monthly_salary_cents bigint check (monthly_salary_cents is null or monthly_salary_cents >= 0);

-- Origen de los movimientos: también extractos en PDF y el histórico de Excel
alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source = any (array['manual', 'import', 'statement', 'excel']));

-- Extractos de Drive ya leídos (para abrir solo los nuevos)
create table public.statement_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  drive_file_id text not null check (char_length(drive_file_id) <= 200),
  name text not null check (char_length(name) <= 300),
  period text check (period ~ '^\d{4}-\d{2}$'),
  rows_found integer not null default 0,
  inserted integer not null default 0,
  balance_ok boolean,
  processed_at timestamptz not null default now(),
  unique (user_id, drive_file_id)
);

create index statement_files_account_id_idx on public.statement_files (account_id);

alter table public.statement_files enable row level security;

create policy "statement_files: propios" on public.statement_files for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.statement_files from anon;
