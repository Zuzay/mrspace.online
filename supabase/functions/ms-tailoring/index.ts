import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { staffUser, notificationConfig, notifyOrder, mail } from './notifications.ts';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(url,key);
const cors={'Access-Control-Allow-Origin':'https://mrspace.online','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const statuses=['received','in_progress','finishing','ready','completed'];
const columns='id,ticket,kind,design,customer_name,customer_email,customer_phone,items,preview_svg,status,staff_notes,measurements,email_sent,created_at,updated_at';
const checked=(result:any)=>{if(result.error)throw Error('panel_data_unavailable');return result;};
const clean=(v:unknown,max:number)=>String(v??'').trim().slice(0,max);
const garments=new Set(['jeans','pants','skirt','dress','shirt','jacket','other']),genders=new Set(['women','men','unisex']);
const actions=new Set(['shorten','lengthen','take_in','let_out','repair','patch','zipper','other']);
const svgTags=new Set(['svg','defs','lineargradient','radialgradient','stop','ellipse','g','path','circle','text','rect','clippath','pattern','line','polygon','polyline']);
const svgAttrs=new Set(['xmlns','viewBox','role','aria-label','x','y','x1','x2','y1','y2','width','height','stop-color','offset','stop-opacity','cx','cy','rx','ry','fill','opacity','stroke','stroke-width','stroke-opacity','stroke-linejoin','stroke-linecap','stroke-dasharray','d','r','id','text-anchor','font-family','font-size','font-weight','clip-path','patternUnits','patternTransform','transform','points','display','preserveAspectRatio']);
export function safePreview(value:unknown){
 const input=String(value??'');if(input.length>160000)return '';const raw=input.trim();
 // Interaction hooks are not part of the stored drawing. Numbered SVG text is.
 const svg=raw.replace(/\s(?:data-[\w-]+|class|pointer-events)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?>)/g,'');
 if(!/^<svg\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)||!svg.endsWith('</svg>')||/\b(?:on[a-z]+|href|src|style)\s*=|javascript:|url\(\s*(?!#)|<!--|<!/i.test(svg))return '';
 const tags=Array.from(svg.matchAll(/<\/?([A-Za-z]+)/g),m=>m[1].toLowerCase()),attrs=Array.from(svg.matchAll(/\s([A-Za-z_:][\w:.-]*)\s*=/g),m=>m[1]);
 return tags.length&&tags.every(t=>svgTags.has(t))&&attrs.every(a=>svgAttrs.has(a))?svg:'';
}
const choices:Record<string,string[]>={fit:['Slim','Straight','Relaxed','Wide'],denim:['Raw','Stretch','Selvedge'],wash:['Dark indigo','Wide blue/white stripe','Narrow blue/white stripe','Black','White'],thread:['Pig-skin','Mellow yellow','White','Tonal','No contrast'],fly:['Button fly','Zip fly'],hem:['Chain stitch','Cuffed','Raw edge']};
function pieces(rawItems:unknown){
 if(!Array.isArray(rawItems)||!rawItems.length||rawItems.length>8)return null;
 const items=rawItems.map(raw=>{
  const it=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>,garment=clean(it.garment,20),gender=clean(it.gender,20),work=Array.isArray(it.actions)?it.actions.map(x=>clean(x,20)):[],markup=safePreview(it.preview_svg);
  const marks=(it.marks&&typeof it.marks==='object'?it.marks:{}) as Record<string,unknown>,cleanMarks:Record<string,number[]>={};
  for(const [action,point] of Object.entries(marks)){
   if(!actions.has(action)||!Array.isArray(point)||point.length!==2)return null;
   const x=Number(point[0]),y=Number(point[1]);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>360||y<0||y>500)return null;cleanMarks[action]=[x,y];
  }
  if(!garments.has(garment)||!genders.has(gender)||!work.length||work.length>8||new Set(work).size!==work.length||work.some(x=>!actions.has(x))||!markup)return null;
  return {garment,gender,actions:work,marks:cleanMarks,inches:clean(it.inches,20),note:clean(it.note,600),preview_svg:markup};
 });return items.some(it=>!it)?null:items;
}
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const uuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.headers.get('origin')&&req.headers.get('origin')!=='https://mrspace.online')return reply({error:'origin_not_allowed'},403);
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const raw=await req.text();if(raw.length>1500000)return reply({error:'request_too_large'},413);const body=JSON.parse(raw),site='space-tailoring';if(body.site&&body.site!==site)return reply({error:'not_available'},404);
  if(['submit','submit_pair','submit_piece','validate','validate_pair','validate_piece'].includes(body.action)){
   if(clean(body.website,120))return reply({error:'invalid_request'},400);
   const name=clean(body.name,100),email=clean(body.email,160).toLowerCase(),phone=clean(body.phone,40),preview=safePreview(body.preview_svg);
   if(!name||!/^\S+@\S+\.\S+$/.test(email)||!preview)return reply({error:'invalid_request'},400);
   const isPiece=body.action==='submit_piece'||body.action==='validate_piece',isPair=isPiece||body.action==='submit_pair'||body.action==='validate_pair',design:Record<string,string>={};let items=null;
   if(isPair){
    const custom:Record<string,string[]>={product:['bag','jacket'],shape:body.design?.product==='bag'?['Tote','Crossbody','Weekender']:['Work jacket','Overshirt','Cropped jacket'],fabric:['Raw denim','Canvas','Stretch denim'],color:['Indigo','Black','Natural'],finish:['Contrast stitch','Tonal stitch']};
    for(const [field,allowed] of Object.entries(isPiece?custom:choices)){const value=clean(body.design?.[field],80);if(!allowed.includes(value))return reply({error:'invalid_design'},400);design[field]=value;}
    design.note=clean(body.note,600);design.measurements=clean(body.measurements,600);items=[];
   }else{items=pieces(body.items);if(!items)return reply({error:'invalid_request'},400);}
   // Read-only validation uses exactly the same contract as insertion, with no mail or row writes.
   if(body.action.startsWith('validate'))return reply({ok:true,kind:isPair?'jeans':'repair'});
   if(body.token&&!uuid(body.token))return reply({error:'invalid_token'},400);
   const ticket='ST-'+Array.from(crypto.getRandomValues(new Uint8Array(7)),x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');
   const order={site:'space-tailoring',kind:isPair?'jeans':'repair',customer_name:name,customer_email:email,customer_phone:phone,items,preview_svg:preview,design};
   const sender=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||email).trim();
   const {data,error}=await db.rpc('ms_create_tailoring_order',{p_order:{...order,ticket},p_token:body.token||crypto.randomUUID(),p_sender_hash:await hash(key+'\0'+sender),p_fingerprint:await hash(JSON.stringify(order))});
   if(error)throw new Error('order_save_failed');if(data?.error)return reply({error:data.error},data.error==='rate_limited'?429:409);if(!/^ST-[A-Z2-9]{7}$/.test(data?.ticket||''))throw new Error('order_save_unconfirmed');
   if(!data.duplicate){try{await notifyOrder(db,order,data.ticket);}catch{console.error('Order saved; notification delivery needs attention');}}
   return reply({ticket:data.ticket,kind:order.kind,duplicate:!!data.duplicate});
  }
  if(body.action==='track'){
   const ticket=clean(body.ticket,20).toUpperCase();if(!/^ST-[A-Z2-9]{7}$/.test(ticket))return reply({error:'not_found'},404);
   const {data,error}=await db.from('ms_repair_jobs').select('ticket,status,kind,created_at').eq('site','space-tailoring').eq('ticket',ticket).maybeSingle();if(error)throw error;return data?reply(data):reply({error:'not_found'},404);
  }
  if(!await staffUser(db,req,'space-tailoring'))return reply({error:'unauthorized'},401);
  if(body.action==='orders'){
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
  if(body.action==='list'){
   const {data,error}=await db.from('ms_repair_jobs').select('id,ticket,kind,design,customer_name,customer_email,customer_phone,items,preview_svg,status,staff_notes,measurements,email_sent,created_at,updated_at').eq('site','space-tailoring').order('created_at',{ascending:false}).limit(200);if(error)throw error;return reply({jobs:(data||[]).map(job=>({...job,preview_svg:safePreview(job.preview_svg),items:(job.items||[]).map((item:any)=>({...item,preview_svg:safePreview(item.preview_svg)}))}))});
  }
  if(body.action==='update'){
   const id=clean(body.id,40),status=clean(body.status,20);if(!uuid(id)||!['received','in_progress','finishing','ready','completed'].includes(status))return reply({error:'invalid_update'},400);
   const {data:job,error:readError}=await db.from('ms_repair_jobs').select('ticket,kind,customer_name,customer_email,status').eq('id',id).eq('site','space-tailoring').maybeSingle();if(readError)throw readError;if(!job)return reply({error:'not_found'},404);
   const {error}=await db.from('ms_repair_jobs').update({status,staff_notes:clean(body.staff_notes,3000),measurements:clean(body.measurements,2000),updated_at:new Date().toISOString()}).eq('id',id).eq('site','space-tailoring');if(error)throw error;
   if(status!==job.status){try{const config=await notificationConfig(db);const messages:Record<string,string>={received:'Your request reached the shop.',in_progress:'Work has started on your order.',finishing:'Your order is in its finishing stage. Check with the shop before pickup.',ready:'Your order is ready for pickup at Space Tailoring.',completed:'Your work order is complete.'};await mail(config,job.customer_email,`Space Tailoring work order update ${job.ticket}`,`Hi ${job.customer_name},\n\n${messages[status]}\nTicket: ${job.ticket}\nTrack it at https://mrspace.online/space-tailoring/?ticket=${encodeURIComponent(job.ticket)}#order`);}catch{console.error('Status saved; email delivery needs attention');}}
   return reply({ok:true});
  }
  return reply({error:'unknown_action'},400);
 }catch{console.error('ms-tailoring request could not complete');return reply({error:'repair_service_unavailable'},500);}
});
