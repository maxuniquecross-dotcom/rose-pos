-- Схема Rose POS. Вставить целиком в Supabase → SQL Editor → Run.
-- После этого: Authentication → Providers → Email оставить включённым,
-- выключить «Allow new users to sign up», чтобы регистрироваться могли только из админки.
-- Первого администратора создать в Authentication → Users → Add user:
--   email: admin@users.rose-pos.app
--   пароль: свой, от 8 символов
--   Auto Confirm User: включить
-- Первый профиль сам станет admin, логин для входа: admin

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  staff text not null default 'Администратор',
  role text not null default 'waiter' check (role in ('admin', 'waiter')),
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null,
  total numeric not null,
  payment text not null,
  cancelled boolean not null default false,
  staff text not null,
  payload jsonb not null
);

create index if not exists sales_user_created on public.sales (user_id, created_at desc);

create table if not exists public.keepalive (
  id int primary key default 1 check (id = 1),
  touched_at timestamptz not null default now()
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.sales enable row level security;
alter table public.keepalive enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  is_first boolean;
begin
  uname := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, username, staff, role)
  values (
    new.id,
    uname,
    coalesce(new.raw_user_meta_data->>'staff', uname),
    case when is_first then 'admin' else 'waiter' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.lock_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'роль может менять только администратор';
  end if;
  if new.id is distinct from old.id or new.username is distinct from old.username then
    raise exception 'логин менять нельзя';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role
  before update on public.profiles
  for each row execute function public.lock_role();

create or replace function public.touch_keepalive()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.keepalive set touched_at = now() where id = 1;
  return now();
end;
$$;

revoke all on table public.keepalive from anon, authenticated;
revoke all on table public.profiles from anon;
revoke all on table public.sales from anon;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.lock_role() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.touch_keepalive() from public;

grant execute on function public.touch_keepalive() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "читать профили" on public.profiles;
create policy "читать профили" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "править профиль" on public.profiles;
create policy "править профиль" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "читать чеки" on public.sales;
create policy "читать чеки" on public.sales
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "писать свой чек" on public.sales;
create policy "писать свой чек" on public.sales
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "обновлять чек" on public.sales;
create policy "обновлять чек" on public.sales
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Один аккаунт — одно устройство. Пока смена «жива» (был сигнал за последние 20 минут),
-- войти с другого телефона нельзя. Прямое обновление профиля устройство не перехватывает.

alter table public.profiles
  add column if not exists active_device_id text,
  add column if not exists active_at timestamptz;

create or replace function public.keep_device_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('rose.device_claim', true) is distinct from '1' then
    new.active_device_id := old.active_device_id;
    new.active_at := old.active_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_keep_device on public.profiles;
create trigger profiles_keep_device
  before update on public.profiles
  for each row execute function public.keep_device_lock();

create or replace function public.claim_device(device text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.profiles;
begin
  if auth.uid() is null then
    return 'Нужно войти';
  end if;
  if device is null or length(trim(device)) < 8 or length(device) > 80 then
    return 'Устройство не распознано';
  end if;
  select * into row from public.profiles where id = auth.uid() for update;
  if row.id is null then
    return 'Профиль не найден';
  end if;
  if row.active_device_id is not null
     and row.active_device_id <> device
     and row.active_at is not null
     and row.active_at > now() - interval '20 minutes' then
    return 'Этот аккаунт уже открыт на другом устройстве';
  end if;
  perform set_config('rose.device_claim', '1', true);
  update public.profiles
    set active_device_id = device, active_at = now()
    where id = auth.uid();
  return 'ok';
end;
$$;

create or replace function public.touch_device(device text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.profiles;
begin
  if auth.uid() is null then
    return 'Нужно войти';
  end if;
  select * into row from public.profiles where id = auth.uid() for update;
  if row.id is null then
    return 'Профиль не найден';
  end if;
  if row.active_device_id is not null
     and row.active_device_id <> device
     and row.active_at is not null
     and row.active_at > now() - interval '20 minutes' then
    return 'Этот аккаунт уже открыт на другом устройстве';
  end if;
  perform set_config('rose.device_claim', '1', true);
  update public.profiles
    set active_device_id = device, active_at = now()
    where id = auth.uid();
  return 'ok';
end;
$$;

create or replace function public.release_device(device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  perform set_config('rose.device_claim', '1', true);
  update public.profiles
    set active_device_id = null, active_at = null
    where id = auth.uid() and active_device_id = device;
end;
$$;

revoke all on function public.keep_device_lock() from public, anon, authenticated;
revoke all on function public.claim_device(text) from public, anon;
revoke all on function public.touch_device(text) from public, anon;
revoke all on function public.release_device(text) from public, anon;
grant execute on function public.claim_device(text) to authenticated;
grant execute on function public.touch_device(text) to authenticated;
grant execute on function public.release_device(text) to authenticated;
