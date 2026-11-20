-- Tareas programadas: cada tarea (Cowork, Claude u otra IA con el conector del cerebro) se
-- registra sola y su sección aparece en la app. Los resultados se guardan como JSON validado
-- contra los campos que declaró la tarea.

create table public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  schedule text not null default '' check (char_length(schedule) <= 80),
  -- [{key, label, type}] con type: text | number | money | area | url | date
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 20),
  criteria jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object'),
  -- Vista propia en lugar de la genérica (p. ej. 'inmuebles')
  special_view text check (special_view in ('inmuebles')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table public.task_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.scheduled_tasks (id) on delete cascade,
  ran_at timestamptz not null default now(),
  ok boolean not null default true,
  found int not null default 0,
  removed int not null default 0,
  summary text not null default '' check (char_length(summary) <= 2000)
);

create index task_runs_task_idx on public.task_runs (task_id, ran_at desc);

create table public.task_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.scheduled_tasks (id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 300),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  status text not null default 'new' check (status in ('new', 'favorite', 'seen', 'discarded')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (task_id, item_key)
);

create index task_items_task_idx on public.task_items (task_id, last_seen_at desc);

create trigger scheduled_tasks_set_updated_at
  before update on public.scheduled_tasks
  for each row execute function private.set_updated_at();

alter table public.scheduled_tasks enable row level security;
alter table public.task_runs enable row level security;
alter table public.task_items enable row level security;

create policy "scheduled_tasks: propias" on public.scheduled_tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "task_runs: propias" on public.task_runs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "task_items: propias" on public.task_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.scheduled_tasks, public.task_runs, public.task_items from anon;

-- ---------------------------------------------------------------------------
-- Conector: las IAs llaman con su token del cerebro (sin sesión)
-- ---------------------------------------------------------------------------

create or replace function public.task_call(p_token text, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
  v_user uuid;
  v_task uuid;
  v_slug text := lower(coalesce(p_args ->> 'task', ''));
  v_n int;
  v_new boolean;
begin
  select user_id into v_user from public.brain_tokens where token_hash = v_hash;
  if v_user is null then
    return jsonb_build_object('error', 'Token no válido');
  end if;
  update public.brain_tokens set last_used_at = now() where token_hash = v_hash;

  if p_action = 'register_task' then
    if v_slug !~ '^[a-z0-9][a-z0-9-]{1,39}$' then
      return jsonb_build_object('error', 'Identificador no válido: minúsculas, números y guiones');
    end if;
    select count(*) into v_n from public.scheduled_tasks where user_id = v_user;
    if v_n >= 30 and not exists (select 1 from public.scheduled_tasks where user_id = v_user and slug = v_slug) then
      return jsonb_build_object('error', 'Demasiadas tareas (30)');
    end if;
    insert into public.scheduled_tasks (user_id, slug, name, description, schedule, fields)
    values (
      v_user, v_slug,
      left(coalesce(nullif(p_args ->> 'name', ''), v_slug), 80),
      left(coalesce(p_args ->> 'description', ''), 500),
      left(coalesce(p_args ->> 'schedule', ''), 80),
      coalesce(p_args -> 'fields', '[]'::jsonb)
    )
    on conflict (user_id, slug) do update set
      name = excluded.name, description = excluded.description,
      schedule = excluded.schedule, fields = excluded.fields, archived = false
    returning id into v_task;
    return jsonb_build_object('ok', true, 'task', v_slug);
  end if;

  select id into v_task from public.scheduled_tasks where user_id = v_user and slug = v_slug;
  if v_task is null then
    return jsonb_build_object('error', 'Esa tarea no existe: regístrala antes con register_task');
  end if;

  if p_action = 'context' then
    return jsonb_build_object(
      'task', (select jsonb_build_object('name', t.name, 'description', t.description, 'fields', t.fields, 'criteria', t.criteria)
               from public.scheduled_tasks t where t.id = v_task),
      'known', coalesce((
        select jsonb_agg(k) from (
          select i.item_key, i.status, i.first_seen_at, i.removed_at is not null as removed
          from public.task_items i where i.task_id = v_task
          order by i.last_seen_at desc limit 500
        ) k
      ), '[]'::jsonb),
      'last_runs', coalesce((
        select jsonb_agg(r) from (
          select ran_at, ok, found, removed, summary from public.task_runs
          where task_id = v_task order by ran_at desc limit 5
        ) r
      ), '[]'::jsonb)
    );

  elsif p_action = 'save_item' then
    if coalesce(p_args ->> 'key', '') = '' or jsonb_typeof(p_args -> 'data') <> 'object' then
      return jsonb_build_object('error', 'Faltan key o data');
    end if;
    select count(*) into v_n from public.task_items where task_id = v_task;
    v_new := not exists (select 1 from public.task_items where task_id = v_task and item_key = left(p_args ->> 'key', 300));
    if v_new and v_n >= 2000 then
      return jsonb_build_object('error', 'Demasiados resultados guardados (2000)');
    end if;
    insert into public.task_items (user_id, task_id, item_key, data)
    values (v_user, v_task, left(p_args ->> 'key', 300), p_args -> 'data')
    on conflict (task_id, item_key) do update set
      data = excluded.data, last_seen_at = now(), removed_at = null;
    return jsonb_build_object('ok', true, 'new', v_new);

  elsif p_action = 'mark_removed' then
    update public.task_items set removed_at = now()
      where task_id = v_task and removed_at is null
        and item_key in (select jsonb_array_elements_text(coalesce(p_args -> 'keys', '[]'::jsonb)));
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', true, 'removed', v_n);

  elsif p_action = 'save_run_summary' then
    insert into public.task_runs (user_id, task_id, ok, found, removed, summary)
    values (
      v_user, v_task,
      coalesce((p_args ->> 'ok')::boolean, true),
      greatest(coalesce((p_args ->> 'found')::int, 0), 0),
      greatest(coalesce((p_args ->> 'removed')::int, 0), 0),
      left(coalesce(p_args ->> 'summary', ''), 2000)
    );
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('error', 'Acción desconocida');
end;
$$;

revoke execute on function public.task_call(text, text, jsonb) from public;
grant execute on function public.task_call(text, text, jsonb) to anon, authenticated;
