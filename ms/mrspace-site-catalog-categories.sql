-- Website groups and rank are independent of Square accounting categories.
alter table public.ms_catalog_publications add column if not exists category text not null default 'other';
alter table public.ms_catalog_publications add column if not exists display_order integer not null default 100;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.ms_catalog_publications'::regclass and conname='ms_catalog_category_check') then
  alter table public.ms_catalog_publications add constraint ms_catalog_category_check check(category in ('jeans','outerwear','shirts','accessories','other'));
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.ms_catalog_publications'::regclass and conname='ms_catalog_order_check') then
  alter table public.ms_catalog_publications add constraint ms_catalog_order_check check(display_order between 0 and 9999);
 end if;
end $$;
