-- Shared pre-launch settings; no payment links or charges are created by this setup.
create table if not exists public.ms_commerce_setups (
 site text primary key references public.ms_sites(slug),
 setup jsonb not null check(jsonb_typeof(setup)='object'),
 updated_at timestamptz not null default now(),
 updated_by text not null
);
alter table public.ms_commerce_setups enable row level security;
revoke all on public.ms_commerce_setups from anon,authenticated;
grant all on public.ms_commerce_setups to service_role;
drop policy if exists ms_admin_all on public.ms_commerce_setups;
create policy ms_admin_all on public.ms_commerce_setups for all to authenticated using(public.ms_is_admin()) with check(public.ms_is_admin());
