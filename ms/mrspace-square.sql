-- =====================================================================
-- MR. SPACE: MUSTERI PANELI + SQUARE (Ekim 2026)
-- Musteri kendi paneline (mrspace.online/panel) girer: stok, etiket, talepler.
-- Square anahtarlari sadece ms-square fonksiyonunun okuyabildigi tabloda durur.
-- mrspace-system.sql'den SONRA calistirilir. Tekrar calistirilabilir.
-- =====================================================================

-- Hangi kullanici hangi sitenin panelini acabilir
create table if not exists public.ms_site_users (
  email      text not null,
  site       text not null references public.ms_sites(slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (email, site)
);

-- Square baglantisi. Politikasi YOK: REST'ten kimse okuyamaz, sadece fonksiyon (service role).
create table if not exists public.ms_square (
  site           text primary key references public.ms_sites(slug) on delete cascade,
  merchant_id    text,
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  location_id    text,
  location_name  text,
  currency       text not null default 'USD',
  sku_prefix     text,
  public_catalog boolean not null default false,  -- sitede stok gosterilsin mi
  connected_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.ms_site_users enable row level security;
drop policy if exists ms_admin_all on public.ms_site_users;
create policy ms_admin_all on public.ms_site_users for all using (public.ms_is_admin()) with check (public.ms_is_admin());
alter table public.ms_square enable row level security;

-- Giris yapan kisinin acabildigi siteler (yonetici hepsini gorur)
create or replace function public.ms_my_sites()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'slug', s.slug, 'name', s.name, 'url', s.url, 'plan', s.plan, 'status', s.status, 'site_key', s.site_key,
    'square', (select json_build_object('location', q.location_name, 'public', q.public_catalog, 'since', q.connected_at)
               from ms_square q where q.site = s.slug and q.access_token is not null)) order by s.name), '[]'::json)
  from ms_sites s
  where public.ms_is_admin()
     or exists (select 1 from ms_site_users u where u.site = s.slug and u.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.ms_my_sites() from public, anon;
grant execute on function public.ms_my_sites() to authenticated;

-- Ilk musteri: Rufcut paneline giris (Supabase Authentication'da rufcut@mrspace.online kullanicisini ac)
insert into public.ms_site_users(email, site) values ('rufcut@mrspace.online', 'rufcut') on conflict do nothing;
