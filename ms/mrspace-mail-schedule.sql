-- mrspace-mail.sql ve ms-mail Edge Function kurulumundan SONRA.
-- pg_cron + pg_net mevcut sistemde kurulu. Gönderim kapalıyken HTTP çağrısı yapmaz.
create or replace function public.ms_mail_kick() returns void
language plpgsql security definer set search_path='' as $$
declare sec text;
begin
  if not exists(select 1 from public.ms_mail_settings where enabled and domain_verified_at is not null) then return; end if;
  if not exists(select 1 from public.ms_mail_outbox where status in ('queued','sending') and next_attempt_at<=now()) then return; end if;
  select value into sec from public.ms_settings where key='cron_secret';
  if length(coalesce(sec,''))<20 then return; end if;
  perform net.http_post(url:='https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-mail',
    headers:=jsonb_build_object('Content-Type','application/json','x-ms-secret',sec),body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=30000);
end $$;
revoke all on function public.ms_mail_kick() from public,anon,authenticated;
grant execute on function public.ms_mail_kick() to service_role;
do $$begin
  if not exists(select 1 from cron.job where jobname='ms-mail-dispatch') then
    perform cron.schedule('ms-mail-dispatch','*/5 * * * *','select public.ms_mail_kick()');
  end if;
end $$;
