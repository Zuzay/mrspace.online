-- =====================================================================
-- MR. SPACE · MERKEZI SISTEM (v1, Ekim 2026)
-- laloo Supabase projesine eklenir. Tum tablolar "ms_" ile baslar,
-- laloo'nun mevcut tablolarina dokunmaz.
-- Supabase > SQL Editor > New query > hepsini yapistir > Run.
-- Tekrar calistirilabilir.
-- =====================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- 0) Kim yonetici? ----------
create table if not exists public.ms_admins (
  email text primary key,
  created_at timestamptz not null default now()
);
-- laloo yoneticileri ilk kurulumda Mr. Space yoneticisi de olur
insert into public.ms_admins(email) select lower(email) from public.admins on conflict do nothing;

create or replace function public.ms_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ms_admins a
                 where a.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------- 1) Siteler ----------
create table if not exists public.ms_sites (
  slug          text primary key,                 -- heron, laloo, rufcut ...
  name          text not null,
  url           text,                             -- canli adres (izleme bunu kontrol eder)
  admin_url     text,                             -- sitenin kendi admin paneli
  kind          text not null default 'client',   -- own | client
  plan          text not null default 'rent',     -- own | rent | custom | handover | first
  status        text not null default 'building', -- building | live | paused | suspended
  small_quota   int,                              -- ayda kucuk degisiklik hakki (null = sinirsiz / saatlik)
  big_quota     int,                              -- yilda buyuk degisiklik hakki
  monthly_cents int not null default 0,
  paid_until    date,                             -- odeme bu tarihe kadar yapildi
  grace_days    int not null default 7,           -- gecikmede kac gun bekle
  contact       text,                             -- musteri e-postasi
  site_key      uuid not null default gen_random_uuid(),  -- musterinin talep linki icin gizli anahtar
  log_key       uuid not null default gen_random_uuid(),  -- sitenin kendi panelinin kayit gondermesi icin
  suspend_message text,
  notes         text,
  created_at    timestamptz not null default now()
);

alter table public.ms_sites add column if not exists log_key uuid not null default gen_random_uuid();

-- ---------- 2) Degisiklik talepleri ----------
create table if not exists public.ms_changes (
  id           bigserial primary key,
  site         text not null references public.ms_sites(slug) on delete cascade,
  kind         text not null default 'small',     -- small | big
  target       text not null default '',          -- neyi degistiriyor: logo, hours, menu ...
  request      text not null,
  requested_by text,
  status       text not null default 'new',       -- new | approved | done | rejected
  counts       boolean,                           -- kotadan dustu mu (12 saat kurali)
  minutes      int,                               -- harcanan sure
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  done_at      timestamptz
);
create index if not exists ms_changes_site_idx on public.ms_changes(site, created_at desc);

-- ---------- 3) Aktivite kaydi (elle + otomatik) ----------
create table if not exists public.ms_activity (
  id      bigserial primary key,
  site    text references public.ms_sites(slug) on delete cascade,
  at      timestamptz not null default now(),
  who     text not null default 'uzay',           -- auto | uzay | client | claude
  action  text not null,
  minutes int not null default 0,
  meta    jsonb
);
create index if not exists ms_activity_site_idx on public.ms_activity(site, at desc);

-- ---------- 4) Izleme (site ayakta mi) ----------
create table if not exists public.ms_checks (
  id     bigserial primary key,
  site   text not null references public.ms_sites(slug) on delete cascade,
  at     timestamptz not null default now(),
  ok     boolean not null,
  status int,
  ms     int,
  error  text
);
create index if not exists ms_checks_site_idx on public.ms_checks(site, at desc);
create table if not exists public.ms_pending (
  rid  bigint primary key,
  site text not null,
  at   timestamptz not null default now()
);

-- ---------- 5) Ucretli servis kullanimi (musterinin kendi hesabi) ----------
create table if not exists public.ms_usage (
  site       text not null references public.ms_sites(slug) on delete cascade,
  service    text not null,                       -- "Google images", "AI writing" ...
  used       numeric not null default 0,
  lim        numeric,
  unit       text,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (site, service)
);

