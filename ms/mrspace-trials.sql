-- =====================================================================
-- MR. SPACE · UCRETSIZ DENEME (misafir kurucu) (v1, Ekim 2026)
-- mrspace-builder.sql'den SONRA calistirilir. Tekrar calistirilabilir.
-- =====================================================================

create table if not exists public.ms_trials (
  id           bigserial primary key,
  token        uuid not null default gen_random_uuid() unique,  -- duzenleme linki, sadece deneyen kiside
  preview_key  uuid not null default gen_random_uuid() unique,  -- teklif onizleme linki
  sector       text,
  lang         text not null default 'en',
  content      jsonb not null default '{}'::jsonb,
  theme        jsonb not null default '{}'::jsonb,
  status       text not null default 'draft',   -- draft | submitted | offered | won | closed
  path         text,                            -- self (kendisi doldurdu) | leave (bize birakti, ucretli)
  name         text,
  email        text,
  phone        text,
  business     text,
  note         text,
  consent      boolean not null default false,  -- tasarimi ornek olarak gosterme izni
  ip_hash      text,
  site         text references public.ms_sites(slug) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  submitted_at timestamptz,
  offered_at   timestamptz,
  offer_until  timestamptz
);
create index if not exists ms_trials_status_idx on public.ms_trials(status, submitted_at);
create index if not exists ms_trials_ip_idx on public.ms_trials(ip_hash, created_at);

alter table public.ms_trials enable row level security;
drop policy if exists ms_admin_all on public.ms_trials;
create policy ms_admin_all on public.ms_trials for all using (public.ms_is_admin()) with check (public.ms_is_admin());

-- ---------- Misafir tarafi ----------
create or replace function public.ms_trial_start(p_sector text, p_lang text, p_content jsonb, p_theme jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare ip text; h text; n int; t ms_trials;
begin
  ip := coalesce(split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1), '');
  h := md5(ip || 'mrspace');
  select count(*) into n from ms_trials where created_at > now() - interval '1 day';
  if n >= 300 then raise exception 'busy'; end if;
  if ip <> '' then
    select count(*) into n from ms_trials where ip_hash = h and created_at > now() - interval '1 day';
    if n >= 6 then raise exception 'too_many'; end if;
  end if;
  if pg_column_size(p_content) + pg_column_size(p_theme) > 200000 then raise exception 'too_big'; end if;
  insert into ms_trials(sector, lang, content, theme, ip_hash)
  values (left(p_sector, 30), case when p_lang = 'tr' then 'tr' else 'en' end, coalesce(p_content, '{}'), coalesce(p_theme, '{}'), h)
  returning * into t;
  return json_build_object('token', t.token);
end $$;

