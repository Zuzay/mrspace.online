-- =====================================================================
-- MR. SPACE · TALEPLER v2 (Ekim 2026)
-- Musteri talebini kendi sitesinin uzerinde yapar, sonra mailindeki linkle
-- veya bitis ekranindan geri donup revize eder. Her gonderim bir surum olarak
-- saklanir (v1, v2, ...), yonetici ilk hali ile son hali yan yana gorur ve
-- isterse eski surume geri doner.
-- mrspace-system.sql'den SONRA calistirilir. Tekrar calistirilabilir.
-- =====================================================================

-- ---------- 1) Gonderim (bir oturumda yapilan degisikliklerin paketi) ----------
create table if not exists public.ms_submissions (
  id         bigserial primary key,
  site       text not null references public.ms_sites(slug) on delete cascade,
  edit_key   uuid not null default gen_random_uuid() unique,  -- musterinin "geri don, duzelt" linki
  name       text,
  email      text,
  version    int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Her surumun tam fotografi (ilk hal, ikinci hal, ...)
create table if not exists public.ms_submission_versions (
  submission_id bigint not null references public.ms_submissions(id) on delete cascade,
  version       int not null,
  at            timestamptz not null default now(),
  items         jsonb not null,
  primary key (submission_id, version)
);

alter table public.ms_changes add column if not exists submission_id bigint references public.ms_submissions(id) on delete set null;
alter table public.ms_changes add column if not exists anchor   text;  -- sayfa::css yolu, sitede hangi parca
alter table public.ms_changes add column if not exists original text;  -- o parcada o an yazan
create index if not exists ms_changes_sub_idx on public.ms_changes(submission_id);
-- yeni durum: withdrawn (musteri revizede kaldirdi). ms_decide_change bunlara dokunmaz.

do $$ declare t text; begin
  foreach t in array array['ms_submissions','ms_submission_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ms_admin_all on public.%I', t);
    execute format('create policy ms_admin_all on public.%I for all using (public.ms_is_admin()) with check (public.ms_is_admin())', t);
  end loop;
end $$;

-- ---------- 2) Yardimcilar ----------
create or replace function public.ms_items(p_sub bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'target', target, 'anchor', anchor,
           'original', original, 'request', request, 'status', status) order by id), '[]'::jsonb)
  from ms_changes where submission_id = p_sub and status <> 'withdrawn';
$$;

-- Mail: Resend uzerinden. Anahtar yoksa sessizce gecer (sistem yine calisir).
-- Kurulum: select vault.create_secret('re_XXXX', 'resend_key');
create or replace function public.ms_mail_link(p_sub bigint, p_revised boolean)
returns void language plpgsql security definer set search_path = public, net as $$
declare s record; k text; n int; hi text; msg text;
begin
  select x.*, st.name as site_name into s from ms_submissions x join ms_sites st on st.slug = x.site where x.id = p_sub;
  if s.email is null then return; end if;
  begin
    select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_key' limit 1;
  exception when others then k := null; end;
  if k is null then return; end if;
  select count(*) into n from ms_changes where submission_id = p_sub and status <> 'withdrawn';
  hi := coalesce(' ' || replace(replace(split_part(s.name, ' ', 1), '<', ''), '>', ''), '');
  msg := case when p_revised
    then 'Your update is saved. ' || n || case when n = 1 then ' change' else ' changes' end || ', version ' || s.version || '.'
    else 'We received ' || n || case when n = 1 then ' change' else ' changes' end || ' for your site. We will review them and get back to you.' end;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Mr. Space <hello@mrspace.online>',
      'to', jsonb_build_array(s.email),
      'bcc', jsonb_build_array('hello@mrspace.online'),
      'subject', s.site_name || case when p_revised then ': your changes are updated' else ': we got your changes' end,
      'html', format(
        '<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#16181d;max-width:520px">'
        '<p>Hi%s,</p><p>%s</p>'
        '<p><a href="https://mrspace.online/request/?e=%s" style="display:inline-block;background:#16181d;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">Open my changes</a></p>'
        '<p style="color:#5d636e;font-size:14px">This link is just for you. Use it any time to add, change or remove something before we get to it.</p>'
        '<p>Mr. Space</p></div>', hi, msg, s.edit_key)));
end $$;

