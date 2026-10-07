-- Rufcut repair work orders. Apply after ms/mrspace-square.sql.
create table if not exists public.ms_repair_jobs (
  id uuid primary key default gen_random_uuid(),
  ticket text not null unique,
  site text not null references public.ms_sites(slug),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  items jsonb not null,
  preview_svg text not null,
  status text not null default 'received',
  email_sent boolean not null default false,
  staff_notes text not null default '',
  measurements text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ms_repair_jobs_site_created on public.ms_repair_jobs(site, created_at desc);
create index if not exists ms_repair_jobs_ticket on public.ms_repair_jobs(ticket);
alter table public.ms_repair_jobs add column if not exists email_sent boolean not null default false;
alter table public.ms_repair_jobs drop constraint if exists ms_repair_jobs_status_check;
alter table public.ms_repair_jobs add constraint ms_repair_jobs_status_check check (status in ('received','in_progress','finishing','ready','completed'));
alter table public.ms_repair_jobs enable row level security;
revoke all on public.ms_repair_jobs from public, anon, authenticated;
drop policy if exists ms_repair_admin_all on public.ms_repair_jobs;
create policy ms_repair_admin_all on public.ms_repair_jobs
  for all to authenticated using (public.ms_is_admin()) with check (public.ms_is_admin());
