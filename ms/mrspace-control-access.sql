-- Heron yalnızca Mr. Space'in aktif süper yönetici oturumunu kabul eder.
-- Yeni üyelik veya Laloo yöneticiliği süper yönetici yetkisi vermez.
create or replace function public.ms_heron_admin_access()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and public.ms_is_admin()
    and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(auth.jwt()->>'email'))
    and exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid())
$$;
revoke all on function public.ms_heron_admin_access() from public,anon;
grant execute on function public.ms_heron_admin_access() to authenticated;
