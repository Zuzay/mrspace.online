-- =====================================================================
-- MR. SPACE: TALEPLER v2b (Ekim 2026) - kontrol listesi onaylari
-- Musteri sayfadaki kontrol listesinde "Looks good" dedigi parcalar saklanir.
-- mrspace-requests-v2.sql'den SONRA calistirilir. Tekrar calistirilabilir.
-- =====================================================================
alter table public.ms_submissions add column if not exists approved text[] not null default '{}';

create or replace function public.ms_set_approved(p_edit uuid, p_anchors text[])
returns json language plpgsql security definer set search_path = public as $$
begin
  update ms_submissions
     set approved = coalesce((select array_agg(distinct left(a, 400)) from unnest(p_anchors[1:200]) a where a is not null), '{}')
   where edit_key = p_edit;
  if not found then raise exception 'unknown'; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.ms_get_submission(p_edit uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', x.name, 'email', x.email, 'version', x.version, 'at', x.created_at,
    'site', s.name, 'url', s.url, 'approved', x.approved,
    'quota', (select row_to_json(q) from ms_quota(s.slug) q),
    'items', ms_items(x.id))
  from ms_submissions x join ms_sites s on s.slug = x.site where x.edit_key = p_edit;
$$;

revoke all on function public.ms_set_approved(uuid, text[]) from public;
grant execute on function public.ms_set_approved(uuid, text[]) to anon, authenticated;