-- ---------- 6) Odemeler ----------
create table if not exists public.ms_payments (
  id           bigserial primary key,
  site         text not null references public.ms_sites(slug) on delete cascade,
  amount_cents int not null,
  paid_at      date not null default current_date,
  period_to    date,
  note         text
);

-- ---------- 7) Erisim: sadece yonetici ----------
do $$ declare t text; begin
  foreach t in array array['ms_admins','ms_sites','ms_changes','ms_activity','ms_checks','ms_pending','ms_usage','ms_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ms_admin_all on public.%I', t);
    execute format('create policy ms_admin_all on public.%I for all using (public.ms_is_admin()) with check (public.ms_is_admin())', t);
  end loop;
end $$;

-- ---------- 8) Kota ----------
create or replace function public.ms_quota(p_site text)
returns table(small_used int, small_quota int, big_used int, big_quota int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from ms_changes c where c.site = p_site and c.kind = 'small' and c.counts
       and date_trunc('month', c.decided_at at time zone 'America/Los_Angeles') = date_trunc('month', now() at time zone 'America/Los_Angeles')),
    s.small_quota,
    (select count(*)::int from ms_changes c where c.site = p_site and c.kind = 'big' and c.counts
       and date_trunc('year', c.decided_at at time zone 'America/Los_Angeles') = date_trunc('year', now() at time zone 'America/Los_Angeles')),
    s.big_quota
  from ms_sites s where s.slug = p_site;
$$;

-- Onay: ayni sey 12 saat icinde tekrar degisirse kotadan dusmez
create or replace function public.ms_decide_change(p_id bigint, p_status text, p_minutes int default null)
returns public.ms_changes language plpgsql security definer set search_path = public as $$
declare c ms_changes; prev int;
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  select * into c from ms_changes where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_status = 'approved' and c.status = 'new' then
    select count(*) into prev from ms_changes x
     where x.site = c.site and x.id <> c.id and x.counts and lower(x.target) = lower(c.target) and c.target <> ''
       and x.decided_at > now() - interval '12 hours';
    update ms_changes set status = 'approved', decided_at = now(), counts = (prev = 0) where id = p_id returning * into c;
    insert into ms_activity(site, who, action) values (c.site, 'uzay',
      'Approved change: ' || left(c.request, 80) || case when c.counts then '' else ' (same change within 12 h, not counted)' end);
  elsif p_status = 'rejected' and c.status = 'new' then
    update ms_changes set status = 'rejected', decided_at = now(), counts = false where id = p_id returning * into c;
    insert into ms_activity(site, who, action) values (c.site, 'uzay', 'Declined change: ' || left(c.request, 80));
  elsif p_status = 'done' and c.status in ('new','approved') then
    update ms_changes set status = 'done', done_at = now(), minutes = coalesce(p_minutes, minutes),
      decided_at = coalesce(decided_at, now()), counts = coalesce(counts, true) where id = p_id returning * into c;
    insert into ms_activity(site, who, action, minutes) values (c.site, 'uzay', 'Done: ' || left(c.request, 80), coalesce(p_minutes, 0));
  end if;
  return c;
end $$;

-- Odeme kaydi: paid_until ileri alinir, askidaysa tekrar acilir
create or replace function public.ms_record_payment(p_site text, p_cents int, p_period_to date, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  insert into ms_payments(site, amount_cents, period_to, note) values (p_site, p_cents, p_period_to, p_note);
  update ms_sites set paid_until = greatest(coalesce(paid_until, p_period_to), p_period_to),
    status = case when status = 'suspended' then 'live' else status end where slug = p_site;
  insert into ms_activity(site, who, action) values (p_site, 'uzay', 'Payment recorded: $' || to_char(p_cents / 100.0, 'FM999990.00') || ' until ' || p_period_to);
end $$;

-- ---------- 9) Herkese acik kucuk kapilar ----------
-- Siteler bunu cagirir: askida mi?
create or replace function public.ms_site_state(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'suspended', (s.status = 'suspended')
       or (s.kind = 'client' and s.plan <> 'handover' and s.paid_until is not null
           and s.paid_until + s.grace_days < current_date),
    'message', coalesce(s.suspend_message, 'This site is taking a short break. It will be back soon.'))
  from ms_sites s where s.slug = p_slug;
$$;

