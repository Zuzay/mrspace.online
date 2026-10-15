/* Public storefront adapter for the one shared /request/ editor. No admin APIs or keys. */
(function(){
 'use strict';
 if(window.parent===window||!['heronca.com','www.heronca.com','laloo.org','www.laloo.org'].includes(location.hostname))return;
 // Private panels, checkout, receipts and user pages never export their DOM.
 if(!['/','/index.html','/about.html'].includes(location.pathname))return;
 let busy=false;
 window.addEventListener('message',async event=>{
  if(event.origin!=='https://mrspace.online'||event.source!==window.parent||event.data?.type!=='ms:editor:snapshot'||!/^[0-9a-f-]{36}$/i.test(event.data.nonce||'')||busy)return;
  busy=true;
  try{
   await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]);
   const clone=document.documentElement.cloneNode(true);
   clone.querySelectorAll('script,iframe,object,embed,form,input,textarea,select,base,meta[http-equiv],link[rel=preload],link[rel=modulepreload]').forEach(el=>el.remove());
   clone.querySelectorAll('*').forEach(el=>{
    [...el.attributes].forEach(a=>{if(/^on/i.test(a.name)||['srcdoc','nonce','integrity'].includes(a.name)||(['href','src','xlink:href','action'].includes(a.name)&&/^\s*(?:javascript|data:text\/html)/i.test(a.value)))el.removeAttribute(a.name);});
   });
   // Catalog values and the map use their native panels. They are visible context, never text edits.
   clone.querySelectorAll('#grid,#bands,#count,#map,#place-list,.leaflet-control,.map-context,.explorer-footer,header,footer').forEach(el=>el.setAttribute('data-ms-skip',''));
   const html='<!doctype html>'+clone.outerHTML;
   if(new TextEncoder().encode(html).length<=1000000)window.parent.postMessage({type:'ms:editor:snapshot:result',nonce:event.data.nonce,html,url:location.href},event.origin);
  }finally{busy=false;}
 });
})();
