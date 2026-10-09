-- Kalıcı işlemsel e-posta kuyruğu. Sistem, Square ve bildirim SQL'lerinden sonra.
-- Tekrar çalıştırılabilir. Varsayılan gönderim KAPALI. Eski kayıtları maillemez.
create table if not exists public.ms_mail_settings (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  domain_verified_at timestamptz,
  daily_limit integer not null default 50 check(daily_limit between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into public.ms_mail_settings(id) values(true) on conflict do nothing;
create table if not exists public.ms_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check(length(event_key) between 1 and 250),
  site text references public.ms_sites(slug),
  kind text not null check(kind in ('welcome','signin','site_ready','order','reply','request_link')),
  recipient text not null check(length(recipient)<=160 and recipient ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  lang text not null default 'en' check(lang in ('en','tr','es','de','fr')),
  payload jsonb not null default '{}' check(octet_length(payload::text)<=25000),
  status text not null default 'queued' check(status in ('queued','sending','accepted','delivered','bounced','complained','failed','cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease uuid,
  lease_until timestamptz,
  provider_body jsonb,
  provider_id text unique,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ms_mail_queue_idx on public.ms_mail_outbox(next_attempt_at) where status in ('queued','sending');
create table if not exists public.ms_mail_events (
  id text primary key, provider_id text not null, status text not null check(status in ('delivered','bounced','complained')), at timestamptz not null default now()
);
create index if not exists ms_mail_event_provider_idx on public.ms_mail_events(provider_id);
create table if not exists public.ms_mail_inbox (
  id uuid primary key, recipient text not null check(recipient in ('hello@mrspace.online','rufcut@mrspace.online')),
  sender text not null, reply_address text, message_id text, subject text not null, body text not null, truncated boolean not null default false,
  attachment_count integer not null default 0, received_at timestamptz not null default now()
);
alter table public.ms_mail_events enable row level security;
alter table public.ms_mail_inbox enable row level security;
drop policy if exists ms_admin_all on public.ms_mail_events;
create policy ms_admin_all on public.ms_mail_events for all using(public.ms_is_admin()) with check(public.ms_is_admin());
drop policy if exists ms_admin_all on public.ms_mail_inbox;
create policy ms_admin_all on public.ms_mail_inbox for all using(public.ms_is_admin()) with check(public.ms_is_admin());
revoke all on public.ms_mail_events, public.ms_mail_inbox from anon, authenticated;
grant all on public.ms_mail_events, public.ms_mail_inbox to service_role;
alter table public.ms_mail_settings enable row level security;
alter table public.ms_mail_outbox enable row level security;
drop policy if exists ms_admin_all on public.ms_mail_settings;
create policy ms_admin_all on public.ms_mail_settings for all using(public.ms_is_admin()) with check(public.ms_is_admin());
drop policy if exists ms_admin_all on public.ms_mail_outbox;
create policy ms_admin_all on public.ms_mail_outbox for all using(public.ms_is_admin()) with check(public.ms_is_admin());
-- Admin bile kuyruk gövdesini REST ile değiştiremez. Yazma yalnızca dar RPC'lerde.
revoke all on public.ms_mail_settings, public.ms_mail_outbox from anon, authenticated;
grant all on public.ms_mail_settings, public.ms_mail_outbox to service_role;

create or replace function public.ms_mail_enqueue(p_event text,p_site text,p_kind text,p_to text,p_lang text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if p_site='rufcut' then p_lang:='en'; end if;
  insert into public.ms_mail_outbox(event_key,site,kind,recipient,lang,payload)
  values(p_event,p_site,p_kind,lower(trim(p_to)),p_lang,p_payload)
  on conflict(event_key) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.ms_mail_outbox where event_key=p_event and site is not distinct from p_site and kind=p_kind
      and recipient=lower(trim(p_to)) and lang=p_lang and payload=p_payload;
    if v_id is null then raise exception 'event_conflict'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.ms_mail_claim()
returns setof public.ms_mail_outbox language plpgsql security definer set search_path='' as $$
declare cfg public.ms_mail_settings; used integer; v_id uuid;
begin
  select * into cfg from public.ms_mail_settings where id=true for update;
  if not cfg.enabled or cfg.domain_verified_at is null then return; end if;
  -- Resend idempotency anahtarı 24 saat yaşar. Belirsiz işleri 23 saatten sonra tekrar gönderme.
  update public.ms_mail_outbox set status='failed',error_code='retry_window_expired',updated_at=now()
    where status in ('queued','sending') and (lease_until is null or lease_until<now())
    and (attempts>=5 or first_attempt_at<now()-interval '23 hours');
  select count(*) into used from public.ms_mail_outbox where first_attempt_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  select id into v_id from public.ms_mail_outbox
    where status in ('queued','sending') and next_attempt_at<=now() and (lease_until is null or lease_until<now())
    and (first_attempt_at is not null or used<cfg.daily_limit)
    order by next_attempt_at,created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.ms_mail_outbox set status='sending',attempts=attempts+1,
    first_attempt_at=coalesce(first_attempt_at,now()),lease=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
    where id=v_id returning *;
end $$;

create or replace function public.ms_mail_prepare(p_id uuid,p_lease uuid,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_body jsonb;
begin
  if octet_length(p_body::text)>60000 then raise exception 'body_too_large'; end if;
  update public.ms_mail_outbox set provider_body=coalesce(provider_body,p_body)
    where id=p_id and lease=p_lease and lease_until>now() and status='sending' returning provider_body into v_body;
  if v_body is null then raise exception 'lease_lost'; end if;
  return v_body;
end $$;

create or replace function public.ms_mail_finish(p_id uuid,p_lease uuid,p_provider text,p_error text,p_retry boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.ms_mail_outbox set status=case when p_provider is not null then coalesce((select e.status from public.ms_mail_events e where e.provider_id=p_provider order by case e.status when 'complained' then 3 when 'bounced' then 2 else 1 end desc limit 1),'accepted')
      when p_retry and attempts<5 and first_attempt_at>now()-interval '23 hours' then 'queued' else 'failed' end,
    provider_id=p_provider,error_code=left(p_error,80),lease=null,lease_until=null,
    next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),updated_at=now()
    where id=p_id and lease=p_lease and status='sending';
  return found;
end $$;

create or replace function public.ms_mail_status()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object('settings',(select to_jsonb(s) from public.ms_mail_settings s where id=true),
    'sites',(select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,'contact',s.contact,'members',
      (select coalesce(jsonb_agg(u.email),'[]'::jsonb) from public.ms_site_users u where u.site=s.slug)) order by s.name),'[]'::jsonb) from public.ms_sites s),
    'messages',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select id,site,kind,recipient,lang,status,attempts,error_code,created_at,updated_at from public.ms_mail_outbox order by created_at desc limit 100) q),
    'inbox',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select id,recipient,sender,subject,truncated,attachment_count,received_at from public.ms_mail_inbox order by received_at desc limit 50) q));
