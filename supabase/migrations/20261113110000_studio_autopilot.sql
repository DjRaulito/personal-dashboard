-- VoiceStudio · segunda parte: la muestra de voz se guarda en la base de datos (así el montaje la
-- recibe al reclamar el trabajo, sin enlaces firmados) y `studio_worker` gana las acciones que
-- necesita el piloto automático, que corre sin sesión (GitHub Actions → app → esta función).

alter table public.studio_settings
  drop column voice_sample_path,
  add column voice_sample bytea check (octet_length(voice_sample) <= 3145728),
  add column voice_sample_mime text check (char_length(voice_sample_mime) <= 60);

-- El bucket de Storage ya no hace falta
drop policy if exists "studio: propios" on storage.objects;

create or replace function public.studio_worker(p_token text, p_job uuid, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
  v_user uuid;
  v_job public.video_jobs;
  v_set public.studio_settings;
  v_piece public.content_pieces;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_id uuid;
  v_mode text;
  v_token text;
begin
  select * into v_set from public.studio_settings where worker_token_hash = v_hash;
  if v_set.user_id is null then
    return jsonb_build_object('error', 'Clave no válida');
  end if;
  v_user := v_set.user_id;

  -- Piloto automático: elige la siguiente idea y crea su trabajo (una vez al día como mucho)
  if p_action = 'autopilot' then
    if not v_set.autopilot then
      return jsonb_build_object('skip', 'Piloto automático apagado');
    end if;
    if not (extract(dow from v_today)::smallint = any (v_set.autopilot_days)) then
      return jsonb_build_object('skip', 'Hoy no toca');
    end if;
    if v_set.autopilot_last_on = v_today then
      return jsonb_build_object('skip', 'Ya se generó hoy');
    end if;
    if exists (
      select 1 from public.video_jobs
      where user_id = v_user and auto and status in ('scripting', 'script_ready', 'queued', 'rendering')
    ) then
      return jsonb_build_object('skip', 'Hay un vídeo automático en marcha');
    end if;

    select p.* into v_piece
    from public.content_pieces p
    where p.user_id = v_user
      and p.status = 'idea'
      and p.format = v_set.autopilot_format
      and not exists (
        select 1 from public.video_jobs j
        where j.piece_id = p.id and j.status not in ('failed', 'cancelled')
      )
    order by p.priority, p.created_at
    limit 1;
    if v_piece.id is null then
      return jsonb_build_object('skip', 'No quedan ideas de ese formato en el banco');
    end if;

    v_mode := case when v_set.autopilot_voice = 'clone' and v_set.voice_sample is not null then 'clone' else 'ai' end;
    insert into public.video_jobs (user_id, piece_id, topic, format, voice_mode, voice, target_seconds, auto, status, stage)
    values (
      v_user, v_piece.id,
      left(v_piece.title || coalesce(E'\n' || v_piece.notes, ''), 2000),
      v_set.autopilot_format, v_mode, v_set.ai_voice,
      case when v_set.autopilot_format = 'short' then 60 else 420 end,
      true, 'scripting', 'Escribiendo el guion'
    )
    returning id into v_id;
    update public.studio_settings set autopilot_last_on = v_today where user_id = v_user;

    select encrypted_token into v_token from public.integrations where user_id = v_user and provider = 'google';
    return jsonb_build_object(
      'job_id', v_id, 'topic', left(v_piece.title || coalesce(E'\n' || v_piece.notes, ''), 2000),
      'format', v_set.autopilot_format, 'target_seconds', case when v_set.autopilot_format = 'short' then 60 else 420 end,
      'google_token', v_token
    );
  end if;

  select * into v_job from public.video_jobs where id = p_job and user_id = v_user;
  if v_job.id is null then
    return jsonb_build_object('error', 'Trabajo no encontrado');
  end if;

  -- La app (sin sesión) guarda el guion preparado
  if p_action = 'set_script' then
    if v_job.status <> 'scripting' then
      return jsonb_build_object('error', 'El trabajo no está escribiendo el guion');
    end if;
    update public.video_jobs
      set script = p_args -> 'script', status = 'script_ready', stage = 'Guion listo', progress = 0
      where id = p_job;
    return jsonb_build_object('ok', true);
  end if;

  -- La app (sin sesión) lo pone en cola con los enlaces de subida
  if p_action = 'queue' then
    if v_job.status not in ('script_ready', 'failed') then
      return jsonb_build_object('error', 'El trabajo no se puede poner en cola');
    end if;
    update public.video_jobs
      set assets = p_args -> 'assets', status = 'queued', stage = 'En cola', progress = 0, error = null,
          queued_at = now(), started_at = null, finished_at = null, workflow_run_id = null, workflow_url = null
      where id = p_job;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'claim' then
    if v_job.status not in ('queued', 'rendering') then
      return jsonb_build_object('error', 'El trabajo no está en cola');
    end if;
    update public.video_jobs
      set status = 'rendering', progress = greatest(progress, 2), stage = 'Preparando el montaje',
          started_at = coalesce(started_at, now())
      where id = p_job;
    return jsonb_build_object(
      'id', v_job.id, 'format', v_job.format, 'voice_mode', v_job.voice_mode, 'voice', v_job.voice,
      'script', v_job.script, 'assets', v_job.assets,
      'voice_sample', case when v_job.voice_mode = 'clone' then encode(v_set.voice_sample, 'base64') end,
      'voice_sample_mime', case when v_job.voice_mode = 'clone' then v_set.voice_sample_mime end
    );
  end if;

  if p_action = 'fail' then
    if v_job.status not in ('scripting', 'script_ready', 'queued', 'rendering') then
      return jsonb_build_object('ok', true);
    end if;
    update public.video_jobs
      set status = 'failed', assets = null, error = left(coalesce(p_args ->> 'error', 'Error desconocido'), 2000),
          finished_at = now()
      where id = p_job;
    return jsonb_build_object('ok', true);
  end if;

  if v_job.status <> 'rendering' then
    return jsonb_build_object('error', 'El trabajo no está en montaje');
  end if;

  if p_action = 'progress' then
    update public.video_jobs
      set progress = least(greatest(coalesce((p_args ->> 'progress')::int, progress), 0), 99),
          stage = left(coalesce(p_args ->> 'stage', stage), 200)
      where id = p_job;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'done' then
    update public.video_jobs
      set status = 'ready', progress = 100, stage = 'Listo para revisar', assets = null,
          drive_file_id = left(p_args ->> 'drive_file_id', 200),
          drive_thumb_id = left(p_args ->> 'drive_thumb_id', 200),
          duration_s = (p_args ->> 'duration_s')::numeric,
          finished_at = now(), error = null
      where id = p_job;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('error', 'Acción desconocida');
end;
$$;

revoke all on function public.studio_worker(text, uuid, text, jsonb) from public;
grant execute on function public.studio_worker(text, uuid, text, jsonb) to anon, authenticated;
