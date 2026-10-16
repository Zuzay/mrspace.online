import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { staffUser } from '../_shared/notifications.ts';
import { fields, backupFiles } from './manifest.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const origins=['https://mrspace.online','https://www.rufcutjeans.com','https://rufcutjeans.com'];
const bucket='ms-site-backups',mediaRoot=Deno.env.get('SUPABASE_URL')!+'/storage/v1/object/public/ms-media/';
function response(req:Request,data:unknown,status=200){const origin=req.headers.get('origin')||origins[0];return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}});}
function checked(r:any){if(r.error)throw Error(r.error.message||'unavailable');return r.data;}
export function validate(changes:any){
 if(!Array.isArray(changes)||!changes.length||changes.length>500)throw Error('invalid_changes');
 const result:Record<string,unknown>={};
 for(const c of changes){
  const kind=(fields as any)[c?.page]?.[c?.field];
  if(!kind||c.type!==kind||!['en','tr','es','de','fr'].includes(c.lang)||typeof c.value!=='string'||c.value.length>1800)throw Error('invalid_field');
  if(kind==='color'&&!/^#[0-9a-f]{6}$/i.test(c.value))throw Error('invalid_color');
  if(kind==='image'&&(!c.value.startsWith(mediaRoot+'rufcut/')||/[\s?#]/.test(c.value)))throw Error('upload_photo_first');
  // Text is rendered with textContent, never interpreted as HTML.
  result[c.page+'|'+c.field+'|'+(kind==='text'?c.lang:'all')]={type:kind,value:c.value};
 }
 return result;
}
async function gc(){
 const rows=checked(await db.rpc('ms_content_gc_paths',{}))||[];
 for(const row of rows){const r=await db.storage.from(bucket).remove([row.object_path]);if(!r.error)checked(await db.from('ms_site_content_gc').delete().eq('object_path',row.object_path));}
}
function base64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
async function archive(state:any){
 const urls=[...backupFiles.map(path=>'https://mrspace.online'+path),...Object.values(state.fields).filter((v:any)=>v.type==='image').map((v:any)=>v.value)];
 const files:any[]=[];let total=0;
 // Restrict every fetch to known static assets or previously validated immutable customer uploads.
 for(let start=0;start<urls.length;start+=6){await Promise.all([...new Set(urls)].slice(start,start+6).map(async url=>{
  if(!url.startsWith('https://mrspace.online/')&&!url.startsWith(mediaRoot+'rufcut/'))throw Error('invalid_backup_url');
  const r=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('backup_fetch_failed');
  const bytes=new Uint8Array(await r.arrayBuffer());total+=bytes.length;if(total>32000000)throw Error('backup_too_large');
  files.push({url,type:r.headers.get('content-type'),sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),base64:base64(bytes)});
 }));}
 const path='rufcut/'+state.day+'/'+crypto.randomUUID()+'.json';
 checked(await db.storage.from(bucket).upload(path,new Blob([JSON.stringify({version:1,site:'rufcut',captured_at:new Date().toISOString(),revision:state.revision,fields:state.fields,files})],{type:'application/json'}),{contentType:'application/json',upsert:false}));
 return path;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return response(req,{ok:true});
 if(req.headers.get('origin')&&!origins.includes(req.headers.get('origin')!))return response(req,{error:'origin_not_allowed'},403);
 if(req.method!=='POST')return response(req,{error:'method_not_allowed'},405);
 let uploaded:string|null=null;
 try{
  const raw=await req.text();if(raw.length>400000)throw Error('invalid_request');const b=JSON.parse(raw);
  if(b.site!=='rufcut')return response(req,{error:'not_available'},404);
  const state=checked(await db.rpc('ms_content_status',{p_site:b.site}));if(!state)return response(req,{error:'not_available'},404);
  if(b.action==='public')return response(req,{revision:state.revision,fields:state.fields});
  const who=await staffUser(db,req,b.site);if(!who)return response(req,{error:'unauthorized'},401);
  if(b.action==='get')return response(req,{...state,allowed:fields,timezone:'America/Los_Angeles'});
  // Archives are for Mr. Space only; no customer restore/download endpoint exists.
  if(b.action==='backups'){
   const admin=checked(await db.from('ms_admins').select('email').eq('email',who).maybeSingle());if(!admin)return response(req,{error:'forbidden'},403);
   const rows=checked(await db.from('ms_site_content_backups').select('change_day,revision,object_path,created_at').eq('site',b.site).order('change_day',{ascending:false}));
   const backups=await Promise.all(rows.map(async(row:any)=>({...row,url:checked(await db.storage.from(bucket).createSignedUrl(row.object_path,60)).signedUrl})));
   return response(req,{backups});
  }
  if(b.action!=='publish')return response(req,{error:'unknown_action'},400);
  if(!state.enabled)return response(req,{error:'disabled'},403);
  const changes=validate(b.changes);
  if(!Number.isSafeInteger(b.revision)||!/^[-0-9a-f]{36}$/i.test(b.request||''))throw Error('invalid_request');
  if(state.revision!==b.revision){
   const row=checked(await db.from('ms_site_content').select('last_request').eq('site',b.site).single());
   if(row.last_request===b.request)return response(req,{ok:true,revision:state.revision,replayed:true});
   return response(req,{error:'conflict'},409);
  }
  if(state.backup_needed)uploaded=await archive(state);
  const result=checked(await db.rpc('ms_content_publish',{p_site:b.site,p_revision:b.revision,p_request:b.request,p_changes:changes,p_backup:uploaded,p_day:state.day,p_who:who}));
  try{await gc();}catch{/* Retry queued cleanup on the next publish; never endanger the five retained snapshots. */}
  return response(req,result);
 }catch(error){
  // An uncertain commit must never delete a potentially active backup.

  const message=String((error as Error).message);return response(req,{error:message.includes('conflict')||message.includes('day_changed')?'conflict':'publish_failed'},message.includes('conflict')||message.includes('day_changed')?409:400);
 }
});
