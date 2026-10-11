import {address,plainText,renderMail,sendQueued,verifyWebhook} from './mail-core.ts';
const cors={'Access-Control-Allow-Origin':'https://mrspace.online','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
async function limitedText(stream:ReadableStream<Uint8Array>|null,max:number){
 if(!stream)throw new Error('empty_body');const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new Error('body_too_large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const all=new Uint8Array(size);let at=0;for(const c of chunks){all.set(c,at);at+=c.length;}return new TextDecoder().decode(all);
}
async function equalSecret(a:string,b:string){
 if(a.length<20||b.length<20||a.length>500||b.length>500)return false;
 const h=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const x=await h(a),y=await h(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
export function mailHandler(db:any,env:Record<string,string|undefined>={},transport=fetch){
 return async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  const origin=req.headers.get('origin');if(origin&&origin!=='https://mrspace.online')return reply({error:'origin_not_allowed'},403);
  try{
   const raw=await limitedText(req.body,120000);
   const secrets=await db.rpc('ms_mail_secrets');if(secrets.error)throw new Error('setup_needed');
   const cfg={key:env.RESEND_API_KEY||secrets.data?.key||'',webhook:env.RESEND_WEBHOOK_SECRET||secrets.data?.webhook||'',cron:secrets.data?.cron||''};
   if(new URL(req.url).pathname.endsWith('/webhook')){
    if(!await verifyWebhook(req,raw,cfg.webhook))return reply({error:'invalid_signature'},401);
    const event=JSON.parse(raw),id=String(event.data?.email_id||'');
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))return reply({error:'invalid_event'},400);
    const state:Record<string,string>={'email.delivered':'delivered','email.bounced':'bounced','email.complained':'complained'};
    if(state[event.type]){
     const r=await db.rpc('ms_mail_event',{p_id:req.headers.get('svix-id'),p_provider:id,p_status:state[event.type]});if(r.error)throw new Error('event_not_saved');
    }else if(event.type==='email.received'){
     if(!cfg.key)throw new Error('setup_needed');
     const r=await transport('https://api.resend.com/emails/receiving/'+id,{headers:{Authorization:'Bearer '+cfg.key},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('inbox_fetch_failed');
     const mail=JSON.parse(await limitedText(r.body,1000000)),to=[...(Array.isArray(mail.to)?mail.to:[]),...(Array.isArray(mail.received_for)?mail.received_for:[]),...(Array.isArray(event.data.to)?event.data.to:[])].map(address);
     const target=to.find((x:string)=>x==='hello@mrspace.online'||x==='rufcut@mrspace.online');
     if(target){const text=plainText(mail),replyAddress=(Array.isArray(mail.reply_to)?mail.reply_to:[]).map(address).find(Boolean)||address(mail.from);
      const saved=await db.from('ms_mail_inbox').upsert({id,recipient:target,sender:String(mail.from||'').slice(0,300),reply_address:replyAddress,message_id:/^<[^<>\r\n]{1,900}>$/.test(mail.message_id||'')?mail.message_id:null,subject:String(mail.subject||'').replace(/[\r\n]/g,' ').slice(0,300),body:text.slice(0,50000),truncated:text.length>50000,attachment_count:Array.isArray(mail.attachments)?mail.attachments.length:0},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw new Error('inbox_not_saved');}
    }
    return reply({ok:true});
   }
   const body=JSON.parse(raw);
   if(body.action==='dispatch'&&await equalSecret(req.headers.get('x-ms-secret')||'',cfg.cron))return reply(await sendQueued(db,cfg,transport));
   const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
   if(!token)return reply({error:'sign_in_required'},401);
   const u=await db.auth.getUser(token),email=u.data?.user?.email?.toLowerCase();if(u.error||!email)return reply({error:'sign_in_required'},401);
   const admin=await db.from('ms_admins').select('email').eq('email',email).maybeSingle();if(admin.error)throw new Error('access_check_failed');if(!admin.data)return reply({error:'not_admin'},403);
   if(body.action==='status')return reply({keyConfigured:!!cfg.key,webhookConfigured:!!cfg.webhook});
   if(body.action==='verify_setup'){
    if(!cfg.key)return reply({error:'key_missing'},409);
    const r=await transport('https://api.resend.com/domains?limit=100',{headers:{Authorization:'Bearer '+cfg.key},signal:AbortSignal.timeout(8000)});
    if(!r.ok)return reply({error:'domain_check_failed'},409);
    const result=JSON.parse(await limitedText(r.body,200000)),domain=result.data?.find((d:any)=>d.name==='mrspace.online');
    const verified=domain?.status==='verified';
    const saved=await db.from('ms_mail_settings').update({domain_verified_at:verified?new Date().toISOString():null,...(verified?{}:{enabled:false}),updated_at:new Date().toISOString()}).eq('id',true);if(saved.error)throw new Error('setup_not_saved');
    return reply({verified});
   }
   if(body.action==='dispatch')return reply(await sendQueued(db,cfg,transport));
   if(body.action==='reply'){
    const original=await db.from('ms_mail_inbox').select('id,recipient,sender,subject,reply_address,message_id').eq('id',String(body.id||'')).maybeSingle();
    if(original.error||!original.data)return reply({error:'message_not_found'},404);
    const to=address(original.data.reply_address||original.data.sender),text=String(body.text||'').trim();if(!to||text.length<1||text.length>10000||!/^[0-9a-f-]{36}$/i.test(String(body.token||'')))return reply({error:'invalid_reply'},400);
    const site=original.data.recipient==='rufcut@mrspace.online'?'rufcut':null;
    const payload={subject:'Re: '+original.data.subject,text,...(original.data.message_id?{in_reply_to:original.data.message_id}:{})};
    const q=await db.rpc('ms_mail_enqueue',{p_event:'reply/'+original.data.id+'/'+body.token,p_site:site,p_kind:'reply',p_to:to,p_lang:'en',p_payload:payload});if(q.error)throw new Error('queue_failed');return reply({queued:true,id:q.data});
   }
   if(!['preview','queue'].includes(body.action)||!['welcome','site_ready'].includes(body.kind))return reply({error:'unknown_action'},400);
   const site=String(body.site||''),lang=site==='rufcut'?'en':(['en','tr','es','de','fr'].includes(body.lang)?body.lang:'en');
   const s=await db.from('ms_sites').select('slug,name,contact').eq('slug',site).maybeSingle();if(s.error||!s.data)return reply({error:'unknown_site'},404);
   const to=address(s.data.contact);if(!to||to.endsWith('@mrspace.online'))return reply({error:'customer_contact_missing'},409);
   const job={site,kind:body.kind,recipient:to,lang,payload:{name:s.data.name}},preview=renderMail(job);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(preview)))),b=>b.toString(16).padStart(2,'0')).join('');
   if(body.action==='preview')return reply({recipient:to,...preview,digest});
   if(body.digest!==digest)return reply({error:'preview_changed'},409);
   if(!/^[0-9a-f-]{36}$/i.test(String(body.token||'')))return reply({error:'invalid_token'},400);
   // İnsan "hazır" kararını verir; alanlar/taşınan bağlantılar tekrar sunucudan okunur.
   const q=await db.rpc('ms_mail_enqueue',{p_event:body.kind+'/'+site+'/'+body.token,p_site:site,p_kind:body.kind,p_to:to,p_lang:lang,p_payload:job.payload});if(q.error)throw new Error('queue_failed');
   return reply({queued:true,id:q.data});
  }catch(e){return reply({error:(e as Error).message==='body_too_large'?'request_too_large':'mail_service_unavailable'},(e as Error).message==='body_too_large'?413:503);}
 };
}
