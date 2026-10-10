import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {renderMail,plainText,sendQueued,verifyWebhook} from '../supabase/functions/_shared/mail-core.ts';
import {mailHandler} from '../supabase/functions/_shared/mail-handler.ts';
let count=0;const test=async(label,fn)=>{await fn();count++;console.log('PASS '+label);};
const secret='whsec_'+randomBytes(32).toString('base64'),uuid='11111111-1111-4111-8111-111111111111',provider='22222222-2222-4222-8222-222222222222';
function signed(raw,{stamp=Math.floor(Date.now()/1000),id='msg_test',signature}={}){
 const sig=signature||createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${stamp}.${raw}`).digest('base64');
 return new Request('https://test.supabase.co/functions/v1/ms-mail/webhook',{method:'POST',headers:{'svix-id':id,'svix-timestamp':String(stamp),'svix-signature':'v1,'+sig},body:raw});
}
await test('five languages escape customer content and use the requested sender, real editor and PDF links',async()=>{
 for(const lang of ['en','tr','es','de','fr']){
  const m=renderMail({kind:'site_ready',site:'rufcut',recipient:'client@example.test',lang,payload:{name:'<img src=x onerror=alert(1)>'}});
  assert.match(m.html,/<html lang="en">/);assert.match(m.subject,/Your site is ready to review/);
  assert.equal(m.from,'Rufcut <rufcut@mrspace.online>');assert.equal(m.reply_to,'rufcut@mrspace.online');assert.match(m.html,/&lt;img/);assert.ok(!m.html.includes('<img src=x'));
  assert.match(m.text,/https:\/\/mrspace.online\/edit\/\?site=rufcut/);assert.match(m.text,/rufcut-system-guide\.pdf/);assert.ok(!m.text.includes('?k='));assert.ok(!m.html.includes('Package'));
  assert.equal(renderMail({kind:'welcome',site:'heron',recipient:'client@example.test',lang,payload:{name:'Heron CA'}}).from,'Mr. Space <hello@mrspace.online>');
 }
 assert.equal(plainText({html:'<style>hidden</style><p>Hello &amp; thanks</p><script>alert(1)</script><p>&lt;img&gt;</p>'}),'Hello & thanks\n<img>');
});
await test('editor receipts validate private UUID links and Rufcut mail stays English regardless of requested locale',async()=>{
 for(const lang of ['en','tr','es','de','fr']){
  const payload={name:'Rufcut',edit_key:uuid,version:2,count:3,revised:true};
  const m=renderMail({kind:'request_link',site:'rufcut',lang,recipient:'editor@example.test',payload});assert.match(m.subject,/Your changes were updated/);assert.match(m.text,new RegExp('/request/\\?e='+uuid));assert.match(m.html,/<html lang="en">/);
  const order=renderMail({kind:'order',site:'rufcut',lang,recipient:'client@example.test',payload:{ticket:'RC-TEST',event:'created'}});assert.match(order.text,/Your request reached Rufcut/);
  assert.throws(()=>renderMail({kind:'request_link',site:'rufcut',lang,recipient:'editor@example.test',payload:{...payload,edit_key:'x'.repeat(36)}}),/invalid_message/);
 }
});
await test('webhook uses raw-body HMAC, timestamp window and versioned signatures',async()=>{
 const raw=JSON.stringify({type:'email.delivered',data:{email_id:provider}}),req=signed(raw);
 assert.equal(await verifyWebhook(req,raw,secret),true);assert.equal(await verifyWebhook(req,raw+' ',secret),false);
 assert.equal(await verifyWebhook(signed(raw,{stamp:Math.floor(Date.now()/1000)-301}),raw,secret),false);
 assert.equal(await verifyWebhook(signed(raw,{stamp:Math.floor(Date.now()/1000)+301}),raw,secret),false);
 assert.equal(await verifyWebhook(signed(raw,{signature:'not-the-signature'}),raw,secret),false);
 const h=new Headers(req.headers);h.set('svix-signature','v2,unsupported v1,bad '+h.get('svix-signature'));
 assert.equal(await verifyWebhook(new Request(req.url,{method:'POST',headers:h,body:raw}),raw,secret),true);
});
await test('uncertain provider acknowledgement retries the identical frozen body and idempotency key',async()=>{
 const job={id:uuid,lease:crypto.randomUUID(),site:'rufcut',kind:'welcome',recipient:'client@example.test',lang:'tr',payload:{name:'Rufcut'}};let claims=0,fail=true,frozen;const calls=[],finishes=[];
 const db={rpc:async(name,args)=>{
  if(name==='ms_mail_claim')return {data:claims++%2===0?[{...job,provider_body:frozen}]:[],error:null};
  if(name==='ms_mail_prepare'){frozen||=args.p_body;return {data:frozen,error:null};}
  if(name==='ms_mail_finish'){finishes.push(args);return {data:true,error:null};}throw Error(name);
 }};
 const transport=async(url,options)=>{calls.push(options);if(fail)throw new Error('lost_ack');return Response.json({id:provider});};
 await sendQueued(db,{key:'fixture-only'},transport);assert.equal(finishes[0].p_retry,true);assert.equal(finishes[0].p_provider,null);
 job.payload.name='Changed after first attempt';job.lease=crypto.randomUUID();fail=false;
 await sendQueued(db,{key:'fixture-only'},transport);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);assert.equal(finishes[1].p_provider,provider);
});
await test('missing key never claims jobs and revoked staff never receive queued order details',async()=>{
 let claimed=0,sent=0,done;const db={rpc:async(name,args)=>{
  if(name==='ms_mail_claim')return {data:claimed++===0?[{id:uuid,lease:uuid,payload:{event:'staff',owner_email:'old@example.test'},site:'rufcut',recipient:'old@example.test'}]:[]};
  if(name==='ms_mail_staff_allowed')return {data:false};if(name==='ms_mail_finish'){done=args;return {data:true};}throw Error(name);
 }};
 assert.equal((await sendQueued(db,{key:''},async()=>{sent++;})).setup,true);assert.equal(claimed,0);
 await sendQueued(db,{key:'fixture'},async()=>{sent++;});assert.equal(sent,0);assert.equal(done.p_retry,false);assert.equal(done.p_error,'recipient_access_revoked');
});
function fixture(){
 const state={admin:true,key:'fixture-key',contact:'client@example.test',inbox:{id:uuid,recipient:'rufcut@mrspace.online',sender:'Sender <sender@example.test>',reply_address:'reply@example.test',subject:'A question',message_id:'<original@example.test>'}},writes=[],rpcs=[];
 const db={auth:{getUser:async()=>({data:{user:{email:state.admin?'owner@example.test':'viewer@example.test'}}})},rpc:async(name,args)=>{
  rpcs.push({name,args});if(name==='ms_mail_secrets')return {data:{key:state.key,webhook:secret,cron:'fixture-cron-secret-long-enough'}};
  if(name==='ms_mail_enqueue')return {data:uuid};if(name==='ms_mail_event')return {data:null};if(name==='ms_mail_claim')return {data:[]};throw Error(name);
 },from(table){let update;const q={select:()=>q,eq:()=>q,update:v=>{update=v;return q;},upsert:async v=>{writes.push({table,data:v});return {error:null};},maybeSingle:async()=>({data:table==='ms_admins'?state.admin?{email:'owner@example.test'}:null:table==='ms_sites'?{slug:'rufcut',name:'Rufcut',contact:state.contact}:state.inbox}),then:resolve=>resolve({data:null,error:null})};return q;}};
 const transport=async(url)=>url.includes('/receiving/')?Response.json({from:'Sender <sender@example.test>',to:['rufcut@mrspace.online'],text:null,html:'<p>Help with my order</p><script>bad()</script>',subject:'Help',reply_to:['reply@example.test'],message_id:'<original@example.test>',attachments:[{id:'attachment'}]}):Response.json({data:[{name:'mrspace.online',status:'verified'}]});
 const handler=mailHandler(db,{},transport),post=(body,auth=true)=>handler(new Request('https://test.supabase.co/functions/v1/ms-mail',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://mrspace.online',...(auth?{Authorization:'Bearer fixture-session'}:{})},body:JSON.stringify(body)}));
 return {state,writes,rpcs,handler,post};
}
await test('anonymous and viewer cannot preview contacts, queue messages or dispatch',async()=>{
 const f=fixture();for(const action of ['status','preview','queue','dispatch','reply'])assert.equal((await f.post({action,site:'rufcut',kind:'welcome'},false)).status,401);
 f.state.admin=false;for(const action of ['status','preview','queue','dispatch','reply'])assert.equal((await f.post({action,site:'rufcut',kind:'welcome'})).status,403);
 assert.equal(f.rpcs.some(r=>r.name==='ms_mail_enqueue'),false);
});
await test('queue requires the exact reviewed contact and message; missing real customer address blocks it',async()=>{
 const f=fixture(),draft={site:'rufcut',kind:'site_ready',lang:'tr'},preview=await(await f.post({action:'preview',...draft})).json();
 assert.equal((await f.post({action:'queue',...draft,token:uuid,digest:preview.digest})).status,200);
 f.state.contact='changed@example.test';assert.equal((await f.post({action:'queue',...draft,token:uuid,digest:preview.digest})).status,409);
 f.state.contact='rufcut@mrspace.online';assert.equal((await f.post({action:'preview',...draft})).status,409);
 assert.equal(f.rpcs.filter(r=>r.name==='ms_mail_enqueue').length,1);
});
await test('only signed delivery events change state and inbound HTML becomes inert text',async()=>{
 const f=fixture(),raw=JSON.stringify({type:'email.delivered',data:{email_id:provider}});
 assert.equal((await f.handler(new Request('https://test.supabase.co/functions/v1/ms-mail/webhook',{method:'POST',body:raw}))).status,401);
 assert.equal(f.rpcs.some(r=>r.name==='ms_mail_event'),false);assert.equal((await f.handler(signed(raw))).status,200);
 const incoming=JSON.stringify({type:'email.received',data:{email_id:provider}});assert.equal((await f.handler(signed(incoming))).status,200);
 assert.equal(f.writes[0].data.recipient,'rufcut@mrspace.online');assert.equal(f.writes[0].data.body,'Help with my order');assert.equal(f.writes[0].data.reply_address,'reply@example.test');assert.ok(!('html' in f.writes[0].data));
});
await test('inbox reply uses the recorded reply address and thread; caller cannot redirect it',async()=>{
 const f=fixture();assert.equal((await f.post({action:'reply',id:uuid,token:uuid,text:'Thanks, we will check.',to:'attacker@example.test'})).status,200);
 const q=f.rpcs.find(r=>r.name==='ms_mail_enqueue').args;assert.equal(q.p_to,'reply@example.test');assert.equal(q.p_site,'rufcut');
 const m=renderMail({kind:'reply',site:q.p_site,recipient:q.p_to,lang:'en',payload:q.p_payload});assert.equal(m.headers['In-Reply-To'],'<original@example.test>');assert.equal(m.from,'Rufcut <rufcut@mrspace.online>');
});
await test('bad origin and oversized request bodies fail without queue mutations',async()=>{
 const f=fixture();assert.equal((await f.handler(new Request('https://test/ms-mail',{method:'POST',headers:{Origin:'https://attacker.example'},body:'{}'}))).status,403);
 assert.equal((await f.handler(new Request('https://test/ms-mail',{method:'POST',body:'x'.repeat(120001)}))).status,413);assert.equal(f.rpcs.some(r=>r.name==='ms_mail_enqueue'),false);
});
console.log(`${count} mail Edge checks passed; no external mail or DB requests`);
