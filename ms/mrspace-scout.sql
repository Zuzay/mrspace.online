-- =====================================================================
-- MR. SPACE · FIKIR AVCISI (v1, Ekim 2026)
-- mrspace-system.sql'den SONRA calistirilir. Tekrar calistirilabilir.
-- Supabase > SQL Editor > New query > hepsini yapistir > Run.
-- =====================================================================

-- ---------- 1) Ayarlar (zamanlayici sifresi) ----------
create table if not exists public.ms_settings (
  key   text primary key,
  value text not null
);
insert into public.ms_settings(key, value) values ('cron_secret', gen_random_uuid()::text)
on conflict (key) do nothing;

-- ---------- 2) Kaynaklar: subreddit, HN sorgusu, site ----------
create table if not exists public.ms_scout_sources (
  id         bigserial primary key,
  kind       text not null,                    -- reddit | hn | site
  ref        text not null,                    -- subreddit adi, HN sorgusu ya da site adresi
  sector     text not null default 'genel',    -- terzi | pastane | cicekci | kafe | vintage | mobilya | genel
  active     boolean not null default true,
  last_run   timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, ref)
);

-- ---------- 3) Fikirler ----------
create table if not exists public.ms_ideas (
  id       bigserial primary key,
  kind     text not null,                      -- tool | phrase | theme | post
  sector   text not null default 'genel',
  title    text not null,
  url      text,
  source   text,                               -- reddit:r/Baking, hn, site
  signals  jsonb not null default '{}'::jsonb, -- renkler, fontlar, kutuphaneler, kelimeler, oy
  score    numeric not null default 0,
  status   text not null default 'new',        -- new | keep | module | dropped
  note     text,
  found_at timestamptz not null default now(),
  fp       text generated always as (md5(kind || '|' || coalesce(url, '') || '|' || title)) stored
);
create unique index if not exists ms_ideas_fp_idx on public.ms_ideas(fp);
create index if not exists ms_ideas_list_idx on public.ms_ideas(kind, status, score desc);
create index if not exists ms_ideas_found_idx on public.ms_ideas(found_at desc);

-- ---------- 4) Erisim: sadece yonetici ----------
do $$ declare t text; begin
  foreach t in array array['ms_settings','ms_scout_sources','ms_ideas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ms_admin_all on public.%I', t);
    execute format('create policy ms_admin_all on public.%I for all using (public.ms_is_admin()) with check (public.ms_is_admin())', t);
  end loop;
end $$;

-- ---------- 5) Tetikleme ----------
create or replace function public.ms_scout_kick() returns void
language plpgsql security definer set search_path = public, net as $$
declare sec text;
begin
  select value into sec from ms_settings where key = 'cron_secret';
  perform net.http_post(
    url     := 'https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-scout',
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ms-secret', sec),
    timeout_milliseconds := 10000);
end $$;
revoke all on function public.ms_scout_kick() from public, anon, authenticated;

-- Panelden "Simdi calistir"
create or replace function public.ms_scout_run_now() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not ms_is_admin() then raise exception 'not_admin'; end if;
  perform ms_scout_kick();
  insert into ms_activity(site, who, action) values (null, 'uzay', 'Scout started by hand');
end $$;
revoke all on function public.ms_scout_run_now() from public;
grant execute on function public.ms_scout_run_now() to authenticated;

-- Her gece 10:30 UTC (LA yaz saatinde 03:30, kisin 02:30)
select cron.unschedule(jobid) from cron.job where jobname = 'ms-scout';
select cron.schedule('ms-scout', '30 10 * * *', $$select public.ms_scout_kick()$$);

-- 90 gunden eski, bakilmamis fikirleri temizle (saklananlar kalir)
select cron.unschedule(jobid) from cron.job where jobname = 'ms-scout-clean';
select cron.schedule('ms-scout-clean', '45 10 * * 0',
  $$delete from public.ms_ideas where status in ('new','dropped') and found_at < now() - interval '90 days'$$);

-- ---------- 6) Baslangic kaynaklari ----------
insert into public.ms_scout_sources(kind, ref, sector) values
  ('reddit', 'tailoring',      'terzi'),
  ('reddit', 'sewing',         'terzi'),
  ('reddit', 'rawdenim',       'terzi'),
  ('reddit', 'Baking',         'pastane'),
  ('reddit', 'cakedecorating', 'pastane'),
  ('reddit', 'Pastry',         'pastane'),
  ('reddit', 'florists',       'cicekci'),
  ('reddit', 'flowers',        'cicekci'),
  ('reddit', 'barista',        'kafe'),
  ('reddit', 'cafe',           'kafe'),
  ('reddit', 'VintageFashion', 'vintage'),
  ('reddit', 'Flipping',       'vintage'),
  ('reddit', 'woodworking',    'mobilya'),
  ('reddit', 'upholstery',     'mobilya'),
  ('reddit', 'smallbusiness',  'genel'),
  ('reddit', 'web_design',     'genel'),
  ('hn',     'configurator',   'genel'),
  ('hn',     'customizer',     'genel'),
  ('hn',     'design tool',    'genel'),
  ('hn',     'small business', 'genel')
on conflict (kind, ref) do nothing;
