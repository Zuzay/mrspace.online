-- Mr. Space Uretici Hat (isci) kurulumu
-- Supabase SQL Editor'da bir kez calistir. Tekrar calistirilabilir.
-- Once mrspace-system.sql kurulu olmali.

-- 1) Her site hangi repoda, hangi klasorde
alter table public.ms_sites add column if not exists repo      text not null default 'Zuzay/mrspace.online';
alter table public.ms_sites add column if not exists repo_path text;   -- ornek: 'rufcut-site/'  (bos ise isci dokunmaz)

-- 2) Talep uzerinde iscinin durumu
alter table public.ms_changes add column if not exists ai_status  text;     -- null | working | ready | needs_uzay | failed | merged | closed
alter table public.ms_changes add column if not exists ai_route   text;     -- content | code | big
alter table public.ms_changes add column if not exists ai_model   text;
alter table public.ms_changes add column if not exists ai_note    text;     -- iscinin kisa aciklamasi / hata
alter table public.ms_changes add column if not exists pr_url     text;
alter table public.ms_changes add column if not exists ai_cost    numeric not null default 0;  -- USD
alter table public.ms_changes add column if not exists ai_at      timestamptz;
alter table public.ms_changes add column if not exists ai_attempts integer not null default 0;

-- 3) Aninda tetik: yeni talep gelince veya onay/red verilince GitHub'a sinyal
-- Token'i bir kez kasaya koy (GitHub > Settings > Developer settings > Fine-grained token,
-- sadece Zuzay/mrspace.online, izin: Contents read/write):
--   select vault.create_secret('github_pat_XXXX', 'ms_github_token');
create or replace function public.ms_ping_worker()
returns trigger language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'ms_github_token' limit 1;
  if tok is null then return new; end if;
  perform net.http_post(
    url     := 'https://api.github.com/repos/Zuzay/mrspace.online/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'mrspace-db',
      'Content-Type', 'application/json'),
    body    := jsonb_build_object('event_type', 'ms-work', 'client_payload', jsonb_build_object('id', new.id))
  );
  return new;
end $$;

drop trigger if exists ms_changes_ping on public.ms_changes;
create trigger ms_changes_ping
  after insert or update of status on public.ms_changes
  for each row
  when (new.status in ('new', 'approved', 'rejected'))
  execute function public.ms_ping_worker();

-- 4) Bu ayki isci harcamasi (panelde gostermek icin)
create or replace function public.ms_ai_spend_month()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(ai_cost), 0) from ms_changes
  where ai_at >= date_trunc('month', now() at time zone 'America/Los_Angeles');
$$;

-- 5) Rufcut'u bagla (klasor adini repodaki gercek klasorle degistir)
-- update public.ms_sites set repo_path = 'rufcut-site/' where slug = 'rufcut';
