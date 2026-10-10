// Execute the actual handlers and shared modules without live DB, mail or push calls.
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const shared=source('../supabase/functions/_shared/web-push.ts')+'\n'+source('../supabase/functions/_shared/notifications.ts');
export function service(kind='repair'){
 let handler;const state={jobs:[],tokens:new Map(),preferences:[],subscriptions:[],admin:true,viewer:false,member:false,user:'owner@example.test',saveFail:false,emailFail:false,mailReady:false,pushExpire:false,secrets:{vapid:null}};
 const calls={writes:[],fetches:[],reads:[],rpc:[]};
 const db={auth:{getUser:async token=>({data:{user:token&&state.user?{email:state.user}:null}})},
 async rpc(name,args){calls.rpc.push({name,args});if(name==='ms_mail_transport_ready')return {data:state.mailReady===true,error:null};if(name==='ms_notification_secrets'){if(!state.secrets.vapid&&args.p_vapid)state.secrets.vapid=args.p_vapid;return {data:state.secrets};}
 if(name==='ms_create_work_order'){
  if(state.saveFail)return {error:{message:'storage_failed'}};
  const prior=state.tokens.get(args.p_token);if(prior)return {data:prior.fingerprint===args.p_fingerprint?{ticket:prior.ticket,duplicate:true}:{error:'token_conflict'}};
  const job={...args.p_order,id:crypto.randomUUID(),status:'received',staff_notes:'',measurements:'',created_at:new Date().toISOString()};state.jobs.push(job);state.tokens.set(args.p_token,{ticket:job.ticket,fingerprint:args.p_fingerprint});calls.writes.push({table:'ms_repair_jobs',job});return {data:{ticket:job.ticket,duplicate:false}};
 }throw Error('unmocked_rpc '+name);},
 from(table){let filters=[],columns='',operation=null;const collection=()=>table==='ms_admins'?(state.admin?[{email:state.user}]:[]):table==='ms_viewers'?(state.viewer?[{email:state.user,until:null}]:[]):table==='ms_site_users'?(state.member?[{email:state.user,site:'rufcut'}]:[]):table==='ms_repair_jobs'?state.jobs:table==='ms_notification_preferences'?state.preferences:table==='ms_push_subscriptions'?state.subscriptions:[];
 const match=row=>filters.every(([k,v,neq])=>neq?row[k]!==v:row[k]===v);
 const result=()=>{if(operation){calls.writes.push({table,operation,filters});if(operation.type==='update')collection().filter(match).forEach(row=>Object.assign(row,operation.value));if(operation.type==='upsert'){const rows=collection(),value=operation.value,old=rows.find(row=>row.site===value.site&&(table==='ms_push_subscriptions'?row.endpoint===value.endpoint:row.owner_email===value.owner_email));if(old)Object.assign(old,value);else rows.push({...value});}}else calls.reads.push({table,columns,filters});const rows=collection().filter(match);return {data:columns&&columns!=='*'?rows.map(row=>Object.fromEntries(columns.split(',').map(k=>[k,row[k]]))):rows,error:null};};
 const q={select(value){columns=value;return q;},eq(k,v){filters.push([k,v,false]);return q;},neq(k,v){filters.push([k,v,true]);return q;},order(){return q;},limit(){return q;},update(value){operation={type:'update',value};return q;},upsert(value){operation={type:'upsert',value};return q;},maybeSingle:async()=>{const r=result();return {...r,data:r.data[0]||null};},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};return q;}
 };
 const runtime={Deno:{env:{get:name=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-key',RESEND_API_KEY:state.mailReady?'test-mail-key':'',RESEND_FROM_EMAIL:state.mailReady?'Workshop <shop@example.test>':''}[name])},serve:fn=>handler=fn},createClient:()=>db,Request,Response,Headers,URL,AbortSignal,TextEncoder,TextDecoder,Uint8Array,Set,Map,Date,JSON,crypto,atob,btoa,console:{error(){}},fetch:async(url,options)=>{calls.fetches.push({url:String(url),options});return new Response('',{status:String(url).includes('resend.com')?(state.emailFail?503:200):(state.pushExpire?410:201)});}};
 vm.runInNewContext(stripTypeScriptTypes(shared+'\n'+source(kind==='repair'?'../supabase/functions/ms-repair/index.ts':'../supabase/functions/ms-notifications/index.ts'),{mode:'strip'}),runtime);
 async function post(body,options={}){return handler(new Request('https://test.supabase.co/functions/v1/'+(kind==='repair'?'ms-repair':'ms-notifications'),{method:'POST',headers:{'Content-Type':'application/json',Origin:options.origin||'https://mrspace.online',...(options.auth?{Authorization:'Bearer test-session'}:{})},body:JSON.stringify(body)}));}
 return {state,calls,post,handler,db};
}
