-- Inmuebles: pisos que encuentra la tarea diaria de Cowork (datos, no informes) y los supuestos de Raúl.
-- Las cuentas (rentabilidad, cash flow, puntuación) se hacen en la app. Todo con RLS; el acceso sin
-- sesión pasa solo por property_call, que comprueba un token del cerebro (brain_tokens).

create table public.property_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  assumptions jsonb not null default '{}'::jsonb,
  criteria jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.property_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null check (char_length(url) between 8 and 600),
  -- La misma URL sin parámetros ni barra final: evita duplicados por enlaces con seguimiento
  url_key text generated always as (lower(regexp_replace(regexp_replace(url, '[?#].*$', ''), '/+$', ''))) stored,
  source text not null default '' check (char_length(source) <= 60),
  title text not null default '' check (char_length(title) <= 200),
  municipality text not null check (char_length(municipality) between 1 and 80),
  neighborhood text not null default '' check (char_length(neighborhood) <= 80),
  price_cents bigint not null check (price_cents > 0),
  first_price_cents bigint not null check (first_price_cents > 0),
  sqm numeric(7, 2) check (sqm > 0),
  rooms smallint check (rooms >= 0),
  confidence text not null default 'media' check (confidence in ('alta', 'media', 'baja')),
  listing_state text not null default 'activo' check (listing_state in ('activo', 'retirado', 'desconocido')),
  status text not null default 'nuevo' check (status in ('nuevo', 'investigar', 'negociar', 'esperar', 'descartado')),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 60000),
  user_notes text not null default '' check (char_length(user_notes) <= 4000),
  discard_reason text not null default '' check (char_length(discard_reason) <= 300),
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url_key)
);

create index property_listings_user_seen_idx on public.property_listings (user_id, first_seen_at desc);

create trigger property_listings_set_updated_at
  before update on public.property_listings
  for each row execute function private.set_updated_at();

create table public.property_price_history (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  listing_id uuid not null references public.property_listings (id) on delete cascade,
  price_cents bigint not null check (price_cents > 0),
  seen_at timestamptz not null default now()
);

create index property_price_history_listing_idx on public.property_price_history (listing_id, seen_at);
create index property_price_history_user_idx on public.property_price_history (user_id);

-- Una fila por ejecución de la tarea: anuncios examinados y resumen corto
create table public.property_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ran_at timestamptz not null default now(),
  examined integer not null default 0 check (examined between 0 and 10000),
  saved integer not null default 0 check (saved between 0 and 1000),
  summary text not null default '' check (char_length(summary) <= 2000)
);

create index property_runs_user_ran_idx on public.property_runs (user_id, ran_at desc);

alter table public.property_settings enable row level security;
alter table public.property_listings enable row level security;
alter table public.property_price_history enable row level security;
alter table public.property_runs enable row level security;

create policy "property_settings: propios" on public.property_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "property_listings: propios" on public.property_listings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "property_price_history: propios" on public.property_price_history for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "property_runs: propios" on public.property_runs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.property_settings, public.property_listings, public.property_price_history, public.property_runs from anon;

