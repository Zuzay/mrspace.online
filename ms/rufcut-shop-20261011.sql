-- Website-only Rufcut cleanup. Does not alter Square prices, stock, products or checkout.
-- Product URLs were read from https://www.rufcut.com/s/shop on 2026-10-11.
begin;
with links(item_id,url) as (values
 ('M3AVW3YR2HDLYMF3IXJHCLF2','https://www.rufcut.com/product/men-s-bespoke-jeans/M3AVW3YR2HDLYMF3IXJHCLF2'),
 ('FQIT6YDV4LS26Y6ZKPJLETHN','https://www.rufcut.com/product/women-s-bespoke-jeans/FQIT6YDV4LS26Y6ZKPJLETHN'),
 ('E2VIBECQPDYH5SUY2QI3UHY5','https://www.rufcut.com/product/montana-double-front-mdf-/E2VIBECQPDYH5SUY2QI3UHY5'),
 ('UKL6ZY7UDILD357YOEDZDZXI','https://www.rufcut.com/product/levi-s-vintage-jackets/UKL6ZY7UDILD357YOEDZDZXI'),
 ('RL3X3LOETIHQ4HX2VCSH7UT5','https://www.rufcut.com/product/jean-journal/RL3X3LOETIHQ4HX2VCSH7UT5'),
 ('TSBVI7OQOO7U4GA76MSFLKXJ','https://www.rufcut.com/product/bespoke-chore-coat/TSBVI7OQOO7U4GA76MSFLKXJ'),
 ('QTLESMMIKRSES7W3JD435BCZ','https://www.rufcut.com/product/rufcut-5-pocket-bespoke-jeans/QTLESMMIKRSES7W3JD435BCZ'),
 ('URQYEVLW42HG7EQPLEGMPNPP','https://www.rufcut.com/product/jean-workshop/URQYEVLW42HG7EQPLEGMPNPP')
)
update public.ms_catalog_publications p set variations=(select jsonb_object_agg(v.key,v.value||jsonb_build_object('purchase_url',links.url)) from jsonb_each(p.variations) v),updated_at=now() from links where p.site='rufcut' and p.item_id=links.item_id;
update public.ms_catalog_publications set layout='grouped',title='Levi''s Used & Vintage Jeans',updated_at=now() where site='rufcut' and item_id='ULJ3CKMKO6ELQIVT7EWENXJY';
update public.ms_catalog_publications set section='shop',category='jeans',display_order=25,updated_at=now() where site='rufcut' and item_id='QTLESMMIKRSES7W3JD435BCZ';
-- The actual online booking is a $200 deposit, not a $2,249 full-price checkout.
update public.ms_catalog_publications set section='hidden',updated_at=now() where site='rufcut' and item_id='DPUKZWEMBECWLE5X353YSGZ6';
update public.ms_catalog_publications set section='workshop',title='Jean Workshop · $200 Deposit',updated_at=now() where site='rufcut' and item_id='URQYEVLW42HG7EQPLEGMPNPP';
-- Prioritize pieces already sold on the native Square shop within outerwear.
update public.ms_catalog_publications set display_order=5 where site='rufcut' and item_id='TSBVI7OQOO7U4GA76MSFLKXJ';
update public.ms_catalog_publications set display_order=10 where site='rufcut' and item_id='UKL6ZY7UDILD357YOEDZDZXI';
update public.ms_catalog_publications set display_order=20 where site='rufcut' and item_id='WHL3A64OWAUNGVF2ARFPXRW2';
-- Spelling fixes are website overrides; Square/register names and SKUs stay intact.
update public.ms_catalog_publications set title='Bespoke Kimono',updated_at=now() where site='rufcut' and item_id='NUKYUE2KYIRKQOBSXIZTP4HY';
update public.ms_catalog_publications set variations=jsonb_set(variations,'{SXYTU6IT6BY3XP3U6R43RAOI,title}','"Wide Blue Hickory Stripe"') where site='rufcut' and item_id='E2VIBECQPDYH5SUY2QI3UHY5';
update public.ms_catalog_publications set variations=jsonb_set(variations,'{NMO344MSKIELYTYPDFAADL2R,title}','"Half-Zip Anorak"') where site='rufcut' and item_id='WHL3A64OWAUNGVF2ARFPXRW2';
update public.ms_square set public_catalog=true,updated_at=now() where site='rufcut' and public_catalog=false;
commit;