-- Musteri talep sayfasi (gizli linkle): ozet
create or replace function public.ms_client_view(p_key uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', s.name, 'plan', s.plan,
    'quota', (select row_to_json(q) from ms_quota(s.slug) q),
    'requests', coalesce((select json_agg(json_build_object('kind', c.kind, 'target', c.target, 'request', c.request,
                 'status', c.status, 'counts', c.counts, 'at', c.created_at) order by c.created_at desc)
                 from (select * from ms_changes where site = s.slug order by created_at desc limit 20) c), '[]'::json))
  from ms_sites s where s.site_key = p_key;
$$;

-- Musteri talep gonderir
create or replace function public.ms_request_change(p_key uuid, p_kind text, p_target text, p_request text, p_name text default null)
returns json language plpgsql security definer set search_path = public as $$
declare s ms_sites; n int;
begin
  select * into s from ms_sites where site_key = p_key;
  if not found then raise exception 'unknown_site'; end if;
  if length(coalesce(p_request, '')) < 3 then raise exception 'empty'; end if;
  select count(*) into n from ms_changes where site = s.slug and created_at > now() - interval '1 hour';
  if n >= 10 then raise exception 'too_many'; end if;
  insert into ms_changes(site, kind, target, request, requested_by)
    values (s.slug, case when p_kind = 'big' then 'big' else 'small' end, left(coalesce(p_target, ''), 60), left(p_request, 2000), left(p_name, 80));
  insert into ms_activity(site, who, action) values (s.slug, 'client', 'New change request: ' || left(p_request, 80));
  return json_build_object('ok', true);
end $$;

revoke all on function public.ms_site_state(text) from public;
revoke all on function public.ms_client_view(uuid) from public;
revoke all on function public.ms_request_change(uuid, text, text, text, text) from public;
grant execute on function public.ms_site_state(text) to anon, authenticated;
grant execute on function public.ms_client_view(uuid) to anon, authenticated;
grant execute on function public.ms_request_change(uuid, text, text, text, text) to anon, authenticated;

-- ---------- 10) Izleme: her 15 dakikada siteleri kontrol et ----------
create or replace function public.ms_run_checks() returns void
language plpgsql security definer set search_path = public, net as $$
declare p record; s record; was_ok boolean; now_ok boolean;
  v_id bigint; v_code int; v_timed boolean; v_err text; v_created timestamptz;
begin
  -- 1) onceki turun cevaplarini topla
  for p in select * from ms_pending loop
    v_id := null; v_code := null; v_timed := null; v_err := null; v_created := null;
    select id, status_code, timed_out, error_msg, created into v_id, v_code, v_timed, v_err, v_created
      from net._http_response where id = p.rid;
    if v_id is not null or p.at < now() - interval '2 minutes' then
      select ok into was_ok from ms_checks where site = p.site order by at desc limit 1;
      now_ok := coalesce(v_code between 200 and 399 and not coalesce(v_timed, false), false);
      insert into ms_checks(site, at, ok, status, ms, error) values (
        p.site, p.at, now_ok, v_code,
        case when v_created is not null then greatest(0, (extract(epoch from (v_created - p.at)) * 1000)::int) end,
        case when v_id is null then 'no response' else v_err end);
      if was_ok is not null and was_ok <> now_ok then
        insert into ms_activity(site, who, action) values (p.site, 'auto',
          case when now_ok then 'Site is back up' else 'Site did not answer' end);
      end if;
      delete from ms_pending where rid = p.rid;
    end if;
  end loop;
  -- 2) yeni tur
  for s in select slug, url from ms_sites where url is not null and status in ('live','building','suspended') loop
    insert into ms_pending(rid, site) values (net.http_get(url := s.url, timeout_milliseconds := 10000), s.slug);
  end loop;
  -- 3) 30 gunden eski kontrolleri sil
  delete from ms_checks where at < now() - interval '30 days';
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'ms-checks';
select cron.schedule('ms-checks', '*/15 * * * *', $$select public.ms_run_checks()$$);

