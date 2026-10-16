-- Customer content publication; private daily backups. America/Los_Angeles defines a change day.
create table if not exists public.ms_site_content (
 site text primary key references public.ms_sites(slug), enabled boolean not null default false,
 revision bigint not null default 0, fields jsonb not null default '{}'::jsonb,
 last_request uuid, updated_at timestamptz not null default now()
);
create table if not exists public.ms_site_content_backups (
 site text not null references public.ms_sites(slug), change_day date not null,
 revision bigint not null, fields jsonb not null, object_path text not null unique,
 created_at timestamptz not null default now(), primary key(site,change_day)
);
create table if not exists public.ms_site_content_gc (
 object_path text primary key, created_at timestamptz not null default now()
);
alter table public.ms_site_content enable row level security;
alter table public.ms_site_content_backups enable row level security;
alter table public.ms_site_content_gc enable row level security;
revoke all on public.ms_site_content,public.ms_site_content_backups,public.ms_site_content_gc from anon,authenticated;
grant all on public.ms_site_content,public.ms_site_content_backups,public.ms_site_content_gc to service_role;
do $$ begin
 if not exists(select 1 from pg_policies where tablename='ms_site_content' and policyname='ms_admin_all') then create policy ms_admin_all on public.ms_site_content for all to authenticated using(public.ms_is_admin()) with check(public.ms_is_admin()); end if;
 if not exists(select 1 from pg_policies where tablename='ms_site_content_backups' and policyname='ms_admin_all') then create policy ms_admin_all on public.ms_site_content_backups for all to authenticated using(public.ms_is_admin()) with check(public.ms_is_admin()); end if;
 if not exists(select 1 from pg_policies where tablename='ms_site_content_gc' and policyname='ms_admin_all') then create policy ms_admin_all on public.ms_site_content_gc for all to authenticated using(public.ms_is_admin()) with check(public.ms_is_admin()); end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ms-site-backups','ms-site-backups',false,50000000,array['application/json']) on conflict(id) do nothing;
-- No customer storage policies: only the server can create/read/delete archives.
insert into public.ms_site_content(site) select slug from public.ms_sites where slug='rufcut' on conflict do nothing;
create or replace function public.ms_content_status(p_site text)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('revision',c.revision,'fields',c.fields,'enabled',c.enabled,
  'day',(now() at time zone 'America/Los_Angeles')::date,
  'backup_needed',not exists(select 1 from ms_site_content_backups b where b.site=c.site and b.change_day=(now() at time zone 'America/Los_Angeles')::date))
 from ms_site_content c where c.site=p_site;
$$;
create or replace function public.ms_content_publish(p_site text,p_revision bigint,p_request uuid,p_changes jsonb,p_backup text,p_day date,p_who text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c ms_site_content; d date:=(now() at time zone 'America/Los_Angeles')::date; old record;
begin
 select * into c from ms_site_content where site=p_site for update;
 if not found or not c.enabled then raise exception 'disabled'; end if;
 if c.last_request=p_request then return jsonb_build_object('ok',true,'revision',c.revision,'replayed',true); end if;
 if c.revision<>p_revision then raise exception 'conflict'; end if;
 if p_day<>d then raise exception 'day_changed'; end if;
 if jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb or pg_column_size(p_changes)>300000 then raise exception 'invalid_changes'; end if;
 if not exists(select 1 from ms_site_content_backups where site=p_site and change_day=d) then
  if p_backup is null or p_backup not like p_site||'/%' or not exists(select 1 from storage.objects where bucket_id='ms-site-backups' and name=p_backup) then raise exception 'backup_required'; end if;
  insert into ms_site_content_backups(site,change_day,revision,fields,object_path) values(p_site,d,c.revision,c.fields,p_backup);
 else
  if p_backup is not null then insert into ms_site_content_gc(object_path) values(p_backup) on conflict do nothing; end if;
 end if;
 update ms_site_content set fields=c.fields||p_changes,revision=c.revision+1,last_request=p_request,updated_at=now() where site=p_site;
 for old in select change_day,object_path from ms_site_content_backups where site=p_site order by change_day desc offset 5 loop
  insert into ms_site_content_gc(object_path) values(old.object_path) on conflict do nothing;
  delete from ms_site_content_backups where site=p_site and change_day=old.change_day;
 end loop;
 insert into ms_activity(site,who,action) values(p_site,p_who,'Customer published website content (v'||(c.revision+1)||')');
 return jsonb_build_object('ok',true,'revision',c.revision+1);
end $$;
revoke all on function public.ms_content_status(text) from public,anon,authenticated;
revoke all on function public.ms_content_publish(text,bigint,uuid,jsonb,text,date,text) from public,anon,authenticated;
grant execute on function public.ms_content_status(text),public.ms_content_publish(text,bigint,uuid,jsonb,text,date,text) to service_role;
-- Timed-out requests may leave an unreferenced upload. Reconcile only after 24h.
create or replace function public.ms_content_gc_paths()
returns table(object_path text) language sql stable security definer set search_path=public as $$
 select paths.name from (
  select g.object_path as name from ms_site_content_gc g
  union
  select o.name from storage.objects o where o.bucket_id='ms-site-backups' and o.name like 'rufcut/%' and o.created_at<now()-interval '24 hours'
 ) paths where not exists(select 1 from ms_site_content_backups b where b.object_path=paths.name) limit 30;
$$;
revoke all on function public.ms_content_gc_paths() from public,anon,authenticated;
grant execute on function public.ms_content_gc_paths() to service_role;
