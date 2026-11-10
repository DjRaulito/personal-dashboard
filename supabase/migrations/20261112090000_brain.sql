-- Cerebro: memoria compartida con otras IAs. Recuerdos (nodos), conexiones entre ellos y tokens
-- para que un cliente MCP (Claude, ChatGPT, Cursor, Hermes…) lea y escriba sin sesión.
-- Todo con RLS; el acceso por token pasa solo por la función brain_call.

create table public.brain_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  content text not null check (char_length(content) between 1 and 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  source text not null default 'manual' check (char_length(source) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index brain_memories_title_idx on public.brain_memories (user_id, lower(title));
create index brain_memories_user_updated_idx on public.brain_memories (user_id, updated_at desc);

create trigger brain_memories_set_updated_at
  before update on public.brain_memories
  for each row execute function private.set_updated_at();

-- Conexiones explícitas entre dos recuerdos (a < b para no duplicar)
create table public.brain_links (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  a uuid not null references public.brain_memories (id) on delete cascade,
  b uuid not null references public.brain_memories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

create index brain_links_b_idx on public.brain_links (b);

-- Tokens de acceso (solo se guarda el hash SHA-256; el token se muestra una vez al crearlo)
create table public.brain_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 60),
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.brain_memories enable row level security;
alter table public.brain_links enable row level security;
alter table public.brain_tokens enable row level security;

create policy "brain_memories: propios" on public.brain_memories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "brain_links: propios" on public.brain_links for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "brain_tokens: propios" on public.brain_tokens for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.brain_memories, public.brain_links, public.brain_tokens from anon;

-- ---------------------------------------------------------------------------
-- brain_call: único punto de entrada del endpoint MCP. Comprueba el token y ejecuta una acción
-- (remember, search, list, get, link, forget, forget_all) solo sobre los datos de su dueño.
-- ---------------------------------------------------------------------------
create or replace function public.brain_call(p_token text, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
  v_user uuid;
  v_id uuid;
  v_other uuid;
  v_title text;
  v_content text;
  v_tags text[];
  v_query text;
  v_limit int;
  v_n int;
  v_found boolean;
begin
  select user_id into v_user from public.brain_tokens where token_hash = v_hash;
  if v_user is null then
    return jsonb_build_object('error', 'Token no válido');
  end if;
  update public.brain_tokens set last_used_at = now() where token_hash = v_hash;

  v_limit := least(greatest(coalesce((p_args ->> 'limit')::int, 10), 1), 25);

  if p_action = 'remember' then
    v_title := btrim(coalesce(p_args ->> 'title', ''));
    v_content := btrim(coalesce(p_args ->> 'content', ''));
    if char_length(v_title) not between 1 and 80 then
      return jsonb_build_object('error', 'El título debe tener entre 1 y 80 caracteres');
    end if;
    if char_length(v_content) not between 1 and 2000 then
      return jsonb_build_object('error', 'El contenido debe tener entre 1 y 2000 caracteres');
    end if;
    v_tags := coalesce(array(
      select distinct left(lower(btrim(t)), 30)
      from jsonb_array_elements_text(coalesce(p_args -> 'tags', '[]'::jsonb)) t
      where btrim(t) <> ''
      limit 8
    ), '{}');

    select id into v_id from public.brain_memories where user_id = v_user and lower(title) = lower(v_title);
    v_found := v_id is not null;
    if v_found then
      update public.brain_memories
        set content = v_content, tags = case when p_args ? 'tags' then v_tags else tags end, source = left(coalesce(p_args ->> 'source', 'mcp'), 40)
        where id = v_id;
    else
      select count(*) into v_n from public.brain_memories where user_id = v_user;
      if v_n >= 2000 then
        return jsonb_build_object('error', 'Memoria llena (2000 recuerdos). Olvida alguno antes.');
      end if;
      insert into public.brain_memories (user_id, title, content, tags, source)
        values (v_user, v_title, v_content, v_tags, left(coalesce(p_args ->> 'source', 'mcp'), 40))
        returning id into v_id;
    end if;

    for v_other in
      select x::uuid from jsonb_array_elements_text(coalesce(p_args -> 'related', '[]'::jsonb)) x limit 20
    loop
      if v_other <> v_id and exists (select 1 from public.brain_memories where id = v_other and user_id = v_user) then
        insert into public.brain_links (user_id, a, b)
          values (v_user, least(v_id, v_other), greatest(v_id, v_other))
          on conflict do nothing;
      end if;
    end loop;
    return jsonb_build_object('id', v_id, 'updated', v_found);

  elsif p_action = 'search' then
    v_query := btrim(coalesce(p_args ->> 'query', ''));
    return jsonb_build_object('memories', coalesce((
      select jsonb_agg(m) from (
        select id, title, content, tags, updated_at
        from public.brain_memories mem
        where mem.user_id = v_user
          and not exists (
            select 1 from regexp_split_to_table(v_query, '\s+') w
            where w <> '' and not (
              mem.title ilike '%' || w || '%'
              or mem.content ilike '%' || w || '%'
              or exists (select 1 from unnest(mem.tags) tg where tg ilike '%' || w || '%')
            )
          )
        order by mem.updated_at desc
        limit v_limit
      ) m
    ), '[]'::jsonb));

  elsif p_action = 'list' then
    return jsonb_build_object('memories', coalesce((
      select jsonb_agg(m) from (
        select id, title, tags, updated_at
        from public.brain_memories mem
        where mem.user_id = v_user
          and (coalesce(p_args ->> 'tag', '') = '' or lower(p_args ->> 'tag') = any (mem.tags))
        order by mem.updated_at desc
        limit v_limit
      ) m
    ), '[]'::jsonb));

  elsif p_action = 'get' then
    v_id := (p_args ->> 'id')::uuid;
    return coalesce((
      select to_jsonb(m) || jsonb_build_object('related', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title))
        from public.brain_links l
        join public.brain_memories o on o.id = case when l.a = m.id then l.b else l.a end
        where (l.a = m.id or l.b = m.id) and l.user_id = v_user
      ), '[]'::jsonb))
      from (
        select id, title, content, tags, source, created_at, updated_at
        from public.brain_memories where id = v_id and user_id = v_user
      ) m
    ), jsonb_build_object('error', 'No existe ese recuerdo'));

  elsif p_action = 'link' then
    v_id := (p_args ->> 'a')::uuid;
    v_other := (p_args ->> 'b')::uuid;
    if v_id = v_other
      or (select count(*) from public.brain_memories where user_id = v_user and id in (v_id, v_other)) <> 2 then
      return jsonb_build_object('error', 'Recuerdos no válidos');
    end if;
    insert into public.brain_links (user_id, a, b)
      values (v_user, least(v_id, v_other), greatest(v_id, v_other))
      on conflict do nothing;
    return jsonb_build_object('ok', true);

  elsif p_action = 'forget' then
    delete from public.brain_memories where id = (p_args ->> 'id')::uuid and user_id = v_user;
    get diagnostics v_n = row_count;
    return jsonb_build_object('deleted', v_n);

  elsif p_action = 'forget_all' then
    if coalesce(p_args ->> 'confirm', '') <> 'true' then
      return jsonb_build_object('error', 'Para borrar todo hay que enviar confirm: true');
    end if;
    delete from public.brain_memories where user_id = v_user;
    get diagnostics v_n = row_count;
    return jsonb_build_object('deleted', v_n);
  end if;

  return jsonb_build_object('error', 'Acción desconocida');
exception when others then
  return jsonb_build_object('error', 'No se pudo completar la acción');
end;
$$;

revoke all on function public.brain_call(text, text, jsonb) from public;
grant execute on function public.brain_call(text, text, jsonb) to anon, authenticated;

-- La red se actualiza en directo cuando otra IA guarda o borra recuerdos
alter publication supabase_realtime add table public.brain_memories, public.brain_links;
