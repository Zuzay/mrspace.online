-- Shared website publication decisions, independent of Square SKUs/categories.
-- New items and new variations stay unpublished until reviewed in the panel.
alter table public.ms_square add column if not exists hidden_catalog_items text[] not null default '{}';
create table if not exists public.ms_catalog_publications (
 site text not null references public.ms_sites(slug) on delete cascade,
 item_id text not null check (length(item_id) between 1 and 100),
 section text not null default 'review' check (section in ('review','shop','workshop','repair','hidden')),
 layout text not null default 'grouped' check (layout in ('grouped','separate')),
 title text not null default '' check (length(title)<=255),
 variations jsonb not null default '{}'::jsonb check (jsonb_typeof(variations)='object'),
 updated_at timestamptz not null default now(),
 updated_by text not null,
 primary key(site,item_id)
);
alter table public.ms_catalog_publications enable row level security;
revoke all on public.ms_catalog_publications from anon, authenticated;
grant all on public.ms_catalog_publications to service_role;
drop policy if exists ms_admin_all on public.ms_catalog_publications;
create policy ms_admin_all on public.ms_catalog_publications for all to authenticated using (public.ms_is_admin()) with check (public.ms_is_admin());