create or replace function public.ms_trial_get(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('status', t.status, 'sector', t.sector, 'lang', t.lang, 'content', t.content, 'theme', t.theme,
    'path', t.path, 'submitted_at', t.submitted_at,
    'preview_key', case when t.status in ('offered', 'won') then t.preview_key end)
  from ms_trials t where t.token = p_token;
$$;

create or replace function public.ms_trial_save(p_token uuid, p_content jsonb, p_theme jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare t ms_trials;
begin
  select * into t from ms_trials where token = p_token for update;
  if not found then raise exception 'unknown'; end if;
  if t.status <> 'draft' then raise exception 'locked'; end if;
  if pg_column_size(p_content) + pg_column_size(p_theme) > 400000 then raise exception 'too_big'; end if;
  update ms_trials set content = coalesce(p_content, content), theme = coalesce(p_theme, theme), updated_at = now() where id = t.id;
  return json_build_object('ok', true);
end $$;

create or replace function public.ms_trial_submit(p_token uuid, p_path text, p_name text, p_email text,
  p_phone text default null, p_business text default null, p_note text default null, p_consent boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare t ms_trials;
begin
  select * into t from ms_trials where token = p_token for update;
  if not found then raise exception 'unknown'; end if;
  if t.status <> 'draft' then raise exception 'locked'; end if;
  if coalesce(p_email, '') !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then raise exception 'bad_email'; end if;
  if length(coalesce(p_name, '')) < 2 then raise exception 'bad_name'; end if;
  update ms_trials set status = 'submitted', submitted_at = now(), updated_at = now(),
    path = case when p_path = 'leave' then 'leave' else 'self' end,
    name = left(p_name, 120), email = lower(left(p_email, 200)), phone = left(p_phone, 40),
    business = left(coalesce(nullif(p_business, ''), t.content #>> '{business,name}'), 120),
    note = left(p_note, 2000), consent = coalesce(p_consent, false)
  where id = t.id;
  insert into ms_activity(site, who, action) values (null, 'client',
    'Trial sent: ' || coalesce(nullif(p_business, ''), t.content #>> '{business,name}', 'no name') ||
    case when p_path = 'leave' then ' (leave it to us)' else ' (filled by client)' end);
  return json_build_object('ok', true);
end $$;

-- Teklif onizlemesi (filigranli, sureli)
create or replace function public.ms_trial_preview(p_key uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('business', t.business, 'content', t.content, 'theme', t.theme, 'until', t.offer_until, 'path', t.path)
  from ms_trials t
  where t.preview_key = p_key and t.status in ('offered', 'won')
    and (t.offer_until is null or t.offer_until > now());
$$;

revoke all on function public.ms_trial_start(text, text, jsonb, jsonb) from public;
revoke all on function public.ms_trial_get(uuid) from public;
revoke all on function public.ms_trial_save(uuid, jsonb, jsonb) from public;
revoke all on function public.ms_trial_submit(uuid, text, text, text, text, text, text, boolean) from public;
revoke all on function public.ms_trial_preview(uuid) from public;
grant execute on function public.ms_trial_start(text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.ms_trial_get(uuid) to anon, authenticated;
grant execute on function public.ms_trial_save(uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.ms_trial_submit(uuid, text, text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.ms_trial_preview(uuid) to anon, authenticated;

-- ---------- Yonetici tarafi ----------
create or replace function public.ms_trial_offer(p_id bigint, p_days int default 14)
returns uuid language plpgsql security definer set search_path = public as $$
declare t ms_trials;
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  update ms_trials set status = 'offered', offered_at = now(), updated_at = now(),
    offer_until = now() + make_interval(days => greatest(1, least(coalesce(p_days, 14), 60)))
  where id = p_id and status in ('submitted', 'offered') returning * into t;
  if not found then raise exception 'wrong_status'; end if;
  insert into ms_activity(site, who, action) values (null, 'uzay', 'Trial offer ready: ' || coalesce(t.business, t.email));
  return t.preview_key;
end $$;

create or replace function public.ms_trial_convert(p_id bigint, p_slug text, p_name text default null)
returns text language plpgsql security definer set search_path = public as $$
declare t ms_trials; slug text;
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  select * into t from ms_trials where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  slug := lower(regexp_replace(coalesce(p_slug, ''), '[^a-z0-9-]', '', 'gi'));
  if length(slug) < 2 then raise exception 'bad_slug'; end if;
  insert into ms_sites(slug, name, kind, plan, status, contact, mode, notes)
  values (slug, coalesce(nullif(p_name, ''), t.business, slug), 'client', 'rent', 'building', t.email, 'builder', 'From trial #' || t.id);
  insert into ms_builds(site, mode, theme, content) values (slug, 'builder', t.theme, t.content);
  update ms_trials set status = 'won', site = slug, updated_at = now() where id = p_id;
  insert into ms_activity(site, who, action) values (slug, 'uzay', 'Trial became a client');
  return slug;
end $$;

grant execute on function public.ms_trial_offer(bigint, int) to authenticated;
grant execute on function public.ms_trial_convert(bigint, text, text) to authenticated;

-- Eski, gonderilmemis taslaklari temizle (30 gun)
select cron.unschedule(jobid) from cron.job where jobname = 'ms-trials-clean';
select cron.schedule('ms-trials-clean', '50 10 * * *',
  $$delete from public.ms_trials where status = 'draft' and updated_at < now() - interval '30 days'$$);
