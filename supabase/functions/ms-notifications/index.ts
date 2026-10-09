import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { staffUser, notificationConfig } from '../_shared/notifications.ts';
import { pushEndpoint, bytes } from '../_shared/web-push.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors={'Access-Control-Allow-Origin':'https://mrspace.online','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const langs=['en','tr','es','de','fr'];
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.headers.get('origin')&&req.headers.get('origin')!=='https://mrspace.online')return reply({error:'origin_not_allowed'},403);
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const raw=await req.text();if(raw.length>10000)return reply({error:'request_too_large'},413);const body=JSON.parse(raw);
  if(body.action==='capabilities'){const config=await notificationConfig(db);return reply({emailReady:!!(config.emailKey&&config.emailFrom),pushReady:!!config.vapid});}
  const site=String(body.site||'');if(!/^[a-z0-9_-]{1,80}$/.test(site))return reply({error:'invalid_site'},400);
  const email=await staffUser(db,req,site);if(!email)return reply({error:'not_allowed'},403);
  if(body.action==='settings'){
   const config=await notificationConfig(db,true),prefs=await db.from('ms_notification_preferences').select('delivery_email,email_enabled,lang').eq('site',site).eq('owner_email',email).maybeSingle();if(prefs.error)throw new Error('settings_unavailable');
   return reply({publicKey:config.vapid.publicKey,emailReady:!!(config.emailKey&&config.emailFrom),email:prefs.data?.delivery_email||(site==='rufcut'?'shop@rufcut.com':email),emailEnabled:prefs.data?.email_enabled??true});
  }
  if(body.action==='preferences'){
   const delivery=String(body.email||'').trim().toLowerCase();if(delivery.length>160||!/^\S+@\S+\.\S+$/.test(delivery)||typeof body.enabled!=='boolean')return reply({error:'invalid_preferences'},400);
   const result=await db.from('ms_notification_preferences').upsert({site,owner_email:email,delivery_email:delivery,email_enabled:body.enabled,lang:langs.includes(body.lang)?body.lang:'en',updated_at:new Date().toISOString()},{onConflict:'site,owner_email'});if(result.error)throw new Error('settings_unavailable');return reply({ok:true});
  }
  if(body.action==='subscribe'){
   const sub=body.subscription,endpoint=pushEndpoint(sub?.endpoint);if(!endpoint)return reply({error:'invalid_subscription'},400);
   try{const pub=bytes(sub.keys.p256dh),auth=bytes(sub.keys.auth);if(pub.length!==65||pub[0]!==4||auth.length!==16)throw 0;await crypto.subtle.importKey('raw',pub,{name:'ECDH',namedCurve:'P-256'},false,[]);}catch{return reply({error:'invalid_subscription'},400);}
   const active=await db.from('ms_push_subscriptions').select('endpoint').eq('site',site).eq('owner_email',email).eq('enabled',true).limit(11);if(active.error)throw new Error('subscriptions_unavailable');if(active.data.length>=10&&!active.data.some((s:any)=>s.endpoint===endpoint))return reply({error:'device_limit'},429);
   // One device cannot continue notifying a previous account after another account claims it.
   const previous=await db.from('ms_push_subscriptions').update({enabled:false}).eq('endpoint',endpoint).neq('owner_email',email);if(previous.error)throw new Error('subscriptions_unavailable');
   const result=await db.from('ms_push_subscriptions').upsert({site,owner_email:email,endpoint,p256dh:sub.keys.p256dh,auth:sub.keys.auth,enabled:true,lang:langs.includes(body.lang)?body.lang:'en',updated_at:new Date().toISOString()},{onConflict:'site,endpoint'});if(result.error)throw new Error('subscriptions_unavailable');return reply({ok:true});
  }
  if(body.action==='unsubscribe'){
   const endpoint=pushEndpoint(body.endpoint);if(!endpoint)return reply({error:'invalid_subscription'},400);
   const result=await db.from('ms_push_subscriptions').update({enabled:false}).eq('site',site).eq('owner_email',email).eq('endpoint',endpoint);if(result.error)throw new Error('subscriptions_unavailable');return reply({ok:true});
  }
  return reply({error:'unknown_action'},400);
 }catch{return reply({error:'notification_service_unavailable'},503);}
});