end $$;

create or replace function public.ms_mail_event(p_id text,p_provider text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.ms_mail_events(id,provider_id,status) values(p_id,p_provider,p_status) on conflict(id) do nothing;
  update public.ms_mail_outbox set status=p_status,updated_at=now()
    where provider_id=p_provider and status in ('accepted','delivered','bounced','complained')
    and case p_status when 'complained' then 3 when 'bounced' then 2 else 1 end > case status when 'complained' then 3 when 'bounced' then 2 when 'delivered' then 1 else 0 end;
end $$;
revoke all on function public.ms_mail_event(text,text,text) from public,anon,authenticated;
grant execute on function public.ms_mail_event(text,text,text) to service_role;

create or replace function public.ms_mail_inbox_read(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  return(select to_jsonb(i) from public.ms_mail_inbox i where id=p_id);
end $$;
revoke all on function public.ms_mail_inbox_read(uuid) from public,anon;
grant execute on function public.ms_mail_inbox_read(uuid) to authenticated;

create or replace function public.ms_mail_toggle(p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  if p_enabled and not exists(select 1 from public.ms_mail_settings where domain_verified_at is not null) then raise exception 'domain_not_verified'; end if;
  update public.ms_mail_settings set enabled=p_enabled,updated_at=now() where id=true;
end $$;

create or replace function public.ms_mail_cancel(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.ms_is_admin() then raise exception 'not_admin'; end if;
  update public.ms_mail_outbox set status='cancelled',updated_at=now() where id=p_id and status='queued' and attempts=0;
  if not found then raise exception 'not_cancellable'; end if;
end $$;

-- Yalnızca gerçek, yeni bir oturum için. Yenileme/reload ikinci e-posta üretmez.
create or replace function public.ms_mail_login()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_session uuid; v_email text; v_site text; v_created timestamptz;
begin
  v_session:=(auth.jwt()->>'session_id')::uuid;
  if auth.uid() is null or v_session is null then raise exception 'not_authenticated'; end if;
  select created_at into v_created from auth.sessions where id=v_session and user_id=auth.uid() and created_at>now()-interval '10 minutes';
  if not found then return null; end if;
  select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then return null; end if;
  if not public.ms_is_admin() then
    if public.ms_role()='viewer' then return null; end if;
    select site into v_site from public.ms_site_users where email=v_email order by site limit 1;
    if v_site is null then return null; end if;
  end if;
  -- @mrspace.online kullanıcı adları gerçek müşteri posta kutusu değildir.
  if v_email like '%@mrspace.online' then return null; end if;
  return public.ms_mail_enqueue('signin/'||v_session,v_site,'signin',v_email,'en',jsonb_build_object('at',v_created));
end $$;

create or replace function public.ms_mail_welcome()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_name text;
begin
  select name,case when new.email like '%@mrspace.online' then contact else new.email end into v_name,v_email from public.ms_sites where slug=new.site;
  if v_email is not null and v_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and v_email not like '%@mrspace.online' then
    perform public.ms_mail_enqueue('welcome/'||md5(new.site||'/'||lower(new.email)||'/'||new.created_at::text),new.site,'welcome',v_email,'en',jsonb_build_object('name',v_name));
  end if;
  return new;
end $$;
-- Tekrar kurulum üyelik kayıtlarına veya eski müşterilere dokunmaz.
do $$begin if not exists(select 1 from pg_trigger where tgname='ms_mail_welcome_trigger' and tgrelid='public.ms_site_users'::regclass) then
  create trigger ms_mail_welcome_trigger after insert on public.ms_site_users for each row execute function public.ms_mail_welcome();
end if; end $$;

-- Her RPC'nin rolü açık. Sır/kuyruk fonksiyonları tarayıcıdan çağrılamaz.
revoke all on function public.ms_mail_enqueue(text,text,text,text,text,jsonb),public.ms_mail_claim(),public.ms_mail_prepare(uuid,uuid,jsonb),public.ms_mail_finish(uuid,uuid,text,text,boolean),public.ms_mail_welcome() from public,anon,authenticated;
grant execute on function public.ms_mail_enqueue(text,text,text,text,text,jsonb),public.ms_mail_claim(),public.ms_mail_prepare(uuid,uuid,jsonb),public.ms_mail_finish(uuid,uuid,text,text,boolean) to service_role;
revoke all on function public.ms_mail_status(),public.ms_mail_toggle(boolean),public.ms_mail_cancel(uuid),public.ms_mail_login() from public,anon;
grant execute on function public.ms_mail_status(),public.ms_mail_toggle(boolean),public.ms_mail_cancel(uuid),public.ms_mail_login() to authenticated;

create or replace function public.ms_mail_secrets()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  return jsonb_build_object('key',(select decrypted_secret from vault.decrypted_secrets where name='resend_key' limit 1),
    'webhook',(select decrypted_secret from vault.decrypted_secrets where name='resend_webhook_secret' limit 1),
    'cron',(select value from public.ms_settings where key='cron_secret'));
end $$;
revoke all on function public.ms_mail_secrets() from public,anon,authenticated;
grant execute on function public.ms_mail_secrets() to service_role;

-- İş emriyle aynı işlemde kaydet: Function sonradan kesilse de mesaj kaybolmaz.
create or replace function public.ms_mail_order_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare event text; payload jsonb; pref record;
begin
  if new.site<>'rufcut' then return new; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  event:=case when tg_op='INSERT' then 'created' else 'status' end;
  payload:=jsonb_build_object('event',event,'ticket',new.ticket,'status',new.status,'customer_name',new.customer_name,
    'summary',left(case when new.kind='jeans' then new.design::text else
      (select coalesce(jsonb_agg(jsonb_build_object('garment',it->>'garment','actions',it->'actions','inches',it->>'inches','note',it->>'note')),'[]'::jsonb)::text from jsonb_array_elements(new.items) it) end,18000));
  perform public.ms_mail_enqueue('order/'||new.id||'/'||event||case when event='status' then '/'||new.updated_at::text else '' end||'/customer',
    new.site,'order',new.customer_email,'en',payload);
  if event='created' then
    for pref in select distinct on(lower(p.delivery_email)) p.* from public.ms_notification_preferences p where p.site=new.site and p.email_enabled
      and (exists(select 1 from public.ms_admins a where a.email=p.owner_email) or
        (exists(select 1 from public.ms_site_users u where u.email=p.owner_email and u.site=p.site)
         and not exists(select 1 from public.ms_viewers v where v.email=p.owner_email and (v.until is null or v.until>=current_date)))) order by lower(p.delivery_email),p.owner_email loop
      perform public.ms_mail_enqueue('order/'||new.id||'/staff/'||md5(lower(pref.delivery_email)),new.site,'order',pref.delivery_email,pref.lang,
        payload||jsonb_build_object('event','staff','owner_email',pref.owner_email,'customer_email',new.customer_email,'customer_phone',new.customer_phone));
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.ms_mail_order_event() from public,anon,authenticated;
do $$begin
  if not exists(select 1 from pg_trigger where tgname='ms_mail_order_created' and tgrelid='public.ms_repair_jobs'::regclass) then
    create trigger ms_mail_order_created after insert on public.ms_repair_jobs for each row execute function public.ms_mail_order_event();
  end if;
  if not exists(select 1 from pg_trigger where tgname='ms_mail_order_status' and tgrelid='public.ms_repair_jobs'::regclass) then
    create trigger ms_mail_order_status after update of status on public.ms_repair_jobs for each row execute function public.ms_mail_order_event();
  end if;
end $$;

create or replace function public.ms_mail_transport_ready()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ms_mail_settings where enabled and domain_verified_at is not null)
$$;
revoke all on function public.ms_mail_transport_ready() from public,anon,authenticated;
grant execute on function public.ms_mail_transport_ready() to service_role;

create or replace function public.ms_mail_staff_allowed(p_owner text,p_site text,p_to text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ms_notification_preferences p where p.site=p_site and p.owner_email=p_owner and lower(p.delivery_email)=lower(p_to) and p.email_enabled)
 and (exists(select 1 from public.ms_admins a where a.email=p_owner) or
   (exists(select 1 from public.ms_site_users u where u.email=p_owner and u.site=p_site)
   and not exists(select 1 from public.ms_viewers v where v.email=p_owner and (v.until is null or v.until>=current_date))))
$$;
revoke all on function public.ms_mail_staff_allowed(text,text,text) from public,anon,authenticated;
grant execute on function public.ms_mail_staff_allowed(text,text,text) to service_role;

-- Eski doğrudan net.http_post gönderimini aynı kalıcı kuyrukla değiştirir.
create or replace function public.ms_mail_link(p_sub bigint,p_revised boolean)
returns void language plpgsql security definer set search_path='' as $$
declare sub record; n integer; payload jsonb;
begin
  select x.*,s.name as site_name into sub from public.ms_submissions x join public.ms_sites s on s.slug=x.site where x.id=p_sub;
  if not found or sub.email is null or length(sub.email)>160 or sub.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return; end if;
  select count(*) into n from public.ms_changes where submission_id=p_sub and status<>'withdrawn';
  payload:=jsonb_build_object('name',sub.site_name,'edit_key',sub.edit_key,'version',sub.version,'count',n,'revised',p_revised);
  perform public.ms_mail_enqueue('request-link/'||sub.id||'/v'||sub.version||'/customer',sub.site,'request_link',sub.email,'en',payload);
  perform public.ms_mail_enqueue('request-link/'||sub.id||'/v'||sub.version||'/admin',sub.site,'request_link','hello@mrspace.online','en',payload);
end $$;
revoke all on function public.ms_mail_link(bigint,boolean) from public,anon,authenticated;
