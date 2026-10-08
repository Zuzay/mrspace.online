import { createClient } from 'jsr:@supabase/supabase-js@2';
const origins=new Set(['https://mrspace.online','https://www.mrspace.online']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async request=>{
  const origin=request.headers.get('origin')||'';
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};
  const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!origins.has(origin))return reply(403,{error:'origin_not_allowed'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  try{
    const reader=request.body?.getReader();if(!reader)return reply(400,{error:'invalid_application'});
    const chunks:Uint8Array[]=[];let length=0;
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>24000){await reader.cancel();return reply(413,{error:'too_large'});}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if(body.website||!uuid.test(body.token||'')||typeof body.answers!=='object'||Array.isArray(body.answers))return reply(400,{error:'invalid_application'});
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)return reply(503,{error:'not_configured'});
    // Supabase's gateway supplies this header. Raw IP is never stored or returned.
    const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim();if(!ip)return reply(503,{error:'sender_unavailable'});
    const hmacKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const digest=await crypto.subtle.sign('HMAC',hmacKey,new TextEncoder().encode(ip));
    const senderHash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
    const {data,error}=await client.rpc('ms_submit_intake',{p_token:body.token,p_name:body.name,p_business:body.business,p_email:body.email||null,p_phone:body.phone||null,p_sector:body.sector,p_answers:body.answers,p_sender_hash:senderHash});
    if(error)return reply(error.message.includes('too_many')?429:400,{error:error.message.includes('too_many')?'too_many':'application_not_saved'});
    return reply(200,data);
  }catch{return reply(400,{error:'application_not_saved'});}
});
