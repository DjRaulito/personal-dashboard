-- Comentario de la IA sobre cada semana (portada). Una fila por semana; se puede regenerar.
create table public.ai_weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  comment text not null check (char_length(comment) between 1 and 4000),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.ai_weekly_summaries enable row level security;

create policy "ai_weekly_summaries: propios" on public.ai_weekly_summaries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.ai_weekly_summaries from anon;
