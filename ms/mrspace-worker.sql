-- Mr. Space Uretici Hat (isci) kurulumu
-- Supabase SQL Editor'da bir kez calistir. Tekrar calistirilabilir.
-- Once mrspace-system.sql kurulu olmali. Isci ayarlari varsayilan olarak kapali gelir.

-- 1) Her site hangi repoda, hangi klasorde
alter table public.ms_sites add column if not exists repo text not null default 'Zuzay/mrspace.online';
alter table public.ms_sites add column if not exists repo_path text;

-- 2) Talep uzerinde iscinin durumu
alter table public.ms_changes add column if not exists ai_status text;
alter table public.ms_changes add column if not exists ai_route text;
alter table public.ms_changes add column if not exists ai_model text;
alter table public.ms_changes add column if not exists ai_note text;
alter table public.ms_changes add column if not exists pr_url text;
alter table public.ms_changes add column if not exists ai_cost numeric not null default 0;
alter table public.ms_changes add column if not exists ai_at timestamptz;
alter table public.ms_changes add column if not exists ai_attempts integer not null default 0;

-- 3) Worker settings. No direct Data API access; only guarded RPCs below.
create table if not exists public.ms_worker_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  routes jsonb not null default '{"classify":["gemini","deepseek","haiku"],"content":["gemini","deepseek","haiku"],"code":["deepseek","haiku","gemini"]}'::jsonb,
  budget_month numeric not null default 10 check (budget_month >= 0 and budget_month <= 1000),
  budget_per_request numeric not null default 0.25 check (budget_per_request >= 0 and budget_per_request <= 20),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.ms_worker_settings(id) values (true) on conflict (id) do nothing;
alter table public.ms_worker_settings enable row level security;
revoke all on public.ms_worker_settings from anon, authenticated;

-- Provider-to-Vault references contain IDs only, never plaintext keys.
create table if not exists public.ms_ai_key_refs (
  provider text primary key check (provider in ('gemini','deepseek','haiku')),
  secret_id uuid not null unique,
  updated_at timestamptz not null default now()
);
alter table public.ms_ai_key_refs enable row level security;
revoke all on public.ms_ai_key_refs from anon, authenticated;

-- 4) Admin snapshot: exposes only provider state and last four characters.
create or replace function public.ms_worker_admin_snapshot()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings jsonb;
  v_keys jsonb;
  v_spend numeric;
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;

  select jsonb_build_object(
    'enabled', s.enabled,
    'routes', s.routes,
    'budget_month', s.budget_month,
    'budget_per_request', s.budget_per_request,
    'updated_at', s.updated_at
  ) into v_settings
  from public.ms_worker_settings s where s.id = true;

  select coalesce(jsonb_object_agg(r.provider, jsonb_build_object(
    'configured', d.decrypted_secret is not null,
    'last4', right(d.decrypted_secret, 4)
  )), '{}'::jsonb) into v_keys
  from public.ms_ai_key_refs r
  left join vault.decrypted_secrets d on d.id = r.secret_id;

  select coalesce(sum(c.ai_cost), 0) into v_spend
  from public.ms_changes c
  where c.ai_at >= date_trunc('month', now() at time zone 'America/Los_Angeles');

  return coalesce(v_settings, '{}'::jsonb) || jsonb_build_object(
    'keys', v_keys,
    'month_spend', v_spend
  );
end;
$$;
revoke all on function public.ms_worker_admin_snapshot() from public, anon;
grant execute on function public.ms_worker_admin_snapshot() to authenticated;

