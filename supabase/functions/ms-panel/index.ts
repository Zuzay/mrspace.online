// Daily work, exact totals and reversible website archival. No customer data is public.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { staffUser } from '../_shared/notifications.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors={'Access-Control-Allow-Origin':'https://mrspace.online','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const statuses=['received','in_progress','finishing','ready','completed'];
const columns='id,ticket,kind,design,customer_name,customer_email,customer_phone,items,preview_svg,status,staff_notes,measurements,email_sent,created_at,updated_at';
const checked=(result:any)=>{if(result.error)throw Error('panel_data_unavailable');return result;};
const svgTags=new Set(['svg','defs','lineargradient','radialgradient','stop','ellipse','g','path','circle','text','rect','clippath','pattern','line','polygon','polyline']);
const svgAttrs=new Set(['xmlns','viewBox','role','aria-label','x','y','x1','x2','y1','y2','width','height','stop-color','offset','stop-opacity','cx','cy','rx','ry','fill','opacity','stroke','stroke-width','stroke-opacity','stroke-linejoin','stroke-linecap','stroke-dasharray','d','r','id','text-anchor','font-family','font-size','font-weight','clip-path','patternUnits','patternTransform','transform','points','display','preserveAspectRatio']);
function safePreview(value:unknown){
 const input=String(value??'');if(input.length>160000)return '';const raw=input.trim();
 // Interaction hooks are not part of the stored drawing. Numbered SVG text is.
 const svg=raw.replace(/\s(?:data-[\w-]+|class|pointer-events)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?>)/g,'');
 if(!/^<svg\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)||!svg.endsWith('</svg>')||/\b(?:on[a-z]+|href|src|style)\s*=|javascript:|url\(\s*(?!#)|<!--|<!/i.test(svg))return '';
 const tags=Array.from(svg.matchAll(/<\/?([A-Za-z]+)/g),m=>m[1].toLowerCase()),attrs=Array.from(svg.matchAll(/\s([A-Za-z_:][\w:.-]*)\s*=/g),m=>m[1]);
 return tags.length&&tags.every(t=>svgTags.has(t))&&attrs.every(a=>svgAttrs.has(a))?svg:'';
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.headers.get('origin')&&req.headers.get('origin')!=='https://mrspace.online')return reply({error:'origin_not_allowed'},403);
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const raw=await req.text();if(raw.length>4000)return reply({error:'invalid_request'},400);
  const body=JSON.parse(raw),site=String(body.site||'');if(!/^[a-z0-9-]{1,60}$/.test(site))return reply({error:'invalid_request'},400);
  const email=await staffUser(db,req,site);if(!email)return reply({error:'unauthorized'},401);
  if(body.action==='billing'){
   const result=checked(await db.from('ms_billing').select('currency,terms,setup_verified_at,early_start_chosen').eq('site',site).maybeSingle());
   if(!result.data)return reply({error:'billing_not_ready'},404);
   const b=result.data,t=b.terms||{},a=t.agreement||{},amount=a.setup?.amount,monthly=a.monthly||{};
   if(!Number.isFinite(amount)||amount<0||!Number.isFinite(monthly.agreed)||monthly.agreed<0||!Number.isFinite(monthly.standard)||monthly.standard<0)throw Error('billing_invalid');
   const summary=checked(await db.rpc('ms_billing_work_summary',{p_site:site}));
   if(!Number.isSafeInteger(summary.data?.entries)||!Number.isSafeInteger(summary.data?.minutes_recorded))throw Error('billing_work_unavailable');
   const verified=!!b.setup_verified_at,setup={amount,status:verified?'verified':'unverified',verified_at:b.setup_verified_at,branding_removal_on:a.setup?.branding_removal_on||null};
   // Monthly payments require actual invoices; options and standard value are never added to the debt.
   return reply({currency:b.currency,agreement:{plan:a.plan,setup,monthly:{...monthly,early_start:{...monthly.early_start,chosen:!!b.early_start_chosen}}},options:t.options||[],
    work:{source:'ms_activity',...summary.data,estimate:t.work_estimate||null},due:{amount:verified?0:amount,items:verified?[]:[{key:'setup',amount,status:'unverified'}]},checked_at:new Date().toISOString()});
  }
  if(body.action==='overview'){
   if(site!=='rufcut')return reply({orders:null,checked_at:new Date().toISOString()});
   const results=await Promise.all(statuses.map(status=>db.from('ms_repair_jobs').select('id',{count:'exact',head:true}).eq('site',site).eq('status',status)));
   const counts=Object.fromEntries(results.map((r:any,i)=>[statuses[i],checked(r).count]));
   if(Object.values(counts).some(v=>!Number.isSafeInteger(v)))throw Error('panel_data_unavailable');
   const recent=checked(await db.from('ms_repair_jobs').select('id,ticket,kind,customer_name,status,created_at').eq('site',site).in('status',['received','finishing','ready']).order('created_at',{ascending:false}).limit(6));
   return reply({orders:{counts,total:Object.values(counts).reduce((n:any,v:any)=>n+v,0),attention:recent.data},checked_at:new Date().toISOString()});
  }
  if(body.action==='orders'){
   if(site!=='rufcut')return reply({error:'not_available'},400);
   const page=body.page??1,size=body.size??12,status=body.status??'all',kind=body.kind??'all';
   if(!Number.isSafeInteger(page)||page<1||page>10000||![12,24].includes(size)||!['all','active',...statuses].includes(status)||!['all','repair','jeans'].includes(kind)||typeof(body.query??'')!=='string'||(body.query||'').length>100)return reply({error:'invalid_request'},400);
   let query=db.from('ms_repair_jobs').select(columns,{count:'exact'}).eq('site',site);
   if(status==='active')query=query.in('status',['received','in_progress','finishing']);else if(status!=='all')query=query.eq('status',status);
   if(kind!=='all')query=query.eq('kind',kind);
   // Search punctuation cannot inject PostgREST operators; wildcard characters are literal.
   const search=String(body.query||'').replace(/[(),."\\]/g,' ').trim().replace(/[%_]/g,c=>'\\'+c);
   if(search)query=query.or(['ticket','customer_name','customer_email','customer_phone'].map(k=>`${k}.ilike.%${search}%`).join(','));
   const result=checked(await query.order('created_at',{ascending:false}).range((page-1)*size,page*size-1));
   if(!Number.isSafeInteger(result.count))throw Error('panel_data_unavailable');
   return reply({jobs:(result.data||[]).map((job:any)=>({...job,preview_svg:safePreview(job.preview_svg),items:(job.items||[]).map((item:any)=>({...item,preview_svg:safePreview(item.preview_svg)}))})),total:result.count,page,size});
  }
  if(body.action==='archive_catalog'){
   if(site==='rufcut')return reply({error:'sales_disabled'},409);
   const item=body.item;if(typeof item!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(item)||typeof body.archived!=='boolean')return reply({error:'invalid_request'},400);
   const result=await db.rpc('ms_set_catalog_archive',{p_site:site,p_item:item,p_archived:body.archived});checked(result);
   if(result.data!==true)throw Error('archive_not_confirmed');
   await db.from('ms_activity').insert({site,who:email,action:`Website catalog ${body.archived?'archived':'restored'}: ${item}`});
   return reply({ok:true,item,archived:body.archived});
  }
  return reply({error:'unknown_action'},400);
 }catch{return reply({error:'panel_data_unavailable'},500);}
});
