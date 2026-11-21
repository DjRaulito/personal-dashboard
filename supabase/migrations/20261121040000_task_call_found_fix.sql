-- La columna «found» chocaba con la variable FOUND de plpgsql: get_task_context (y con ella save_item) fallaba.

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
    insert into public.scheduled_tasks (user_id, slug, name, description, schedule, fields, view)
    values (
      v_user, v_slug,
      left(coalesce(nullif(p_args ->> 'name', ''), v_slug), 80),
      left(coalesce(p_args ->> 'description', ''), 500),
      left(coalesce(p_args ->> 'schedule', ''), 80),
      coalesce(p_args -> 'fields', '[]'::jsonb),
      case when p_args ->> 'view' in ('cards', 'table', 'days') then p_args ->> 'view' end
    )
    on conflict (user_id, slug) do update set
      name = excluded.name, description = excluded.description,
      schedule = excluded.schedule, fields = excluded.fields, view = excluded.view, archived = false
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
          select tr.ran_at, tr.ok, tr.found, tr.removed, tr.summary from public.task_runs tr
          where tr.task_id = v_task order by tr.ran_at desc limit 5
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
    -- Si cambia algún dato, el valor anterior pasa al histórico (los 30 últimos)
    on conflict (task_id, item_key) do update set
      data = excluded.data, last_seen_at = now(), removed_at = null,
      history = case when public.task_items.data is distinct from excluded.data then (
          select coalesce(jsonb_agg(h.e order by h.n), '[]'::jsonb)
          from jsonb_array_elements(
            jsonb_build_array(jsonb_build_object('at', public.task_items.last_seen_at, 'data', public.task_items.data))
            || public.task_items.history
          ) with ordinality as h(e, n)
          where h.n <= 30
        ) else public.task_items.history end,
      changed_at = case when public.task_items.data is distinct from excluded.data then now()
        else public.task_items.changed_at end;
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
