-- =====================================================================
-- MR. SPACE · GIRIS VE IZLEYICI ERISIMI (v1.1)
-- 1) mr.space girisini yonetici yapar
-- 2) Izleyici (sadece bakar, degistiremez) erisimi ekler
-- Supabase > SQL Editor > yapistir > Run. Tekrar calistirilabilir.
-- =====================================================================

-- Super admin girisi: panelde kullanici adi "mr.space" = mr.space@mrspace.online
insert into public.ms_admins(email) values ('mr.space@mrspace.online') on conflict do nothing;

-- Izleyiciler: sistemi gosterdigin kisiler (ornek: edwin -> edwin@mrspace.online)
create table if not exists public.ms_viewers (
  email      text primary key,
  name       text,
  until      date,                         -- bos = suresiz
  created_at timestamptz not null default now()
);
alter table public.ms_viewers enable row level security;
drop policy if exists ms_admin_all on public.ms_viewers;
create policy ms_admin_all on public.ms_viewers for all using (public.ms_is_admin()) with check (public.ms_is_admin());

create or replace function public.ms_role() returns text
language sql stable security definer set search_path = public as $$
  select case
    when ms_is_admin() then 'admin'
    when exists (select 1 from ms_viewers v where v.email = lower(coalesce(auth.jwt() ->> 'email', ''))
                 and (v.until is null or v.until >= current_date)) then 'viewer'
    else null end;
$$;

-- Izleyicinin gordugu her sey bu tek kapidan gelir: anahtarlar, iletisim ve paralar yok
create or replace function public.ms_viewer_snapshot() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if ms_role() is null then raise exception 'not_allowed'; end if;
  return json_build_object(
    'sites', coalesce((select json_agg(json_build_object('slug', slug, 'name', name, 'url', url, 'kind', kind, 'plan', plan,
                'status', status, 'small_quota', small_quota, 'big_quota', big_quota) order by created_at) from ms_sites), '[]'::json),
    'checks', coalesce((select json_agg(json_build_object('site', site, 'at', at, 'ok', ok, 'ms', ms) order by at)
                from ms_checks where at > now() - interval '24 hours'), '[]'::json),
    'changes', coalesce((select json_agg(json_build_object('id', id, 'site', site, 'kind', kind, 'target', target, 'request', request,
                'status', status, 'counts', counts, 'minutes', minutes, 'created_at', created_at) order by created_at desc)
                from (select * from ms_changes order by created_at desc limit 100) c), '[]'::json),
    'activity', coalesce((select json_agg(json_build_object('site', site, 'who', who, 'action', action, 'minutes', minutes, 'at', at, 'meta', meta) order by at desc)
                from (select * from ms_activity order by at desc limit 150) a), '[]'::json),
    'usage', coalesce((select json_agg(json_build_object('site', site, 'service', service, 'used', used, 'lim', lim, 'unit', unit, 'enabled', enabled)) from ms_usage), '[]'::json),
    'quota', coalesce((select json_object_agg(s.slug, (select row_to_json(q) from ms_quota(s.slug) q)) from ms_sites s), '{}'::json)
  );
end $$;
revoke all on function public.ms_viewer_snapshot() from public, anon;
grant execute on function public.ms_viewer_snapshot() to authenticated;
grant execute on function public.ms_role() to authenticated;
