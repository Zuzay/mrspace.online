/* Public, data-only content. Never runs customer HTML, CSS or JavaScript. */
(function(){
 'use strict';
 const cfg=window.MS_CONFIG;
 const ready=(async()=>{
  if(!cfg)return null;
  try{
   const r=await fetch(cfg.url+'/functions/v1/ms-content',{method:'POST',headers:{apikey:cfg.anon,'Content-Type':'application/json'},body:JSON.stringify({site:'rufcut',action:'public'}),cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('content');const data=await r.json();await window.MSI18N?.ready;
   const language=window.MSI18N?.lang||localStorage.getItem('ms_lang')||'en';
   for(const [key,item]of Object.entries(data.fields||{})){
    const [page,id,lang]=key.split('|');if(page!=='/rufcut/'||!['all',language].includes(lang))continue;
    const matches=document.querySelectorAll('[data-ms-field="'+CSS.escape(id)+'"]');if(matches.length!==1)continue;const el=matches[0];
    if(el.closest('[data-ms-skip],[data-ms-runtime]'))continue;
    if(item.type==='text'&&typeof item.value==='string')el.textContent=item.value;
    if(item.type==='color'&&/^#[0-9a-f]{6}$/i.test(item.value)){el.style.background=item.value;el.dispatchEvent(new CustomEvent('ms:editor-color-preview',{bubbles:true}));}
    if(item.type==='image'&&el.tagName==='IMG'&&item.value.startsWith(cfg.url+'/storage/v1/object/public/ms-media/rufcut/')){el.removeAttribute('srcset');el.removeAttribute('sizes');el.src=item.value;}
   }
   document.documentElement.dataset.msContentRevision=String(data.revision);return data;
  }catch{return null;}
 })();
 window.MsSiteContent=Object.freeze({ready});
})();
