-- Fase 7 · Agentes: fichas de agente, tareas enviadas a varios agentes, ejecuciones con su
-- registro y acciones propuestas que esperan aprobación. Todo con RLS (un solo usuario).

-- ---------------------------------------------------------------------------
-- agents: ficha de cada agente. engine = 'gemini' (corre en la app) o 'claude' (GitHub Actions)
-- ---------------------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  role text not null default '' check (char_length(role) <= 120),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  engine text not null default 'gemini' check (engine in ('gemini', 'claude')),
  tools text[] not null default '{}' check (cardinality(tools) <= 20),
  max_steps smallint not null default 6 check (max_steps between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- agent_tasks: una petición que se manda a uno o varios agentes a la vez
-- ---------------------------------------------------------------------------
create table public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index agent_tasks_user_created_idx on public.agent_tasks (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- agent_runs: la tarea en manos de un agente. Estados:
-- queued → working → waiting_approval → done / failed / cancelled
-- ---------------------------------------------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.agent_tasks (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  agent_name text not null check (char_length(agent_name) between 1 and 40),
  engine text not null check (engine in ('gemini', 'claude')),
  status text not null default 'queued'
    check (status in ('queued', 'working', 'waiting_approval', 'done', 'failed', 'cancelled')),
  result text check (char_length(result) <= 40000),
  error text check (char_length(error) <= 1000),
  github_run_id bigint,
  github_url text check (char_length(github_url) <= 300),
  branch text check (char_length(branch) <= 100),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_runs_task_id_idx on public.agent_runs (task_id);
create index agent_runs_agent_id_idx on public.agent_runs (agent_id);
create index agent_runs_user_status_idx on public.agent_runs (user_id, status);

create trigger agent_runs_set_updated_at
  before update on public.agent_runs
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- agent_logs: lo que va haciendo cada ejecución (se ve en directo en el tablero)
-- ---------------------------------------------------------------------------
create table public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  kind text not null default 'info' check (kind in ('info', 'tool', 'error')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index agent_logs_run_id_idx on public.agent_logs (run_id, created_at);
create index agent_logs_user_id_idx on public.agent_logs (user_id);

-- ---------------------------------------------------------------------------
-- agent_actions: acciones con efecto que propone un agente. No se ejecutan hasta que
-- Raúl las aprueba (presupuesto, aportación a una hucha, abrir un PR…)
-- ---------------------------------------------------------------------------
create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  kind text not null check (kind in ('budget', 'goal_contribution', 'pull_request')),
  summary text not null check (char_length(summary) between 1 and 300),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'failed')),
  outcome text check (char_length(outcome) <= 500),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index agent_actions_run_id_idx on public.agent_actions (run_id);
create index agent_actions_user_status_idx on public.agent_actions (user_id, status);

-- ---------------------------------------------------------------------------
-- RLS: cada usuario solo ve y toca lo suyo
-- ---------------------------------------------------------------------------
alter table public.agents enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_logs enable row level security;
alter table public.agent_actions enable row level security;

create policy "agents: propios" on public.agents for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "agent_tasks: propios" on public.agent_tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "agent_runs: propios" on public.agent_runs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "agent_logs: propios" on public.agent_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "agent_actions: propios" on public.agent_actions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.agents, public.agent_tasks, public.agent_runs, public.agent_logs, public.agent_actions from anon;

-- Tablero en tiempo real (Supabase Realtime respeta la RLS)
alter publication supabase_realtime add table public.agent_runs, public.agent_logs, public.agent_actions;