-- 5) Admin settings RPC.
create or replace function public.ms_set_worker_settings(
  p_enabled boolean,
  p_routes jsonb,
  p_budget_month numeric,
  p_budget_per_request numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_task text;
  v_provider jsonb;
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  if p_budget_month is null or p_budget_month < 0 or p_budget_month > 1000 then raise exception 'invalid_month_budget'; end if;
  if p_budget_per_request is null or p_budget_per_request < 0 or p_budget_per_request > 20 then raise exception 'invalid_request_budget'; end if;
  if jsonb_typeof(p_routes) <> 'object' then raise exception 'invalid_routes'; end if;
  foreach v_task in array array['classify','content','code'] loop
    v_provider := p_routes -> v_task;
    if jsonb_typeof(v_provider) <> 'array' or jsonb_array_length(v_provider) = 0 then raise exception 'invalid_route'; end if;
    if exists (
      select 1 from jsonb_array_elements_text(v_provider) as x(provider)
      where x.provider not in ('gemini','deepseek','haiku')
    ) then raise exception 'invalid_provider'; end if;
    if (select count(*) from jsonb_array_elements_text(v_provider)) <>
       (select count(distinct x.provider) from jsonb_array_elements_text(v_provider) as x(provider))
    then raise exception 'duplicate_provider'; end if;
  end loop;

  insert into public.ms_worker_settings(id,enabled,routes,budget_month,budget_per_request,updated_at,updated_by)
  values (true,coalesce(p_enabled,false),p_routes,p_budget_month,p_budget_per_request,now(),lower(coalesce(auth.jwt()->>'email','')))
  on conflict (id) do update set enabled=excluded.enabled, routes=excluded.routes,
    budget_month=excluded.budget_month, budget_per_request=excluded.budget_per_request,
    updated_at=now(), updated_by=excluded.updated_by;
end;
$$;
revoke all on function public.ms_set_worker_settings(boolean,jsonb,numeric,numeric) from public, anon;
grant execute on function public.ms_set_worker_settings(boolean,jsonb,numeric,numeric) to authenticated;

-- 6) Store a provider key in Vault; never return the key to the browser.
create or replace function public.ms_set_ai_key(p_provider text, p_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  if p_provider not in ('gemini','deepseek','haiku') then raise exception 'invalid_provider'; end if;
  if length(trim(coalesce(p_key,''))) < 8 or length(p_key) > 4096 then raise exception 'invalid_key'; end if;

  v_name := 'ms_ai_' || p_provider;
  select r.secret_id into v_id from public.ms_ai_key_refs r where r.provider=p_provider;
  if v_id is null then
    v_id := vault.create_secret(trim(p_key), v_name, 'Mr. Space worker provider key');
    insert into public.ms_ai_key_refs(provider,secret_id,updated_at)
    values(p_provider,v_id,now())
    on conflict (provider) do update set secret_id=excluded.secret_id,updated_at=now();
  else
    perform vault.update_secret(v_id, trim(p_key), v_name, 'Mr. Space worker provider key');
    update public.ms_ai_key_refs set updated_at=now() where provider=p_provider;
  end if;

  return jsonb_build_object('provider',p_provider,'configured',true,'last4',right(trim(p_key),4));
end;
$$;
revoke all on function public.ms_set_ai_key(text,text) from public, anon;
grant execute on function public.ms_set_ai_key(text,text) to authenticated;

-- 7) Runtime config is callable only with the server-side service role.
create or replace function public.ms_worker_runtime_config()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.ms_worker_settings%rowtype;
  v_keys jsonb;
begin
  select * into v_settings from public.ms_worker_settings where id=true;
  if not found then raise exception 'worker_settings_missing'; end if;

  select coalesce(jsonb_object_agg(r.provider,d.decrypted_secret),'{}'::jsonb) into v_keys
  from public.ms_ai_key_refs r
  join vault.decrypted_secrets d on d.id=r.secret_id;

  return jsonb_build_object(
    'enabled',v_settings.enabled,
    'routes',v_settings.routes,
    'budget_month',v_settings.budget_month,
    'budget_per_request',v_settings.budget_per_request,
    'keys',v_keys
  );
end;
$$;
revoke all on function public.ms_worker_runtime_config() from public, anon, authenticated;
grant execute on function public.ms_worker_runtime_config() to service_role;

-- 8) Admin manual run. PAT remains in Vault, never in the browser.
create or replace function public.ms_worker_run_now()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
  v_req bigint;
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.ms_worker_settings s where s.id=true and s.enabled) then raise exception 'worker_disabled'; end if;
  select d.decrypted_secret into v_token from vault.decrypted_secrets d where d.name='ms_github_token' limit 1;
  if v_token is null then raise exception 'worker_github_token_missing'; end if;

  select net.http_post(
    url := 'https://api.github.com/repos/Zuzay/mrspace.online/dispatches',
    headers := jsonb_build_object(
      'Authorization','Bearer '||v_token,
      'Accept','application/vnd.github+json',
      'User-Agent','mrspace-db',
      'Content-Type','application/json'
    ),
    body := jsonb_build_object('event_type','ms-work','client_payload',jsonb_build_object('manual',true))
  ) into v_req;
  return jsonb_build_object('queued',true,'request_id',v_req);
end;
$$;
revoke all on function public.ms_worker_run_now() from public, anon;
grant execute on function public.ms_worker_run_now() to authenticated;

-- 9) Trigger existing changes to wake the worker. Worker checks the enabled switch.
create or replace function public.ms_ping_worker()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare tok text;
begin
  select d.decrypted_secret into tok from vault.decrypted_secrets d where d.name = 'ms_github_token' limit 1;
  if tok is null then return new; end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/Zuzay/mrspace.online/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'mrspace-db',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('event_type', 'ms-work', 'client_payload', jsonb_build_object('id', new.id))
  );
  return new;
end;
$$;

drop trigger if exists ms_changes_ping on public.ms_changes;
create trigger ms_changes_ping
  after insert or update of status on public.ms_changes
  for each row
  when (new.status in ('new', 'approved', 'rejected'))
  execute function public.ms_ping_worker();

-- 10) Current month's worker cost
create or replace function public.ms_ai_spend_month()
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(c.ai_cost), 0) from public.ms_changes c
  where c.ai_at >= date_trunc('month', now() at time zone 'America/Los_Angeles');
$$;
revoke all on function public.ms_ai_spend_month() from public, anon;
grant execute on function public.ms_ai_spend_month() to authenticated, service_role;

-- 11) Site repository configuration (set repo_path only after checking the real folder)
-- update public.ms_sites set repo_path = 'rufcut/' where slug = 'rufcut';
