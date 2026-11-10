-- Fase 8 · VoiceStudio: vídeos generados de principio a fin (guion → voz → clips → subtítulos →
-- montaje). La app prepara el guion y los enlaces; el montaje corre en GitHub Actions (workflow
-- `studio.yml`), que solo habla con la base de datos a través de `studio_worker` y una clave propia.
-- Los vídeos se suben a Google Drive del usuario (sesión de subida creada por la app).

-- ---------------------------------------------------------------------------
-- studio_settings: una fila por usuario
-- ---------------------------------------------------------------------------
create table public.studio_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  worker_token_hash text check (char_length(worker_token_hash) = 64),
  ai_voice text not null default 'es_male' check (char_length(ai_voice) between 1 and 40),
  voice_sample_path text check (char_length(voice_sample_path) <= 300),
  autopilot boolean not null default false,
  autopilot_days smallint[] not null default '{1,4}' check (autopilot_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  autopilot_format text not null default 'short' check (autopilot_format in ('short', 'long')),
  autopilot_voice text not null default 'ai' check (autopilot_voice in ('ai', 'clone')),
  autopilot_last_on date,
  updated_at timestamptz not null default now()
);

create unique index studio_settings_token_idx on public.studio_settings (worker_token_hash)
  where worker_token_hash is not null;

create trigger studio_settings_set_updated_at
  before update on public.studio_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- video_jobs: cada vídeo. `script` lleva escenas con su narración y clips; `assets` los enlaces
-- temporales que necesita el worker (subida a Drive, muestra de voz) y se vacía al terminar.
-- ---------------------------------------------------------------------------
create table public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  piece_id uuid references public.content_pieces (id) on delete set null,
  topic text not null check (char_length(topic) between 3 and 2000),
  format text not null default 'short' check (format in ('short', 'long')),
  voice_mode text not null default 'ai' check (voice_mode in ('ai', 'clone')),
  voice text not null default 'es_male' check (char_length(voice) between 1 and 40),
  target_seconds integer not null default 60 check (target_seconds between 15 and 900),
  status text not null default 'scripting' check (
    status in ('scripting', 'script_ready', 'queued', 'rendering', 'ready', 'approved', 'failed', 'cancelled')
  ),
  progress smallint not null default 0 check (progress between 0 and 100),
  stage text check (char_length(stage) <= 200),
  script jsonb,
  assets jsonb,
  auto boolean not null default false,
  workflow_run_id bigint,
  workflow_url text check (char_length(workflow_url) <= 300),
  drive_file_id text check (char_length(drive_file_id) <= 200),
  drive_thumb_id text check (char_length(drive_thumb_id) <= 200),
  duration_s numeric(7, 1),
  error text check (char_length(error) <= 2000),
  queued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_jobs_user_created_idx on public.video_jobs (user_id, created_at desc);
create index video_jobs_piece_idx on public.video_jobs (piece_id) where piece_id is not null;
create index video_jobs_active_idx on public.video_jobs (status) where status in ('queued', 'rendering');

create trigger video_jobs_set_updated_at
  before update on public.video_jobs
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.studio_settings enable row level security;
alter table public.video_jobs enable row level security;

create policy "studio_settings: propios" on public.studio_settings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "video_jobs: propios" on public.video_jobs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (piece_id is null or exists (
      select 1 from public.content_pieces p where p.id = piece_id and p.user_id = (select auth.uid())
    ))
  );

revoke all on public.studio_settings, public.video_jobs from anon;

alter publication supabase_realtime add table public.video_jobs;

-- ---------------------------------------------------------------------------
-- studio_worker: único punto de entrada del montaje en GitHub Actions. Comprueba la clave y solo
-- toca el trabajo indicado de su dueño. Acciones: claim, progress, done, fail.
-- ---------------------------------------------------------------------------
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
begin
  select user_id into v_user from public.studio_settings where worker_token_hash = v_hash;
  if v_user is null then
    return jsonb_build_object('error', 'Clave no válida');
  end if;

  select * into v_job from public.video_jobs where id = p_job and user_id = v_user;
  if v_job.id is null then
    return jsonb_build_object('error', 'Trabajo no encontrado');
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
      'script', v_job.script, 'assets', v_job.assets
    );
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

  if p_action = 'fail' then
    update public.video_jobs
      set status = 'failed', assets = null, error = left(coalesce(p_args ->> 'error', 'Error desconocido'), 2000),
          finished_at = now()
      where id = p_job;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('error', 'Acción desconocida');
end;
$$;

revoke all on function public.studio_worker(text, uuid, text, jsonb) from public;
grant execute on function public.studio_worker(text, uuid, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para la muestra de voz (carpeta = id del usuario)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio', 'studio', false, 20971520, array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/aac'])
on conflict (id) do nothing;

create policy "studio: propios" on storage.objects for all to authenticated
  using (bucket_id = 'studio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'studio' and (storage.foldername(name))[1] = (select auth.uid())::text);
