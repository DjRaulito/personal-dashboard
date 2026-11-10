-- Fase 8 · Contenido: banco de ideas y piezas (kanban), métricas por publicación e ingresos
-- enlazados con los movimientos de Finanzas.

-- ---------------------------------------------------------------------------
-- content_pieces: una idea que avanza por el tablero hasta «publicada».
-- position ordena las fichas dentro de cada columna (huecos para mover sin renumerar).
-- ---------------------------------------------------------------------------
create table public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'idea' check (
    status in ('idea', 'script', 'recording', 'editing', 'scheduled', 'published')
  ),
  format text not null default 'short' check (format in ('short', 'long', 'post', 'story')),
  platforms text[] not null default '{}' check (
    platforms <@ array['youtube', 'instagram', 'tiktok', 'other']::text[] and cardinality(platforms) <= 4
  ),
  priority smallint not null default 2 check (priority between 1 and 3),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  script text check (char_length(script) <= 20000),
  notes text check (char_length(notes) <= 5000),
  links text[] not null default '{}' check (cardinality(links) <= 10),
  publish_at timestamptz,
  published_url text check (char_length(published_url) <= 500),
  calendar_event_id text check (char_length(calendar_event_id) <= 200),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_pieces_user_status_idx on public.content_pieces (user_id, status, position);
create index content_pieces_user_publish_idx on public.content_pieces (user_id, publish_at) where publish_at is not null;

create trigger content_pieces_set_updated_at
  before update on public.content_pieces
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- content_metrics: cifras apuntadas a mano por plataforma y día.
-- ---------------------------------------------------------------------------
create table public.content_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  piece_id uuid not null references public.content_pieces (id) on delete cascade,
  platform text not null check (platform in ('youtube', 'instagram', 'tiktok', 'other')),
  recorded_on date not null default current_date,
  views integer not null default 0 check (views >= 0),
  likes integer not null default 0 check (likes >= 0),
  comments integer not null default 0 check (comments >= 0),
  shares integer not null default 0 check (shares >= 0),
  saves integer not null default 0 check (saves >= 0),
  followers_gained integer not null default 0 check (followers_gained between -1000000 and 100000000),
  created_at timestamptz not null default now(),
  unique (piece_id, platform, recorded_on)
);

create index content_metrics_user_idx on public.content_metrics (user_id, recorded_on desc);

-- ---------------------------------------------------------------------------
-- content_piece_transactions: ingresos (o gastos) de Finanzas atribuidos a una pieza.
-- ---------------------------------------------------------------------------
create table public.content_piece_transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  piece_id uuid not null references public.content_pieces (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (piece_id, transaction_id)
);

create index content_piece_transactions_tx_idx on public.content_piece_transactions (transaction_id);
create index content_piece_transactions_user_idx on public.content_piece_transactions (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.content_pieces enable row level security;
alter table public.content_metrics enable row level security;
alter table public.content_piece_transactions enable row level security;

create policy "content_pieces: propias" on public.content_pieces for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "content_metrics: propias" on public.content_metrics for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.content_pieces p where p.id = piece_id and p.user_id = (select auth.uid()))
  );

create policy "content_piece_transactions: propias" on public.content_piece_transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.content_pieces p where p.id = piece_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = (select auth.uid()))
  );

revoke all on public.content_pieces, public.content_metrics, public.content_piece_transactions from anon;
