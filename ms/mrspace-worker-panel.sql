-- Mr. Space Uretici Hat panel ayarlari ve API anahtarlari.
-- Supabase SQL Editor'da mrspace-system.sql kurulduktan sonra calistirilir.
-- Guvenli sekilde tekrar calistirilabilir.

create extension if not exists supabase_vault with schema vault;

alter table public.ms_sites add column if not exists repo text not null default 'Zuzay/mrspace.online';
alter table public.ms_sites add column if not exists repo_path text;
alter table public.ms_changes add column if not exists ai_status text;
alter table public.ms_changes add column if not exists ai_route text;
alter table public.ms_changes add column if not exists ai_model text;
alter table public.ms_changes add column if not exists ai_note text;
alter table public.ms_changes add column if not exists pr_url text;
alter table public.ms_changes add column if not exists ai_cost numeric not null default 0;
alter table public.ms_changes add column if not exists ai_at timestamptz;
alter table public.ms_changes add column if not exists ai_attempts integer not null default 0;

-- ---------- 1) Isci ayarlari ----------
create table if not exists public.ms_worker_settings (
  id                  boolean primary key default true check (id),
  enabled             boolean not null default false,
  routes              jsonb not null default '{
    "classify": ["gemini", "deepseek", "haiku"],
    "content":  ["gemini", "deepseek", "haiku"],
    "code":     ["deepseek", "haiku", "gemini"]
  }'::jsonb,
  budget_month        numeric(10,2) not null default 10 check (budget_month >= 0),
  -- Null means the owner has not configured this limit yet; the worker must fail closed.
  budget_per_request  numeric(10,2) check (budget_per_request is null or budget_per_request >= 0),
  updated_at          timestamptz not null default now()
);

-- Tek ayar satiri. Isci guvenli varsayilan olarak kapali baslar.
insert into public.ms_worker_settings (id) values (true)
on conflict (id) do nothing;

alter table public.ms_worker_settings enable row level security;
drop policy if exists ms_admin_all on public.ms_worker_settings;
create policy ms_admin_all on public.ms_worker_settings
  for all using (public.ms_is_admin()) with check (public.ms_is_admin());

revoke all on table public.ms_worker_settings from public, anon, authenticated;
grant select, insert, update on table public.ms_worker_settings to authenticated;
grant select, insert, update on table public.ms_worker_settings to service_role;

-- ---------- 2) API anahtarlarini Vault'a guvenli yaz ----------
-- Saglayici adlari worker.mjs ile eslesir: gemini, deepseek, haiku.
create or replace function public.ms_set_ai_key(p_provider text, p_key text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_name text;
  v_id uuid;
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  if v_provider not in ('gemini', 'deepseek', 'haiku', 'github') then
    raise exception 'invalid_provider';
  end if;
  if p_key is null or length(trim(p_key)) = 0 or length(p_key) > 4096 then
    raise exception 'invalid_key';
  end if;

  v_name := case when v_provider='github' then 'ms_github_token' else 'ms_ai_' || v_provider || '_api_key' end;
  select s.id into v_id from vault.secrets s where s.name = v_name limit 1;
  if v_id is null then
    perform vault.create_secret(p_key, v_name, 'Mr. Space worker API key: ' || v_provider, null);
  else
    perform vault.update_secret(v_id, p_key, v_name, 'Mr. Space worker API key: ' || v_provider, null);
  end if;
end $$;

revoke all on function public.ms_set_ai_key(text, text) from public, anon;
grant execute on function public.ms_set_ai_key(text, text) to authenticated;

-- ---------- 3) Yonetici icin yalnizca maskeli anahtar durumu ----------
create or replace function public.ms_ai_keys_masked()
returns table(provider text, configured boolean, last4 text)
language plpgsql stable security definer set search_path = public, vault as $$
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  return query
    select p.provider,
           d.id is not null,
           case when d.id is null then null else right(d.decrypted_secret, 4) end
    from (values ('gemini'), ('deepseek'), ('haiku'), ('github')) as p(provider)
    left join lateral (
      select x.id, x.decrypted_secret
      from vault.decrypted_secrets x
      where x.name = case when p.provider='github' then 'ms_github_token' else 'ms_ai_' || p.provider || '_api_key' end
      order by x.updated_at desc
      limit 1
    ) d on true
    order by p.provider;