-- Gunluk ozet satiri (her gece 02:10 LA = 09:10 UTC). laloo icin son 24 saatin sayilari da eklenir.
create or replace function public.ms_count_24h(t text) returns int
language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  if to_regclass('public.' || t) is null then return null; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'created_at') then return null; end if;
  execute format('select count(*)::int from public.%I where created_at > now() - interval %L', t, '24 hours') into n;
  return n;
end $$;

create or replace function public.ms_nightly() returns void
language plpgsql security definer set search_path = public as $$
declare s record; m jsonb;
begin
  for s in select slug from ms_sites where status <> 'paused' loop
    m := jsonb_build_object('uptime_24h', (select round(100.0 * avg(case when ok then 1 else 0 end), 1)
                                             from ms_checks where site = s.slug and at > now() - interval '24 hours'));
    if s.slug = 'laloo' then
      m := m || jsonb_strip_nulls(jsonb_build_object('reviews', ms_count_24h('reviews'), 'members', ms_count_24h('members'),
                                                     'stories', ms_count_24h('stories'), 'flags', ms_count_24h('flags')));
    end if;
    insert into ms_activity(site, who, action, meta) values (s.slug, 'auto', 'Nightly check', m);
  end loop;
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'ms-nightly';
select cron.schedule('ms-nightly', '10 9 * * *', $$select public.ms_nightly()$$);

-- laloo: her yeni sikayet (flag) kayda dusar, bakilmasi gereken bir is
create or replace function public.ms_laloo_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into ms_activity(site, who, action) values ('laloo', 'auto', 'New report on laloo, needs a look');
  return new;
end $$;
do $$ begin
  if to_regclass('public.flags') is not null then
    drop trigger if exists ms_laloo_flag on public.flags;
    create trigger ms_laloo_flag after insert on public.flags for each row execute function public.ms_laloo_flag();
  end if;
end $$;

-- Diger sitelerin kendi panelleri (ornek: Heron) kayit gonderebilsin diye: sitenin gizli anahtariyla
create or replace function public.ms_log_event(p_key uuid, p_action text, p_minutes int default 0)
returns json language plpgsql security definer set search_path = public as $$
declare s ms_sites; n int;
begin
  select * into s from ms_sites where log_key = p_key;
  if not found then raise exception 'unknown_site'; end if;
  select count(*) into n from ms_activity where site = s.slug and at > now() - interval '1 hour' and who = 'auto';
  if n >= 120 then raise exception 'too_many'; end if;
  insert into ms_activity(site, who, action, minutes) values (s.slug, 'auto', left(coalesce(p_action, ''), 200), greatest(0, least(coalesce(p_minutes, 0), 600)));
  return json_build_object('ok', true);
end $$;
revoke all on function public.ms_log_event(uuid, text, int) from public;
grant execute on function public.ms_log_event(uuid, text, int) to anon, authenticated;

-- ---------- 11) Ilk siteler ----------
insert into public.ms_sites(slug, name, url, admin_url, kind, plan, status, small_quota, big_quota, monthly_cents, notes) values
  ('mrspace', 'Mr. Space', 'https://mrspace.online/', 'https://mrspace.online/admin/', 'own', 'own', 'live', null, null, 0, 'Studio site'),
  ('heron',   'Heron CA',  'https://heronca.com/', 'https://heronca.com/admin.html', 'own', 'own', 'live', null, null, 0, 'Own brand. Separate Supabase project for the shop.'),
  ('laloo',   'laloo',     'https://www.laloo.org/', 'https://www.laloo.org/admin.html', 'own', 'own', 'live', null, null, 0, 'Own product. Same Supabase project as this system.'),
  ('rufcut',  'Rufcut',    'https://mrspace.online/rufcut/', null, 'client', 'first', 'building', 8, 4, 5000, 'First client offer. Concept demo until signed.')
on conflict (slug) do nothing;

insert into public.ms_usage(site, service, used, lim, unit) values
  ('heron', 'Google aerial video', 0, 4900, 'calls / month'),
  ('heron', 'AI writing', 0, null, 'USD / month'),
  ('laloo', 'Map tiles', 0, null, 'loads / month')
on conflict do nothing;

insert into public.ms_activity(site, who, action) select null, 'claude', 'Mr. Space system installed'
  where not exists (select 1 from public.ms_activity where action = 'Mr. Space system installed');
select public.ms_run_checks();
