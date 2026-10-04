-- =====================================================================
-- MR. SPACE · SITE KURUCU + ONAY SISTEMI (v1, Ekim 2026)
-- mrspace-system.sql ve mrspace-scout.sql'den SONRA calistirilir.
-- Tekrar calistirilabilir.
-- =====================================================================

-- ---------- 1) Sitelere yeni alanlar ----------
alter table public.ms_sites add column if not exists mode text not null default 'builder'; -- builder (Paket 1) | fill (Paket 2-3)
alter table public.ms_sites add column if not exists field_schema jsonb;                    -- fill modunda musterinin gorecegi alanlar
alter table public.ms_sites add column if not exists country text;                         -- US, TR, CY ... (yasal kontroller icin)
alter table public.ms_sites add column if not exists host text;                            -- musterinin alan adi (ornek.com)
alter table public.ms_sites add column if not exists published_build bigint;
create unique index if not exists ms_sites_host_idx on public.ms_sites(lower(host)) where host is not null;

-- ---------- 2) Surumler ----------
create table if not exists public.ms_builds (
  id             bigserial primary key,
  site           text not null references public.ms_sites(slug) on delete cascade,
  version        int not null default 1,
  mode           text not null default 'builder',
  theme          jsonb not null default '{}'::jsonb,
  content        jsonb not null default '{}'::jsonb,
  status         text not null default 'draft',   -- draft | checking | review | returned | published | archived
  client_note    text,                            -- musterinin gonderirken yazdigi not
  return_note    text,                            -- geri gonderirken musteriye giden not
  admin_note     text,                            -- sadece senin notun
  checks_summary jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  published_at   timestamptz,
  unique (site, version)
);
create index if not exists ms_builds_status_idx on public.ms_builds(status, submitted_at);

create table if not exists public.ms_build_checks (
  id       bigserial primary key,
  build_id bigint not null references public.ms_builds(id) on delete cascade,
  code     text not null,
  level    text not null,                         -- pass | info | warn | fail
  message  text not null,
  details  jsonb,
  at       timestamptz not null default now()
);
create index if not exists ms_build_checks_idx on public.ms_build_checks(build_id);

do $$ declare t text; begin
  foreach t in array array['ms_builds','ms_build_checks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ms_admin_all on public.%I', t);
    execute format('create policy ms_admin_all on public.%I for all using (public.ms_is_admin()) with check (public.ms_is_admin())', t);
  end loop;
end $$;

-- ---------- 3) Gorseller icin depo (herkes okur, sadece fonksiyon yazar) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ms-media', 'ms-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- ---------- 4) Kontrolleri baslat ----------
create or replace function public.ms_builder_kick(p_build bigint) returns void
language plpgsql security definer set search_path = public, net as $$
declare sec text;
begin
  select value into sec from ms_settings where key = 'cron_secret';
  perform net.http_post(
    url     := 'https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-builder',
    body    := jsonb_build_object('action', 'check', 'build_id', p_build),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ms-secret', sec),
    timeout_milliseconds := 10000);
end $$;
revoke all on function public.ms_builder_kick(bigint) from public, anon, authenticated;

-- ---------- 5) Musteri tarafi (gizli linkle) ----------
create or replace function public.ms_builder_get(p_key uuid)
returns json language plpgsql security definer set search_path = public as $$
declare s ms_sites; b ms_builds;
begin
  select * into s from ms_sites where site_key = p_key;
  if not found then raise exception 'unknown_site'; end if;
  select * into b from ms_builds where site = s.slug order by version desc limit 1;
  if not found then
    insert into ms_builds(site, mode) values (s.slug, s.mode) returning * into b;
  end if;
  return json_build_object(
    'site',  json_build_object('name', s.name, 'slug', s.slug, 'mode', s.mode, 'schema', s.field_schema,
                               'country', s.country, 'host', s.host),
    'build', json_build_object('id', b.id, 'version', b.version, 'status', b.status, 'theme', b.theme,
                               'content', b.content, 'updated_at', b.updated_at, 'submitted_at', b.submitted_at,
                               'return_note', case when b.status = 'returned' then b.return_note end));
end $$;