-- ---------------------------------------------------------------------------
-- property_call: único punto de entrada del conector MCP de inmuebles.
-- Acciones: context, save_listing, mark_removed, save_run. Los datos llegan ya validados por la app,
-- y las restricciones de las tablas los vuelven a comprobar.
-- ---------------------------------------------------------------------------
create or replace function public.property_call(p_token text, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
  v_user uuid;
  v_id uuid;
  v_old bigint;
  v_price bigint;
  v_key text;
  v_n int;
begin
  select user_id into v_user from public.brain_tokens where token_hash = v_hash;
  if v_user is null then
    return jsonb_build_object('error', 'Token no válido');
  end if;
  update public.brain_tokens set last_used_at = now() where token_hash = v_hash;

  if p_action = 'context' then
    return jsonb_build_object(
      'settings', coalesce((
        select jsonb_build_object('assumptions', s.assumptions, 'criteria', s.criteria)
        from public.property_settings s where s.user_id = v_user
      ), '{}'::jsonb),
      'known', coalesce((
        select jsonb_agg(k order by k.last_checked_at desc) from (
          select l.url, l.municipality, l.price_cents / 100.0 as price, l.status, l.listing_state,
                 l.first_seen_at, l.last_checked_at
          from public.property_listings l
          where l.user_id = v_user
          order by l.last_checked_at desc
          limit 300
        ) k
      ), '[]'::jsonb),
      'last_runs', coalesce((
        select jsonb_agg(r) from (
          select ran_at, examined, saved from public.property_runs
          where user_id = v_user order by ran_at desc limit 5
        ) r
      ), '[]'::jsonb)
    );

  elsif p_action = 'save_listing' then
    v_price := (p_args ->> 'price_cents')::bigint;
    v_key := lower(regexp_replace(regexp_replace(coalesce(p_args ->> 'url', ''), '[?#].*$', ''), '/+$', ''));

    select id, price_cents into v_id, v_old
      from public.property_listings where user_id = v_user and url_key = v_key;

    if v_id is null then
      select count(*) into v_n from public.property_listings where user_id = v_user;
      if v_n >= 2000 then
        return jsonb_build_object('error', 'Demasiados anuncios guardados (2000). Borra descartados antes.');
      end if;
      insert into public.property_listings (
        user_id, url, source, title, municipality, neighborhood, price_cents, first_price_cents,
        sqm, rooms, confidence, listing_state, data, removed_at
      ) values (
        v_user, p_args ->> 'url', coalesce(p_args ->> 'source', ''), coalesce(p_args ->> 'title', ''),
        p_args ->> 'municipality', coalesce(p_args ->> 'neighborhood', ''), v_price,
        coalesce((p_args ->> 'first_price_cents')::bigint, v_price),
        (p_args ->> 'sqm')::numeric, (p_args ->> 'rooms')::smallint,
        coalesce(p_args ->> 'confidence', 'media'), coalesce(p_args ->> 'listing_state', 'activo'),
        coalesce(p_args -> 'data', '{}'::jsonb),
        case when p_args ->> 'listing_state' = 'retirado' then now() end
      ) returning id into v_id;
      if (p_args ->> 'first_price_cents') is not null and (p_args ->> 'first_price_cents')::bigint <> v_price then
        insert into public.property_price_history (user_id, listing_id, price_cents, seen_at)
          values (v_user, v_id, (p_args ->> 'first_price_cents')::bigint, now() - interval '1 second');
      end if;
      insert into public.property_price_history (user_id, listing_id, price_cents) values (v_user, v_id, v_price);
      return jsonb_build_object('id', v_id, 'created', true);
    end if;

    update public.property_listings set
      source = coalesce(nullif(p_args ->> 'source', ''), source),
      title = coalesce(nullif(p_args ->> 'title', ''), title),
      municipality = p_args ->> 'municipality',
      neighborhood = coalesce(nullif(p_args ->> 'neighborhood', ''), neighborhood),
      price_cents = v_price,
      sqm = coalesce((p_args ->> 'sqm')::numeric, sqm),
      rooms = coalesce((p_args ->> 'rooms')::smallint, rooms),
      confidence = coalesce(p_args ->> 'confidence', confidence),
      listing_state = coalesce(p_args ->> 'listing_state', listing_state),
      data = coalesce(p_args -> 'data', data),
      last_checked_at = now(),
      removed_at = case when p_args ->> 'listing_state' = 'retirado' then coalesce(removed_at, now()) else null end
    where id = v_id;
    if v_old <> v_price then
      insert into public.property_price_history (user_id, listing_id, price_cents) values (v_user, v_id, v_price);
    end if;
    return jsonb_build_object('id', v_id, 'created', false, 'previous_price', case when v_old <> v_price then v_old / 100.0 end);

  elsif p_action = 'mark_removed' then
    v_key := lower(regexp_replace(regexp_replace(coalesce(p_args ->> 'url', ''), '[?#].*$', ''), '/+$', ''));
    update public.property_listings
      set listing_state = 'retirado', removed_at = coalesce(removed_at, now()), last_checked_at = now(),
          discard_reason = case when discard_reason = '' then left(coalesce(p_args ->> 'reason', ''), 300) else discard_reason end
      where user_id = v_user and url_key = v_key
      returning id into v_id;
    if v_id is null then
      return jsonb_build_object('error', 'No había ningún anuncio guardado con esa URL');
    end if;
    return jsonb_build_object('id', v_id, 'removed', true);

  elsif p_action = 'save_run' then
    insert into public.property_runs (user_id, examined, saved, summary)
      values (v_user, coalesce((p_args ->> 'examined')::int, 0), coalesce((p_args ->> 'saved')::int, 0),
              left(coalesce(p_args ->> 'summary', ''), 2000))
      returning id into v_id;
    return jsonb_build_object('id', v_id);
  end if;

  return jsonb_build_object('error', 'Acción desconocida');
end;
$$;

revoke all on function public.property_call(text, text, jsonb) from public;
grant execute on function public.property_call(text, text, jsonb) to anon, authenticated;
