-- Re-runnable privilege hardening. Cron runs as postgres; nested SECURITY
-- DEFINER calls retain owner privileges. No change to customer bearer links.
begin;
revoke execute on function public.ms_count_24h(text) from public, anon, authenticated;
revoke execute on function public.ms_nightly() from public, anon, authenticated;
revoke execute on function public.ms_run_checks() from public, anon, authenticated;
grant execute on function public.ms_count_24h(text), public.ms_nightly(), public.ms_run_checks() to service_role;

-- Direct quota reads belong to the authenticated admin panel. Bearer-link
-- functions can still obtain quotas internally as their owner.
revoke execute on function public.ms_quota(text) from public, anon;
grant execute on function public.ms_quota(text) to authenticated, service_role;

-- These existing routines already check ms_is_admin() in their bodies.
-- Reduce exposure without changing the signed-in authorization checks.
revoke execute on function public.ms_build_new_version(text),
  public.ms_build_publish(bigint,text,integer), public.ms_build_recheck(bigint),
  public.ms_build_return(bigint,text), public.ms_decide_change(bigint,text,integer),
  public.ms_record_payment(text,integer,date,text), public.ms_scout_run_now(),
  public.ms_trial_convert(bigint,text,text), public.ms_trial_offer(bigint,integer)
  from public, anon;
grant execute on function public.ms_build_new_version(text),
  public.ms_build_publish(bigint,text,integer), public.ms_build_recheck(bigint),
  public.ms_build_return(bigint,text), public.ms_decide_change(bigint,text,integer),
  public.ms_record_payment(text,integer,date,text), public.ms_scout_run_now(),
  public.ms_trial_convert(bigint,text,text), public.ms_trial_offer(bigint,integer)
  to authenticated, service_role;
commit;