create or replace function public.ms_builder_save(p_key uuid, p_build bigint, p_content jsonb, p_theme jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare s ms_sites; b ms_builds;
begin
  select * into s from ms_sites where site_key = p_key;
  if not found then raise exception 'unknown_site'; end if;
  select * into b from ms_builds where id = p_build and site = s.slug for update;
  if not found then raise exception 'unknown_build'; end if;
  if b.status not in ('draft', 'returned') then raise exception 'locked'; end if;
  if pg_column_size(p_content) + pg_column_size(p_theme) > 600000 then raise exception 'too_big'; end if;
  update ms_builds set content = coalesce(p_content, content),
    theme = case when s.mode = 'builder' then coalesce(p_theme, theme) else theme end,
    updated_at = now() where id = p_build;
  return json_build_object('ok', true, 'at', now());
end $$;

create or replace function public.ms_builder_submit(p_key uuid, p_build bigint, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare s ms_sites; b ms_builds;
begin
  select * into s from ms_sites where site_key = p_key;
  if not found then raise exception 'unknown_site'; end if;
  select * into b from ms_builds where id = p_build and site = s.slug for update;
  if not found then raise exception 'unknown_build'; end if;
  if b.status not in ('draft', 'returned') then raise exception 'locked'; end if;
  update ms_builds set status = 'checking', submitted_at = now(), client_note = left(p_note, 2000),
    updated_at = now() where id = p_build;
  delete from ms_build_checks where build_id = p_build;
  insert into ms_activity(site, who, action) values (s.slug, 'client', 'Site sent for review (v' || b.version || ')');
  perform ms_builder_kick(p_build);
  return json_build_object('ok', true);
end $$;

revoke all on function public.ms_builder_get(uuid) from public;
revoke all on function public.ms_builder_save(uuid, bigint, jsonb, jsonb) from public;
revoke all on function public.ms_builder_submit(uuid, bigint, text) from public;
grant execute on function public.ms_builder_get(uuid) to anon, authenticated;
grant execute on function public.ms_builder_save(uuid, bigint, jsonb, jsonb) to anon, authenticated;
grant execute on function public.ms_builder_submit(uuid, bigint, text) to anon, authenticated;

-- ---------- 6) Yonetici tarafi ----------
create or replace function public.ms_build_recheck(p_build bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  update ms_builds set status = 'checking', updated_at = now() where id = p_build and status <> 'published';
  delete from ms_build_checks where build_id = p_build;
  perform ms_builder_kick(p_build);
end $$;

create or replace function public.ms_build_return(p_build bigint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare b ms_builds;
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  update ms_builds set status = 'returned', return_note = left(p_note, 2000), updated_at = now()
   where id = p_build and status in ('checking', 'review') returning * into b;
  if not found then raise exception 'wrong_status'; end if;
  insert into ms_activity(site, who, action) values (b.site, 'uzay', 'Site returned to client: ' || left(coalesce(p_note, ''), 80));
end $$;

-- Onay = yayin. Kirmizi kontrol varsa ancak gerekce yazilarak gecilir.
create or replace function public.ms_build_publish(p_build bigint, p_override_reason text default null, p_minutes int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare b ms_builds; fails int;
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  select * into b from ms_builds where id = p_build for update;
  if not found then raise exception 'not_found'; end if;
  if b.status not in ('review', 'checking', 'draft') then raise exception 'wrong_status'; end if;
  select count(*) into fails from ms_build_checks where build_id = p_build and level = 'fail';
  if fails > 0 and length(coalesce(p_override_reason, '')) < 5 then raise exception 'has_fail'; end if;
  update ms_builds set status = 'archived' where site = b.site and status = 'published';
  update ms_builds set status = 'published', published_at = now(), updated_at = now(),
    admin_note = case when fails > 0 then concat_ws(E'\n', admin_note, 'Override: ' || p_override_reason) else admin_note end
   where id = p_build;
  update ms_sites set published_build = p_build,
    status = case when status = 'building' then 'live' else status end where slug = b.site;
  insert into ms_activity(site, who, action, minutes) values (b.site, 'uzay',
    'Site published (v' || b.version || ')' || case when fails > 0 then ' with override' else '' end, greatest(0, coalesce(p_minutes, 0)));
end $$;

-- Yayindaki surumden yeni taslak ac (sonraki buyuk degisiklik icin)
create or replace function public.ms_build_new_version(p_site text) returns bigint
language plpgsql security definer set search_path = public as $$
declare src ms_builds; n int; new_id bigint;
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  select * into src from ms_builds where site = p_site order by (status = 'published') desc, version desc limit 1;
  select coalesce(max(version), 0) + 1 into n from ms_builds where site = p_site;
  insert into ms_builds(site, version, mode, theme, content)
  values (p_site, n, coalesce(src.mode, (select mode from ms_sites where slug = p_site)),
          coalesce(src.theme, '{}'::jsonb), coalesce(src.content, '{}'::jsonb))
  returning id into new_id;
  insert into ms_activity(site, who, action) values (p_site, 'uzay', 'New draft opened (v' || n || ')');
  return new_id;
end $$;

grant execute on function public.ms_build_recheck(bigint) to authenticated;
grant execute on function public.ms_build_return(bigint, text) to authenticated;
grant execute on function public.ms_build_publish(bigint, text, int) to authenticated;
grant execute on function public.ms_build_new_version(text) to authenticated;

-- ---------- 7) Yayin: herkese acik, sadece onayli surum ----------
create or replace function public.ms_public_site(p_slug text default null, p_host text default null)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', s.name, 'slug', s.slug, 'theme', b.theme, 'content', b.content,
    'state', ms_site_state(s.slug))
  from ms_sites s join ms_builds b on b.id = s.published_build
  where (p_slug is not null and s.slug = p_slug)
     or (p_host is not null and lower(s.host) = lower(regexp_replace(p_host, '^www\.', '')))
  limit 1;
$$;
revoke all on function public.ms_public_site(text, text) from public;
grant execute on function public.ms_public_site(text, text) to anon, authenticated;
