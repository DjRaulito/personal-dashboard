-- Patrimonio al día: una foto diaria del patrimonio (la escribe la app al abrir Patrimonio y el
-- cron diario) y la fecha del último movimiento de cada cuenta (para avisar de datos viejos).

create table public.net_worth_snapshots (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  cash_cents bigint not null,
  investments_cents bigint not null,
  total_cents bigint generated always as (cash_cents + investments_cents) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create trigger net_worth_snapshots_set_updated_at
  before update on public.net_worth_snapshots
  for each row execute function private.set_updated_at();

alter table public.net_worth_snapshots enable row level security;

create policy "net_worth_snapshots: propias" on public.net_worth_snapshots for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.net_worth_snapshots from anon;

-- Último movimiento de cada cuenta (security invoker: respeta RLS)
create function public.account_last_movements()
returns table (account_id uuid, last_booked_on date)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.account_id, max(t.booked_on)
  from public.transactions t
  group by t.account_id;
$$;

revoke execute on function public.account_last_movements() from anon;
