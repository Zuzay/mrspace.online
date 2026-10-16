-- Space Tailoring is an independent studio-owned site. No existing rows or grants are copied.
insert into public.ms_sites(slug,name,url,admin_url,kind,plan,status,monthly_cents,repo_path)
values ('space-tailoring','Space Tailoring','https://mrspace.online/space-tailoring/','https://mrspace.online/panel/space-tailoring/','own','own','building',0,'space-tailoring/')
on conflict(slug) do update set name=excluded.name,url=excluded.url,admin_url=excluded.admin_url,repo_path=excluded.repo_path;
create or replace function public.ms_create_tailoring_order(p_order jsonb,p_token uuid,p_sender_hash text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing public.ms_repair_jobs; v_ticket text;
begin
 if p_token is null or length(p_sender_hash)<>64 or length(p_fingerprint)<>64 or (p_order->>'site') is distinct from 'space-tailoring' then raise exception 'invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtext('space-tailoring:'||p_token::text));
 select * into v_existing from public.ms_repair_jobs where site='space-tailoring' and submission_token=p_token;
 if found then
  if v_existing.request_fingerprint<>p_fingerprint then return jsonb_build_object('error','token_conflict'); end if;
  return jsonb_build_object('ticket',v_existing.ticket,'duplicate',true);
 end if;
 perform pg_advisory_xact_lock(hashtext('sender:'||p_sender_hash));
 perform pg_advisory_xact_lock(hashtext('email:'||(p_order->>'customer_email')));
 if (select count(*) from public.ms_repair_jobs where site='space-tailoring' and created_at>now()-interval '1 hour' and sender_hash=p_sender_hash)>=20
 or (select count(*) from public.ms_repair_jobs where site='space-tailoring' and created_at>now()-interval '1 hour' and customer_email=p_order->>'customer_email')>=8 then
  return jsonb_build_object('error','rate_limited');
 end if;
 v_ticket:=p_order->>'ticket';
 insert into public.ms_repair_jobs(ticket,site,kind,customer_name,customer_email,customer_phone,items,preview_svg,design,submission_token,sender_hash,request_fingerprint)
 values(v_ticket,'space-tailoring',p_order->>'kind',p_order->>'customer_name',p_order->>'customer_email',p_order->>'customer_phone',p_order->'items',p_order->>'preview_svg',coalesce(p_order->'design','{}'::jsonb),p_token,p_sender_hash,p_fingerprint);
 return jsonb_build_object('ticket',v_ticket,'duplicate',false);
end $$;
revoke all on function public.ms_create_tailoring_order(jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ms_create_tailoring_order(jsonb,uuid,text,text) to service_role;