-- ---------- 3) Musteri: gonder ----------
create or replace function public.ms_submit(p_key uuid, p_items jsonb, p_name text default null, p_email text default null)
returns json language plpgsql security definer set search_path = public as $$
declare s ms_sites; sub ms_submissions; it jsonb; n int;
begin
  select * into s from ms_sites where site_key = p_key;
  if not found then raise exception 'unknown_site'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty'; end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'too_many'; end if;
  select count(*) into n from ms_submissions where site = s.slug and created_at > now() - interval '1 hour';
  if n >= 5 then raise exception 'too_many'; end if;
  insert into ms_submissions(site, name, email)
    values (s.slug, nullif(left(trim(p_name), 80), ''), lower(nullif(left(trim(p_email), 160), '')))
    returning * into sub;
  for it in select * from jsonb_array_elements(p_items) loop
    if length(coalesce(it->>'request', '')) = 0 then continue; end if;
    insert into ms_changes(site, kind, target, request, requested_by, submission_id, anchor, original)
    values (s.slug, case when it->>'kind' = 'big' then 'big' else 'small' end,
            left(coalesce(it->>'target', ''), 60), left(it->>'request', 2000), sub.name, sub.id,
            left(it->>'anchor', 400), left(it->>'original', 2000));
  end loop;
  insert into ms_submission_versions(submission_id, version, items) values (sub.id, 1, ms_items(sub.id));
  insert into ms_activity(site, who, action)
    values (s.slug, 'client', 'New request: ' || jsonb_array_length(ms_items(sub.id)) || ' changes on the site');
  perform ms_mail_link(sub.id, false);
  return json_build_object('ok', true, 'edit_key', sub.edit_key);
end $$;

-- ---------- 4) Musteri: geri donup bak ----------
create or replace function public.ms_get_submission(p_edit uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', x.name, 'email', x.email, 'version', x.version, 'at', x.created_at,
    'site', s.name, 'url', s.url,
    'quota', (select row_to_json(q) from ms_quota(s.slug) q),
    'items', ms_items(x.id))
  from ms_submissions x join ms_sites s on s.slug = x.site where x.edit_key = p_edit;
$$;

-- ---------- 5) Musteri: revize et (yeni surum) ----------
-- Sadece "new" durumundakiler degisir. Onaylanmis/bitmis olanlar kilitli.
create or replace function public.ms_revise(p_edit uuid, p_items jsonb, p_name text default null, p_email text default null)
returns json language plpgsql security definer set search_path = public as $$
declare sub ms_submissions; it jsonb; before_items jsonb; after_items jsonb; keep bigint[];
begin
  select * into sub from ms_submissions where edit_key = p_edit for update;
  if not found then raise exception 'unknown'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then raise exception 'bad_items'; end if;
  if sub.version >= 50 then raise exception 'too_many'; end if;
  before_items := ms_items(sub.id);

  select coalesce(array_agg((e->>'id')::bigint), '{}') into keep
    from jsonb_array_elements(p_items) e where (e->>'id') ~ '^\d+$';
  update ms_changes set status = 'withdrawn', decided_at = now(), counts = false
   where submission_id = sub.id and status = 'new' and not (id = any(keep));

  for it in select * from jsonb_array_elements(p_items) loop
    if length(coalesce(it->>'request', '')) = 0 then continue; end if;
    if (it->>'id') ~ '^\d+$' then
      update ms_changes set request = left(it->>'request', 2000),
             kind = case when it->>'kind' = 'big' then 'big' else 'small' end,
             target = left(coalesce(it->>'target', ''), 60)
       where id = (it->>'id')::bigint and submission_id = sub.id and status = 'new';
    else
      insert into ms_changes(site, kind, target, request, requested_by, submission_id, anchor, original)
      values (sub.site, case when it->>'kind' = 'big' then 'big' else 'small' end,
              left(coalesce(it->>'target', ''), 60), left(it->>'request', 2000), sub.name, sub.id,
              left(it->>'anchor', 400), left(it->>'original', 2000));
    end if;
  end loop;

  update ms_submissions set
    name  = coalesce(nullif(left(trim(p_name), 80), ''), name),
    email = coalesce(lower(nullif(left(trim(p_email), 160), '')), email)
  where id = sub.id;

  after_items := ms_items(sub.id);
  if after_items = before_items then
    return json_build_object('ok', true, 'version', sub.version, 'changed', false);
  end if;
  update ms_submissions set version = version + 1, updated_at = now() where id = sub.id returning * into sub;
  insert into ms_submission_versions(submission_id, version, items) values (sub.id, sub.version, after_items);
  insert into ms_activity(site, who, action)
    values (sub.site, 'client', 'Client revised request (v' || sub.version || ', ' || jsonb_array_length(after_items) || ' changes)');
  perform ms_mail_link(sub.id, true);
  return json_build_object('ok', true, 'version', sub.version, 'changed', true);
