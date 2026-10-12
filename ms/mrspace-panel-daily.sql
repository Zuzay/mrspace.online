-- Atomic, reversible website archive. Square prices, quantities and history stay intact.
create or replace function public.ms_set_catalog_archive(p_site text,p_item text,p_archived boolean)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from public.ms_catalog_publications where site=p_site and item_id=p_item) then
  raise exception 'catalog_record_not_found';
 end if;
 update public.ms_square set hidden_catalog_items=case when p_archived then
  array(select distinct x from unnest(coalesce(hidden_catalog_items,'{}'::text[])||array[p_item]) x order by x)
  else array_remove(coalesce(hidden_catalog_items,'{}'::text[]),p_item) end,
  updated_at=now() where site=p_site;
 if not found then raise exception 'square_account_not_found'; end if;
 return true;
end $$;
revoke all on function public.ms_set_catalog_archive(text,text,boolean) from public,anon,authenticated;
grant execute on function public.ms_set_catalog_archive(text,text,boolean) to service_role;
