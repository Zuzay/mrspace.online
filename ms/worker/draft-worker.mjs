// Varsayılan kapalı, en fazla iki hazır kaynağa dayanan taslak. Ücretli model çağrısı yok.
import {createDraft} from './draft-factory.mjs';
const env=process.env;
if(env.MS_DRAFT_ENABLED!=='true'){console.log('Taslak atölyesi kapalı.');process.exit(0);}
const url=env.SUPABASE_URL?.replace(/\/$/,''),key=env.SUPABASE_SERVICE_KEY;
if(!url||!key)throw new Error('Supabase configuration required');
async function rpc(name,args={}){
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',signal:AbortSignal.timeout(20000),headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!response.ok)throw new Error(`RPC ${name} failed (${response.status})`);
  const value=await response.text();return value?JSON.parse(value):null;
}
for(let n=0;n<2;n++){
  const job=await rpc('ms_claim_draft');if(!job)break;
  let html=null,error=null;
  try{html=createDraft(job);}catch(e){error=['invalid_brief','human_implementation_required','invalid_kind'].includes(e.message)?e.message:'preparation_failed';}
  await rpc('ms_complete_draft',{p_id:job.id,p_html:html,p_error:error});
  console.log(`Draft #${job.id}: ${error?'human review needed':'prepared for review'}`);
}