end $$;

revoke all on function public.ms_ai_keys_masked() from public, anon;
grant execute on function public.ms_ai_keys_masked() to authenticated;

-- ---------- 4) Isci icin gizli anahtar okuma kapisi ----------
-- Worker sadece service_role anahtariyla cagirsin; istemci rolleri RPC'yi cagiramaz.
create or replace function public.ms_ai_keys()
returns jsonb language sql stable security definer set search_path = public, vault as $$
  select coalesce(jsonb_object_agg(p.provider, d.decrypted_secret)
                   filter (where d.id is not null), '{}'::jsonb)
  from (values ('gemini'), ('deepseek'), ('haiku')) as p(provider)
  left join lateral (
    select x.id, x.decrypted_secret
    from vault.decrypted_secrets x
    where x.name = 'ms_ai_' || p.provider || '_api_key'
    order by x.updated_at desc
    limit 1
  ) d on true;
$$;

revoke all on function public.ms_ai_keys() from public, anon, authenticated;
grant execute on function public.ms_ai_keys() to service_role;

-- ---------- 5) Admin snapshot and validated settings ----------
create or replace function public.ms_worker_admin_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public, vault as $$
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
  select coalesce(jsonb_agg(jsonb_build_object(
    'provider', p.provider,
    'configured', d.id is not null,
    'last4', case when d.id is null then null else right(d.decrypted_secret, 4) end
  ) order by p.provider), '[]'::jsonb) into v_keys
  from (values ('gemini'), ('deepseek'), ('haiku'), ('github')) as p(provider)
  left join lateral (
    select x.id, x.decrypted_secret
    from vault.decrypted_secrets x
    where x.name = case when p.provider='github' then 'ms_github_token' else 'ms_ai_' || p.provider || '_api_key' end
    order by x.updated_at desc limit 1
  ) d on true;
  select coalesce(sum(c.ai_cost), 0) into v_spend
  from public.ms_changes c
  where c.ai_at >= date_trunc('month', now() at time zone 'America/Los_Angeles')
    at time zone 'America/Los_Angeles';
  return coalesce(v_settings, '{}'::jsonb) || jsonb_build_object('keys', v_keys, 'spend_month', v_spend);
end $$;

revoke all on function public.ms_worker_admin_snapshot() from public, anon;
grant execute on function public.ms_worker_admin_snapshot() to authenticated;

create or replace function public.ms_set_worker_settings(
  p_enabled boolean,
  p_routes jsonb,
  p_budget_month numeric,
  p_budget_per_request numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_route text;
  v_item jsonb;
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  if p_budget_month is null or p_budget_month <= 0 or p_budget_month > 10000
     or p_budget_per_request is null or p_budget_per_request <= 0
     or p_budget_per_request > p_budget_month then
    raise exception 'invalid_budget';
  end if;
  if jsonb_typeof(p_routes) <> 'object'
     or (select count(*) from jsonb_object_keys(p_routes)) <> 3
     or not (p_routes ?& array['classify','content','code']) then
    raise exception 'invalid_routes';
  end if;
  foreach v_route in array array['classify','content','code'] loop
    if jsonb_typeof(p_routes->v_route) <> 'array'
       or jsonb_array_length(p_routes->v_route) < 1
       or jsonb_array_length(p_routes->v_route) > 3 then
      raise exception 'invalid_routes';
    end if;
    for v_item in select value from jsonb_array_elements(p_routes->v_route) loop
      if jsonb_typeof(v_item) <> 'string' or v_item #>> '{}' not in ('gemini','deepseek','haiku') then
        raise exception 'invalid_provider';
      end if;
    end loop;
    if (select count(distinct value) from jsonb_array_elements_text(p_routes->v_route)) <> jsonb_array_length(p_routes->v_route) then
      raise exception 'duplicate_provider';
    end if;
  end loop;
  insert into public.ms_worker_settings(id,enabled,routes,budget_month,budget_per_request,updated_at)
  values (true,p_enabled,p_routes,p_budget_month,p_budget_per_request,now())
  on conflict (id) do update set enabled=excluded.enabled,routes=excluded.routes,
    budget_month=excluded.budget_month,budget_per_request=excluded.budget_per_request,updated_at=now();
end $$;

revoke all on function public.ms_set_worker_settings(boolean,jsonb,numeric,numeric) from public, anon;
grant execute on function public.ms_set_worker_settings(boolean,jsonb,numeric,numeric) to authenticated;

-- ---------- 6) Worker runtime config and budget read ----------
create or replace function public.ms_worker_runtime_config()
returns jsonb language plpgsql stable security definer set search_path = public, vault as $$
declare
  v jsonb;
  v_github text;
