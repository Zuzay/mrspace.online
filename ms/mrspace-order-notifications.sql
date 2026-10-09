-- Shared, private notification subscriptions and Rufcut work orders. Rerunnable.
alter table public.ms_repair_jobs add column if not exists kind text not null default 'repair' check (kind in ('repair','jeans'));
alter table public.ms_repair_jobs add column if not exists design jsonb not null default '{}'::jsonb;
alter table public.ms_repair_jobs add column if not exists submission_token uuid;
alter table public.ms_repair_jobs add column if not exists request_fingerprint text;
alter table public.ms_repair_jobs add column if not exists sender_hash text;
create unique index if not exists ms_work_orders_submission on public.ms_repair_jobs(site,submission_token) where submission_token is not null;

create table if not exists public.ms_notification_preferences (
 site text not null references public.ms_sites(slug), owner_email text not null,
 delivery_email text not null, email_enabled boolean not null default true,
 lang text not null default 'en' check (lang in ('en','tr','es','de','fr')),
 updated_at timestamptz not null default now(), primary key(site,owner_email)
);
create table if not exists public.ms_push_subscriptions (
 site text not null references public.ms_sites(slug), owner_email text not null,
 endpoint text not null check (length(endpoint)<=2048), p256dh text not null, auth text not null,
 lang text not null default 'en' check (lang in ('en','tr','es','de','fr')),
 enabled boolean not null default true, updated_at timestamptz not null default now(),
 primary key(site,endpoint)
);
create index if not exists ms_push_owner on public.ms_push_subscriptions(owner_email,site);
alter table public.ms_notification_preferences enable row level security;
alter table public.ms_push_subscriptions enable row level security;
revoke all on public.ms_notification_preferences,public.ms_push_subscriptions from public,anon,authenticated;
grant all on public.ms_notification_preferences,public.ms_push_subscriptions to service_role;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='ms_notification_preferences' and policyname='ms_admin_all') then
  create policy ms_admin_all on public.ms_notification_preferences for all to authenticated using(public.ms_is_admin()) with check(public.ms_is_admin());
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='ms_push_subscriptions' and policyname='ms_admin_all') then
  create policy ms_admin_all on public.ms_push_subscriptions for all to authenticated using(public.ms_is_admin()) with check(public.ms_is_admin());
 end if;
end $$;

-- Only the server role can create/read private signing material. Vault encrypts it at rest.
create or replace function public.ms_notification_secrets(p_vapid jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_key text; v_resend text; v_from text;
begin
 perform pg_advisory_xact_lock(hashtext('ms_webpush_vapid'));
 select decrypted_secret into v_key from vault.decrypted_secrets where name='ms_webpush_vapid' limit 1;
 if v_key is null and p_vapid is not null then
  if jsonb_typeof(p_vapid->'privateJwk')<>'object' or length(p_vapid->>'publicKey')<>87 then raise exception 'invalid_key'; end if;
  perform vault.create_secret(p_vapid::text,'ms_webpush_vapid','Shared Mr. Space Web Push signing key');
  v_key:=p_vapid::text;
 end if;
 select decrypted_secret into v_resend from vault.decrypted_secrets where name='resend_key' limit 1;
 select decrypted_secret into v_from from vault.decrypted_secrets where name='resend_from' limit 1;
 return jsonb_build_object('vapid',v_key::jsonb,'resend_key',v_resend,'resend_from',v_from);
end $$;
revoke all on function public.ms_notification_secrets(jsonb) from public,anon,authenticated;
grant execute on function public.ms_notification_secrets(jsonb) to service_role;

-- Insert + duplicate detection + limits share one transaction. No client role can call this.
create or replace function public.ms_create_work_order(p_order jsonb,p_token uuid,p_sender_hash text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing public.ms_repair_jobs; v_ticket text;
begin
 if p_token is null or length(p_sender_hash)<>64 or length(p_fingerprint)<>64 or p_order->>'site'<>'rufcut' then raise exception 'invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtext(p_token::text));
 select * into v_existing from public.ms_repair_jobs where site='rufcut' and submission_token=p_token;
 if found then
  if v_existing.request_fingerprint<>p_fingerprint then return jsonb_build_object('error','token_conflict'); end if;
  return jsonb_build_object('ticket',v_existing.ticket,'duplicate',true);
 end if;
 perform pg_advisory_xact_lock(hashtext('sender:'||p_sender_hash));
 perform pg_advisory_xact_lock(hashtext('email:'||(p_order->>'customer_email')));
 if (select count(*) from public.ms_repair_jobs where created_at>now()-interval '1 hour' and sender_hash=p_sender_hash)>=20
 or (select count(*) from public.ms_repair_jobs where created_at>now()-interval '1 hour' and customer_email=p_order->>'customer_email')>=8 then
  return jsonb_build_object('error','rate_limited');
 end if;
 v_ticket:=p_order->>'ticket';
 insert into public.ms_repair_jobs(ticket,site,kind,customer_name,customer_email,customer_phone,items,preview_svg,design,submission_token,sender_hash,request_fingerprint)
 values(v_ticket,'rufcut',p_order->>'kind',p_order->>'customer_name',p_order->>'customer_email',p_order->>'customer_phone',p_order->'items',p_order->>'preview_svg',coalesce(p_order->'design','{}'::jsonb),p_token,p_sender_hash,p_fingerprint);
 return jsonb_build_object('ticket',v_ticket,'duplicate',false);
end $$;
revoke all on function public.ms_create_work_order(jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ms_create_work_order(jsonb,uuid,text,text) to service_role;
