// Edge handlers run with isolated DB/fetch doubles. No remote request or live mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createDraft} from '../ms/draft-render.mjs';
const require=createRequire(import.meta.url),ts=require(process.env.MS_TYPESCRIPT_MODULE);
const renderer={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../assets/ms-render.js',import.meta.url),'utf8'),renderer);
let count=0;
async function test(label,fn){await fn();count++;console.log('PASS '+label);}
function load(file,state){
 let handler;const writes=[],fetches=[];
 const db={auth:{getUser:async()=>({data:{user:state.user??{email:'owner@example.test'}},error:null})},
  rpc:async(name,args)=>{if(name==='ms_claim_draft')return {data:state.jobs?.shift()||null,error:null};if(name==='ms_complete_draft'){writes.push({name,args});return {error:state.completeError?{message:'test_private_error'}:null};}if(name==='ms_submit_intake'){writes.push({name,args});return {data:{ok:true,id:19},error:null};}return {data:[],error:state.rpcError?{message:'test_private_error'}:null};},
  from(table){const query={select(){return query;},eq(){return query;},limit(){return Promise.resolve({data:[],error:null});},maybeSingle(){return Promise.resolve({data:table==='ms_admins'?(state.admin===false?null:{email:'owner@example.test'}):table==='ms_sites'?{url:state.siteURL||'https://heronca.com/',slug:'heron'}:null,error:null});},upsert(rows){writes.push({table,rows});return Promise.resolve({error:null});},insert(row){writes.push({table,row});return Promise.resolve({error:null});}};return query;}
 };
 const code=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8').replace(/^import .+;\s*$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});
 assert.equal(code.diagnostics?.length||0,0);
 vm.runInNewContext(code.outputText,{MsRender:renderer.window.MsRender,createDraft,Deno:{env:{get:name=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',HERON_ADMIN_PASSWORD:state.heronPassword||''}[name])},serve:fn=>handler=fn},createClient:()=>db,Request,Response,Headers,URL,AbortSignal,TextEncoder,TextDecoder,Uint8Array,crypto:globalThis.crypto,console:{error(){}},fetch:async(url,options)=>{fetches.push({url:String(url),options});return state.fetch?state.fetch(url,options):new Response('<h1>Read-only live content</h1>',{headers:{'Content-Type':'text/html'}});}});
 return {handler,writes,fetches};
}
const post=(body,auth=true)=>new Request('https://test.supabase.co/functions/v1/ms-site-control',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test-token'}:{})},body:JSON.stringify(body)});
await test('unauthenticated and viewer users cannot proxy or snapshot sites',async()=>{
 const anonymous=load('../supabase/functions/ms-site-control/index.ts',{});assert.equal((await anonymous.handler(post({action:'preview_snapshot',site:'heron'},false))).status,401);assert.equal(anonymous.fetches.length,0);
 const viewer=load('../supabase/functions/ms-site-control/index.ts',{admin:false});assert.equal((await viewer.handler(post({action:'preview_snapshot',site:'heron'}))).status,403);assert.equal(viewer.fetches.length,0);
});
await test('old Heron backend remains setup; the active admin token is forwarded without a shared password',async()=>{
 const f=load('../supabase/functions/ms-site-control/index.ts',{fetch:()=>Response.json({error:'Wrong password'},{status:401})});const response=await f.handler(post({action:'check_connections',site:'heron'}));assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.checks.find(x=>x.service==='heron').state,'setup');assert.equal(data.checks.find(x=>x.service==='requests').state,'connected');assert.equal(f.fetches.length,1);assert.equal(f.fetches[0].options.headers['x-mrspace-token'],'test-token');assert.equal(f.writes[0].table,'ms_service_connections');
 const current=load('../supabase/functions/ms-site-control/index.ts',{fetch:()=>Response.json({items:[]})});assert.equal((await current.handler(post({action:'admin_list'}))).status,200);assert.equal(current.fetches[0].options.headers['x-mrspace-token'],'test-token');
});
await test('snapshot fetch refuses foreign hosts, credentials and redirect escapes',async()=>{
 for(const siteURL of ['https://private.test/','http://heronca.com/','https://user:password@heronca.com/','https://heronca.com:8443/']){
 const f=load('../supabase/functions/ms-site-control/index.ts',{siteURL});assert.equal((await f.handler(post({action:'preview_snapshot',site:'heron'}))).status,400);assert.equal(f.fetches.length,0);
 }
 const f=load('../supabase/functions/ms-site-control/index.ts',{fetch:()=>new Response(null,{status:302,headers:{Location:'http://127.0.0.1/'}})});assert.equal((await f.handler(post({action:'preview_snapshot',site:'heron'}))).status,400);assert.equal(f.fetches.length,1);
});
await test('allowed snapshot is bounded and includes only a read-only result',async()=>{
 const f=load('../supabase/functions/ms-site-control/index.ts',{}),response=await f.handler(post({action:'preview_snapshot',site:'heron'}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.match((await response.json()).html,/Read-only/);assert.equal(f.writes.length,0);
 const huge=load('../supabase/functions/ms-site-control/index.ts',{fetch:()=>new Response('x'.repeat(1000001),{headers:{'Content-Type':'text/html'}})});assert.equal((await huge.handler(post({action:'preview_snapshot',site:'heron'}))).status,413);
});
await test('native bridge errors cannot reveal a server secret',async()=>{
 const f=load('../supabase/functions/ms-site-control/index.ts',{heronPassword:'private-test-password',fetch:()=>new Response(JSON.stringify({error:'private-test-password'}),{status:500,headers:{'Content-Type':'application/json'}})});
 const response=await f.handler(post({action:'admin_list'}));assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/private-test-password/);
});
await test('public application endpoint rejects traps, bad origins and oversized bodies',async()=>{
 const f=load('../supabase/functions/ms-intake/index.ts',{});
 const body={token:'11111111-1111-4111-8111-111111111111',name:'Test owner',business:'Test shop',email:'test@example.test',sector:'retail',answers:{}};
 const send=(data,origin='https://mrspace.online')=>new Request('https://test.supabase.co/functions/v1/ms-intake',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-forwarded-for':'192.0.2.20'},body:JSON.stringify(data)});
 assert.equal((await f.handler(send(body,'https://unknown.test'))).status,403);assert.equal((await f.handler(send({...body,website:'bot'}))).status,400);assert.equal((await f.handler(send({...body,answers:{brief:'x'.repeat(25000)}}))).status,413);assert.equal(f.writes.length,0);
 const response=await f.handler(send(body));assert.equal(response.status,200);assert.equal((await response.json()).id,19);assert.match(f.writes[0].args.p_sender_hash,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(f.writes),/192\.0\.2\.20/);
});
await test('draft preparation claims at most two jobs and leaves unknown tools for a human',async()=>{
 const jobs=[{id:1,sector:'food',kind:'design',brief:'A quiet neighborhood cafe'},{id:2,sector:'fashion',kind:'tool',brief:'An automatic photography application'},{id:3,sector:'retail',kind:'design',brief:'A local neighborhood shop'}];
 const f=load('../supabase/functions/ms-site-control/index.ts',{jobs});const response=await f.handler(post({action:'prepare_drafts'}));assert.equal(response.status,200);assert.equal(jobs.length,1);assert.equal(f.fetches.length,0);assert.equal(f.writes.length,2);assert.match(f.writes[0].args.p_html,/TASLAK/);assert.doesNotMatch(f.writes[0].args.p_html,/<script/i);assert.equal(f.writes[1].args.p_error,'human_implementation_required');
 const viewer=load('../supabase/functions/ms-site-control/index.ts',{admin:false,jobs});assert.equal((await viewer.handler(post({action:'prepare_drafts'}))).status,403);assert.equal(jobs.length,1);
});
await test('a draft save failure cannot return a successful preparation',async()=>{
 const f=load('../supabase/functions/ms-site-control/index.ts',{completeError:true,jobs:[{id:1,sector:'food',kind:'design',brief:'A quiet neighborhood cafe'}]});assert.equal((await f.handler(post({action:'prepare_drafts'}))).status,503);
});
console.log(`${count} Edge checks passed`);
