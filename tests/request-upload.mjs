// Exercise the actual Edge Function handler with isolated database/storage doubles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync(new URL('../supabase/functions/ms-builder/index.ts',import.meta.url),'utf8').replace('import { createClient } from "jsr:@supabase/supabase-js@2";','');
const key='11111111-1111-4111-8111-111111111111',edit='22222222-2222-4222-8222-222222222222',trial='33333333-3333-4333-8333-333333333333';
let passed=0;
function fixture(){
 const calls=[],uploads=[],state={count:0,fail:false};let handler;
 const db={from(table){let filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},gte(){return q;},async maybeSingle(){calls.push({table,filters:{...filters}});if(table==='ms_submissions')return {data:filters.edit_key===edit?{site:'rufcut'}:null};if(table==='ms_sites')return {data:filters.site_key===key||filters.slug==='rufcut'?{slug:'rufcut'}:null};if(table==='ms_trials')return {data:filters.token===trial?{id:9,status:'draft'}:null};return {data:null};},async insert(){return {error:null};},then(resolve){resolve({count:state.count});}};return q;},storage:{from(bucket){assert.equal(bucket,'ms-media');return {async list(){return {data:[]};},async upload(path,file,options){uploads.push({path,size:file.size,options});return {error:state.fail?{message:'offline'}:null};}};}}};
 vm.runInNewContext(stripTypeScriptTypes(source,{mode:'strip'}),{createClient:()=>db,Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://test.supabase.co':'server-only'},serve:fn=>handler=fn},Request,Response,File,FormData,crypto,fetch,AbortSignal,URL,console,EdgeRuntime:{waitUntil(){}}});
 async function upload(fields,file=new File([new Uint8Array([1,2,3])],'photo.webp',{type:'image/webp'})){
  const form=new FormData();for(const [k,v]of Object.entries(fields))form.append(k,v);form.append('file',file);return handler(new Request('https://test.supabase.co/functions/v1/ms-builder',{method:'POST',body:form}));
 }return {calls,uploads,state,upload};
}
async function test(label,fn){await fn();passed++;console.log('PASS '+label);}
await test('site key uploads only to its authorized site',async()=>{const f=fixture(),r=await f.upload({key});assert.equal(r.status,200);assert.match((await r.json()).url,/ms-media\/rufcut\//);assert.equal(f.uploads.length,1);});
await test('revision capability resolves its own site without returning site_key',async()=>{const f=fixture(),r=await f.upload({edit});assert.equal(r.status,200);const body=await r.text();assert.match(body,/ms-media\/rufcut\//);assert.ok(!body.includes(key));assert.deepEqual(f.calls.map(x=>x.table),['ms_submissions','ms_sites']);assert.deepEqual(f.calls[1].filters,{slug:'rufcut'});});
await test('unknown and malformed capabilities never upload',async()=>{for(const fields of [{edit:'44444444-4444-4444-8444-444444444444'},{edit:'------------------------------------'},{key:'44444444-4444-4444-8444-444444444444'},{}]){const f=fixture(),r=await f.upload(fields);assert.ok([400,403].includes(r.status));assert.equal(f.uploads.length,0);}});
await test('media types, size and rate limit are enforced for revision links',async()=>{
 for(const [file,expected]of [[new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'}),400],[new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'}),400]]){const f=fixture();assert.equal((await f.upload({edit},file)).status,expected);assert.equal(f.uploads.length,0);}
 const f=fixture();f.state.count=80;assert.equal((await f.upload({edit})).status,429);assert.equal(f.uploads.length,0);
});
await test('trial uploads retain the original trial scope',async()=>{const f=fixture(),r=await f.upload({trial});assert.equal(r.status,200);assert.match((await r.json()).url,/ms-media\/trials\/9\//);});
await test('storage failure does not report a successful upload',async()=>{const f=fixture();f.state.fail=true;assert.equal((await f.upload({edit})).status,500);});
console.log(JSON.stringify({passed,failures:0}));
