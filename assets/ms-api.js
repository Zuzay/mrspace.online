/* Oturum sınırı; sırlar veya site anahtarları taşımayan yönetim istemcisi. */
(function(){
  'use strict';
  function create(store='ms_admin') {
    let session=null,refreshing=null;
    try{session=JSON.parse(localStorage.getItem(store)||'null');}catch{}
    async function fresh(){
      if(!session?.access_token)throw new Error('sign_in_required');
      if(Date.now()/1000<Number(session.expires_at)-60)return;
      refreshing ||= (async()=>{
        const r=await fetch(`${MS_CONFIG.url}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:MS_CONFIG.anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),signal:AbortSignal.timeout(10000)});
        if(!r.ok)throw new Error('session_expired');const d=await r.json();
        session={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Date.now()/1000+d.expires_in,email:d.user?.email};
        try{localStorage.setItem(store,JSON.stringify(session));}catch{}
      })().finally(()=>refreshing=null);await refreshing;
    }
    async function call(path,body,edge=false){
      await fresh();const r=await fetch(`${MS_CONFIG.url}/${edge?'functions/v1/':'rest/v1/'}${path}`,{method:body===undefined?'GET':'POST',headers:{apikey:MS_CONFIG.anon,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
      if(!r.ok)throw new Error('request_failed');return r.status===204?null:r.json();
    }
    return {get:path=>call(path),rpc:(name,body={})=>call(`rpc/${name}`,body),control:body=>call('ms-site-control',body,true)};
  }
  window.MsApi={create};
})();
