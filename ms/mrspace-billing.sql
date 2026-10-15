-- Schema only. Customer terms and payment verification are entered privately.
create table if not exists public.ms_billing (
 site text primary key references public.ms_sites(slug) on delete cascade,
 currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
 terms jsonb not null check (jsonb_typeof(terms) = 'object'),
 setup_verified_at timestamptz,
 setup_verified_by text,
 early_start_chosen boolean not null default false,
 updated_at timestamptz not null default now(),
 constraint ms_billing_verification_pair check ((setup_verified_at is null) = (setup_verified_by is null))
);
alter table public.ms_billing enable row level security;
revoke all on public.ms_billing from public, anon, authenticated;
grant select, insert, update on public.ms_billing to service_role;
do $$ begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='ms_billing' and policyname='ms_admin_all') then
  create policy ms_admin_all on public.ms_billing for all to authenticated using(public.ms_is_admin()) with check(public.ms_is_admin());
 end if;
end $$;
-- Exact totals, no client-row limit or invented time. Only the authenticated Edge handler can call it.
create or replace function public.ms_billing_work_summary(p_site text)
returns jsonb language sql stable security invoker set search_path = public as $$
 select jsonb_build_object(
  'entries',count(*),
  'minutes_recorded',coalesce(sum(greatest(coalesce(minutes,0),0)),0),
  'recent',coalesce((select jsonb_agg(jsonb_build_object('at',r.at,'action',r.action) order by r.at desc)
   from (select at,action from public.ms_activity where site=p_site order by at desc limit 10) r),'[]'::jsonb)
 ) from public.ms_activity where site=p_site;
$$;
revoke all on function public.ms_billing_work_summary(text) from public, anon, authenticated;
grant execute on function public.ms_billing_work_summary(text) to service_role;
