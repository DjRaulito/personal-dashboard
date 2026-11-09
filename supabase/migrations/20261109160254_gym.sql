-- Fase 4 · Gimnasio: entrenos de Hevy (CSV ahora, API más adelante), ejercicios con su grupo
-- muscular, series y medidas corporales. Pesos en kg, distancias en metros.

-- ---------------------------------------------------------------------------
-- gym_exercises: catálogo propio. El grupo muscular se deduce del nombre y se puede corregir.
-- ---------------------------------------------------------------------------
create table public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  muscle_group text not null default 'other' check (
    muscle_group in ('chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings',
      'glutes', 'calves', 'adductors', 'abductors', 'abs', 'cardio', 'full_body', 'other')
  ),
  muscle_group_manual boolean not null default false,
  hevy_template_id text check (char_length(hevy_template_id) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create trigger gym_exercises_set_updated_at
  before update on public.gym_exercises
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- gym_workouts. external_id: id de Hevy (API) o huella título + inicio (CSV).
-- ---------------------------------------------------------------------------
create table public.gym_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  external_id text not null check (char_length(external_id) between 1 and 200),
  source text not null default 'csv' check (source in ('csv', 'api', 'manual')),
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index gym_workouts_user_started_idx on public.gym_workouts (user_id, started_at desc);

create trigger gym_workouts_set_updated_at
  before update on public.gym_workouts
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- gym_sets
-- ---------------------------------------------------------------------------
create table public.gym_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.gym_workouts (id) on delete cascade,
  exercise_id uuid not null references public.gym_exercises (id) on delete cascade,
  exercise_index smallint not null check (exercise_index >= 0),
  set_index smallint not null check (set_index >= 0),
  set_type text not null default 'normal' check (set_type in ('normal', 'warmup', 'failure', 'dropset')),
  weight_kg numeric(7, 2) check (weight_kg >= 0),
  reps smallint check (reps >= 0),
  distance_m numeric(9, 1) check (distance_m >= 0),
  duration_s integer check (duration_s >= 0),
  rpe numeric(3, 1) check (rpe between 0 and 10),
  superset_id smallint,
  exercise_notes text check (char_length(exercise_notes) <= 1000),
  unique (workout_id, exercise_index, set_index)
);

create index gym_sets_user_exercise_idx on public.gym_sets (user_id, exercise_id);
create index gym_sets_exercise_id_idx on public.gym_sets (exercise_id);

-- ---------------------------------------------------------------------------
-- body_measurements: una fila por día
-- ---------------------------------------------------------------------------
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 1 and 70),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  chest_cm numeric(5, 1) check (chest_cm between 30 and 250),
  arm_cm numeric(4, 1) check (arm_cm between 10 and 80),
  thigh_cm numeric(4, 1) check (thigh_cm between 20 and 120),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

create trigger body_measurements_set_updated_at
  before update on public.body_measurements
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.gym_exercises enable row level security;
alter table public.gym_workouts enable row level security;
alter table public.gym_sets enable row level security;
alter table public.body_measurements enable row level security;

create policy "gym_exercises: propios" on public.gym_exercises for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "gym_workouts: propios" on public.gym_workouts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "gym_sets: propias" on public.gym_sets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.gym_workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and exists (select 1 from public.gym_exercises e where e.id = exercise_id and e.user_id = (select auth.uid()))
  );

create policy "body_measurements: propias" on public.body_measurements for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.gym_exercises, public.gym_workouts, public.gym_sets, public.body_measurements from anon;
