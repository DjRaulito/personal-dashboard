-- Varios usuarios: administradores que invitan por email y claves de IA de cada usuario.

-- ---------------------------------------------------------------------------
-- Administradores: pueden invitar emails. Se rellena a mano (SQL), nunca desde el repo.
-- ---------------------------------------------------------------------------
create table private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Quién invitó a quién (para el listado)
alter table private.allowed_emails add column invited_by uuid references auth.users (id) on delete set null;

-- Invitaciones: lista, alta y baja (solo administradores)
create function public.list_invites()
returns table (email text, invited_at timestamptz, joined boolean, is_admin boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo para administradores' using errcode = '42501';
  end if;
  return query
    select a.email,
           a.created_at,
           u.id is not null,
           exists (select 1 from private.admins ad where ad.user_id = u.id)
    from private.allowed_emails a
    left join auth.users u on lower(u.email) = a.email
    order by a.created_at;
end;
$$;

create function public.add_invite(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Solo para administradores' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Email no válido' using errcode = '22023';
  end if;
  insert into private.allowed_emails (email, invited_by)
  values (v_email, (select auth.uid()))
  on conflict (email) do nothing;
end;
$$;

-- Quitar la invitación impide entrar a quien aún no ha entrado; las cuentas ya creadas siguen.
create function public.remove_invite(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo para administradores' using errcode = '42501';
  end if;
  if exists (
    select 1 from auth.users u join private.admins ad on ad.user_id = u.id where lower(u.email) = lower(trim(p_email))
  ) then
    raise exception 'No se puede quitar a un administrador' using errcode = '42501';
  end if;
  delete from private.allowed_emails where email = lower(trim(p_email));
end;
$$;

revoke all on function public.list_invites(), public.add_invite(text), public.remove_invite(text) from public, anon;
grant execute on function public.list_invites(), public.add_invite(text), public.remove_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Claves de IA de cada usuario (cifradas con TOKEN_ENCRYPTION_KEY en el servidor)
-- ---------------------------------------------------------------------------
create table public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('gemini', 'groq', 'mistral', 'openrouter', 'cerebras')),
  encrypted_key text not null check (char_length(encrypted_key) < 2000),
  -- Últimos 4 caracteres, para reconocerla sin enseñarla
  hint text not null check (char_length(hint) <= 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger user_api_keys_set_updated_at
  before update on public.user_api_keys
  for each row execute function private.set_updated_at();

alter table public.user_api_keys enable row level security;
create policy "user_api_keys: propias" on public.user_api_keys for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_api_keys from anon;
revoke truncate, references, trigger on public.user_api_keys from authenticated;
