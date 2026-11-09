-- Fase 3 · Inversiones: activos, operaciones, precios diarios y tipos de cambio.
-- Cantidades y precios en numeric (fondos con muchos decimales); efectivo en céntimos de euro.

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  isin text check (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  symbol text check (char_length(symbol) <= 30), -- símbolo de Investing
  market text check (char_length(market) <= 30),
  kind text not null default 'stock' check (kind in ('fund', 'stock', 'etf', 'pension', 'other')),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'), -- GBX = peniques
  broker text not null default 'other' check (broker in ('myinvestor', 'mexem', 'other')),
  -- De dónde sale el precio diario: 'yahoo' (price_symbol) o 'manual'
  price_source text not null default 'yahoo' check (price_source in ('yahoo', 'manual')),
  price_symbol text check (char_length(price_symbol) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index assets_user_isin_key on public.assets (user_id, isin) where isin is not null;
create unique index assets_user_symbol_key on public.assets (user_id, symbol) where isin is null and symbol is not null;
create index assets_user_id_idx on public.assets (user_id);

create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- investment_operations
-- cash_eur_cents: positivo = sale dinero (compra, comisión); negativo = entra (venta, dividendo).
-- Si la operación fue en divisa y no se conoce el importe en euros, queda null y se usa
-- gross_local (en la moneda del activo) con el tipo de cambio del día.
-- ---------------------------------------------------------------------------
create table public.investment_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  type text not null check (type in ('buy', 'sell', 'dividend', 'fee')),
  trade_date date not null,
  quantity numeric(24, 10) not null default 0 check (quantity >= 0),
  price numeric(24, 10),
  cash_eur_cents bigint,
  gross_local numeric(24, 6),
  is_split boolean not null default false,
  source text not null default 'manual' check (source in ('investing', 'myinvestor', 'mexem', 'manual')),
  external_id text check (char_length(external_id) <= 200),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index investment_operations_asset_date_idx on public.investment_operations (asset_id, trade_date);
create index investment_operations_user_date_idx on public.investment_operations (user_id, trade_date);

create trigger investment_operations_set_updated_at
  before update on public.investment_operations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- asset_prices: cierre diario en la moneda del activo
-- ---------------------------------------------------------------------------
create table public.asset_prices (
  asset_id uuid not null references public.assets (id) on delete cascade,
  price_date date not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  close numeric(24, 10) not null check (close >= 0),
  source text not null default 'yahoo' check (source in ('yahoo', 'manual', 'investing', 'trade')),
  primary key (asset_id, price_date)
);

create index asset_prices_user_id_idx on public.asset_prices (user_id);

-- ---------------------------------------------------------------------------
-- fx_rates: valor en euros de 1 unidad de la divisa (BCE)
-- ---------------------------------------------------------------------------
create table public.fx_rates (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  rate_date date not null,
  eur_per_unit numeric(24, 10) not null check (eur_per_unit > 0),
  primary key (user_id, currency, rate_date)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.assets enable row level security;
alter table public.investment_operations enable row level security;
alter table public.asset_prices enable row level security;
alter table public.fx_rates enable row level security;

create policy "assets: propios" on public.assets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "investment_operations: propias" on public.investment_operations for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.assets a where a.id = asset_id and a.user_id = (select auth.uid()))
  );

create policy "asset_prices: propios" on public.asset_prices for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.assets a where a.id = asset_id and a.user_id = (select auth.uid()))
  );

create policy "fx_rates: propios" on public.fx_rates for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.assets, public.investment_operations, public.asset_prices, public.fx_rates from anon;
revoke truncate, references, trigger
  on public.assets, public.investment_operations, public.asset_prices, public.fx_rates
  from authenticated;
