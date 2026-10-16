import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../',import.meta.url),manifest=fs.readFileSync(new URL('supabase/functions/ms-content/manifest.ts',root),'utf8');
const fields=JSON.parse(manifest.match(/export const fields = (.*);/)[1]);
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only'};
const source=stripTypeScriptTypes(fs.readFileSync(new URL('supabase/functions/ms-content/index.ts',root),'utf8').replace(/^import .*;\s*$/gm,'').replace('export function validate','function validate'),{mode:'transform'});
function fixture({member=true,revision=0,needed=false,backupFail=false}={}){
 let handler,publishes=0,uploads=0;const state={enabled:true,revision,fields:{},day:'2026-10-15',backup_needed:needed};
 const chain={select(){return this;},eq(){return this;},limit:async()=>({data:[],error:null}),single:async()=>({data:{last_request:null},error:null}),maybeSingle:async()=>({data:null,error:null})};
 const db={from:()=>chain,rpc:async(name,args)=>{if(name==='ms_content_status')return {data:state};if(name==='ms_content_gc_paths')return {data:[]};publishes++;assert.ok(!needed||uploads>0);return {data:{ok:true,revision:revision+1}};},storage:{from:()=>({upload:async()=>{uploads++;return {data:{},error:backupFail?{message:'failed'}:null};}})}};
 const context={createClient:()=>db,fields,backupFiles:['/rufcut/index.html'],staffUser:async()=>member?'owner@example.test':null,Deno:{env:{get:k=>env[k]},serve:f=>handler=f},Request,Response,Blob,Uint8Array,AbortSignal,crypto:globalThis.crypto,fetch:async()=>new Response('<html>previous live site</html>'),btoa,console};vm.runInNewContext(source,context);
 const call=body=>handler(new Request('https://test.supabase.co/functions/v1/ms-content',{method:'POST',headers:{Origin:'https://mrspace.online'},body:JSON.stringify({site:'rufcut',...body})}));return {call,count:()=>({publishes,uploads})};
}
const change={page:'/rufcut/',field:'opening.p.1',type:'text',lang:'en',value:'Updated workshop'};
const payload={action:'publish',revision:0,request:'7b1d5c35-e743-4c7e-b8a3-78a91944e179',changes:[change]};
for(const [label,fn]of [
 ['public endpoint exposes no private backup paths',async()=>{const f=fixture();const d=await(await f.call({action:'public'})).json();assert.deepEqual(Object.keys(d).sort(),['fields','revision']);}],
 ['nonmembers cannot publish',async()=>{const f=fixture({member:false});assert.equal((await f.call(payload)).status,401);assert.equal(f.count().publishes,0);}],
 ['text publishes without invoking an AI model',async()=>{const f=fixture();assert.equal((await f.call(payload)).status,200);assert.equal(f.count().publishes,1);}],
 ['protected identity, payment and layout fields are rejected',async()=>{for(const field of ['header.a.1','ownership','billing.amount','script']){const f=fixture();assert.equal((await f.call({...payload,changes:[{...change,field}]})).status,400);assert.equal(f.count().publishes,0);}}],
 ['unsafe images, invalid colours and changed field types fail',async()=>{for(const c of [{...change,type:'image',value:'https://127.0.0.1/a'},{...change,field:'maker.button.16',type:'color',value:'url(x)'},{...change,page:'/another-site/'}]){assert.equal((await fixture().call({...payload,changes:[c]})).status,400);}}],
 ['stale revision cannot overwrite a later publish',async()=>{const f=fixture({revision:1});assert.equal((await f.call(payload)).status,409);assert.equal(f.count().publishes,0);}],
 ['first publish must archive previous files',async()=>{const f=fixture({needed:true});assert.equal((await f.call(payload)).status,200);assert.equal(f.count().uploads,1);}],
 ['backup failure prevents publication',async()=>{const f=fixture({needed:true,backupFail:true});assert.equal((await f.call(payload)).status,400);assert.equal(f.count().publishes,0);}],
 ['customer cannot access private archives',async()=>{assert.equal((await fixture().call({action:'backups'})).status,403);}]
]){await fn();console.log('PASS '+label);}
