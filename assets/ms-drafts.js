/* Device-only journals. Callers store document content, never sessions or access keys. */
(() => {
  'use strict';
  const PREFIX='ms-device-draft:v1:', TTL=7*24*60*60*1000, MAX_BYTES=600000, MAX_DRAFTS=12;
  async function open(namespace, identity) {
    if(!/^[a-z-]{1,40}$/.test(namespace) || !identity) throw new Error('invalid_draft_identity');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(namespace+':'+identity));
    const key=PREFIX+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    function read(){
      try{
        const raw=localStorage.getItem(key);if(!raw)return {ok:true,value:null};
        if(new TextEncoder().encode(raw).length>MAX_BYTES)return {ok:false,value:null};
        const row=JSON.parse(raw);
        if(row?.v!==1 || typeof row.revision!=='string' || !Number.isFinite(row.at) || row.at>Date.now()+60000 || !row.value || typeof row.value!=='object')return {ok:false,value:null};
        if(Date.now()-row.at>TTL){localStorage.removeItem(key);return {ok:true,value:null};}
        return {ok:true,value:row.value,revision:row.revision,at:row.at};
      }catch(_){return {ok:false,value:null};}
    }
    function clear(revision){
      try{const current=read();if(!current.ok)return false;if(current.value && current.revision!==revision)return false;localStorage.removeItem(key);return true;}catch(_){return false;}
    }
    function write(value){
      try{
        const row={v:1,at:Date.now(),revision:crypto.randomUUID(),value},raw=JSON.stringify(row);
        if(new TextEncoder().encode(raw).length>MAX_BYTES)return {ok:false};
        const siblings=Object.keys(localStorage).filter(k=>k.startsWith(PREFIX) && k!==key);
        for(const other of siblings){try{const entry=JSON.parse(localStorage.getItem(other));if(entry?.v===1 && Number.isFinite(entry.at) && Date.now()-entry.at>TTL)localStorage.removeItem(other);}catch(_){}}
        // Keep other workspaces intact if this device has reached its draft limit.
        if(!localStorage.getItem(key) && Object.keys(localStorage).filter(k=>k.startsWith(PREFIX)).length>=MAX_DRAFTS)return {ok:false};
        localStorage.setItem(key,raw);return {ok:true,revision:row.revision};
      }catch(_){return {ok:false};}
    }
    return Object.freeze({read,write,clear});
  }
  window.MsDrafts=Object.freeze({open,ttl:TTL});
})();