end $$;

-- ---------- 6) Yonetici: eski surume don ----------
-- select ms_restore_version(<gonderim id>, 1);  -> ilk hale doner, bu da yeni surum olarak kaydedilir
create or replace function public.ms_restore_version(p_sub bigint, p_version int)
returns void language plpgsql security definer set search_path = public as $$
declare v jsonb; it jsonb; ids bigint[]; sub ms_submissions;
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  select items into v from ms_submission_versions where submission_id = p_sub and version = p_version;
  if not found then raise exception 'not_found'; end if;
  select coalesce(array_agg((e->>'id')::bigint), '{}') into ids from jsonb_array_elements(v) e;
  for it in select * from jsonb_array_elements(v) loop
    update ms_changes set request = it->>'request', kind = it->>'kind', target = it->>'target',
           status = 'new', decided_at = null, counts = null
     where id = (it->>'id')::bigint and submission_id = p_sub and status in ('new', 'withdrawn');
  end loop;
  update ms_changes set status = 'withdrawn', decided_at = now(), counts = false
   where submission_id = p_sub and status = 'new' and not (id = any(ids));
  update ms_submissions set version = version + 1, updated_at = now() where id = p_sub returning * into sub;
  insert into ms_submission_versions(submission_id, version, items) values (sub.id, sub.version, ms_items(sub.id));
  insert into ms_activity(site, who, action)
    values (sub.site, 'uzay', 'Restored client request to version ' || p_version || ' (now v' || sub.version || ')');
end $$;

-- ---------- 7) Yonetici: ilk hal ile son hal yan yana ----------
-- select * from ms_submission_compare where site = 'rufcut';
create or replace view public.ms_submission_compare with (security_invoker = true) as
select s.id as submission, s.site, s.name, s.version as latest_version,
       coalesce(p.l->>'target', p.f->>'target') as target,
       coalesce(p.l->>'original', p.f->>'original') as on_site,
       p.f->>'request' as first_version,
       p.l->>'request' as latest,
       case when p.l is null then 'removed'
            when p.f is null then 'added'
            when p.f->>'request' = p.l->>'request' then 'same'
            else 'edited' end as state,
       coalesce(p.l->>'status', p.f->>'status') as status
from public.ms_submissions s
join public.ms_submission_versions v1 on v1.submission_id = s.id and v1.version = 1
join public.ms_submission_versions vl on vl.submission_id = s.id and vl.version = s.version
cross join lateral (
  select x.e as f, y.e as l
  from jsonb_array_elements(v1.items) x(e)
  full join jsonb_array_elements(vl.items) y(e) on x.e->>'id' = y.e->>'id'
) p;

-- ---------- 8) Musteri sayfasi icin: site adresi de donsun ----------
create or replace function public.ms_client_view(p_key uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', s.name, 'plan', s.plan, 'url', s.url,
    'quota', (select row_to_json(q) from ms_quota(s.slug) q),
    'requests', coalesce((select json_agg(json_build_object('kind', c.kind, 'target', c.target, 'request', c.request,
                 'status', c.status, 'counts', c.counts, 'at', c.created_at) order by c.created_at desc)
                 from (select * from ms_changes where site = s.slug and status <> 'withdrawn' order by created_at desc limit 20) c), '[]'::json))
  from ms_sites s where s.site_key = p_key;
$$;

-- ---------- 9) Kapilar ----------
revoke all on function public.ms_submit(uuid, jsonb, text, text) from public;
revoke all on function public.ms_get_submission(uuid) from public;
revoke all on function public.ms_revise(uuid, jsonb, text, text) from public;
revoke all on function public.ms_items(bigint) from public, anon, authenticated;
revoke all on function public.ms_mail_link(bigint, boolean) from public, anon, authenticated;
revoke all on function public.ms_restore_version(bigint, int) from public, anon;
grant execute on function public.ms_submit(uuid, jsonb, text, text) to anon, authenticated;
grant execute on function public.ms_get_submission(uuid) to anon, authenticated;
grant execute on function public.ms_revise(uuid, jsonb, text, text) to anon, authenticated;
grant execute on function public.ms_restore_version(bigint, int) to authenticated;
