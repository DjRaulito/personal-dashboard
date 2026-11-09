-- Fase 1 · Núcleo: lista blanca de acceso, perfiles e integraciones.
-- Toda tabla de `public` lleva user_id y RLS. La lista blanca vive en un esquema
-- privado que la API (PostgREST) no expone.

-- ---------------------------------------------------------------------------
-- Esquema privado
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Emails autorizados a crear cuenta. Se rellena a mano (SQL editor), nunca desde
-- el repo, para no publicar datos personales.
create table private.allowed_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- Mantiene updated_at al día.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: preferencias del usuario (1 fila por usuario)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: leer el propio"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles: editar el propio"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- El perfil lo crea el trigger de alta; el cliente solo lee y edita.
revoke all on public.profiles from anon;
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- integrations: conexiones con servicios externos (Google, Hevy, bancos)
-- Los tokens se guardan cifrados por la app (AES-256-GCM); la BD nunca ve el
-- valor en claro.
-- ---------------------------------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'hevy', 'enable_banking')),
  encrypted_token text,
  scopes text[] not null default '{}',
  account_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger integrations_set_updated_at
  before update on public.integrations
  for each row execute function private.set_updated_at();

alter table public.integrations enable row level security;

create policy "integrations: leer las propias"
  on public.integrations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "integrations: crear las propias"
  on public.integrations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "integrations: editar las propias"
  on public.integrations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "integrations: borrar las propias"
  on public.integrations for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.integrations from anon;
revoke truncate, references, trigger on public.integrations from authenticated;

-- ---------------------------------------------------------------------------
-- Alta de usuarios: solo emails de la lista blanca; crea su perfil.
-- Si el email no está autorizado, la excepción aborta el alta y Supabase Auth
-- devuelve un error al callback de OAuth.
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from private.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'Email no autorizado' using errcode = '42501';
  end if;

  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