begin
  select jsonb_build_object(
    'enabled', s.enabled,
    'routes', s.routes,
    'budget_month', s.budget_month,
    'budget_per_request', s.budget_per_request
  ) into v from public.ms_worker_settings s where s.id=true;
  if v is null then return '{}'::jsonb; end if;
  select x.decrypted_secret into v_github from vault.decrypted_secrets x
  where x.name='ms_github_token' order by x.updated_at desc limit 1;
  return v || jsonb_build_object('keys', public.ms_ai_keys(), 'github_token', v_github);
end $$;

revoke all on function public.ms_worker_runtime_config() from public, anon, authenticated;
grant execute on function public.ms_worker_runtime_config() to service_role;

create or replace function public.ms_ai_spend_month()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(c.ai_cost),0)
  from public.ms_changes c
  where c.ai_at >= date_trunc('month', now() at time zone 'America/Los_Angeles')
    at time zone 'America/Los_Angeles';
$$;
revoke all on function public.ms_ai_spend_month() from public, anon, authenticated;
grant execute on function public.ms_ai_spend_month() to service_role;

-- ---------- 7) Manual run-now dispatch ----------
create or replace function public.ms_worker_run_now()
returns boolean language plpgsql security definer set search_path = public, vault, net as $$
declare tok text;
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name='ms_github_token' order by updated_at desc limit 1;
  if tok is null then raise exception 'github_token_missing'; end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/Zuzay/mrspace.online/dispatches',
    headers := jsonb_build_object('Authorization','Bearer '||tok,'Accept','application/vnd.github+json','User-Agent','mrspace-db','Content-Type','application/json'),
    body := jsonb_build_object('event_type','ms-work','client_payload',jsonb_build_object('manual',true))
  );
  return true;
end $$;
revoke all on function public.ms_worker_run_now() from public, anon;
grant execute on function public.ms_worker_run_now() to authenticated;

-- Keep automatic dispatch disabled until the user enables the worker in the panel.
create or replace function public.ms_ping_worker()
returns trigger language plpgsql security definer set search_path = public, vault, net as $$
declare tok text; enabled_now boolean;
begin
  select enabled into enabled_now from public.ms_worker_settings where id=true;
  if not coalesce(enabled_now,false) then return new; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name='ms_github_token' order by updated_at desc limit 1;
  if tok is null then return new; end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/Zuzay/mrspace.online/dispatches',
    headers := jsonb_build_object('Authorization','Bearer '||tok,'Accept','application/vnd.github+json','User-Agent','mrspace-db','Content-Type','application/json'),
    body := jsonb_build_object('event_type','ms-work','client_payload',jsonb_build_object('id',new.id))
  );
  return new;
end $$;

revoke all on function public.ms_ping_worker() from public, anon, authenticated;
drop trigger if exists ms_changes_ping on public.ms_changes;
create trigger ms_changes_ping after insert or update of status on public.ms_changes
for each row when (new.status in ('new','approved','rejected')) execute function public.ms_ping_worker();
